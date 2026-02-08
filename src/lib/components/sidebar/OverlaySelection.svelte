<script lang="ts">
	import { layerStore, overlayGroups } from '$lib/stores/layerStore';
	import { sidebarStore } from '$lib/stores/sidebarStore';
	import { configStore } from '$lib/stores/configStore';
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
