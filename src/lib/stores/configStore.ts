import { writable, derived, get } from 'svelte/store';
import type { AppConfig, LayersDef, ConfigApiResponse } from '$lib/layers/types';

interface ConfigState {
	app: AppConfig | null;
	layers: LayersDef | null;
	loading: boolean;
	error: string | null;
	configId: string | null;
}

function createConfigStore() {
	const { subscribe, set, update } = writable<ConfigState>({
		app: null,
		layers: null,
		loading: false,
		error: null,
		configId: null
	});

	return {
		subscribe,

		/**
		 * Load configuration from Flask API
		 */
		load: async (configId: string = 'default'): Promise<void> => {
			update((s) => ({ ...s, loading: true, error: null, configId }));

			try {
				const response = await fetch(`/api/v1/app/${configId}/config`);

				if (!response.ok) {
					throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
				}

				const data: ConfigApiResponse = await response.json();

				set({
					app: data.app,
					layers: data.layers,
					loading: false,
					error: null,
					configId
				});
			} catch (e) {
				const errorMessage = e instanceof Error ? e.message : 'Unknown error';
				update((s) => ({
					...s,
					loading: false,
					error: errorMessage
				}));
			}
		},

		/**
		 * Set configuration directly (useful for testing or embedded config)
		 */
		setConfig: (app: AppConfig, layers: LayersDef, configId: string = 'default'): void => {
			set({
				app,
				layers,
				loading: false,
				error: null,
				configId
			});
		},

		/**
		 * Reset the store
		 */
		reset: (): void => {
			set({
				app: null,
				layers: null,
				loading: false,
				error: null,
				configId: null
			});
		},

		/**
		 * Get current state synchronously
		 */
		getState: (): ConfigState => {
			return get({ subscribe });
		}
	};
}

export const configStore = createConfigStore();

// Derived stores for convenient access
export const appConfig = derived(configStore, ($config) => $config.app);
export const layersConfig = derived(configStore, ($config) => $config.layers);
export const mapConfig = derived(configStore, ($config) => $config.app?.map);
export const componentsConfig = derived(configStore, ($config) => $config.app?.components);
export const isLoading = derived(configStore, ($config) => $config.loading);
export const configError = derived(configStore, ($config) => $config.error);
