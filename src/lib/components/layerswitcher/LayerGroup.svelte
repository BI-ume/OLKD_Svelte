<script lang="ts">
	import type { Group } from '$lib/layers/Group';
	import { layerStore } from '$lib/stores/layerStore';
	import LayerItem from './LayerItem.svelte';

	interface Props {
		group: Group;
		onRemove?: (name: string) => void;
		onSliderToggle?: (isOpen: boolean) => void;
	}

	let { group, onRemove, onSliderToggle }: Props = $props();

	let expanded = $state(!group.collapsed);

	function toggleExpanded() {
		expanded = !expanded;
		group.collapsed = !expanded;
	}

	function toggleGroupVisibility() {
		layerStore.toggleGroupVisibility(group.name);
	}

	function handleRemove() {
		if (onRemove) {
			onRemove(group.name);
		}
	}

	// Subscribe to layerStore to trigger reactivity when layer state changes
	let hasVisibleLayers = $derived.by(() => {
		void $layerStore; // Create dependency on store
		return group.layers.some((l) => l.visible);
	});
</script>

<div class="layer-group">
	<div class="group-header">
		<button
			class="expand-btn"
			onclick={toggleExpanded}
			title={expanded ? 'Gruppe einklappen' : 'Gruppe ausklappen'}
			aria-expanded={expanded}
		>
			<svg
				viewBox="0 0 24 24"
				width="16"
				height="16"
				fill="currentColor"
				class:rotated={expanded}
			>
				<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
			</svg>
		</button>

		<button
			class="visibility-btn"
			onclick={toggleGroupVisibility}
			title={hasVisibleLayers ? 'Gruppe ausblenden' : 'Gruppe einblenden'}
		>
			<span class="visibility-icon" class:visible={hasVisibleLayers}>
				{#if hasVisibleLayers}
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path
							d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path
							d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
						/>
					</svg>
				{/if}
			</span>
		</button>

		<button class="group-title-btn" onclick={toggleExpanded}>
			<span class="group-title">{group.title}</span>
		</button>

		{#if onRemove}
			<button
				class="remove-btn"
				onclick={handleRemove}
				title="Thema entfernen"
				aria-label="{group.title} entfernen"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
				</svg>
			</button>
		{/if}
	</div>

	{#if expanded}
		<div class="group-layers">
			{#each group.layers as layer (layer.name)}
				<LayerItem {layer} indented {onSliderToggle} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.layer-group {
		margin-bottom: 4px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.expand-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		border-radius: 4px;
		transition:
			background-color 0.15s,
			transform 0.2s;
	}

	.expand-btn:hover {
		background-color: #f0f0f0;
	}

	.expand-btn svg {
		transition: transform 0.2s;
	}

	.expand-btn svg.rotated {
		transform: rotate(90deg);
	}

	.visibility-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.visibility-btn:hover {
		background-color: #f0f0f0;
	}

	.visibility-icon {
		display: flex;
		opacity: 0.5;
		transition: opacity 0.15s;
	}

	.visibility-icon.visible {
		opacity: 1;
		color: #2196f3;
	}

	.group-title-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
		text-align: left;
		flex: 1;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.group-title-btn:hover {
		background-color: #f0f0f0;
	}

	.group-title {
		font-size: 14px;
		font-weight: 600;
		color: #333;
	}

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ccc;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background-color: #fee;
		color: #d32f2f;
	}

	.group-layers {
		margin-top: 4px;
		padding-left: 8px;
		border-left: 2px solid #e0e0e0;
		margin-left: 8px;
	}
</style>
