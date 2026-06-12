<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { mapStore, mapReady } from '$lib/stores/mapStore';
	import { configStore } from '$lib/stores/configStore';
	import { getLayerDisplay } from '$lib/stores/layerStore';
	import {
		transportStore,
		transportActive,
		transportShowTimetable,
		transportTimetableInfo
	} from '$lib/stores/transportStore';
    import { slide } from 'svelte/transition';

	let mapUnsub: (() => void) | null = null;
	let layerUnsubs: (() => void)[] = [];
	let initialized = false;

	onMount(() => {
		mapUnsub = mapReady.subscribe((ready) => {
			if (!ready || initialized) return;
			const map = mapStore.getMap();
			if (!map) return;

			const transportConfig = $configStore.app?.transport;
			if (!transportConfig) return;

			initialized = true;
			transportStore.initialize(map, transportConfig);

			const dayLayers = transportConfig.dayLayers ?? [];
			const nightLayers = transportConfig.nightLayers ?? [];
			const allLayers = [...dayLayers, ...nightLayers];

			function checkMode() {
				const dayVisible = dayLayers.some((n) => get(getLayerDisplay(n)).visible);
				const nightVisible = nightLayers.some((n) => get(getLayerDisplay(n)).visible);
				transportStore.setMode(dayVisible ? 'day' : nightVisible ? 'night' : null);
			}

			allLayers.forEach((name) => {
				layerUnsubs.push(getLayerDisplay(name).subscribe(checkMode));
			});
		});
	});

	onDestroy(() => {
		mapUnsub?.();
		layerUnsubs.forEach((u) => u());
		transportStore.destroy();
	});

	async function onSubmit(evt: SubmitEvent) {
		evt.preventDefault();
		const form = evt.target as HTMLFormElement;
		const fd = new FormData(form);
		const originName = fd.get('name_origin') as string;
		const destName = fd.get('name_destination') as string;

		const [originStop, destinationStop] = await Promise.all([
			transportStore.getStop(originName),
			transportStore.getStop(destName)
		]);

		const tripUrl = transportStore.createTripUrl({
			originStop,
			destinationStop,
			time: fd.get('itdTime') as string,
			date: fd.get('date-input') as string
		});

		if (tripUrl) {
			const anchor = document.getElementById('transport-trip-anchor') as HTMLAnchorElement | null;
			if (anchor) {
				anchor.href = tripUrl;
				anchor.click();
				anchor.href = '';
			}
		}
	}
</script>

{#if $transportActive}
	<div class="timetable-control" class:collapsed={!$transportShowTimetable}>
		<button
			class="timetable-header"
			onclick={() => transportStore.toggleTimetable()}
			title={$transportShowTimetable ? 'Fahrplanauskunft einklappen' : 'Fahrplanauskunft aufklappen'}
		>
			<span class="header-label">Fahrplanauskunft</span>
			<span class="toggle-icon">{$transportShowTimetable ? '−' : '+'}</span>
		</button>

		{#if $transportShowTimetable}
			<form class="timetable-form" onsubmit={onSubmit} transition:slide>
				<input type="hidden" name="place_origin" value={$transportTimetableInfo.originCity} />
				<input
					type="hidden"
					name="place_destination"
					value={$transportTimetableInfo.destinationCity}
				/>

				<div class="field-row">
					<label for="transport-origin">Von</label>
					<input
						id="transport-origin"
						type="text"
						name="name_origin"
						autocomplete="off"
						placeholder="Haltestelle"
						value={$transportTimetableInfo.origin}
						oninput={(e) => transportStore.setOrigin((e.target as HTMLInputElement).value)}
					/>
				</div>

				<div class="field-row">
					<label for="transport-dest">Nach</label>
					<input
						id="transport-dest"
						type="text"
						name="name_destination"
						autocomplete="off"
						placeholder="Haltestelle"
						value={$transportTimetableInfo.destination}
						oninput={(e) => transportStore.setDestination((e.target as HTMLInputElement).value)}
					/>
				</div>

				<div class="date-time-row">
					<div class="field-row date-field">
						<label for="transport-date">Datum</label>
						<input
							id="transport-date"
							type="text"
							name="date-input"
							value={$transportTimetableInfo.date}
							oninput={(e) => transportStore.setDate((e.target as HTMLInputElement).value)}
						/>
					</div>
					<div class="field-row time-field">
						<label for="transport-time">Zeit</label>
						<input
							id="transport-time"
							type="text"
							name="itdTime"
							value={$transportTimetableInfo.time}
							oninput={(e) => transportStore.setTime((e.target as HTMLInputElement).value)}
						/>
					</div>
				</div>

				<button type="submit" class="search-btn">Verbindung suchen</button>

				<!-- hidden anchor to open trip planner without popup blocking -->
				<a id="transport-trip-anchor" target="_blank" rel="noopener noreferrer" style="display:none"
				></a>
			</form>
		{/if}
	</div>
{/if}

<style>
	.timetable-control {
		position: absolute;
		bottom: 10px;
		left: 10px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		width: 240px;
		z-index: 9;
		overflow: hidden;
	}

	.timetable-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 10px 12px;
		background: #fa6400;
		color: white;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		text-align: left;
		transition: background-color 0.15s;
	}

	.timetable-header:hover {
		background: #d45500;
	}

	.toggle-icon {
		font-size: 16px;
		line-height: 1;
	}

	.timetable-form {
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.field-row label {
		font-size: 11px;
		color: #666;
		font-weight: 500;
	}

	.field-row input {
		padding: 5px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		width: 100%;
		box-sizing: border-box;
	}

	.field-row input:focus {
		outline: none;
		border-color: #fa6400;
	}

	.date-time-row {
		display: flex;
		gap: 8px;
	}

	.date-field {
		flex: 3;
	}

	.time-field {
		flex: 2;
	}

	.search-btn {
		padding: 7px 12px;
		background: #fa6400;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
		transition: background-color 0.15s;
		width: 100%;
	}

	.search-btn:hover {
		background: #d45500;
	}
</style>
