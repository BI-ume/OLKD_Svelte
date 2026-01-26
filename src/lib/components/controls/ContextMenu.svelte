<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { transform } from 'ol/proj';
	import type { Coordinate } from 'ol/coordinate';

	let visible = $state(false);
	let position = $state({ x: 0, y: 0 });
	let clickCoordinate: Coordinate | null = $state(null);
	let showSubmenu = $state<string | null>(null);
	let submenuTimer: ReturnType<typeof setTimeout> | null = null;
	let copyFeedback = $state<string | null>(null);

	// Store the event listener reference for cleanup
	let contextMenuHandler: ((e: Event) => void) | null = null;

	// Formatted coordinates
	let wgs84Formatted = $derived.by(() => {
		if (!clickCoordinate) return '';
		const wgs84 = transform(clickCoordinate, 'EPSG:25832', 'EPSG:4326');
		return `${wgs84[1].toFixed(5)}, ${wgs84[0].toFixed(5)}`;
	});

	let utmFormatted = $derived.by(() => {
		if (!clickCoordinate) return '';
		return `${clickCoordinate[1].toFixed(2)} ${clickCoordinate[0].toFixed(2)}`;
	});

	// Get current map center in EPSG:25832 for external links
	function getMapCenterUTM(): { easting: number; northing: number; zoom: number } | null {
		const view = mapStore.getView();
		if (!view) return null;
		const center = view.getCenter();
		const zoom = view.getZoom();
		if (!center || zoom === undefined) return null;
		return { easting: center[0], northing: center[1], zoom: Math.round(zoom) };
	}

	// Get current map center in WGS84
	function getMapCenterWGS84(): { lat: number; lon: number; zoom: number } | null {
		const view = mapStore.getView();
		if (!view) return null;
		const center = view.getCenter();
		const zoom = view.getZoom();
		if (!center || zoom === undefined) return null;
		const wgs84 = transform(center, 'EPSG:25832', 'EPSG:4326');
		return { lat: wgs84[1], lon: wgs84[0], zoom: Math.round(zoom) };
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

	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready) {
				setupContextMenu();
			}
		});

		// Close menu on left-click anywhere
		document.addEventListener('click', handleClickOutside);

		return () => {
			unsubscribe();
			document.removeEventListener('click', handleClickOutside);
			cleanupContextMenu();
		};
	});

	onDestroy(() => {
		cleanupContextMenu();
	});

	function setupContextMenu() {
		const map = mapStore.getMap();
		if (!map) return;

		const viewport = map.getViewport();

		contextMenuHandler = (e: Event) => {
			handleContextMenu(e as MouseEvent);
		};

		viewport.addEventListener('contextmenu', contextMenuHandler);
	}

	function cleanupContextMenu() {
		if (contextMenuHandler) {
			const map = mapStore.getMap();
			if (map) {
				const viewport = map.getViewport();
				viewport.removeEventListener('contextmenu', contextMenuHandler);
			}
			contextMenuHandler = null;
		}
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		const map = mapStore.getMap();
		if (!map) return;

		// Get coordinate at click position
		const pixel = map.getEventPixel(e);
		clickCoordinate = map.getCoordinateFromPixel(pixel);

		// Position menu at click location
		position = { x: e.clientX, y: e.clientY };
		visible = true;
		showSubmenu = null;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.context-menu')) {
			visible = false;
			showSubmenu = null;
		}
	}

	function closeMenu() {
		visible = false;
		showSubmenu = null;
	}

	async function copyToClipboard(text: string, type: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = type;
			setTimeout(() => {
				copyFeedback = null;
			}, 1500);
			closeMenu();
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function handleSubmenuEnter(submenu: string) {
		if (submenuTimer) clearTimeout(submenuTimer);
		submenuTimer = setTimeout(() => {
			showSubmenu = submenu;
		}, 300);
	}

	function handleSubmenuLeave() {
		if (submenuTimer) clearTimeout(submenuTimer);
		submenuTimer = setTimeout(() => {
			showSubmenu = null;
		}, 200);
	}

	function openExternalLink(link: typeof externalLinks[0]) {
		const url = link.getUrl();
		if (url && url !== '#') {
			window.open(url, '_blank');
		}
		closeMenu();
	}
</script>

{#if visible}
	<div
		class="context-menu"
		style="left: {position.x}px; top: {position.y}px;"
		role="menu"
	>
		<!-- Coordinates item with submenu -->
		<div
			class="menu-item has-submenu"
			role="none"
			onmouseenter={() => handleSubmenuEnter('coords')}
			onmouseleave={handleSubmenuLeave}
		>
			<button
				class="menu-button"
				onclick={() => copyToClipboard(wgs84Formatted, 'wgs84')}
			>
				<span class="coords-label">WGS84</span>
				<span class="coords-value">{wgs84Formatted}</span>
				<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
				</svg>
			</button>

			{#if showSubmenu === 'coords'}
				<div class="submenu" role="none" onmouseenter={() => handleSubmenuEnter('coords')} onmouseleave={handleSubmenuLeave}>
					<button
						class="menu-button"
						onclick={() => copyToClipboard(utmFormatted, 'utm')}
					>
						<span class="coords-label">EPSG:25832</span>
						<span class="coords-value">{utmFormatted}</span>
						<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<div class="menu-divider"></div>

		<!-- Gehe zu submenu -->
		<div
			class="menu-item has-submenu"
			role="none"
			onmouseenter={() => handleSubmenuEnter('goto')}
			onmouseleave={handleSubmenuLeave}
		>
			<button class="menu-button goto-button">
				<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
					<polyline points="15 3 21 3 21 9"></polyline>
					<line x1="10" y1="14" x2="21" y2="3"></line>
				</svg>
				<span>Gehe zu</span>
				<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>

			{#if showSubmenu === 'goto'}
				<div class="submenu goto-submenu" role="none" onmouseenter={() => handleSubmenuEnter('goto')} onmouseleave={handleSubmenuLeave}>
					{#each externalLinks as link}
						<button
							class="menu-button"
							onclick={() => openExternalLink(link)}
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
	</div>
{/if}

<!-- Copy feedback toast -->
{#if copyFeedback}
	<div class="copy-toast">
		Koordinaten kopiert ({copyFeedback === 'wgs84' ? 'WGS84' : 'EPSG:25832'})
	</div>
{/if}

<style>
	.context-menu {
		position: fixed;
		z-index: 1000;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
		min-width: 200px;
		padding: 4px 0;
		font-size: 14px;
	}

	.menu-item {
		position: relative;
	}

	.menu-button {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: #333;
		transition: background-color 0.1s;
	}

	.menu-button:hover {
		background-color: #f0f0f0;
	}

	.coords-label {
		font-weight: 500;
		min-width: 80px;
		color: #666;
		font-size: 12px;
	}

	.coords-value {
		flex: 1;
		font-family: monospace;
		font-size: 13px;
	}

	.copy-icon {
		width: 16px;
		height: 16px;
		opacity: 0.5;
		flex-shrink: 0;
	}

	.menu-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.arrow-icon {
		width: 16px;
		height: 16px;
		margin-left: auto;
		opacity: 0.5;
	}

	.external-icon {
		width: 14px;
		height: 14px;
		opacity: 0.4;
		margin-left: auto;
	}

	.menu-divider {
		height: 1px;
		background: #e0e0e0;
		margin: 4px 0;
	}

	.submenu {
		position: absolute;
		left: 100%;
		top: 0;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
		min-width: 180px;
		padding: 4px 0;
		margin-left: 4px;
	}

	.goto-submenu {
		min-width: 160px;
	}

	.copy-toast {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: #333;
		color: white;
		padding: 10px 20px;
		border-radius: 6px;
		font-size: 14px;
		z-index: 1001;
		animation: fadeInOut 1.5s ease-in-out;
	}

	@keyframes fadeInOut {
		0% {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		15% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		85% {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
	}
</style>
