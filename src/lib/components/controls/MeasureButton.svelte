<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { measureActive } from '$lib/stores/measureStore';
	import { transform } from 'ol/proj';
	import { Draw, Modify } from 'ol/interaction';
	import { Vector as VectorSource } from 'ol/source';
	import { Vector as VectorLayer } from 'ol/layer';
	import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
	import { LineString, Polygon, Point } from 'ol/geom';
	import { getArea, getLength } from 'ol/sphere';
	import Overlay from 'ol/Overlay';
	import type { Map } from 'ol';
	import type { EventsKey } from 'ol/events';
	import { unByKey } from 'ol/Observable';
	import Feature from 'ol/Feature';
	import { Z_INDEX } from '$lib/constants';

	interface Props {
		sidebarOpen?: boolean;
	}

	let { sidebarOpen = false }: Props = $props();

	type MeasureMode = 'none' | 'point' | 'line' | 'area';

	let isOpen = $state(false);
	let activeMode = $state<MeasureMode>('none');
	let measureResult = $state<string>('');

	let map: Map | null = null;
	let measureSource: VectorSource | null = null;
	let measureLayer: VectorLayer<VectorSource> | null = null;
	let segmentSource: VectorSource | null = null;
	let segmentLayer: VectorLayer<VectorSource> | null = null;
	let draw: Draw | null = null;
	let modify: Modify | null = null;
	let measureTooltipElement: HTMLDivElement | null = null;
	let measureTooltip: Overlay | null = null;
	let clickListener: EventsKey | null = null;
	let segmentOverlays: Overlay[] = [];

	const measureStyle = new Style({
		fill: new Fill({
			color: 'rgba(226, 0, 26, 0.2)'
		}),
		stroke: new Stroke({
			color: '#E2001A',
			width: 2
		}),
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: '#E2001A' }),
			stroke: new Stroke({ color: 'white', width: 2 })
		})
	});

	onMount(() => {
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready) {
				initMeasure();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	onDestroy(() => {
		cleanup();
	});

	function initMeasure() {
		map = mapStore.getMap();
		if (!map) return;

		// Create vector source and layer for measurements
		measureSource = new VectorSource();
		measureLayer = new VectorLayer({
			source: measureSource,
			style: measureStyle,
			zIndex: Z_INDEX.MEASURE
		});
		map.addLayer(measureLayer);

		// Create layer for segment labels
		segmentSource = new VectorSource();
		segmentLayer = new VectorLayer({
			source: segmentSource,
			zIndex: Z_INDEX.MEASURE_SEGMENTS
		});
		map.addLayer(segmentLayer);
	}

	function cleanup() {
		deactivateMeasure();
		if (map && measureLayer) {
			map.removeLayer(measureLayer);
		}
		if (map && segmentLayer) {
			map.removeLayer(segmentLayer);
		}
		measureSource = null;
		measureLayer = null;
		segmentSource = null;
		segmentLayer = null;
	}

	function toggle() {
		if (isOpen) {
			// Closing: always deactivate measure mode
			isOpen = false;
			deactivateMeasure();
		} else {
			// Opening
			isOpen = true;
		}
	}

	function selectMode(mode: MeasureMode) {
		if (activeMode === mode) {
			deactivateMeasure();
			return;
		}

		deactivateMeasure();
		activeMode = mode;
		measureActive.set(true);
		isOpen = true; // Keep menu open while measuring

		if (mode === 'point') {
			activatePointMeasure();
		} else if (mode === 'line') {
			activateLineMeasure();
		} else if (mode === 'area') {
			activateAreaMeasure();
		}
	}

	function activatePointMeasure() {
		if (!map) return;

		createMeasureTooltip();

		clickListener = map.on('singleclick', (e) => {
			const coord = e.coordinate;

			// Transform to WGS84
			const wgs84 = transform(coord, 'EPSG:25832', 'EPSG:4326');
			const result = `${wgs84[1].toFixed(5)}°, ${wgs84[0].toFixed(5)}°`;
			measureResult = result;

			if (measureTooltipElement && measureTooltip) {
				measureTooltipElement.innerHTML = `<strong>WGS84:</strong> ${result}<br><small>EPSG:25832: ${coord[1].toFixed(2)}, ${coord[0].toFixed(2)}</small>`;
				measureTooltip.setPosition(coord);
			}

			measureSource?.clear();
			const pointFeature = new Feature(new Point(coord));
			measureSource?.addFeature(pointFeature);
		});
	}

	function activateLineMeasure() {
		if (!map || !measureSource) return;

		createMeasureTooltip();

		draw = new Draw({
			source: measureSource,
			type: 'LineString',
			style: measureStyle
		});

		draw.on('drawstart', (e) => {
			measureSource?.clear();
			clearSegmentLabels();
			const sketch = e.feature;

			sketch.getGeometry()?.on('change', (evt) => {
				const geom = evt.target as LineString;
				const coords = geom.getCoordinates();
				const length = getLength(geom, { projection: 'EPSG:25832' });
				const output = formatLength(length);
				measureResult = output;

				if (measureTooltipElement && measureTooltip) {
					measureTooltipElement.innerHTML = output;
					measureTooltip.setPosition(geom.getLastCoordinate());
				}

				// Update segment labels
				updateSegmentLabels(coords, 'line');
			});
		});

		draw.on('drawend', (e) => {
			if (measureTooltipElement) {
				measureTooltipElement.className = 'measure-tooltip measure-tooltip-static';
			}

			// Finalize segment labels
			const geom = e.feature.getGeometry() as LineString;
			updateSegmentLabels(geom.getCoordinates(), 'line');

			createMeasureTooltip();
		});

		map.addInteraction(draw);

		modify = new Modify({ source: measureSource });
		map.addInteraction(modify);
	}

	function activateAreaMeasure() {
		if (!map || !measureSource) return;

		createMeasureTooltip();

		draw = new Draw({
			source: measureSource,
			type: 'Polygon',
			style: measureStyle
		});

		draw.on('drawstart', (e) => {
			measureSource?.clear();
			clearSegmentLabels();
			const sketch = e.feature;

			sketch.getGeometry()?.on('change', (evt) => {
				const geom = evt.target as Polygon;
				const coords = geom.getCoordinates()[0]; // outer ring
				const area = getArea(geom, { projection: 'EPSG:25832' });
				const circumference = getPolygonCircumference(geom);
				const output = formatAreaWithCircumference(area, circumference);
				measureResult = output;

				if (measureTooltipElement && measureTooltip) {
					measureTooltipElement.innerHTML = output;
					measureTooltip.setPosition(geom.getInteriorPoint().getCoordinates());
				}

				// Update segment labels
				updateSegmentLabels(coords, 'area');
			});
		});

		draw.on('drawend', (e) => {
			if (measureTooltipElement) {
				measureTooltipElement.className = 'measure-tooltip measure-tooltip-static';
			}

			// Finalize segment labels
			const geom = e.feature.getGeometry() as Polygon;
			updateSegmentLabels(geom.getCoordinates()[0], 'area');

			createMeasureTooltip();
		});

		map.addInteraction(draw);

		modify = new Modify({ source: measureSource });
		map.addInteraction(modify);
	}

	function getPolygonCircumference(polygon: Polygon): number {
		const ring = polygon.getLinearRing(0);
		if (!ring) return 0;
		const line = new LineString(ring.getCoordinates());
		return getLength(line, { projection: 'EPSG:25832' });
	}

	function updateSegmentLabels(coords: number[][], type: 'line' | 'area') {
		clearSegmentLabels();
		if (!map || coords.length < 2) return;

		for (let i = 0; i < coords.length - 1; i++) {
			const start = coords[i];
			const end = coords[i + 1];
			const segmentLine = new LineString([start, end]);
			const segmentLength = getLength(segmentLine, { projection: 'EPSG:25832' });

			// Only show label if segment is meaningful
			if (segmentLength > 0.5) {
				const midPoint = [
					(start[0] + end[0]) / 2,
					(start[1] + end[1]) / 2
				];

				const label = document.createElement('div');
				label.className = 'segment-label';
				label.textContent = formatLength(segmentLength);

				const overlay = new Overlay({
					element: label,
					position: midPoint,
					positioning: 'center-center'
				});

				map.addOverlay(overlay);
				segmentOverlays.push(overlay);
			}
		}
	}

	function clearSegmentLabels() {
		if (!map) return;
		segmentOverlays.forEach(overlay => {
			map?.removeOverlay(overlay);
		});
		segmentOverlays = [];
	}

	function deactivateMeasure() {
		activeMode = 'none';
		measureActive.set(false);
		measureResult = '';

		if (map) {
			if (draw) {
				map.removeInteraction(draw);
				draw = null;
			}
			if (modify) {
				map.removeInteraction(modify);
				modify = null;
			}
			if (clickListener) {
				unByKey(clickListener);
				clickListener = null;
			}
		}

		if (map && measureTooltip) {
			map.removeOverlay(measureTooltip);
			measureTooltip = null;
		}

		document.querySelectorAll('.measure-tooltip-static').forEach((el) => el.remove());
		clearSegmentLabels();
		measureSource?.clear();
	}

	function createMeasureTooltip() {
		if (!map) return;

		if (measureTooltipElement) {
			measureTooltipElement.remove();
		}

		measureTooltipElement = document.createElement('div');
		measureTooltipElement.className = 'measure-tooltip';
		measureTooltip = new Overlay({
			element: measureTooltipElement,
			offset: [15, 0],
			positioning: 'center-left'
		});
		map.addOverlay(measureTooltip);
	}

	function formatLength(length: number): string {
		if (length > 1000) {
			return (length / 1000).toFixed(2).replace('.', ',') + ' km';
		}
		return length.toFixed(2).replace('.', ',') + ' m';
	}

	function formatArea(area: number): string {
		if (area > 10000) {
			return (area / 10000).toFixed(2).replace('.', ',') + ' ha';
		}
		return area.toFixed(2).replace('.', ',') + ' m²';
	}

	function formatAreaWithCircumference(area: number, circumference: number): string {
		const areaStr = formatArea(area);
		const circumStr = formatLength(circumference);
		return `${areaStr}<br><small>Umfang: ${circumStr}</small>`;
	}

	function clearMeasurement() {
		measureSource?.clear();
		measureResult = '';
		document.querySelectorAll('.measure-tooltip-static').forEach((el) => el.remove());
		clearSegmentLabels();
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Don't close menu while actively measuring
		if (activeMode !== 'none') return;
		if (!target.closest('.measure-control') && !target.closest('.measure-tooltip')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="measure-control" class:sidebar-open={sidebarOpen}>
	<button
		class="measure-btn"
		class:active={isOpen || activeMode !== 'none'}
		onclick={toggle}
		title="Messen"
		aria-label="Messwerkzeuge"
	>
		<!-- Ruler icon -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<!-- Horizontal ruler with measurement marks -->
			<rect transform="matrix(.70424 -.70997 .70424 .70997 0 0)" x="-11.489" y="12.429" width="22.978" height="9.1913" rx="1.1489" stroke-width="2.2978"/>
			<g stroke-width="2.2978">
				<!-- Long marks -->
				<line x1="3.0892" x2="6.3256" y1="14.534" y2="17.797"/>
				<line x1="8.7529" x2="11.989" y1="8.8241" y2="12.087"/>
				<line x1="14.417" x2="17.653" y1="3.1143" y2="6.3771"/>
				<!-- Short marks -->
				<line x1="5.921" x2="7.5392" y1="11.679" y2="13.31"/>
				<line x1="11.585" x2="13.203" y1="5.9692" y2="7.6006"/>
 			</g>
		</svg>
	</button>

	{#if isOpen}
		<div class="measure-menu">
			<div class="menu-header">Messen</div>

			<button
				class="menu-item"
				class:active={activeMode === 'point'}
				onclick={() => selectMode('point')}
			>
				<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"></circle>
					<path d="M12 2v4"></path>
					<path d="M12 18v4"></path>
					<path d="M2 12h4"></path>
					<path d="M18 12h4"></path>
				</svg>
				<span>Koordinate</span>
			</button>

			<button
				class="menu-item"
				class:active={activeMode === 'line'}
				onclick={() => selectMode('line')}
			>
				<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M4 20 L20 4"></path>
					<circle cx="4" cy="20" r="2"></circle>
					<circle cx="20" cy="4" r="2"></circle>
				</svg>
				<span>Strecke</span>
			</button>

			<button
				class="menu-item"
				class:active={activeMode === 'area'}
				onclick={() => selectMode('area')}
			>
				<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 6 L12 3 L21 6 L21 18 L12 21 L3 18 Z"></path>
				</svg>
				<span>Fläche</span>
			</button>

			{#if activeMode !== 'none'}
				<div class="menu-divider"></div>
				<button class="menu-item clear-btn" onclick={clearMeasurement}>
					<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"></path>
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
					</svg>
					<span>Löschen</span>
				</button>
			{/if}

			{#if measureResult}
				<div class="measure-result">
					<strong>Ergebnis:</strong> {@html measureResult}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.measure-control {
		position: absolute;
		top: 254px;
		left: 10px;
		z-index: 100;
		transition: left 0.3s ease;
	}

	.measure-control.sidebar-open {
		left: var(--sidebar-width);
	}

	.measure-btn {
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
		padding-inline-start: 5px;
	}

	.measure-btn:hover {
		background: #f0f0f0;
	}

	.measure-btn.active {
		background: #E2001A;
		color: white;
	}

	.measure-btn svg {
		width: 18px;
		height: 18px;
	}

	.measure-menu {
		position: absolute;
		top: 0;
		left: 44px;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 160px;
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
		gap: 10px;
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

	.menu-item.active {
		background-color: #E2001A;
		color: white;
	}

	.menu-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.menu-divider {
		height: 1px;
		background: #e0e0e0;
		margin: 4px 0;
	}

	.clear-btn {
		color: #666;
	}

	.clear-btn:hover {
		background-color: #fee;
		color: #c00;
	}

	.measure-result {
		padding: 8px 12px;
		background: #f5f5f5;
		border-top: 1px solid #e0e0e0;
		font-size: 13px;
		font-family: monospace;
	}

	/* Global tooltip styles */
	:global(.measure-tooltip) {
		position: relative;
		background: white;
		border-radius: 4px;
		padding: 6px 10px;
		font-size: 13px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		white-space: nowrap;
	}

	:global(.measure-tooltip-static) {
		background: #E2001A;
		color: white;
	}

	:global(.segment-label) {
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid #E2001A;
		border-radius: 3px;
		padding: 2px 6px;
		font-size: 11px;
		font-family: monospace;
		color: #333;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
