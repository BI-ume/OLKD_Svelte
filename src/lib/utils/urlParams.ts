import { layerStore } from '$lib/stores/layerStore';

/** Internal: token from the compact layers param */
interface LayerToken {
	name: string;
	content?: string; // present for group entries: groupName(content)
}

/**
 * Tokenize the compact layers param.
 *
 * Input:  "bg,groupA(1:80,0:50,1),groupB(0,1:55)"
 * Output: [{name:'bg'}, {name:'groupA', content:'1:80,0:50,1'}, {name:'groupB', content:'0,1:55'}]
 *
 * Commas inside parentheses are part of the content and are not treated as separators.
 */
function tokenizeLayersParam(raw: string): LayerToken[] {
	const tokens: LayerToken[] = [];
	let i = 0;

	while (i < raw.length) {
		if (raw[i] === ',') {
			i++;
			continue;
		}

		// Read name up to ',' or '('
		let name = '';
		while (i < raw.length && raw[i] !== ',' && raw[i] !== '(') {
			name += raw[i++];
		}
		name = name.trim();
		if (!name) continue;

		if (i < raw.length && raw[i] === '(') {
			i++; // skip '('
			let content = '';
			let depth = 1;
			while (i < raw.length && depth > 0) {
				if (raw[i] === '(') depth++;
				else if (raw[i] === ')') {
					depth--;
					if (depth === 0) {
						i++;
						break;
					}
				}
				if (depth > 0) content += raw[i];
				i++;
			}
			tokens.push({ name, content });
		} else {
			tokens.push({ name });
		}
	}

	return tokens;
}

/**
 * Parse a compact layer-state entry.
 *
 * "1"    → visible, 100% opacity
 * "0"    → hidden,  100% opacity
 * "1:80" → visible, 80% opacity
 * "0:50" → hidden,  50% opacity
 */
function parseLayerState(state: string): { visible: boolean; opacity: number } {
	const parts = state.split(':');
	const visible = parts[0] === '1';
	const opacityPct = parts.length > 1 ? parseInt(parts[1], 10) : 100;
	return { visible, opacity: isNaN(opacityPct) ? 1 : opacityPct / 100 };
}

/**
 * Extract the group names from a compact-format 'layers' URL param.
 * Returns null if the param is absent or not in compact format (no parentheses).
 *
 * Call this BEFORE layerStore.initialize() to pre-filter overlay groups so that
 * config groups absent from the URL are never registered.
 */
export function parseUrlGroups(): string[] | null {
	const url = new URL(window.location.href);
	const layersParam = url.searchParams.get('layers');
	if (!layersParam || !layersParam.includes('(')) return null;

	const tokens = tokenizeLayersParam(layersParam);
	const groupNames = tokens.filter((t) => t.content !== undefined).map((t) => t.name);
	return groupNames.length > 0 ? groupNames : null;
}

/**
 * Apply layer state from URL parameters to the layer store.
 * Must be called after layerStore.initialize() and before components render.
 * Returns the parsed map state (zoom/center) for later use by UrlSync.
 *
 * Supported URL formats for the 'layers' param:
 *   map mode:  layers=bg,layerA,layerB:80
 *   full mode: layers=bg,groupA(1:80,0:50,1),groupB(0,1:55)
 *              (detected by presence of parentheses)
 */
export function applyUrlLayerState(): { zoom: number; x: number; y: number } | null {
	const url = new URL(window.location.href);
	const mapParam = url.searchParams.get('map');
	const layersParam = url.searchParams.get('layers');

	// Parse map state (returned for deferred application once the OL map exists)
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

	if (!layersParam) return mapState;

	if (layersParam.includes('(')) {
		// ---------------------------------------------------------------
		// Full mode: compact format
		// layers=bg,groupA(1:80,0:50,1),groupB(0,1:55)
		// ---------------------------------------------------------------
		const tokens = tokenizeLayersParam(layersParam);

		// First plain token (no parens) is the background layer
		const bgToken = tokens.find((t) => t.content === undefined);
		if (bgToken) {
			layerStore.setActiveBackgroundByName(bgToken.name);
		}

		// Hide all overlay layers first
		layerStore.getAllLayers().forEach((layer) => {
			if (!layer.isBackground) layerStore.setLayerVisibility(layer.name, false);
		});

		const groupTokens = tokens.filter((t) => t.content !== undefined);

		// Apply each group's layer states by index
		groupTokens.forEach(({ name, content }) => {
			const group = layerStore.getGroupByName(name);
			if (!group) {
				console.warn(`[UrlSync] Group '${name}' from URL not found in config`);
				return;
			}
			content!.split(',').forEach((state, index) => {
				if (index >= group.layers.length) {
					console.warn(
						`[UrlSync] Layer index ${index} out of bounds for group '${name}' (has ${group.layers.length} layer(s))`
					);
					return;
				}
				const { visible, opacity } = parseLayerState(state.trim());
				layerStore.setLayerVisibility(group.layers[index].name, visible);
				layerStore.setLayerOpacity(group.layers[index].name, opacity);
			});
		});

		// Reorder groups to match the URL order
		const groupOrder = groupTokens.map((t) => t.name);
		if (groupOrder.length > 0) {
			layerStore.reorderGroups(groupOrder);
		}
	} else {
		// ---------------------------------------------------------------
		// Map mode: name-based format
		// layers=bg,layerA,layerB:80
		// ---------------------------------------------------------------
		const layerEntries = layersParam.split(',').filter((n) => n.trim());

		if (layerEntries.length > 0) {
			const parsedLayers = layerEntries.map((entry) => {
				const parts = entry.split(':');
				const name = parts[0];
				const opacity = parts.length > 1 ? parseInt(parts[1], 10) : 100;
				return { name, opacity: isNaN(opacity) ? 100 : opacity };
			});

			// First entry may be a background layer
			const firstLayer = layerStore.getLayerByName(parsedLayers[0].name);
			if (firstLayer?.isBackground) {
				layerStore.setActiveBackgroundByName(parsedLayers[0].name);
			}

			// Hide all overlays first
			layerStore.getAllLayers().forEach((layer) => {
				if (!layer.isBackground) layerStore.setLayerVisibility(layer.name, false);
			});

			// Track group order from layer order
			const groupOrder: string[] = [];
			const seenGroups = new Set<string>();

			parsedLayers.forEach(({ name, opacity }) => {
				const layer = layerStore.getLayerByName(name);
				if (!layer) {
					console.warn(`[UrlSync] Layer '${name}' from URL not found in config — skipping`);
					return;
				}
				if (!layer.isBackground) {
					layerStore.setLayerVisibility(name, true);
					layerStore.setLayerOpacity(name, opacity / 100);

					const group = layerStore.getGroupByLayerName(name);
					if (group && !seenGroups.has(group.name)) {
						seenGroups.add(group.name);
						groupOrder.push(group.name);
					}
				}
			});

			if (groupOrder.length > 0) {
				layerStore.reorderGroups(groupOrder);
			}
		}
	}

	return mapState;
}
