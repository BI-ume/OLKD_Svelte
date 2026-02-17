import { writable, derived, get } from 'svelte/store';

export type PageLayout = 'a4_portrait' | 'a4_landscape' | 'a3_portrait' | 'a3_landscape' | 'custom';
export type OutputFormat = 'pdf' | 'png';
export type PrintStatus = 'idle' | 'preparing' | 'processing' | 'ready' | 'error';

export interface PageSize {
	width: number;  // mm
	height: number; // mm
}

export interface PrintSettings {
	layout: PageLayout;
	pageSize: PageSize;
	scale: number;
	outputFormat: OutputFormat;
}

export interface PrintJob {
	id: string;
	statusUrl: string;
	downloadUrl: string;
}

interface PrintState {
	isOpen: boolean;
	settings: PrintSettings;
	status: PrintStatus;
	job: PrintJob | null;
	error: string | null;
}

// Page sizes in mm
export const PAGE_SIZES: Record<Exclude<PageLayout, 'custom'>, PageSize> = {
	a4_portrait: { width: 210, height: 297 },
	a4_landscape: { width: 297, height: 210 },
	a3_portrait: { width: 297, height: 420 },
	a3_landscape: { width: 420, height: 297 }
};

// Default settings
const DEFAULT_SETTINGS: PrintSettings = {
	layout: 'a4_portrait',
	pageSize: { ...PAGE_SIZES.a4_portrait },
	scale: 2500,
	outputFormat: 'pdf'
};

// Scale constraints
export const MIN_SCALE = 100;
export const MAX_SCALE = 100000;
// Custom page size constraints (mm)
export const MIN_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

// Predefined round scales (ascending)
export const AVAILABLE_SCALES = [500, 1000, 2500, 5000, 10000, 15000, 25000, 50000, 100000];

function createPrintStore() {
	const { subscribe, set, update } = writable<PrintState>({
		isOpen: false,
		settings: { ...DEFAULT_SETTINGS },
		status: 'idle',
		job: null,
		error: null
	});

	let pollInterval: ReturnType<typeof setInterval> | null = null;

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	return {
		subscribe,

		/**
		 * Open the print panel
		 */
		open: (): void => {
			update((s) => ({ ...s, isOpen: true }));
		},

		/**
		 * Close the print panel and clean up
		 */
		close: (): void => {
			stopPolling();
			update((s) => ({
				...s,
				isOpen: false,
				status: 'idle',
				job: null,
				error: null
			}));
		},

		/**
		 * Set page layout and update page size accordingly
		 */
		setLayout: (layout: PageLayout): void => {
			update((s) => {
				const pageSize = layout === 'custom'
					? s.settings.pageSize
					: { ...PAGE_SIZES[layout] };
				return {
					...s,
					settings: { ...s.settings, layout, pageSize }
				};
			});
		},

		/**
		 * Set custom page size (clamped to min/max)
		 */
		setPageSize: (pageSize: PageSize): void => {
			const clamped: PageSize = {
				width: Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize.width)),
				height: Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize.height))
			};
			update((s) => ({
				...s,
				settings: { ...s.settings, layout: 'custom', pageSize: clamped }
			}));
		},

		/**
		 * Set scale (clamped to min/max)
		 */
		setScale: (scale: number): void => {
			const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
			update((s) => ({
				...s,
				settings: { ...s.settings, scale: clampedScale }
			}));
		},

		/**
		 * Set output format
		 */
		setOutputFormat: (outputFormat: OutputFormat): void => {
			update((s) => ({
				...s,
				settings: { ...s.settings, outputFormat }
			}));
		},

		/**
		 * Submit print job
		 */
		submitPrint: async (
			bbox: [number, number, number, number],
			layers: string[],
			opacities: Record<string, number> = {},
			srs: number = 25832,
			drawFeatures: string | null = null
		): Promise<void> => {
			const state = get({ subscribe });
			const { settings } = state;

			update((s) => ({ ...s, status: 'preparing', error: null }));

			try {
				const response = await fetch('/export/map', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						bbox,
						srs,
						scale: settings.scale,
						outputFormat: settings.outputFormat,
						mimetype: settings.outputFormat === 'pdf' ? 'application/pdf' : 'image/png',
						pageLayout: settings.layout,
						pageSize: [settings.pageSize.width, settings.pageSize.height],
						layers,
						opacities,
						...(drawFeatures ? { drawFeatures: JSON.parse(drawFeatures) } : {})
					})
				});

				if (!response.ok) {
					throw new Error(`Print request failed: ${response.status}`);
				}

				const data = await response.json();

				update((s) => ({
					...s,
					status: 'processing',
					job: {
						id: data.statusURL.split('/').slice(-2)[0], // Extract ID from URL
						statusUrl: data.statusURL,
						downloadUrl: data.downloadURL
					}
				}));

				// Start polling for status (max 2 minutes)
				const MAX_POLL_ATTEMPTS = 120;
				let pollCount = 0;
				pollInterval = setInterval(async () => {
					pollCount++;
					const currentState = get({ subscribe });
					if (!currentState.job) {
						stopPolling();
						return;
					}

					if (pollCount >= MAX_POLL_ATTEMPTS) {
						stopPolling();
						update((s) => ({
							...s,
							status: 'error',
							error: 'Zeitüberschreitung: Druckauftrag dauert zu lange'
						}));
						return;
					}

					try {
						const statusResponse = await fetch(currentState.job.statusUrl);
						const statusData = await statusResponse.json();

						if (statusData.status === 'finished') {
							stopPolling();
							update((s) => ({
								...s,
								status: 'ready',
								job: s.job ? { ...s.job, downloadUrl: statusData.downloadURL } : null
							}));
						} else if (statusData.status === 'error') {
							stopPolling();
							update((s) => ({
								...s,
								status: 'error',
								error: 'Druckauftrag fehlgeschlagen'
							}));
						}
						// Otherwise keep polling (status === 'inprocess')
					} catch (err) {
						stopPolling();
						update((s) => ({
							...s,
							status: 'error',
							error: 'Statusabfrage fehlgeschlagen'
						}));
					}
				}, 1000);

			} catch (err) {
				update((s) => ({
					...s,
					status: 'error',
					error: err instanceof Error ? err.message : 'Unbekannter Fehler'
				}));
			}
		},

		/**
		 * Reset to default settings
		 */
		reset: (): void => {
			stopPolling();
			set({
				isOpen: false,
				settings: { ...DEFAULT_SETTINGS },
				status: 'idle',
				job: null,
				error: null
			});
		},

		/**
		 * Get current state synchronously
		 */
		getState: (): PrintState => {
			return get({ subscribe });
		}
	};
}

export const printStore = createPrintStore();

// Derived stores for convenient access
export const printIsOpen = derived(printStore, ($s) => $s.isOpen);
export const printSettings = derived(printStore, ($s) => $s.settings);
export const printStatus = derived(printStore, ($s) => $s.status);
export const printJob = derived(printStore, ($s) => $s.job);
export const printError = derived(printStore, ($s) => $s.error);
