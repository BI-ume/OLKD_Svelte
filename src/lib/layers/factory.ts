import type { LayerConfig, GroupConfig, LayersDef } from './types';
import { Layer } from './Layer';
import { Group } from './Group';
import { TiledWMS } from './TiledWMS';
import { SingleTileWMS } from './SingleTileWMS';
import { WMTS } from './WMTS';
import { StaticGeoJSON } from './StaticGeoJSON';

/**
 * Create a Layer instance from configuration
 */
export function createLayer(config: LayerConfig): Layer | null {
	try {
		switch (config.type) {
			case 'tiledwms':
				return new TiledWMS(config);

			case 'wms':
				return new SingleTileWMS(config);

			case 'wmts':
				return new WMTS(config);

			case 'static_geojson':
				return new StaticGeoJSON(config);

			case 'dynamic_geojson':
				// For now, treat dynamic_geojson like static (will be enhanced later)
				return new StaticGeoJSON(config);

			case 'postgis':
				// PostGIS layers use dynamic_geojson under the hood
				return new StaticGeoJSON(config);

			case 'digitize':
				// Digitize layers are vector layers (will be enhanced later)
				return new StaticGeoJSON(config);

			case 'sensorthings':
				// SensorThings API - not implemented yet
				console.warn(`SensorThings layer type not yet implemented: ${config.name}`);
				return null;

			default:
				console.warn(`Unknown layer type: ${config.type} for layer ${config.name}`);
				return null;
		}
	} catch (error) {
		console.error(`Error creating layer ${config.name}:`, error);
		return null;
	}
}

/**
 * Create a Group instance from configuration
 */
export function createGroup(config: GroupConfig): Group {
	const layers = config.layers
		.map((layerConfig) => createLayer(layerConfig))
		.filter((layer): layer is Layer => layer !== null);

	return new Group(config, layers);
}

/**
 * Initialize all layers from the LayersDef structure
 */
export function initializeLayers(layersDef: LayersDef): {
	backgrounds: Layer[];
	overlays: Group[];
} {
	// Create background layers
	const backgrounds = layersDef.backgroundLayer
		.map((config) => {
			// Ensure isBackground is set
			const bgConfig = { ...config, isBackground: true };
			return createLayer(bgConfig);
		})
		.filter((layer): layer is Layer => layer !== null);

	// Create overlay groups
	const overlays = layersDef.overlays.map((groupConfig) => createGroup(groupConfig));

	return { backgrounds, overlays };
}

/**
 * Re-export layer classes for direct use if needed
 */
export { Layer } from './Layer';
export { Group } from './Group';
export { TiledWMS } from './TiledWMS';
export { SingleTileWMS } from './SingleTileWMS';
export { WMTS } from './WMTS';
export { StaticGeoJSON } from './StaticGeoJSON';
