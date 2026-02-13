import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import type { Coordinate } from 'ol/coordinate';
import type { LayerConfig, WMSSourceConfig, LegendConfig } from './types';
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
	 * Get the WMS GetFeatureInfo URL for a coordinate
	 */
	getFeatureInfoUrl(coordinate: Coordinate, resolution: number, projection: string, params: Record<string, string>): string | undefined {
		return this.getSource()?.getFeatureInfoUrl(coordinate, resolution, projection, params);
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

	/**
	 * Get the WMS GetLegendGraphic URL for this layer.
	 * @returns URL string or null if legend is disabled
	 */
	override getLegendGraphicUrl(): string | null {
		// Check if legend is disabled
		if (this.legend === false) {
			return null;
		}

		// Check if legend type is GetLegendGraphic (or default)
		const legendConfig = typeof this.legend === 'object' ? this.legend as LegendConfig : null;
		if (legendConfig?.type === 'link' || legendConfig?.type === 'text') {
			return null;
		}

		// Get base URL from source
		let url = this.sourceConfig.url;
		if (!url) {
			return null;
		}

		// Build query parameters
		const params = new URLSearchParams({
			SERVICE: 'WMS',
			VERSION: legendConfig?.version ?? '1.3.0',
			SLD_VERSION: legendConfig?.sldVersion ?? '1.1.0',
			REQUEST: 'GetLegendGraphic',
			FORMAT: legendConfig?.format ?? 'image/png',
			LAYER: this.wmsLayers
		});

		// Append parameters to URL
		if (url.indexOf('?') === -1) {
			url += '?';
		} else if (!url.endsWith('&') && !url.endsWith('?')) {
			url += '&';
		}

		return url + params.toString();
	}
}
