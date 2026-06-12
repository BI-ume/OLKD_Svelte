<script lang="ts">
	import { componentsConfig, metadataPopupStore, metadataPopupIsOpen, metadataPopupUrl, metadataPopupTitle } from '$lib/stores';
	import { sidebarIsOpen } from '$lib/stores/sidebarStore';
	import { SearchBox, PrintPreview, DrawLayer, DrawStylePopup } from '$lib/components/controls';
	import MetadataPopup from '$lib/components/sidebar/MetadataPopup.svelte';

	let { children } = $props();

	let showSearch = $derived($componentsConfig?.search !== false);
	let showSidebar = $derived($componentsConfig?.sidebar !== false);
	let showDraw = $derived($componentsConfig?.draw !== false);
</script>

{#if showSearch && !showSidebar}
	<SearchBox sidebarOpen={$sidebarIsOpen} />
{/if}
<PrintPreview />
{#if showDraw}
	<DrawLayer />
	<DrawStylePopup />
{/if}
{@render children()}
{#if $metadataPopupIsOpen}
	<MetadataPopup
		url={$metadataPopupUrl}
		title={$metadataPopupTitle}
		onClose={() => metadataPopupStore.close()}
	/>
{/if}
