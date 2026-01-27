<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { configStore, layerStore, componentsConfig } from '$lib/stores';
	import { initializeLayers } from '$lib/layers';
	import { Map } from '$lib/components/map';
	import { Layerswitcher } from '$lib/components/layerswitcher';
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
		SearchBox 
	} from '$lib/components/controls';

	// Get config ID from route parameter
	let configId = $derived($page.params.config || 'default');

	// Reactive config loading
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let initialized = $state(false);

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
				layerStore.initialize(backgrounds, overlays);
				initialized = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load configuration';
		} finally {
			isLoading = false;
		}
	});

	// Check which components are enabled
	let showLayerswitcher = $derived($componentsConfig?.layerswitcher !== false);
	let showScaleLine = $derived($componentsConfig?.scale !== false);
	let showGeolocation = $derived($componentsConfig?.geolocation !== false);
	let showOverviewMap = $derived($componentsConfig?.overviewmap !== false);
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
		<Map />
		<UrlSync />
		<ContextMenu />
		<SearchBox />
		<ZoomControls />
		<HomeButton />
		{#if showGeolocation}
			<Geolocation />
		{/if}
		<GotoButton />
		<MeasureButton />
		<SaveSettings />
		{#if showScaleLine}
			<ScaleLine />
		{/if}
		{#if showOverviewMap}
			<OverviewMap />
		{/if}
		<Attribution />
		{#if showLayerswitcher}
			<Layerswitcher />
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
		width: 100%;
		height: 100%;
		position: relative;
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
