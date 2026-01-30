<script lang="ts">
	import type { Layer } from '$lib/layers/Layer';
	import { layerStore } from '$lib/stores/layerStore';

	interface Props {
		layer: Layer;
		indented?: boolean;
		showOpacity?: boolean;
		onRemove?: () => void;
	}

	let { layer, indented = false, showOpacity = true, onRemove }: Props = $props();

	let showSlider = $state(false);

	function toggleVisibility() {
		layerStore.toggleLayerVisibility(layer.name);
	}

	function handleOpacityChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const opacity = parseFloat(target.value) / 100;
		layerStore.setLayerOpacity(layer.name, opacity);
	}

	function toggleSlider() {
		showSlider = !showSlider;
	}

	// Subscribe to layerStore to trigger reactivity when layer state changes
	let visible = $derived.by(() => {
		void $layerStore; // Create dependency on store
		return layer.visible;
	});
	let opacity = $derived.by(() => {
		void $layerStore; // Create dependency on store
		return Math.round(layer.opacity * 100);
	});
</script>

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
		<span class="layer-title" class:visible title="{layer.title}">{layer.title}</span>

		{#if showOpacity && visible}
			<button
				class="opacity-toggle"
				class:active={opacity !== 100}
				class:opened={showSlider}
				onclick={toggleSlider}
				title="Transparenz einstellen"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" opacity="0.3"></circle>
					<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" stroke="none"></path>
				</svg>
				{#if showSlider}
					<span class="opacity-value">{opacity}%</span>
				{/if}
			</button>
		{/if}

		{#if onRemove}
			<button
				class="remove-btn"
				onclick={onRemove}
				title="Thema entfernen"
				aria-label="{layer.title} entfernen"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
				</svg>
			</button>
		{/if}
	</div>

	{#if showSlider && visible}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="opacity-slider-row"
			onmousedown={() => {
				(window as any).__sliderDragging = true;
			}}
			onmouseup={() => {
				(window as any).__sliderDragging = false;
			}}
			onmouseleave={() => {
				(window as any).__sliderDragging = false;
			}}
		>
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
		align-items: center;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.layer-title.visible {
		color: #333;
		font-weight: 500;
	}

	.opacity-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 2px 6px;
		cursor: pointer;
		color: #666;
		font-size: 11px;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.opacity-toggle:hover {
		background: #f0f0f0;
		border-color: #ccc;
	}

	.opacity-toggle.active {
		color: #2196f3;
	}

	.opacity-toggle.opened {
		background: #e8f4fc;
		border-color: #2196f3;
	}

	.opacity-value {
		min-width: 28px;
		text-align: right;
	}

	.opacity-slider-row {
		margin-top: 6px;
		margin-left: 26px;
		padding-right: 4px;
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
		--size: 20px;
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

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ccc;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background-color: #fee;
		color: #d32f2f;
	}
</style>
