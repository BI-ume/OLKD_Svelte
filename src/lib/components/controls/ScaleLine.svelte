<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ScaleLine as OLScaleLine } from 'ol/control';
	import { mapStore, mapReady } from '$lib/stores/mapStore';

	interface Props {
		sidebarOpen?: boolean;
	}

	let { sidebarOpen = false }: Props = $props();

	let containerElement: HTMLButtonElement;
	let scaleLineControl: OLScaleLine | null = null;
	let showDialog = $state(false);
	let scaleInput = $state('');
	let inputElement: HTMLInputElement;
	let originalResolution: number | null = null;

	onMount(() => {
		// Wait for map to be ready
		const unsubscribe = mapReady.subscribe((ready) => {
			if (ready && !scaleLineControl) {
				initScaleLine();
			}
		});

		return () => {
			unsubscribe();
		};
	});

	function initScaleLine() {
		const map = mapStore.getMap();
		if (!map || !containerElement) return;

		scaleLineControl = new OLScaleLine({
			units: 'metric',
			target: containerElement,
			className: 'scale-line-inner'
		});

		map.addControl(scaleLineControl);
	}

	function handleClick() {
		// Save original resolution for potential revert
		const map = mapStore.getMap();
		if (map) {
			originalResolution = map.getView().getResolution() ?? null;
		}

		// Get current scale and populate input
		const currentScale = getCurrentScale();
		if (currentScale) {
			scaleInput = Math.round(currentScale).toString();
		}
		showDialog = true;
		// Focus input after dialog opens
		setTimeout(() => {
			inputElement?.focus();
			inputElement?.select();
		}, 50);
	}

	function getCurrentScale(): number | null {
		const map = mapStore.getMap();
		if (!map) return null;

		const view = map.getView();
		const resolution = view.getResolution();
		if (!resolution) return null;

		// Calculate scale based on resolution and DPI (assuming 96 DPI for screen)
		// 1 inch = 0.0254 meters, screen DPI = 96
		const metersPerUnit = view.getProjection()?.getMetersPerUnit() ?? 1;
		const dpi = 96;
		const inchesPerMeter = 39.3701;
		const scale = resolution * metersPerUnit * inchesPerMeter * dpi;

		return scale;
	}

	function setScaleFromInput() {
		const targetScale = parseInt(scaleInput, 10);
		if (isNaN(targetScale) || targetScale <= 0) {
			return false;
		}

		const map = mapStore.getMap();
		if (!map) return false;

		const view = map.getView();
		const metersPerUnit = view.getProjection()?.getMetersPerUnit() ?? 1;
		const dpi = 96;
		const inchesPerMeter = 39.3701;

		// Calculate resolution from scale
		// scale = resolution * metersPerUnit * inchesPerMeter * dpi
		// resolution = scale / (metersPerUnit * inchesPerMeter * dpi)
		const targetResolution = targetScale / (metersPerUnit * inchesPerMeter * dpi);

		view.setResolution(targetResolution);
		return true;
	}

	function testScale() {
		setScaleFromInput();
		// Dialog stays open, original resolution preserved for potential revert
	}

	function applyScale() {
		if (setScaleFromInput()) {
			originalResolution = null; // Commit the change
			closeDialog();
		}
	}

	function closeDialog() {
		// Revert to original resolution if it was saved (user cancelled)
		if (originalResolution !== null) {
			const map = mapStore.getMap();
			if (map) {
				map.getView().setResolution(originalResolution);
			}
		}
		originalResolution = null;
		showDialog = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			applyScale();
		} else if (event.key === 'Escape') {
			closeDialog();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDialog();
		}
	}

	onDestroy(() => {
		if (scaleLineControl) {
			const map = mapStore.getMap();
			if (map) {
				map.removeControl(scaleLineControl);
			}
			scaleLineControl = null;
		}
	});
</script>

<button
	class="scale-line"
	class:sidebar-open={sidebarOpen}
	bind:this={containerElement}
	onclick={handleClick}
	title="Maßstab einstellen"
	aria-label="Maßstab einstellen"
></button>

{#if showDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="dialog-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
		<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="scale-dialog-title">
			<h3 id="scale-dialog-title">Maßstab</h3>
			<div class="input-row">
				<span class="prefix">1 :</span>
				<input
					type="number"
					bind:this={inputElement}
					bind:value={scaleInput}
					onkeydown={handleKeydown}
					min="1"
					step="1"
				/>
			</div>
			<div class="button-row">
				<button class="cancel-btn" onclick={closeDialog}>Abbrechen</button>
				<button class="test-btn" onclick={testScale}>Test</button>
				<button class="ok-btn" onclick={applyScale}>OK</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.scale-line {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		pointer-events: auto;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: left 0.3s ease;
	}

	.scale-line.sidebar-open {
		left: calc(50% + var(--sidebar-width) / 2);
	}

	/* OpenLayers ScaleLine overrides */
	.scale-line :global(.scale-line-inner) {
		background: rgba(255, 255, 255, 0.95);
		border-radius: 4px;
		padding: 6px 12px;
		font-size: 12px;
		color: #222;
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.25),
			0 1px 2px rgba(0, 0, 0, 0.15);
		text-align: center;
		transition: background-color 0.15s;
	}

	.scale-line:hover :global(.scale-line-inner) {
		background: rgba(240, 240, 240, 0.98);
	}

	.dialog-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dialog {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
		min-width: 240px;
	}

	.dialog h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 20px;
	}

	.prefix {
		font-size: 16px;
		font-weight: 500;
		color: #333;
	}

	.input-row input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
		width: 100%;
	}

	.input-row input:focus {
		outline: none;
		border-color: #4a90d9;
		box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
	}

	/* Hide number input spinners */
	.input-row input[type='number']::-webkit-outer-spin-button,
	.input-row input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.input-row input[type='number'] {
		-moz-appearance: textfield;
	}

	.button-row {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.button-row button {
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.cancel-btn {
		background: #f5f5f5;
		border: 1px solid #ccc;
		color: #333;
	}

	.cancel-btn:hover {
		background: #e8e8e8;
	}

	.test-btn {
		background: #f5f5f5;
		border: 1px solid #4a90d9;
		color: #4a90d9;
	}

	.test-btn:hover {
		background: #e8f0f8;
	}

	.ok-btn {
		background: #4a90d9;
		border: 1px solid #4a90d9;
		color: white;
	}

	.ok-btn:hover {
		background: #3a7fc8;
	}
</style>
