<script lang="ts">
	import { mapStore } from '$lib/stores/mapStore';
	import { transform } from 'ol/proj';

	interface Props {
		sidebarOpen?: boolean;
	}

	let { sidebarOpen = false }: Props = $props();

	let isOpen = $state(false);

	// Zoom level offset between our EPSG:25832 tile grid and Web Mercator
	// Our maxRes ≈ 4891.97 m/px, Web Mercator maxRes ≈ 156543.03 m/px
	// Ratio = 156543.03 / 4891.97 ≈ 32 = 2^5, so offset = 5
	const WEB_MERCATOR_ZOOM_OFFSET = 5;

	// Get current map center in EPSG:25832
	function getMapCenterUTM(): { easting: number; northing: number; zoom: number } | null {
		const view = mapStore.getView();
		if (!view) return null;
		const center = view.getCenter();
		const zoom = view.getZoom();
		if (!center || zoom === undefined) return null;
		return { easting: center[0], northing: center[1], zoom: Math.round(zoom) };
	}

	// Get current map center in WGS84 with Web Mercator zoom level
	function getMapCenterWGS84(): { lat: number; lon: number; zoom: number } | null {
		const view = mapStore.getView();
		if (!view) return null;
		const center = view.getCenter();
		const zoom = view.getZoom();
		if (!center || zoom === undefined) return null;
		const wgs84 = transform(center, 'EPSG:25832', 'EPSG:4326');
		// Translate our zoom level to Web Mercator zoom level
		const webMercatorZoom = Math.round(zoom) + WEB_MERCATOR_ZOOM_OFFSET;
		return { lat: wgs84[1], lon: wgs84[0], zoom: webMercatorZoom };
	}

	const externalLinks = [
		{
			name: 'Schrägluftbilder',
			getUrl: () => {
				const c = getMapCenterUTM();
				if (!c) return '#';
				return `https://owl.geoplex.de/v/bielefeld_f70f30ce/?x=${c.easting}&y=${c.northing}&yaw=0&elevation=150`;
			}
		},
		{
			name: '3D-Stadtmodell',
			getUrl: () => {
				const c = getMapCenterUTM();
				if (!c) return '#';
				return `https://owl.geoplex.de/v/bielefeld_f70f30ce/?state=cesium&x=${c.easting}&y=${c.northing}&yaw=0&elevation=150`;
			}
		},
		{
			name: 'Mängelmelder BI',
			getUrl: () => 'https://beteiligung.nrw.de/portal/bielefeld/beteiligung/themen/1001101'
		},
		{
			name: 'OpenStreetMap',
			getUrl: () => {
				const c = getMapCenterWGS84();
				if (!c) return '#';
				return `https://www.openstreetmap.org/#map=${c.zoom}/${c.lat.toFixed(5)}/${c.lon.toFixed(5)}`;
			}
		},
		{
			name: 'Google Maps',
			getUrl: () => {
				const c = getMapCenterWGS84();
				if (!c) return '#';
				return `https://www.google.com/maps/@${c.lat.toFixed(6)},${c.lon.toFixed(6)},${c.zoom}z`;
			}
		}
	];

	function toggle() {
		isOpen = !isOpen;
	}

	function openLink(link: typeof externalLinks[0]) {
		const url = link.getUrl();
		if (url && url !== '#') {
			window.open(url, '_blank');
		}
		isOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.goto-control')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="goto-control" class:sidebar-open={sidebarOpen}>
	<button
		class="goto-btn"
		class:active={isOpen}
		onclick={toggle}
		title="Gehe zu"
		aria-label="Gehe zu externen Diensten"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
			<polyline points="15 3 21 3 21 9"></polyline>
			<line x1="10" y1="14" x2="21" y2="3"></line>
		</svg>
	</button>

	{#if isOpen}
		<div class="goto-menu">
			<div class="menu-header">Gehe zu</div>
			{#each externalLinks as link}
				<button
					class="menu-item"
					onclick={() => openLink(link)}
				>
					<span>{link.name}</span>
					<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
						<polyline points="15 3 21 3 21 9"></polyline>
						<line x1="10" y1="14" x2="21" y2="3"></line>
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.goto-control {
		position: absolute;
		top: 214px;
		left: 10px;
		z-index: 100;
		transition: left 0.3s ease;
	}

	.goto-control.sidebar-open {
		left: 310px;
	}

	.goto-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #333;
		transition: background-color 0.15s, color 0.15s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.goto-btn:hover {
		background: #f0f0f0;
	}

	.goto-btn.active {
		background: #e0e0e0;
	}

	.goto-btn svg {
		width: 18px;
		height: 18px;
	}

	.goto-menu {
		position: absolute;
		top: 0;
		left: 44px;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 180px;
		padding: 4px 0;
		font-size: 14px;
	}

	.menu-header {
		padding: 8px 12px 4px;
		font-weight: 600;
		font-size: 12px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: #333;
		transition: background-color 0.1s;
	}

	.menu-item:hover {
		background-color: #f0f0f0;
	}

	.external-icon {
		width: 14px;
		height: 14px;
		opacity: 0.4;
	}
</style>
