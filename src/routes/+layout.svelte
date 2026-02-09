<script lang="ts">
		let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<title>OLKD Map Viewer</title>
</svelte:head>

<div class="app-container">
	{@render children()}
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			'Helvetica Neue',
			Arial,
			sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.app-container {
		width: 100%;
		height: 100vh;
		position: relative;
		overflow: hidden;
	}
</style>
