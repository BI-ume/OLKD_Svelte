import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import type { LayerConfig, WMSSourceConfig } from './types';
import { Layer } from './Layer';

/**
 * Single tile WMS layer implementation (untiled).
 */
export class SingleTileWMS extends Layer {
	private sourceConfig: WMSSourceConfig;
	private wmsLayers: string;

	constructor(config: LayerConfig) {
		super(config);
		this.sourceConfig = (config.olLayer?.source as WMSSourceConfig) ?? {};
		this.wmsLayers = this.sourceConfig.params?.LAYERS ?? '';
	}

	protected createOlLayer(): ImageLayer<ImageWMS> {
		const source = new ImageWMS({
			url: this.sourceConfig.url,
			params: {
				LAYERS: this._visible ? this.wmsLayers : '',
				SRS: this.sourceConfig.params?.SRS,
				FORMAT: this.sourceConfig.format ?? 'image/png',
				TRANSPARENT: 'TRUE',
				...(this.sourceConfig.params?.STYLES && { STYLES: this.sourceConfig.params.STYLES })
			},
			projection: this.sourceConfig.projection
		});

		return new ImageLayer({
			source,
			visible: this._visible,
			opacity: this._opacity
		});
	}

	/**
	 * Override visibility change to update WMS LAYERS parameter.
	 */
	protected onVisibilityChange(visible: boolean): void {
		if (this._olLayer) {
			const source = (this._olLayer as ImageLayer<ImageWMS>).getSource();
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
	getSource(): ImageWMS | null {
		if (this._olLayer) {
			return (this._olLayer as ImageLayer<ImageWMS>).getSource();
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
