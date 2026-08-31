/**
 * Answers "which times actually carry data" for a time series layer, so the
 * picker can grey out the rest.
 *
 * Both answers are scoped to a set of datastream ids, which is how the viewport
 * filter takes effect: the caller passes only the sensors currently in view.
 *
 * Availability filters by `Datastream/id`, never by rewriting the layer's own
 * `$filter`: that one is written against `Datastreams`, and turning an arbitrary
 * expression into its `Datastream/`-prefixed equivalent cannot be done reliably.
 */
import type { SensorThings } from '$lib/layers/SensorThings';
import { toStaTimestamp, timeWindow, type Duration } from '$lib/utils/time';

/**
 * The service offers no aggregation - this FROST build rejects `$apply` - so
 * availability is counted one bucket at a time. Each answer is ~30 bytes, but
 * each is also a request, so only this many run at once, leaving the browser's
 * connection pool free for the map's own tiles and features.
 */
const MAX_CONCURRENCY = 4;

/**
 * `Datastream/id in (...)` grows with the number of sensors. Past this many the
 * lookup is skipped rather than risking a url the service truncates or rejects:
 * reporting availability for the whole service instead of the layer would be a
 * wrong answer, and no answer is better than a wrong one.
 */
const MAX_IDS_IN_FILTER = 300;

/** Run `worker` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;

	async function run(): Promise<void> {
		while (next < items.length) {
			const index = next;
			next += 1;
			results[index] = await worker(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
	return results;
}

function rangeFilter(start: Date, end: Date): string {
	return `phenomenonTime ge ${toStaTimestamp(start)} and phenomenonTime lt ${toStaTimestamp(end)}`;
}

function idFilter(datastreamIds: (number | string)[]): string | undefined {
	if (datastreamIds.length === 0 || datastreamIds.length > MAX_IDS_IN_FILTER) {
		return undefined;
	}
	return `Datastream/id in (${datastreamIds.join(',')})`;
}

/** Availability of one day: which buckets carry data, and which hours. */
export interface DayAvailability {
	/** Bucket start times, epoch milliseconds. */
	buckets: Set<number>;
	/** Hours (0-23) with at least one bucket, precomputed for the hour select. */
	hours: Set<number>;
}

interface CountResponse {
	'@iot.count': number;
}

interface DataArrayResponse {
	value?: { components?: string[]; dataArray?: unknown[][] }[];
}

const cache = new Map<string, Promise<unknown>>();
const inFlight = new Set<AbortController>();

function cached<T>(key: string, produce: (signal: AbortSignal) => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit) {
		return hit as Promise<T>;
	}
	const controller = new AbortController();
	inFlight.add(controller);
	const promise = produce(controller.signal)
		.catch((error: Error) => {
			// a superseded request is not a failure, but it must not be cached
			// as an answer either
			cache.delete(key);
			throw error;
		})
		.finally(() => inFlight.delete(controller));
	cache.set(key, promise);
	return promise;
}

async function request<T>(
	layer: SensorThings,
	params: Record<string, string>,
	signal: AbortSignal
): Promise<T> {
	const response = await fetch(layer.observationsUrl(params), { signal });
	if (!response.ok) {
		throw new Error(`Could not fetch SensorThings availability. Status: ${response.status}`);
	}
	return response.json() as Promise<T>;
}

/**
 * Which days of a month carry at least one observation.
 *
 * @param month zero-based, as in Date
 * @returns days of the month (1-based), or `undefined` when the id set is
 *   empty or too large to address
 */
export function daysWithData(
	layer: SensorThings,
	year: number,
	month: number,
	datastreamIds: (number | string)[]
): Promise<Set<number> | undefined> {
	const ids = idFilter(datastreamIds);
	if (ids === undefined) {
		return Promise.resolve(undefined);
	}
	const key = `days|${layer.name}|${ids}|${year}-${month}`;

	return cached(key, async (signal) => {
		const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
		const days = Array.from({ length: dayCount }, (_, i) => i + 1);

		const counts = await mapLimit(days, MAX_CONCURRENCY, async (day) => {
			const filter = `${ids} and ${rangeFilter(
				new Date(Date.UTC(year, month, day)),
				new Date(Date.UTC(year, month, day + 1))
			)}`;
			const data = await request<CountResponse>(
				layer,
				{ $filter: filter, $count: 'true', $top: '0' },
				signal
			);
			return data['@iot.count'];
		});

		const available = new Set<number>();
		counts.forEach((count, index) => {
			if (count > 0) {
				available.add(days[index]);
			}
		});
		return available;
	});
}

/**
 * Which buckets of one day carry at least one observation.
 *
 * Unlike the day view this is a single request: the day's timestamps are
 * fetched in the compact `dataArray` form and bucketed here, which is both
 * cheaper and exact.
 */
export function bucketsWithData(
	layer: SensorThings,
	day: Date,
	granularity: Duration,
	datastreamIds: (number | string)[]
): Promise<DayAvailability | undefined> {
	const ids = idFilter(datastreamIds);
	if (ids === undefined) {
		return Promise.resolve(undefined);
	}
	const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
	const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
	const key = `buckets|${layer.name}|${ids}|${start.getTime()}|${granularity.unit}${granularity.count}`;

	return cached(key, async (signal) => {
		const data = await request<DataArrayResponse>(
			layer,
			{
				$filter: `${ids} and ${rangeFilter(start, end)}`,
				$select: 'phenomenonTime',
				$resultFormat: 'dataArray',
				$top: '20000'
			},
			signal
		);

		const buckets = new Set<number>();
		const hours = new Set<number>();
		for (const entry of data.value ?? []) {
			const column = (entry.components ?? []).indexOf('phenomenonTime');
			if (column === -1) continue;
			for (const row of entry.dataArray ?? []) {
				// an observation may carry an interval; its start is the bucket
				const stamp = new Date(String(row[column]).split('/')[0]);
				if (isNaN(stamp.getTime())) continue;
				const bucket = timeWindow(stamp, granularity).start;
				buckets.add(bucket.getTime());
				hours.add(bucket.getUTCHours());
			}
		}
		return { buckets, hours };
	});
}

/**
 * Abort everything still running. Called when the picker closes, so a month the
 * user has navigated away from stops costing requests.
 */
export function cancelPending(): void {
	inFlight.forEach((controller) => controller.abort());
	inFlight.clear();
}
