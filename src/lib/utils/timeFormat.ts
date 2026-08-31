/**
 * Display formatting for time-series times.
 *
 * All output is UTC, matching what is queried: a window floored in UTC but
 * shown in local time would name a different bucket than the one on the map.
 */
import type { Duration } from './time';

const MONTHS = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];

function pad(value: number, length = 2): string {
	return String(value).padStart(length, '0');
}

/** ISO week number of the week containing `date`. */
function isoWeek(date: Date): number {
	const target = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	);
	// Thursday of the current ISO week decides which year the week belongs to
	target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
	const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
	firstThursday.setUTCDate(
		firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7)
	);
	return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/**
 * Format an instant at the precision its granularity addresses - showing
 * minutes for a `P1M` layer would imply a precision the data does not have.
 */
export function formatBucket(date: Date, granularity: Duration | undefined): string {
	const day = `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;

	switch (granularity?.unit) {
		case 'second':
			return `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
		case 'minute':
		case 'hour':
			return `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
		case 'week':
			return `KW ${pad(isoWeek(date))}/${date.getUTCFullYear()}`;
		case 'month':
			return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
		case 'year':
			return String(date.getUTCFullYear());
		default:
			return day;
	}
}
