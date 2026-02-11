<script lang="ts">
	import { layerStore, overlayGroups } from '$lib/stores/layerStore';
	import { sidebarStore } from '$lib/stores/sidebarStore';
	import { configStore } from '$lib/stores/configStore';
	import { drawStore, drawFeatureCount, drawLayerVisible } from '$lib/stores/drawStore';
	import LayerGroup from './LayerGroup.svelte';
	import type { Group } from '$lib/layers/Group';

	let draggedGroupName = $state<string | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let dropPosition = $state<'above' | 'below' | null>(null);

	let showCatalogButton = $derived($configStore.app?.components?.catalog !== false);

	function handleOpenCatalog() {
		sidebarStore.showCatalog();
	}

	function handleRemoveGroup(groupName: string) {
		layerStore.removeGroup(groupName);
	}

	// Drag and drop handlers
	function handleDragStart(groupName: string) {
		draggedGroupName = groupName;
	}

	function handleDragEnd() {
		if (draggedGroupName && dropTargetIndex !== null && dropPosition) {
			const currentGroups = $overlayGroups;
			const draggedIndex = currentGroups.findIndex((g) => g.name === draggedGroupName);
			if (draggedIndex !== -1 && draggedIndex !== dropTargetIndex) {
				const newOrder = currentGroups.map((g) => g.name);
				const [draggedName] = newOrder.splice(draggedIndex, 1);
				let insertIndex = dropTargetIndex;
				if (draggedIndex < dropTargetIndex) {
					insertIndex--;
				}
				if (dropPosition === 'below') {
					insertIndex++;
				}
				newOrder.splice(insertIndex, 0, draggedName);
				layerStore.reorderGroups(newOrder);
			}
		}
		draggedGroupName = null;
		dropTargetIndex = null;
		dropPosition = null;
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (!draggedGroupName) return;

		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const y = event.clientY - rect.top;
		const midpoint = rect.height / 2;

		dropTargetIndex = index;
		dropPosition = y < midpoint ? 'above' : 'below';
	}

	function handleDragLeave() {
		dropTargetIndex = null;
		dropPosition = null;
	}
</script>

<section class="overlay-section">
	<h3 class="section-title">Themen | Inhalte</h3>

	{#if $overlayGroups.length === 0}
		<p class="no-layers">Keine Layer aktiv</p>
	{:else}
		<div class="groups-list">
			{#each $overlayGroups as group, index (group.name)}
				<div
					class="group-wrapper"
					class:drag-over-above={dropTargetIndex === index && dropPosition === 'above'}
					class:drag-over-below={dropTargetIndex === index && dropPosition === 'below'}
					class:dragging={draggedGroupName === group.name}
					draggable="true"
					ondragstart={() => handleDragStart(group.name)}
					ondragend={handleDragEnd}
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					role="listitem"
				>
					<LayerGroup {group} onRemove={handleRemoveGroup} />
				</div>
			{/each}
		</div>
	{/if}

	{#if $drawFeatureCount > 0}
		<div class="draw-layer-row">
			<button
				class="visibility-btn"
				onclick={() => drawStore.toggleLayerVisibility()}
				title={$drawLayerVisible ? 'Zeichnung ausblenden' : 'Zeichnung einblenden'}
			>
				<span class="visibility-icon" class:visible={$drawLayerVisible}>
					{#if $drawLayerVisible}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
						</svg>
					{/if}
				</span>
			</button>
			<span class="draw-layer-title" class:visible={$drawLayerVisible}>Zeichnung</span>
		</div>
	{/if}

	{#if showCatalogButton}
		<button class="catalog-btn" onclick={handleOpenCatalog}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
				<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
			</svg>
			Katalog öffnen
		</button>
	{/if}
</section>

<style>
	.overlay-section {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-title {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.no-layers {
		color: #999;
		font-size: 13px;
		font-style: italic;
		text-align: center;
		padding: 16px 0;
		margin: 0;
	}

	.groups-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.group-wrapper {
		cursor: grab;
		border-radius: 4px;
		transition: opacity 0.15s;
	}

	.group-wrapper:active {
		cursor: grabbing;
	}

	.group-wrapper.dragging {
		opacity: 0.5;
	}

	.group-wrapper.drag-over-above {
		border-top: 2px solid #2196f3;
	}

	.group-wrapper.drag-over-below {
		border-bottom: 2px solid #2196f3;
	}

	.draw-layer-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
	}

	.draw-layer-row .visibility-btn {
		background: none;
		border: none;
		cursor: pointer;
		margin-left: 24px;
		margin-right: 7px;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		border-radius: 4px;
		transition: background-color 0.15s;
		flex-shrink: 0;
	}

	.draw-layer-row .visibility-btn:hover {
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

	.draw-layer-title {
		font-size: 13px;
		color: #666;
		user-select: none;
	}

	.draw-layer-title.visible {
		color: #333;
		font-weight: 500;
	}

	.catalog-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		margin-top: 8px;
		background: #4caf50;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.catalog-btn:hover {
		background: #43a047;
	}

	.catalog-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
