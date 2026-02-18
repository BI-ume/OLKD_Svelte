<script lang="ts">
	import { layerStore, visibleLayerNames } from '$lib/stores/layerStore';
	import { fly } from 'svelte/transition';

	let isOpen = $state(false);

	// Get unique attributions from all visible layers
	// Reacts to both structural changes (layerStore) and visibility changes (visibleLayerNames)
	let attributions = $derived.by(() => {
		const state = $layerStore;
		const names = $visibleLayerNames;
		const seen = new Set<string>();
		const result: string[] = [];

		// Check background layers
		state.backgroundLayers.forEach((layer) => {
			if (names.has(layer.name) && layer.attribution && !seen.has(layer.attribution)) {
				seen.add(layer.attribution);
				result.push(layer.attribution);
			}
		});

		// Check overlay layers
		state.overlayGroups.forEach((group) => {
			group.layers.forEach((layer) => {
				if (names.has(layer.name) && layer.attribution && !seen.has(layer.attribution)) {
					seen.add(layer.attribution);
					result.push(layer.attribution);
				}
			});
		});

		return result;
	});

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="attribution" class:open={isOpen}>
	{#if isOpen && attributions.length > 0}
		<div class="attribution-list" transition:fly={{x: '110%'}}>
			{#each attributions as attribution}
				<div class="attribution-item">
					{@html attribution}
				</div>
			{/each}
		</div>
	{/if}
	<button
		class="attribution-toggle"
		onclick={toggle}
		title={isOpen ? 'Quellenangaben ausblenden' : 'Quellenangaben anzeigen'}
		aria-label={isOpen ? 'Quellenangaben ausblenden' : 'Quellenangaben anzeigen'}
		aria-expanded={isOpen}
	>
		{#if isOpen}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		{:else}
			<span class="copyright-icon">&copy;</span>
		{/if}
	</button>
</div>

<style>
	.attribution {
		position: absolute;
		bottom: 8px;
		right: 8px;
		z-index: 100;
		display: flex;
		align-items: flex-end;
		gap: 4px;
	}

	.attribution-toggle {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #333;
		transition: background-color 0.15s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		flex-shrink: 0;
	}

	.attribution-toggle:hover {
		background: #f0f0f0;
	}

	.attribution-toggle svg {
		width: 18px;
		height: 18px;
	}

	.copyright-icon {
		font-size: 18px;
		font-weight: 600;
		line-height: 1;
	}

	.attribution-list {
		background: rgba(255, 255, 255, 0.95);
		border-radius: 4px;
		padding: 8px 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		max-width: 400px;
		max-height: 200px;
		overflow-y: auto;
	}

	.attribution-item {
		font-size: 11px;
		line-height: 1.4;
		color: #333;
		padding: 2px 0;
	}

	.attribution-item :global(a) {
		color: #1976d2;
		text-decoration: none;
	}

	.attribution-item :global(a:hover) {
		text-decoration: underline;
	}

	/* Separate items with a subtle line */
	.attribution-item + .attribution-item {
		border-top: 1px solid #eee;
		margin-top: 4px;
		padding-top: 6px;
	}
</style>
