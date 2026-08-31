<script lang="ts">
	/**
	 * A calendar working entirely in UTC, with the drill-down the AngularJS app's
	 * uib-datepicker uses: the title zooms out to months, then to a decade of
	 * years, and picking drills back down.
	 *
	 * Hand-rolled rather than taken from a library because everything here is
	 * UTC: a picker dealing in local Dates would, for a German user, turn
	 * "20 August" into 2026-08-19T22:00Z, which floors into the previous day's
	 * bucket.
	 *
	 * Browsing costs nothing: only the day view reports availability, so paging
	 * through years never triggers a lookup.
	 */
	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	const MONTHS_SHORT = [
		'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
		'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
	];
	const MONTHS = [
		'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
		'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
	];

	interface Props {
		/** The selected day, as a UTC instant. */
		value: Date;
		/** The month on show, as a UTC instant; changes as the user pages. */
		browse: Date;
		min?: Date;
		max?: Date;
		/** Days without data are greyed; unknown availability reads as available. */
		isAvailable?: (day: Date) => boolean;
		onSelect: (day: Date) => void;
		onBrowse: (month: Date) => void;
	}

	let { value, browse, min, max, isAvailable, onSelect, onBrowse }: Props = $props();

	const DAY_MS = 24 * 60 * 60 * 1000;

	type Mode = 'day' | 'month' | 'year';
	let mode = $state<Mode>('day');

	/**
	 * What the header is paging through, which is not the same as the month the
	 * day view shows. Stepping a year in month view moves this but leaves the
	 * day view alone, so `onBrowse` - and with it the availability lookup - only
	 * fires once a month is actually chosen.
	 */
	// Seeded from the prop for the first render; the effect below keeps it in
	// step afterwards, so capturing the initial value here is intended.
	// svelte-ignore state_referenced_locally
	let viewDate = $state<Date>(browse);
	$effect(() => {
		viewDate = browse;
	});

	/** Six rows of seven, starting on the Monday on or before the 1st. */
	let cells = $derived.by(() => {
		const first = Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1);
		const weekday = (new Date(first).getUTCDay() + 6) % 7;
		const gridStart = first - weekday * DAY_MS;
		return Array.from({ length: 42 }, (_, i) => new Date(gridStart + i * DAY_MS));
	});

	/** The decade shown in year mode, starting on a round ten. */
	let decadeStart = $derived(Math.floor(viewDate.getUTCFullYear() / 10) * 10);
	let decadeYears = $derived(Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i));

	function startOfDay(d: Date): number {
		return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	}

	function sameDay(a: Date, b: Date): boolean {
		return startOfDay(a) === startOfDay(b);
	}

	function inBrowsedMonth(day: Date): boolean {
		return (
			day.getUTCMonth() === viewDate.getUTCMonth() &&
			day.getUTCFullYear() === viewDate.getUTCFullYear()
		);
	}

	function dayDisabled(day: Date): boolean {
		if (min && startOfDay(day) < startOfDay(min)) return true;
		if (max && startOfDay(day) > startOfDay(max)) return true;
		// unknown availability must read as selectable, or the whole grid greys
		// out until the counts arrive
		return isAvailable ? !isAvailable(day) : false;
	}

	/** A month is out of range only when no day of it is in range. */
	function monthDisabled(year: number, month: number): boolean {
		const first = Date.UTC(year, month, 1);
		const last = Date.UTC(year, month + 1, 0);
		if (min && last < startOfDay(min)) return true;
		if (max && first > startOfDay(max)) return true;
		return false;
	}

	function yearDisabled(year: number): boolean {
		if (min && year < min.getUTCFullYear()) return true;
		if (max && year > max.getUTCFullYear()) return true;
		return false;
	}

	/**
	 * Paging steps by month, year or decade depending on the view. Only the day
	 * view's step reaches the parent; the others just move what is on show.
	 */
	function step(direction: number) {
		const y = viewDate.getUTCFullYear();
		const m = viewDate.getUTCMonth();
		if (mode === 'day') {
			onBrowse(new Date(Date.UTC(y, m + direction, 1)));
		} else if (mode === 'month') {
			viewDate = new Date(Date.UTC(y + direction, m, 1));
		} else {
			viewDate = new Date(Date.UTC(y + direction * 10, m, 1));
		}
	}

	function zoomOut() {
		mode = mode === 'day' ? 'month' : 'year';
	}

	function pickMonth(month: number) {
		onBrowse(new Date(Date.UTC(viewDate.getUTCFullYear(), month, 1)));
		mode = 'day';
	}

	function pickYear(year: number) {
		// stays inside the grid: the day view has not moved yet
		viewDate = new Date(Date.UTC(year, viewDate.getUTCMonth(), 1));
		mode = 'month';
	}

	let title = $derived.by(() => {
		if (mode === 'day') return `${MONTHS[viewDate.getUTCMonth()]} ${viewDate.getUTCFullYear()}`;
		if (mode === 'month') return String(viewDate.getUTCFullYear());
		return `${decadeStart} – ${decadeStart + 9}`;
	});
</script>

<div class="month-grid">
	<div class="header">
		<button type="button" class="nav" onclick={() => step(-1)} aria-label="Zurück">‹</button>
		<button
			type="button"
			class="title"
			onclick={zoomOut}
			disabled={mode === 'year'}
			title={mode === 'year' ? '' : 'Zeitraum wechseln'}
		>
			{title}
		</button>
		<button type="button" class="nav" onclick={() => step(1)} aria-label="Vor">›</button>
	</div>

	{#if mode === 'day'}
		<div class="weekdays">
			{#each WEEKDAYS as day (day)}
				<span>{day}</span>
			{/each}
		</div>

		<div class="days">
			{#each cells as day (day.getTime())}
				<button
					type="button"
					class="cell day"
					class:outside={!inBrowsedMonth(day)}
					class:selected={sameDay(day, value)}
					disabled={dayDisabled(day)}
					onclick={() => onSelect(day)}
				>
					{day.getUTCDate()}
				</button>
			{/each}
		</div>
	{:else if mode === 'month'}
		<div class="months">
			{#each MONTHS_SHORT as label, index (label)}
				<button
					type="button"
					class="cell wide"
					class:selected={viewDate.getUTCFullYear() === value.getUTCFullYear() &&
						index === value.getUTCMonth()}
					disabled={monthDisabled(viewDate.getUTCFullYear(), index)}
					onclick={() => pickMonth(index)}
				>
					{label}
				</button>
			{/each}
		</div>
	{:else}
		<div class="months">
			{#each decadeYears as year (year)}
				<button
					type="button"
					class="cell wide"
					class:outside={year < decadeStart || year > decadeStart + 9}
					class:selected={year === value.getUTCFullYear()}
					disabled={yearDisabled(year)}
					onclick={() => pickYear(year)}
				>
					{year}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.month-grid {
		font-size: 12px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.title {
		flex: 1;
		background: none;
		border: none;
		cursor: pointer;
		font-weight: 500;
		font-size: 12px;
		color: #333;
		padding: 2px 4px;
		border-radius: 4px;
	}

	.title:hover:not(:disabled) {
		background-color: #f0f0f0;
	}

	.title:disabled {
		cursor: default;
	}

	.nav {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		padding: 2px 8px;
		color: #666;
		border-radius: 4px;
	}

	.nav:hover {
		background-color: #f0f0f0;
	}

	.weekdays,
	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
	}

	.months {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}

	.weekdays span {
		text-align: center;
		color: #999;
		font-size: 11px;
		padding: 2px 0;
	}

	.cell {
		background: none;
		border: none;
		cursor: pointer;
		padding: 3px 0;
		font-size: 12px;
		color: #333;
		border-radius: 3px;
	}

	.cell.wide {
		padding: 6px 0;
	}

	.cell:hover:not(:disabled) {
		background-color: #e8f4fc;
	}

	.cell.outside {
		color: #bbb;
	}

	.cell.selected {
		background-color: #2196f3;
		color: white;
	}

	.cell:disabled {
		color: #ddd;
		cursor: default;
	}

	.day:disabled {
		text-decoration: line-through;
	}
</style>
