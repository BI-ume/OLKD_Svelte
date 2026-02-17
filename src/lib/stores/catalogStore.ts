import { writable, derived, get } from 'svelte/store';
import { layerStore, overlayGroups } from './layerStore';
import { createGroup } from '$lib/layers/factory';
import type { GroupConfig } from '$lib/layers/types';

export interface CatalogItem {
	name: string;
	title: string;
	abstract: string;
	metadataUrl: string;
}

interface CatalogState {
	items: CatalogItem[];
	isLoading: boolean;
	error: string | null;
	isOpen: boolean;
	configId: string;
}

function createCatalogStore() {
	const { subscribe, set, update } = writable<CatalogState>({
		items: [],
		isLoading: false,
		error: null,
		isOpen: false,
		configId: 'default'
	});

	const togglingItems = new Set<string>();

	return {
		subscribe,

		/**
		 * Load catalog items from backend
		 */
		loadCatalog: async (configId: string = 'default'): Promise<void> => {
			update((s) => ({ ...s, isLoading: true, error: null, configId }));

			try {
				const response = await fetch(`/api/v1/app/${configId}/catalog`);
				if (!response.ok) {
					throw new Error(`Failed to load catalog: ${response.status}`);
				}

				const data = await response.json();
				const items: CatalogItem[] = (data.groups || []).map((g: CatalogItem) => ({
					name: g.name,
					title: g.title,
					abstract: g.abstract || '',
					metadataUrl: g.metadataUrl || ''
				}));

				update((s) => ({
					...s,
					items,
					isLoading: false,
					error: null
				}));
			} catch (e) {
				update((s) => ({
					...s,
					isLoading: false,
					error: e instanceof Error ? e.message : 'Failed to load catalog'
				}));
			}
		},

		/**
		 * Toggle a catalog item: add to map if not present, remove if present
		 */
		toggleItem: async (name: string): Promise<void> => {
			if (togglingItems.has(name)) return;
			togglingItems.add(name);

			try {
				const state = get({ subscribe });

				// Check if group is currently in the layerswitcher
				const existingGroup = layerStore.getGroupByName(name);

				if (existingGroup) {
					// Remove from layerswitcher
					layerStore.removeGroup(name);
				} else {
					// Fetch full definition and add to layerswitcher
					const response = await fetch(
						`/api/v1/app/${state.configId}/catalog/group/${name}`
					);
					if (!response.ok) {
						throw new Error(`Failed to load group: ${response.status}`);
					}

					const data = await response.json();
					if (!data.group) {
						throw new Error('Group definition not found');
					}

					const groupConfig: GroupConfig = data.group;
					const group = createGroup(groupConfig);
					layerStore.addGroup(group);
				}
			} catch (e) {
				console.error(`Error adding catalog group "${name}":`, e);
				update((s) => ({
					...s,
					error: e instanceof Error ? e.message : 'Failed to add group'
				}));
			} finally {
				togglingItems.delete(name);
			}
		},

		/**
		 * Toggle catalog panel open/closed
		 */
		toggle: (): void => {
			update((s) => ({ ...s, isOpen: !s.isOpen }));
		},

		/**
		 * Close catalog panel
		 */
		close: (): void => {
			update((s) => ({ ...s, isOpen: false }));
		}
	};
}

export const catalogStore = createCatalogStore();

// Derived store: catalog items with active status based on current layerStore
export const catalogItems = derived(
	[catalogStore, overlayGroups],
	([$catalog, $overlayGroups]) => {
		const activeNames = new Set($overlayGroups.map((g) => g.name));
		return $catalog.items.map((item) => ({
			...item,
			active: activeNames.has(item.name)
		}));
	}
);

export const catalogIsOpen = derived(catalogStore, ($s) => $s.isOpen);
export const catalogIsLoading = derived(catalogStore, ($s) => $s.isLoading);
