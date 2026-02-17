/**
 * Z-index constants for OpenLayers vector layers.
 * Higher values render on top of lower values.
 */
export const Z_INDEX = {
	MEASURE: 1000,
	MEASURE_SEGMENTS: 1001,
	DRAW: 1002,
	SEARCH_MARKER: 1000,
	FEATURE_INFO_HIGHLIGHT: 2001
} as const;
