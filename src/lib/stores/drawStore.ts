import { writable, derived, get } from 'svelte/store';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { Draw, Modify, Select } from 'ol/interaction';
import { Circle as CircleStyle, Fill, Stroke, Style, Text as OlText } from 'ol/style';
import { GeoJSON } from 'ol/format';
import Feature from 'ol/Feature';
import Overlay from 'ol/Overlay';
import type { Map, MapBrowserEvent } from 'ol';
import type { Geometry } from 'ol/geom';
import type { Coordinate } from 'ol/coordinate';
import type { EventsKey } from 'ol/events';
import { unByKey } from 'ol/Observable';
import { click } from 'ol/events/condition';

export type DrawTool = 'none' | 'point' | 'line' | 'polygon' | 'text' | 'modify';

export interface DrawStyle {
	strokeColor: string;
	strokeWidth: number;
	strokeOpacity: number;
	strokeDash: number[];
	fillColor: string;
	fillOpacity: number;
	pointRadius: number;
	pointColor: string;
	pointOpacity: number;
	isTextFeature: boolean;
	text: string;
	fontSize: number;
	fontColor: string;
	fontBold: boolean;
	fontItalic: boolean;
	textRotation: number;
}

export const DEFAULT_DRAW_STYLE: DrawStyle = {
	strokeColor: '#3399CC',
	strokeWidth: 2,
	strokeOpacity: 1,
	strokeDash: [],
	fillColor: '#FFFFFF',
	fillOpacity: 0.4,
	pointRadius: 5,
	pointColor: '#3399CC',
	pointOpacity: 1,
	isTextFeature: false,
	text: '',
	fontSize: 12,
	fontColor: '#333333',
	fontBold: false,
	fontItalic: false,
	textRotation: 0
};

export const DASH_STYLES: { label: string; value: number[] }[] = [
	{ label: 'Durchgezogen', value: [] },
	{ label: 'Gestrichelt', value: [10, 10] },
	{ label: 'Gepunktet', value: [2, 6] },
	{ label: 'Strichpunkt', value: [10, 6, 2, 6] },
	{ label: 'Lang gestrichelt', value: [20, 10] },
	{ label: 'Kurz gestrichelt', value: [6, 6] }
];

export const COLOR_PALETTE = [
	'#FFFFFF', '#00FFFF', '#00FF00', '#FFFF00',
	'#FF0000', '#FF6600', '#002680', '#607CBF',
	'#59FFFF', '#0080FF', '#006600', '#8529CC',
	'#FF8000', '#CC0033', '#000000', '#666666',
	'#999999'
];

interface DrawState {
	activeTool: DrawTool;
	selectedFeatureId: string | null;
	currentStyle: DrawStyle;
	showStylePopup: boolean;
	featureCount: number;
	popupCoordinate: Coordinate | null;
	layerVisible: boolean;
}

function createDrawStore() {
	const { subscribe, set, update } = writable<DrawState>({
		activeTool: 'none',
		selectedFeatureId: null,
		currentStyle: { ...DEFAULT_DRAW_STYLE },
		showStylePopup: false,
		featureCount: 0,
		popupCoordinate: null,
		layerVisible: true
	});

	let map: Map | null = null;
	let source: VectorSource | null = null;
	let layer: VectorLayer<VectorSource> | null = null;
	let drawInteraction: Draw | null = null;
	let modifyInteraction: Modify | null = null;
	let selectInteraction: Select | null = null;
	let popupOverlay: Overlay | null = null;
	let featureIdCounter = 0;
	let clickListenerKey: EventsKey | null = null;
	let pointerMoveKey: EventsKey | null = null;
	let suppressClickUntil = 0;

	function buildOlStyle(drawStyle: DrawStyle, geomType?: string): Style {
		const isText = drawStyle.isTextFeature;

		const stroke = new Stroke({
			color: hexToRgba(drawStyle.strokeColor, drawStyle.strokeOpacity),
			width: drawStyle.strokeWidth,
			lineDash: drawStyle.strokeDash.length > 0 ? drawStyle.strokeDash : undefined
		});

		const fill = new Fill({
			color: hexToRgba(drawStyle.fillColor, drawStyle.fillOpacity)
		});

		const style = new Style({ stroke, fill });

		if (geomType === 'Point' || geomType === undefined) {
			if (isText) {
				const fontParts: string[] = [];
				if (drawStyle.fontBold) fontParts.push('bold');
				if (drawStyle.fontItalic) fontParts.push('italic');
				fontParts.push(`${drawStyle.fontSize}px`);
				fontParts.push('sans-serif');

				style.setText(new OlText({
					text: drawStyle.text,
					font: fontParts.join(' '),
					fill: new Fill({ color: drawStyle.fontColor }),
					stroke: new Stroke({ color: '#ffffff', width: 3 }),
					rotation: (drawStyle.textRotation * Math.PI) / 180,
					textAlign: 'center',
					textBaseline: 'middle'
				}));
				style.setImage(undefined as any);
			} else {
				style.setImage(new CircleStyle({
					radius: drawStyle.pointRadius,
					fill: new Fill({ color: hexToRgba(drawStyle.pointColor, drawStyle.pointOpacity) }),
					stroke: new Stroke({ color: hexToRgba(drawStyle.strokeColor, drawStyle.strokeOpacity), width: drawStyle.strokeWidth })
				}));
			}
		}

		return style;
	}

	function styleFunction(feature: Feature<Geometry>): Style {
		const drawStyle = feature.get('drawStyle') as DrawStyle | undefined;
		const style = drawStyle || get({ subscribe }).currentStyle;
		const geom = feature.getGeometry();
		const geomType = geom?.getType();
		return buildOlStyle(style, geomType);
	}

	function hexToRgba(hex: string, opacity: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

	function removeInteractions() {
		if (map) {
			if (drawInteraction) {
				map.removeInteraction(drawInteraction);
				drawInteraction = null;
			}
			if (modifyInteraction) {
				map.removeInteraction(modifyInteraction);
				modifyInteraction = null;
			}
			if (selectInteraction) {
				selectInteraction.getFeatures().clear();
				map.removeInteraction(selectInteraction);
				selectInteraction = null;
			}
		}
	}

	function updateFeatureCount() {
		if (source) {
			update((s) => ({ ...s, featureCount: source!.getFeatures().length }));
		}
	}

	function assignFeatureId(feature: Feature<Geometry>): string {
		const id = `draw_${++featureIdCounter}`;
		feature.setId(id);
		return id;
	}

	/** Get the top-center coordinate of a feature's geometry for popup positioning */
	function getFeatureCoordinate(feature: Feature<Geometry>): Coordinate | null {
		const geom = feature.getGeometry();
		if (!geom) return null;
		const type = geom.getType();
		if (type === 'Point') {
			return (geom as any).getCoordinates();
		}
		// For lines and polygons, use the top-center of the extent
		const extent = geom.getExtent();
		// extent = [minX, minY, maxX, maxY] — top-center = midX, maxY
		return [(extent[0] + extent[2]) / 2, extent[3]];
	}

	/** Change cursor to pointer when hovering over draw features */
	function handlePointerMove(e: MapBrowserEvent<any>) {
		if (!map || !layer) return;
		const state = get({ subscribe });

		// Don't change cursor while actively drawing
		if (state.activeTool === 'point' || state.activeTool === 'line' ||
			state.activeTool === 'polygon' || state.activeTool === 'text') {
			return;
		}

		const hit = map.forEachFeatureAtPixel(e.pixel, (_f, l) => l === layer);
		const target = map.getTargetElement() as HTMLElement;
		if (target) {
			target.style.cursor = hit ? 'pointer' : '';
		}
	}

	/** Always-on click handler: clicking any draw feature opens popup */
	function handleMapClick(e: MapBrowserEvent<any>) {
		if (!map || !layer) return;

		// Suppress clicks briefly after drawend to avoid race condition
		if (Date.now() < suppressClickUntil) return;

		const state = get({ subscribe });

		// Don't intercept clicks while actively drawing
		if (state.activeTool === 'point' || state.activeTool === 'line' ||
			state.activeTool === 'polygon' || state.activeTool === 'text') {
			return;
		}

		// Don't intercept while modify tool has its own Select
		if (state.activeTool === 'modify') return;

		const pixel = e.pixel;
		const hit = map.forEachFeatureAtPixel(pixel, (f, l) => {
			if (l === layer) return f as Feature<Geometry>;
			return undefined;
		});

		if (hit) {
			const feature = hit as Feature<Geometry>;
			let id = feature.getId() as string;
			if (!id) id = assignFeatureId(feature);

			const coord = getFeatureCoordinate(feature);
			update((s) => ({
				...s,
				selectedFeatureId: id,
				showStylePopup: true,
				popupCoordinate: coord
			}));
		} else if (state.showStylePopup) {
			// Clicked empty area — close popup
			update((s) => ({
				...s,
				selectedFeatureId: null,
				showStylePopup: false,
				popupCoordinate: null
			}));
		}
	}

	return {
		subscribe,

		initialize: (olMap: Map): void => {
			map = olMap;

			source = new VectorSource();
			layer = new VectorLayer({
				source,
				style: (feature) => styleFunction(feature as Feature<Geometry>),
				zIndex: 1002
			});
			map.addLayer(layer);

			source.on('addfeature', updateFeatureCount);
			source.on('removefeature', updateFeatureCount);

			// Always-on click listener for feature selection
			clickListenerKey = map.on('singleclick', handleMapClick);
			pointerMoveKey = map.on('pointermove', handlePointerMove);
		},

		destroy: (): void => {
			removeInteractions();
			if (clickListenerKey) {
				unByKey(clickListenerKey);
				clickListenerKey = null;
			}
			if (pointerMoveKey) {
				unByKey(pointerMoveKey);
				pointerMoveKey = null;
			}
			if (map && layer) {
				map.removeLayer(layer);
			}
			if (map && popupOverlay) {
				map.removeOverlay(popupOverlay);
				popupOverlay = null;
			}
			source = null;
			layer = null;
			map = null;
			set({
				activeTool: 'none',
				selectedFeatureId: null,
				currentStyle: { ...DEFAULT_DRAW_STYLE },
				showStylePopup: false,
				featureCount: 0,
				popupCoordinate: null,
				layerVisible: true
			});
		},

		setTool: (tool: DrawTool): void => {
			removeInteractions();
			update((s) => ({
				...s,
				activeTool: tool,
				selectedFeatureId: null,
				showStylePopup: false,
				popupCoordinate: null
			}));

			if (!map || !source) return;

			if (tool === 'point' || tool === 'line' || tool === 'polygon' || tool === 'text') {
				const typeMap: Record<string, 'Point' | 'LineString' | 'Polygon'> = {
					point: 'Point',
					line: 'LineString',
					polygon: 'Polygon',
					text: 'Point'
				};

				drawInteraction = new Draw({
					source,
					type: typeMap[tool]
				});

				drawInteraction.on('drawend', (e) => {
					const feature = e.feature;
					const id = assignFeatureId(feature);
					const state = get({ subscribe });
					const style = { ...state.currentStyle };

					if (tool === 'text') {
						style.isTextFeature = true;
						style.text = style.text || 'Text';
					}

					feature.set('drawStyle', style);

					// Deactivate draw tool and open popup at feature
					const coord = getFeatureCoordinate(feature);

					// Suppress singleclick handler so it doesn't close the popup
					suppressClickUntil = Date.now() + 500;

					// Remove draw interaction after current event finishes
					setTimeout(() => {
						removeInteractions();
					}, 0);

					update((s) => ({
						...s,
						activeTool: 'none',
						selectedFeatureId: id,
						showStylePopup: true,
						popupCoordinate: coord
					}));
				});

				map.addInteraction(drawInteraction);
			} else if (tool === 'modify') {
				selectInteraction = new Select({
					layers: [layer!],
					condition: click,
					style: null // use feature's own style
				});

				// In modify mode, only track selection for geometry editing — no style popup
			selectInteraction.on('select', (e) => {
					const selected = e.selected;
					if (selected.length > 0) {
						const feature = selected[0];
						let id = feature.getId() as string;
						if (!id) id = assignFeatureId(feature as Feature<Geometry>);
						update((s) => ({ ...s, selectedFeatureId: id }));
					} else {
						update((s) => ({ ...s, selectedFeatureId: null }));
					}
				});

				modifyInteraction = new Modify({
					features: selectInteraction.getFeatures()
				});

				map.addInteraction(selectInteraction);
				map.addInteraction(modifyInteraction);
			}
		},

		getSelectedFeature: (): Feature<Geometry> | null => {
			const state = get({ subscribe });
			if (!source || !state.selectedFeatureId) return null;
			return source.getFeatureById(state.selectedFeatureId) as Feature<Geometry> | null;
		},

		applyStyleToSelected: (style: Partial<DrawStyle>): void => {
			const state = get({ subscribe });
			if (!source || !state.selectedFeatureId) return;

			const feature = source.getFeatureById(state.selectedFeatureId) as Feature<Geometry> | null;
			if (!feature) return;

			const existing = (feature.get('drawStyle') as DrawStyle) || { ...state.currentStyle };
			const updated = { ...existing, ...style };
			feature.set('drawStyle', updated);
			feature.changed();

			// Also update currentStyle as default for new features
			update((s) => ({
				...s,
				currentStyle: { ...s.currentStyle, ...style }
			}));
		},

		getSelectedStyle: (): DrawStyle | null => {
			const state = get({ subscribe });
			if (!source || !state.selectedFeatureId) return null;
			const feature = source.getFeatureById(state.selectedFeatureId) as Feature<Geometry> | null;
			if (!feature) return null;
			return (feature.get('drawStyle') as DrawStyle) || null;
		},

		getSelectedGeometryType: (): string | null => {
			const state = get({ subscribe });
			if (!source || !state.selectedFeatureId) return null;
			const feature = source.getFeatureById(state.selectedFeatureId) as Feature<Geometry> | null;
			if (!feature) return null;
			return feature.getGeometry()?.getType() || null;
		},

		deleteSelected: (): void => {
			const state = get({ subscribe });
			if (!source || !state.selectedFeatureId) return;
			const feature = source.getFeatureById(state.selectedFeatureId) as Feature<Geometry> | null;
			if (feature) {
				source.removeFeature(feature);
				if (selectInteraction) {
					selectInteraction.getFeatures().clear();
				}
			}
			update((s) => ({
				...s,
				selectedFeatureId: null,
				showStylePopup: false,
				popupCoordinate: null
			}));
		},

		closeStylePopup: (): void => {
			update((s) => ({
				...s,
				selectedFeatureId: null,
				showStylePopup: false,
				popupCoordinate: null
			}));
			if (selectInteraction) {
				selectInteraction.getFeatures().clear();
			}
		},

		/** Register the OL Overlay for the popup */
		setPopupOverlay: (overlay: Overlay): void => {
			popupOverlay = overlay;
			if (map) {
				map.addOverlay(overlay);
			}
		},

		removePopupOverlay: (): void => {
			if (map && popupOverlay) {
				map.removeOverlay(popupOverlay);
				popupOverlay = null;
			}
		},

		clearAll: (): void => {
			if (source) source.clear();
			if (selectInteraction) {
				selectInteraction.getFeatures().clear();
			}
			update((s) => ({
				...s,
				selectedFeatureId: null,
				showStylePopup: false,
				featureCount: 0,
				popupCoordinate: null
			}));
		},

		toggleLayerVisibility: (): void => {
			if (!layer) return;
			const newVisible = !layer.getVisible();
			layer.setVisible(newVisible);
			update((s) => ({ ...s, layerVisible: newVisible }));
		},

		setLayerVisible: (visible: boolean): void => {
			if (!layer) return;
			layer.setVisible(visible);
			update((s) => ({ ...s, layerVisible: visible }));
		},

		exportGeoJSON: (): string | null => {
			if (!source) return null;
			const features = source.getFeatures();
			if (features.length === 0) return null;

			const format = new GeoJSON();
			const cloned = features.map((f) => {
				const clone = f.clone();
				const drawStyle = f.get('drawStyle') as DrawStyle | undefined;
				if (drawStyle) {
					Object.entries(drawStyle).forEach(([key, value]) => {
						if (Array.isArray(value)) {
							clone.set(`drawStyle_${key}`, JSON.stringify(value));
						} else {
							clone.set(`drawStyle_${key}`, value);
						}
					});
					clone.unset('drawStyle');
				}
				return clone;
			});

			const tempSource = new VectorSource({ features: cloned });
			return format.writeFeatures(tempSource.getFeatures(), {
				featureProjection: 'EPSG:25832'
			});
		},

		importGeoJSON: (geojsonStr: string): void => {
			if (!source) return;

			const format = new GeoJSON();
			const features = format.readFeatures(geojsonStr, {
				featureProjection: 'EPSG:25832'
			}) as Feature<Geometry>[];

			features.forEach((feature) => {
				const style: Partial<DrawStyle> = {};
				const props = feature.getProperties();
				let hasStyle = false;

				Object.keys(props).forEach((key) => {
					if (key.startsWith('drawStyle_')) {
						hasStyle = true;
						const styleKey = key.replace('drawStyle_', '') as keyof DrawStyle;
						let value = props[key];

						if (typeof value === 'string' && value.startsWith('[')) {
							try { value = JSON.parse(value); } catch { /* keep string */ }
						}

						(style as any)[styleKey] = value;
						feature.unset(key);
					}
				});

				if (hasStyle) {
					feature.set('drawStyle', { ...DEFAULT_DRAW_STYLE, ...style });
				}

				assignFeatureId(feature);
				source!.addFeature(feature);
			});
		},

		getSource: (): VectorSource | null => source,
		getLayer: (): VectorLayer<VectorSource> | null => layer,
		getMap: (): Map | null => map
	};
}

export const drawStore = createDrawStore();

export const drawActiveTool = derived(drawStore, ($s) => $s.activeTool);
export const drawSelectedFeatureId = derived(drawStore, ($s) => $s.selectedFeatureId);
export const drawShowStylePopup = derived(drawStore, ($s) => $s.showStylePopup);
export const drawFeatureCount = derived(drawStore, ($s) => $s.featureCount);
export const drawCurrentStyle = derived(drawStore, ($s) => $s.currentStyle);
export const drawPopupCoordinate = derived(drawStore, ($s) => $s.popupCoordinate);
export const drawLayerVisible = derived(drawStore, ($s) => $s.layerVisible);
