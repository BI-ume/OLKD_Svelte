<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { sidebarStore, sidebarIsOpen, sidebarShowCatalog, sidebarShowPrint, sidebarShowDraw } from '$lib/stores/sidebarStore';
	import { configStore, componentsConfig } from '$lib/stores/configStore';
	import { SearchBox } from '$lib/components/controls';
	import BackgroundSelection from './BackgroundSelection.svelte';
	import OverlaySelection from './OverlaySelection.svelte';
	import Legend from './Legend.svelte';
	import Catalog from './Catalog.svelte';
	import Print from './Print.svelte';
	import Draw from './Draw.svelte';

	let showSearch = $derived($componentsConfig?.search !== false);
	let showLegend = $derived($configStore.app?.components?.legend !== false);
	let showPrintButton = $derived($configStore.app?.components?.print !== false);
	let showDrawButton = $derived($configStore.app?.components?.draw !== false);
	let showSecondary = $derived($sidebarShowCatalog || $sidebarShowPrint || $sidebarShowDraw);

	// Header
	let title = $derived($configStore.app?.app?.title ?? 'bielefeldGEOCLIENT');
	let headerLogoLink = $derived($configStore.app?.app?.headerLogoLink ?? '#');

	// Footer
	const nutzungsbedingungenUrl = 'https://stadtplan.bielefeld.de/pages/nutzungsbedingungen';
	const emailAddress = 'olkd@bielefeld.de';
	const emailSubject = 'onlineKARTENdienst Stadt Bielefeld';

	let mailtoHref = $derived.by(() => {
		const subject = encodeURIComponent(emailSubject);
		const body = encodeURIComponent(browser ? 'Aktuelle URL: ' + window.location.href : '');
		return `mailto:${emailAddress}?subject=${subject}&body=${body}`;
	});

	function handleOpenPrint() {
		sidebarStore.showPrint();
	}

	function handleOpenDraw() {
		sidebarStore.showDraw();
	}

	// Initialize from config
	onMount(() => {
		const defaultOpen = $configStore.app?.sidebar?.defaultOpen ?? true;
		sidebarStore.initialize(defaultOpen);
	});
</script>

<div class="sidebar-wrapper" class:open={$sidebarIsOpen}>
	<!-- Header card -->
	<div class="sidebar-card header-card">
		<header class="sidebar-header">
			<a href={headerLogoLink} target="_blank" rel="noopener noreferrer" class="logo-link">
				<img src="/img/logo_BIE.svg" alt="Bielefeld Logo" class="logo" />
			</a>
			<div class="title-section">
				<h1 class="title">{title}</h1>
				<a href={headerLogoLink} target="_blank" rel="noopener noreferrer" class="header-link">
					Geoportal Bielefeld
				</a>
			</div>
		</header>
		{#if showSearch}
			<SearchBox embedded={true} />
		{/if}
	</div>

	<!-- Body area: transparent, holds sliding panels -->
	<div class="body-area">
		<!-- Main panel (transparent wrapper for slide transition) -->
		<div class="main-panel" class:hidden={showSecondary}>
			<div class="sidebar-card content-card">
				<div class="scrollable">
					<BackgroundSelection />
					<OverlaySelection />
					{#if showLegend}
						<Legend />
					{/if}
				</div>
			</div>
			<div class="sidebar-card footer-card">
				{#if showPrintButton || showDrawButton}
					<div class="action-row">
						{#if showPrintButton}
							<button class="action-btn" onclick={handleOpenPrint}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="6 9 6 2 18 2 18 9"></polyline>
									<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
									<rect x="6" y="14" width="12" height="8"></rect>
								</svg>
								Drucken
							</button>
						{/if}
						{#if showDrawButton}
							<button class="action-btn" onclick={handleOpenDraw}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 20h9"></path>
									<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
								</svg>
								Zeichnen
							</button>
						{/if}
					</div>
				{/if}
				<div class="footer-links">
					<a href={nutzungsbedingungenUrl} target="_blank" rel="noopener noreferrer">
						Nutzungsbedingungen
					</a>
					<a href={mailtoHref} class="email-link" title="Feedback senden">
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
			</div>
		</div>

		<!-- Secondary panels (slide in from right, auto-height) -->
		<div class="sidebar-card secondary-panel" class:visible={$sidebarShowCatalog}>
			<Catalog />
		</div>
		<div class="sidebar-card secondary-panel" class:visible={$sidebarShowPrint}>
			<Print />
		</div>
		<div class="sidebar-card secondary-panel" class:visible={$sidebarShowDraw}>
			<Draw />
		</div>
	</div>
</div>

<style>
	.sidebar-wrapper {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: var(--sidebar-width);
		padding: 10px;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 10px;
		pointer-events: none;
		transform: translateX(-100%);
		transition: transform 0.3s ease;
	}

	.sidebar-wrapper.open {
		transform: translateX(0);
	}

	/* For small viewport height, the whole sidebar becomes scrollable */
	@media screen and (height < 470px) {

		.sidebar-wrapper.open {
			pointer-events: auto;
			overflow-y: scroll;
			padding-right: 0;
			width: calc(var(--sidebar-width) - 10px);
		}

		/* Custom scrollbar — matches .scrollable */
		.sidebar-wrapper::-webkit-scrollbar {
			width: 8px;
		}

		.sidebar-wrapper::-webkit-scrollbar-track {
			background: #f0f0f0;
		}

		.sidebar-wrapper::-webkit-scrollbar-thumb {
			background: #ccc;
			border-radius: 4px;
		}

		.sidebar-wrapper::-webkit-scrollbar-thumb:hover {
			background: #aaa;
		}
	}

	/* Cards */
	.sidebar-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		pointer-events: auto;
	}

	/* Header card: allow search results to overflow */
	.header-card {
		flex-shrink: 0;
		overflow: visible;
		z-index: 2;
		border-top-right-radius: 0;
	}

	.sidebar-header {
		--logo-width: 36px;
		--logo-color: #e30613;
		display: flex;
		align-items: flex-end;
		gap: calc(var(--logo-width) / 2);
		padding: calc(var(--logo-width) / 3);
		color: var(--logo-color);
	}

	.logo-link {
		flex-shrink: 0;
	}

	.logo {
		width: var(--logo-width);
		height: auto;
	}

	.title-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--logo-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-link {
		font-size: 16px;
		color: var(--logo-color);
		text-decoration: none;
		transition: color 0.15s;
	}

	.header-link:hover {
		text-decoration: underline;
	}

	/* Body area: transparent container for sliding panels */
	.body-area {
		flex: 1;
		position: relative;
		min-height: 350px;
		overflow: hidden;
		z-index: 1;
	}

	/* Main panel: transparent wrapper for slide transition */
	.main-panel {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition: transform 0.3s ease;
		/* No background — map shows through gap between content and footer */
	}

	.main-panel.hidden {
		transform: translateX(-100%);
		pointer-events: none;
	}

	/* Content card: sizes to content, scrolls when it reaches the footer */
	.content-card {
		flex: 0 1 auto;
		min-height: 200px;
		display: flex;
		flex-direction: column;
	}

	/* Footer card: pushed to bottom */
	.footer-card {
		margin-top: auto;
		flex-shrink: 0;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.scrollable {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* Custom scrollbar */
	.scrollable::-webkit-scrollbar {
		width: 8px;
	}

	.scrollable::-webkit-scrollbar-track {
		background: #f0f0f0;
	}

	.scrollable::-webkit-scrollbar-thumb {
		background: #ccc;
		border-radius: 4px;
	}

	.scrollable::-webkit-scrollbar-thumb:hover {
		background: #aaa;
	}

	.action-row {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 10px;
		background: #2196f3;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 500;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.action-btn:hover {
		background: #1976d2;
	}

	.action-btn svg {
		width: 16px;
		height: 16px;
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

	/* Secondary panels: auto-height, slide from right */
	.secondary-panel {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		max-height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		transform: translateX(100%);
		transition: transform 0.3s ease;
		pointer-events: none;
		box-shadow: none;
	}

	.secondary-panel.visible {
		transform: translateX(0);
		pointer-events: auto;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
	}
</style>
