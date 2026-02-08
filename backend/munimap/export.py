# Export routes for MapFish Print integration
import os
import logging
import requests
from flask import Blueprint, jsonify, request, Response, current_app

log = logging.getLogger('munimap.export')

export_bp = Blueprint('export', __name__)

# MapFish Print server configuration
MAPFISH_PRINT_URL = os.environ.get('MAPFISH_PRINT_URL', 'http://munimap-print:8080')


def get_layer_url(layer_name: str) -> str | None:
    """Get the actual WMS URL for a layer by name."""
    layers_config = current_app.layers_config
    layer_def = layers_config.get('layers', {}).get(layer_name)
    if layer_def and 'source' in layer_def:
        return layer_def['source'].get('url')
    return None


def build_mapfish_spec(data: dict, layers_config: dict) -> dict:
    """Build MapFish Print specification from request data."""
    bbox = data.get('bbox', [])
    srs = data.get('srs', 25832)
    scale = data.get('scale', 2500)
    output_format = data.get('outputFormat', 'pdf')
    page_size = data.get('pageSize', [210, 297])
    layer_names = data.get('layers', [])
    opacities = data.get('opacities', {})

    # Build layers array for MapFish
    layers = []
    for layer_name in layer_names:
        layer_def = layers_config.get('layers', {}).get(layer_name)
        if not layer_def:
            continue

        source = layer_def.get('source', {})
        layer_type = source.get('type', '')

        if layer_type == 'TiledWMS':
            # Get base URL from hash map
            url_hash = layer_def.get('url_hash')
            base_url = layers_config.get('hash_map', {}).get(url_hash) if url_hash else source.get('url')

            if base_url:
                layer_spec = {
                    'type': 'WMS',
                    'baseURL': base_url,
                    'layers': source.get('params', {}).get('LAYERS', '').split(','),
                    'imageFormat': 'image/png',
                    'customParams': {
                        'TRANSPARENT': 'true'
                    }
                }

                # Apply opacity if not fully opaque
                if layer_name in opacities:
                    layer_spec['opacity'] = float(opacities[layer_name])

                layers.append(layer_spec)

    # MapFish Print specification
    spec = {
        'layout': 'A4 portrait',  # Default layout
        'outputFormat': output_format,
        'attributes': {
            'map': {
                'projection': f'EPSG:{srs}',
                'dpi': 150,
                'rotation': 0,
                'center': [
                    (bbox[0] + bbox[2]) / 2,
                    (bbox[1] + bbox[3]) / 2
                ],
                'scale': scale,
                'layers': layers
            },
            'title': 'Kartenausdruck',
            'scalebar': {
                'geodetic': False
            }
        }
    }

    return spec


@export_bp.route('/export/map', methods=['POST'])
def submit_print_job():
    """Submit a print job to MapFish Print."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Build MapFish Print specification
        spec = build_mapfish_spec(data, current_app.layers_config)

        # Submit to MapFish Print server
        print_url = f'{MAPFISH_PRINT_URL}/print/report.{data.get("outputFormat", "pdf")}'

        try:
            resp = requests.post(
                print_url,
                json=spec,
                timeout=30
            )

            if resp.status_code == 200:
                result = resp.json()
                # MapFish returns 'ref' with the job reference
                job_ref = result.get('ref', '')

                return jsonify({
                    'status': 'added',
                    'statusURL': f'/export/map/{job_ref}/status',
                    'downloadURL': f'/export/map/{job_ref}/download'
                })
            else:
                log.error(f"MapFish Print error: {resp.status_code} - {resp.text}")
                return jsonify({
                    'status': 'error',
                    'error': 'Print service returned an error'
                }), resp.status_code

        except requests.RequestException as e:
            log.error(f"Failed to connect to MapFish Print: {e}")
            return jsonify({
                'status': 'error',
                'error': 'Could not connect to print service'
            }), 503

    except Exception as e:
        log.error(f"Error submitting print job: {e}")
        return jsonify({'error': str(e)}), 500


@export_bp.route('/export/map/<job_id>/status', methods=['GET'])
def get_print_status(job_id):
    """Get the status of a print job."""
    try:
        status_url = f'{MAPFISH_PRINT_URL}/print/status/{job_id}.json'

        resp = requests.get(status_url, timeout=10)

        if resp.status_code == 200:
            result = resp.json()

            # Map MapFish status to our status
            mf_status = result.get('status', '')
            done = result.get('done', False)

            if done:
                return jsonify({
                    'status': 'finished',
                    'downloadURL': f'/export/map/{job_id}/download'
                })
            elif mf_status == 'error':
                return jsonify({
                    'status': 'error',
                    'error': result.get('error', 'Unknown error')
                })
            else:
                return jsonify({
                    'status': 'inprocess'
                })
        else:
            return jsonify({
                'status': 'error',
                'error': 'Could not get print status'
            }), resp.status_code

    except requests.RequestException as e:
        log.error(f"Failed to get print status: {e}")
        return jsonify({
            'status': 'error',
            'error': 'Could not connect to print service'
        }), 503


@export_bp.route('/export/map/<job_id>/download', methods=['GET'])
def download_print(job_id):
    """Download the completed print job."""
    try:
        download_url = f'{MAPFISH_PRINT_URL}/print/report/{job_id}'

        resp = requests.get(download_url, timeout=60, stream=True)

        if resp.status_code == 200:
            # Get content type from response
            content_type = resp.headers.get('Content-Type', 'application/pdf')

            # Determine filename extension
            if 'pdf' in content_type:
                ext = 'pdf'
            elif 'png' in content_type:
                ext = 'png'
            else:
                ext = 'pdf'

            headers = {
                'Content-Type': content_type,
                'Content-Disposition': f'attachment; filename="karte.{ext}"'
            }

            return Response(
                resp.content,
                status=200,
                headers=headers
            )
        else:
            return jsonify({
                'error': 'Could not download print result'
            }), resp.status_code

    except requests.RequestException as e:
        log.error(f"Failed to download print: {e}")
        return jsonify({
            'error': 'Could not connect to print service'
        }), 503
