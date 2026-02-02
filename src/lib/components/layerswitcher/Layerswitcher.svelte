<script lang="ts">
	import { layerStore, backgroundLayers, overlayGroups, activeBackground, componentsConfig, metadataPopupStore, metadataPopupIsOpen, metadataPopupUrl, metadataPopupTitle } from '$lib/stores';
	import type { Layer } from '$lib/layers/Layer';
	import BackgroundSelector from './BackgroundSelector.svelte';
	import LayerGroup from './LayerGroup.svelte';
	import LayerItem from './LayerItem.svelte';
	import Catalog from '$lib/components/controls/Catalog.svelte';
	import MetadataPopup from './MetadataPopup.svelte';

	let collapsed = $state(false);
	let draggedGroupName = $state<string | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let dropPosition = $state<'above' | 'below'>('above');

	function toggleCollapsed() {
		collapsed = !collapsed;
	}

	function handleBackgroundChange(event: CustomEvent<Layer>) {
		layerStore.setActiveBackground(event.detail);
	}

	function handleRemoveGroup(name: string) {
		layerStore.removeGroup(name);
	}

	// --- Drag & Drop ---
	function handleDragStart(e: DragEvent, groupName: string) {
		// Cancel drag if slider is being interacted with
		if ((window as any).__sliderDragging) {
			e.preventDefault();
			(window as any).__sliderDragging = false;
			return;
		}

		draggedGroupName = groupName;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', groupName);
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dropTargetIndex = index;

		// Determine if dropping above or below based on mouse position
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const midpoint = rect.top + rect.height / 2;
		dropPosition = e.clientY < midpoint ? 'above' : 'below';
	}

	function handleDragLeave() {
		dropTargetIndex = null;
		dropPosition = 'above';
	}

	function handleDrop(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		const currentDropPosition = dropPosition;
		dropTargetIndex = null;
		dropPosition = 'above';

		if (!draggedGroupName) return;

		const visibleGroups = overlays.filter((g) => g.showGroup !== false);
		const draggedIndex = visibleGroups.findIndex((g) => g.name === draggedGroupName);
		if (draggedIndex === -1) return;

		// Don't do anything if dropping on same position
		if (draggedIndex === targetIndex) return;
		if (currentDropPosition === 'below' && draggedIndex === targetIndex + 1) return;
		if (currentDropPosition === 'above' && draggedIndex === targetIndex - 1) return;

		// Build new order from all groups (including hidden ones)
		const newOrder = [...overlays.map((g) => g.name)];
		const draggedName = draggedGroupName;

		// Remove from old position
		const oldIdx = newOrder.indexOf(draggedName);
		newOrder.splice(oldIdx, 1);

		// Find the insert position based on the visible group at targetIndex
		const targetGroupName = visibleGroups[targetIndex]?.name;
		let insertIdx = targetGroupName ? newOrder.indexOf(targetGroupName) : newOrder.length;

		// Adjust insert position based on drop position
		if (currentDropPosition === 'below') {
			insertIdx++;
		}

		newOrder.splice(insertIdx, 0, draggedName);
		layerStore.reorderGroups(newOrder);
		draggedGroupName = null;
	}

	function handleDragEnd() {
		draggedGroupName = null;
		dropTargetIndex = null;
		dropPosition = 'above';
	}

	let backgrounds = $derived($backgroundLayers);
	let overlays = $derived($overlayGroups);
	let activeBackgroundLayer = $derived($activeBackground);
	let showBackgrounds = $derived(backgrounds.length > 1);
	let showOverlays = $derived(overlays.length > 0);

	let showCatalog = $derived($componentsConfig?.catalog === true);

	// Visible groups for drag indexing
	let visibleOverlays = $derived(overlays.filter((g) => g.showGroup !== false));
</script>

<div class="layerswitcher" class:collapsed>
	<button
		class="toggle-btn"
		onclick={toggleCollapsed}
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
							{#each visibleOverlays as group, idx (group.name)}
								<div
									class="draggable-item"
									class:dragging={draggedGroupName === group.name}
									class:drop-above={dropTargetIndex === idx && draggedGroupName !== group.name && dropPosition === 'above'}
									class:drop-below={dropTargetIndex === idx && draggedGroupName !== group.name && dropPosition === 'below'}
									draggable="true"
									ondragstart={(e) => handleDragStart(e, group.name)}
									ondragover={(e) => handleDragOver(e, idx)}
									ondragleave={handleDragLeave}
									ondrop={(e) => handleDrop(e, idx)}
									ondragend={handleDragEnd}
									role="listitem"
								>
									{#if group.layers.length > 1}
										<LayerGroup {group} onRemove={handleRemoveGroup} />
									{:else if group.layers.length === 1}
										<LayerItem layer={group.layers[0]} onRemove={() => handleRemoveGroup(group.name)} />
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if !showBackgrounds && !showOverlays && !showCatalog}
					<div class="empty-state">
						<p>Keine Layer verfügbar</p>
					</div>
				{/if}

				{#if showCatalog}
					<Catalog />
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if $metadataPopupIsOpen}
	<MetadataPopup
		url={$metadataPopupUrl}
		title={$metadataPopupTitle}
		onClose={() => metadataPopupStore.close()}
	/>
{/if}

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

	/* Drag & drop styles */
	.draggable-item {
		cursor: grab;
		border-radius: 4px;
		border: 2px solid transparent;
		transition: opacity 0.15s, border-color 0.15s;
	}

	.draggable-item:active {
		cursor: grabbing;
	}

	.draggable-item.dragging {
		opacity: 0.4;
	}

	.draggable-item.drop-above {
		border-top-color: #2196f3;
	}

	.draggable-item.drop-below {
		border-bottom-color: #2196f3;
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
