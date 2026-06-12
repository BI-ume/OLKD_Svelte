<script lang="ts">
	import { onMount } from 'svelte';
	import { configStore } from '$lib/stores/configStore';
	import { layerStore } from '$lib/stores/layerStore';
	import { transportStore, transportMode, detectInitialMode } from '$lib/stores/transportStore';

	function activateMode(mode: 'day' | 'night') {
		const tc = $configStore.app?.transport;
		if (!tc) return;
		(tc.dayLayers ?? []).forEach((name: string) => layerStore.setLayerVisibility(name, mode === 'day'));
		(tc.nightLayers ?? []).forEach((name: string) => layerStore.setLayerVisibility(name, mode === 'night'));
		transportStore.setMode(mode);
	}

	onMount(() => {
		activateMode(detectInitialMode());
	});
</script>

<div class="day-night-switch">
	<button
		class:day-active={$transportMode === 'day'}
		onclick={() => activateMode('day')}
		title="Tagbus anzeigen"
	>Tagesnetz</button>
	<button
		class:night-active={$transportMode === 'night'}
		onclick={() => activateMode('night')}
		title="Nachtbus anzeigen"
	>NachtBus-Netz</button>
</div>

<style>
	.day-night-switch {
		position: absolute;
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		height: 36px;
		display: flex;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
		z-index: 9;
	}

	button {
		padding: 0 14px;
		height: 100%;
		border: none;
		border-right: 1px solid #e0e0e0;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		background: white;
		color: #666;
		transition: background-color 0.15s, color 0.15s;
	}

	button:last-child {
		border-right: none;
	}

	button.day-active {
		background: #fa6400;
		color: white;
	}

	button.night-active {
		background: #003264;
		color: white;
	}

	button:not(.day-active):not(.night-active):hover {
		background: #f0f0f0;
	}
</style>
