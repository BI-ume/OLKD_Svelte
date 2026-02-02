import { writable, derived } from 'svelte/store';

interface MetadataPopupState {
	isOpen: boolean;
	url: string;
	title: string;
}

const initialState: MetadataPopupState = {
	isOpen: false,
	url: '',
	title: ''
};

function createMetadataPopupStore() {
	const { subscribe, set, update } = writable<MetadataPopupState>(initialState);

	return {
		subscribe,
		open(url: string, title: string) {
			set({ isOpen: true, url, title });
		},
		close() {
			set(initialState);
		}
	};
}

export const metadataPopupStore = createMetadataPopupStore();

export const metadataPopupIsOpen = derived(metadataPopupStore, ($store) => $store.isOpen);
export const metadataPopupUrl = derived(metadataPopupStore, ($store) => $store.url);
export const metadataPopupTitle = derived(metadataPopupStore, ($store) => $store.title);
