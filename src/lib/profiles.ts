/**
 * Saved map profiles (Kartenprofile), persisted in localStorage.
 *
 * Shared between the SaveSettings dialog (save/load/rename/delete in the map
 * app) and the admin projects page (list/export/import, opens profiles via
 * the ?profile=<name> URL parameter).
 */
import { get } from 'svelte/store';
import { layerStore, overlayGroups } from '$lib/stores/layerStore';
import { configStore } from '$lib/stores/configStore';
import { drawStore } from '$lib/stores/drawStore';
import { createGroup } from '$lib/layers/factory';
import { getMapState, applyMapState, type MapState } from '$lib/mapState';
import type { GroupConfig } from '$lib/layers/types';

export interface SavedProfile {
	name: string;
	savedAt: string;
	/** Project (app config) the profile was saved in; older profiles lack it */
	configId?: string;
	/**
	 * The shared map state, identical to what the URL encodes. Keeping it in
	 * one place means anything added to `MapState` is carried by both without
	 * a second implementation here.
	 */
	map: MapState;
	drawFeatures?: string; // GeoJSON FeatureCollection string
}

export const STORAGE_KEY = 'olkd_map_profiles';

export function loadProfiles(): SavedProfile[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load profiles:', e);
	}
	return [];
}

export function saveProfiles(profiles: SavedProfile[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
	} catch (e) {
		console.error('Failed to save profiles:', e);
	}
}

export function getCurrentState(): Omit<SavedProfile, 'name' | 'savedAt'> {
	return {
		configId: get(configStore).configId || 'default',
		map: getMapState(),
		drawFeatures: drawStore.exportGeoJSON() || undefined
	};
}

/**
 * Fetch a group definition from the catalog API and add it to the layerswitcher
 */
async function fetchAndAddGroup(groupName: string): Promise<boolean> {
	const configId = get(configStore).configId || 'default';
	try {
		const response = await fetch(`/api/v1/app/${configId}/catalog/group/${groupName}`);
		if (!response.ok) {
			console.warn(`Could not fetch group "${groupName}" from catalog`);
			return false;
		}

		const data = await response.json();
		if (!data.group) {
			console.warn(`Group definition not found for "${groupName}"`);
			return false;
		}

		const groupConfig: GroupConfig = data.group;
		const group = createGroup(groupConfig);
		layerStore.addGroup(group);
		return true;
	} catch (e) {
		console.error(`Error fetching group "${groupName}":`, e);
		return false;
	}
}

/**
 * Apply a saved profile to the running map app (view, background, groups,
 * layer visibility/opacity, draw features). Requires the map to be ready.
 */
export async function applyProfile(profile: SavedProfile): Promise<void> {
	const state = profile.map;
	if (!state) {
		console.warn(`Profile "${profile.name}" has no map state — skipping`);
		return;
	}

	// Groups the profile expects but that are not on the map have to be fetched
	// from the catalog first; applyMapState() only touches groups that exist.
	if (state.groups && state.groups.length > 0) {
		const savedGroupNames = new Set(state.groups.map((g) => g.name));
		const currentGroups = get(overlayGroups);
		const currentGroupNames = new Set(currentGroups.map((g) => g.name));

		for (const group of currentGroups) {
			if (!savedGroupNames.has(group.name)) {
				layerStore.removeGroup(group.name);
			}
		}

		for (const groupState of state.groups) {
			if (!currentGroupNames.has(groupState.name)) {
				await fetchAndAddGroup(groupState.name);
			}
		}
	}

	applyMapState(state);

	if (profile.drawFeatures) {
		drawStore.clearAll();
		drawStore.importGeoJSON(profile.drawFeatures);
	}
}
