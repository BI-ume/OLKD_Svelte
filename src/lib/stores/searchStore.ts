import { writable, derived } from 'svelte/store';
import WKT from 'ol/format/WKT';
import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';

export interface SearchResult {
	label: string;
	geom: string; // WKT geometry
	sml?: number; // 1 = best match
	projectionCode: string;
}

export interface ParsedSearchResult extends SearchResult {
	feature: Feature<Geometry>;
}

interface SearchState {
	query: string;
	results: SearchResult[];
	isLoading: boolean;
	error: string | null;
	selectedResult: SearchResult | null;
}

const SEARCH_URL = 'https://stadtplan.bielefeld.de/search/';
const MIN_SEARCH_CHARS = 3;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 20;

function createSearchStore() {
	const { subscribe, set, update } = writable<SearchState>({
		query: '',
		results: [],
		isLoading: false,
		error: null,
		selectedResult: null
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let abortController: AbortController | null = null;

	async function search(query: string): Promise<void> {
		// Clear previous debounce timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Abort previous request
		if (abortController) {
			abortController.abort();
		}

		// Update query immediately
		update((state) => ({ ...state, query }));

		// Don't search if query is too short
		if (query.length < MIN_SEARCH_CHARS) {
			update((state) => ({
				...state,
				results: [],
				isLoading: false,
				error: null
			}));
			return;
		}

		// Debounce the actual search
		debounceTimer = setTimeout(async () => {
			update((state) => ({ ...state, isLoading: true, error: null }));

			abortController = new AbortController();

			try {
				const url = new URL(SEARCH_URL);
				url.searchParams.set('term', query);
				url.searchParams.set('maxresults', MAX_RESULTS.toString());

				const response = await fetch(url.toString(), {
					method: 'GET',
					signal: abortController.signal
				});

				if (!response.ok) {
					throw new Error(`Search failed: ${response.status}`);
				}

				const data = await response.json();

				// Transform results to include projection code
				const results: SearchResult[] = data.map((item: { label: string; geom: string; sml?: number }) => ({
					label: item.label,
					geom: item.geom,
					sml: item.sml,
					projectionCode: 'EPSG:25832'
				}));

				update((state) => ({
					...state,
					results,
					isLoading: false,
					error: null
				}));
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') {
					// Request was aborted, ignore
					return;
				}

				update((state) => ({
					...state,
					results: [],
					isLoading: false,
					error: error instanceof Error ? error.message : 'Search failed'
				}));
			}
		}, DEBOUNCE_MS);
	}

	function selectResult(result: SearchResult): void {
		update((state) => ({ ...state, selectedResult: result }));
	}

	function clearResults(): void {
		update((state) => ({
			...state,
			results: [],
			error: null
		}));
	}

	function clearSelection(): void {
		update((state) => ({ ...state, selectedResult: null }));
	}

	function reset(): void {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (abortController) {
			abortController.abort();
		}
		set({
			query: '',
			results: [],
			isLoading: false,
			error: null,
			selectedResult: null
		});
	}

	return {
		subscribe,
		search,
		selectResult,
		clearResults,
		clearSelection,
		reset
	};
}

export const searchStore = createSearchStore();

// Helper function to parse WKT geometry
export function parseWKT(wkt: string, sourceProjection: string = 'EPSG:25832', targetProjection: string = 'EPSG:25832'): Feature<Geometry> | null {
	try {
		const format = new WKT();
		const feature = format.readFeature(wkt, {
			dataProjection: sourceProjection,
			featureProjection: targetProjection
		});
		return feature as Feature<Geometry>;
	} catch (error) {
		console.error('Failed to parse WKT:', error);
		return null;
	}
}

// Derived store for checking if we have results
export const hasResults = derived(searchStore, ($store) => $store.results.length > 0);

// Derived store for the best match (sml === 1)
export const bestMatch = derived(searchStore, ($store) =>
	$store.results.find((r) => r.sml === 1) || null
);
