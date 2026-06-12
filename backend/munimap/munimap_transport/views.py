import os
import json
import logging

from flask import Blueprint, jsonify, request, Response, current_app

log = logging.getLogger('munimap.transport')

transport_api = Blueprint('transport_api', __name__)


def _get_db_uri():
    return current_app.config.get('SQLALCHEMY_LAYER_DATABASE_URI', '')


def _db_available():
    return bool(_get_db_uri())


@transport_api.get('/api/v1/transport/stations.geojson')
def stations():
    if not _db_available():
        return jsonify({'error': 'Database not configured'}), 503

    layer = request.args.get('layer')
    bbox_str = request.args.get('bbox')
    if not layer or not bbox_str:
        return jsonify({'error': 'Missing layer or bbox parameter'}), 400

    bbox = [float(x) for x in bbox_str.split(',')]

    from munimap.munimap_transport.queries import query_stations
    try:
        result = query_stations(
            db_uri=_get_db_uri(),
            layer=layer,
            bbox=bbox,
            with_hull=True,
            operator=current_app.config.get('TRANSPORT_OPERATOR'),
        )
        return Response(json.dumps(result), content_type='application/json')
    except Exception as e:
        log.error(f'Error querying stations: {e}')
        return jsonify({'error': 'Database query failed'}), 500


@transport_api.get('/api/v1/transport/station_points.geojson')
def station_points():
    if not _db_available():
        return jsonify({'error': 'Database not configured'}), 503

    layer = request.args.get('layer')
    bbox_str = request.args.get('bbox')
    if not layer or not bbox_str:
        return jsonify({'error': 'Missing layer or bbox parameter'}), 400

    bbox = [float(x) for x in bbox_str.split(',')]

    from munimap.munimap_transport.queries import query_stations
    try:
        result = query_stations(
            db_uri=_get_db_uri(),
            layer=layer,
            bbox=bbox,
            with_hull=False,
            operator=current_app.config.get('TRANSPORT_OPERATOR'),
        )
        return Response(json.dumps(result), content_type='application/json')
    except Exception as e:
        log.error(f'Error querying station points: {e}')
        return jsonify({'error': 'Database query failed'}), 500


@transport_api.get('/api/v1/transport/route/<osm_id>')
def route(osm_id):
    if not _db_available():
        return jsonify({'error': 'Database not configured'}), 503

    from munimap.munimap_transport.queries import query_route
    try:
        result = query_route(db_uri=_get_db_uri(), osm_id=osm_id)
        return jsonify(result)
    except Exception as e:
        log.error(f'Error querying route {osm_id}: {e}')
        return jsonify({'error': 'Database query failed'}), 500


@transport_api.get('/api/v1/transport/timetable_documents.json')
def timetable_documents():
    csv_path = current_app.config.get('TIMETABLE_DOCUMENTS_CSV')
    if not csv_path:
        return jsonify({})

    cache_dir = current_app.config.get('TIMETABLE_CACHE_DIR', '/tmp')
    cache_file = os.path.join(cache_dir, 'timetable_documents.json')

    if os.path.exists(cache_file):
        csv_mtime = os.path.getmtime(csv_path)
        cache_mtime = os.path.getmtime(cache_file)
        if cache_mtime > csv_mtime:
            with open(cache_file) as f:
                return jsonify(json.load(f))

    from munimap.munimap_transport.timetables import csv_to_timetable_json, create_night_timetable_json
    base_url = current_app.config.get('TIMETABLE_DOCUMENTS_BASE_URL', '')
    result = csv_to_timetable_json(csv_path, base_url)

    night_csv = current_app.config.get('TIMETABLE_NIGHTLINE_CSV')
    if night_csv:
        night_base_url = current_app.config.get('TIMETABLE_NIGHTLINE_DOCUMENTS_BASE_URL', '')
        result.update(create_night_timetable_json(night_csv, night_base_url))

    with open(cache_file, 'w') as f:
        json.dump(result, f)

    return jsonify(result)
