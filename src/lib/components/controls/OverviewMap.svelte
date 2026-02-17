<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { OverviewMap as OLOverviewMap } from 'ol/control';
	import TileLayer from 'ol/layer/Tile';
	import TileWMS from 'ol/source/TileWMS';
	import { mapStore, mapReady } from '$lib/stores/mapStore';

	interface Props {
		sidebarOpen?: boolean;
	}

	// sidebarOpen is received but handled via CSS selector on parent .sidebar-open class
	let { sidebarOpen = false }: Props = $props();

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

		// Create SVG icon for the toggle button
		const svgIcon = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><rect x="1.5" y="1.5" width="21" height="21" rx="2"/><rect x="3.5" y="12" width="8.5" height="8.5" rx="1" fill="#fff" stroke-width="1.8"/><rect x="7" y="14.5" width="3.5" height="3" rx=".3" stroke-dasharray="1.5 1" stroke-width="1"/></svg>`;
		const labelEl = document.createElement('span');
		labelEl.innerHTML = svgIcon;
		const collapseLabelEl = document.createElement('span');
		collapseLabelEl.innerHTML = svgIcon;

		overviewMapControl = new OLOverviewMap({
			className: 'custom-overview-map',
			collapsed: true,
			collapsible: true,
			layers: [overviewLayer],
			label: labelEl,
			collapseLabel: collapseLabelEl,
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
			bottom: 10px;
			right: auto;
			top: auto;
			transition: left 0.3s ease;
		}

		.sidebar-open .custom-overview-map {
			left: 310px;
		}

		.custom-overview-map.ol-uncollapsible {
			bottom: 10px;
			left: 10px;
		}

		.sidebar-open .custom-overview-map.ol-uncollapsible {
			left: 310px;
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
			bottom: 0;
			left: 0;
			width: 28px;
			height: 28px;
			background: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
			color: #333;
			z-index: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
		}

		.custom-overview-map button:hover {
			background: #f0f0f0;
		}

		/* When collapsed, just show the button */
		.custom-overview-map.ol-collapsed .ol-overviewmap-map {
			display: none;
		}

		.custom-overview-map button span {
			display: flex;
			align-items: center;
			justify-content: center;
			line-height: 0;
		}
	</style>
</svelte:head>
