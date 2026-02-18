import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import type { Layer } from '$lib/layers/Layer';
import type { Group } from '$lib/layers/Group';
import { mapStore } from './mapStore';

interface LayerState {
	backgroundLayers: Layer[];
	overlayGroups: Group[];
	activeBackgroundLayer: Layer | null;
	initialized: boolean;
}

/** Per-layer display state for granular reactivity */
export interface LayerDisplayState {
	visible: boolean;
	opacity: number;
}

// Per-layer writable stores for O(1) reactivity
const layerDisplayStores = new Map<string, Writable<LayerDisplayState>>();

// Writable store tracking which layer names are currently visible
// Updated via _onDisplayChange callback — triggers visibleOverlayLayers
const _visibleLayerNames = writable<Set<string>>(new Set());

/**
 * Get a readable store for a single layer's display state (visible + opacity).
 * Creates lazily if not yet wired.
 */
export function getLayerDisplay(name: string): Readable<LayerDisplayState> {
	let store = layerDisplayStores.get(name);
	if (!store) {
		// Lazy creation with default hidden state
		store = writable<LayerDisplayState>({ visible: false, opacity: 1 });
		layerDisplayStores.set(name, store);
	}
	return { subscribe: store.subscribe };
}

/**
 * Get a readable derived store for whether a group has any visible layers.
 * Derives from the individual per-layer stores of the group's layers.
 */
export function getGroupDisplay(group: Group): Readable<boolean> {
	const layerStores = group.layers.map((l) => getLayerDisplay(l.name));
	return derived(layerStores, (states) => states.some((s) => s.visible));
}

/**
 * Wire a layer's _onDisplayChange callback to push state into its per-layer store
 * and update the visibleLayerNames set.
 */
function wireLayer(layer: Layer): void {
	// Create or update the per-layer store with current state
	let store = layerDisplayStores.get(layer.name);
	if (!store) {
		store = writable<LayerDisplayState>({ visible: layer.visible, opacity: layer.opacity });
		layerDisplayStores.set(layer.name, store);
	} else {
		store.set({ visible: layer.visible, opacity: layer.opacity });
	}

	// Seed visibleLayerNames
	if (layer.visible) {
		_visibleLayerNames.update((names) => {
			names.add(layer.name);
			return new Set(names);
		});
	}

	// Set the callback so future setVisible/setOpacity calls push into the per-layer store
	layer._onDisplayChange = (visible: boolean, opacity: number) => {
		const s = layerDisplayStores.get(layer.name);
		if (s) {
			s.set({ visible, opacity });
		}
		// Update the visible names set
		_visibleLayerNames.update((names) => {
			if (visible) {
				names.add(layer.name);
			} else {
				names.delete(layer.name);
			}
			return new Set(names);
		});
	};
}

/**
 * Unwire a layer: remove callback and clean up per-layer store.
 */
function unwireLayer(layer: Layer): void {
	layer._onDisplayChange = undefined;
	layerDisplayStores.delete(layer.name);
	_visibleLayerNames.update((names) => {
		names.delete(layer.name);
		return new Set(names);
	});
}

function createLayerStore() {
	const { subscribe, set, update } = writable<LayerState>({
		backgroundLayers: [],
		overlayGroups: [],
		activeBackgroundLayer: null,
		initialized: false
	});

	// Maps for quick lookup
	let layersByName: Map<string, Layer> = new Map();
	let groupsByName: Map<string, Group> = new Map();

	return {
		subscribe,

		/**
		 * Initialize the store with layers from configuration
		 */
		initialize: (backgrounds: Layer[], overlays: Group[]): void => {
			// Build lookup maps
			layersByName = new Map();
			groupsByName = new Map();

			// Clear previous per-layer stores
			layerDisplayStores.clear();
			_visibleLayerNames.set(new Set());

			// Index background layers
			backgrounds.forEach((layer) => {
				layersByName.set(layer.name, layer);
			});

			// Index overlay groups and their layers
			overlays.forEach((group) => {
				groupsByName.set(group.name, group);
				group.layers.forEach((layer) => {
					layersByName.set(layer.name, layer);
				});
			});

			// Find active background (first visible or first layer)
			const activeBackground = backgrounds.find((l) => l.visible) || backgrounds[0] || null;

			// Ensure only one background is visible
			backgrounds.forEach((layer) => {
				layer.setVisible(layer === activeBackground);
			});

			// Wire all layers (after setVisible so callbacks capture final state)
			backgrounds.forEach((layer) => wireLayer(layer));
			overlays.forEach((group) => {
				group.layers.forEach((layer) => wireLayer(layer));
			});

			set({
				backgroundLayers: backgrounds,
				overlayGroups: overlays,
				activeBackgroundLayer: activeBackground,
				initialized: true
			});
		},

		/**
		 * Set the active background layer
		 */
		setActiveBackground: (layer: Layer): void => {
			update((state) => {
				// Hide all backgrounds
				state.backgroundLayers.forEach((l) => l.setVisible(false));

				// Show selected
				layer.setVisible(true);

				return {
					...state,
					activeBackgroundLayer: layer
				};
			});
		},

		/**
		 * Set active background by name
		 */
		setActiveBackgroundByName: (name: string): void => {
			const layer = layersByName.get(name);
			if (layer && layer.isBackground) {
				const store = get({ subscribe });
				// Hide all backgrounds
				store.backgroundLayers.forEach((l) => l.setVisible(false));
				// Show selected
				layer.setVisible(true);

				update((state) => ({
					...state,
					activeBackgroundLayer: layer
				}));
			}
		},

		/**
		 * Toggle layer visibility
		 */
		toggleLayerVisibility: (name: string): void => {
			const layer = layersByName.get(name);
			if (layer && !layer.isBackground) {
				layer.setVisible(!layer.visible);
				// No structural update() needed — per-layer callback handles reactivity
			}
		},

		/**
		 * Set layer visibility explicitly
		 */
		setLayerVisibility: (name: string, visible: boolean): void => {
			const layer = layersByName.get(name);
			if (layer && !layer.isBackground) {
				layer.setVisible(visible);
				// No structural update() needed — per-layer callback handles reactivity
			}
		},

		/**
		 * Set layer opacity
		 */
		setLayerOpacity: (name: string, opacity: number): void => {
			const layer = layersByName.get(name);
			if (layer) {
				layer.setOpacity(opacity);
				// No structural update() needed — per-layer callback handles reactivity
			}
		},

		/**
		 * Toggle group visibility (affects all layers in group)
		 */
		toggleGroupVisibility: (name: string): void => {
			const group = groupsByName.get(name);
			if (group) {
				const newVisibility = !group.visible;
				group.setVisible(newVisibility);
				// No structural update() needed — per-layer callbacks handle reactivity
			}
		},

		/**
		 * Set group visibility explicitly
		 */
		setGroupVisibility: (name: string, visible: boolean): void => {
			const group = groupsByName.get(name);
			if (group) {
				group.setVisible(visible);
				// No structural update() needed — per-layer callbacks handle reactivity
			}
		},

		/**
		 * Get layer by name
		 */
		getLayerByName: (name: string): Layer | undefined => {
			return layersByName.get(name);
		},

		/**
		 * Get group by name
		 */
		getGroupByName: (name: string): Group | undefined => {
			return groupsByName.get(name);
		},

		/**
		 * Get the group that contains a layer by layer name
		 */
		getGroupByLayerName: (layerName: string): Group | undefined => {
			for (const group of groupsByName.values()) {
				if (group.layers.some((l) => l.name === layerName)) {
					return group;
				}
			}
			return undefined;
		},

		/**
		 * Get all visible overlay layers
		 */
		getVisibleOverlayLayers: (): Layer[] => {
			const state = get({ subscribe });
			const visible: Layer[] = [];

			state.overlayGroups.forEach((group) => {
				group.layers.forEach((layer) => {
					if (layer.visible) {
						visible.push(layer);
					}
				});
			});

			return visible;
		},

		/**
		 * Get names of all visible layers (background + overlays)
		 */
		getVisibleLayerNames: (): string[] => {
			const state = get({ subscribe });
			const names: string[] = [];

			// Add active background
			if (state.activeBackgroundLayer) {
				names.push(state.activeBackgroundLayer.name);
			}

			// Add visible overlays
			state.overlayGroups.forEach((group) => {
				group.layers.forEach((layer) => {
					if (layer.visible) {
						names.push(layer.name);
					}
				});
			});

			return names;
		},

		/**
		 * Get opacities for visible layers where opacity !== 1
		 */
		getLayerOpacities: (): Record<string, number> => {
			const state = get({ subscribe });
			const opacities: Record<string, number> = {};

			// Background layer
			if (state.activeBackgroundLayer && state.activeBackgroundLayer.opacity !== 1) {
				opacities[state.activeBackgroundLayer.name] = state.activeBackgroundLayer.opacity;
			}

			// Visible overlays
			state.overlayGroups.forEach((group) => {
				group.layers.forEach((layer) => {
					if (layer.visible && layer.opacity !== 1) {
						opacities[layer.name] = layer.opacity;
					}
				});
			});

			return opacities;
		},

		/**
		 * Get all layers (background + overlay)
		 */
		getAllLayers: (): Layer[] => {
			const state = get({ subscribe });
			const allLayers: Layer[] = [...state.backgroundLayers];

			state.overlayGroups.forEach((group) => {
				allLayers.push(...group.layers);
			});

			return allLayers;
		},

		/**
		 * Add a group to overlays (e.g. from catalog)
		 * New group is added at the top of the list (highest z-index)
		 */
		addGroup: (group: Group): void => {
			// Register in lookup maps
			groupsByName.set(group.name, group);
			group.layers.forEach((layer) => {
				layersByName.set(layer.name, layer);
				wireLayer(layer);
			});

			// Add OL layers to map with highest z-index (on top)
			const map = mapStore.getMap();
			const state = get({ subscribe });
			if (map) {
				// Calculate current highest z-index
				const bgCount = state.backgroundLayers.length;
				let totalOverlayLayers = 0;
				state.overlayGroups.forEach((g) => {
					totalOverlayLayers += g.layers.length;
				});
				// New layers go on top
				let zIndex = bgCount + totalOverlayLayers + group.layers.length - 1;

				group.layers.forEach((layer) => {
					const olLayer = layer.olLayer;
					if (!map.getLayers().getArray().includes(olLayer)) {
						olLayer.setZIndex(zIndex);
						map.addLayer(olLayer);
					}
					zIndex--;
				});
			}

			// Add at the beginning of the list (top)
			update((state) => ({
				...state,
				overlayGroups: [group, ...state.overlayGroups]
			}));
		},

		/**
		 * Remove a group from overlays
		 */
		removeGroup: (name: string): void => {
			const group = groupsByName.get(name);
			if (!group) return;

			// Remove OL layers from map
			const map = mapStore.getMap();
			if (map) {
				group.layers.forEach((layer) => {
					const olLayer = layer.olLayer;
					if (map.getLayers().getArray().includes(olLayer)) {
						map.removeLayer(olLayer);
					}
				});
			}

			// Unwire and remove from lookup maps
			groupsByName.delete(name);
			group.layers.forEach((layer) => {
				unwireLayer(layer);
				layersByName.delete(layer.name);
			});

			// Dispose OL layers
			group.dispose();

			update((state) => ({
				...state,
				overlayGroups: state.overlayGroups.filter((g) => g.name !== name)
			}));
		},

		/**
		 * Reorder overlay groups by name array.
		 * Also updates OL layer z-indices on the map.
		 * First group in the array (top of list in UI) gets highest z-index (on top in map).
		 */
		reorderGroups: (orderedNames: string[]): void => {
			update((state) => {
				const groupMap = new Map(state.overlayGroups.map((g) => [g.name, g]));
				const reordered: Group[] = [];

				// Place groups in the requested order
				for (const name of orderedNames) {
					const group = groupMap.get(name);
					if (group) {
						reordered.push(group);
						groupMap.delete(name);
					}
				}

				// Append any remaining groups not in orderedNames
				for (const group of groupMap.values()) {
					reordered.push(group);
				}

				// Update OL layer z-indices on the map
				// First group (top of list) should have highest z-index (on top in map)
				const map = mapStore.getMap();
				if (map) {
					const bgCount = state.backgroundLayers.length;
					// Count total overlay layers
					let totalOverlayLayers = 0;
					for (const group of reordered) {
						totalOverlayLayers += group.layers.length;
					}
					// Assign z-indices in reverse: first group gets highest
					let zIndex = bgCount + totalOverlayLayers - 1;
					for (const group of reordered) {
						for (const layer of group.layers) {
							layer.olLayer.setZIndex(zIndex);
							zIndex--;
						}
					}
				}

				return {
					...state,
					overlayGroups: reordered
				};
			});
		},

		/**
		 * Reset the store
		 */
		reset: (): void => {
			// Unwire all layers
			for (const layer of layersByName.values()) {
				layer._onDisplayChange = undefined;
			}
			layerDisplayStores.clear();
			_visibleLayerNames.set(new Set());

			layersByName = new Map();
			groupsByName = new Map();

			set({
				backgroundLayers: [],
				overlayGroups: [],
				activeBackgroundLayer: null,
				initialized: false
			});
		}
	};
}

export const layerStore = createLayerStore();

// Derived stores for convenient access
export const backgroundLayers = derived(layerStore, ($layers) => $layers.backgroundLayers);
export const overlayGroups = derived(layerStore, ($layers) => $layers.overlayGroups);
export const activeBackground = derived(layerStore, ($layers) => $layers.activeBackgroundLayer);
export const layersInitialized = derived(layerStore, ($layers) => $layers.initialized);

/** Readable store of currently-visible layer names. Reacts to per-layer visibility changes. */
export const visibleLayerNames: Readable<Set<string>> = { subscribe: _visibleLayerNames.subscribe };

// Derived store for visible overlay layers
// Reacts to both structural changes (layerStore) AND visibility changes (visibleLayerNames)
export const visibleOverlayLayers = derived(
	[layerStore, _visibleLayerNames],
	([$layers, $names]) => {
		const visible: Layer[] = [];
		$layers.overlayGroups.forEach((group) => {
			group.layers.forEach((layer) => {
				if ($names.has(layer.name)) {
					visible.push(layer);
				}
			});
		});
		return visible;
	}
);
