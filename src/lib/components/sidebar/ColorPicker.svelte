<script lang="ts">
	import { COLOR_PALETTE } from '$lib/stores/drawStore';

	interface Props {
		value: string;
		onchange: (color: string) => void;
	}

	let { value, onchange }: Props = $props();

	let isOpen = $state(false);
	let hexInput = $state(value);
	let previewColor = $state(value);
	let originalColor = $state(value);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let dialogEl: HTMLDivElement | undefined = $state();

	// HSV state
	let hue = $state(0);
	let sat = $state(100);
	let val = $state(100);

	$effect(() => {
		hexInput = value;
		previewColor = value;
	});

	/** Svelte action: moves the element to document.body (portal) */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function toggleDialog(e: MouseEvent) {
		e.stopPropagation();
		if (isOpen) {
			doClose();
		} else {
			originalColor = value;
			previewColor = value;
			hexInput = value;
			const hsv = hexToHsv(value);
			hue = hsv.h;
			sat = hsv.s;
			val = hsv.v;
			isOpen = true;
			requestAnimationFrame(() => positionDialog());
			document.addEventListener('mousedown', handleClickOutside, true);
		}
	}

	function positionDialog() {
		if (!triggerEl || !dialogEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const dialogWidth = 220;
		let top = rect.bottom + 4;
		let left = rect.left;
		if (left + dialogWidth > window.innerWidth) {
			left = window.innerWidth - dialogWidth - 8;
		}
		if (top + 380 > window.innerHeight) {
			top = rect.top - 380 - 4;
		}
		dialogEl.style.top = `${top}px`;
		dialogEl.style.left = `${left}px`;
	}

	function selectColor(color: string) {
		previewColor = color;
		hexInput = color;
		const hsv = hexToHsv(color);
		hue = hsv.h;
		sat = hsv.s;
		val = hsv.v;
		onchange(color);
	}

	function handleHexInput() {
		const hex = hexInput.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
			previewColor = hex;
			const hsv = hexToHsv(hex);
			hue = hsv.h;
			sat = hsv.s;
			val = hsv.v;
			onchange(hex);
		}
	}

	function handleHexKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleHexInput();
	}

	function handleCancel(e: MouseEvent) {
		e.stopPropagation();
		onchange(originalColor);
		doClose();
	}

	function doClose() {
		isOpen = false;
		document.removeEventListener('mousedown', handleClickOutside, true);
	}

	function handleClickOutside(e: MouseEvent) {
		if (!isOpen) return;
		const target = e.target as HTMLElement;
		if (dialogEl?.contains(target)) return;
		if (triggerEl?.contains(target)) return;
		doClose();
	}

	// --- HSV <-> Hex ---

	function hexToHsv(hex: string): { h: number; s: number; v: number } {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;
		let h = 0;
		if (d !== 0) {
			if (max === r) h = ((g - b) / d + 6) % 6;
			else if (max === g) h = (b - r) / d + 2;
			else h = (r - g) / d + 4;
			h *= 60;
		}
		const s = max === 0 ? 0 : (d / max) * 100;
		const v = max * 100;
		return { h, s, v };
	}

	function hsvToHex(h: number, s: number, v: number): string {
		s /= 100;
		v /= 100;
		const c = v * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = v - c;
		let r = 0, g = 0, b = 0;
		if (h < 60) { r = c; g = x; }
		else if (h < 120) { r = x; g = c; }
		else if (h < 180) { g = c; b = x; }
		else if (h < 240) { g = x; b = c; }
		else if (h < 300) { r = x; b = c; }
		else { r = c; b = x; }
		const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
	}

	function updateFromHsv() {
		const hex = hsvToHex(hue, sat, val);
		previewColor = hex;
		hexInput = hex;
		onchange(hex);
	}

	// --- SV area drag ---

	function handleSVMouseDown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		updateSV(e);
		window.addEventListener('mousemove', handleSVMove);
		window.addEventListener('mouseup', handleSVUp);
	}

	function handleSVMove(e: MouseEvent) { updateSV(e); }

	function handleSVUp() {
		window.removeEventListener('mousemove', handleSVMove);
		window.removeEventListener('mouseup', handleSVUp);
	}

	function updateSV(e: MouseEvent) {
		const el = dialogEl?.querySelector('.sv-area') as HTMLElement;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		sat = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
		val = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
		updateFromHsv();
	}

	// --- Hue bar drag ---

	function handleHueMouseDown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		updateHue(e);
		window.addEventListener('mousemove', handleHueMove);
		window.addEventListener('mouseup', handleHueUp);
	}

	function handleHueMove(e: MouseEvent) { updateHue(e); }

	function handleHueUp() {
		window.removeEventListener('mousemove', handleHueMove);
		window.removeEventListener('mouseup', handleHueUp);
	}

	function updateHue(e: MouseEvent) {
		const el = dialogEl?.querySelector('.hue-bar') as HTMLElement;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		hue = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
		updateFromHsv();
	}

</script>

<div class="color-picker-wrapper">
	<button
		bind:this={triggerEl}
		class="color-trigger"
		style="background-color: {value}; {value === '#FFFFFF' ? 'border-color: #ccc;' : ''}"
		onclick={toggleDialog}
		title={value}
		aria-label="Farbe wählen"
	></button>
</div>

{#if isOpen}
	<div class="color-dialog" bind:this={dialogEl} use:portal>
		<!-- HSV saturation/value area -->
		<div
			class="sv-area"
			style="background-color: {hsvToHex(hue, 100, 100)};"
			onmousedown={handleSVMouseDown}
			role="slider"
			aria-label="Sättigung und Helligkeit"
			tabindex="-1"
		>
			<div class="sv-white"></div>
			<div class="sv-black"></div>
			<div class="sv-cursor" style="left: {sat}%; top: {100 - val}%;"></div>
		</div>

		<!-- Hue bar -->
		<div
			class="hue-bar"
			onmousedown={handleHueMouseDown}
			role="slider"
			aria-label="Farbton"
			tabindex="-1"
		>
			<div class="hue-cursor" style="left: {(hue / 360) * 100}%;"></div>
		</div>

		<!-- Palette -->
		<div class="palette">
			{#each COLOR_PALETTE as color}
				<button
					class="swatch"
					class:selected={previewColor === color}
					style="background-color: {color}; {color === '#FFFFFF' ? 'border-color: #ccc;' : ''}"
					onclick={() => selectColor(color)}
					title={color}
				></button>
			{/each}
		</div>

		<!-- Hex input + preview -->
		<div class="hex-section">
			<input
				type="text"
				class="hex-input"
				bind:value={hexInput}
				oninput={handleHexInput}
				onkeydown={handleHexKeydown}
				placeholder="#000000"
				maxlength="7"
			/>
			<div class="color-preview" style="background-color: {previewColor};"></div>
		</div>

		<!-- Actions -->
		<div class="dialog-actions">
			<button class="btn btn-cancel" onclick={handleCancel}>Abbrechen</button>
			<button class="btn btn-choose" onclick={(e) => { e.stopPropagation(); doClose(); }}>Wählen</button>
		</div>
	</div>
{/if}

<style>
	.color-picker-wrapper {
		position: relative;
		display: inline-block;
	}

	.color-trigger {
		width: 28px;
		height: 28px;
		border: 2px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
		transition: border-color 0.15s;
	}

	.color-trigger:hover {
		border-color: #999;
	}

	/* Portal-rendered dialog: position:fixed on document.body */
	.color-dialog {
		position: fixed;
		z-index: 100000;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		padding: 10px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		width: 220px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* HSV saturation/value area */
	.sv-area {
		position: relative;
		width: 100%;
		height: 120px;
		border-radius: 3px;
		cursor: crosshair;
		user-select: none;
	}

	.sv-white {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		background: linear-gradient(to right, white, transparent);
	}

	.sv-black {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		background: linear-gradient(to top, black, transparent);
	}

	.sv-cursor {
		position: absolute;
		width: 12px;
		height: 12px;
		border: 2px solid white;
		border-radius: 50%;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	/* Hue bar */
	.hue-bar {
		position: relative;
		width: 100%;
		height: 14px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000
		);
		cursor: crosshair;
		user-select: none;
	}

	.hue-cursor {
		position: absolute;
		top: -1px;
		width: 6px;
		height: 16px;
		border: 2px solid white;
		border-radius: 2px;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
		transform: translateX(-50%);
		pointer-events: none;
	}

	.palette {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 3px;
	}

	.swatch {
		width: 100%;
		aspect-ratio: 1;
		border: 2px solid transparent;
		border-radius: 3px;
		cursor: pointer;
		padding: 0;
		transition: transform 0.1s;
	}

	.swatch:hover {
		transform: scale(1.15);
	}

	.swatch.selected {
		border-color: #333;
	}

	.hex-section {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.hex-input {
		flex: 1;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 12px;
		font-family: monospace;
	}

	.hex-input:focus {
		outline: none;
		border-color: #2196f3;
	}

	.color-preview {
		width: 26px;
		height: 26px;
		border: 1px solid #ccc;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.dialog-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.btn {
		padding: 4px 10px;
		border: 1px solid transparent;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
	}

	.btn-cancel {
		background: #d9534f;
		border-color: #d43f3a;
		color: white;
	}

	.btn-cancel:hover {
		background: #c9302c;
	}

	.btn-choose {
		background: #5cb85c;
		border-color: #4cae4c;
		color: white;
	}

	.btn-choose:hover {
		background: #449d44;
	}
</style>
