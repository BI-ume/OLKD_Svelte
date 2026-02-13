import type BaseLayer from 'ol/layer/Base';
import type { LayerConfig, OlLayerConfig, LegendConfig, FeatureInfoConfig } from './types';

/**
 * Base class for all layer types.
 * Wraps OpenLayers layer creation and provides a consistent interface.
 */
export abstract class Layer {
	readonly name: string;
	readonly title: string;
	readonly type: string;
	readonly isBackground: boolean;
	readonly metadataUrl?: string;
	readonly legend?: boolean | LegendConfig;
	readonly attribution?: string;
	readonly abstract?: string;
	readonly previewImage?: string;
	readonly featureinfo?: FeatureInfoConfig;

	protected _visible: boolean;
	protected _opacity: number;
	protected _olLayer: BaseLayer | null = null;
	protected olLayerOptions: OlLayerConfig;

	constructor(config: LayerConfig) {
		this.name = config.name;
		this.title = config.title;
		this.type = config.type;
		this.isBackground = config.isBackground ?? false;
		this.metadataUrl = config.metadataUrl;
		this.legend = config.legend;
		this.attribution = config.attribution;
		this.abstract = config.abstract;
		this.previewImage = config.previewImage;
		this.featureinfo = config.featureinfo;

		this._visible = config.visible ?? config.olLayer?.visible ?? false;
		this._opacity = config.opacity ?? config.olLayer?.opacity ?? 1;
		this.olLayerOptions = config.olLayer ?? {};
	}

	/**
	 * Create the OpenLayers layer instance.
	 * Must be implemented by subclasses.
	 */
	protected abstract createOlLayer(): BaseLayer;

	/**
	 * Get the OpenLayers layer instance, creating it if necessary.
	 */
	get olLayer(): BaseLayer {
		if (!this._olLayer) {
			this._olLayer = this.createOlLayer();
			this._olLayer.setVisible(this._visible);
			this._olLayer.setOpacity(this._opacity);
		}
		return this._olLayer;
	}

	/**
	 * Get current visibility state
	 */
	get visible(): boolean {
		return this._visible;
	}

	/**
	 * Get current opacity
	 */
	get opacity(): number {
		return this._opacity;
	}

	/**
	 * Set layer visibility
	 */
	setVisible(visible: boolean): void {
		this._visible = visible;
		if (this._olLayer) {
			this._olLayer.setVisible(visible);
		}
		this.onVisibilityChange(visible);
	}

	/**
	 * Set layer opacity
	 */
	setOpacity(opacity: number): void {
		this._opacity = Math.max(0, Math.min(1, opacity));
		if (this._olLayer) {
			this._olLayer.setOpacity(this._opacity);
		}
	}

	/**
	 * Hook for subclasses to respond to visibility changes.
	 * Override in subclasses if needed.
	 */
	protected onVisibilityChange(_visible: boolean): void {
		// Default: no-op
	}

	/**
	 * Dispose of the layer and clean up resources.
	 */
	dispose(): void {
		if (this._olLayer) {
			this._olLayer.dispose();
			this._olLayer = null;
		}
	}

	/**
	 * Get the legend graphic URL for this layer.
	 * Override in subclasses that support WMS GetLegendGraphic.
	 * @returns URL string or null if not supported
	 */
	getLegendGraphicUrl(): string | null {
		return null;
	}
}
