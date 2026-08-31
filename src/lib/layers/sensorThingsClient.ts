import type {
	GeoJSONFeature,
	GeoJSONFeatureCollection,
	GeoJSONGeometry
} from 'ol/format/GeoJSON';
import { toStaTimestamp, type TimeWindow } from '$lib/utils/time';

/**
 * Minimal OGC SensorThings API client.
 *
 * Ported from `anol/src/anol/sensorthings/sensorthingsClient.js`, with the
 * lodash-based flattening rewritten against plain JavaScript.
 */

export interface SensorThingsUrlParameters {
	filter?: string;
	expand?: string;
}

interface SensorThingsResponse {
	value: JsonObject[];
	'@iot.nextLink'?: string;
}

/**
 * A datastream flattened into GeoJSON feature properties, e.g.
 * `Observations.0.result` or `Thing.Locations.0.@iot.id`.
 */
export type FlatProperties = Record<string, string | number | boolean | null>;

/** Anything `JSON.parse` can produce, and nothing else. */
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
interface JsonObject {
	[key: string]: JsonValue;
}

/**
 * Flatten nested objects and arrays into dotted keys.
 *
 * Feature info configs address observation values by their flattened path
 * (`Observations.0.result`), so the shape has to match the AngularJS client's
 * exactly.
 */
function flattenObject(
	value: JsonValue,
	prefix = '',
	result: FlatProperties = {}
): FlatProperties {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		result[prefix] = value;
		return result;
	}

	if (Array.isArray(value)) {
		value.forEach((entry, index) => flattenObject(entry, `${prefix}.${index}`, result));
		return result;
	}

	for (const [key, entry] of Object.entries(value)) {
		flattenObject(entry, prefix === '' ? key : `${prefix}.${key}`, result);
	}
	return result;
}

const TIME_PLACEHOLDER_PATTERN = /\{time(Start|End|Filter)\}/;

/**
 * Whether the configured url parameters carry at least one time placeholder.
 * A `timeSeries` layer without one would show a picker that silently does
 * nothing, so the layer warns about it at construction time.
 */
export function hasTimePlaceholder(urlParameters: SensorThingsUrlParameters): boolean {
	return (
		TIME_PLACEHOLDER_PATTERN.test(urlParameters?.filter ?? '') ||
		TIME_PLACEHOLDER_PATTERN.test(urlParameters?.expand ?? '')
	);
}

/**
 * Split an `$expand` on its top-level commas, ignoring those nested inside the
 * parenthesised options of a term.
 */
function splitExpandTerms(expand: string): string[] {
	const terms: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of expand) {
		if (char === '(') depth += 1;
		else if (char === ')') depth -= 1;
		if (char === ',' && depth === 0) {
			terms.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	terms.push(current);
	return terms.filter((term) => term.trim() !== '');
}

/**
 * Drop the terms that pull location geometry, keeping everything else a config
 * asked for - a refresh still needs `Observations`, and may need `Sensor` or
 * anything else feature info addresses.
 */
function stripLocationExpand(expand: string): string {
	return splitExpandTerms(expand)
		.filter((term) => !/^\s*Thing\/Locations\b/i.test(term))
		.join(',');
}

/**
 * The location to draw a datastream at.
 *
 * A Thing may carry several: the Herford gauges each have a Point *and* the
 * water course they measure, as a MultiLineString of up to 1.5 MB. Taking
 * `Locations[0]` blindly - as the AngularJS client does - draws whichever the
 * service happens to list first, so some gauges appear as points and others as
 * river lines. A point is what a sensor reading belongs to, so prefer one.
 */
function pickLocation(locations: { location?: unknown }[]): unknown {
	const geometries = locations.map((entry) => entry?.location).filter(Boolean);
	const point = geometries.find((geometry) => {
		const type = (geometry as { type?: string })?.type;
		return type === 'Point' || type === 'MultiPoint';
	});
	return point ?? geometries[0];
}

export class SensorThingsClient {
	private readonly url: string;
	private readonly urlParameters: SensorThingsUrlParameters;
	private readonly version = '1.1';

	/**
	 * Selected window, or `undefined` for "latest" - in which case the
	 * placeholders collapse to nothing and the query reverts to its untimed
	 * form. That is what lets startup use a single code path.
	 */
	private time: TimeWindow | undefined;

	constructor(url: string, urlParameters: SensorThingsUrlParameters = {}) {
		this.url = url;
		this.urlParameters = urlParameters;
	}

	setTime(time: TimeWindow | undefined): void {
		this.time = time;
	}

	/**
	 * Substitute the time placeholders. Runs before `searchParams.set()`, which
	 * takes care of the encoding.
	 */
	private resolvePlaceholders(value: string | undefined): string | undefined {
		if (!value) {
			return value;
		}
		const start = this.time ? toStaTimestamp(this.time.start) : '';
		const end = this.time ? toStaTimestamp(this.time.end) : '';
		const timeFilter = this.time
			? `$filter=phenomenonTime ge ${start} and phenomenonTime lt ${end};`
			: '';

		return value
			.replace(/\{timeStart\}/g, start)
			.replace(/\{timeEnd\}/g, end)
			.replace(/\{timeFilter\}/g, timeFilter);
	}

	/**
	 * Base url for one of the service's collections. The configured url is the
	 * bare endpoint; the collection path is appended here.
	 */
	private collectionUrl(root: string): { url: URL; isFullUrl: boolean } {
		const isFullUrl = /^https?:\/\//.test(this.url);
		const url = isFullUrl ? new URL(this.url) : new URL(this.url, window.location.origin);
		if (url.pathname.endsWith('/')) {
			url.pathname = url.pathname.slice(0, -1);
		}
		const suffix = `/v${this.version}/${root}`;
		if (!url.pathname.endsWith(suffix)) {
			url.pathname += suffix;
		}
		return { url, isFullUrl };
	}

	private finalize(url: URL, isFullUrl: boolean): string {
		return isFullUrl ? url.toString() : url.pathname + url.search;
	}

	/**
	 * The Datastreams query that produces the drawn features.
	 *
	 * @param withLocations pass `false` for a refresh. Sensor positions and the
	 *   water courses they sit on do not change, and the geometry dwarfs
	 *   everything else - for the Herford gauges it is 2.86 MB of a 2.93 MB
	 *   response - so a poll that only wants the newest readings leaves it out
	 *   and the layer merges the values into the features already drawn.
	 */
	createUrl(withLocations = true): string {
		const { url, isFullUrl } = this.collectionUrl('Datastreams');

		const filter = this.resolvePlaceholders(this.urlParameters.filter);
		if (filter) {
			url.searchParams.set('$filter', filter);
		}

		const configured = this.resolvePlaceholders(this.urlParameters.expand);
		let expand = configured;
		if (!expand) {
			// Ensuring we always get the location
			expand = `Thing/Locations, Observations(${this.resolvePlaceholders('{timeFilter}')}$orderby=phenomenonTime desc;$top=1)`;
		}
		if (!withLocations) {
			expand = stripLocationExpand(expand);
		}
		if (expand) {
			url.searchParams.set('$expand', expand);
		}

		return this.finalize(url, isFullUrl);
	}

	/** A query against the Observations collection. */
	createObservationsUrl(params: Record<string, string>): string {
		const { url, isFullUrl } = this.collectionUrl('Observations');
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return this.finalize(url, isFullUrl);
	}

	async get(withLocations = true, signal?: AbortSignal): Promise<SensorThingsResponse> {
		let data = await this.sendRequest(this.createUrl(withLocations), signal);
		if (data['@iot.nextLink']) {
			data = await this.resolveNextLink(data['@iot.nextLink'], data, signal);
		}
		return data;
	}

	private async sendRequest(url: string, signal?: AbortSignal): Promise<SensorThingsResponse> {
		const response = await fetch(url, { signal });
		if (!response.ok) {
			throw new Error(`Could not fetch SensorThings data. Status: ${response.status}`);
		}
		return response.json();
	}

	private async resolveNextLink(
		nextLink: string,
		data: SensorThingsResponse,
		signal?: AbortSignal
	): Promise<SensorThingsResponse> {
		const response = await this.sendRequest(nextLink, signal);
		const resolved: SensorThingsResponse = {
			...data,
			value: [...data.value, ...response.value]
		};
		if (response['@iot.nextLink']) {
			return this.resolveNextLink(response['@iot.nextLink'], resolved, signal);
		}
		return resolved;
	}

	/**
	 * One feature per datastream, positioned at its Thing's first location.
	 *
	 * A Thing may carry several locations of mixed geometry types; like the
	 * AngularJS client this uses the first one only.
	 */
	datastreamToGeoJSON(data: SensorThingsResponse): GeoJSONFeatureCollection {
		const features = data.value
			.map((datastream) => {
				const thing = datastream.Thing as { Locations?: { location?: unknown }[] } | undefined;
				const location = pickLocation(thing?.Locations ?? []);
				if (!location) {
					return null;
				}
				return {
					type: 'Feature' as const,
					properties: flattenObject(datastream),
					geometry: location as GeoJSONGeometry
				};
			})
			.filter((feature): feature is GeoJSONFeature => feature !== null);

		return { type: 'FeatureCollection', features };
	}

	/**
	 * The datastreams' properties keyed by `@iot.id`, for merging a refresh into
	 * the features already on the map without touching their geometry.
	 */
	datastreamProperties(data: SensorThingsResponse): Map<string, FlatProperties> {
		const byId = new Map<string, FlatProperties>();
		for (const datastream of data.value) {
			const id = datastream['@iot.id'];
			if (id === undefined || id === null) continue;
			byId.set(String(id), flattenObject(datastream));
		}
		return byId;
	}
}
