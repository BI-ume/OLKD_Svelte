<script lang="ts">
	import type { Layer } from '$lib/layers/Layer';
	import { layerStore, metadataPopupStore } from '$lib/stores';
	import { getLayerDisplay } from '$lib/stores/layerStore';

	interface Props {
		layer: Layer;
		indented?: boolean;
		showOpacity?: boolean;
		onRemove?: () => void;
	}

	let { layer, indented = false, showOpacity = true, onRemove }: Props = $props();

	let showMenu = $state(false);
	let showSlider = $state(false);

	function toggleVisibility() {
		layerStore.toggleLayerVisibility(layer.name);
	}

	function handleOpacityChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const opacity = parseFloat(target.value) / 100;
		layerStore.setLayerOpacity(layer.name, opacity);
	}

	function toggleMenu() {
		showMenu = !showMenu;
		if (!showMenu) {
			showSlider = false;
		}
	}

	function closeMenu() {
		showMenu = false;
		showSlider = false;
	}

	function toggleSlider() {
		showSlider = !showSlider;
	}

	function handleInfo() {
		if (layer.metadataUrl) {
			metadataPopupStore.open(layer.metadataUrl, layer.title);
		}
		closeMenu();
	}

	function handleRemove() {
		if (onRemove) {
			onRemove();
		}
		closeMenu();
	}

	// Subscribe to per-layer store for O(1) reactivity
	const displayStore = getLayerDisplay(layer.name);
	let visible = $derived($displayStore.visible);
	let opacity = $derived(Math.round($displayStore.opacity * 100));

	let hasMetadata = $derived(!!layer.metadataUrl);
	let hasMenuItems = $derived(hasMetadata || showOpacity || !!onRemove);

	let menuContainer: HTMLDivElement;

	function handleWindowClick(e: MouseEvent) {
		if (showMenu && menuContainer && !menuContainer.contains(e.target as Node)) {
			closeMenu();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="layer-item" class:indented>
	<div class="layer-row">
		<button
			class="visibility-btn"
			onclick={toggleVisibility}
			title={visible ? 'Thema ausblenden' : 'Thema einblenden'}
			aria-label={visible ? `${layer.title} ausblenden` : `${layer.title} einblenden`}
		>
			<span class="visibility-icon" class:visible>
				{#if visible}
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
		<span class="layer-title" class:visible title={layer.title}>{layer.title}</span>

		{#if hasMenuItems && visible}
			<div class="menu-container" bind:this={menuContainer}>
				<button
					class="menu-btn"
					class:active={showMenu}
					onclick={toggleMenu}
					title="Mehr Optionen"
					aria-label="Mehr Optionen"
					aria-expanded={showMenu}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
					</svg>
				</button>

				{#if showMenu}
					<div class="menu-dropdown">
						{#if hasMetadata}
							<button class="menu-item" onclick={handleInfo}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
								</svg>
								<span>Info</span>
							</button>
						{/if}

						{#if showOpacity}
							<button class="menu-item" class:active={showSlider} onclick={toggleSlider}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" opacity="0.3"></circle>
									<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" stroke="none"></path>
								</svg>
								<span>Transparenz</span>
								<span class="opacity-value">{opacity}%</span>
							</button>

							{#if showSlider}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="slider-row">
									<input
										type="range"
										min="0"
										max="100"
										value={opacity}
										oninput={handleOpacityChange}
										class="opacity-slider"
									/>
								</div>
							{/if}
						{/if}

						{#if onRemove}
							<button class="menu-item remove" onclick={handleRemove}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
								</svg>
								<span>Entfernen</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.layer-item {
		padding: 4px 0;
	}

	.layer-item.indented {
		margin-left: 24px;
	}

	.layer-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
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
		flex-shrink: 0;
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

	.layer-title {
		font-size: 13px;
		color: #666;
		transition: color 0.15s;
		user-select: none;
		flex: 1;
		line-height: 1.4;
		padding-top: 2px;
	}

	.layer-title.visible {
		color: #333;
		font-weight: 500;
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

	.menu-item.active {
		background-color: #e8f4fc;
	}

	.menu-item.remove:hover {
		background-color: #fee;
		color: #d32f2f;
	}

	.menu-item svg {
		flex-shrink: 0;
	}

	.menu-item span:first-of-type {
		flex: 1;
	}

	.opacity-value {
		font-size: 11px;
		color: #666;
		min-width: 32px;
		text-align: right;
	}

	.slider-row {
		padding: 8px 12px;
		border-top: 1px solid #f0f0f0;
	}

	.opacity-slider {
		--track-height: 4px;
		width: 100%;
		height: var(--track-height);
		border-radius: 2px;
		background: #ddd;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.opacity-slider::-webkit-slider-thumb {
		--size: 16px;
		-webkit-appearance: none;
		appearance: none;
		width: var(--size);
		height: var(--size);
		position: relative;
		bottom: calc(var(--size)/2 - var(--track-height)/2);
		border-radius: 50%;
		background: #2196f3;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.opacity-slider::-moz-range-thumb {
		--size: 16px;
		width: var(--size);
		height: var(--size);
		position: relative;
		bottom: calc(var(--size)/2 - var(--track-height)/2);
		border-radius: 50%;
		background: #2196f3;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.opacity-slider::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
	}

	.opacity-slider::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: #ddd;
	}
</style>
