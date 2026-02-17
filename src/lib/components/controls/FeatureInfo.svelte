<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { layerStore } from '$lib/stores/layerStore';
	import { sidebarShowDraw, sidebarShowPrint } from "$lib/stores/sidebarStore";
	import { measureActive } from '$lib/stores/measureStore';
	import { catalogStore } from '$lib/stores/catalogStore';
	import { configStore } from '$lib/stores/configStore';
	import { TiledWMS } from '$lib/layers/TiledWMS';
	import { SingleTileWMS } from '$lib/layers/SingleTileWMS';
	import { WMSGetFeatureInfo } from 'ol/format';
	import { Vector as VectorSource } from 'ol/source';
	import { Vector as VectorLayer } from 'ol/layer';
	import { Fill, Stroke, Style } from 'ol/style';
	import Overlay from 'ol/Overlay';
	import type { Map, MapBrowserEvent } from 'ol';
	import type { Coordinate } from 'ol/coordinate';
	import type { Layer } from '$lib/layers/Layer';
	import type { FeatureInfoConfig } from '$lib/layers/types';
	import type { EventsKey } from 'ol/events';
	import { unByKey } from 'ol/Observable';

	let map: Map | null = null;
	let overlay: Overlay | null = null;
	let popupEl: HTMLDivElement;
	let popupContentEl: HTMLDivElement;
	let gmlLayer: VectorLayer<VectorSource> | null = null;
	let gmlSource: VectorSource | null = null;
	let clickKey: EventsKey | null = null;
	let isLoading = $state(false);
	let hasContent = $state(false);

	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready) {
				initFeatureInfo();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		cleanup();
	});

	function initFeatureInfo() {
		map = mapStore.getMap();
		if (!map) return;

		// Create GML highlight layer
		gmlSource = new VectorSource();
		gmlLayer = new VectorLayer({
			source: gmlSource,
			style: new Style({
				stroke: new Stroke({ color: 'rgba(255, 0, 0, 0.8)', width: 2 }),
				fill: new Fill({ color: 'rgba(255, 0, 0, 0.1)' })
			}),
			zIndex: 2001
		});
		map.addLayer(gmlLayer);

		// Create overlay (will be positioned on click)
		overlay = new Overlay({
			element: popupEl,
			autoPan: false,
			positioning: 'bottom-center',
			offset: [0, -12]
		});
		map.addOverlay(overlay);

		// Register click handler
		clickKey = map.on('singleclick', (evt) => handleClick(evt as MapBrowserEvent<PointerEvent>));
	}

	function cleanup() {
		if (map) {
			if (clickKey) {
				unByKey(clickKey);
				clickKey = null;
			}
			if (overlay) {
				map.removeOverlay(overlay);
				overlay = null;
			}
			if (gmlLayer) {
				map.removeLayer(gmlLayer);
				gmlLayer = null;
			}
		}
		gmlSource = null;
	}

	function closePopup() {
		if (overlay) {
			overlay.setPosition(undefined);
		}
		if (gmlSource) {
			gmlSource.clear();
		}
		hasContent = false;
		isLoading = false;
		if (popupContentEl) {
			popupContentEl.innerHTML = '';
		}
	}

	async function handleClick(evt: MapBrowserEvent<PointerEvent>) {
		// Don't fire when draw, print or measure is active
		if (get(sidebarShowDraw)) return;
		if (get(sidebarShowPrint)) return;
		if (get(measureActive)) return;

		if (!map) return;
		const view = map.getView();
		const coordinate = evt.coordinate;
		const resolution = view.getResolution();
		const projection = view.getProjection().getCode();

		if (!resolution) return;

		// Get all visible WMS layers with featureinfo config
		const allLayers = layerStore.getAllLayers();
		const feInfoLayers = allLayers.filter((layer): layer is Layer & { featureinfo: FeatureInfoConfig } => {
			if (!layer.visible) return false;
			if (!layer.featureinfo) return false;
			if (!(layer instanceof TiledWMS) && !(layer instanceof SingleTileWMS)) return false;
			return true;
		});

		if (feInfoLayers.length === 0) return;

		// Split into HTML and GML layers
		const htmlLayers = feInfoLayers.filter(l => l.featureinfo.catalog !== true && l.featureinfo.gml !== true);
		const gmlLayers = feInfoLayers.filter(l => l.featureinfo.gml === true);

		// Close previous popup, clear GML highlights
		closePopup();

		// Show loading state at click position
		isLoading = true;
		hasContent = true;
		overlay?.setPosition(coordinate);

		try {
			// Fire all HTML requests in parallel
			const htmlResults = await Promise.all(
				htmlLayers.map(layer => fetchHtmlFeatureInfo(layer, coordinate, resolution, projection))
			);

			// Fire all GML requests in parallel
			const gmlResults = await Promise.all(
				gmlLayers.map(layer => fetchGmlFeatureInfo(layer, coordinate, resolution, projection))
			);

			isLoading = false;

			let hasResults = false;
			popupContentEl.innerHTML = '';

			// Process HTML results
			for (const result of htmlResults) {
				if (!result) continue;

				if (result.target === '_blank') {
					window.open(result.url, '_blank');
					continue;
				}

				// _popup or default: create iframe that auto-sizes to content
				hasResults = true;
				const iframe = document.createElement('iframe');
				iframe.sandbox.add('allow-same-origin', 'allow-scripts');
				iframe.style.border = 'none';
				iframe.style.width = '330px';
				iframe.style.height = '0';
				iframe.style.display = 'block';
				iframe.srcdoc = result.response;

				iframe.addEventListener('load', () => {
					try {
						const doc = iframe.contentDocument;
						if (doc) {
							doc.documentElement.style.overflowX = 'hidden';
							const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
							const w = doc.documentElement.scrollWidth || doc.body.scrollWidth;
							iframe.style.height = Math.min(h + 2, 500) + 'px';
							iframe.style.width = Math.max(w + 2, 330) + 'px';
						}
					} catch {
						// Fallback if content access fails
						iframe.style.height = '377px';
					}
				});

				popupContentEl.appendChild(iframe);
			}

			// Process GML results
			const catalogNames: string[] = [];
			let hasCatalog = false;

			for (const result of gmlResults) {
				if (!result || result.features.length === 0) continue;

				// Add features to GML highlight layer
				if (gmlSource) {
					const features = result.features;
					if (result.style) {
						const gmlStyle = new Style({
							stroke: new Stroke({
								color: result.style.strokeColor || 'rgba(255, 0, 0, 0.8)',
								width: result.style.strokeWidth || 2
							}),
							fill: new Fill({
								color: result.style.fillColor || 'rgba(255, 0, 0, 0.1)'
							})
						});
						features.forEach(f => f.setStyle(gmlStyle));
					}
					gmlSource.addFeatures(features);
				}

				if (result.catalog) {
					hasCatalog = true;
					for (const feature of result.features) {
						const name = result.useGroup
							? feature.get('group_name')
							: feature.get('layer');
						if (name && !catalogNames.includes(name)) {
							catalogNames.push(name);
						}
					}
				}
			}

			// If catalog mode, resolve names to titles
			if (hasCatalog && catalogNames.length > 0) {
				const catalogContent = await resolveCatalogNames(catalogNames);
				if (catalogContent) {
					hasResults = true;
					const div = document.createElement('div');
					div.innerHTML = catalogContent;
					popupContentEl.appendChild(div);
					bindCatalogLinks();
				}
			}

			if (!hasResults) {
				closePopup();
			}
		} catch (err) {
			console.error('FeatureInfo error:', err);
			isLoading = false;
			closePopup();
		}
	}

	interface HtmlResult {
		target: string;
		width: number;
		height: number;
		url: string;
		response: string;
	}

	async function fetchHtmlFeatureInfo(
		layer: Layer & { featureinfo: FeatureInfoConfig },
		coordinate: Coordinate,
		resolution: number,
		projection: string
	): Promise<HtmlResult | null> {
		const fi = layer.featureinfo;
		const params: Record<string, string> = {
			INFO_FORMAT: 'text/html'
		};
		if (fi.featureCount !== undefined) {
			params.FEATURE_COUNT = String(fi.featureCount);
		}

		const wmsLayer = layer as TiledWMS | SingleTileWMS;
		const url = wmsLayer.getFeatureInfoUrl(coordinate, resolution, projection, params);
		if (!url) return null;

		// For _blank target, just return the URL without fetching
		if (fi.target === '_blank') {
			return { target: '_blank', width: 0, height: 0, url, response: '' };
		}

		try {
			const resp = await fetch(url);
			const text = await resp.text();

			// Skip empty responses
			if (!text || text.trim() === '') return null;
			// Skip XML responses (some WMS return XML errors)
			if (text.trimStart().startsWith('<?xml')) return null;
			// Skip empty body (ArcGIS quirk)
			if (text.includes('<body></body>') || text.includes('<body />')) return null;

			return {
				target: fi.target || '_popup',
				width: fi.width || 300,
				height: fi.height || 150,
				url,
				response: text
			};
		} catch {
			return null;
		}
	}

	interface GmlResult {
		features: import('ol/Feature').default[];
		style?: { strokeWidth?: number; strokeColor?: string; fillColor?: string };
		catalog: boolean;
		useGroup: boolean;
	}

	async function fetchGmlFeatureInfo(
		layer: Layer & { featureinfo: FeatureInfoConfig },
		coordinate: Coordinate,
		resolution: number,
		projection: string
	): Promise<GmlResult | null> {
		const fi = layer.featureinfo;
		const params: Record<string, string> = {
			INFO_FORMAT: 'application/vnd.ogc.gml'
		};
		if (fi.featureCount !== undefined) {
			params.FEATURE_COUNT = String(fi.featureCount);
		}

		const wmsLayer = layer as TiledWMS | SingleTileWMS;
		const url = wmsLayer.getFeatureInfoUrl(coordinate, resolution, projection, params);
		if (!url) return null;

		try {
			const resp = await fetch(url);
			const text = await resp.text();
			if (!text || text.trim() === '') return null;

			const format = new WMSGetFeatureInfo();
			const features = format.readFeatures(text);

			return {
				features,
				style: fi.gmlStyle,
				catalog: fi.catalog === true,
				useGroup: fi.gmlGroup === true
			};
		} catch {
			return null;
		}
	}

	async function resolveCatalogNames(names: string[]): Promise<string> {
		const configState = configStore.getState();
		const configId = configState.configId || 'default';

		try {
			const resp = await fetch(
				`/api/v1/app/${configId}/catalog/names?names=${encodeURIComponent(names.join(','))}`
			);
			if (!resp.ok) return '';

			const data = await resp.json();
			const parts: string[] = [];

			if (data.groups && data.groups.length > 0) {
				for (const group of data.groups) {
					parts.push(
						`<a href="#" class="featureinfo-catalog-link" data-group-name="${escapeAttr(group.name)}">${escapeHtml(group.title)}</a>`
					);
				}
			}

			if (data.layers && data.layers.length > 0) {
				for (const layer of data.layers) {
					parts.push(
						`<a href="#" class="featureinfo-layer-link" data-layer-name="${escapeAttr(layer.name)}">${escapeHtml(layer.title)}</a>`
					);
				}
			}

			if (parts.length === 0) return '';
			return '<div class="featureinfo-catalog">' + parts.join('<br>') + '</div>';
		} catch {
			return '';
		}
	}

	function bindCatalogLinks() {
		if (!popupContentEl) return;

		popupContentEl.querySelectorAll('.featureinfo-catalog-link').forEach(el => {
			el.addEventListener('click', (e) => {
				e.preventDefault();
				const groupName = (el as HTMLElement).dataset.groupName;
				if (groupName) {
					catalogStore.toggleItem(groupName);
					closePopup();
				}
			});
		});

		popupContentEl.querySelectorAll('.featureinfo-layer-link').forEach(el => {
			el.addEventListener('click', (e) => {
				e.preventDefault();
				const layerName = (el as HTMLElement).dataset.layerName;
				if (layerName) {
					layerStore.setLayerVisibility(layerName, true);
					closePopup();
				}
			});
		});
	}

	function escapeSrcdoc(str: string): string {
		// Only escape quotes and ampersands for the HTML attribute value;
		// the HTML content itself must remain intact for the iframe to render it.
		return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
	}

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function escapeAttr(str: string): string {
		return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
</script>

<div class="featureinfo-popup" bind:this={popupEl} class:visible={hasContent}>
	<button class="featureinfo-close" onclick={closePopup} title="Schließen">&times;</button>
	{#if isLoading}
		<div class="featureinfo-loading">
			<div class="featureinfo-spinner"></div>
		</div>
	{/if}
	<div class="featureinfo-content" bind:this={popupContentEl}></div>
	<div class="featureinfo-pointer"></div>
</div>

<style>
	.featureinfo-popup {
		display: none;
		position: relative;
		background: white;
		border-radius: 6px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
		min-width: 120px;
		max-width: 750px;
	}

	.featureinfo-popup.visible {
		display: block;
	}

	.featureinfo-close {
		position: absolute;
		top: 2px;
		right: 4px;
		background: none;
		border: none;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		color: #666;
		padding: 2px 6px;
		z-index: 1;
	}

	.featureinfo-close:hover {
		color: #333;
	}

	.featureinfo-content {
		padding: 8px;
		overflow: auto;
	}

	.featureinfo-loading {
		padding: 16px 32px;
		display: flex;
		justify-content: center;
	}

	.featureinfo-spinner {
		width: 24px;
		height: 24px;
		border: 3px solid #e0e0e0;
		border-top-color: #2196f3;
		border-radius: 50%;
		animation: featureinfo-spin 0.8s linear infinite;
	}

	@keyframes featureinfo-spin {
		to { transform: rotate(360deg); }
	}

	.featureinfo-pointer {
		position: absolute;
		bottom: -8px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid white;
	}

	/* Catalog link styles */
	:global(.featureinfo-catalog) {
		padding: 4px 0;
	}

	:global(.featureinfo-catalog a) {
		color: #337ab7;
		text-decoration: none;
		cursor: pointer;
		font-size: 13px;
	}

	:global(.featureinfo-catalog a:hover) {
		text-decoration: underline;
	}
</style>
