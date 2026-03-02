<script lang="ts">
	import { sidebarStore } from '$lib/stores/sidebarStore';
	import { mapStore } from '$lib/stores/mapStore';
	import { layerStore } from '$lib/stores/layerStore';
	import { drawStore, drawFeatureCount, drawLayerVisible } from '$lib/stores/drawStore';
	import { appConfig } from '$lib/stores/configStore';
	import {
		printStore,
		printSettings,
		printStatus,
		printJob,
		printError,
		MIN_SCALE,
		MAX_SCALE,
		MIN_PAGE_SIZE,
		MAX_PAGE_SIZE
	} from '$lib/stores/printStore';

	// Paper sizes in ascending order (A5 = smallest, A0 = largest)
	const SIZE_ORDER = ['a5', 'a4', 'a3', 'a2', 'a1', 'a0'];

	let scaleInput = $state($printSettings.scale);
	let widthInput = $state($printSettings.pageSize.width);
	let heightInput = $state($printSettings.pageSize.height);
	let sliderIndex = $state(0);

	// Layouts enabled in this config (with fallback to A4+A3)
	const enabledLayouts = $derived(
		$appConfig?.printConfig?.enabledPageLayouts ??
		['a4-portrait', 'a4-landscape', 'a3-portrait', 'a3-landscape']
	);

	// Unique paper sizes present in enabledLayouts, in size order
	const availableSizes = $derived(
		SIZE_ORDER.filter(size => enabledLayouts.some(l => l.startsWith(size + '-')))
	);

	// Whether user has entered custom (non-ISO) dimensions
	const isCustomLayout = $derived($printSettings.layout === 'custom');

	// Current paper size key (e.g. 'a4') and orientation ('portrait'/'landscape')
	const currentSize = $derived(
		isCustomLayout ? null : $printSettings.layout.split('-')[0]
	);
	const currentOrientation = $derived(
		isCustomLayout ? null : ($printSettings.layout.split('-')[1] as 'portrait' | 'landscape')
	);

	// Sync scalar inputs when settings change externally
	$effect(() => { scaleInput = $printSettings.scale; });
	$effect(() => {
		widthInput = $printSettings.pageSize.width;
		heightInput = $printSettings.pageSize.height;
	});

	// Keep slider in sync with layout changes (but freeze position on custom)
	$effect(() => {
		if (!isCustomLayout && currentSize) {
			const idx = availableSizes.indexOf(currentSize);
			if (idx >= 0) sliderIndex = idx;
		}
	});

	function isOrientationEnabled(orientation: 'portrait' | 'landscape'): boolean {
		const size = availableSizes[sliderIndex] ?? 'a4';
		return enabledLayouts.includes(`${size}-${orientation}`);
	}

	function handleBack() {
		sidebarStore.hidePrint();
	}

	function handleSliderChange(e: Event) {
		const idx = parseInt((e.target as HTMLInputElement).value, 10);
		sliderIndex = idx;
		const size = availableSizes[idx];
		const preferred = currentOrientation ?? 'portrait';
		const key = `${size}-${preferred}`;
		if (enabledLayouts.includes(key)) {
			printStore.setLayout(key);
		} else {
			const alt = preferred === 'portrait' ? 'landscape' : 'portrait';
			const altKey = `${size}-${alt}`;
			if (enabledLayouts.includes(altKey)) printStore.setLayout(altKey);
		}
	}

	function handleOrientationSelect(orientation: 'portrait' | 'landscape') {
		const size = currentSize ?? (availableSizes[sliderIndex] ?? 'a4');
		const key = `${size}-${orientation}`;
		if (enabledLayouts.includes(key)) printStore.setLayout(key);
	}

	function handleScaleChange(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(value)) printStore.setScale(value);
	}

	function handleScaleBlur() {
		scaleInput = $printSettings.scale;
	}

	function handleWidthChange(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(value)) {
			printStore.setPageSize({ width: value, height: $printSettings.pageSize.height });
		}
	}

	function handleHeightChange(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(value)) {
			printStore.setPageSize({ width: $printSettings.pageSize.width, height: value });
		}
	}

	function handleSizeBlur() {
		widthInput = $printSettings.pageSize.width;
		heightInput = $printSettings.pageSize.height;
	}

	function handleFormatChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value as 'pdf' | 'png';
		printStore.setOutputFormat(value);
	}

	async function handlePrint() {
		const map = mapStore.getMap();
		if (!map) return;

		const view = map.getView();
		const extent = view.calculateExtent(map.getSize());
		const bbox: [number, number, number, number] = [
			extent[0], extent[1], extent[2], extent[3]
		];

		const layers = layerStore.getVisibleLayerNames();
		const opacities = layerStore.getLayerOpacities();
		const drawGeoJSON = ($drawFeatureCount > 0 && $drawLayerVisible)
			? drawStore.exportGeoJSON()
			: null;
		await printStore.submitPrint(bbox, layers, opacities, 25832, drawGeoJSON);
	}

	function handleDownload() {
		if ($printJob?.downloadUrl) {
			window.open($printJob.downloadUrl, '_blank');
		}
	}

	let isProcessing = $derived(
		$printStatus === 'preparing' || $printStatus === 'processing'
	);

	let isValid = $derived(
		$printSettings.scale > 0 &&
		$printSettings.pageSize.width >= MIN_PAGE_SIZE &&
		$printSettings.pageSize.height >= MIN_PAGE_SIZE
	);
</script>

<div class="print-panel">
	<button class="print-header" onclick={handleBack} title="Zurück zur Übersicht">
		<svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="15 18 9 12 15 6"></polyline>
		</svg>
		<h2 class="print-title">Karte drucken</h2>
	</button>

	<div class="print-content">
		<!-- Paper size slider + orientation toggle -->
		<div class="form-group">
			<label class="form-label">Seitengröße</label>
			<div class="size-selector" class:is-custom={isCustomLayout}>
				{#if availableSizes.length > 1}
					<input
						class="size-slider"
						type="range"
						min="0"
						max={availableSizes.length - 1}
						step="1"
						value={sliderIndex}
						oninput={handleSliderChange}
						disabled={isProcessing}
						aria-label="Papiergröße wählen"
					/>
					<div class="size-labels" aria-hidden="true">
						{#each availableSizes as size}
							<span
								class="size-label"
								class:active={size === currentSize && !isCustomLayout}
							>{size.toUpperCase()}</span>
						{/each}
					</div>
				{/if}
				<div class="orientation-row">
					<button
						class="orientation-btn"
						class:selected={currentOrientation === 'portrait' && !isCustomLayout}
						onclick={() => handleOrientationSelect('portrait')}
						disabled={isProcessing || !isOrientationEnabled('portrait')}
						title="Hochformat"
					>
						<div class="page-icon portrait"></div>
						<span>Hochformat</span>
					</button>
					<button
						class="orientation-btn"
						class:selected={currentOrientation === 'landscape' && !isCustomLayout}
						onclick={() => handleOrientationSelect('landscape')}
						disabled={isProcessing || !isOrientationEnabled('landscape')}
						title="Querformat"
					>
						<div class="page-icon landscape"></div>
						<span>Querformat</span>
					</button>
					{#if isCustomLayout}
						<span class="custom-label">Benutzerdefiniert</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Width / Height -->
		<div class="form-row">
			<div class="form-group half">
				<label class="form-label" for="print-width">Breite</label>
				<div class="input-with-unit">
					<input
						id="print-width"
						type="number"
						bind:value={widthInput}
						onchange={handleWidthChange}
						onblur={handleSizeBlur}
						min={MIN_PAGE_SIZE}
						max={MAX_PAGE_SIZE}
						disabled={isProcessing}
					/>
					<span class="unit">mm</span>
				</div>
			</div>
			<span class="size-separator">&times;</span>
			<div class="form-group half">
				<label class="form-label" for="print-height">Höhe</label>
				<div class="input-with-unit">
					<input
						id="print-height"
						type="number"
						bind:value={heightInput}
						onchange={handleHeightChange}
						onblur={handleSizeBlur}
						min={MIN_PAGE_SIZE}
						max={MAX_PAGE_SIZE}
						disabled={isProcessing}
					/>
					<span class="unit">mm</span>
				</div>
			</div>
		</div>

		<!-- Scale / Output Format -->
		<div class="form-row">
			<div class="form-group half">
				<label class="form-label" for="print-scale">Maßstab</label>
				<div class="input-with-unit">
					<span class="unit prefix">1 :</span>
					<input
						id="print-scale"
						type="number"
						bind:value={scaleInput}
						onchange={handleScaleChange}
						onblur={handleScaleBlur}
						min={MIN_SCALE}
						max={MAX_SCALE}
						step="100"
						disabled={isProcessing}
					/>
				</div>
			</div>
			<div class="form-group half">
				<label class="form-label" for="print-format">Ausgabeformat</label>
				<select
					id="print-format"
					class="form-select"
					value={$printSettings.outputFormat}
					onchange={handleFormatChange}
					disabled={isProcessing}
				>
					<option value="pdf">PDF</option>
					<option value="png">PNG</option>
				</select>
			</div>
		</div>

		<!-- Submit -->
		<button
			class="submit-btn"
			onclick={handlePrint}
			disabled={isProcessing || !isValid}
		>
			{#if isProcessing}
				<span class="spinner"></span>
				{#if $printStatus === 'preparing'}
					Vorbereiten...
				{:else}
					Verarbeiten...
				{/if}
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14 2 14 8 20 8"></polyline>
					<line x1="12" y1="18" x2="12" y2="12"></line>
					<polyline points="9 15 12 18 15 15"></polyline>
				</svg>
				Karte ausgeben
			{/if}
		</button>

		<!-- Status -->
		{#if $printStatus === 'ready' && $printJob}
			<div class="status status-ready">
				<span>Exportvorgang abgeschlossen.</span>
				<button class="download-btn" onclick={handleDownload}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
					Dokument herunterladen
				</button>
			</div>
		{/if}

		{#if $printStatus === 'error' && $printError}
			<div class="status status-error">
				<span>Es ist ein Fehler aufgetreten.<br>Bitte probieren Sie es später noch einmal.</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.print-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.print-header {
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

	.print-header:hover {
		background: #e8e8e8;
	}

	.back-icon {
		width: 24px;
		height: 24px;
		color: #666;
		flex-shrink: 0;
	}

	.print-header:hover .back-icon {
		color: #333;
	}

	.print-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.print-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Form elements */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-row {
		display: flex;
		gap: 12px;
	}

	.form-group.half {
		flex: 1;
	}

	/* Size selector: slider + orientation toggle */
	.size-selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.size-slider {
		width: 100%;
		cursor: pointer;
		accent-color: #2196f3;
		transition: opacity 0.2s;
	}

	/* When user has entered custom dimensions, grey out the slider thumb */
	.size-selector.is-custom .size-slider {
		opacity: 0.35;
	}

	.size-selector.is-custom .size-slider::-webkit-slider-thumb {
		background: #bdbdbd;
	}
	.size-selector.is-custom .size-slider::-moz-range-thumb {
		background: #bdbdbd;
	}

	.size-labels {
		display: flex;
		justify-content: space-between;
		padding: 0 10px; /* approximate thumb half-width offset */
		margin-top: -4px;
	}

	.size-label {
		font-size: 11px;
		color: #aaa;
		text-align: center;
		flex: 1;
		transition: color 0.15s, font-weight 0.15s;
	}

	.size-label.active {
		color: #2196f3;
		font-weight: 700;
	}

	/* Orientation toggle */
	.orientation-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.orientation-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		color: #333;
		transition: border-color 0.15s, background-color 0.15s;
	}

	.orientation-btn:hover:not(:disabled) {
		border-color: #ccc;
	}

	.orientation-btn.selected {
		border-color: #2196f3;
		background: #e3f2fd;
	}

	.orientation-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.page-icon {
		background: #e0e0e0;
		border: 1px solid #aaa;
		flex-shrink: 0;
	}

	.page-icon.portrait {
		width: 14px;
		height: 20px;
	}

	.page-icon.landscape {
		width: 20px;
		height: 14px;
	}

	.orientation-btn.selected .page-icon {
		background: #90caf9;
		border-color: #42a5f5;
	}

	.custom-label {
		font-size: 11px;
		color: #9e9e9e;
		font-style: italic;
		margin-left: auto;
	}

	.size-separator {
		align-self: flex-end;
		padding-bottom: 7px;
		font-size: 14px;
		color: #999;
	}

	/* Input with unit addon */
	.input-with-unit {
		display: flex;
		align-items: stretch;
		border: 1px solid #ccc;
		border-radius: 4px;
		overflow: hidden;
	}

	.input-with-unit:focus-within {
		border-color: #2196f3;
	}

	.input-with-unit input {
		flex: 1;
		min-width: 0;
		padding: 6px 8px;
		border: none;
		font-size: 13px;
		outline: none;
		text-align: right;
	}

	.input-with-unit input:disabled {
		background: #f5f5f5;
		color: #999;
	}

	.unit {
		display: flex;
		align-items: center;
		padding: 0 8px;
		background: #f0f0f0;
		border-left: 1px solid #ccc;
		font-size: 12px;
		color: #666;
		white-space: nowrap;
	}

	.unit.prefix {
		border-left: none;
		border-right: 1px solid #ccc;
		font-weight: 500;
	}

	/* Select */
	.form-select {
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		background: white;
		cursor: pointer;
	}

	.form-select:focus {
		outline: none;
		border-color: #2196f3;
	}

	.form-select:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	/* Submit button */
	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 24px;
		margin-top: 4px;
		background: #4caf50;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.submit-btn:hover:not(:disabled) {
		background: #43a047;
	}

	.submit-btn:disabled {
		background: #9e9e9e;
		cursor: not-allowed;
	}

	.submit-btn svg {
		width: 20px;
		height: 20px;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Status messages */
	.status {
		padding: 12px;
		border-radius: 4px;
		font-size: 13px;
		line-height: 1.5;
		text-align: center;
	}

	.status-ready {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		background: #e8f5e9;
		color: #2e7d32;
	}

	.status-error {
		background: #ffebee;
		color: #c62828;
	}

	.download-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: #2e7d32;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.download-btn:hover {
		background: #1b5e20;
	}

	.download-btn svg {
		width: 16px;
		height: 16px;
	}
</style>
