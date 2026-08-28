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

/** Display state of a single layer. */
export interface LayerState {
	name: string;
	visible: boolean;
	/** 0..1, as the layer stores it */
	opacity: number;
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
			layers: group.layers.map((layer) => ({
				name: layer.name,
				visible: layer.visible,
				opacity: layer.opacity
			}))
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
		}
	}

	const order = state.groups.map((g) => g.name);
	if (order.length > 0) {
		layerStore.reorderGroups(order);
	}
}
