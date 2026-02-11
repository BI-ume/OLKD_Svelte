<script lang="ts">
	import { mapStore } from '$lib/stores/mapStore';
	import { layerStore, activeBackground, visibleOverlayLayers, overlayGroups } from '$lib/stores/layerStore';
	import { configStore } from '$lib/stores/configStore';
	import { drawStore } from '$lib/stores/drawStore';
	import { createGroup } from '$lib/layers/factory';
	import type { GroupConfig } from '$lib/layers/types';
	import { get } from 'svelte/store';

	interface Props {
		sidebarOpen?: boolean;
	}

	let { sidebarOpen = false }: Props = $props();

	interface SavedProfile {
		name: string;
		savedAt: string;
		center: [number, number];
		zoom: number;
		activeBackground: string | null;
		visibleLayers: { name: string; opacity: number }[];
		groupOrder?: string[];
		drawFeatures?: string; // GeoJSON FeatureCollection string
	}

	const STORAGE_KEY = 'olkd_map_profiles';

	let isDialogOpen = $state(false);
	let profiles = $state<SavedProfile[]>([]);
	let newProfileName = $state('');
	let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	let renamingProfile = $state<string | null>(null);
	let renameValue = $state('');

	function loadProfiles() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				profiles = JSON.parse(stored);
			}
		} catch (e) {
			console.error('Failed to load profiles:', e);
			profiles = [];
		}
	}

	function saveProfiles() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
		} catch (e) {
			console.error('Failed to save profiles:', e);
		}
	}

	function openDialog() {
		loadProfiles();
		isDialogOpen = true;
		newProfileName = '';
		feedback = null;
	}

	function closeDialog() {
		isDialogOpen = false;
		feedback = null;
	}

	function getCurrentState(): Omit<SavedProfile, 'name' | 'savedAt'> {
		const view = mapStore.getView();
		const center = view?.getCenter() as [number, number] || [0, 0];
		const zoom = view?.getZoom() || 0;

		const bg = get(activeBackground);
		const overlays = get(visibleOverlayLayers);
		const groups = get(overlayGroups);

		const drawFeatures = drawStore.exportGeoJSON() || undefined;

		return {
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

	function saveProfile() {
		if (!newProfileName.trim()) {
			feedback = { type: 'error', message: 'Bitte einen Namen eingeben' };
			return;
		}

		// Check if name already exists
		const existingIndex = profiles.findIndex((p) => p.name === newProfileName.trim());
		if (existingIndex >= 0) {
			// Update existing
			profiles[existingIndex] = {
				name: newProfileName.trim(),
				savedAt: new Date().toISOString(),
				...getCurrentState()
			};
		} else {
			// Add new
			profiles = [
				{
					name: newProfileName.trim(),
					savedAt: new Date().toISOString(),
					...getCurrentState()
				},
				...profiles
			];
		}

		saveProfiles();
		newProfileName = '';
		feedback = { type: 'success', message: 'Profil gespeichert' };
		setTimeout(() => {
			feedback = null;
		}, 2000);
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

	async function loadProfile(profile: SavedProfile) {
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

		feedback = { type: 'success', message: `Profil "${profile.name}" geladen` };
		setTimeout(() => {
			feedback = null;
			closeDialog();
		}, 1500);
	}

	function deleteProfile(profile: SavedProfile) {
		if (confirm(`Profil "${profile.name}" wirklich löschen?`)) {
			profiles = profiles.filter((p) => p.name !== profile.name);
			saveProfiles();
			feedback = { type: 'success', message: 'Profil gelöscht' };
			setTimeout(() => {
				feedback = null;
			}, 2000);
		}
	}

	function startRename(profile: SavedProfile, e: MouseEvent) {
		e.stopPropagation();
		renamingProfile = profile.name;
		renameValue = profile.name;
	}

	function confirmRename(oldName: string) {
		if (!renameValue.trim()) {
			feedback = { type: 'error', message: 'Bitte einen Namen eingeben' };
			return;
		}

		// Check if new name conflicts with existing (except current)
		const conflict = profiles.find((p) => p.name === renameValue.trim() && p.name !== oldName);
		if (conflict) {
			feedback = { type: 'error', message: 'Dieser Name existiert bereits' };
			return;
		}

		const index = profiles.findIndex((p) => p.name === oldName);
		if (index >= 0) {
			profiles[index] = { ...profiles[index], name: renameValue.trim() };
			saveProfiles();
			feedback = { type: 'success', message: 'Profil umbenannt' };
			setTimeout(() => {
				feedback = null;
			}, 2000);
		}

		renamingProfile = null;
		renameValue = '';
	}

	function cancelRename() {
		renamingProfile = null;
		renameValue = '';
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeDialog();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="settings-control" class:sidebar-open={sidebarOpen}>
	<button
		class="settings-btn"
		onclick={openDialog}
		title="Einstellungen speichern/laden"
		aria-label="Einstellungen speichern oder laden"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
			<polyline points="17 21 17 13 7 13 7 21"></polyline>
			<polyline points="7 3 7 8 15 8"></polyline>
		</svg>
	</button>
</div>

{#if isDialogOpen}
	<div class="dialog-overlay" role="presentation" onclick={closeDialog}>
		<div class="dialog" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="dialog-header">
				<h2>Einstellungen</h2>
				<button class="close-btn" onclick={closeDialog} aria-label="Schließen">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="dialog-content">
				{#if feedback}
					<div class="feedback" class:success={feedback.type === 'success'} class:error={feedback.type === 'error'}>
						{feedback.message}
					</div>
				{/if}

				<div class="save-section">
					<h3>Neues Profil speichern</h3>
					<div class="save-form">
						<input
							type="text"
							placeholder="Profilname eingeben..."
							bind:value={newProfileName}
							onkeydown={(e) => e.key === 'Enter' && saveProfile()}
						/>
						<button class="save-btn" onclick={saveProfile}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
								<polyline points="17 21 17 13 7 13 7 21"></polyline>
								<polyline points="7 3 7 8 15 8"></polyline>
							</svg>
							Speichern
						</button>
					</div>
					<p class="hint">
						Speichert: Kartenposition, Zoom, aktive Hintergrundkarte, sichtbare Layer, Transparenz, Layerreihenfolge und Zeichnungen
					</p>
				</div>

				<div class="profiles-section">
					<h3>Gespeicherte Profile</h3>
					{#if profiles.length === 0}
						<p class="no-profiles">Keine Profile gespeichert</p>
					{:else}
						<ul class="profiles-list">
							{#each profiles as profile}
								<li
									class="profile-item"
									class:renaming={renamingProfile === profile.name}
									onclick={() => renamingProfile !== profile.name && loadProfile(profile)}
									onkeydown={(e) => e.key === 'Enter' && renamingProfile !== profile.name && loadProfile(profile)}
									role="button"
									tabindex="0"
									title="Klicken zum Laden"
									aria-label={`Profil "${profile.name}" laden`}
								>
									{#if renamingProfile === profile.name}
										<div class="rename-form" onclick={(e) => e.stopPropagation()}>
											<input
												type="text"
												bind:value={renameValue}
												onkeydown={(e) => {
													if (e.key === 'Enter') confirmRename(profile.name);
													if (e.key === 'Escape') cancelRename();
												}}
												autofocus
											/>
											<button
												class="action-btn confirm-btn"
												onclick={() => confirmRename(profile.name)}
												title="Bestätigen"
												aria-label="Umbenennung bestätigen"
											>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											</button>
											<button
												class="action-btn cancel-btn"
												onclick={cancelRename}
												title="Abbrechen"
												aria-label="Umbenennung abbrechen"
											>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<line x1="18" y1="6" x2="6" y2="18"></line>
													<line x1="6" y1="6" x2="18" y2="18"></line>
												</svg>
											</button>
										</div>
									{:else}
										<div class="profile-info">
											<span class="profile-name">{profile.name}</span>
											<span class="profile-date">{formatDate(profile.savedAt)}</span>
										</div>
										<div class="profile-actions">
											<button
												class="action-btn rename-btn"
												onclick={(e) => startRename(profile, e)}
												title="Umbenennen"
												aria-label={`Profil "${profile.name}" umbenennen`}
											>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
													<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
												</svg>
											</button>
											<button
												class="action-btn delete-btn"
												onclick={(e) => { e.stopPropagation(); deleteProfile(profile); }}
												title="Löschen"
												aria-label={`Profil "${profile.name}" löschen`}
											>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<path d="M3 6h18"></path>
													<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
													<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
												</svg>
											</button>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-control {
		position: absolute;
		top: 294px;
		left: 10px;
		z-index: 100;
		transition: left 0.3s ease;
	}

	.settings-control.sidebar-open {
		left: 310px;
	}

	.settings-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #333;
		transition: background-color 0.15s, color 0.15s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.settings-btn:hover {
		background: #f0f0f0;
	}

	.settings-btn svg {
		width: 18px;
		height: 18px;
	}

	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.dialog {
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		width: 90%;
		max-width: 480px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid #e0e0e0;
	}

	.dialog-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.close-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
	}

	.close-btn:hover {
		background: #f0f0f0;
		color: #333;
	}

	.close-btn svg {
		width: 20px;
		height: 20px;
	}

	.dialog-content {
		padding: 20px;
		overflow-y: auto;
	}

	.feedback {
		padding: 10px 14px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 14px;
	}

	.feedback.success {
		background: #d4edda;
		color: #155724;
	}

	.feedback.error {
		background: #f8d7da;
		color: #721c24;
	}

	.save-section,
	.profiles-section {
		margin-bottom: 24px;
	}

	.save-section h3,
	.profiles-section h3 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: #333;
	}

	.save-form {
		display: flex;
		gap: 8px;
	}

	.save-form input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 14px;
	}

	.save-form input:focus {
		outline: none;
		border-color: #E2001A;
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		background: #E2001A;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.save-btn:hover {
		background: #c00018;
	}

	.save-btn svg {
		width: 16px;
		height: 16px;
	}

	.hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: #666;
	}

	.no-profiles {
		color: #666;
		font-style: italic;
		text-align: center;
		padding: 20px;
	}

	.profiles-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.profile-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		margin-bottom: 8px;
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.profile-item:hover:not(.renaming) {
		background-color: #f8f8f8;
		border-color: #ccc;
	}

	.profile-item:focus {
		outline: none;
		border-color: #E2001A;
		box-shadow: 0 0 0 2px rgba(226, 0, 26, 0.2);
	}

	.profile-item.renaming {
		cursor: default;
		background-color: #fff;
	}

	.profile-item:last-child {
		margin-bottom: 0;
	}

	.profile-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.profile-name {
		font-weight: 500;
		color: #333;
	}

	.profile-date {
		font-size: 12px;
		color: #666;
	}

	.profile-actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
		transition: all 0.15s;
	}

	.action-btn svg {
		width: 16px;
		height: 16px;
	}

	.rename-btn:hover {
		background: #E2001A;
		border-color: #E2001A;
		color: white;
	}

	.delete-btn:hover {
		background: #dc3545;
		border-color: #dc3545;
		color: white;
	}

	.confirm-btn:hover {
		background: #28a745;
		border-color: #28a745;
		color: white;
	}

	.cancel-btn:hover {
		background: #6c757d;
		border-color: #6c757d;
		color: white;
	}

	.rename-form {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.rename-form input {
		flex: 1;
		padding: 8px 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
	}

	.rename-form input:focus {
		outline: none;
		border-color: #E2001A;
	}
</style>
