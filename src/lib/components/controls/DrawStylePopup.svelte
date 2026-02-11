<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Overlay from 'ol/Overlay';
	import {
		drawStore,
		drawShowStylePopup,
		drawSelectedFeatureId,
		drawPopupCoordinate,
		DASH_STYLES,
		type DrawStyle
	} from '$lib/stores/drawStore';
	import ColorPicker from '$lib/components/sidebar/ColorPicker.svelte';

	let style = $state<DrawStyle | null>(null);
	let geomType = $state<string | null>(null);
	let popupEl: HTMLDivElement | undefined = $state();
	let overlay: Overlay | null = null;

	onDestroy(() => {
		if (overlay) {
			drawStore.removePopupOverlay();
			overlay = null;
		}
	});

	// Initialize overlay once the element is available
	$effect(() => {
		if (popupEl && !overlay) {
			overlay = new Overlay({
				element: popupEl,
				autoPan: { animation: { duration: 250 }, margin: 50 },
				offset: [0, -15],
				positioning: 'bottom-center',
				stopEvent: true
			});
			drawStore.setPopupOverlay(overlay);
		}
	});

	// Update overlay position and style when popup state changes
	$effect(() => {
		if ($drawShowStylePopup && $drawSelectedFeatureId && $drawPopupCoordinate) {
			style = drawStore.getSelectedStyle();
			geomType = drawStore.getSelectedGeometryType();
			if (overlay) {
				overlay.setPosition($drawPopupCoordinate);
			}
		} else {
			if (overlay) {
				overlay.setPosition(undefined);
			}
		}
	});

	let isText = $derived(geomType === 'Point' && !!style?.isTextFeature);
	let isPoint = $derived(geomType === 'Point' && !isText);
	let isLine = $derived(geomType === 'LineString');
	let isPolygon = $derived(geomType === 'Polygon');

	function applyStyle(changes: Partial<DrawStyle>) {
		drawStore.applyStyleToSelected(changes);
		style = drawStore.getSelectedStyle();
	}

	function handleClose() {
		drawStore.closeStylePopup();
	}

	function handleDelete() {
		drawStore.deleteSelected();
	}

	function getDashIndex(dash: number[]): number {
		return DASH_STYLES.findIndex(
			(d) => JSON.stringify(d.value) === JSON.stringify(dash)
		);
	}

	function handleDashChange(e: Event) {
		const idx = parseInt((e.target as HTMLSelectElement).value, 10);
		applyStyle({ strokeDash: DASH_STYLES[idx].value });
	}
</script>

<!-- Reusable fieldset snippets -->

{#snippet punktFieldset(s: DrawStyle)}
	<fieldset class="style-fieldset">
		<legend>Punkt</legend>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label" for="draw-point-radius">Radius <span class="slider-val">{s.pointRadius}</span></label>
				<input id="draw-point-radius" type="range" class="slider" value={s.pointRadius} min="2" max="20" step="1"
					oninput={(e) => applyStyle({ pointRadius: parseInt(e.currentTarget.value, 10) })} />
			</div>
			<div class="field-col"></div>
		</div>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label">Farbe</label>
				<ColorPicker value={s.pointColor} onchange={(c) => applyStyle({ pointColor: c })} />
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-point-opacity">Deckkraft <span class="slider-val">{Math.round(s.pointOpacity * 100)}%</span></label>
				<input id="draw-point-opacity" type="range" class="slider" value={s.pointOpacity} min="0" max="1" step="0.01"
					oninput={(e) => applyStyle({ pointOpacity: parseFloat(e.currentTarget.value) })} />
			</div>
		</div>
	</fieldset>
{/snippet}

{#snippet linieFieldset(s: DrawStyle)}
	<fieldset class="style-fieldset">
		<legend>Linie</legend>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label">Farbe</label>
				<ColorPicker value={s.strokeColor} onchange={(c) => applyStyle({ strokeColor: c })} />
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-stroke-opacity">Deckkraft <span class="slider-val">{Math.round(s.strokeOpacity * 100)}%</span></label>
				<input id="draw-stroke-opacity" type="range" class="slider" value={s.strokeOpacity} min="0" max="1" step="0.01"
					oninput={(e) => applyStyle({ strokeOpacity: parseFloat(e.currentTarget.value) })} />
			</div>
		</div>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label" for="draw-stroke-dash">Strichart</label>
				<select id="draw-stroke-dash" class="input-sm" value={getDashIndex(s.strokeDash)} onchange={handleDashChange}>
					{#each DASH_STYLES as dash, i}
						<option value={i}>{dash.label}</option>
					{/each}
				</select>
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-stroke-width">Stärke <span class="slider-val">{s.strokeWidth}</span></label>
				<input id="draw-stroke-width" type="range" class="slider" value={s.strokeWidth} min="1" max="10" step="1"
					oninput={(e) => applyStyle({ strokeWidth: parseInt(e.currentTarget.value, 10) })} />
			</div>
		</div>
	</fieldset>
{/snippet}

{#snippet fuellungFieldset(s: DrawStyle)}
	<fieldset class="style-fieldset">
		<legend>Füllung</legend>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label">Farbe</label>
				<ColorPicker value={s.fillColor} onchange={(c) => applyStyle({ fillColor: c })} />
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-fill-opacity">Deckkraft <span class="slider-val">{Math.round(s.fillOpacity * 100)}%</span></label>
				<input id="draw-fill-opacity" type="range" class="slider" value={s.fillOpacity} min="0" max="1" step="0.01"
					oninput={(e) => applyStyle({ fillOpacity: parseFloat(e.currentTarget.value) })} />
			</div>
		</div>
	</fieldset>
{/snippet}

{#snippet textFieldset(s: DrawStyle)}
	<fieldset class="style-fieldset">
		<legend>Text</legend>
		<div class="field-row full">
			<div class="field-col">
				<label class="field-label" for="draw-text-input">Beschriftung</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input id="draw-text-input" type="text" class="input-sm" value={s.text}
					oninput={(e) => applyStyle({ text: e.currentTarget.value })}
					placeholder="Text eingeben..."
					autofocus />
			</div>
		</div>
	</fieldset>
{/snippet}

{#snippet schriftFieldset(s: DrawStyle)}
	<fieldset class="style-fieldset">
		<legend>Schrift</legend>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label">Farbe</label>
				<ColorPicker value={s.fontColor} onchange={(c) => applyStyle({ fontColor: c })} />
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-font-size">Größe</label>
				<select id="draw-font-size" class="input-sm" value={s.fontSize}
					onchange={(e) => applyStyle({ fontSize: parseInt(e.currentTarget.value, 10) })}>
					{#each [6, 8, 10, 12, 14, 16, 20, 24, 32] as size}
						<option value={size}>{size}px</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="field-row">
			<div class="field-col">
				<label class="field-label">Schriftstil</label>
				<div class="toggle-row">
					<button class="toggle-btn" class:active={s.fontBold}
						onclick={() => applyStyle({ fontBold: !s.fontBold })} title="Fett">
						<strong>B</strong>
					</button>
					<button class="toggle-btn" class:active={s.fontItalic}
						onclick={() => applyStyle({ fontItalic: !s.fontItalic })} title="Kursiv">
						<em>I</em>
					</button>
				</div>
			</div>
			<div class="field-col">
				<label class="field-label" for="draw-text-rotation">Drehung <span class="slider-val">{s.textRotation}°</span></label>
				<input id="draw-text-rotation" type="range" class="slider" value={s.textRotation} min="-180" max="180" step="1"
					oninput={(e) => applyStyle({ textRotation: parseInt(e.currentTarget.value, 10) })} />
			</div>
		</div>
	</fieldset>
{/snippet}

<div class="draw-popup-anchor" bind:this={popupEl}>
	{#if $drawShowStylePopup && style}
		<div class="draw-popup" role="dialog" aria-label="Stil bearbeiten">
			<!-- Header -->
			<div class="popup-header">
				<span class="popup-title">
					{#if isText}Beschriftung{:else if isPoint}Punkt{:else if isLine}Linie{:else if isPolygon}Polygon{:else}Stil{/if}
				</span>
				<button class="close-btn" onclick={handleClose} aria-label="Schließen">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="popup-body">
				{#if isPoint}
					{@render punktFieldset(style)}
					{@render linieFieldset(style)}
				{:else if isLine}
					{@render linieFieldset(style)}
				{:else if isPolygon}
					{@render linieFieldset(style)}
					{@render fuellungFieldset(style)}
				{:else if isText}
					{@render textFieldset(style)}
					{@render schriftFieldset(style)}
				{/if}
			</div>

			<!-- Footer with delete + close -->
			<div class="popup-footer">
				<button class="delete-btn" onclick={handleDelete} title="Feature entfernen">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"></path>
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
					</svg>
					Entfernen
				</button>
				<button class="close-footer-btn" onclick={handleClose}>Schließen</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.draw-popup-anchor {
		position: absolute;
		/* OL Overlay manages positioning */
		bottom: 10px;
		left: -50px;
	}

	.draw-popup {
		background: #fdfdfd;
		border-radius: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		width: 290px;
		display: flex;
		flex-direction: column;
		font-size: 0.85em;
	}

	/* Triangular pointer at bottom pointing at geometry */
	.draw-popup::after {
		content: '';
		position: absolute;
		bottom: -10px;
		left: 50px;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 10px solid transparent;
		border-right: 10px solid transparent;
		border-top: 10px solid #fdfdfd;
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15));
	}

	.popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		background: #337ab7;
		color: white;
		border-radius: 4px 4px 0 0;
	}

	.popup-title {
		font-size: 14px;
		font-weight: 600;
	}

	.close-btn {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		color: white;
		padding: 0;
		opacity: 0.8;
	}

	.close-btn:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.2);
	}

	.close-btn svg {
		width: 16px;
		height: 16px;
	}

	/* Fieldset-based form layout */
	.popup-body {
		padding: 0 10px;
		max-height: 350px;
		overflow-y: auto;
		overflow-x: visible;
	}

	.style-fieldset {
		border: none;
		border-bottom: 1px solid #ddd;
		margin: 0;
		padding: 8px 0 10px;
	}

	.style-fieldset:last-child {
		border-bottom: none;
	}

	.style-fieldset legend {
		font-size: 12px;
		font-weight: bold;
		color: #888;
		border: none;
		margin-bottom: 6px;
		padding: 8px 0 0;
		width: auto;
		float: none;
	}

	/* 2-column row: 2 fields side by side, labels above inputs */
	.field-row {
		display: flex;
		gap: 20px;
		margin-bottom: 15px;
	}

	.field-row:last-child {
		margin-bottom: 0;
	}

	.field-row .field-col {
		flex: 1 1 0;
		min-width: 0;
	}

	.field-row.full .field-col {
		flex: 1 1 100%;
	}

	.field-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		color: #555;
		margin-bottom: 3px;
	}

	.slider-val {
		font-weight: normal;
		color: #888;
		margin-left: 2px;
	}

	.input-sm {
		width: 100%;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 12px;
		background: white;
		box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05) inset;
		box-sizing: border-box;
	}

	.input-sm:focus {
		outline: none;
		border-color: #66afe9;
		box-shadow: 0 1px 1px rgba(0, 0, 0, 0.075) inset, 0 0 6px rgba(102, 175, 233, 0.6);
	}

	select.input-sm {
		cursor: pointer;
	}

	/* Slider styling */
	.slider {
		width: 100%;
		height: 6px;
		margin: 8px 0 4px;
		cursor: pointer;
		appearance: none;
		background: #ddd;
		border-radius: 3px;
		outline: none;
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #337ab7;
		border: none;
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #337ab7;
		border: none;
		cursor: pointer;
	}

	.toggle-row {
		display: flex;
		gap: 3px;
	}

	.toggle-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #ccc;
		border-radius: 3px;
		background: white;
		cursor: pointer;
		font-size: 13px;
		color: #333;
		transition: all 0.1s;
	}

	.toggle-btn:hover {
		background: #eee;
	}

	.toggle-btn.active {
		background: #337ab7;
		border-color: #337ab7;
		color: white;
	}

	/* Footer with delete and close */
	.popup-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		border-top: 1px solid #e0e0e0;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 12px;
		color: #d9534f;
		transition: color 0.1s;
	}

	.delete-btn:hover {
		color: #c9302c;
		text-decoration: underline;
	}

	.delete-btn svg {
		width: 14px;
		height: 14px;
	}

	.close-footer-btn {
		padding: 4px 10px;
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
		color: #333;
	}

	.close-footer-btn:hover {
		background: #e0e0e0;
	}
</style>
