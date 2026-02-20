import { layerStore } from '$lib/stores/layerStore';

/**
 * Parse a layer entry from URL (format: "layerName" or "layerName:opacity")
 */
function parseLayerEntry(entry: string): { name: string; opacity: number } {
	const parts = entry.split(':');
	const name = parts[0];
	const opacity = parts.length > 1 ? parseInt(parts[1], 10) : 100;
	return { name, opacity: isNaN(opacity) ? 100 : opacity };
}

/**
 * Apply layer state from URL parameters to the layer store.
 * Must be called after layerStore.initialize() and before components render.
 * Returns the parsed map parameter (zoom/center) for later use by UrlSync.
 */
export function applyUrlLayerState(): { zoom: number; x: number; y: number } | null {
	const url = new URL(window.location.href);
	const mapParam = url.searchParams.get('map');
	const layersParam = url.searchParams.get('layers');
	const groupsParam = url.searchParams.get('groups');

	// Parse map parameter for return (will be applied by UrlSync when map exists)
	let mapState: { zoom: number; x: number; y: number } | null = null;
	if (mapParam) {
		const parts = mapParam.split(',');
		if (parts.length >= 3) {
			const zoom = parseFloat(parts[0]);
			const x = parseFloat(parts[1]);
			const y = parseFloat(parts[2]);
			if (!isNaN(zoom) && !isNaN(x) && !isNaN(y)) {
				mapState = { zoom, x, y };
			}
		}
	}

	// Parse groups parameter (for 'full' mode): group1,group2,...
	if (groupsParam) {
		const groupNames = groupsParam.split(',').filter((n) => n.trim());
		if (groupNames.length > 0) {
			layerStore.reorderGroups(groupNames);
		}
	}

	// Parse layers parameter: layer1,layer2:opacity,...
	if (layersParam) {
		const layerEntries = layersParam.split(',').filter((n) => n.trim());

		if (layerEntries.length > 0) {
			// Parse all layer entries
			const parsedLayers = layerEntries.map(parseLayerEntry);

			// First layer could be a background layer
			const firstParsed = parsedLayers[0];
			const firstLayer = layerStore.getLayerByName(firstParsed.name);
			if (firstLayer?.isBackground) {
				layerStore.setActiveBackgroundByName(firstParsed.name);
			}

			// Hide all overlays first
			const allLayers = layerStore.getAllLayers();
			allLayers.forEach((layer) => {
				if (!layer.isBackground) {
					layerStore.setLayerVisibility(layer.name, false);
				}
			});

			// Track group order based on first occurrence (only if no groups param)
			const groupOrder: string[] = [];
			const seenGroups = new Set<string>();

			// Show specified layers with their opacities
			parsedLayers.forEach(({ name, opacity }) => {
				const layer = layerStore.getLayerByName(name);
				if (layer && !layer.isBackground) {
					layerStore.setLayerVisibility(name, true);
					layerStore.setLayerOpacity(name, opacity / 100);

					// Track group order (only if no groups param provided)
					if (!groupsParam) {
						const group = layerStore.getGroupByLayerName(name);
						if (group && !seenGroups.has(group.name)) {
							seenGroups.add(group.name);
							groupOrder.push(group.name);
						}
					}
				}
			});

			// Reorder groups based on URL layer order (only if no groups param)
			if (!groupsParam && groupOrder.length > 0) {
				layerStore.reorderGroups(groupOrder);
			}
		}
	}

	return mapState;
}
