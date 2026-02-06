<script lang="ts">
	import { sidebarShowCatalog } from '$lib/stores/sidebarStore';
	import { configStore } from '$lib/stores/configStore';
	import BackgroundSelection from './BackgroundSelection.svelte';
	import OverlaySection from './OverlaySection.svelte';
	import Legend from './Legend.svelte';
	import Catalog from './Catalog.svelte';

	let showLegend = $derived($configStore.app?.components?.legend !== false);
</script>

<div class="sidebar-content-wrapper">
	<!-- Main content (backgrounds + overlays + legend) -->
	<div class="sidebar-main" class:hidden={$sidebarShowCatalog}>
		<div class="scrollable">
			<BackgroundSelection />
			<OverlaySection />
			{#if showLegend}
				<Legend />
			{/if}
		</div>
	</div>

	<!-- Catalog panel (slides in from right) -->
	<div class="sidebar-catalog" class:visible={$sidebarShowCatalog}>
		<Catalog />
	</div>
</div>

<style>
	.sidebar-content-wrapper {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.sidebar-main,
	.sidebar-catalog {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		transition: transform 0.3s ease;
	}

	.sidebar-main {
		transform: translateX(0);
	}

	.sidebar-main.hidden {
		transform: translateX(-100%);
	}

	.sidebar-catalog {
		transform: translateX(100%);
	}

	.sidebar-catalog.visible {
		transform: translateX(0);
	}

	.scrollable {
		height: 100%;
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
</style>
