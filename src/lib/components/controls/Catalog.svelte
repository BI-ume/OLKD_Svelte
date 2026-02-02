<script lang="ts">
	import { catalogStore, catalogItems, catalogIsLoading, metadataPopupStore } from '$lib/stores';
	import { configStore } from '$lib/stores/configStore';

	let isOpen = $state(false);
	let loaded = $state(false);
	let filter = $state('');

	async function toggle() {
		isOpen = !isOpen;
		if (isOpen && !loaded) {
			const configId = configStore.getState().configId || 'default';
			await catalogStore.loadCatalog(configId);
			loaded = true;
		}
	}

	async function handleToggleItem(name: string) {
		await catalogStore.toggleItem(name);
	}

	function handleMetadataClick(url: string, title: string) {
		metadataPopupStore.open(url, title);
	}

	let filteredItems = $derived(
		$catalogItems
			.filter((item) => {
				if (!filter) return true;
				const q = filter.toLowerCase();
				return (
					item.title.toLowerCase().includes(q) ||
					item.abstract.toLowerCase().includes(q)
				);
			})
			.sort((a, b) => {
				// First sort by active state (active items first)
				if (a.active !== b.active) {
					return a.active ? -1 : 1;
				}
				// Then sort alphabetically by title
				return a.title.localeCompare(b.title, 'de');
			})
	);
</script>

<section class="catalog-section">
	<button class="catalog-toggle" onclick={toggle} aria-expanded={isOpen}>
		<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="catalog-icon">
			<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
		</svg>
		<span>Katalog</span>
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="currentColor"
			class="chevron"
			class:open={isOpen}
		>
			<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
		</svg>
	</button>

	{#if isOpen}
		<div class="catalog-body">
			{#if $catalogItems.length > 5}
				<div class="filter-row">
					<input
						type="text"
						bind:value={filter}
						placeholder="Filter..."
						class="filter-input"
					/>
				</div>
			{/if}

			{#if $catalogIsLoading}
				<div class="status-msg">Lade Katalog...</div>
			{:else if filteredItems.length === 0}
				<div class="status-msg">
					{#if filter}
						Keine Treffer
					{:else}
						Keine Katalogeinträge verfügbar
					{/if}
				</div>
			{:else}
				<ul class="catalog-list">
					{#each filteredItems as item (item.name)}
						<li class="catalog-item" class:active={item.active}>
							<button
								class="item-toggle"
								onclick={() => handleToggleItem(item.name)}
								title={item.active ? 'Aus Karte entfernen' : 'Zur Karte hinzufügen'}
							>
								<span class="checkbox" class:checked={item.active}>
									{#if item.active}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
											<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
										</svg>
									{:else}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
											<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
										</svg>
									{/if}
								</span>
								<div class="item-info">
									<span class="item-title">{item.title}</span>
									{#if item.abstract}
										<span class="item-abstract">{item.abstract}</span>
									{/if}
								</div>
							</button>
							{#if item.metadataUrl}
								<button
									class="metadata-btn"
									onclick={() => handleMetadataClick(item.metadataUrl!, item.title)}
									title="Metadaten"
								>
									<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
										<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
									</svg>
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>

<style>
	.catalog-section {
		border-top: 1px solid #e0e0e0;
		margin-top: 4px;
		padding-top: 4px;
	}

	.catalog-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 4px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		transition: background-color 0.15s, color 0.15s;
	}

	.catalog-toggle:hover {
		background: #f5f5f5;
		color: #333;
	}

	.catalog-icon {
		flex-shrink: 0;
	}

	.catalog-toggle span {
		flex: 1;
		text-align: left;
	}

	.chevron {
		flex-shrink: 0;
		transition: transform 0.2s;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.catalog-body {
		margin-top: 4px;
	}

	.filter-row {
		padding: 0 0 8px 0;
	}

	.filter-input {
		width: 100%;
		padding: 6px 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}

	.filter-input:focus {
		border-color: #2196f3;
	}

	.status-msg {
		padding: 12px 4px;
		text-align: center;
		color: #999;
		font-size: 13px;
	}

	.catalog-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.catalog-item {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		padding: 1px 0;
		border-radius: 4px;
		transition: background-color 0.1s;
	}

	.catalog-item:hover {
		background: #f5f5f5;
	}

	.item-toggle {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 8px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 5px 0;
		text-align: left;
		min-width: 0;
	}

	.checkbox {
		flex-shrink: 0;
		color: #999;
		display: flex;
		align-items: center;
	}

	.checkbox.checked {
		color: #2196f3;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-title {
		font-size: 13px;
		color: #333;
		font-weight: 500;
	}

	.catalog-item.active .item-title {
		color: #2196f3;
	}

	.item-abstract {
		font-size: 11px;
		color: #888;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.metadata-btn {
		flex-shrink: 0;
		color: #999;
		padding: 5px 2px;
		display: flex;
		align-items: center;
		background: none;
		border: none;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.15s, background-color 0.15s;
	}

	.metadata-btn:hover {
		color: #2196f3;
		background-color: #f0f0f0;
	}
</style>
