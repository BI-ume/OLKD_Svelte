<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore } from '$lib/stores/mapStore';
	import { printSettings } from '$lib/stores/printStore';
	import { sidebarShowPrint } from '$lib/stores/sidebarStore';
	import VectorLayer from 'ol/layer/Vector';
	import VectorSource from 'ol/source/Vector';
	import Feature from 'ol/Feature';
	import { Polygon } from 'ol/geom';
	import { Style, Stroke, Fill } from 'ol/style';
	import { Pointer as PointerInteraction } from 'ol/interaction';
	import type OlMap from 'ol/Map';
	import type { MapBrowserEvent } from 'ol';

	let map = $state<OlMap | null>(null);
	let previewLayer: VectorLayer<VectorSource> | null = null;
	let previewFeature: Feature<Polygon> | null = null;
	let dragInteraction: PointerInteraction | null = null;

	// Print area center, decoupled from map center once dragged
	let printCenter: [number, number] | null = null;
	let isInteracting = false;

	function getMapCenter(): [number, number] | null {
		if (!map) return null;
		const center = map.getView().getCenter();
		return center ? [center[0], center[1]] : null;
	}

	function getExtentFromCenter(
		center: [number, number],
		widthMm: number,
		heightMm: number,
		scale: number
	): [number, number, number, number] {
		const mapWidth = (widthMm * scale) / 1000;
		const mapHeight = (heightMm * scale) / 1000;
		return [
			center[0] - mapWidth / 2,
			center[1] - mapHeight / 2,
			center[0] + mapWidth / 2,
			center[1] + mapHeight / 2
		];
	}

	function setPolygonFromExtent(extent: [number, number, number, number]) {
		if (!previewFeature) return;
		const [left, bottom, right, top] = extent;
		previewFeature.getGeometry()!.setCoordinates([
			[
				[left, bottom],
				[right, bottom],
				[right, top],
				[left, top],
				[left, bottom]
			]
		]);
	}

	function updatePreview() {
		if (!previewFeature || !map || isInteracting) return;

		const settings = $printSettings;
		if (!printCenter) {
			printCenter = getMapCenter();
		}
		if (!printCenter) return;

		const extent = getExtentFromCenter(
			printCenter,
			settings.pageSize.width,
			settings.pageSize.height,
			settings.scale
		);
		setPolygonFromExtent(extent);
	}

	// --- Drag interaction ---

	function setCursor(cursor: string) {
		const el = map?.getTargetElement();
		if (el) el.style.cursor = cursor;
	}

	function isHitOnPreview(pixel: number[]): boolean {
		if (!map || !previewFeature) return false;
		return !!map.forEachFeatureAtPixel(pixel, (f, layer) => {
			return layer === previewLayer && f === previewFeature;
		});
	}

	function createDragInteraction(): PointerInteraction {
		let startCoord: number[] | null = null;
		let dragging = false;

		return new PointerInteraction({
			handleDownEvent(evt: MapBrowserEvent<any>) {
				if (!isHitOnPreview(evt.pixel)) return false;
				startCoord = evt.coordinate.slice();
				dragging = true;
				isInteracting = true;
				setCursor('grabbing');
				return true;
			},
			handleDragEvent(evt: MapBrowserEvent<any>) {
				if (!dragging || !startCoord || !previewFeature) return;
				const dx = evt.coordinate[0] - startCoord[0];
				const dy = evt.coordinate[1] - startCoord[1];
				previewFeature.getGeometry()!.translate(dx, dy);
				startCoord = evt.coordinate.slice();
			},
			handleUpEvent() {
				if (dragging && previewFeature) {
					const ext = previewFeature.getGeometry()!.getExtent();
					printCenter = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
				}
				startCoord = null;
				dragging = false;
				isInteracting = false;
				setCursor('');
				return false;
			},
			handleMoveEvent(evt: MapBrowserEvent<any>) {
				setCursor(isHitOnPreview(evt.pixel) ? 'grab' : '');
			}
		});
	}

	// --- Layer setup ---

	function addLayer() {
		if (!map || previewLayer) return;

		const source = new VectorSource();

		previewFeature = new Feature(new Polygon([[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]]));
		previewFeature.setStyle(
			new Style({
				stroke: new Stroke({ color: '#2196f3', width: 2, lineDash: [8, 4] }),
				fill: new Fill({ color: 'rgba(33, 150, 243, 0.1)' })
			})
		);
		source.addFeature(previewFeature);

		previewLayer = new VectorLayer({ source, zIndex: 9999 });
		map.addLayer(previewLayer);

		printCenter = getMapCenter();
		updatePreview();

		dragInteraction = createDragInteraction();
		map.addInteraction(dragInteraction);
	}

	function removeLayer() {
		if (map) {
			if (dragInteraction) {
				map.removeInteraction(dragInteraction);
				dragInteraction = null;
			}
			if (previewLayer) {
				map.removeLayer(previewLayer);
			}
			setCursor('');
		}
		previewLayer = null;
		previewFeature = null;
		printCenter = null;
	}

	// React to print panel open/close and settings changes
	$effect(() => {
		if (!map) return;

		if ($sidebarShowPrint) {
			const _ = $printSettings;
			if (!previewLayer) {
				addLayer();
			} else {
				updatePreview();
			}
		} else {
			removeLayer();
		}
	});

	onMount(() => {
		map = mapStore.getMap();
	});

	onDestroy(() => {
		removeLayer();
	});
</script>

<!-- This component renders directly to the map via OpenLayers, no DOM needed -->
