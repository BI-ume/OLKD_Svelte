import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { all as allStrategy } from 'ol/loadingstrategy';
import { isEmpty } from 'ol/extent';
import type { Extent } from 'ol/extent';
import type Feature from 'ol/Feature';
import type { FlatStyleLike } from 'ol/style/flat';
import type { Projection } from 'ol/proj';
import type { LayerConfig, SensorThingsSourceConfig } from './types';
import { Layer } from './Layer';
import { SensorThingsClient } from './sensorThingsClient';

const DEFAULT_REFRESH_INTERVAL_SECONDS = 5;

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
	private async loadData(): Promise<Feature[] | undefined> {
		if (!this.source) return undefined;

		this.loadToken += 1;
		const token = this.loadToken;

		let features: Feature[] | undefined;
		try {
			const data = await this.client.get();
			if (token !== this.loadToken) {
				// a newer request started while this one was in flight
				return undefined;
			}
			const collection = this.client.datastreamToGeoJSON(data);
			features = this.source.getFormat()?.readFeatures(collection, {
				featureProjection: this.mapProjection
			}) as Feature[];
			this.source.clear(true);
			this.source.addFeatures(features);
		} catch (error) {
			console.error(`Could not load SensorThings layer "${this.name}":`, error);
		} finally {
			if (token === this.loadToken) {
				this.scheduleRefresh();
			}
		}
		return features;
	}

	/** Poll only while visible; an invisible layer has nothing to refresh. */
	private scheduleRefresh(): void {
		this.stopRefresh();
		if (!this._visible || this.refreshIntervalMs <= 0) {
			return;
		}
		this.refreshTimer = setTimeout(() => this.loadData(), this.refreshIntervalMs);
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
