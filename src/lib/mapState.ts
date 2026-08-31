/**
 * The map state that both the URL and saved profiles describe.
 *
 * This is the single source of truth: `UrlSync` serialises it into the compact
 * `layers=…` parameter, `profiles.ts` stores it as JSON. Anything added here is
 * carried by both, as long as `applyMapState()` reads it back — mirroring the
 * `getParameters()` / `generatePermalink()` split in the AngularJS app's
 * `permalink-service.js`.
 *
 * Keep it a plain object, never the URL string: the compact format is lossy by
 * design and could never carry something like the drawn features.
 */
import { get } from 'svelte/store';
import { mapStore } from '$lib/stores/mapStore';
import { layerStore, activeBackground, overlayGroups } from '$lib/stores/layerStore';
import { SensorThings } from '$lib/layers/SensorThings';
import { toCompactIso, fromCompactIso, timeWindow } from '$lib/utils/time';
import { syncFromLayer } from '$lib/stores/timeSeriesStore';
import type { Layer } from '$lib/layers/Layer';

/** Display state of a single layer. */
export interface LayerState {
	name: string;
	visible: boolean;
	/** 0..1, as the layer stores it */
	opacity: number;
	/**
	 * Selected time window for a time series layer, compact ISO. A single
	 * instant for `mode: instant`, `start/end` for a range. Absent means the
	 * layer is showing its latest data.
	 */
	time?: string;
	/** Whether availability is scoped to the sensors in view. */
	viewportFilter?: boolean;
}

/** A group and its layers, in configuration order. */
export interface GroupState {
	name: string;
	layers: LayerState[];
}

export interface MapState {
	center?: [number, number];
	zoom?: number;
	activeBackground?: string | null;
	/** Overlay groups in display order. */
	groups?: GroupState[];
}

/**
 * Read the current state of the map.
 *
 * Returns every group and every layer, visible or not — the superset both
 * serialisations narrow from. The URL's `map` mode lists only what is visible;
 * that is a property of the format, not of the state.
 */
export function getMapState(): MapState {
	const view = mapStore.getView();
	const center = view?.getCenter();
	const zoom = view?.getZoom();

	return {
		center: center ? [center[0], center[1]] : undefined,
		zoom,
		activeBackground: get(activeBackground)?.name ?? null,
		groups: get(overlayGroups).map((group) => ({
			name: group.name,
			layers: group.layers.map((layer) => {
				const state: LayerState = {
					name: layer.name,
					visible: layer.visible,
					opacity: layer.opacity
				};
				if (layer instanceof SensorThings) {
					const window = layer.getTime();
					if (window) {
						state.time =
							layer.timeSeries?.mode === 'range'
								? `${toCompactIso(window.start)}/${toCompactIso(window.end)}`
								: toCompactIso(window.start);
					}
					if (layer.hasViewportFilter && layer.getViewportFilter()) {
						state.viewportFilter = true;
					}
				}
				return state;
			})
		}))
	};
}

export interface ApplyMapStateOptions {
	/** Skip the view; UrlSync applies position itself once the map exists. */
	skipView?: boolean;
}

/**
 * Apply a state to the running map.
 *
 * Groups the state does not mention are left alone; groups it mentions but that
 * do not exist are skipped with a warning. Callers that need to add missing
 * groups (the catalog) must do so before calling this.
 */
export function applyMapState(state: MapState, options: ApplyMapStateOptions = {}): void {
	if (!options.skipView && state.center && state.zoom !== undefined) {
		const view = mapStore.getView();
		if (view) {
			view.setCenter(state.center);
			view.setZoom(state.zoom);
		}
	}

	if (state.activeBackground) {
		layerStore.setActiveBackgroundByName(state.activeBackground);
	}

	if (!state.groups) {
		return;
	}

	// Hide everything first, so a group listed with no visible layer ends up
	// with none rather than keeping whatever was on before.
	layerStore.getAllLayers().forEach((layer) => {
		if (!layer.isBackground) {
			layerStore.setLayerVisibility(layer.name, false);
		}
	});

	for (const groupState of state.groups) {
		const group = layerStore.getGroupByName(groupState.name);
		if (!group) {
			console.warn(`[mapState] Group '${groupState.name}' not found in config — skipping`);
			continue;
		}

		// A singleSelect group can only ever show one layer. Enforcing it here
		// rather than trusting the stored state keeps a profile written before
		// this rule from restoring an impossible combination.
		let visibleSeen = false;

		for (const layerState of groupState.layers) {
			const layer = layerStore.getLayerByName(layerState.name);
			if (!layer) {
				console.warn(`[mapState] Layer '${layerState.name}' not found in config — skipping`);
				continue;
			}

			let visible = layerState.visible;
			if (visible && group.singleSelect) {
				if (visibleSeen) {
					visible = false;
				} else {
					visibleSeen = true;
				}
			}

			layerStore.setLayerVisibility(layerState.name, visible);
			layerStore.setLayerOpacity(layerState.name, layerState.opacity);

			applyTimeSeriesState(layer, layerState.time, layerState.viewportFilter);
		}
	}

	const order = state.groups.map((g) => g.name);
	if (order.length > 0) {
		layerStore.reorderGroups(order);
	}
}

/**
 * Restore a time series layer's selection.
 *
 * Exported because the url parser applies times layer by layer as it walks the
 * `layers` parameter, and both paths must resolve a time identically - which is
 * the point of the shared map state.
 *
 * The viewport filter is set first, so the reload the time triggers is the only
 * one. An absent time means "leave at the config default", matching how the
 * other optional fields are treated.
 */
export function applyTimeSeriesState(
	layer: Layer,
	time: string | undefined,
	viewportFilter?: boolean
): void {
	if (!(layer instanceof SensorThings)) {
		return;
	}
	if (layer.hasViewportFilter) {
		layer.setViewportFilter(viewportFilter === true);
	}

	if (time === undefined) {
		syncFromLayer(layer);
		return;
	}
	if (!layer.granularity) {
		console.warn(`[mapState] Layer '${layer.name}' has no time series granularity — ignoring time`);
		return;
	}

	const [startPart, endPart] = time.split('/');
	const start = fromCompactIso(startPart);
	if (start === undefined) {
		console.warn(`[mapState] Could not parse time '${time}' for layer '${layer.name}'`);
		return;
	}

	const startWindow = timeWindow(start, layer.granularity);
	const end = endPart === undefined ? undefined : fromCompactIso(endPart);
	layer.setTime(end === undefined ? startWindow : { start: startWindow.start, end });
	syncFromLayer(layer);
}
