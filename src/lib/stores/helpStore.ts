import { writable, derived } from 'svelte/store';

const HELP_SEEN_KEY = 'helpTourSeen';

interface HelpState {
	isActive: boolean;
	currentStep: number;
	tocOpen: boolean;
}

function createHelpStore() {
	const { subscribe, update } = writable<HelpState>({
		isActive: false,
		currentStep: 0,
		tocOpen: false
	});

	return {
		subscribe,

		start() {
			update((s) => ({ ...s, isActive: true, tocOpen: false }));
		},

		end() {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(HELP_SEEN_KEY, '1');
			}
			update((s) => ({ ...s, isActive: false, tocOpen: false }));
		},

		goToStep(index: number) {
			update((s) => ({ ...s, currentStep: index, tocOpen: false }));
		},

		next(total: number) {
			update((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, total - 1) }));
		},

		prev() {
			update((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 0) }));
		},

		toggleToc() {
			update((s) => ({ ...s, tocOpen: !s.tocOpen }));
		},

		hasBeenSeen(): boolean {
			if (typeof localStorage === 'undefined') return false;
			return !!localStorage.getItem(HELP_SEEN_KEY);
		}
	};
}

export const helpStore = createHelpStore();
export const helpIsActive = derived(helpStore, ($h) => $h.isActive);
