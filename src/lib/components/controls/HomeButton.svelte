<script lang="ts">
	import { mapStore } from '$lib/stores/mapStore';
	import { sidebarIsOpen, SIDEBAR_WIDTH } from '$lib/stores/sidebarStore';

	interface Props {
		sidebarOpen?: boolean;
	}

	let { sidebarOpen = false }: Props = $props();

	let homeCenter = [468152.5616, 5764386.17546];
	let homeZoom = 8;

	function zoomHome() {
		const view = mapStore.getView();
		const map = mapStore.getMap();
		if (!view || !map) return;

		// Offset center to account for sidebar covering part of the viewport
		const center = [...homeCenter];
		if ($sidebarIsOpen) {
			const res = view.getResolutionForZoom(homeZoom) ?? 1;
			center[0] -= (SIDEBAR_WIDTH / 2) * res;
		}

		view.animate({
			center,
			zoom: homeZoom,
			duration: 500
		});
	}
</script>

<button
	class="home-btn"
	class:sidebar-open={sidebarOpen}
	onclick={zoomHome}
	title="Zur Übersicht"
	aria-label="Zur Übersicht zoomen"
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
		<polyline points="9 22 9 12 15 12 15 22"></polyline>
	</svg>
</button>

<style>
	.home-btn {
		position: absolute;
		top: 134px;
		left: 10px;
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
		transition: background-color 0.15s, left 0.3s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		z-index: 100;
	}

	.home-btn.sidebar-open {
		left: var(--sidebar-width);
	}

	.home-btn:hover {
		background: #f0f0f0;
	}

	.home-btn:active {
		background: #e0e0e0;
	}

	.home-btn svg {
		width: 20px;
		height: 20px;
	}
</style>
