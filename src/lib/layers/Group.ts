import type { Layer } from './Layer';
import type { GroupConfig, LegendConfig } from './types';

/**
 * Represents a group of layers in the layerswitcher.
 */
export class Group {
	readonly name: string;
	readonly title: string;
	readonly layers: Layer[];
	readonly metadataUrl?: string;
	readonly abstract?: string;
	readonly showGroup: boolean;
	readonly singleSelect: boolean;
	readonly singleSelectGroup: boolean;
	readonly legend?: boolean | LegendConfig;
	readonly defaultVisibleLayers: string[];

	private _collapsed: boolean;
	private _visible: boolean;

	constructor(config: GroupConfig, layers: Layer[]) {
		this.name = config.name;
		this.title = config.title;
		this.layers = layers;
		this.metadataUrl = config.metadataUrl;
		this.abstract = config.abstract;
		this.showGroup = config.showGroup ?? true;
		this.singleSelect = config.singleSelect ?? false;
		this.singleSelectGroup = config.singleSelectGroup ?? false;
		this.legend = config.legend;
		this.defaultVisibleLayers = config.defaultVisibleLayers ?? [];

		this._collapsed = config.collapsed ?? true;

		// Group is visible if any layer is visible
		this._visible = this.layers.some((layer) => layer.visible);
	}

	/**
	 * Get collapsed state
	 */
	get collapsed(): boolean {
		return this._collapsed;
	}

	/**
	 * Set collapsed state
	 */
	set collapsed(value: boolean) {
		this._collapsed = value;
	}

	/**
	 * Get visibility state (true if any layer is visible)
	 */
	get visible(): boolean {
		return this._visible;
	}

	/**
	 * Set visibility for all layers in the group
	 */
	setVisible(visible: boolean): void {
		this._visible = visible;

		if (visible) {
			// When showing group, apply default visible layers or show all
			if (this.defaultVisibleLayers.length > 0) {
				this.layers.forEach((layer) => {
					layer.setVisible(this.defaultVisibleLayers.includes(layer.name));
				});
			} else if (this.singleSelect) {
				// Single select: only show first layer
				this.layers.forEach((layer, index) => {
					layer.setVisible(index === 0);
				});
			} else {
				// Show all layers
				this.layers.forEach((layer) => layer.setVisible(true));
			}
		} else {
			// Hide all layers
			this.layers.forEach((layer) => layer.setVisible(false));
		}
	}

	/**
	 * Toggle a specific layer's visibility within the group.
	 * Respects singleSelect mode.
	 */
	toggleLayer(layerName: string): void {
		const targetLayer = this.layers.find((l) => l.name === layerName);
		if (!targetLayer) return;

		if (this.singleSelect) {
			// In single select mode, show only the clicked layer
			const isCurrentlyVisible = targetLayer.visible;
			this.layers.forEach((layer) => {
				layer.setVisible(layer.name === layerName && !isCurrentlyVisible);
			});
		} else {
			// Normal toggle
			targetLayer.setVisible(!targetLayer.visible);
		}

		// Update group visibility state
		this._visible = this.layers.some((layer) => layer.visible);
	}

	/**
	 * Get visible layers in this group
	 */
	getVisibleLayers(): Layer[] {
		return this.layers.filter((layer) => layer.visible);
	}

	/**
	 * Check if a specific layer is visible
	 */
	isLayerVisible(layerName: string): boolean {
		const layer = this.layers.find((l) => l.name === layerName);
		return layer?.visible ?? false;
	}

	/**
	 * Dispose all layers in the group
	 */
	dispose(): void {
		this.layers.forEach((layer) => layer.dispose());
	}
}
