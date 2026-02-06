<script lang="ts">
	import { onMount } from 'svelte';
	import { sidebarStore, sidebarIsOpen, sidebarShowCatalog } from '$lib/stores/sidebarStore';
	import { configStore, componentsConfig } from '$lib/stores/configStore';
	import { mapStore } from '$lib/stores/mapStore';
	import SidebarHeader from './SidebarHeader.svelte';
	import SidebarContent from './SidebarContent.svelte';
	import SidebarFooter from './SidebarFooter.svelte';
	import { SearchBox } from '$lib/components/controls';

	let showSearch = $derived($componentsConfig?.search !== false);

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
		<SidebarHeader />
		{#if showSearch}
			<SearchBox embedded={true} />
		{/if}
		<SidebarContent />
		<SidebarFooter />
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

</style>
