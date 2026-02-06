<script lang="ts">
	const nutzungsbedingungenUrl = 'https://stadtplan.bielefeld.de/pages/nutzungsbedingungen';
	const emailAddress = 'posteingang@bielefeld.de';
</script>

<footer class="sidebar-footer">
	<div class="footer-links">
		<a href={nutzungsbedingungenUrl} target="_blank" rel="noopener noreferrer">
			Nutzungsbedingungen
		</a>
		<a href="mailto:{emailAddress}" class="email-link" title="E-Mail senden">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
				<polyline points="22,6 12,13 2,6"></polyline>
			</svg>
		</a>
	</div>
	<button class="login-btn" disabled title="Login (in Entwicklung)">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
			<polyline points="10 17 15 12 10 7"></polyline>
			<line x1="15" y1="12" x2="3" y2="12"></line>
		</svg>
		Login
	</button>
</footer>

<style>
	.sidebar-footer {
		padding: 12px 16px;
		border-top: 1px solid #e0e0e0;
		background: #f8f8f8;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.footer-links {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.footer-links a {
		font-size: 12px;
		color: #666;
		text-decoration: none;
		transition: color 0.15s;
	}

	.footer-links a:hover {
		color: #E2001A;
		text-decoration: underline;
	}

	.email-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.email-link:hover {
		background: #e0e0e0;
		text-decoration: none !important;
	}

	.email-link svg {
		width: 18px;
		height: 18px;
	}

	.login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 16px;
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		color: #666;
		cursor: not-allowed;
		opacity: 0.6;
		transition:
			background-color 0.15s,
			opacity 0.15s;
	}

	.login-btn:not(:disabled) {
		cursor: pointer;
		opacity: 1;
	}

	.login-btn:not(:disabled):hover {
		background: #e8e8e8;
	}

	.login-btn svg {
		width: 16px;
		height: 16px;
	}
</style>
