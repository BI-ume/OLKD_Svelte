# Minimal layer processing for Phase 1
# Simplified from bielefeldGEOCLIENT/munimap/layers.py

import os
import yaml
import hashlib
import logging
from copy import deepcopy
from collections import OrderedDict

log = logging.getLogger('munimap.layers')


class UnsupportedLayerError(Exception):
    pass


class InvalidConfigurationError(Exception):
    pass


class Layer(dict):
    pass


class Source(dict):
    pass


class Group(dict):
    pass


def merge_dict(target, base):
    """Recursively merge base into target."""
    result = deepcopy(base)
    for key, value in target.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dict(value, result[key])
        else:
            result[key] = deepcopy(value)
    return result


def anol_background_layer(layer_conf):
    """Create background layer configuration for frontend."""
    source = None

    if layer_conf['type'] == 'wmts':
        layer = layer_conf['name']
        if layer_conf.get('source', {}).get('directAccess'):
            layer = layer_conf['source'].get('layer')

        source = {
            'layer': layer,
            'projection': layer_conf['source']['srs'],
            'format': layer_conf['source']['format'],
            'extent': layer_conf['source']['extent'],
            'levels': layer_conf['source']['levels'],
            'matrixSet': layer_conf['source']['matrixSet']
        }
    elif layer_conf['type'] in ('wms', 'tiledwms'):
        # Always use source.layers for WMS LAYERS parameter if available
        if layer_conf.get('source', {}).get('layers'):
            layers = ','.join(layer_conf['source']['layers'])
        else:
            layers = layer_conf['name']

        source = {
            'format': layer_conf['source']['format'],
            'params': {
                'LAYERS': layers,
                'SRS': layer_conf['source']['srs']
            }
        }
    else:
        raise UnsupportedLayerError(
            f'background layer type "{layer_conf["type"]}" is not supported')

    # Optional source properties
    for prop in ['tilePixelRatio', 'tileSize', 'hqUrl', 'hqLayer', 'hqMatrixSet']:
        if prop in layer_conf.get('source', {}):
            source[prop] = layer_conf['source'][prop]

    background_layer = {
        'name': layer_conf['name'],
        'title': layer_conf['title'],
        'isBackground': True,
        'type': layer_conf['type'],
        'catalog': layer_conf.get('catalog', False),
        'status': layer_conf.get('status', 'active'),
        'olLayer': {
            'source': source
        }
    }

    # Optional layer properties
    for prop in ['metadataUrl', 'searchConfig', 'legend', 'opacity', 'attribution', 'previewImage']:
        if prop in layer_conf:
            background_layer[prop] = layer_conf[prop]

    return background_layer


def anol_overlay_layer(layer_conf):
    """Create overlay layer configuration for frontend."""
    source = {}

    if layer_conf['type'] == 'postgis':
        source['additionalParameters'] = {'layers': [layer_conf['name']]}
    elif layer_conf['type'] == 'digitize':
        source['layer'] = layer_conf['source']['name']
        source['dataProjection'] = layer_conf['source']['srs']
    elif layer_conf['type'] == 'static_geojson':
        source['dataProjection'] = layer_conf['source']['srs']
        source['file'] = layer_conf['source']['file']
    elif layer_conf['type'] in ('wms', 'tiledwms'):
        # Always use source.layers for WMS LAYERS parameter if available
        if layer_conf.get('source', {}).get('layers'):
            layers = ','.join(layer_conf['source']['layers'])
        else:
            layers = layer_conf['name']

        source = {
            'format': layer_conf['source']['format'],
            'params': {
                'LAYERS': layers,
                'SRS': layer_conf['source']['srs']
            }
        }
        if layer_conf['type'] == 'wms':
            source['projection'] = layer_conf['source']['srs']
        if layer_conf['source'].get('styles'):
            source['params']['STYLES'] = ','.join(layer_conf['source']['styles'])
        if layer_conf['source'].get('transparent') is not None:
            source['params']['TRANSPARENT'] = 'TRUE' if layer_conf['source']['transparent'] else 'FALSE'
    elif layer_conf['type'] == 'wmts':
        layer_name = layer_conf['name']
        if layer_conf.get('source', {}).get('directAccess'):
            layer_name = layer_conf['source'].get('layer')

        source['layer'] = layer_name
        source['projection'] = layer_conf['source']['srs']
        source['format'] = layer_conf['source']['format']
        source['extent'] = layer_conf['source']['extent']
        source['levels'] = layer_conf['source']['levels']
        source['matrixSet'] = layer_conf['source']['matrixSet']
    elif layer_conf['type'] == 'sensorthings':
        source = {
            'url': layer_conf['source']['url'],
            'urlParameters': {
                'filter': layer_conf['source']['urlParameters']['filter'],
                'expand': layer_conf['source']['urlParameters']['expand']
            },
            'refreshInterval': layer_conf['source']['refreshInterval']
        }
        if layer_conf.get('source', {}).get('directAccess'):
            source['layer'] = layer_conf['source'].get('layer')
    else:
        raise UnsupportedLayerError(
            f'overlay layer type "{layer_conf["type"]}" is not supported')

    ol_layer = {
        'source': source,
        'visible': False
    }

    anol_layer = {
        'name': layer_conf['name'],
        'title': layer_conf['title'],
        'type': layer_conf['type'],
        'catalog': layer_conf.get('catalog', False),
        'searchConfig': layer_conf.get('searchConfig', []),
        'status': layer_conf.get('status', 'active'),
        'olLayer': ol_layer
    }

    # Optional properties
    if 'opacity' in layer_conf:
        ol_layer['opacity'] = layer_conf['opacity']
        anol_layer['opacity'] = layer_conf['opacity']

    if layer_conf['type'] in ('postgis', 'static_geojson', 'digitize'):
        anol_layer['cluster'] = layer_conf.get('cluster', False)

    style = layer_conf.get('style')
    if style:
        if 'externalGraphicPrefix' in style:
            anol_layer['externalGraphicPrefix'] = style.pop('externalGraphicPrefix')
        anol_layer['style'] = style

    for prop in ['attribution', 'metadataUrl', 'showGroup', 'abstract', 'featureinfo', 'legend']:
        if prop in layer_conf:
            anol_layer[prop] = layer_conf[prop]

    if layer_conf['type'] == 'postgis':
        anol_layer['type'] = 'dynamic_geojson'
        anol_layer['createIndex'] = layer_conf.get('create_index', True)

    return anol_layer


def create_anol_layers(conf):
    """Create anol layer configuration from loaded config."""
    anol_conf = {
        'backgroundLayer': [],
        'overlays': []
    }

    for layer in conf['backgrounds']:
        try:
            anol_conf['backgroundLayer'].append(anol_background_layer(layer))
        except UnsupportedLayerError as ex:
            log.warning(str(ex))
            continue

    for group in conf['groups']:
        anol_group = {
            'name': group['name'],
            'title': group['title'],
            'metadataUrl': group.get('metadataUrl', ''),
            'searchConfig': group.get('searchConfig', []),
            'showGroup': group.get('showGroup', True),
            'abstract': group.get('abstract', ''),
            'legend': group.get('legend', False),
            'singleSelect': group.get('singleSelect', False),
            'singleSelectGroup': group.get('singleSelectGroup', False),
            'catalog': group.get('catalog', False),
            'status': group.get('status', 'active'),
            'layers': [],
            'defaultVisibleLayers': group.get('defaultVisibleLayers', []),
        }
        for layer in group['layers']:
            try:
                anol_group['layers'].append(anol_overlay_layer(layer))
            except UnsupportedLayerError as ex:
                log.warning(str(ex))
                continue
        anol_conf['overlays'].append(anol_group)

    return anol_conf


def apply_base_config(current_config, layer_configs):
    """Apply base configuration inheritance."""
    current_config = deepcopy(current_config)
    if 'base' in current_config:
        base_config_name = current_config.pop('base')
        base_config = None

        for layer_config in layer_configs:
            if layer_config['name'] == base_config_name:
                base_config = deepcopy(apply_base_config(layer_config, layer_configs))

        if base_config is None:
            raise InvalidConfigurationError(f'Base config "{base_config_name}" not found')
        current_config = merge_dict(current_config, base_config)
    return current_config


def load_layers_config(config_folder, proxy_hash_salt=None):
    """Load and parse all YAML layer configuration files."""
    yaml_content = {
        'layers': [],
        'groups': []
    }

    for filename in os.listdir(config_folder):
        if filename.endswith(".yaml"):
            filepath = os.path.join(config_folder, filename)
            with open(filepath, 'r') as f:
                try:
                    content = yaml.safe_load(f)
                except Exception as e:
                    log.warning(f'Error loading {filename}: {e}')
                    content = {}

            if not isinstance(content, dict):
                content = {}

            if content.get('layers'):
                yaml_content['layers'].extend(content['layers'])

            if content.get('groups'):
                yaml_content['groups'].extend(content['groups'])

    # Apply base configurations
    yaml_layers = []
    for layer_config in yaml_content['layers']:
        yaml_layers.append(apply_base_config(layer_config, yaml_content['layers']))
    yaml_content['layers'] = yaml_layers

    # Build layers dictionary
    layers = OrderedDict()
    backgrounds = []
    hash_map = {}

    for layer_config in yaml_content['layers']:
        layer = Layer(layer_config)
        layer['source'] = Source(layer.get('source', {}))

        # Create URL hash for proxy
        if layer['type'] in ['wms', 'wmts', 'tiledwms', 'sensorthings']:
            direct_access = layer['source'].get('directAccess', False)
            if not direct_access and 'url' in layer['source']:
                encoded = (layer['source']['url'] + (proxy_hash_salt or '')).encode('UTF-8')
                layer['hash'] = hashlib.sha224(encoded).hexdigest()
                hash_map[layer['hash']] = layer['source']['url']
            elif 'url' in layer['source']:
                layer['url'] = layer['source']['url']

        layers[layer['name']] = layer
        if layer.get('background'):
            backgrounds.append(layer)

    # Build groups
    groups = []
    for group_config in yaml_content['groups']:
        group = Group(group_config)
        group['layers'] = []
        for layer_name in group_config.get('layers', []):
            if layer_name not in layers:
                log.warning(f'group layer {layer_name} not found')
                continue
            group['layers'].append(layers[layer_name])
        if group['layers']:
            groups.append(group)
        else:
            log.warning(f'group {group["name"]} empty')

    return {
        'backgrounds': backgrounds,
        'groups': groups,
        'layers': layers,
        'hash_map': hash_map
    }
