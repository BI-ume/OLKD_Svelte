<script lang="ts">
	import { layerStore, activeBackground, overlayGroups } from '$lib/stores/layerStore';
	import type { Layer } from '$lib/layers/Layer';
	import type { LegendConfig } from '$lib/layers/types';
	import { slide } from 'svelte/transition';

	// Section collapsed state (collapsed by default)
	let sectionCollapsed = $state(true);

	// Track collapsed state per layer
	let collapsedLayers = $state<Set<string>>(new Set());

	// Derive visible layers with legend support
	let visibleLegendLayers = $derived.by(() => {
		const layers: Layer[] = [];

		// Add active background if visible and has legend
		const bg = $activeBackground;
		if (bg && bg.visible && bg.legend !== false) {
			layers.push(bg);
		}

		// Add visible overlay layers
		$overlayGroups.forEach((group) => {
			group.layers.forEach((layer) => {
				if (layer.visible && layer.legend !== false) {
					layers.push(layer);
				}
			});
		});

		return layers;
	});

	function toggleCollapse(layerName: string) {
		if (collapsedLayers.has(layerName)) {
			collapsedLayers.delete(layerName);
		} else {
			collapsedLayers.add(layerName);
		}
		// Trigger reactivity
		collapsedLayers = new Set(collapsedLayers);
	}

	function isCollapsed(layerName: string): boolean {
		return collapsedLayers.has(layerName);
	}

	function getLegendConfig(layer: Layer): LegendConfig | null {
		if (typeof layer.legend === 'object') {
			return layer.legend as LegendConfig;
		}
		return null;
	}

	function getLegendType(layer: Layer): 'graphic' | 'link' | 'text' | 'none' {
		const config = getLegendConfig(layer);

		if (!config) {
			// Default: try GetLegendGraphic for WMS layers
			const url = layer.getLegendGraphicUrl();
			return url ? 'graphic' : 'none';
		}

		if (config.type === 'link' && config.href) {
			return 'link';
		}

		if (config.type === 'text' || (config.text && !config.href && config.type !== 'GetLegendGraphic')) {
			return 'text';
		}

		if (config.type === 'GetLegendGraphic' || config.url) {
			return 'graphic';
		}

		// Fallback: try GetLegendGraphic
		const url = layer.getLegendGraphicUrl();
		return url ? 'graphic' : 'none';
	}

	function getLegendGraphicUrl(layer: Layer): string | null {
		const config = getLegendConfig(layer);

		// If explicit URL is provided, use it
		if (config?.url) {
			return config.url;
		}

		// Otherwise use the layer's method
		return layer.getLegendGraphicUrl();
	}
</script>

<section class="legend-section">
	<button
		class="section-header"
		onclick={() => sectionCollapsed = !sectionCollapsed}
		aria-expanded={!sectionCollapsed}
	>
		<svg
			class="section-collapse-icon"
			class:rotated={!sectionCollapsed}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<polyline points="9 18 15 12 9 6"></polyline>
		</svg>
		<h3 class="section-title">Legende</h3>
	</button>

	{#if !sectionCollapsed}
		<div transition:slide={{ duration: 200 }}>
		{#if visibleLegendLayers.length === 0}
			<p class="no-legend">Keine sichtbaren Layer</p>
		{:else}
			<div class="legend-list">
				{#each visibleLegendLayers as layer (layer.name)}
					{@const legendType = getLegendType(layer)}
					{@const legendConfig = getLegendConfig(layer)}
					{@const collapsed = isCollapsed(layer.name)}

					{#if legendType !== 'none'}
						<div class="legend-item">
							<button
								class="legend-header"
								class:collapsed
								onclick={() => toggleCollapse(layer.name)}
								aria-expanded={!collapsed}
							>
								<svg
									class="collapse-icon"
									class:rotated={!collapsed}
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
								<span class="legend-title">{layer.title}</span>
							</button>

							{#if !collapsed}
								<div class="legend-content" transition:slide={{ duration: 200 }}>
									{#if legendType === 'graphic'}
										{@const url = getLegendGraphicUrl(layer)}
										{#if url}
											<img
												src={url}
												alt="Legende für {layer.title}"
												class="legend-image"
												loading="lazy"
											/>
										{/if}
									{:else if legendType === 'link'}
										<a
											href={legendConfig?.href}
											target="_blank"
											rel="noopener noreferrer"
											class="legend-link"
											title={legendConfig?.title ?? 'Legende öffnen'}
										>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
												<polyline points="15 3 21 3 21 9"></polyline>
												<line x1="10" y1="14" x2="21" y2="3"></line>
											</svg>
											{legendConfig?.text ?? 'Legende anzeigen'}
										</a>
									{:else if legendType === 'text'}
										<span class="legend-text">{legendConfig?.text}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
		</div>
	{/if}
</section>

<style>
	.legend-section {
		padding: 12px;
		border-top: 1px solid #e0e0e0;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 0;
		margin: 0 0 8px 0;
		background: none;
		border: none;
		cursor: pointer;
		color: #666;
	}

	.section-header:hover {
		color: #333;
	}

	.section-collapse-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.section-collapse-icon.rotated {
		transform: rotate(90deg);
	}

	.section-title {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.no-legend {
		color: #999;
		font-size: 13px;
		font-style: italic;
		text-align: center;
		padding: 8px 0;
		margin: 0;
	}

	.legend-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.legend-item {
		background: #f8f8f8;
		border-radius: 4px;
		overflow: hidden;
	}

	.legend-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font-size: 13px;
		color: #333;
		transition: background-color 0.15s;
	}

	.legend-header:hover {
		background: #f0f0f0;
	}

	.collapse-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.collapse-icon.rotated {
		transform: rotate(90deg);
	}

	.legend-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.legend-content {
		padding: 8px 10px;
		padding-top: 0;
	}

	.legend-image {
		display: block;
		max-width: 100%;
		height: auto;
		background: white;
		border-radius: 2px;
	}

	.legend-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #1976d2;
		text-decoration: none;
		font-size: 13px;
	}

	.legend-link:hover {
		text-decoration: underline;
	}

	.legend-link svg {
		width: 14px;
		height: 14px;
	}

	.legend-text {
		font-size: 13px;
		color: #666;
	}
</style>
