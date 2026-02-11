import { writable, derived, get } from 'svelte/store';

interface SidebarState {
	isOpen: boolean;
	showCatalog: boolean;
	showPrint: boolean;
	showDraw: boolean;
}

function createSidebarStore() {
	const { subscribe, set, update } = writable<SidebarState>({
		isOpen: false,
		showCatalog: false,
		showPrint: false,
		showDraw: false
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
			update((s) => ({ ...s, showCatalog: true, showPrint: false, showDraw: false }));
		},

		/**
		 * Hide catalog view (slides back)
		 */
		hideCatalog: (): void => {
			update((s) => ({ ...s, showCatalog: false }));
		},

		/**
		 * Show print panel (slides in from right)
		 */
		showPrint: (): void => {
			update((s) => ({ ...s, showPrint: true, showCatalog: false, showDraw: false }));
		},

		/**
		 * Hide print panel (slides back)
		 */
		hidePrint: (): void => {
			update((s) => ({ ...s, showPrint: false }));
		},

		/**
		 * Show draw panel (slides in from right)
		 */
		showDraw: (): void => {
			update((s) => ({ ...s, showDraw: true, showCatalog: false, showPrint: false }));
		},

		/**
		 * Hide draw panel (slides back)
		 */
		hideDraw: (): void => {
			update((s) => ({ ...s, showDraw: false }));
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
export const sidebarShowPrint = derived(sidebarStore, ($s) => $s.showPrint);
export const sidebarShowDraw = derived(sidebarStore, ($s) => $s.showDraw);
