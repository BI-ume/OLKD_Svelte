import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { get as getProjection } from 'ol/proj';
import type { LayerConfig, GeoJSONSourceConfig } from './types';
import { Layer } from './Layer';

/**
 * Static GeoJSON layer implementation.
 * Loads GeoJSON data from a URL once.
 */
export class StaticGeoJSON extends Layer {
	private sourceConfig: GeoJSONSourceConfig;

	constructor(config: LayerConfig) {
		super(config);
		this.sourceConfig = (config.olLayer?.source as GeoJSONSourceConfig) ?? {};
	}

	protected createOlLayer(): VectorLayer<VectorSource> {
		const dataProjection = this.sourceConfig.dataProjection ?? 'EPSG:4326';
		const featureProjection = 'EPSG:25832'; // Target projection

		const source = new VectorSource({
			url: this.sourceConfig.url,
			format: new GeoJSON({
				dataProjection: getProjection(dataProjection) ?? undefined,
				featureProjection: getProjection(featureProjection) ?? undefined
			})
		});

		return new VectorLayer({
			source,
			visible: this._visible,
			opacity: this._opacity
		});
	}

	/**
	 * Get the vector source
	 */
	getSource(): VectorSource | null {
		if (this._olLayer) {
			return (this._olLayer as VectorLayer<VectorSource>).getSource();
		}
		return null;
	}

	/**
	 * Get all features from the layer
	 */
	getFeatures() {
		const source = this.getSource();
		return source?.getFeatures() ?? [];
	}

	/**
	 * Refresh the source (reload data)
	 */
	refresh(): void {
		const source = this.getSource();
		if (source) {
			source.refresh();
		}
	}
}
