/**
 * Per-layer time-series state for the picker.
 *
 * The layer itself owns the authoritative state - it is what queries the
 * service - so this is a reactive mirror, following the per-layer
 * `Map<string, Writable<…>>` pattern in `layerStore.ts`. Components subscribe to
 * one layer's entry rather than to a store covering all of them.
 */
import { writable, type Readable, type Writable } from 'svelte/store';
import type { SensorThings } from '$lib/layers/SensorThings';
import type { TimeWindow } from '$lib/utils/time';

export interface TimeSeriesState {
	/** Selected window, or `undefined` while showing the latest data. */
	time: TimeWindow | undefined;
	/** Timestamp of the data actually drawn, which is what the line shows. */
	displayedTime: Date | undefined;
	/** Whether availability is scoped to the sensors in view. */
	viewportFilter: boolean;
	/** True while a reload triggered by the picker is in flight. */
	loading: boolean;
}

function emptyState(): TimeSeriesState {
	return { time: undefined, displayedTime: undefined, viewportFilter: false, loading: false };
}

const stores = new Map<string, Writable<TimeSeriesState>>();

function storeFor(name: string): Writable<TimeSeriesState> {
	let store = stores.get(name);
	if (!store) {
		store = writable<TimeSeriesState>(emptyState());
		stores.set(name, store);
	}
	return store;
}

/** Reactive state for one layer, created lazily. */
export function getTimeSeriesState(name: string): Readable<TimeSeriesState> {
	return { subscribe: storeFor(name).subscribe };
}

/**
 * Mirror a layer's state into its store and keep it there.
 *
 * The layer loads on its own - once through the OpenLayers loader and again on
 * every poll - and none of that goes through the picker, so without this
 * subscription the drawn time would only reach the UI when the user touched
 * something.
 *
 * @returns an unsubscribe function
 */
export function attach(layer: SensorThings): () => void {
	layer._onDataChange = () => syncFromLayer(layer);
	// the layer may already have loaded before anything mounted
	syncFromLayer(layer);
	return () => {
		layer._onDataChange = undefined;
	};
}

/** Copy the layer's current state into its store. */
export function syncFromLayer(layer: SensorThings, loading = false): void {
	storeFor(layer.name).set({
		time: layer.getTime(),
		displayedTime: layer.getDisplayedTime(),
		viewportFilter: layer.getViewportFilter(),
		loading
	});
}

/**
 * Select a window, or `undefined` for the latest data. Resolves once the new
 * data is drawn, so the caller can read the displayed time back.
 */
export async function setTime(layer: SensorThings, time: TimeWindow | undefined): Promise<void> {
	// Start the reload first: the layer stores the new window synchronously
	// before fetching, so publishing afterwards reports the selection the user
	// just made. Publishing first would announce the *previous* window and make
	// the picker jump back to it until the data arrived.
	const reload = layer.setTime(time);
	syncFromLayer(layer, true);
	try {
		await reload;
	} finally {
		syncFromLayer(layer, false);
	}
}

export function setViewportFilter(layer: SensorThings, active: boolean): void {
	layer.setViewportFilter(active);
	syncFromLayer(layer);
}

/** Forget a removed layer's state, so a re-added layer starts clean. */
export function forgetLayer(name: string): void {
	stores.delete(name);
}
