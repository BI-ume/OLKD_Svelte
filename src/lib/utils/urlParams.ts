import { layerStore } from '$lib/stores/layerStore';
import { applyTimeSeriesState, type MapState } from '$lib/mapState';
import type { Layer } from '$lib/layers/Layer';
import type { UrlSyncMode } from '$lib/layers/types';

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
function parseLayerState(state: string): { visible: boolean; opacity: number; time?: string } {
	const { base, time } = splitTimeToken(state);
	const parts = base.split(':');
	const visible = parts[0] === '1';
	const opacityPct = parts.length > 1 ? parseInt(parts[1], 10) : 100;
	return { visible, opacity: isNaN(opacityPct) ? 1 : opacityPct / 100, time };
}

/**
 * The selected time rides on the layer entry after an `@`, so a group with two
 * time series layers can carry two different times:
 *
 *   pegel_gruppe(2:40@20260820T0000Z)                  instant
 *   pegel_gruppe(2:40@20260820T0000Z/20260820T1200Z)   range
 *   g(1@20260820T0000Z,1@20260819T1200Z)               two timed layers
 *
 * Timestamps use ISO basic format because the surrounding syntax already
 * spends `:` on opacity and `,` on layer separation.
 */
function splitTimeToken(entry: string): { base: string; time?: string } {
	const at = entry.indexOf('@');
	if (at === -1) {
		return { base: entry };
	}
	return { base: entry.slice(0, at), time: entry.slice(at + 1) };
}

/** The `@time` suffix for a layer, or an empty string when showing the latest. */
function timeToken(layer: { time?: string; viewportFilter?: boolean }): string {
	return layer.time ? `@${layer.time}` : '';
}

/**
 * Restore a layer's selected window from the url, through the same helper saved
 * profiles use, so both resolve a time identically.
 */
function applyLayerTime(layer: Layer, time: string | undefined): void {
	applyTimeSeriesState(layer, time);
}

/**
 * Encode a map state into the compact `layers` parameter.
 *
 * This is the lossy half of the split: `map` mode keeps only what is visible,
 * and neither mode carries anything beyond layer display state. The state
 * object itself stays complete — see `$lib/mapState`.
 */
export function serializeLayersParam(state: MapState, mode: UrlSyncMode): string | null {
	const entries: string[] = [];

	if (state.activeBackground) {
		entries.push(state.activeBackground);
	}

	if (mode === 'map') {
		// only visible overlays, addressed by name
		for (const group of state.groups ?? []) {
			for (const layer of group.layers) {
				if (!layer.visible) continue;
				const opacityPct = Math.round(layer.opacity * 100);
				entries.push(opacityPct === 100 ? layer.name : `${layer.name}:${opacityPct}`);
			}
		}
	} else if (mode === 'full') {
		// every group, its layers addressed by position — or, for a singleSelect
		// group, by the one-based index of the single visible layer
		for (const group of state.groups ?? []) {
			const config = layerStore.getGroupByName(group.name);
			if (config?.singleSelect) {
				const index = group.layers.findIndex((layer) => layer.visible);
				if (index === -1) {
					entries.push(`${group.name}(0)`);
				} else {
					const layer = group.layers[index];
					const opacityPct = Math.round(layer.opacity * 100);
					const base = opacityPct === 100 ? `${index + 1}` : `${index + 1}:${opacityPct}`;
					entries.push(`${group.name}(${base}${timeToken(layer)})`);
				}
				continue;
			}

			const states = group.layers.map((layer) => {
				const flag = layer.visible ? '1' : '0';
				const opacityPct = Math.round(layer.opacity * 100);
				const base = opacityPct === 100 ? flag : `${flag}:${opacityPct}`;
				return `${base}${timeToken(layer)}`;
			});
			entries.push(`${group.name}(${states.join(',')})`);
		}
	}

	return entries.length > 0 ? entries.join(',') : null;
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
			// singleSelect groups carry a one-based index of the visible layer
			// instead of a flag per layer, since only one can be visible.
			if (group.singleSelect) {
				const { base, time } = splitTimeToken(content!.trim());
				const match = /^(\d+)(?::(\d+))?$/.exec(base);
				if (!match) {
					console.warn(
						`[UrlSync] Malformed state '${content}' for singleSelect group '${name}' — expected an index, optionally followed by ':opacity'`
					);
					return;
				}
				const [, indexPart, opacityPart] = match;
				const oneBased = parseInt(indexPart, 10);
				if (oneBased > group.layers.length) {
					console.warn(
						`[UrlSync] Layer index '${indexPart}' out of bounds for singleSelect group '${name}' (has ${group.layers.length} layer(s))`
					);
					return;
				}
				// 0 means no layer visible, and all layers are already hidden
				if (oneBased === 0) return;

				const layer = group.layers[oneBased - 1];
				const opacityPct = opacityPart !== undefined ? parseInt(opacityPart, 10) : 100;
				layerStore.setLayerVisibility(layer.name, true);
				layerStore.setLayerOpacity(layer.name, isNaN(opacityPct) ? 1 : opacityPct / 100);
				applyLayerTime(layer, time);
				return;
			}

			content!.split(',').forEach((state, index) => {
				if (index >= group.layers.length) {
					console.warn(
						`[UrlSync] Layer index ${index} out of bounds for group '${name}' (has ${group.layers.length} layer(s))`
					);
					return;
				}
				const { visible, opacity, time } = parseLayerState(state.trim());
				layerStore.setLayerVisibility(group.layers[index].name, visible);
				layerStore.setLayerOpacity(group.layers[index].name, opacity);
				applyLayerTime(group.layers[index], time);
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
