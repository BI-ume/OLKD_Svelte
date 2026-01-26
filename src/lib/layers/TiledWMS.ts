import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import type { LayerConfig, WMSSourceConfig } from './types';
import { Layer } from './Layer';

/**
 * Tiled WMS layer implementation.
 */
export class TiledWMS extends Layer {
	private sourceConfig: WMSSourceConfig;
	private wmsLayers: string;

	constructor(config: LayerConfig) {
		super(config);
		this.sourceConfig = (config.olLayer?.source as WMSSourceConfig) ?? {};
		this.wmsLayers = this.sourceConfig.params?.LAYERS ?? '';
	}

	protected createOlLayer(): TileLayer<TileWMS> {
		const source = new TileWMS({
			url: this.sourceConfig.url,
			params: {
				LAYERS: this._visible ? this.wmsLayers : '',
				SRS: this.sourceConfig.params?.SRS,
				FORMAT: this.sourceConfig.format ?? 'image/png',
				TRANSPARENT: 'TRUE',
				...(this.sourceConfig.params?.STYLES && { STYLES: this.sourceConfig.params.STYLES })
			},
			transition: 0
		});

		return new TileLayer({
			source,
			visible: this._visible,
			opacity: this._opacity
		});
	}

	/**
	 * Override visibility change to update WMS LAYERS parameter.
	 * This is the AnOl pattern - toggle LAYERS param instead of layer visibility.
	 */
	protected onVisibilityChange(visible: boolean): void {
		if (this._olLayer) {
			const source = (this._olLayer as TileLayer<TileWMS>).getSource();
			if (source) {
				const params = source.getParams();
				params.LAYERS = visible ? this.wmsLayers : '';
				source.updateParams(params);
			}
		}
	}

	/**
	 * Get the WMS source
	 */
	getSource(): TileWMS | null {
		if (this._olLayer) {
			return (this._olLayer as TileLayer<TileWMS>).getSource();
		}
		return null;
	}

	/**
	 * Update WMS parameters
	 */
	updateParams(params: Record<string, unknown>): void {
		const source = this.getSource();
		if (source) {
			source.updateParams(params);
		}
	}
}
