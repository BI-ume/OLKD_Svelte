<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { sidebarStore, sidebarIsOpen, sidebarShowCatalog, sidebarShowPrint } from '$lib/stores/sidebarStore';
	import { configStore, componentsConfig } from '$lib/stores/configStore';
	import { mapStore } from '$lib/stores/mapStore';
	import { SearchBox } from '$lib/components/controls';
	import BackgroundSelection from './BackgroundSelection.svelte';
	import OverlaySelection from './OverlaySelection.svelte';
	import Legend from './Legend.svelte';
	import Catalog from './Catalog.svelte';

	let showSearch = $derived($componentsConfig?.search !== false);
	let showLegend = $derived($configStore.app?.components?.legend !== false);
	let showPrintButton = $derived($configStore.app?.components?.print !== false);
	let showSecondary = $derived($sidebarShowCatalog || $sidebarShowPrint);

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

	// Initialize from config
	onMount(() => {
		const defaultOpen = $configStore.app?.sidebar?.defaultOpen ?? true;
		sidebarStore.initialize(defaultOpen);
	});

	// Update map size after sidebar transition
	function handleTransitionEnd() {
		const map = mapStore.getMap();
		if (map) {
			map.updateSize();
		}
	}
</script>

<div class="sidebar-wrapper" class:open={$sidebarIsOpen} ontransitionend={handleTransitionEnd}>
	<aside class="sidebar">
		<!-- Header -->
		<header class="sidebar-header">
			<a href={headerLogoLink} target="_blank" rel="noopener noreferrer" class="logo-link">
				<img src="/img/logo_BIE_padding.svg" alt="Bielefeld Logo" class="logo" />
			</a>
			<div class="title-section">
				<h1 class="title">{title}</h1>
				<a href={headerLogoLink} target="_blank" rel="noopener noreferrer" class="header-link">
					Geoportal Bielefeld
				</a>
			</div>
		</header>

		<!-- Search -->
		{#if showSearch}
			<SearchBox embedded={true} />
		{/if}

		<!-- Content area with slide panels -->
		<div class="content-wrapper">
			<!-- Main content (backgrounds + overlays + legend + footer) -->
			<div class="sidebar-main" class:hidden={showSecondary}>
				<div class="scrollable">
					<BackgroundSelection />
					<OverlaySelection />
					{#if showLegend}
						<Legend />
					{/if}
				</div>
				<footer class="sidebar-footer">
					{#if showPrintButton}
						<button class="print-btn" onclick={handleOpenPrint}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="6 9 6 2 18 2 18 9"></polyline>
								<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
								<rect x="6" y="14" width="12" height="8"></rect>
							</svg>
							Karte drucken
						</button>
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
				</footer>
			</div>

			<!-- Catalog panel (slides in from right) -->
			<div class="sidebar-secondary" class:visible={$sidebarShowCatalog}>
				<Catalog />
			</div>
		<SidebarContent />
		<SidebarFooter />
		</div>
	</aside>
</div>

<style>
	.sidebar-wrapper {
		width: 0;
		flex-shrink: 0;
		overflow: hidden;
		transition: width 0.3s ease;
	}

	.sidebar-wrapper.open {
		width: 300px;
	}

	.sidebar {
		width: 300px;
		min-width: 300px;
		height: 100%;
		background: white;
		display: flex;
		flex-direction: column;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
	}

	/* Header */
	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border-bottom: 1px solid #e0e0e0;
		background: #f8f8f8;
	}

	.logo-link {
		flex-shrink: 0;
	}

	.logo {
		width: 48px;
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
		color: #333;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-link {
		font-size: 12px;
		color: #666;
		text-decoration: none;
		transition: color 0.15s;
	}

	.header-link:hover {
		color: #E2001A;
		text-decoration: underline;
	}

	/* Content area */
	.content-wrapper {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.sidebar-main,
	.sidebar-secondary {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		transition: transform 0.3s ease;
	}

	.sidebar-main {
		transform: translateX(0);
		display: flex;
		flex-direction: column;
	}

	.sidebar-main.hidden {
		transform: translateX(-100%);
	}

	.sidebar-secondary {
		transform: translateX(100%);
	}

	.sidebar-secondary.visible {
		transform: translateX(0);
	}

	.scrollable {
		flex: 1;
		overflow-y: auto;
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

	/* Footer */
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
