<script lang="ts">
	import {
		type SavedProfile,
		loadProfiles as loadStoredProfiles,
		saveProfiles as persistProfiles,
		getCurrentState,
		applyProfile
	} from '$lib/profiles';

	let isDialogOpen = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);
	let profiles = $state<SavedProfile[]>([]);
	let newProfileName = $state('');
	let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	let renamingProfile = $state<string | null>(null);
	let renameValue = $state('');
	let renameInput = $state<HTMLInputElement | null>(null);

	function loadProfiles() {
		profiles = loadStoredProfiles();
	}

	function saveProfiles() {
		persistProfiles(profiles);
	}

	function openDialog() {
		loadProfiles();
		isDialogOpen = true;
		newProfileName = '';
		feedback = null;
	}

	/** Runs when the native dialog has closed (Escape, backdrop, close()). */
	function closeDialog() {
		isDialogOpen = false;
		feedback = null;
	}

	function requestClose() {
		dialogEl?.close();
	}

	/** Clicks on the backdrop report the dialog itself as target. */
	function handleDialogClick(e: MouseEvent) {
		if (dialogEl && e.target === dialogEl) dialogEl.close();
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

	async function loadProfile(profile: SavedProfile) {
		await applyProfile(profile);

		feedback = { type: 'success', message: `Profil "${profile.name}" geladen` };
		setTimeout(() => {
			feedback = null;
			requestClose();
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

	function startRename(profile: SavedProfile) {
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

	// showModal() gives focus trapping, Escape handling and an inert background.
	$effect(() => {
		if (dialogEl && !dialogEl.open) dialogEl.showModal();
	});

	// Focus the rename field once it is in the DOM (avoids the autofocus attribute).
	$effect(() => {
		if (renamingProfile && renameInput) renameInput.select();
	});
</script>

<div class="settings-control" data-tour="save-settings">
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
	<dialog
		bind:this={dialogEl}
		class="dialog"
		aria-labelledby="settings-title"
		onclose={closeDialog}
		onclick={handleDialogClick}
	>
		<div class="dialog-header">
			<h2 id="settings-title">Einstellungen</h2>
			<button class="close-btn" onclick={requestClose} aria-label="Schließen">
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
							<li class="profile-item" class:renaming={renamingProfile === profile.name}>
								{#if renamingProfile === profile.name}
									<div class="rename-form">
										<input
											type="text"
											bind:value={renameValue}
											bind:this={renameInput}
											aria-label={`Neuer Name für Profil "${profile.name}"`}
											onkeydown={(e) => {
												if (e.key === 'Enter') confirmRename(profile.name);
												if (e.key === 'Escape') cancelRename();
											}}
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
									<button
										class="profile-load"
										onclick={() => loadProfile(profile)}
										title="Klicken zum Laden"
										aria-label={`Profil "${profile.name}" laden`}
									>
										<span class="profile-name">{profile.name}</span>
										<span class="profile-date">{formatDate(profile.savedAt)}</span>
									</button>
									<div class="profile-actions">
										<button
											class="action-btn rename-btn"
											onclick={() => startRename(profile)}
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
											onclick={() => deleteProfile(profile)}
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
	</dialog>
{/if}

<style>
	.settings-control {
		position: relative;
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

	.dialog {
		padding: 0;
		border: none;
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		width: 90%;
		max-width: 480px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		color: inherit;
	}

	.dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
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
		transition: background-color 0.15s, border-color 0.15s;
	}

	.profile-item:has(.profile-load:hover) {
		background-color: #f8f8f8;
		border-color: #ccc;
	}

	.profile-item:has(.profile-load:focus-visible) {
		border-color: #E2001A;
		box-shadow: 0 0 0 2px rgba(226, 0, 26, 0.2);
	}

	.profile-item.renaming {
		background-color: #fff;
	}

	.profile-item:last-child {
		margin-bottom: 0;
	}

	.profile-load {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 0;
		background: none;
		border: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.profile-load:focus-visible {
		outline: none;
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
