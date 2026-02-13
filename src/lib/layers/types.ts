// Layer source configuration
export interface WMSSourceConfig {
	url?: string;
	format?: string;
	params?: {
		LAYERS?: string;
		SRS?: string;
		STYLES?: string;
		TRANSPARENT?: string;
	};
	projection?: string;
	tilePixelRatio?: number;
	tileSize?: number[];
	hqUrl?: string;
	hqLayer?: string;
	hqMatrixSet?: string;
}

export interface WMTSSourceConfig {
	url?: string;
	layer?: string;
	projection?: string;
	format?: string;
	extent?: [number, number, number, number];
	levels?: number;
	matrixSet?: string;
	tileSize?: number[];
	hqUrl?: string;
	hqLayer?: string;
	hqMatrixSet?: string;
}

export interface GeoJSONSourceConfig {
	url?: string;
	dataProjection?: string;
	file?: string;
	additionalParameters?: {
		layers?: string[];
	};
}

export interface SensorThingsSourceConfig {
	url?: string;
	urlParameters?: {
		filter?: string;
		expand?: string;
	};
	refreshInterval?: number;
	layer?: string;
}

export type SourceConfig = WMSSourceConfig | WMTSSourceConfig | GeoJSONSourceConfig | SensorThingsSourceConfig;

// OpenLayers layer configuration (as passed from backend)
export interface OlLayerConfig {
	source?: SourceConfig;
	visible?: boolean;
	opacity?: number;
}

// Legend configuration
export interface LegendConfig {
	type?: string; // 'GetLegendGraphic' | 'link' | 'text'
	url?: string;
	title?: string;
	href?: string; // For link type legends (e.g., PDF)
	text?: string; // Display text for link legends
	version?: string; // WMS version override
	sldVersion?: string; // SLD version override
	format?: string; // Image format override
}

// FeatureInfo configuration
export interface FeatureInfoConfig {
	target?: '_popup' | '_blank' | string;  // default '_popup'
	width?: number;    // iframe width in px (default 300)
	height?: number;   // iframe height in px (default 150)
	featureCount?: number;  // WMS FEATURE_COUNT param
	gml?: boolean;     // Request GML format instead of HTML
	catalog?: boolean; // Show catalog layer links (requires gml)
	gmlGroup?: boolean; // Use group_name instead of layer name from GML
	gmlStyle?: {       // Style for GML feature highlights on map
		strokeWidth?: number;
		strokeColor?: string;
		fillColor?: string;
	};
	properties?: Record<string, unknown>;
	catalogGroup?: string;
}

// Search configuration
export interface SearchConfig {
	field?: string;
	title?: string;
	params?: Record<string, string>;
}

// Style configuration for vector layers
export interface StyleConfig {
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	radius?: number;
	externalGraphic?: string;
	graphicWidth?: number;
	graphicHeight?: number;
}

// Layer types supported by the application
export type LayerType =
	| 'wms'
	| 'tiledwms'
	| 'wmts'
	| 'postgis'
	| 'static_geojson'
	| 'dynamic_geojson'
	| 'digitize'
	| 'sensorthings';

// Individual layer configuration
export interface LayerConfig {
	name: string;
	title: string;
	type: LayerType;
	isBackground?: boolean;
	status?: 'active' | 'inactive';
	catalog?: boolean | { title?: string; visible?: boolean };
	olLayer?: OlLayerConfig;
	visible?: boolean;
	metadataUrl?: string;
	legend?: boolean | LegendConfig;
	opacity?: number;
	attribution?: string;
	searchConfig?: SearchConfig[];
	featureinfo?: FeatureInfoConfig;
	style?: StyleConfig;
	externalGraphicPrefix?: string;
	displayInLayerswitcher?: boolean;
	permalink?: boolean;
	catalogLayer?: boolean;
	predefined?: boolean;
	abstract?: string;
	previewImage?: string; // URL to preview image for background selector
}

// Layer group configuration
export interface GroupConfig {
	name: string;
	title: string;
	layers: LayerConfig[];
	status?: 'active' | 'inactive';
	metadataUrl?: string;
	showGroup?: boolean;
	abstract?: string;
	singleSelect?: boolean;
	singleSelectGroup?: boolean;
	legend?: boolean | LegendConfig;
	defaultVisibleLayers?: string[];
	collapsed?: boolean;
	catalog?: boolean | { title?: string; visible?: boolean };
	predefined?: boolean;
}

// Layers definition (returned by Flask API)
export interface LayersDef {
	backgroundLayer: LayerConfig[];
	overlays: GroupConfig[];
}

// Map configuration
export interface MapConfig {
	center?: [number, number];
	centerProjection?: string;
	zoom?: number;
	projection?: string;
	projectionExtent?: [number, number, number, number];
	maxExtent?: [number, number, number, number];
	minZoom?: number;
	maxZoom?: number;
	defaultBackground?: string;
	defaultOverlays?: string[];
}

// Component toggles configuration
export interface ComponentsConfig {
	search?: boolean;
	zoomControls?: boolean;
	homeButton?: boolean;
	geolocation?: boolean;
	gotoButton?: boolean;
	measure?: boolean;
	saveSettings?: boolean;
	scaleLine?: boolean;
	overviewmap?: boolean;
	layerswitcher?: boolean;
	sidebar?: boolean;
	searchCatalog?: boolean;
	// Future / not yet configurable
	legend?: boolean;
	print?: boolean;
	catalog?: boolean;
	alkis?: boolean;
	draw?: boolean;
}

// Sidebar configuration
export interface SidebarConfig {
	defaultOpen?: boolean;
}

// URL sync configuration
export type UrlSyncMode = 'xyz' | 'map' | 'full';

export interface UrlSyncConfig {
	mode?: UrlSyncMode;
}

// Print configuration
export interface PrintConfig {
	mode?: string;
	defaultScale?: number;
	scales?: number[];
	outputFormats?: { name: string; mimetype: string }[];
	pageSizes?: { name: string; width: number; height: number }[];
	defaultPageSize?: string;
	printUrl?: string;
}

// Geolocation configuration
export interface GeolocationConfig {
	tracking?: boolean;
	zoom?: number;
	style?: StyleConfig;
}

// Search provider configuration
export interface SearchProviderConfig {
	url?: string;
	params?: Record<string, string>;
	responseProcessor?: string;
}

// Application configuration (header, title, etc.)
export interface AppHeaderConfig {
	title?: string;
	headerLogo?: string;
	headerLogoLink?: string;
	ogImage?: string;
	iframe?: string;
	tour?: string;
	tooltipDelay?: number;
	showNoBackground?: boolean;
}

// Full application configuration
export interface AppConfig {
	app?: AppHeaderConfig;
	map?: MapConfig;
	components?: ComponentsConfig;
	sidebar?: SidebarConfig;
	urlSync?: UrlSyncConfig;
	printConfig?: PrintConfig;
	geolocationConfig?: GeolocationConfig;
	searchConfig?: SearchProviderConfig[];
	backgrounds?: {
		include?: string[];
		exclude?: string[];
		explicit?: string[];
	};
	layers?: {
		include?: string[];
		exclude?: string[];
		explicit?: string[];
	};
	groups?: {
		include?: string[];
		exclude?: string[];
		explicit?: string[];
		singleSelect?: string[];
	};
}

// API response structure
export interface ConfigApiResponse {
	app: AppConfig;
	layers: LayersDef;
}

// URL configuration for proxies
export interface UrlConfig {
	wmsProxy?: string;
	wmtsProxy?: string;
	staticGeojson?: string;
	icons?: string;
}
