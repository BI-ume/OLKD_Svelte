<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ScaleLine as OLScaleLine } from 'ol/control';
	import { mapStore, mapReady } from '$lib/stores/mapStore';

	let containerElement: HTMLDivElement;
	let scaleLineControl: OLScaleLine | null = null;

	onMount(() => {
		// Wait for map to be ready
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready && !scaleLineControl) {
				initScaleLine();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	function initScaleLine() {
		const map = mapStore.getMap();
		if (!map || !containerElement) return;

		scaleLineControl = new OLScaleLine({
			units: 'metric',
			target: containerElement,
			className: 'scale-line-inner'
		});

		map.addControl(scaleLineControl);
	}

	onDestroy(() => {
		if (scaleLineControl) {
			const map = mapStore.getMap();
			if (map) {
				map.removeControl(scaleLineControl);
			}
			scaleLineControl = null;
		}
	});
</script>

<div class="scale-line" bind:this={containerElement}></div>

<style>
	.scale-line {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		pointer-events: none;
	}

	/* OpenLayers ScaleLine overrides */
	.scale-line :global(.scale-line-inner) {
		background: rgba(255, 255, 255, 0.95);
		border-radius: 4px;
		padding: 6px 12px;
		font-size: 12px;
		color: #222;
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.25),
			0 1px 2px rgba(0, 0, 0, 0.15);
		text-align: center;
	}
</style>
