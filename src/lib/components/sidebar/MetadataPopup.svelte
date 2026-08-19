<script lang="ts">
	interface Props {
		url: string;
		title: string;
		onClose: () => void;
	}

	let { url, title, onClose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	// showModal() gives focus trapping, Escape handling and an inert background.
	$effect(() => {
		if (dialogEl && !dialogEl.open) dialogEl.showModal();
	});

	/** Clicks on the backdrop report the dialog itself as target. */
	function handleClick(e: MouseEvent) {
		if (dialogEl && e.target === dialogEl) dialogEl.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="popup-container"
	aria-labelledby="popup-title"
	onclose={onClose}
	onclick={handleClick}
>
	<div class="popup-header">
		<h3 id="popup-title">{title}</h3>
		<button
			class="close-btn"
			onclick={() => dialogEl?.close()}
			title="Schließen"
			aria-label="Schließen"
		>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
				<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
			</svg>
		</button>
	</div>
	<div class="popup-content">
		<iframe src={url} title="Metadaten für {title}" sandbox="allow-same-origin allow-scripts"></iframe>
	</div>
</dialog>

<style>
	.popup-container {
		padding: 0;
		border: none;
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		width: 90vw;
		max-width: 900px;
		height: 80vh;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: inherit;
	}

	.popup-container::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #e0e0e0;
		background: #f5f5f5;
	}

	.popup-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		border-radius: 4px;
		transition: background-color 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.close-btn:hover {
		background-color: #e0e0e0;
		color: #333;
	}

	.popup-content {
		flex: 1;
		overflow: hidden;
	}

	.popup-content iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
</style>
