# Minimal layer definition preparation for Phase 1
# Simplified from bielefeldGEOCLIENT/munimap/app_layers_def.py

from copy import deepcopy


def is_active(name, active, includes=[], excludes=[], explicits=[]):
    """Check if a layer should be active based on include/exclude rules."""
    include = name in includes
    exclude = name in excludes
    explicit = name in explicits

    if len(explicits) > 0:
        return explicit
    if active and not exclude:
        return True
    if not active and include:
        return True
    return False


def prepare_background_layers(app_config, anol_layers, layers_config):
    """Prepare background layers for frontend."""
    background_layers = []

    includes = app_config.get('backgrounds', {}).get('include', [])
    excludes = app_config.get('backgrounds', {}).get('exclude', [])
    explicits = app_config.get('backgrounds', {}).get('explicit', [])

    layers = anol_layers.get('backgroundLayer', [])

    for layer in layers:
        layer_name = layer['name']
        layer_active = layer.get('status', 'active') == 'active'

        if not is_active(layer_name, layer_active, includes, excludes, explicits):
            continue

        bg_layer = deepcopy(layer)

        # Set URL from hash map if available
        layer_conf = layers_config.get(layer_name, {})
        if layer_conf.get('hash'):
            # Use proxy URL (will be set by frontend)
            bg_layer['olLayer']['source']['url'] = f"/proxy/wms/{layer_conf['hash']}/service"
        elif layer_conf.get('url'):
            bg_layer['olLayer']['source']['url'] = layer_conf['url']
        elif 'url' in layer_conf.get('source', {}):
            bg_layer['olLayer']['source']['url'] = layer_conf['source']['url']

        # Set visibility
        default_bg = app_config.get('map', {}).get('defaultBackground')
        bg_layer['olLayer']['visible'] = (layer_name == default_bg)

        background_layers.append(bg_layer)

    # Sort by explicits order if specified
    if explicits:
        sorted_layers = []
        for name in explicits:
            for layer in background_layers:
                if layer['name'] == name:
                    sorted_layers.append(layer)
                    break
        background_layers = sorted_layers

    return background_layers


def prepare_group_layers(app_config, group_layers, group_active, layers_config):
    """Prepare overlay layers within a group."""
    result_layers = []

    includes = app_config.get('layers', {}).get('include', [])
    excludes = app_config.get('layers', {}).get('exclude', [])
    explicits = app_config.get('layers', {}).get('explicit', [])

    default_overlays = app_config.get('map', {}).get('defaultOverlays', [])

    for _layer in group_layers:
        layer_name = _layer['name']
        layer_active = group_active and _layer.get('status', 'active') == 'active'

        if not is_active(layer_name, layer_active, includes, excludes, explicits):
            continue

        layer = deepcopy(_layer)
        layer['searchConfig'] = layer.get('searchConfig', [])
        layer['visible'] = layer_name in default_overlays

        # Set URL from config
        layer_conf = layers_config.get(layer_name, {})
        if layer_conf.get('hash'):
            layer['olLayer']['source']['url'] = f"/proxy/wms/{layer_conf['hash']}/service"
        elif layer_conf.get('url'):
            layer['olLayer']['source']['url'] = layer_conf['url']
        elif 'url' in layer_conf.get('source', {}):
            layer['olLayer']['source']['url'] = layer_conf['source']['url']

        # Handle special layer types
        if layer['type'] == 'static_geojson':
            file_name = layer['olLayer']['source'].get('file', '')
            layer['olLayer']['source']['url'] = f"/static_geojson/{file_name}"
            if 'file' in layer['olLayer']['source']:
                del layer['olLayer']['source']['file']

        result_layers.append(layer)

    return result_layers


def prepare_overlays(app_config, anol_layers, layers_config):
    """Prepare overlay groups for frontend."""
    overlays = []

    includes = app_config.get('groups', {}).get('include', [])
    excludes = app_config.get('groups', {}).get('exclude', [])
    explicits = app_config.get('groups', {}).get('explicit', [])
    single_select = app_config.get('groups', {}).get('singleSelect', [])

    for group in anol_layers.get('overlays', []):
        if len(group.get('layers', [])) == 0:
            continue

        group_active = is_active(
            group['name'],
            group.get('status', 'active') == 'active',
            includes, excludes, explicits
        )

        group_layers = prepare_group_layers(
            app_config, group['layers'], group_active, layers_config
        )

        single_select_group = group['name'] in single_select

        if len(group_layers) > 0:
            overlays.append({
                'layers': group_layers,
                'name': group['name'],
                'title': group['title'],
                'status': group.get('status', 'active'),
                'metadataUrl': group.get('metadataUrl', ''),
                'showGroup': group.get('showGroup', True),
                'abstract': group.get('abstract', ''),
                'singleSelect': group.get('singleSelect', False),
                'singleSelectGroup': single_select_group,
                'legend': group.get('legend', False),
                'defaultVisibleLayers': group.get('defaultVisibleLayers', []),
            })

    # Sort by explicits order if specified
    if explicits:
        sorted_overlays = []
        for name in explicits:
            for overlay in overlays:
                if overlay['name'] == name:
                    sorted_overlays.append(overlay)
                    break
        overlays = sorted_overlays

    return overlays


def prepare_layers_def(app_config, anol_layers, layers_config):
    """Prepare full layer definition for frontend."""
    return {
        'backgroundLayer': prepare_background_layers(app_config, anol_layers, layers_config),
        'overlays': prepare_overlays(app_config, anol_layers, layers_config)
    }
