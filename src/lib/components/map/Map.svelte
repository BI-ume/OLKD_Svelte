<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Map, View } from 'ol';
	import { get as getProjection } from 'ol/proj';
	import { register } from 'ol/proj/proj4';
	import proj4 from 'proj4';
	import { mapStore } from '$lib/stores/mapStore';
	import { layerStore } from '$lib/stores/layerStore';
	import { configStore, mapConfig } from '$lib/stores/configStore';
	import 'ol/ol.css';

	let mapElement: HTMLDivElement;
	let map: Map | null = null;

	// Register EPSG:25832 (UTM Zone 32N) projection
	proj4.defs(
		'EPSG:25832',
		'+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
	);
	register(proj4);

	/**
	 * Generate resolution array matching Web Mercator (OSM/Google Maps) zoom levels.
	 * This allows direct zoom level compatibility with external map services.
	 */
	function createWebMercatorResolutions(levels: number): number[] {
		// Web Mercator max resolution: Earth circumference / 256 tiles
		// 40075016.686 m / 256 = 156543.03392804097 m/px
		const maxResolution = 156543.03392804097;

		const resolutions: number[] = [];
		for (let z = 0; z < levels; z++) {
			resolutions[z] = maxResolution / Math.pow(2, z);
		}
		return resolutions;
	}

	onMount(() => {
		const config = $mapConfig;
		if (!config) {
			console.error('Map configuration not available');
			return;
		}

		// Get projection
		const projectionCode = config.projection ?? 'EPSG:25832';
		const projection = getProjection(projectionCode);

		if (!projection) {
			console.error(`Projection ${projectionCode} not available`);
			return;
		}

		// Create resolution array matching Web Mercator zoom levels
		// This enables direct zoom level compatibility with OSM/Google Maps
		const maxZoom = config.maxZoom ?? 22;
		const resolutions = createWebMercatorResolutions(maxZoom + 1);

		// Create view with Web Mercator-compatible resolutions
		const view = new View({
			projection: projection,
			center: config.center ?? [468152, 5764386],
			zoom: config.zoom ?? 10,
			minZoom: config.minZoom ?? 0,
			maxZoom: maxZoom,
			extent: config.maxExtent,
			resolutions: resolutions,
			constrainResolution: true
		});

		// Create map without controls (we'll add custom ones)
		map = new Map({
			target: mapElement,
			view: view,
			controls: []
		});

		// Register map in store
		mapStore.setMap(map);

		// Add layers from layer store
		addLayersToMap();

		// Subscribe to layer store changes for future updates
		const unsubscribe = layerStore.subscribe(() => {
			// Layers are managed by individual layer classes
			// This subscription is for potential future use
		});

		return () => {
			unsubscribe();
		};
	});

	function addLayersToMap() {
		if (!map) return;

		const state = $layerStore;

		// Add background layers first (bottom of stack)
		state.backgroundLayers.forEach((layer) => {
			const olLayer = layer.olLayer;
			if (olLayer && !map!.getLayers().getArray().includes(olLayer)) {
				map!.addLayer(olLayer);
			}
		});

		// Add overlay layers on top
		state.overlayGroups.forEach((group) => {
			group.layers.forEach((layer) => {
				const olLayer = layer.olLayer;
				if (olLayer && !map!.getLayers().getArray().includes(olLayer)) {
					map!.addLayer(olLayer);
				}
			});
		});
	}

	onDestroy(() => {
		mapStore.destroy();
		map = null;
	});

	// Reactive: when layers are initialized, add them to map
	$: if ($layerStore.initialized && map) {
		addLayersToMap();
	}
</script>

<div class="map-container" bind:this={mapElement}></div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	/* OpenLayers overrides */
	.map-container :global(.ol-viewport) {
		position: absolute !important;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}
</style>
