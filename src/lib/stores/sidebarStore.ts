import { writable, derived, get } from 'svelte/store';

interface SidebarState {
	isOpen: boolean;
	showCatalog: boolean;
}

function createSidebarStore() {
	const { subscribe, set, update } = writable<SidebarState>({
		isOpen: false,
		showCatalog: false
	});

	return {
		subscribe,

		/**
		 * Initialize sidebar state from config
		 */
		initialize: (defaultOpen: boolean = true): void => {
			update((s) => ({ ...s, isOpen: defaultOpen }));
		},

		/**
		 * Toggle sidebar open/closed
		 */
		toggle: (): void => {
			update((s) => ({ ...s, isOpen: !s.isOpen }));
		},

		/**
		 * Open sidebar
		 */
		open: (): void => {
			update((s) => ({ ...s, isOpen: true }));
		},

		/**
		 * Close sidebar
		 */
		close: (): void => {
			update((s) => ({ ...s, isOpen: false }));
		},

		/**
		 * Show catalog view (slides in from right)
		 */
		showCatalog: (): void => {
			update((s) => ({ ...s, showCatalog: true }));
		},

		/**
		 * Hide catalog view (slides back)
		 */
		hideCatalog: (): void => {
			update((s) => ({ ...s, showCatalog: false }));
		},

		/**
		 * Get current state synchronously
		 */
		getState: (): SidebarState => {
			return get({ subscribe });
		}
	};
}

export const sidebarStore = createSidebarStore();

// Derived stores for convenient access
export const sidebarIsOpen = derived(sidebarStore, ($s) => $s.isOpen);
export const sidebarShowCatalog = derived(sidebarStore, ($s) => $s.showCatalog);
