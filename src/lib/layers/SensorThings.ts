import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { all as allStrategy } from 'ol/loadingstrategy';
import { isEmpty } from 'ol/extent';
import type { Extent } from 'ol/extent';
import type Feature from 'ol/Feature';
import type { FlatStyleLike } from 'ol/style/flat';
import type { Projection } from 'ol/proj';
import { intersects as extentsIntersect } from 'ol/extent';
import type { LayerConfig, SensorThingsSourceConfig } from './types';
import { Layer } from './Layer';
import {
	SensorThingsClient,
	hasTimePlaceholder,
	type FlatProperties
} from './sensorThingsClient';
import {
	parseDuration,
	dividesEvenly,
	parseInterval,
	resolveConfiguredTime,
	timeWindow,
	type Duration,
	type TimeWindow
} from '$lib/utils/time';

/** Where a drawn datastream is and how far its data reaches. */
interface DatastreamInfo {
	id: number | string;
	extent: Extent | undefined;
	coverage: TimeWindow | undefined;
}

const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;

/**
 * The newest observation `phenomenonTime` across the drawn features, which is
 * what the map is actually showing.
 *
 * The datastream itself also carries a bare `phenomenonTime` - its whole
 * temporal extent, which reaches to the present no matter which window was
 * requested - so only keys below `Observations` may be considered.
 */
function newestObservationTime(features: Feature[]): Date | undefined {
	let newest: Date | undefined;
	for (const feature of features) {
		const properties = feature.getProperties();
		for (const key of Object.keys(properties)) {
			if (!key.includes('Observations') || !key.endsWith('phenomenonTime')) {
				continue;
			}
			const value = properties[key];
			if (typeof value !== 'string') {
				continue;
			}
			// phenomenonTime may be an interval "start/end"; the end is newer
			const parsed = new Date(value.split('/').pop() as string);
			if (isNaN(parsed.getTime())) {
				continue;
			}
			if (newest === undefined || parsed > newest) {
				newest = parsed;
			}
		}
	}
	return newest;
}

/**
 * Where each drawn datastream is and how far its data reaches, for the
 * availability lookups. Here the bare `phenomenonTime` is exactly what is
 * wanted - it is the datastream's own temporal extent.
 */
function readDatastreams(features: Feature[]): DatastreamInfo[] {
	return features
		.map((feature) => {
			const geometry = feature.getGeometry();
			return {
				id: feature.get('@iot.id') as number | string,
				extent: geometry ? geometry.getExtent() : undefined,
				coverage: parseInterval(feature.get('phenomenonTime'))
			};
		})
		.filter((entry) => entry.id !== undefined);
}

/**
 * SensorThings API (FROST) layer.
 *
 * Ported from `anol/src/anol/layer/sensorthings.js`. One feature per
 * datastream, refreshed on a timer while the layer is visible.
 */
export class SensorThings extends Layer {
	private readonly sourceConfig: SensorThingsSourceConfig;
	private readonly client: SensorThingsClient;
	private readonly refreshIntervalMs: number;
	private readonly style?: FlatStyleLike;

	private source: VectorSource | null = null;
	private mapProjection: Projection | string | undefined;
	private refreshTimer: ReturnType<typeof setTimeout> | undefined;
	/** Guards against a slow response overwriting a newer one. */
	private loadToken = 0;

	/** Selected window, `undefined` for "latest". */
	private time: TimeWindow | undefined;
	private viewportFilterActive = false;
	/** Newest observation phenomenonTime among the drawn features. */
	private displayedTime: Date | undefined;
	private datastreams: DatastreamInfo[] = [];
	readonly granularity: Duration | undefined;

	/**
	 * Called after every load, including the initial one and each poll - which
	 * the picker never triggers, so without this the drawn time would only
	 * reach the UI once the user touched something. Set by timeSeriesStore.
	 */
	_onDataChange?: () => void;

	constructor(config: LayerConfig) {
		super(config);
		this.sourceConfig = (config.olLayer?.source as SensorThingsSourceConfig) ?? {};
		this.client = new SensorThingsClient(
			this.sourceConfig.url ?? '',
			this.sourceConfig.urlParameters ?? {}
		);
		this.refreshIntervalMs =
			(this.sourceConfig.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS) * 1000;
		this.style = resolveStyle(config);

		if (this.timeSeries) {
			try {
				this.granularity = parseDuration(this.timeSeries.granularity);
				if (!dividesEvenly(this.granularity)) {
					console.warn(
						`Layer "${this.name}": granularity "${this.timeSeries.granularity}" does not ` +
							'divide its parent unit evenly, so the last bucket of each parent is shorter.'
					);
				}
			} catch (error) {
				console.error(`Layer "${this.name}":`, error);
			}

			if (!hasTimePlaceholder(this.sourceConfig.urlParameters ?? {})) {
				console.warn(
					`Layer "${this.name}" declares timeSeries but neither its source filter nor its ` +
						'expand contains a {timeFilter}, {timeStart} or {timeEnd} placeholder, so the ' +
						'time picker will have no effect.'
				);
			}

			if (this.granularity) {
				try {
					const instant = resolveConfiguredTime(this.timeSeries.default);
					if (instant !== undefined) {
						this.time = timeWindow(instant, this.granularity);
					}
				} catch (error) {
					console.error(`Layer "${this.name}":`, error);
				}
			}
		}

		this.viewportFilterActive =
			this.viewportFilter?.enabled === true && this.viewportFilter.default === 'viewport';
	}

	protected createOlLayer(): VectorLayer<VectorSource> {
		this.source = new VectorSource({
			format: new GeoJSON(),
			strategy: allStrategy,
			loader: (_extent, _resolution, projection, success) => {
				this.mapProjection = projection;
				this.loadData().then((features) => success?.(features ?? []));
			}
		});

		const layer = new VectorLayer({
			source: this.source,
			visible: this._visible,
			opacity: this._opacity
		});

		if (this.style) {
			layer.setStyle(this.style);
		}

		return layer;
	}

	/**
	 * Fetch and draw. Old features are cleared only once the new ones have
	 * arrived, which keeps the refresh from flickering.
	 */
	private async loadData(refresh = false): Promise<Feature[] | undefined> {
		if (!this.source) return undefined;

		// Geometry is only worth fetching when there is nothing drawn yet: the
		// sensors do not move, and it is the bulk of the response.
		const withLocations = !refresh || this.source.getFeatures().length === 0;

		this.loadToken += 1;
		const token = this.loadToken;

		let features: Feature[] | undefined;
		try {
			this.client.setTime(this.time);
			const data = await this.client.get(withLocations);
			if (token !== this.loadToken) {
				// a newer request started while this one was in flight
				return undefined;
			}

			if (withLocations) {
				const collection = this.client.datastreamToGeoJSON(data);
				features = this.source.getFormat()?.readFeatures(collection, {
					featureProjection: this.mapProjection
				}) as Feature[];
				this.source.clear(true);
				this.source.addFeatures(features);
			} else {
				features = this.mergeProperties(this.client.datastreamProperties(data));
			}

			this.displayedTime = newestObservationTime(features);
			this.datastreams = readDatastreams(features);
		} catch (error) {
			console.error(`Could not load SensorThings layer "${this.name}":`, error);
		} finally {
			if (token === this.loadToken) {
				this._onDataChange?.();
				this.scheduleRefresh();
			}
		}
		return features;
	}

	/**
	 * Update the drawn features in place from a refresh that carried no
	 * geometry. A datastream that has since disappeared leaves its feature
	 * alone rather than removing it - the next full load settles that.
	 */
	private mergeProperties(byId: Map<string, FlatProperties>): Feature[] {
		const features = this.source?.getFeatures() ?? [];
		for (const feature of features) {
			const properties = byId.get(String(feature.get('@iot.id')));
			if (properties) {
				// merges over the existing keys; the geometry is held separately
				// and is not among them
				feature.setProperties(properties);
			}
		}
		// styles read observation values, so the layer has to redraw
		this.source?.changed();
		return features;
	}

	/**
	 * Poll only while visible and only while showing the latest data: an
	 * invisible layer has nothing to refresh, and a fixed window in the past
	 * has nothing left to change.
	 */
	private scheduleRefresh(): void {
		this.stopRefresh();
		if (!this._visible || this.refreshIntervalMs <= 0 || this.time !== undefined) {
			return;
		}
		this.refreshTimer = setTimeout(() => this.loadData(true), this.refreshIntervalMs);
	}

	private stopRefresh(): void {
		if (this.refreshTimer !== undefined) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = undefined;
		}
	}

	protected override onVisibilityChange(visible: boolean): void {
		if (visible) {
			this.scheduleRefresh();
		} else {
			this.stopRefresh();
		}
	}

	/** Selected window, or `undefined` while showing the latest data. */
	getTime(): TimeWindow | undefined {
		return this.time;
	}

	/**
	 * @returns a promise resolving once the new data is drawn, so callers can
	 * read getDisplayedTime()
	 */
	setTime(time: TimeWindow | undefined): Promise<unknown> {
		this.time = time;
		this.stopRefresh();
		return this.loadData();
	}

	/**
	 * Timestamp of the newest data actually drawn, as opposed to the window
	 * that was requested. In the "latest" state there is no window, so this is
	 * the only way to tell what the map is showing.
	 */
	getDisplayedTime(): Date | undefined {
		return this.displayedTime;
	}

	getViewportFilter(): boolean {
		return this.viewportFilterActive;
	}

	/**
	 * The viewport filter narrows which times the picker offers, not which
	 * features are drawn, so flipping it triggers no reload.
	 */
	setViewportFilter(active: boolean): void {
		this.viewportFilterActive = active;
	}

	/**
	 * Ids of the datastreams to consider when asking what data exists.
	 *
	 * With the viewport filter on, only those intersecting `viewExtent` count -
	 * which is the point of it: a time that carries data somewhere else
	 * entirely should not be offered here. Datastreams that never reported are
	 * dropped either way; they would only ever answer "no data".
	 */
	getDatastreamIds(viewExtent?: Extent): (number | string)[] {
		return this.datastreams
			.filter((entry) => {
				if (entry.coverage === undefined) return false;
				if (viewExtent === undefined) return true;
				return entry.extent !== undefined && extentsIntersect(entry.extent, viewExtent);
			})
			.map((entry) => entry.id);
	}

	/** Union of the temporal extents the datastreams report. */
	getCoverage(viewExtent?: Extent): TimeWindow | undefined {
		let start: Date | undefined;
		let end: Date | undefined;
		for (const entry of this.datastreams) {
			if (entry.coverage === undefined) continue;
			if (
				viewExtent !== undefined &&
				(entry.extent === undefined || !extentsIntersect(entry.extent, viewExtent))
			) {
				continue;
			}
			if (start === undefined || entry.coverage.start < start) start = entry.coverage.start;
			if (end === undefined || entry.coverage.end > end) end = entry.coverage.end;
		}
		return start === undefined || end === undefined ? undefined : { start, end };
	}

	/** A query against the service's Observations collection. */
	observationsUrl(params: Record<string, string>): string {
		return this.client.createObservationsUrl(params);
	}

	getSource(): VectorSource | null {
		return this.source;
	}

	getFeatures(): Feature[] {
		return this.source?.getFeatures() ?? [];
	}

	/** Force an immediate reload, bypassing the timer. */
	refresh(): void {
		this.loadData();
	}

	override get supportsZoomToExtent(): boolean {
		return true;
	}

	override getExtent(): Extent | null {
		const extent = this.source?.getExtent();
		if (!extent || isEmpty(extent)) return null;
		return extent;
	}

	override dispose(): void {
		this.stopRefresh();
		super.dispose();
	}
}

/**
 * SensorThings layers are styled with OpenLayers flat styles, which the backend
 * passes through unchanged. `externalGraphicPrefix` is prepended to every
 * `icon-src`, so configs can name icons relative to a shared directory.
 */
function resolveStyle(config: LayerConfig): FlatStyleLike | undefined {
	const style = config.style as FlatStyleLike | undefined;
	if (!style) {
		return undefined;
	}
	const prefix = config.externalGraphicPrefix;
	if (!prefix) {
		return style;
	}

	const withPrefix = (flat: Record<string, unknown>) => {
		if (typeof flat['icon-src'] === 'string') {
			return { ...flat, 'icon-src': prefix + flat['icon-src'] };
		}
		return flat;
	};

	if (Array.isArray(style)) {
		return style.map((entry) => {
			const rule = entry as Record<string, unknown>;
			// a rule wraps its declarations in `style`; a bare flat style does not
			if (rule.style && typeof rule.style === 'object') {
				return { ...rule, style: withPrefix(rule.style as Record<string, unknown>) };
			}
			return withPrefix(rule);
		}) as FlatStyleLike;
	}

	return withPrefix(style as Record<string, unknown>) as FlatStyleLike;
}
