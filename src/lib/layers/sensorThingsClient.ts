import type {
	GeoJSONFeature,
	GeoJSONFeatureCollection,
	GeoJSONGeometry
} from 'ol/format/GeoJSON';

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

export class SensorThingsClient {
	private readonly url: string;
	private readonly urlParameters: SensorThingsUrlParameters;
	private readonly version = '1.1';

	constructor(url: string, urlParameters: SensorThingsUrlParameters = {}) {
		this.url = url;
		this.urlParameters = urlParameters;
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

	/** The Datastreams query that produces the drawn features. */
	createUrl(): string {
		const { url, isFullUrl } = this.collectionUrl('Datastreams');

		if (this.urlParameters.filter) {
			url.searchParams.set('$filter', this.urlParameters.filter);
		}
		if (this.urlParameters.expand) {
			// A custom expand has to include the location itself
			url.searchParams.set('$expand', this.urlParameters.expand);
		} else {
			url.searchParams.set(
				'$expand',
				'Thing/Locations, Observations($orderby=phenomenonTime desc;$top=1)'
			);
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

	async get(signal?: AbortSignal): Promise<SensorThingsResponse> {
		let data = await this.sendRequest(this.createUrl(), signal);
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
				const location = thing?.Locations?.[0]?.location;
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
}
