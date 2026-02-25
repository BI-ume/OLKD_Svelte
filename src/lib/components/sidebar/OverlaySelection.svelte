<script lang="ts">
	import { layerStore, overlayGroups, mapStore } from '$lib/stores';
	import { sidebarStore, SIDEBAR_WIDTH } from '$lib/stores/sidebarStore';
	import { configStore } from '$lib/stores/configStore';
	import { drawStore, drawFeatureCount, drawLayerVisible } from '$lib/stores/drawStore';
	import { isEmpty } from 'ol/extent';
	import type { Extent } from 'ol/extent';
	import LayerGroup from './LayerGroup.svelte';
	import type { Group } from '$lib/layers/Group';

	let draggedGroupName = $state<string | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let dropPosition = $state<'above' | 'below' | null>(null);
	let mousedownTarget: HTMLElement | null = null;

	let showDrawMenu = $state(false);
	let drawMenuContainer: HTMLDivElement;

	function toggleDrawMenu() {
		showDrawMenu = !showDrawMenu;
	}

	function zoomToDrawing() {
		const source = drawStore.getSource();
		if (source) {
			const extent = source.getExtent() as Extent;
			if (!isEmpty(extent)) {
				mapStore.zoomToExtent(extent, [50, 50, 50, SIDEBAR_WIDTH + 50]);
			}
		}
		showDrawMenu = false;
	}

	function clearDrawing() {
		drawStore.clearAll();
		showDrawMenu = false;
	}

	function handleWindowClick(e: MouseEvent) {
		if (showDrawMenu && drawMenuContainer && !drawMenuContainer.contains(e.target as Node)) {
			showDrawMenu = false;
		}
	}

	let showCatalogButton = $derived($configStore.app?.components?.catalog !== false);

	function handleOpenCatalog() {
		sidebarStore.showCatalog();
	}

	function handleRemoveGroup(groupName: string) {
		layerStore.removeGroup(groupName);
	}

	// Track where the mousedown actually happened
	function handleMouseDown(event: MouseEvent) {
		mousedownTarget = event.target as HTMLElement;
	}

	// Drag and drop handlers
	function handleDragStart(event: DragEvent, groupName: string) {
		if (mousedownTarget?.closest('.menu-container') || mousedownTarget?.closest('.menu-dropdown')) {
			event.preventDefault();
			return;
		}
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

<svelte:window onclick={handleWindowClick} />

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
					onmousedown={handleMouseDown}
					ondragstart={(e) => handleDragStart(e, group.name)}
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

			<div class="menu-container" bind:this={drawMenuContainer}>
				<button
					class="menu-btn"
					class:active={showDrawMenu}
					onclick={toggleDrawMenu}
					title="Mehr Optionen"
					aria-label="Mehr Optionen"
					aria-expanded={showDrawMenu}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
					</svg>
				</button>

				{#if showDrawMenu}
					<div class="menu-dropdown">
						<button class="menu-item" onclick={zoomToDrawing}>
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="15 3 21 3 21 9"></polyline>
								<polyline points="9 21 3 21 3 15"></polyline>
								<line x1="21" y1="3" x2="14" y2="10"></line>
								<line x1="3" y1="21" x2="10" y2="14"></line>
							</svg>
							<span>Auf Layer zoomen</span>
						</button>
						<button class="menu-item remove" onclick={clearDrawing}>
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
								<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
							</svg>
							<span>Entfernen</span>
						</button>
					</div>
				{/if}
			</div>
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
		flex: 1;
	}

	.menu-container {
		position: relative;
		flex-shrink: 0;
	}

	.menu-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #999;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
	}

	.menu-btn:hover {
		background-color: #f0f0f0;
		color: #666;
	}

	.menu-btn.active {
		background-color: #e8f4fc;
		color: #2196f3;
	}

	.menu-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 160px;
		z-index: 100;
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		color: #333;
		text-align: left;
		transition: background-color 0.1s;
	}

	.menu-item:hover {
		background-color: #f5f5f5;
	}

	.menu-item.remove:hover {
		background-color: #fee;
		color: #d32f2f;
	}

	.menu-item svg {
		flex-shrink: 0;
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
