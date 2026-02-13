import { writable } from 'svelte/store';

/** Whether a measure tool is currently active */
export const measureActive = writable(false);
