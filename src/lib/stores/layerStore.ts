import { writable, derived, get } from 'svelte/store';
import type { Layer } from '$lib/layers/Layer';
import type { Group } from '$lib/layers/Group';

interface LayerState {
	backgroundLayers: Layer[];
	overlayGroups: Group[];
	activeBackgroundLayer: Layer | null;
	initialized: boolean;
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
				// Trigger reactivity
				update((state) => ({ ...state }));
			}
		},

		/**
		 * Set layer visibility explicitly
		 */
		setLayerVisibility: (name: string, visible: boolean): void => {
			const layer = layersByName.get(name);
			if (layer && !layer.isBackground) {
				layer.setVisible(visible);
				// Trigger reactivity
				update((state) => ({ ...state }));
			}
		},

		/**
		 * Set layer opacity
		 */
		setLayerOpacity: (name: string, opacity: number): void => {
			const layer = layersByName.get(name);
			if (layer) {
				layer.setOpacity(opacity);
				// Trigger reactivity
				update((state) => ({ ...state }));
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
				// Trigger reactivity
				update((state) => ({ ...state }));
			}
		},

		/**
		 * Set group visibility explicitly
		 */
		setGroupVisibility: (name: string, visible: boolean): void => {
			const group = groupsByName.get(name);
			if (group) {
				group.setVisible(visible);
				// Trigger reactivity
				update((state) => ({ ...state }));
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
		 * Reset the store
		 */
		reset: (): void => {
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

// Derived store for visible overlay layers
export const visibleOverlayLayers = derived(layerStore, ($layers) => {
	const visible: Layer[] = [];
	$layers.overlayGroups.forEach((group) => {
		group.layers.forEach((layer) => {
			if (layer.visible) {
				visible.push(layer);
			}
		});
	});
	return visible;
});
