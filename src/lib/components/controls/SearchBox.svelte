<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { searchStore, parseWKT, type SearchResult } from '$lib/stores/searchStore';
	import { Vector as VectorSource } from 'ol/source';
	import { Vector as VectorLayer } from 'ol/layer';
	import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
	import type { Map } from 'ol';
	import type { Geometry } from 'ol/geom';
	import Point from 'ol/geom/Point';

	let inputElement: HTMLInputElement;
	let isOpen = $state(false);
	let highlightedIndex = $state(-1);

	let map: Map | null = null;
	let resultSource: VectorSource | null = null;
	let resultLayer: VectorLayer<VectorSource> | null = null;

	// Zoom level for search results (Web Mercator compatible)
	const ZOOM_LEVEL = 19;

	// Style for search result geometry
	const resultStyle = new Style({
		fill: new Fill({
			color: 'rgba(226, 0, 26, 0.2)'
		}),
		stroke: new Stroke({
			color: '#E2001A',
			width: 3
		}),
		image: new CircleStyle({
			radius: 8,
			fill: new Fill({ color: '#E2001A' }),
			stroke: new Stroke({ color: 'white', width: 2 })
		})
	});

	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready) {
				initResultLayer();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		cleanup();
	});

	function initResultLayer() {
		map = mapStore.getMap();
		if (!map) return;

		resultSource = new VectorSource();
		resultLayer = new VectorLayer({
			source: resultSource,
			style: resultStyle,
			zIndex: 1000
		});
		map.addLayer(resultLayer);

		// Click on result geometry to remove it
		map.on('singleclick', (e) => {
			if (!map || !resultSource) return;

			const features = map.getFeaturesAtPixel(e.pixel, {
				layerFilter: (layer) => layer === resultLayer
			});

			if (features && features.length > 0) {
				resultSource.clear();
				searchStore.clearSelection();
			}
		});
	}

	function cleanup() {
		if (map && resultLayer) {
			map.removeLayer(resultLayer);
		}
		resultSource = null;
		resultLayer = null;
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchStore.search(target.value);
		isOpen = true;
		highlightedIndex = -1;
	}

	function handleFocus() {
		if ($searchStore.results.length > 0) {
			isOpen = true;
		}
	}

	function handleBlur(e: FocusEvent) {
		// Delay closing to allow click on result
		const relatedTarget = e.relatedTarget as HTMLElement;
		if (relatedTarget?.closest('.search-results')) {
			return;
		}
		setTimeout(() => {
			isOpen = false;
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen || $searchStore.results.length === 0) {
			if (e.key === 'Escape') {
				inputElement?.blur();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, $searchStore.results.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, -1);
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0) {
					selectResult($searchStore.results[highlightedIndex]);
				} else if ($searchStore.results.length > 0) {
					// Select best match or first result
					const bestMatch = $searchStore.results.find((r) => r.sml === 1);
					selectResult(bestMatch || $searchStore.results[0]);
				}
				break;
			case 'Escape':
				isOpen = false;
				inputElement?.blur();
				break;
		}
	}

	function selectResult(result: SearchResult) {
		if (!map || !resultSource) return;

		// Parse WKT geometry
		const feature = parseWKT(result.geom, result.projectionCode, 'EPSG:25832');
		if (!feature) return;

		// Clear previous result
		resultSource.clear();

		// Add new result geometry
		resultSource.addFeature(feature);

		// Zoom to feature
		const geometry = feature.getGeometry();
		if (geometry) {
			const view = map.getView();
			const extent = geometry.getExtent();

			// For point geometries, center and zoom to fixed level
			// For other geometries, fit to extent with max zoom limit
			if (geometry instanceof Point) {
				view.animate({
					center: geometry.getCoordinates(),
					zoom: ZOOM_LEVEL,
					duration: 500
				});
			} else {
				view.fit(extent, {
					duration: 500,
					padding: [50, 50, 50, 50],
					maxZoom: ZOOM_LEVEL
				});
			}
		}

		// Update store and UI
		searchStore.selectResult(result);
		searchStore.search(result.label); // Update input with selected label
		isOpen = false;
		highlightedIndex = -1;
	}

	function clearSearch() {
		searchStore.reset();
		resultSource?.clear();
		inputElement?.focus();
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.search-box')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="search-box">
	<div class="search-input-wrapper">
		<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="11" cy="11" r="8"></circle>
			<path d="M21 21l-4.35-4.35"></path>
		</svg>
		<input
			bind:this={inputElement}
			type="text"
			class="search-input"
			placeholder="Adresse suchen..."
			value={$searchStore.query}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			role="combobox"
			aria-label="Adresse suchen"
			aria-expanded={isOpen && $searchStore.results.length > 0}
			aria-controls="search-results"
			aria-autocomplete="list"
		/>
		{#if $searchStore.isLoading}
			<div class="search-spinner"></div>
		{:else if $searchStore.query.length > 0}
			<button
				class="clear-btn"
				onclick={clearSearch}
				title="Suche löschen"
				aria-label="Suche löschen"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		{/if}
	</div>

	{#if isOpen && $searchStore.results.length > 0}
		<ul
			id="search-results"
			class="search-results"
			role="listbox"
			aria-label="Suchergebnisse"
		>
			{#each $searchStore.results as result, index}
				<li
					class="search-result-item"
					class:highlighted={index === highlightedIndex}
					class:best-match={result.sml === 1}
					role="option"
					aria-selected={index === highlightedIndex}
					onmousedown={() => selectResult(result)}
					onmouseenter={() => (highlightedIndex = index)}
				>
					<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
						<circle cx="12" cy="10" r="3"></circle>
					</svg>
					<span class="result-label">{result.label}</span>
				</li>
			{/each}
		</ul>
	{:else if isOpen && $searchStore.query.length >= 3 && !$searchStore.isLoading && $searchStore.results.length === 0}
		<div class="search-no-results">Keine Ergebnisse gefunden</div>
	{/if}

	{#if $searchStore.error}
		<div class="search-error">{$searchStore.error}</div>
	{/if}
</div>

<style>
	.search-box {
		position: absolute;
		top: 10px;
		left: 56px;
		z-index: 100;
		width: 300px;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		width: 18px;
		height: 18px;
		color: #666;
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 10px 36px 10px 36px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		background: white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		outline: none;
	}

	.search-input:focus {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.search-input::placeholder {
		color: #999;
	}

	.clear-btn {
		position: absolute;
		right: 6px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
		padding: 0;
	}

	.clear-btn:hover {
		background: #f0f0f0;
		color: #333;
	}

	.clear-btn svg {
		width: 16px;
		height: 16px;
	}

	.search-spinner {
		position: absolute;
		right: 10px;
		width: 18px;
		height: 18px;
		border: 2px solid #e0e0e0;
		border-top-color: #E2001A;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.search-results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		max-height: 300px;
		overflow-y: auto;
		background: white;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		list-style: none;
		margin: 0;
		padding: 4px 0;
	}

	.search-result-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.search-result-item:hover,
	.search-result-item.highlighted {
		background-color: #f5f5f5;
	}

	.search-result-item.best-match {
		font-weight: 500;
	}

	.result-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		color: #E2001A;
	}

	.result-label {
		flex: 1;
		font-size: 14px;
		color: #333;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-no-results,
	.search-error {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		padding: 12px;
		background: white;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-size: 14px;
		color: #666;
		text-align: center;
	}

	.search-error {
		color: #dc3545;
		background: #fff5f5;
	}
</style>
