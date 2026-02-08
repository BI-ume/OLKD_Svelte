<script lang="ts">
	import { onMount } from 'svelte';
	import { sidebarStore } from '$lib/stores/sidebarStore';
	import { catalogStore, catalogItems, catalogIsLoading } from '$lib/stores/catalogStore';
	import { configStore } from '$lib/stores/configStore';
	import { metadataPopupStore } from '$lib/stores/metadataPopupStore';

	let loaded = $state(false);
	let filter = $state('');

	// Load catalog on first mount
	onMount(() => {
		if (!loaded) {
			const configId = $configStore.configId || 'default';
			catalogStore.loadCatalog(configId);
			loaded = true;
		}
	});

	function handleBack() {
		sidebarStore.hideCatalog();
	}

	function handleToggleItem(name: string) {
		catalogStore.toggleItem(name);
	}

	function handleShowMetadata(url: string, title: string) {
		metadataPopupStore.open(url, title);
	}

	// Filter and sort items: active first, then alphabetical, filtered by search
	let filteredItems = $derived(() => {
		const items = $catalogItems;
		const searchLower = filter.toLowerCase().trim();

		let filtered = items;
		if (searchLower) {
			filtered = items.filter(
				(item) =>
					item.title.toLowerCase().includes(searchLower) ||
					item.abstract?.toLowerCase().includes(searchLower)
			);
		}

		// Sort: active items first, then alphabetical
		return filtered.sort((a, b) => {
			if (a.active && !b.active) return -1;
			if (!a.active && b.active) return 1;
			return a.title.localeCompare(b.title, 'de');
		});
	});

	let showFilter = $derived($catalogItems.length > 5);
</script>

<div class="catalog">
	<button class="catalog-header" onclick={handleBack} title="Zurück zur Übersicht">
		<svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="15 18 9 12 15 6"></polyline>
		</svg>
		<h2 class="catalog-title">Katalog</h2>
	</button>

	{#if showFilter}
		<div class="filter-container">
			<input
				type="text"
				placeholder="Katalog durchsuchen..."
				bind:value={filter}
				class="filter-input"
			/>
			{#if filter}
				<button class="clear-btn" onclick={() => (filter = '')} title="Filter löschen">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			{/if}
		</div>
	{/if}

	<div class="catalog-content">
		{#if $catalogIsLoading}
			<div class="loading">Lade Katalog...</div>
		{:else if filteredItems().length === 0}
			<div class="empty">
				{filter ? 'Keine Treffer' : 'Katalog leer'}
			</div>
		{:else}
			<ul class="catalog-list">
				{#each filteredItems() as item (item.name)}
					<li class="catalog-item" class:active={item.active}>
						<label class="item-label">
							<input
								type="checkbox"
								checked={item.active}
								onchange={() => handleToggleItem(item.name)}
							/>
							<span class="item-checkbox"></span>
							<div class="item-content">
								<span class="item-title">{item.title}</span>
								{#if item.abstract}
									<span class="item-abstract">{item.abstract}</span>
								{/if}
							</div>
						</label>
						{#if item.metadataUrl}
							<button
								class="metadata-btn"
								onclick={() => handleShowMetadata(item.metadataUrl, item.title)}
								title="Metadaten anzeigen"
							>
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
								</svg>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.catalog {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.catalog-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px 16px;
		border: none;
		border-bottom: 1px solid #e0e0e0;
		background: #f8f8f8;
		cursor: pointer;
		transition: background-color 0.15s;
		text-align: left;
	}

	.catalog-header:hover {
		background: #e8e8e8;
	}

	.back-icon {
		width: 24px;
		height: 24px;
		color: #666;
		flex-shrink: 0;
	}

	.catalog-header:hover .back-icon {
		color: #333;
	}

	.catalog-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.filter-container {
		position: relative;
		padding: 8px 12px;
		border-bottom: 1px solid #e0e0e0;
	}

	.filter-input {
		width: 100%;
		padding: 8px 32px 8px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
	}

	.filter-input:focus {
		outline: none;
		border-color: #2196f3;
	}

	.clear-btn {
		position: absolute;
		right: 18px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: #999;
	}

	.clear-btn:hover {
		background: #e0e0e0;
		color: #666;
	}

	.clear-btn svg {
		width: 14px;
		height: 14px;
	}

	.catalog-content {
		flex: 1;
		overflow-y: auto;
	}

	.loading,
	.empty {
		padding: 24px 16px;
		text-align: center;
		color: #999;
		font-size: 14px;
	}

	.catalog-list {
		list-style: none;
		margin: 0;
		padding: 8px;
	}

	.catalog-item {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		padding: 8px;
		margin-bottom: 4px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		background: white;
		transition: border-color 0.15s, background-color 0.15s;
	}

	.catalog-item:hover {
		border-color: #ccc;
	}

	.catalog-item.active {
		border-color: #4caf50;
		background: #f1f8e9;
	}

	.item-label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		flex: 1;
		cursor: pointer;
	}

	.item-label input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		cursor: pointer;
	}

	.item-checkbox {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		margin-top: 2px;
		border: 2px solid #ccc;
		border-radius: 3px;
		background: white;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.item-label input:checked + .item-checkbox {
		background: #4caf50;
		border-color: #4caf50;
	}

	.item-label input:checked + .item-checkbox::after {
		content: '';
		display: block;
		width: 5px;
		height: 10px;
		margin: 1px 0 0 5px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.item-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-title {
		font-size: 13px;
		font-weight: 500;
		color: #333;
	}

	.item-abstract {
		font-size: 11px;
		color: #666;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.metadata-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #999;
		transition: background-color 0.15s, color 0.15s;
	}

	.metadata-btn:hover {
		background: #e0e0e0;
		color: #2196f3;
	}

	.metadata-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
