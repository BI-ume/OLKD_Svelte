import TileLayer from 'ol/layer/Tile';
import WMTSSource from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { getWidth, getTopLeft } from 'ol/extent';
import { get as getProjection } from 'ol/proj';
import type { Extent } from 'ol/extent';
import type { LayerConfig, WMTSSourceConfig } from './types';
import { Layer } from './Layer';

/**
 * WMTS layer implementation.
 */
export class WMTS extends Layer {
	private sourceConfig: WMTSSourceConfig;

	constructor(config: LayerConfig) {
		super(config);
		this.sourceConfig = (config.olLayer?.source as WMTSSourceConfig) ?? {};
	}

	protected createOlLayer(): TileLayer<WMTSSource> {
		const projectionCode = this.sourceConfig.projection ?? 'EPSG:25832';
		const projection = getProjection(projectionCode);

		if (!projection) {
			throw new Error(`Projection ${projectionCode} not found. Make sure it's registered with proj4.`);
		}

		const extent = this.sourceConfig.extent ?? projection.getExtent();
		if (!extent) {
			throw new Error(`No extent defined for WMTS layer ${this.name}`);
		}

		const levels = this.sourceConfig.levels ?? 22;
		const tileSize = this.sourceConfig.tileSize ?? [256, 256];
		const tileSizeValue = Array.isArray(tileSize) ? tileSize[0] : tileSize;

		const resolutions = this.createResolutions(levels, extent, tileSizeValue);
		const matrixIds = this.createMatrixIds(levels);

		const source = new WMTSSource({
			url: this.buildUrl(),
			layer: this.sourceConfig.layer ?? this.name,
			matrixSet: this.sourceConfig.matrixSet ?? projectionCode,
			format: this.sourceConfig.format ?? 'image/png',
			projection: projection,
			tileGrid: new WMTSTileGrid({
				extent,
				origin: getTopLeft(extent),
				resolutions,
				matrixIds,
				tileSize: tileSizeValue
			}),
			requestEncoding: 'REST',
			style: 'default'
		});

		return new TileLayer({
			source,
			visible: this._visible,
			opacity: this._opacity
		});
	}

	/**
	 * Create resolution array for the tile grid
	 */
	private createResolutions(levels: number, extent: Extent, tileSize: number): number[] {
		const width = getWidth(extent);
		const maxResolution = width / tileSize;

		const resolutions: number[] = [];
		for (let z = 0; z < levels; z++) {
			resolutions[z] = maxResolution / Math.pow(2, z);
		}
		return resolutions;
	}

	/**
	 * Create matrix ID array for the tile grid
	 */
	private createMatrixIds(levels: number): string[] {
		return Array.from({ length: levels }, (_, i) => String(i));
	}

	/**
	 * Build the request URL for WMTS
	 */
	private buildUrl(): string {
		const baseUrl = this.sourceConfig.url ?? '';
		const layer = this.sourceConfig.layer ?? this.name;
		const format = this.sourceConfig.format ?? 'image/png';
		const extension = format.split('/')[1] ?? 'png';

		// REST template URL
		return `${baseUrl}${layer}/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.${extension}`;
	}

	/**
	 * Get the WMTS source
	 */
	getSource(): WMTSSource | null {
		if (this._olLayer) {
			return (this._olLayer as TileLayer<WMTSSource>).getSource();
		}
		return null;
	}
}
