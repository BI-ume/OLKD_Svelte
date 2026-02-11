<script lang="ts">
	import { sidebarStore } from '$lib/stores/sidebarStore';
	import { drawStore, drawActiveTool, drawFeatureCount, drawLayerVisible, type DrawTool } from '$lib/stores/drawStore';

	function handleBack() {
		drawStore.setTool('none');
		sidebarStore.hideDraw();
	}

	let fileInput: HTMLInputElement | undefined = $state();

	function selectTool(tool: DrawTool) {
		if (!$drawLayerVisible) drawStore.setLayerVisible(true);
		const current = $drawActiveTool;
		drawStore.setTool(current === tool ? 'none' : tool);
	}

	function handleExport() {
		const geojson = drawStore.exportGeoJSON();
		if (!geojson) return;

		const blob = new Blob([geojson], { type: 'application/geo+json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'zeichnung.geojson';
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImport() {
		fileInput?.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			const text = reader.result as string;
			drawStore.importGeoJSON(text);
		};
		reader.readAsText(file);
		input.value = '';
	}
</script>

<div class="draw-panel">
	<button class="draw-header" onclick={handleBack} title="Zurück zur Übersicht">
		<svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="15 18 9 12 15 6"></polyline>
		</svg>
		<h2 class="draw-title">Zeichnen</h2>
	</button>

	<div class="draw-content">
		<div class="tool-section">
			<label class="section-label">Zeichnen</label>
			<div class="tool-grid">
				<button
					class="tool-btn"
					class:active={$drawActiveTool === 'point'}
					onclick={() => selectTool('point')}
					title="Punkt zeichnen"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="4"></circle>
					</svg>
					<span>Punkt</span>
				</button>

				<button
					class="tool-btn"
					class:active={$drawActiveTool === 'line'}
					onclick={() => selectTool('line')}
					title="Linie zeichnen"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 20 L20 4"></path>
						<circle cx="4" cy="20" r="2"></circle>
						<circle cx="20" cy="4" r="2"></circle>
					</svg>
					<span>Linie</span>
				</button>

				<button
					class="tool-btn"
					class:active={$drawActiveTool === 'polygon'}
					onclick={() => selectTool('polygon')}
					title="Polygon zeichnen"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6 L12 3 L21 6 L21 18 L12 21 L3 18 Z"></path>
					</svg>
					<span>Polygon</span>
				</button>

				<button
					class="tool-btn"
					class:active={$drawActiveTool === 'text'}
					onclick={() => selectTool('text')}
					title="Text platzieren"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 7V4h16v3"></path>
						<line x1="12" y1="4" x2="12" y2="20"></line>
						<line x1="8" y1="20" x2="16" y2="20"></line>
					</svg>
					<span>Text</span>
				</button>
			</div>
		</div>

		<div class="tool-section">
			<label class="section-label">Bearbeiten</label>
			<div class="tool-grid">
				<button
					class="tool-btn"
					class:active={$drawActiveTool === 'modify'}
					onclick={() => selectTool('modify')}
					title="Geometrie verschieben/verformen"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 20h9"></path>
						<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
					</svg>
					<span>Geometrie</span>
				</button>
			</div>
			<p class="tool-hint">Klicken Sie auf ein Objekt, um Stil und Eigenschaften zu bearbeiten.</p>
		</div>

		{#if $drawFeatureCount > 0}
			<div class="action-section">
				<div class="feature-info">
					<span class="feature-count">
						{$drawFeatureCount} {$drawFeatureCount === 1 ? 'Objekt' : 'Objekte'}
					</span>
					<button
						class="visibility-toggle"
						onclick={() => drawStore.toggleLayerVisibility()}
						title={$drawLayerVisible ? 'Zeichnung ausblenden' : 'Zeichnung einblenden'}
					>
						{#if $drawLayerVisible}
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
							</svg>
						{/if}
					</button>
				</div>
				<div class="action-row">
					<button class="action-btn export-btn" onclick={handleExport} title="Als GeoJSON exportieren">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="7 10 12 15 17 10"></polyline>
							<line x1="12" y1="15" x2="12" y2="3"></line>
						</svg>
						Export
					</button>
					<button class="action-btn import-btn" onclick={handleImport} title="GeoJSON importieren">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="17 8 12 3 7 8"></polyline>
							<line x1="12" y1="3" x2="12" y2="15"></line>
						</svg>
						Import
					</button>
				</div>
				<button class="action-btn clear-btn" onclick={() => drawStore.clearAll()}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"></path>
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
					</svg>
					Alle löschen
				</button>
			</div>
		{:else}
			<div class="action-section">
				<button class="action-btn import-btn" onclick={handleImport} title="GeoJSON importieren">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="17 8 12 3 7 8"></polyline>
						<line x1="12" y1="3" x2="12" y2="15"></line>
					</svg>
					GeoJSON importieren
				</button>
			</div>
		{/if}
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept=".geojson,.json"
		onchange={handleFileChange}
		style="display: none;"
	/>
</div>

<style>
	.draw-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.draw-header {
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

	.draw-header:hover {
		background: #e8e8e8;
	}

	.back-icon {
		width: 24px;
		height: 24px;
		color: #666;
		flex-shrink: 0;
	}

	.draw-header:hover .back-icon {
		color: #333;
	}

	.draw-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.draw-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.tool-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tool-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.tool-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 8px;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 0.15s, background-color 0.15s;
		font-size: 12px;
		color: #333;
	}

	.tool-btn:hover {
		border-color: #ccc;
		background: #fafafa;
	}

	.tool-btn.active {
		border-color: #ff9800;
		background: #fff3e0;
		color: #e65100;
	}

	.tool-btn svg {
		width: 22px;
		height: 22px;
	}

	.tool-hint {
		margin: 0;
		font-size: 11px;
		color: #888;
		font-style: italic;
	}

	.action-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid #e0e0e0;
	}

	.feature-info {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.feature-count {
		font-size: 13px;
		color: #666;
	}

	.visibility-toggle {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #2196f3;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.visibility-toggle:hover {
		background-color: #f0f0f0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.action-btn svg {
		width: 16px;
		height: 16px;
	}

	.action-row {
		display: flex;
		gap: 8px;
	}

	.action-row .action-btn {
		flex: 1;
	}

	.export-btn {
		background: #e3f2fd;
		color: #1565c0;
	}

	.export-btn:hover {
		background: #bbdefb;
	}

	.import-btn {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.import-btn:hover {
		background: #c8e6c9;
	}

	.clear-btn {
		background: #ffebee;
		color: #c62828;
	}

	.clear-btn:hover {
		background: #ffcdd2;
	}
</style>
