<script lang="ts">
	import { configStore } from '$lib/stores/configStore';

	let title = $derived($configStore.app?.app?.title ?? 'bielefeldGEOCLIENT');
	let headerLogoLink = $derived($configStore.app?.app?.headerLogoLink ?? '#');
</script>

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

<style>
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
</style>
