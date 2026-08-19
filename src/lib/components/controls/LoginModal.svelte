<script lang="ts">
	import { authStore } from '$lib/stores/authStore';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let token = $state('');
	let error = $state('');
	let busy = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let dialogEl = $state<HTMLDialogElement | null>(null);

	// showModal() gives focus trapping, Escape handling and an inert background.
	$effect(() => {
		if (dialogEl && !dialogEl.open) {
			dialogEl.showModal();
			inputEl?.focus();
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		const value = token.trim();
		if (!value || busy) return;

		busy = true;
		error = '';
		try {
			const ok = await authStore.login(value);
			if (ok) {
				dialogEl?.close();
			} else {
				error = 'Ungültiger Token.';
				token = '';
				inputEl?.focus();
			}
		} catch {
			error = 'Anmeldung fehlgeschlagen. Server nicht erreichbar?';
		} finally {
			busy = false;
		}
	}

	/** Clicks on the backdrop report the dialog itself as target. */
	function handleClick(e: MouseEvent) {
		if (dialogEl && e.target === dialogEl) dialogEl.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="dialog"
	aria-labelledby="login-title"
	onclose={onClose}
	onclick={handleClick}
>
	<div class="dialog-header">
		<h2 id="login-title">Anmelden</h2>
		<button class="close-btn" onclick={() => dialogEl?.close()} aria-label="Schließen">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</div>

	<div class="dialog-content">
		<form onsubmit={submit}>
			<label for="admin-token">Admin-Token</label>
			<input
				id="admin-token"
				type="password"
				autocomplete="current-password"
				placeholder="Token eingeben..."
				bind:value={token}
				bind:this={inputEl}
				disabled={busy}
			/>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="actions">
				<button type="button" class="cancel-btn" onclick={() => dialogEl?.close()} disabled={busy}>
					Abbrechen
				</button>
				<button type="submit" class="submit-btn" disabled={busy || !token.trim()}>
					{busy ? 'Anmelden...' : 'Anmelden'}
				</button>
			</div>
		</form>
	</div>
</dialog>

<style>
	.dialog {
		padding: 0;
		border: none;
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		width: 90%;
		max-width: 380px;
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
	}

	label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		font-weight: 500;
		color: #333;
	}

	input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
	}

	input:focus {
		outline: none;
		border-color: #2196f3;
		box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
	}

	.error {
		margin: 10px 0 0;
		font-size: 13px;
		color: #c0392b;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 20px;
	}

	.cancel-btn,
	.submit-btn {
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.cancel-btn {
		background: #fff;
		border: 1px solid #b0b0b0;
		color: #333;
	}

	.cancel-btn:hover:not(:disabled) {
		background: #f5f5f5;
		border-color: #777;
	}

	.submit-btn {
		background: #2196f3;
		border: 1px solid #2196f3;
		color: white;
		font-weight: 500;
	}

	.submit-btn:hover:not(:disabled) {
		background: #1976d2;
		border-color: #1976d2;
	}

	.cancel-btn:disabled,
	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
