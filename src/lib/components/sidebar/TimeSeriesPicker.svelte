<script lang="ts">
	/**
	 * Time picker for a SensorThings layer.
	 *
	 * Everything is UTC. The service's timestamps are UTC and windows are
	 * floored in UTC, so showing local times would put the displayed boundary in
	 * a different bucket than the one being queried.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { unByKey } from 'ol/Observable';
	import type { EventsKey } from 'ol/events';
	import type { SensorThings } from '$lib/layers/SensorThings';
	import { mapStore } from '$lib/stores/mapStore';
	import { getTimeSeriesState, setTime, setViewportFilter } from '$lib/stores/timeSeriesStore';
	import {
		timeWindow,
		needsTimeOfDay,
		resolveConfiguredTime,
		type TimeWindow
	} from '$lib/utils/time';
	import {
		daysWithData,
		bucketsWithData,
		cancelPending,
		type DayAvailability
	} from '$lib/services/timeSeriesAvailability';
	import MonthGrid from './MonthGrid.svelte';
	import type { Extent } from 'ol/extent';

	interface Props {
		layer: SensorThings;
		onClose: () => void;
	}

	let { layer, onClose }: Props = $props();

	// Not `state`: that would collide with the $state rune. The caller keys this
	// component by layer name, so the subscription never needs to follow a
	// changing prop.
	// svelte-ignore state_referenced_locally
	const tsState = getTimeSeriesState(layer.name);

	let granularity = $derived(layer.granularity);
	let showTimeOfDay = $derived(granularity ? needsTimeOfDay(granularity.unit) : false);
	let showYearSelect = $derived(granularity?.unit === 'year');
	let showMonthSelect = $derived(granularity?.unit === 'month');
	let showGrid = $derived(!showYearSelect && !showMonthSelect);

	let configMin = $derived(resolveConfiguredTime(layer.timeSeries?.min));
	let configMax = $derived(resolveConfiguredTime(layer.timeSeries?.max));

	/** The instant being edited, always a UTC instant. */
	let editing = $state<Date>(new Date());
	let browse = $state<Date>(new Date());
	let availableDays = $state<Set<number> | undefined>(undefined);
	let availableMonth = $state<string>('');
	let dayAvailability = $state<DayAvailability | undefined>(undefined);
	let availabilityDay = $state<string>('');
	let noSensorsInView = $state(false);

	let latest = $derived($tsState.time === undefined);

	/**
	 * Seed the editable instant from the layer, once, as soon as a time is
	 * known - preferring the drawn data over the requested window.
	 *
	 * Deliberately not a continuous mirror: every later store update would
	 * otherwise overwrite what the user is doing. In the "latest" state the
	 * layer keeps polling, and each poll would drag the calendar back to the
	 * newest reading's month while they were browsing another one. From here on
	 * the picker owns these two, and apply()/useLatest() move them explicitly.
	 *
	 * A plain `let`, not `$state`, so writing it cannot re-trigger the effect.
	 */
	let seeded = false;
	$effect(() => {
		if (seeded) return;
		const window = $tsState.time;
		const seed = window ? window.start : $tsState.displayedTime;
		if (!seed) return;
		editing = seed;
		browse = seed;
		seeded = true;
	});

	function scopeExtent(): Extent | undefined {
		if (!layer.getViewportFilter()) return undefined;
		const view = mapStore.getView();
		const map = mapStore.getMap();
		const size = map?.getSize();
		if (!view || !size) return undefined;
		return view.calculateExtent(size);
	}

	/** Bound the picker to the span the data actually covers. */
	let bounds = $derived.by(() => {
		void $tsState.viewportFilter;
		void $tsState.displayedTime;
		const extent = scopeExtent();
		const coverage = layer.getCoverage(extent) ?? layer.getCoverage();
		let min = configMin;
		let max = configMax;
		if (coverage) {
			min = min === undefined || coverage.start > min ? coverage.start : min;
			max = max === undefined || coverage.end < max ? coverage.end : max;
		}
		return { min, max };
	});

	/**
	 * Which days and buckets carry data.
	 *
	 * Deliberately never awaited by anything that redraws the map: showing the
	 * features is the priority, and these only grey out choices.
	 */
	async function refreshAvailability() {
		if (!granularity || showYearSelect || showMonthSelect) return;
		const extent = scopeExtent();
		const ids = layer.getDatastreamIds(extent);
		noSensorsInView = layer.getViewportFilter() && ids.length === 0;

		const year = browse.getUTCFullYear();
		const month = browse.getUTCMonth();
		try {
			const days = await daysWithData(layer, year, month, ids);
			availableDays = days;
			availableMonth = `${year}-${month}`;
		} catch (error) {
			reportAvailabilityError(error);
		}

		if (!showTimeOfDay) return;
		try {
			const buckets = await bucketsWithData(layer, editing, granularity, ids);
			if (buckets) {
				dayAvailability = buckets;
				availabilityDay = dayKey(editing);
			}
		} catch (error) {
			reportAvailabilityError(error);
		}
	}

	/**
	 * Availability is a nicety, so a failure must not break the picker - but it
	 * must not vanish silently either, or a picker that greys out nothing looks
	 * like a logic error rather than a failed request.
	 */
	function reportAvailabilityError(error: unknown) {
		if (error instanceof Error && error.name === 'AbortError') return;
		console.error('Could not determine time series availability:', error);
	}

	function dayKey(d: Date): string {
		return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
	}

	function dayIsAvailable(day: Date): boolean {
		if (availableDays === undefined) return true;
		if (`${day.getUTCFullYear()}-${day.getUTCMonth()}` !== availableMonth) return true;
		return availableDays.has(day.getUTCDate());
	}

	/** Hour/minute/second options, confined to the granularity multiple. */
	function stepped(size: number, count: number): number[] {
		const options: number[] = [];
		for (let value = 0; value < size; value += count) options.push(value);
		return options;
	}

	let hourOptions = $derived(
		granularity?.unit === 'hour' ? stepped(24, granularity.count) : stepped(24, 1)
	);
	let minuteOptions = $derived(
		granularity?.unit === 'minute'
			? stepped(60, granularity.count)
			: granularity?.unit === 'second'
				? stepped(60, 1)
				: undefined
	);
	let secondOptions = $derived(
		granularity?.unit === 'second' ? stepped(60, granularity.count) : undefined
	);

	/** Whether one option of the time selects has data behind it. */
	function slotHasData(field: 'hour' | 'minute' | 'second', value: number): boolean {
		if (!granularity || !dayAvailability) return true;
		if (dayKey(editing) !== availabilityDay) return true;
		if (field === 'hour' && granularity.unit !== 'hour') {
			return dayAvailability.hours.has(value);
		}
		const instant = new Date(
			Date.UTC(
				editing.getUTCFullYear(),
				editing.getUTCMonth(),
				editing.getUTCDate(),
				field === 'hour' ? value : editing.getUTCHours(),
				field === 'minute' ? value : editing.getUTCMinutes(),
				field === 'second' ? value : editing.getUTCSeconds()
			)
		);
		return dayAvailability.buckets.has(timeWindow(instant, granularity).start.getTime());
	}

	let yearOptions = $derived.by(() => {
		const last = bounds.max?.getUTCFullYear() ?? new Date().getUTCFullYear();
		const first = bounds.min?.getUTCFullYear() ?? last - 20;
		const years: number[] = [];
		for (let year = last; year >= first; year -= 1) years.push(year);
		return years;
	});

	const MONTHS = [
		'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
		'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
	];

	/** Apply the edited instant as a window. Redrawing the map comes first. */
	async function apply(instant: Date) {
		if (!granularity) return;
		editing = instant;
		const window: TimeWindow = timeWindow(instant, granularity);
		await setTime(layer, window);
		// availability only greys out choices, so it waits for the feature
		// request rather than competing with it for connections
		refreshAvailability();
	}

	function withField(field: 'hour' | 'minute' | 'second', value: number): Date {
		return new Date(
			Date.UTC(
				editing.getUTCFullYear(),
				editing.getUTCMonth(),
				editing.getUTCDate(),
				field === 'hour' ? value : editing.getUTCHours(),
				field === 'minute' ? value : editing.getUTCMinutes(),
				field === 'second' ? value : editing.getUTCSeconds()
			)
		);
	}

	async function useLatest() {
		await setTime(layer, undefined);
		const displayed = get(tsState).displayedTime;
		if (displayed) {
			editing = displayed;
			browse = displayed;
		}
		refreshAvailability();
	}

	function onViewportChange(active: boolean) {
		setViewportFilter(layer, active);
		refreshAvailability();
	}

	function onBrowse(month: Date) {
		// `browse` is a tracked dependency of the effect below, so paging to
		// another month re-runs the lookup on its own
		browse = month;
	}

	function pad(value: number): string {
		return String(value).padStart(2, '0');
	}

	// First lookup once the panel opens, and again whenever the month on show
	// changes. Only the reads before the first await are tracked, so writing the
	// results back cannot re-trigger this.
	$effect(() => {
		refreshAvailability();
	});

	/**
	 * Re-scope the lookups when the map settles, so panning while the picker is
	 * open updates which times are on offer.
	 *
	 * Only relevant while the viewport filter is on - otherwise availability
	 * covers every sensor and the extent makes no difference. Debounced at the
	 * same 300 ms as UrlSync, since a drag fires moveend once but a pinch-zoom
	 * can fire several. No refetch of the layer itself: the viewport choice
	 * changes which times are selectable, never which features are drawn.
	 */
	const MOVE_DEBOUNCE_MS = 300;
	let moveTimer: ReturnType<typeof setTimeout> | undefined;
	let moveEndKey: EventsKey | undefined;

	onMount(() => {
		const map = mapStore.getMap();
		if (!map) return;
		moveEndKey = map.on('moveend', () => {
			if (!layer.getViewportFilter()) return;
			clearTimeout(moveTimer);
			moveTimer = setTimeout(refreshAvailability, MOVE_DEBOUNCE_MS);
		});
	});

	onDestroy(() => {
		if (moveEndKey) unByKey(moveEndKey);
		clearTimeout(moveTimer);
		cancelPending();
	});
</script>

<div class="picker">
	<div class="header">
		<div class="section-title">Zeit</div>
		<button type="button" class="close-btn" onclick={onClose} title="Schließen" aria-label="Zeitauswahl schließen">
			<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
				<path
					d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
				/>
			</svg>
		</button>
	</div>

	<button type="button" class="latest-btn" class:active={latest} onclick={useLatest}>
		Aktuellster Wert
	</button>

	{#if showYearSelect}
		<select
			class="control"
			value={editing.getUTCFullYear()}
			onchange={(e) =>
				apply(new Date(Date.UTC(Number((e.target as HTMLSelectElement).value), 0, 1)))}
		>
			{#each yearOptions as year (year)}
				<option value={year}>{year}</option>
			{/each}
		</select>
	{:else if showMonthSelect}
		<div class="row">
			<select
				class="control"
				value={editing.getUTCMonth()}
				onchange={(e) =>
					apply(
						new Date(
							Date.UTC(editing.getUTCFullYear(), Number((e.target as HTMLSelectElement).value), 1)
						)
					)}
			>
				{#each MONTHS as label, index (label)}
					<option value={index}>{label}</option>
				{/each}
			</select>
			<select
				class="control"
				value={editing.getUTCFullYear()}
				onchange={(e) =>
					apply(
						new Date(
							Date.UTC(Number((e.target as HTMLSelectElement).value), editing.getUTCMonth(), 1)
						)
					)}
			>
				{#each yearOptions as year (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if showGrid}
		<MonthGrid
			value={editing}
			{browse}
			min={bounds.min}
			max={bounds.max}
			isAvailable={dayIsAvailable}
			onSelect={(day) =>
				apply(
					new Date(
						Date.UTC(
							day.getUTCFullYear(),
							day.getUTCMonth(),
							day.getUTCDate(),
							editing.getUTCHours(),
							editing.getUTCMinutes(),
							editing.getUTCSeconds()
						)
					)
				)}
			{onBrowse}
		/>
	{/if}

	{#if showTimeOfDay}
		<div class="row time-of-day">
			<select
				class="control"
				value={editing.getUTCHours()}
				onchange={(e) => apply(withField('hour', Number((e.target as HTMLSelectElement).value)))}
			>
				{#each hourOptions as hour (hour)}
					<option value={hour} disabled={!slotHasData('hour', hour)}>{pad(hour)}</option>
				{/each}
			</select>
			{#if minuteOptions}
				<span>:</span>
				<select
					class="control"
					value={editing.getUTCMinutes()}
					onchange={(e) =>
						apply(withField('minute', Number((e.target as HTMLSelectElement).value)))}
				>
					{#each minuteOptions as minute (minute)}
						<option value={minute} disabled={!slotHasData('minute', minute)}>{pad(minute)}</option>
					{/each}
				</select>
			{/if}
			{#if secondOptions}
				<span>:</span>
				<select
					class="control"
					value={editing.getUTCSeconds()}
					onchange={(e) =>
						apply(withField('second', Number((e.target as HTMLSelectElement).value)))}
				>
					{#each secondOptions as second (second)}
						<option value={second} disabled={!slotHasData('second', second)}>{pad(second)}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/if}

	{#if layer.hasViewportFilter}
		<div class="section-title">Auswählbare Zeiten</div>
		<label class="radio">
			<input
				type="radio"
				name={`viewport-${layer.name}`}
				checked={!$tsState.viewportFilter}
				onchange={() => onViewportChange(false)}
			/>
			Alle verfügbaren
		</label>
		<label class="radio">
			<input
				type="radio"
				name={`viewport-${layer.name}`}
				checked={$tsState.viewportFilter}
				onchange={() => onViewportChange(true)}
			/>
			Nur im Kartenausschnitt verfügbare
		</label>
		{#if noSensorsInView}
			<div class="warning">
				Keine Sensoren im Kartenausschnitt – es werden alle verfügbaren Zeiten angeboten.
			</div>
		{/if}
	{/if}
</div>

<style>
	.picker {
		padding: 8px;
		background: #fafafa;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-title {
		font-size: 12px;
		font-weight: 600;
		color: #333;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	/* pulled into the panel's padding so the glyph sits in the corner */
	.close-btn {
		display: flex;
		margin: -4px -4px 0 0;
		padding: 2px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #999;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.close-btn:hover {
		background-color: #f0f0f0;
		color: #666;
	}

	.latest-btn {
		align-self: flex-start;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		padding: 3px 8px;
		font-size: 12px;
		cursor: pointer;
		color: #333;
	}

	.latest-btn:hover {
		background: #f0f0f0;
	}

	.latest-btn.active {
		background: #e8f4fc;
		border-color: #2196f3;
		color: #2196f3;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.time-of-day {
		margin-top: 2px;
	}

	.control {
		font-size: 12px;
		padding: 2px 4px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: white;
	}

	.control option:disabled {
		color: #ccc;
	}

	.radio {
		display: flex;
		align-items: baseline;
		gap: 5px;
		font-size: 12px;
		color: #333;
	}

	.warning {
		font-size: 11px;
		color: #a94442;
	}
</style>
