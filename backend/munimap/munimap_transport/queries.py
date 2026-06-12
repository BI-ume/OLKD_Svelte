import re
import json

import sqlalchemy as sa
from natsort import natsorted


QUERY_STATIONS_WITH_HULL = """
    SELECT *,
        ST_Asgeojson(geometry, 0) as geometry
    FROM osm_stations
    WHERE
        geometry && ST_Transform(ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326), 3857)
        AND EXISTS
        (SELECT 1 FROM (SELECT unnest(refs) AS ref) AS x
            WHERE x.ref ~:ref_expression);
"""

QUERY_STATIONS = """
    SELECT *,
        ST_Asgeojson(ST_Envelope(geometry), 0) as geometry
    FROM osm_stations
    WHERE
        geometry && ST_Transform(ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326), 3857)
        AND EXISTS
        (SELECT 1 FROM (SELECT unnest(refs) AS ref) AS x
            WHERE x.ref ~:ref_expression);
"""

QUERY_SEGMENTS = """
    SELECT
        refs, type,
        ST_AsGeoJSON(ST_Union(geometry)) AS geometry
    FROM (
        SELECT
            m.member, m.geometry, type, m.osm_id,
            array_agg(m.ref) OVER w AS refs
        FROM (
            SELECT m.member, m.ref, m.geometry, r.tags->'route' AS type, r.osm_id
            FROM osm.osm_route_members m
                LEFT OUTER JOIN osm.osm_routes r ON m.osm_id = r.osm_id
            WHERE r.osm_id = :osm_id
               AND m.role IN ('', 'forwards', 'backwards')
            GROUP BY r.osm_id, m.member, m.ref, m.geometry, r.tags->'route'
        ) AS m
        WINDOW w AS (PARTITION BY m.member)
    ) AS segments
    GROUP BY refs, type
"""


def query_stations(db_uri, layer=None, operator=None, bbox=None, with_hull=False):
    if bbox is None:
        bbox = [-180, -90, 180, 90]

    engine = sa.create_engine(db_uri)

    ref_expression = '^[^N]'
    if layer and 'night' in layer:
        ref_expression = '^[N]'

    sql_query = QUERY_STATIONS_WITH_HULL if with_hull else QUERY_STATIONS

    features = []
    with engine.connect() as conn:
        result = conn.execute(sa.text(sql_query), {
            'ref_expression': ref_expression,
            'minx': bbox[0],
            'miny': bbox[1],
            'maxx': bbox[2],
            'maxy': bbox[3],
        })
        for row in result.mappings():
            features.append(stations_to_feature(row, operator=operator, ref_expression=ref_expression))

    return {
        'type': 'FeatureCollection',
        'features': features
    }


def stations_to_feature(row, operator=None, ref_expression=None):
    feature = {
        'type': 'Feature',
        'properties': {'routes': []},
        'geometry': {}
    }

    feature['geometry'] = json.loads(row['geometry'])
    feature['properties']['name'] = row['name']
    feature['properties']['city'] = row['city']

    zipped_properties = list(zip(
        row['refs'], row['ids'], row['names'],
        row['froms'], row['vias'], row['tos'],
        row['types'], row['operator'],
    ))
    properties = list(map(
        dict,
        [list(zip(('ref', 'id', 'name', 'from', 'via', 'to', 'type', 'operator'), p))
         for p in zipped_properties]
    ))

    routes = {}
    osm_ids = set()
    for subr in properties:
        ref = subr['ref']

        if ref_expression and not re.match(ref_expression, ref):
            continue

        if ref not in routes:
            routes[ref] = {
                'ref': ref,
                'type': subr['type'],
                'operator': subr['operator'],
                'subroutes': []
            }

        if subr['via']:
            description = f"Von {subr['from']} über {subr['via']} nach {subr['to']}"
        else:
            description = f"Von {subr['from']} nach {subr['to']}"

        if not subr['from'] or not subr['to']:
            description = subr['name']

        if subr['id'] not in osm_ids:
            subroute = {'id': subr['id'], 'description': description}
            routes[ref]['subroutes'].append(subroute)
            osm_ids.add(subr['id'])
            routes[ref]['subroutes'] = natsorted(
                routes[ref]['subroutes'], key=lambda k: k['description']
            )

    feature['properties']['routes'] = natsorted(list(routes.values()), key=lambda k: k['ref'])
    return feature


def query_route(db_uri, osm_id):
    engine = sa.create_engine(db_uri)

    features = []
    with engine.connect() as conn:
        result = conn.execute(sa.text(QUERY_SEGMENTS), {'osm_id': osm_id})
        for row in result.mappings():
            feature = {
                'type': 'Feature',
                'properties': {},
                'geometry': {}
            }
            for k, v in row.items():
                if k == 'geometry':
                    feature['geometry'] = json.loads(v)
                else:
                    feature['properties'][k] = v
            features.append(feature)

    return {'type': 'FeatureCollection', 'features': features}
