/**
 * Saved map profiles (Kartenprofile), persisted in localStorage.
 *
 * Shared between the SaveSettings dialog (save/load/rename/delete in the map
 * app) and the admin projects page (list/export/import, opens profiles via
 * the ?profile=<name> URL parameter).
 */
import { get } from 'svelte/store';
import { mapStore } from '$lib/stores/mapStore';
import {
	layerStore,
	activeBackground,
	visibleOverlayLayers,
	overlayGroups
} from '$lib/stores/layerStore';
import { configStore } from '$lib/stores/configStore';
import { drawStore } from '$lib/stores/drawStore';
import { createGroup } from '$lib/layers/factory';
import type { GroupConfig } from '$lib/layers/types';

export interface SavedProfile {
	name: string;
	savedAt: string;
	/** Project (app config) the profile was saved in; older profiles lack it */
	configId?: string;
	center: [number, number];
	zoom: number;
	activeBackground: string | null;
	visibleLayers: { name: string; opacity: number }[];
	groupOrder?: string[];
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
	const view = mapStore.getView();
	const center = (view?.getCenter() as [number, number]) || [0, 0];
	const zoom = view?.getZoom() || 0;

	const bg = get(activeBackground);
	const overlays = get(visibleOverlayLayers);
	const groups = get(overlayGroups);

	const drawFeatures = drawStore.exportGeoJSON() || undefined;

	return {
		configId: get(configStore).configId || 'default',
		center,
		zoom,
		activeBackground: bg?.name || null,
		visibleLayers: overlays.map((layer) => ({
			name: layer.name,
			opacity: layer.opacity
		})),
		groupOrder: groups.map((g) => g.name),
		drawFeatures
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
	const view = mapStore.getView();
	if (!view) return;

	// Restore map view
	view.setCenter(profile.center);
	view.setZoom(profile.zoom);

	// Restore active background
	if (profile.activeBackground) {
		layerStore.setActiveBackgroundByName(profile.activeBackground);
	}

	// Restore layerswitcher groups if available
	if (profile.groupOrder && profile.groupOrder.length > 0) {
		const savedGroupNames = new Set(profile.groupOrder);
		const currentGroups = get(overlayGroups);
		const currentGroupNames = new Set(currentGroups.map((g) => g.name));

		// Remove groups that are not in the saved profile
		for (const group of currentGroups) {
			if (!savedGroupNames.has(group.name)) {
				layerStore.removeGroup(group.name);
			}
		}

		// Add groups that are in the saved profile but not currently present
		for (const groupName of profile.groupOrder) {
			if (!currentGroupNames.has(groupName)) {
				await fetchAndAddGroup(groupName);
			}
		}

		// Reorder groups to match saved order
		layerStore.reorderGroups(profile.groupOrder);
	}

	// Hide all overlays first
	const allLayers = layerStore.getAllLayers();
	allLayers.forEach((layer) => {
		if (!layer.isBackground) {
			layerStore.setLayerVisibility(layer.name, false);
		}
	});

	// Restore visible layers with opacity
	profile.visibleLayers.forEach(({ name, opacity }) => {
		const layer = layerStore.getLayerByName(name);
		if (layer) {
			layerStore.setLayerVisibility(name, true);
			layerStore.setLayerOpacity(name, opacity);
		}
	});

	// Restore draw features
	if (profile.drawFeatures) {
		drawStore.clearAll();
		drawStore.importGeoJSON(profile.drawFeatures);
	}
}
