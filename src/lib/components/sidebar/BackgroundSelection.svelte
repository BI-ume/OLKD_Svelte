<script lang="ts">
	import { layerStore, backgroundLayers, activeBackground } from '$lib/stores/layerStore';
	import type { Layer } from '$lib/layers/Layer';

	let isCollapsed = $state(true);

	function handleSelect(layer: Layer) {
		layerStore.setActiveBackground(layer);
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}

	// Placeholder image for layers without previewImage
	const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60">
			<rect fill="#e0e0e0" width="100" height="60"/>
			<text x="50" y="35" text-anchor="middle" fill="#999" font-family="sans-serif" font-size="10">Kein Bild</text>
		</svg>
	`);
</script>

<section class="background-selection">
	<button class="section-header" onclick={toggleCollapse}>
		<svg class="collapse-icon" class:collapsed={isCollapsed} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
		<h3 class="section-title">Hintergrund</h3>
		<span class="active-name">{$activeBackground?.title || ''}</span>
	</button>
	{#if !isCollapsed}
	<div class="background-grid">
		{#each $backgroundLayers as layer (layer.name)}
			<button
				class="background-item"
				class:active={$activeBackground?.name === layer.name}
				onclick={() => handleSelect(layer)}
				title={layer.title}
			>
				<img
					src={layer.previewImage || placeholderImage}
					alt={layer.title}
					class="preview-image"
				/>
				<span class="item-title">{layer.title}</span>
			</button>
		{/each}
	</div>
	{/if}
</section>

<style>
	.background-selection {
		border-bottom: 1px solid #e0e0e0;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
	}

	.section-header:hover {
		background-color: #f5f5f5;
	}

	.collapse-icon {
		width: 16px;
		height: 16px;
		color: #666;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.collapse-icon.collapsed {
		transform: rotate(-90deg);
	}

	.section-title {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.active-name {
		margin-left: auto;
		font-size: 12px;
		color: #999;
		font-weight: normal;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.background-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		padding: 0 12px 12px;
	}

	.background-item {
		position: relative;
		padding: 0;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.background-item:hover {
		border-color: #bbb;
	}

	.background-item.active {
		border-color: #2196f3;
		box-shadow: 0 0 0 1px #2196f3;
	}

	.preview-image {
		display: block;
		width: 100%;
		height: 50px;
		object-fit: cover;
	}

	.item-title {
		display: block;
		padding: 4px 6px;
		font-size: 10px;
		color: #333;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: #f8f8f8;
	}

	.background-item.active .item-title {
		background: #2196f3;
		color: white;
	}
</style>
