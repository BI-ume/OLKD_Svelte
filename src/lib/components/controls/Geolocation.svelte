<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Geolocation as OLGeolocation } from 'ol';
	import { Vector as VectorLayer } from 'ol/layer';
	import { Vector as VectorSource } from 'ol/source';
	import { Feature } from 'ol';
	import { Point } from 'ol/geom';
	import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { configStore } from '$lib/stores/configStore';

	// Props with defaults
	interface Props {
		zoom?: number;
		highlightTimeout?: number; // ms, 0 = no auto-remove
	}

	let { zoom = 14, highlightTimeout = 5000 }: Props = $props();

	let isLocating = $state(false);
	let hasError = $state(false);
	let errorMessage = $state('');

	let geolocation: OLGeolocation | null = null;
	let vectorLayer: VectorLayer<VectorSource> | null = null;
	let vectorSource: VectorSource | null = null;
	let highlightTimer: ReturnType<typeof setTimeout> | null = null;

	// Get geolocation config from app config
	let geolocationConfig = $derived($configStore.app?.geolocationConfig ?? {});
	let configuredZoom = $derived(geolocationConfig.zoom ?? zoom);
	let strokeColor = $derived(geolocationConfig.style?.strokeColor ?? '#E2001A');

	// Create styles for position marker and accuracy circle
	function createStyles() {
		return {
			accuracy: new Style({
				fill: new Fill({
					color: 'rgba(226, 0, 26, 0.1)'
				}),
				stroke: new Stroke({
					color: strokeColor,
					width: 2
				})
			}),
			position: new Style({
				image: new CircleStyle({
					radius: 8,
					fill: new Fill({
						color: strokeColor
					}),
					stroke: new Stroke({
						color: 'white',
						width: 2
					})
				})
			})
		};
	}

	function initGeolocation() {
		const map = mapStore.getMap();
		const view = mapStore.getView();
		if (!map || !view) return;

		// Create vector layer for position display
		vectorSource = new VectorSource();
		vectorLayer = new VectorLayer({
			source: vectorSource,
			style: (feature) => {
				const styles = createStyles();
				const geometry = feature.getGeometry();
				if (geometry?.getType() === 'Point') {
					return styles.position;
				}
				return styles.accuracy;
			}
		});
		vectorLayer.set('name', 'geolocation');
		vectorLayer.set('displayInLayerswitcher', false);
		map.addLayer(vectorLayer);

		// Create geolocation instance
		geolocation = new OLGeolocation({
			projection: view.getProjection(),
			trackingOptions: {
				enableHighAccuracy: true,
				maximumAge: 0
			}
		});

		// Listen for position changes
		geolocation.on('change:accuracyGeometry', handlePositionChange);
		geolocation.on('error', handleError);
	}

	function handlePositionChange() {
		if (!geolocation || !vectorSource) return;

		const position = geolocation.getPosition();
		const accuracyGeometry = geolocation.getAccuracyGeometry();

		if (!position) return;

		// Stop tracking
		geolocation.setTracking(false);
		isLocating = false;
		hasError = false;

		// Check if position is within map extent
		const map = mapStore.getMap();
		const view = mapStore.getView();
		if (!map || !view) return;

		const maxExtent = view.getProjection().getExtent();
		if (maxExtent && !maxExtent.every((v) => v === Infinity || v === -Infinity)) {
			const [minX, minY, maxX, maxY] = maxExtent;
			if (position[0] < minX || position[0] > maxX || position[1] < minY || position[1] > maxY) {
				hasError = true;
				errorMessage = 'Position außerhalb des Kartenbereichs';
				return;
			}
		}

		// Clear previous features
		vectorSource.clear();

		// Add accuracy circle
		if (accuracyGeometry) {
			vectorSource.addFeature(new Feature(accuracyGeometry));
		}

		// Add position point
		vectorSource.addFeature(new Feature(new Point(position)));

		// Fit view to accuracy extent or zoom to position
		if (accuracyGeometry) {
			view.fit(accuracyGeometry.getExtent(), {
				size: map.getSize(),
				padding: [50, 50, 50, 50],
				duration: 500,
				maxZoom: configuredZoom
			});
		} else {
			mapStore.animateTo(position, configuredZoom, 500);
		}

		// Set auto-remove timer
		if (highlightTimeout > 0) {
			if (highlightTimer) clearTimeout(highlightTimer);
			highlightTimer = setTimeout(() => {
				clearPosition();
			}, highlightTimeout);
		}
	}

	function handleError(error: any) {
		isLocating = false;
		hasError = true;

		switch (error.code) {
			case 1: // PERMISSION_DENIED
				errorMessage = 'Standortzugriff verweigert';
				break;
			case 2: // POSITION_UNAVAILABLE
				errorMessage = 'Standort nicht verfügbar';
				break;
			case 3: // TIMEOUT
				errorMessage = 'Standortabfrage Zeitüberschreitung';
				break;
			default:
				errorMessage = 'Standort konnte nicht ermittelt werden';
		}

		// Clear error after 3 seconds
		setTimeout(() => {
			hasError = false;
			errorMessage = '';
		}, 3000);
	}

	function locate() {
		if (isLocating) return;

		// Initialize on first use
		if (!geolocation) {
			initGeolocation();
		}

		if (!geolocation) return;

		isLocating = true;
		hasError = false;
		geolocation.setTracking(true);
	}

	function clearPosition() {
		if (vectorSource) {
			vectorSource.clear();
		}
		if (highlightTimer) {
			clearTimeout(highlightTimer);
			highlightTimer = null;
		}
	}

	onDestroy(() => {
		clearPosition();

		if (geolocation) {
			geolocation.setTracking(false);
			geolocation = null;
		}

		if (vectorLayer) {
			const map = mapStore.getMap();
			if (map) {
				map.removeLayer(vectorLayer);
			}
			vectorLayer = null;
		}
	});
</script>

<div class="geolocation">
	<button
		class="geolocation-btn"
		class:locating={isLocating}
		class:error={hasError}
		onclick={locate}
		disabled={isLocating}
		title={hasError ? errorMessage : 'Meinen Standort anzeigen'}
		aria-label="Meinen Standort anzeigen"
	>
		{#if isLocating}
			<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"></circle>
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3"></circle>
				<path d="M12 2v4m0 12v4m10-10h-4M6 12H2"></path>
			</svg>
		{/if}
	</button>
</div>

<style>
	.geolocation {
		position: absolute;
		top: 128px;
		left: 10px;
		z-index: 100;
	}

	.geolocation-btn {
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

	.geolocation-btn:hover:not(:disabled) {
		background: #f0f0f0;
	}

	.geolocation-btn:disabled {
		cursor: wait;
	}

	.geolocation-btn.locating {
		color: #1976d2;
	}

	.geolocation-btn.error {
		color: #d32f2f;
		background: #ffebee;
	}

	.geolocation-btn svg {
		width: 20px;
		height: 20px;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
