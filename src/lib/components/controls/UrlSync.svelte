<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { activeBackground, visibleOverlayLayers, overlayGroups } from '$lib/stores/layerStore';
	import { configStore } from '$lib/stores/configStore';
	import type { UrlSyncMode } from '$lib/layers/types';
	import type { EventsKey } from 'ol/events';
	import { unByKey } from 'ol/Observable';

	// Props
	interface Props {
		initialMapState?: { zoom: number; x: number; y: number } | null;
		updateOnMove?: boolean; // Update URL on map move
		updateOnLayerChange?: boolean; // Update URL on layer visibility change
		debounceMs?: number; // Debounce time for URL updates
	}

	let { initialMapState = null, updateOnMove = true, updateOnLayerChange = true, debounceMs = 300 }: Props = $props();

	let initialized = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let moveEndListener: EventsKey | null = null;
	let unsubscribeBg: (() => void) | null = null;
	let unsubscribeOverlay: (() => void) | null = null;
	let unsubscribeGroups: (() => void) | null = null;

	// Get config from store
	let projection = $derived($configStore.app?.map?.projection ?? 'EPSG:25832');
	let urlSyncMode = $derived<UrlSyncMode>($configStore.app?.urlSync?.mode ?? 'map');

	// Subscribe to map ready state
	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready && !initialized) {
				initialized = true;
				applyMapPosition();
				setupListeners();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		cleanup();
	});

	/**
	 * Apply the map position parsed from URL (layer state is already applied before mount)
	 */
	function applyMapPosition() {
		if (initialMapState) {
			const view = mapStore.getView();
			if (view) {
				view.setCenter([initialMapState.x, initialMapState.y]);
				view.setZoom(initialMapState.zoom);
			}
		}
	}

	/**
	 * Set up event listeners for map and layer changes
	 */
	function setupListeners() {
		const map = mapStore.getMap();
		if (!map) return;

		// Listen for map move end (always, for all modes)
		if (updateOnMove) {
			moveEndListener = map.on('moveend', () => {
				debouncedUpdateUrl();
			});
		}

		// Listen for layer changes (only for 'map' and 'full' modes)
		if (updateOnLayerChange) {
			// Subscribe to layer store changes
			unsubscribeBg = activeBackground.subscribe(() => {
				if (initialized) {
					debouncedUpdateUrl();
				}
			});

			unsubscribeOverlay = visibleOverlayLayers.subscribe(() => {
				if (initialized) {
					debouncedUpdateUrl();
				}
			});

			// Subscribe to groups for 'full' mode (order changes)
			unsubscribeGroups = overlayGroups.subscribe(() => {
				if (initialized) {
					debouncedUpdateUrl();
				}
			});
		}
	}

	function cleanup() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (moveEndListener) {
			unByKey(moveEndListener);
			moveEndListener = null;
		}
		if (unsubscribeBg) {
			unsubscribeBg();
		}
		if (unsubscribeOverlay) {
			unsubscribeOverlay();
		}
		if (unsubscribeGroups) {
			unsubscribeGroups();
		}
	}

	/**
	 * Debounced URL update
	 */
	function debouncedUpdateUrl() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			updateUrl();
		}, debounceMs);
	}

	/**
	 * Format a layer entry for URL (format: "layerName" or "layerName:opacity")
	 */
	function formatLayerEntry(layer: { name: string; opacity: number }): string {
		const opacityPercent = Math.round(layer.opacity * 100);
		if (opacityPercent === 100) {
			return layer.name;
		}
		return `${layer.name}:${opacityPercent}`;
	}

	/**
	 * Update URL with current map state
	 */
	function updateUrl() {
		const view = mapStore.getView();
		if (!view) return;

		const center = view.getCenter();
		const zoom = view.getZoom();

		if (!center || zoom === undefined) return;

		// Build map parameter: zoom,x,y,crs
		const x = Math.round(center[0] * 100) / 100;
		const y = Math.round(center[1] * 100) / 100;
		const z = Math.round(zoom * 100) / 100;
		const mapValue = `${z},${x},${y},${projection}`;

		// Build URL manually to avoid encoding commas
		const url = new URL(window.location.href);
		const params: string[] = [];

		params.push(`map=${mapValue}`);

		// Handle layer params based on mode
		if (urlSyncMode === 'map') {
			// map mode: only visible overlays, no prefix
			const layerEntries: string[] = [];

			const currentBg = get(activeBackground);
			if (currentBg) {
				layerEntries.push(currentBg.name);
			}

			get(visibleOverlayLayers).forEach((layer) => {
				layerEntries.push(formatLayerEntry(layer));
			});

			if (layerEntries.length > 0) {
				params.push(`layers=${layerEntries.join(',')}`);
			}
		} else if (urlSyncMode === 'full') {
			// full mode: compact format — layers=bg,groupA(1:80,0:50,1),groupB(0,1:55)
			// Each group's layers are encoded by index as "1" (visible) or "0" (hidden),
			// with an optional ":opacity" suffix when opacity is not 100%.
			const layerEntries: string[] = [];

			const currentBg = get(activeBackground);
			if (currentBg) {
				layerEntries.push(currentBg.name);
			}

			const groups = get(overlayGroups);
			groups.forEach((group) => {
				const states = group.layers.map((layer) => {
					const vis = layer.visible ? '1' : '0';
					const opPct = Math.round(layer.opacity * 100);
					return opPct === 100 ? vis : `${vis}:${opPct}`;
				});
				layerEntries.push(`${group.name}(${states.join(',')})`);
			});

			if (layerEntries.length > 0) {
				params.push(`layers=${layerEntries.join(',')}`);
			}
			// No separate groups param — group names and order are embedded in layers
		}

		// Preserve other existing params (like config)
		url.searchParams.forEach((value, key) => {
			if (key !== 'map' && key !== 'layers' && key !== 'groups') {
				params.push(`${key}=${encodeURIComponent(value)}`);
			}
		});

		// Update URL without navigation
		const newUrl = url.pathname + (params.length > 0 ? '?' + params.join('&') : '');
		window.history.replaceState({}, '', newUrl);
	}
</script>

<!-- This component has no visible UI -->
