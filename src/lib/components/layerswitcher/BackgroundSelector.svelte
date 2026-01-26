<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Layer } from '$lib/layers/Layer';

	export let layers: Layer[];
	export let activeLayer: Layer | null;

	const dispatch = createEventDispatcher<{ change: Layer }>();

	function selectBackground(layer: Layer) {
		dispatch('change', layer);
	}

	$: activeName = activeLayer?.name ?? '';
</script>

<div class="background-selector">
	{#each layers as layer (layer.name)}
		<label class="background-option" class:active={layer.name === activeName}>
			<input
				type="radio"
				name="background"
				value={layer.name}
				checked={layer.name === activeName}
				on:change={() => selectBackground(layer)}
			/>
			<span class="radio-indicator"></span>
			<span class="background-title">{layer.title}</span>
		</label>
	{/each}
</div>

<style>
	.background-selector {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.background-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s;
		user-select: none;
	}

	.background-option:hover {
		background-color: #f5f5f5;
	}

	.background-option.active {
		background-color: #e3f2fd;
	}

	.background-option input[type='radio'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.radio-indicator {
		width: 16px;
		height: 16px;
		border: 2px solid #999;
		border-radius: 50%;
		position: relative;
		transition:
			border-color 0.15s,
			background-color 0.15s;
		flex-shrink: 0;
	}

	.background-option.active .radio-indicator {
		border-color: #2196f3;
	}

	.radio-indicator::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0);
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: #2196f3;
		transition: transform 0.15s;
	}

	.background-option.active .radio-indicator::after {
		transform: translate(-50%, -50%) scale(1);
	}

	.background-title {
		font-size: 13px;
		color: #333;
	}
</style>
