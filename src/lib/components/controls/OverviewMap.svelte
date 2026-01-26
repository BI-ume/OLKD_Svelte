<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { OverviewMap as OLOverviewMap } from 'ol/control';
	import TileLayer from 'ol/layer/Tile';
	import TileWMS from 'ol/source/TileWMS';
	import { mapStore, mapReady } from '$lib/stores/mapStore';

	let overviewMapControl: OLOverviewMap | null = null;

	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready && !overviewMapControl) {
				initOverviewMap();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	function initOverviewMap() {
		const map = mapStore.getMap();
		if (!map) return;

		// Create a simple WMS layer for the overview
		const overviewLayer = new TileLayer({
			source: new TileWMS({
				url: '/proxy/wms/37839f35579e0cc42562c9bdbf4e04e9734c9a5225af144b4ee50ef9/service',
				params: {
					LAYERS: 'map',
					FORMAT: 'image/png',
					SRS: 'EPSG:25832'
				}
			})
		});

		overviewMapControl = new OLOverviewMap({
			className: 'custom-overview-map',
			collapsed: true,
			collapsible: true,
			layers: [overviewLayer],
			tipLabel: 'Übersichtskarte ein-/ausblenden'
		});

		map.addControl(overviewMapControl);
	}

	onDestroy(() => {
		if (overviewMapControl) {
			const map = mapStore.getMap();
			if (map) {
				map.removeControl(overviewMapControl);
			}
			overviewMapControl = null;
		}
	});
</script>

<!-- This component adds global styles for the OL OverviewMap control -->
<svelte:head>
	<style>
		/* Position the overview map at bottom-left */
		.custom-overview-map {
			position: absolute;
			left: 10px;
			bottom: 40px;
			right: auto;
			top: auto;
		}

		.custom-overview-map.ol-uncollapsible {
			bottom: 40px;
			left: 10px;
		}

		.custom-overview-map .ol-overviewmap-map {
			width: 180px;
			height: 120px;
			border: 2px solid #666;
			border-radius: 4px;
			margin: 0;
		}

		.custom-overview-map .ol-overviewmap-box {
			border: 2px solid #E2001A;
			background: rgba(226, 0, 26, 0.15);
		}

		/* Button when map is expanded - position at top-right of the map */
		.custom-overview-map button {
			position: absolute;
			top: 0;
			right: 0;
			width: 28px;
			height: 28px;
			background: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
			font-size: 14px;
			color: #333;
			z-index: 1;
		}

		.custom-overview-map button:hover {
			background: #f0f0f0;
		}

		/* Button when collapsed - just show the button */
		.custom-overview-map.ol-collapsed button {
			position: static;
		}

		.custom-overview-map button span {
			font-size: 16px;
		}
	</style>
</svelte:head>
