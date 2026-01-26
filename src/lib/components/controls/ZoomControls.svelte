<script lang="ts">
	import { mapStore, mapZoom } from '$lib/stores/mapStore';
	import { configStore } from '$lib/stores/configStore';

	// Get min/max zoom from config
	let minZoom = $derived($configStore.app?.map?.minZoom ?? 0);
	let maxZoom = $derived($configStore.app?.map?.maxZoom ?? 20);

	// Check if zoom is at limits
	let atMinZoom = $derived($mapZoom <= minZoom);
	let atMaxZoom = $derived($mapZoom >= maxZoom);

	function zoomIn() {
		const view = mapStore.getView();
		if (view) {
			const currentZoom = view.getZoom() ?? 0;
			view.animate({
				zoom: Math.min(currentZoom + 1, maxZoom),
				duration: 250
			});
		}
	}

	function zoomOut() {
		const view = mapStore.getView();
		if (view) {
			const currentZoom = view.getZoom() ?? 0;
			view.animate({
				zoom: Math.max(currentZoom - 1, minZoom),
				duration: 250
			});
		}
	}
</script>

<div class="zoom-controls">
	<button
		class="zoom-btn zoom-in"
		onclick={zoomIn}
		disabled={atMaxZoom}
		title="Vergrößern"
		aria-label="Vergrößern"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="12" y1="5" x2="12" y2="19"></line>
			<line x1="5" y1="12" x2="19" y2="12"></line>
		</svg>
	</button>
	<button
		class="zoom-btn zoom-out"
		onclick={zoomOut}
		disabled={atMinZoom}
		title="Verkleinern"
		aria-label="Verkleinern"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="5" y1="12" x2="19" y2="12"></line>
		</svg>
	</button>
</div>

<style>
	.zoom-controls {
		position: absolute;
		top: 10px;
		left: 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 100;
	}

	.zoom-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: none;
		cursor: pointer;
		color: #333;
		transition: background-color 0.15s, color 0.15s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.zoom-btn:first-child {
		border-radius: 4px 4px 0 0;
	}

	.zoom-btn:last-child {
		border-radius: 0 0 4px 4px;
	}

	.zoom-btn:hover:not(:disabled) {
		background: #f0f0f0;
	}

	.zoom-btn:active:not(:disabled) {
		background: #e0e0e0;
	}

	.zoom-btn:disabled {
		color: #ccc;
		cursor: not-allowed;
	}

	.zoom-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
