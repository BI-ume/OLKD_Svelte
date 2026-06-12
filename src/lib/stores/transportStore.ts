import { writable, derived, get } from 'svelte/store';
import { isHoliday, isSunOrHoliday } from 'feiertagejs';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { GeoJSON } from 'ol/format';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { transformExtent } from 'ol/proj';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import type { Map } from 'ol';
import type { TransportConfig } from '$lib/layers/types';

const NIGHT_PLAN_START_HOUR = 1;
const NIGHT_PLAN_END_HOUR = 6;

export interface TimetableInfo {
	origin: string;
	destination: string;
	originCity: string;
	destinationCity: string;
	date: string;
	time: string;
}

interface TransportState {
	active: boolean;
	mode: 'day' | 'night' | null;
	showTimetable: boolean;
	timetableInfo: TimetableInfo;
	selectedRef: string | undefined;
	highlightedRouteId: string | undefined;
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function formatDate(date: Date): string {
	return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatTime(date: Date): string {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function applyNightPlanStart(date: Date): Date {
	const d = new Date(date.getTime());
	d.setHours(NIGHT_PLAN_START_HOUR, 0, 0, 0);
	return d;
}

function getNextNightDate(date: Date): Date {
	let d = applyNightPlanStart(date);
	while (d.getDay() < 6) {
		d.setDate(d.getDate() + 1);
		if (isHoliday(d, 'NW')) break;
	}
	return d;
}

export function detectInitialMode(): 'day' | 'night' {
	const now = new Date();
	const hour = now.getHours();
	if (hour >= NIGHT_PLAN_START_HOUR && hour < NIGHT_PLAN_END_HOUR) {
		if (now.getDay() === 6 || isSunOrHoliday(now, 'NW')) {
			return 'night';
		}
	}
	return 'day';
}

function computeDateTime(mode: 'day' | 'night' | null): { date: string; time: string } {
	let d = new Date();
	d.setMinutes(d.getMinutes() + 5);

	if (mode === 'night') {
		const sunOrHoliday = isSunOrHoliday(d, 'NW');
		const dow = d.getDay();

		if (dow === 6) {
			// Saturday
			if (d.getHours() < NIGHT_PLAN_START_HOUR) {
				d = applyNightPlanStart(d);
			} else if (d.getHours() >= NIGHT_PLAN_END_HOUR) {
				d.setDate(d.getDate() + 1);
				d = applyNightPlanStart(d);
			}
		} else if (sunOrHoliday) {
			if (d.getHours() < NIGHT_PLAN_START_HOUR) {
				d = applyNightPlanStart(d);
			} else if (d.getHours() >= NIGHT_PLAN_END_HOUR) {
				d = getNextNightDate(d);
			}
		} else {
			d = getNextNightDate(d);
		}
	}

	return { date: formatDate(d), time: formatTime(d) };
}

function createTransportStore() {
	const { subscribe, set, update } = writable<TransportState>({
		active: false,
		mode: null,
		showTimetable: true,
		timetableInfo: {
			origin: '',
			destination: '',
			originCity: 'Bielefeld',
			destinationCity: 'Bielefeld',
			date: '',
			time: ''
		},
		selectedRef: undefined,
		highlightedRouteId: undefined
	});

	let config: TransportConfig | null = null;
	let map: Map | null = null;
	let stationSource: VectorSource | null = null;
	let stationLayer: VectorLayer<VectorSource> | null = null;
	let routeSource: VectorSource | null = null;
	let routeLayer: VectorLayer<VectorSource> | null = null;

	function updateDateTime(mode: 'day' | 'night' | null) {
		const { date, time } = computeDateTime(mode);
		update((s) => ({ ...s, timetableInfo: { ...s.timetableInfo, date, time } }));
	}

	return {
		subscribe,

		initialize(mapInstance: Map, transportConfig: TransportConfig) {
			map = mapInstance;
			config = transportConfig;

			const mapProjection = map.getView().getProjection();

			stationSource = new VectorSource({
				strategy: bboxStrategy,
				loader(extent) {
					if (!map) return;
					const bbox4326 = transformExtent(extent, mapProjection, 'EPSG:4326');
					const currentMode = get({ subscribe }).mode;
					if (!currentMode) {
						stationSource!.removeLoadedExtent(extent);
						return;
					}
					const layerName = currentMode === 'day' ? 'mobiel_day' : 'mobiel_night';
					fetch(
						`/api/v1/transport/station_points.geojson?layer=${layerName}&bbox=${bbox4326.join(',')}`
					)
						.then((r) => r.json())
						.then((geojson) => {
							const features = new GeoJSON().readFeatures(geojson, {
								dataProjection: 'EPSG:3857',
								featureProjection: mapProjection
							});
							stationSource!.addFeatures(features);
						})
						.catch(() => {
							stationSource!.removeLoadedExtent(extent);
						});
				}
			});

			stationLayer = new VectorLayer({
				source: stationSource,
				style: new Style({
					image: new CircleStyle({
						radius: 5,
						fill: new Fill({ color: '#003264' }),
						stroke: new Stroke({ color: '#ffffff', width: 1.5 })
					})
				}),
				visible: false,
				zIndex: 200
			});

			routeSource = new VectorSource();
			routeLayer = new VectorLayer({
				source: routeSource,
				style: new Style({
					stroke: new Stroke({ color: '#fa6400', width: 3 })
				}),
				visible: false,
				zIndex: 199
			});

			map.addLayer(stationLayer);
			map.addLayer(routeLayer);
		},

		setMode(mode: 'day' | 'night' | null) {
			const prev = get({ subscribe }).mode;
			update((s) => ({ ...s, mode, active: mode !== null }));

			if (stationLayer) stationLayer.setVisible(mode !== null);
			if (mode !== prev) {
				if (stationSource) stationSource.clear();
				if (routeSource) routeSource.clear();
				if (routeLayer) {
					routeLayer.setVisible(false);
					routeLayer.setStyle(new Style({
						stroke: new Stroke({ color: mode === 'night' ? '#003264' : '#fa6400', width: 3 })
					}));
				}
				update((s) => ({ ...s, selectedRef: undefined, highlightedRouteId: undefined }));
			}
			updateDateTime(mode);
		},

		toggleTimetable() {
			update((s) => ({ ...s, showTimetable: !s.showTimetable }));
		},

		setOrigin(origin: string) {
			update((s) => ({ ...s, timetableInfo: { ...s.timetableInfo, origin } }));
		},

		setDestination(destination: string) {
			update((s) => ({ ...s, timetableInfo: { ...s.timetableInfo, destination } }));
		},

		setDate(date: string) {
			update((s) => ({ ...s, timetableInfo: { ...s.timetableInfo, date } }));
		},

		setTime(time: string) {
			update((s) => ({ ...s, timetableInfo: { ...s.timetableInfo, time } }));
		},

		async getStop(name: string): Promise<string | undefined> {
			if (!config?.timetableServiceURL || !config?.stopfinderAPI) return undefined;
			const url = `${config.timetableServiceURL}${config.stopfinderAPI}&name_sf=${encodeURIComponent(name)}`;
			try {
				const res = await fetch(url);
				const data = await res.json();
				const priorities = config.stopfinderPriorities ?? [];
				if (!priorities.length) return data.locations?.[0]?.id;
				for (const keyword of priorities) {
					const match = data.locations?.find((item: { name: string; id: string }) =>
						item.name.toLowerCase().includes(keyword.toLowerCase())
					);
					if (match) return match.id;
				}
				return data.locations?.[0]?.id;
			} catch {
				return undefined;
			}
		},

		createTripUrl(opts: {
			originStop?: string;
			destinationStop?: string;
			time?: string;
			date?: string;
		}): string {
			if (!config?.timetableServiceURL || !config?.tripAPI) return '';
			const url = new URL(config.tripAPI, config.timetableServiceURL);
			const params = ['itdTripDateTimeDepArr=dep'];

			if (opts.originStop) params.push(`origin=${opts.originStop}`);
			if (opts.destinationStop) params.push(`destination=${opts.destinationStop}`);

			if (opts.time) {
				const [h, m] = opts.time.split(':');
				if (h && m) params.push(`itdTime=${h.padStart(2, '0')}${m.padStart(2, '0')}`);
			}
			if (opts.date) {
				const [d, mo, y] = opts.date.split('.');
				if (d && mo && y)
					params.push(
						`itdDateDayMonthYear=${d.padStart(2, '0')}${mo.padStart(2, '0')}${y.padStart(4, '0')}`
					);
			}

			url.searchParams.set('formik', params.join('&'));
			return url.href;
		},

		toggleRef(ref: string) {
			update((s) => ({
				...s,
				selectedRef: s.selectedRef === ref ? undefined : ref,
				highlightedRouteId: undefined
			}));
			if (routeSource) routeSource.clear();
			if (routeLayer) routeLayer.setVisible(false);
		},

		async toggleRoute(id: string | undefined) {
			const current = get({ subscribe }).highlightedRouteId;
			const next = current === id ? undefined : id;
			update((s) => ({ ...s, highlightedRouteId: next }));

			if (!next) {
				if (routeSource) routeSource.clear();
				if (routeLayer) routeLayer.setVisible(false);
				return;
			}

			if (!map || !routeSource || !routeLayer) return;
			try {
				const res = await fetch(`/api/v1/transport/route/${next}`);
				const geojson = await res.json();
				routeSource.clear();
				const features = new GeoJSON().readFeatures(geojson, {
					dataProjection: 'EPSG:4326',
					featureProjection: map.getView().getProjection()
				});
				routeSource.addFeatures(features);
				routeLayer.setVisible(true);
			} catch {
				/* silently ignore if route API unavailable */
			}
		},

		destroy() {
			if (map && stationLayer) map.removeLayer(stationLayer);
			if (map && routeLayer) map.removeLayer(routeLayer);
			stationSource = null;
			stationLayer = null;
			routeSource = null;
			routeLayer = null;
			map = null;
			config = null;
		}
	};
}

export const transportStore = createTransportStore();
export const transportActive = derived(transportStore, ($s) => $s.active);
export const transportMode = derived(transportStore, ($s) => $s.mode);
export const transportShowTimetable = derived(transportStore, ($s) => $s.showTimetable);
export const transportTimetableInfo = derived(transportStore, ($s) => $s.timetableInfo);
