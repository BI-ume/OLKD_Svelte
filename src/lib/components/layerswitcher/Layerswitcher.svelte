<script lang="ts">
	import { layerStore, backgroundLayers, overlayGroups, activeBackground } from '$lib/stores';
	import type { Layer } from '$lib/layers/Layer';
	import BackgroundSelector from './BackgroundSelector.svelte';
	import LayerGroup from './LayerGroup.svelte';
	import LayerItem from './LayerItem.svelte';

	let collapsed = false;

	function toggleCollapsed() {
		collapsed = !collapsed;
	}

	function handleBackgroundChange(event: CustomEvent<Layer>) {
		layerStore.setActiveBackground(event.detail);
	}

	$: backgrounds = $backgroundLayers;
	$: overlays = $overlayGroups;
	$: activeBackgroundLayer = $activeBackground;
	$: showBackgrounds = backgrounds.length > 1;
	$: showOverlays = overlays.length > 0;
</script>

<div class="layerswitcher" class:collapsed>
	<button
		class="toggle-btn"
		on:click={toggleCollapsed}
		title={collapsed ? 'Layerswitcher anzeigen' : 'Layerswitcher ausblenden'}
		aria-expanded={!collapsed}
	>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
			{#if collapsed}
				<!-- Layers icon when collapsed -->
				<path
					d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"
				/>
			{:else}
				<!-- Close/chevron icon when expanded -->
				<path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
			{/if}
		</svg>
	</button>

	{#if !collapsed}
		<div class="layerswitcher-content">
			<div class="layerswitcher-header">
				<h3>Layer</h3>
			</div>

			<div class="layerswitcher-body">
				{#if showBackgrounds}
					<section class="section backgrounds">
						<h4 class="section-title">Hintergrund</h4>
						<BackgroundSelector
							layers={backgrounds}
							activeLayer={activeBackgroundLayer}
							on:change={handleBackgroundChange}
						/>
					</section>
				{/if}

				{#if showOverlays}
					<section class="section overlays">
						<h4 class="section-title">Themen</h4>
						<div class="overlays-list">
							{#each overlays as group (group.name)}
								{#if group.showGroup !== false}
									{#if group.layers.length > 1}
										<LayerGroup {group} />
									{:else if group.layers.length === 1}
										<!-- Single layer in group - show directly -->
										<LayerItem layer={group.layers[0]} />
									{/if}
								{/if}
							{/each}
						</div>
					</section>
				{/if}

				{#if !showBackgrounds && !showOverlays}
					<div class="empty-state">
						<p>Keine Layer verfügbar</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.layerswitcher {
		position: absolute;
		top: 10px;
		right: 10px;
		background: white;
		border-radius: 8px;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.15),
			0 1px 3px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		max-width: 320px;
		min-width: 280px;
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.layerswitcher.collapsed {
		min-width: auto;
		max-width: none;
	}

	.toggle-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		border-radius: 4px;
		transition: background-color 0.15s;
		z-index: 1;
	}

	.layerswitcher.collapsed .toggle-btn {
		position: relative;
		top: 0;
		right: 0;
		margin: 4px;
	}

	.toggle-btn:hover {
		background-color: #f0f0f0;
		color: #333;
	}

	.layerswitcher-content {
		display: flex;
		flex-direction: column;
	}

	.layerswitcher-header {
		padding: 12px 16px;
		padding-right: 48px;
		border-bottom: 1px solid #e0e0e0;
	}

	.layerswitcher-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.layerswitcher-body {
		padding: 12px;
		max-height: 60vh;
		overflow-y: auto;
	}

	.section {
		margin-bottom: 16px;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		margin: 0 0 8px 0;
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.overlays-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.empty-state {
		text-align: center;
		padding: 24px;
		color: #999;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	/* Scrollbar styling */
	.layerswitcher-body::-webkit-scrollbar {
		width: 6px;
	}

	.layerswitcher-body::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 3px;
	}

	.layerswitcher-body::-webkit-scrollbar-thumb {
		background: #ccc;
		border-radius: 3px;
	}

	.layerswitcher-body::-webkit-scrollbar-thumb:hover {
		background: #aaa;
	}
</style>
