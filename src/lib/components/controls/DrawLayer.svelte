<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { drawStore } from '$lib/stores/drawStore';

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = mapReady.subscribe((ready) => {
			if (ready) {
				const map = mapStore.getMap();
				if (map) {
					drawStore.initialize(map);
				}
			}
		});
	});

	onDestroy(() => {
		unsubscribe?.();
		drawStore.destroy();
	});
</script>
