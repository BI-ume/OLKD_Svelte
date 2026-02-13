<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore } from '$lib/stores/mapStore';
	import { printStore, printSettings, AVAILABLE_SCALES } from '$lib/stores/printStore';
	import { sidebarShowPrint } from '$lib/stores/sidebarStore';
	import type OlMap from 'ol/Map';
	import type { EventsKey } from 'ol/events';
	import { unByKey } from 'ol/Observable';

	let map = $state<OlMap | null>(null);
	let resolution = $state(1);
	let resolutionKey: EventsKey | null = null;

	let widthPx = $derived.by(() => {
		const s = $printSettings;
		const mapWidth = (s.pageSize.width * s.scale) / 1000;
		return mapWidth / resolution;
	});

	let heightPx = $derived.by(() => {
		const s = $printSettings;
		const mapHeight = (s.pageSize.height * s.scale) / 1000;
		return mapHeight / resolution;
	});

	let visible = $derived($sidebarShowPrint);

	/**
	 * Find the largest predefined scale where the print rectangle
	 * still fits inside the map viewport.
	 */
	function fitScaleToViewport() {
		if (!map || !$sidebarShowPrint) return;

		const size = map.getSize();
		if (!size) return;

		const [vpWidth, vpHeight] = size;
		const res = map.getView().getResolution() ?? 1;
		const s = $printSettings;

		// Subtract buffer (50px or 20% of viewport, whichever is smaller)
		const bufferW = Math.min(50, vpWidth * 0.2);
		const bufferH = Math.min(50, vpHeight * 0.2);
		const usableW = vpWidth - 2 * bufferW;
		const usableH = vpHeight - 2 * bufferH;

		// Max scale that fits: (viewportPx * resolution * 1000) / pageSizeMm
		const maxScaleW = (usableW * res * 1000) / s.pageSize.width;
		const maxScaleH = (usableH * res * 1000) / s.pageSize.height;
		const maxScale = Math.min(maxScaleW, maxScaleH);

		// Pick largest predefined scale <= maxScale
		let bestScale = AVAILABLE_SCALES[0];
		for (const scale of AVAILABLE_SCALES) {
			if (scale <= maxScale) {
				bestScale = scale;
			} else {
				break;
			}
		}

		if (bestScale !== s.scale) {
			printStore.setScale(bestScale);
		}
	}

	function onResolutionChange() {
		if (!map) return;
		resolution = map.getView().getResolution() ?? 1;
		fitScaleToViewport();
	}

	onMount(() => {
		map = mapStore.getMap();
		if (map) {
			resolution = map.getView().getResolution() ?? 1;
			resolutionKey = map.getView().on('change:resolution', onResolutionChange);
		}
	});

	onDestroy(() => {
		if (resolutionKey) {
			unByKey(resolutionKey);
		}
	});
</script>

{#if visible}
	<div
		class="print-preview"
		style="width: {widthPx}px; height: {heightPx}px;"
	></div>
{/if}

<style>
	.print-preview {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: 2px dashed #2196f3;
		pointer-events: none;
		z-index: 1;
	}
</style>
