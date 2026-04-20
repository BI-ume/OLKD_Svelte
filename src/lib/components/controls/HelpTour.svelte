<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { helpStore, helpIsActive } from '$lib/stores/helpStore';
	import { sidebarStore } from '$lib/stores/sidebarStore';
    import { fade, fly, slide } from 'svelte/transition';

	interface TourStep {
		id: string;
		title: string;
		selector: string | null;
		description: string;
	}

	const TOUR_STEPS: TourStep[] = [
		{
			id: 'search',
			title: 'Suche',
			selector: '[data-tour="search"]',
			description:
				'Mit der Suchfunktion finden Sie Adressen, Stadtteile und Orte in Bielefeld. Geben Sie mindestens 3 Zeichen ein, um Vorschläge zu erhalten. Mit den Pfeiltasten navigieren Sie durch die Ergebnisse.'
		},
		{
			id: 'backgrounds',
			title: 'Hintergrundkarten',
			selector: '[data-tour="background-selection"]',
			description:
				'Wählen Sie zwischen verschiedenen Hintergrundkarten, z. B. Stadtplan, Luftbild oder topografische Karte. Die Auswahl erfolgt per Klick auf das Vorschaubild.'
		},
		{
			id: 'overlays',
			title: 'Themen / Inhalte',
			selector: '[data-tour="overlay-selection"]',
			description:
				'Schalten Sie thematische Kartenebenen ein oder aus. Der „◑"-Schieberegler steuert die Transparenz. Per Drag & Drop am "=" können Themen neu angeordnet werden. Das „i"-Symbol öffnet Metadaten, das „✕"-Symbol entfernt ein Thema.'
		},
		{
			id: 'catalog',
			title: 'Themenkatalog',
			selector: '[data-tour="catalog-btn"]',
			description:
				'Öffnen Sie den Themenkatalog, um aus einer Vielzahl thematischer Karten zu wählen. Themen lassen sich direkt zur Karte hinzufügen oder entfernen. Ein Suchfeld hilft beim schnellen Auffinden.'
		},
		{
			id: 'legend',
			title: 'Legende',
			selector: '[data-tour="legend"]',
			description:
				'Die Legende zeigt die Symbole und Farben der aktiven Kartenthemen. Klicken Sie auf den Namen eines Themas, um seine Legende ein- oder auszublenden.'
		},
		{
			id: 'draw',
			title: 'Zeichenwerkzeug',
			selector: '[data-tour="draw-btn"]',
			description:
				'Mit dem Zeichenwerkzeug erstellen Sie Punkte, Linien, Flächen und Texte auf der Karte. Farbe, Linienstärke und weitere Optionen lassen sich pro Objekt anpassen. Zeichnungen können als GeoJSON exportiert und importiert werden.'
		},
		{
			id: 'print',
			title: 'Drucken',
			selector: '[data-tour="print-btn"]',
			description:
				'Erstellen Sie Kartenausdrucke als PDF oder PNG in verschiedenen Papiergrößen und Ausrichtungen. Ein verschiebbarer Rahmen auf der Karte zeigt den Druckbereich.'
		},
		{
			id: 'measure',
			title: 'Messen',
			selector: '[data-tour="measure"]',
			description:
				'Messen Sie Koordinaten, Abstände und Flächen direkt auf der Karte. Klicken Sie auf das Symbol und wählen Sie die gewünschte Messmethode. Das Ergebnis wird laufend angezeigt.'
		},
		{
			id: 'save-settings',
			title: 'Einstellungen speichern',
			selector: '[data-tour="save-settings"]',
			description:
				'Speichern Sie die aktuelle Kartenansicht als benanntes Profil – inklusive sichtbarer Themen, deren Transparenzen und Reihenfolge. Gespeicherte Profile können jederzeit wiederhergestellt werden.'
		},
		{
			id: 'scale',
			title: 'Maßstabsleiste',
			selector: '[data-tour="scale-line"]',
			description:
				'Die Maßstabsleiste zeigt den aktuellen Kartenmaßstab an. Ein Klick öffnet einen Dialog zur direkten Maßstabseingabe – z. B. 1:10.000. So finden Sie schnell den gewünschten Detailgrad.'
		},
		{
			id: 'zoom',
			title: 'Zoom & Navigation',
			selector: '[data-tour="map-navi"]',
			description:
				'Zoomen Sie mit den Plus- und Minus-Schaltflächen oder dem Mausrad. Der Haus-Button setzt die Ansicht auf den Standardausschnitt von Bielefeld zurück. Über das Standort-Symbol springen Sie zu Ihrem aktuellen Ort.'
		},
		{
			id: 'context-menu',
			title: 'Kontextmenü',
			selector: null,
			description:
				'Ein Rechtsklick auf die Karte öffnet das Kontextmenü. Es zeigt die Koordinaten des angeklickten Punktes (WGS84 und UTM/EPSG:25832) zum Kopieren und bietet Links zu externen Diensten wie Schrägluftbildern, 3D-Stadtmodell, Mängelmelder und Google Maps.'
		}
	];

	const TOTAL = TOUR_STEPS.length;

	let spotlightStyle = $state('');
	let cardStyle = $state('bottom: 24px; left: 50%; transform: translateX(-50%); width: min(460px, calc(100vw - 32px))');
	let hasSpotlight = $state(false);

	$effect(() => {
		if ($helpIsActive) {
			sidebarStore.open();
			const step = $helpStore.currentStep;
			updatePositions(step);
		} else {
			hasSpotlight = false;
		}
	});

	async function updatePositions(stepIndex: number) {
		await tick();

		const step = TOUR_STEPS[stepIndex];
		const sel = step?.selector;
		const cardW = Math.min(460, window.innerWidth - 32);

		if (!sel) {
			hasSpotlight = false;
			const left = window.innerWidth / 2 - cardW / 2;
			cardStyle = `bottom: 24px; left: ${left}px; width: ${cardW}px`;
			return;
		}

		const el = document.querySelector<HTMLElement>(sel);
		if (!el) {
			hasSpotlight = false;
			const left = window.innerWidth / 2 - cardW / 2;
			cardStyle = `bottom: 24px; left: ${left}px; width: ${cardW}px`;
			return;
		}

		// Scroll element into view inside its scroll container
		el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
		await new Promise((r) => setTimeout(r, 350));

		const rect = el.getBoundingClientRect();
		const pad = 8;
		spotlightStyle = `top:${rect.top - pad}px;left:${rect.left - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`;
		hasSpotlight = true;

		// Position card: prefer below, then above, then bottom of viewport
		const margin = 12;
		const cardH = 270;
		const vpH = window.innerHeight;
		const vpW = window.innerWidth;

		let cardTop: number;
		const spaceBelow = vpH - rect.bottom - pad - margin;
		const spaceAbove = rect.top - pad - margin;

		if (spaceBelow >= cardH) {
			cardTop = rect.bottom + pad + margin;
		} else if (spaceAbove >= cardH) {
			cardTop = rect.top - pad - margin - cardH;
		} else {
			// Neither fits cleanly — place below anyway, card may overlap slightly
			cardTop = Math.max(margin, Math.min(rect.bottom + pad + margin, vpH - cardH - margin));
		}

		// Center card on target element, clamped to viewport
		let cardLeft = rect.left + rect.width / 2 - cardW / 2;
		cardLeft = Math.max(margin, Math.min(cardLeft, vpW - cardW - margin));

		cardStyle = `top:${cardTop}px;left:${cardLeft}px;width:${cardW}px`;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!$helpIsActive) return;
		if (e.key === 'Escape') {
			helpStore.end();
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			helpStore.next(TOTAL);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			helpStore.prev();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if $helpIsActive}
	{@const step = TOUR_STEPS[$helpStore.currentStep]}

	<!-- Full-screen blocker (prevents map interaction) -->
	<div 
		class="tour-overlay"
		class:no-spotlight={!hasSpotlight}
		role="presentation"
		transition:fade
	></div>

	<!-- Spotlight cutout -->
	{#if hasSpotlight}
		<div class="tour-spotlight" style={spotlightStyle}></div>
	{/if}

	<!-- Step card -->
	<div
		class="tour-card"
		style={cardStyle}
		role="dialog"
		aria-modal="true"
		aria-label="Hilfe: {step.title}"
		transition:fly={{x: -500}}
	>
		<!-- Table of contents panel -->
		{#if $helpStore.tocOpen}
			<div class="toc-panel" transition:slide={{axis: 'x'}}>
				<div class="toc-title">Inhaltsverzeichnis</div>
				<ul class="toc-list">
					{#each TOUR_STEPS as s, i}
						<li>
							<button
								class="toc-item"
								class:active={i === $helpStore.currentStep}
								onclick={() => helpStore.goToStep(i)}
							>
								<span class="toc-num">{i + 1}</span>
								{s.title}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Main content -->
		<div class="card-main">
			<div class="card-header">
				<button
					class="toc-btn"
					class:active={$helpStore.tocOpen}
					onclick={() => helpStore.toggleToc()}
					title="Inhaltsverzeichnis"
					aria-label="Inhaltsverzeichnis"
					aria-expanded={$helpStore.tocOpen}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="12" x2="15" y2="12"></line>
						<line x1="3" y1="18" x2="18" y2="18"></line>
					</svg>
				</button>
				<span class="step-counter">Schritt {$helpStore.currentStep + 1} von {TOTAL}</span>
				<button class="close-btn" onclick={() => helpStore.end()} aria-label="Tour beenden">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<h3 class="step-title">{step.title}</h3>
			<p class="step-desc">{step.description}</p>

			<div class="card-footer">
				<button
					class="nav-btn"
					onclick={() => helpStore.prev()}
					disabled={$helpStore.currentStep === 0}
					aria-label="Vorheriger Schritt"
				>
					← Zurück
				</button>
				<div class="step-dots">
					{#each TOUR_STEPS as _, i}
						<button
							class="dot"
							class:active={i === $helpStore.currentStep}
							onclick={() => helpStore.goToStep(i)}
							aria-label="Zu Schritt {i + 1}"
						></button>
					{/each}
				</div>
				{#if $helpStore.currentStep < TOTAL - 1}
					<button
						class="nav-btn primary"
						onclick={() => helpStore.next(TOTAL)}
						aria-label="Nächster Schritt"
					>
						Weiter →
					</button>
				{:else}
					<button class="nav-btn primary" onclick={() => helpStore.end()}>Fertig ✓</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Overlay: blocks all pointer events on the map */
	.tour-overlay {
		position: fixed;
		inset: 0;
		z-index: 9990;
		pointer-events: all;
		background: transparent;
	}

	.tour-overlay.no-spotlight {
		background: rgba(0, 0, 0, 0.65);
	}

	/* Spotlight: transparent box whose box-shadow darkens everything else */
	.tour-spotlight {
		position: fixed;
		z-index: 9991;
		border-radius: 6px;
		pointer-events: none;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
		outline: 2px solid rgba(255, 255, 255, 0.6);
		transition:
			top 0.3s ease,
			left 0.3s ease,
			width 0.3s ease,
			height 0.3s ease;
	}

	/* Step card */
	.tour-card {
		position: fixed;
		z-index: 9992;
		display: flex;
		background: white;
		border-radius: 10px;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.3),
			0 2px 8px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		transition:
			top 0.3s ease,
			left 0.3s ease,
			bottom 0.3s ease;
		height: 270px;
	}

	/* ToC panel */
	.toc-panel {
		width: 160px;
		flex-shrink: 0;
		border-right: 1px solid #e8e8e8;
		background: #f8f9fa;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.toc-title {
		padding: 12px 12px 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
		border-bottom: 1px solid #e8e8e8;
		flex-shrink: 0;
	}

	.toc-list {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		overflow-y: auto;
		flex: 1;
	}

	.toc-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 12px;
		background: none;
		border: none;
		font-size: 12px;
		color: #555;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s;
		line-height: 1.3;
	}

	.toc-item:hover {
		background: #efefef;
		color: #222;
	}

	.toc-item.active {
		background: #e3f2fd;
		color: #1565c0;
		font-weight: 500;
	}

	.toc-num {
		font-size: 10px;
		color: #aaa;
		width: 14px;
		flex-shrink: 0;
		text-align: right;
	}

	.toc-item.active .toc-num {
		color: #1565c0;
	}

	/* Main content */
	.card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 8px;
		border-bottom: 1px solid #f0f0f0;
	}

	.toc-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		background: none;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
		transition: background-color 0.15s, color 0.15s;
	}

	.toc-btn:hover,
	.toc-btn.active {
		background: #e3f2fd;
		color: #1565c0;
		border-color: #90caf9;
	}

	.toc-btn svg {
		width: 14px;
		height: 14px;
	}

	.step-counter {
		flex: 1;
		font-size: 12px;
		color: #888;
		text-align: center;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		background: none;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
		transition: background-color 0.15s, color 0.15s;
	}

	.close-btn:hover {
		background: #fce4e4;
		color: #c62828;
		border-color: #ef9a9a;
	}

	.close-btn svg {
		width: 14px;
		height: 14px;
	}

	.step-title {
		margin: 0;
		padding: 12px 16px 4px;
		font-size: 16px;
		font-weight: 600;
		color: #1a1a1a;
	}

	.step-desc {
		margin: 0;
		padding: 4px 16px 12px;
		font-size: 13px;
		color: #444;
		line-height: 1.55;
		overflow-y: auto;
		flex: 1;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		border-top: 1px solid #f0f0f0;
		flex-shrink: 0;
	}

	.nav-btn {
		padding: 6px 14px;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
		color: #444;
		cursor: pointer;
		transition: background-color 0.15s;
		white-space: nowrap;
	}

	.nav-btn:hover:not(:disabled) {
		background: #e8e8e8;
	}

	.nav-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.nav-btn.primary {
		background: #1976d2;
		border-color: #1565c0;
		color: white;
	}

	.nav-btn.primary:hover {
		background: #1565c0;
	}

	/* Step progress dots */
	.step-dots {
		display: flex;
		gap: 5px;
		flex-wrap: wrap;
		justify-content: center;
		flex: 1;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ddd;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: background-color 0.15s, transform 0.15s;
	}

	.dot:hover {
		background: #aaa;
		transform: scale(1.3);
	}

	.dot.active {
		background: #1976d2;
		transform: scale(1.2);
	}
</style>
