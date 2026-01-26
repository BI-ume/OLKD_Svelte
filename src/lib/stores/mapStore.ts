import { writable, derived, get } from 'svelte/store';
import type { Map, View } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type { Extent } from 'ol/extent';

interface MapState {
	map: Map | null;
	view: View | null;
	ready: boolean;
	center: Coordinate;
	zoom: number;
	resolution: number;
}

function createMapStore() {
	const { subscribe, set, update } = writable<MapState>({
		map: null,
		view: null,
		ready: false,
		center: [0, 0],
		zoom: 0,
		resolution: 0
	});

	let viewListeners: (() => void)[] = [];

	return {
		subscribe,

		/**
		 * Set the map instance and start tracking view changes
		 */
		setMap: (map: Map): void => {
			// Clean up previous listeners
			viewListeners.forEach((cleanup) => cleanup());
			viewListeners = [];

			const view = map.getView();

			// Initial state
			update((s) => ({
				...s,
				map,
				view,
				ready: true,
				center: view.getCenter() || [0, 0],
				zoom: view.getZoom() || 0,
				resolution: view.getResolution() || 0
			}));

			// Track view changes
			const centerListener = view.on('change:center', () => {
				update((s) => ({
					...s,
					center: view.getCenter() || [0, 0]
				}));
			});

			const resolutionListener = view.on('change:resolution', () => {
				update((s) => ({
					...s,
					zoom: view.getZoom() || 0,
					resolution: view.getResolution() || 0
				}));
			});

			// Store cleanup functions
			viewListeners.push(
				() => view.un('change:center', centerListener.listener),
				() => view.un('change:resolution', resolutionListener.listener)
			);
		},

		/**
		 * Get the map instance synchronously
		 */
		getMap: (): Map | null => {
			return get({ subscribe }).map;
		},

		/**
		 * Get the view instance synchronously
		 */
		getView: (): View | null => {
			return get({ subscribe }).view;
		},

		/**
		 * Zoom to extent with optional padding
		 */
		zoomToExtent: (extent: Extent, padding: number[] = [50, 50, 50, 50]): void => {
			const state = get({ subscribe });
			if (state.map && state.view) {
				state.view.fit(extent, {
					size: state.map.getSize(),
					padding
				});
			}
		},

		/**
		 * Set center and zoom
		 */
		setView: (center: Coordinate, zoom?: number): void => {
			const state = get({ subscribe });
			if (state.view) {
				state.view.setCenter(center);
				if (zoom !== undefined) {
					state.view.setZoom(zoom);
				}
			}
		},

		/**
		 * Animate to center and zoom
		 */
		animateTo: (center: Coordinate, zoom?: number, duration: number = 500): void => {
			const state = get({ subscribe });
			if (state.view) {
				state.view.animate({
					center,
					zoom,
					duration
				});
			}
		},

		/**
		 * Clean up the map instance
		 */
		destroy: (): void => {
			// Clean up listeners
			viewListeners.forEach((cleanup) => cleanup());
			viewListeners = [];

			const state = get({ subscribe });
			if (state.map) {
				state.map.setTarget(undefined);
			}

			set({
				map: null,
				view: null,
				ready: false,
				center: [0, 0],
				zoom: 0,
				resolution: 0
			});
		}
	};
}

export const mapStore = createMapStore();

// Derived stores for convenient access
export const mapReady = derived(mapStore, ($map) => $map.ready);
export const mapCenter = derived(mapStore, ($map) => $map.center);
export const mapZoom = derived(mapStore, ($map) => $map.zoom);
export const mapResolution = derived(mapStore, ($map) => $map.resolution);
