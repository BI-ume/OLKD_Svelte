<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { configStore, layerStore, componentsConfig, metadataPopupStore, metadataPopupIsOpen, metadataPopupUrl, metadataPopupTitle } from '$lib/stores';
	import { sidebarStore, sidebarIsOpen } from '$lib/stores/sidebarStore';
	import { initializeLayers } from '$lib/layers';
	import { applyUrlLayerState, parseUrlGroups } from '$lib/utils/urlParams';
	import { Map } from '$lib/components/map';
	import { Sidebar } from '$lib/components/sidebar';
	import {
		ZoomControls,
		ScaleLine,
		Attribution,
		Geolocation,
		HomeButton,
		OverviewMap,
		UrlSync,
		ContextMenu,
		GotoButton,
		MeasureButton,
		SaveSettings,
		SearchBox,
		PrintPreview,
		DrawLayer,
		DrawStylePopup,
		FeatureInfo
	} from '$lib/components/controls';
	import MetadataPopup from '$lib/components/sidebar/MetadataPopup.svelte';

	// Get config ID from route parameter
	let configId = $derived($page.params.config || 'default');

	// Reactive config loading
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let initialized = $state(false);
	let urlMapState = $state<{ zoom: number; x: number; y: number } | null>(null);

	onMount(async () => {
		try {
			isLoading = true;
			error = null;

			// Load configuration from Flask API
			await configStore.load(configId);

			const state = configStore.getState();

			if (state.error) {
				error = state.error;
				return;
			}

			if (state.layers) {
				// Initialize layers from configuration
				const { backgrounds, overlays } = initializeLayers(state.layers);

				// In 'full' URL mode, only load the groups listed in the URL.
				// This way config groups absent from the URL are never registered.
				const urlGroupFilter = parseUrlGroups();
				const filteredOverlays = urlGroupFilter
					? overlays.filter((g) => urlGroupFilter.includes(g.name))
					: overlays;

				layerStore.initialize(backgrounds, filteredOverlays);

				// Apply layer state from URL before components render
				// (map position is deferred until the OL map exists)
				urlMapState = applyUrlLayerState();

				initialized = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load configuration';
		} finally {
			isLoading = false;
		}
	});

	// Check which components are enabled (default to true unless explicitly disabled)
	let showSearch = $derived($componentsConfig?.search !== false);
	let showZoomControls = $derived($componentsConfig?.zoomControls !== false);
	let showHomeButton = $derived($componentsConfig?.homeButton !== false);
	let showGeolocation = $derived($componentsConfig?.geolocation !== false);
	let showGotoButton = $derived($componentsConfig?.gotoButton !== false);
	let showMeasure = $derived($componentsConfig?.measure !== false);
	let showSaveSettings = $derived($componentsConfig?.saveSettings !== false);
	let showScaleLine = $derived($componentsConfig?.scaleLine !== false);
	let showOverviewMap = $derived($componentsConfig?.overviewmap !== false);
	let showSidebar = $derived($componentsConfig?.sidebar !== false);
	let showDraw = $derived($componentsConfig?.draw !== false);
</script>

<div class="map-app">
	{#if isLoading}
		<div class="loading">
			<div class="loading-spinner"></div>
			<p>Karte wird geladen...</p>
		</div>
	{:else if error}
		<div class="error">
			<h2>Fehler beim Laden</h2>
			<p>{error}</p>
			<button onclick={() => window.location.reload()}>Erneut versuchen</button>
		</div>
	{:else if initialized}
		<div class="map-area">
			<Map />
			{#if showSidebar}
				<button
					class="sidebar-toggle"
					class:sidebar-open={$sidebarIsOpen}
					onclick={() => sidebarStore.toggle()}
					title={$sidebarIsOpen ? 'Menü schließen' : 'Menü öffnen'}
					aria-label={$sidebarIsOpen ? 'Menü schließen' : 'Menü öffnen'}
					aria-expanded={$sidebarIsOpen}
				>
					{#if $sidebarIsOpen}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="3" y1="12" x2="21" y2="12"></line>
							<line x1="3" y1="6" x2="21" y2="6"></line>
							<line x1="3" y1="18" x2="21" y2="18"></line>
						</svg>
					{/if}
				</button>
			{/if}
			<UrlSync initialMapState={urlMapState} />
			<ContextMenu />
			{#if showSearch && !showSidebar}
				<SearchBox sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showZoomControls}
				<ZoomControls sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showHomeButton}
				<HomeButton sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showGeolocation}
				<Geolocation sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showGotoButton}
				<GotoButton sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showMeasure}
				<MeasureButton sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showSaveSettings}
				<SaveSettings sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showScaleLine}
				<ScaleLine sidebarOpen={$sidebarIsOpen} />
			{/if}
			{#if showOverviewMap}
				<OverviewMap sidebarOpen={$sidebarIsOpen} />
			{/if}
			<Attribution />
			<PrintPreview />
			<FeatureInfo />
			{#if showDraw}
				<DrawLayer />
				<DrawStylePopup />
			{/if}
			{#if $metadataPopupIsOpen}
				<MetadataPopup
					url={$metadataPopupUrl}
					title={$metadataPopupTitle}
					onClose={() => metadataPopupStore.close()}
				/>
			{/if}
		</div>
		{#if showSidebar}
			<Sidebar />
		{/if}
	{:else}
		<div class="error">
			<h2>Keine Konfiguration</h2>
			<p>Es konnte keine Kartenkonfiguration geladen werden.</p>
		</div>
	{/if}
</div>

<style>
	.map-app {
		--sidebar-width: 320px;
		width: 100%;
		height: 100%;
		position: relative;
	}

	.map-area {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.sidebar-toggle {
		position: absolute;
		top: 10px;
		left: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: none;
		border-radius: 0 12px 12px 0;
		cursor: pointer;
		color: #333;
		z-index: 10;
		box-shadow: 4px 2px 3px rgba(0, 0, 0, 0.2);
		transition: left 0.3s ease, background-color 0.15s;
	}

	.sidebar-toggle.sidebar-open {
		left: calc(var(--sidebar-width) - 10px);
	}

	.sidebar-toggle:hover {
		background: #f0f0f0;
	}

	.sidebar-toggle svg {
		width: 18px;
		height: 18px;
	}

	.loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		color: #666;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto 16px;
		border: 3px solid #e0e0e0;
		border-top-color: #2196f3;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading p {
		margin: 0;
		font-size: 14px;
	}

	.error {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		padding: 32px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		max-width: 400px;
	}

	.error h2 {
		margin: 0 0 8px;
		font-size: 18px;
		color: #d32f2f;
	}

	.error p {
		margin: 0 0 16px;
		color: #666;
		font-size: 14px;
	}

	.error button {
		padding: 8px 16px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.15s;
	}

	.error button:hover {
		background: #1976d2;
	}
</style>
