<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { layerStore, activeBackground, visibleOverlayLayers } from '$lib/stores/layerStore';
	import { configStore } from '$lib/stores/configStore';

	// Props
	interface Props {
		updateOnMove?: boolean; // Update URL on map move
		updateOnLayerChange?: boolean; // Update URL on layer visibility change
		debounceMs?: number; // Debounce time for URL updates
	}

	let { updateOnMove = true, updateOnLayerChange = true, debounceMs = 300 }: Props = $props();

	let initialized = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let moveEndListener: any = null;
	let unsubscribeBg: (() => void) | null = null;
	let unsubscribeOverlay: (() => void) | null = null;

	// Get projection from config
	let projection = $derived($configStore.app?.map?.projection ?? 'EPSG:25832');

	// Subscribe to map ready state
	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready && !initialized) {
				initialized = true;
				initializeFromUrl();
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
	 * Parse a layer entry from URL (format: "layerName" or "layerName:opacity")
	 */
	function parseLayerEntry(entry: string): { name: string; opacity: number } {
		const parts = entry.split(':');
		const name = parts[0];
		const opacity = parts.length > 1 ? parseInt(parts[1], 10) : 100;
		return { name, opacity: isNaN(opacity) ? 100 : opacity };
	}

	/**
	 * Parse URL parameters and apply to map/layers
	 */
	function initializeFromUrl() {
		const url = new URL(window.location.href);
		const mapParam = url.searchParams.get('map');
		const layersParam = url.searchParams.get('layers');

		// Parse map parameter: zoom,x,y,crs
		if (mapParam) {
			const parts = mapParam.split(',');
			if (parts.length >= 3) {
				const zoom = parseFloat(parts[0]);
				const x = parseFloat(parts[1]);
				const y = parseFloat(parts[2]);
				// const crs = parts[3] || projection; // CRS in URL (optional)

				if (!isNaN(zoom) && !isNaN(x) && !isNaN(y)) {
					const view = mapStore.getView();
					if (view) {
						view.setCenter([x, y]);
						view.setZoom(zoom);
					}
				}
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

				// Track group order based on first occurrence
				const groupOrder: string[] = [];
				const seenGroups = new Set<string>();

				// Show specified layers with their opacities
				parsedLayers.forEach(({ name, opacity }) => {
					const layer = layerStore.getLayerByName(name);
					if (layer && !layer.isBackground) {
						layerStore.setLayerVisibility(name, true);
						layerStore.setLayerOpacity(name, opacity / 100);

						// Track group order
						const group = layerStore.getGroupByLayerName(name);
						if (group && !seenGroups.has(group.name)) {
							seenGroups.add(group.name);
							groupOrder.push(group.name);
						}
					}
				});

				// Reorder groups based on URL layer order
				if (groupOrder.length > 0) {
					layerStore.reorderGroups(groupOrder);
				}
			}
		}
	}

	/**
	 * Set up event listeners for map and layer changes
	 */
	function setupListeners() {
		const map = mapStore.getMap();
		if (!map) return;

		// Listen for map move end
		if (updateOnMove) {
			moveEndListener = map.on('moveend', () => {
				debouncedUpdateUrl();
			});
		}

		// Listen for layer changes
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
		}
	}

	function cleanup() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (moveEndListener) {
			const map = mapStore.getMap();
			if (map) {
				map.un('moveend', moveEndListener.listener);
			}
		}
		if (unsubscribeBg) {
			unsubscribeBg();
		}
		if (unsubscribeOverlay) {
			unsubscribeOverlay();
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

		// Build layers parameter with opacity
		const layerEntries: string[] = [];

		// Add active background (use get() for one-time read)
		const currentBg = get(activeBackground);
		if (currentBg) {
			layerEntries.push(currentBg.name);
		}

		// Add visible overlays with opacity (in group order)
		const overlays = get(visibleOverlayLayers);
		overlays.forEach((layer) => {
			layerEntries.push(formatLayerEntry(layer));
		});

		// Build URL manually to avoid encoding commas
		const url = new URL(window.location.href);
		const params: string[] = [];

		params.push(`map=${mapValue}`);

		if (layerEntries.length > 0) {
			params.push(`layers=${layerEntries.join(',')}`);
		}

		// Preserve other existing params (like config)
		url.searchParams.forEach((value, key) => {
			if (key !== 'map' && key !== 'layers') {
				params.push(`${key}=${encodeURIComponent(value)}`);
			}
		});

		// Update URL without navigation
		const newUrl = url.pathname + (params.length > 0 ? '?' + params.join('&') : '');
		window.history.replaceState({}, '', newUrl);
	}
</script>

<!-- This component has no visible UI -->
