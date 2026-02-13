# Minimal Flask application for OLKD_Svelte
# Phase 1: Configuration API + WMS Proxy

import os
import yaml
import logging
import requests
from flask import Flask, jsonify, send_from_directory, request, Response
from flask_cors import CORS

from munimap.layers import load_layers_config, create_anol_layers
from munimap.app_layers_def import prepare_layers_def, prepare_catalog_names, prepare_catalog_group_def
from munimap.export import export_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('munimap')


def load_app_config(config_name=None, config_dir='configs/app_configs'):
    """Load application configuration from YAML file."""
    # Load default config
    default_path = os.path.join(config_dir, 'default.yaml')
    if os.path.exists(default_path):
        with open(default_path, 'r') as f:
            config = yaml.safe_load(f) or {}
    else:
        config = {}

    # Merge with specific config if provided
    if config_name and config_name != 'default':
        specific_path = os.path.join(config_dir, f'{config_name}.yaml')
        if os.path.exists(specific_path):
            with open(specific_path, 'r') as f:
                specific_config = yaml.safe_load(f) or {}
            config = deep_merge(config, specific_config)

    return config


def deep_merge(base, override):
    """Deep merge two dictionaries."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def create_app(config_path=None):
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Enable CORS for development
    CORS(app)

    # Register blueprints
    app.register_blueprint(export_bp)

    # Configuration
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app.config['LAYERS_CONF_DIR'] = os.path.join(base_dir, 'configs', 'layers_conf')
    app.config['APP_CONFIG_DIR'] = os.path.join(base_dir, 'configs', 'app_configs')
    app.config['STATIC_GEOJSON_DIR'] = os.path.join(base_dir, 'configs', 'static_geojson')
    app.config['PROXY_HASH_SALT'] = 'olkd-svelte-dev'

    # Load layers configuration on startup
    layers_conf_dir = app.config['LAYERS_CONF_DIR']
    if os.path.exists(layers_conf_dir):
        try:
            layers_config = load_layers_config(
                layers_conf_dir,
                proxy_hash_salt=app.config['PROXY_HASH_SALT']
            )
            app.layers_config = layers_config
            app.anol_layers = create_anol_layers(layers_config)
            log.info(f"Loaded {len(layers_config['layers'])} layers from {layers_conf_dir}")
        except Exception as e:
            log.error(f"Failed to load layers config: {e}")
            app.layers_config = {'backgrounds': [], 'groups': [], 'layers': {}, 'hash_map': {}}
            app.anol_layers = {'backgroundLayer': [], 'overlays': []}
    else:
        log.warning(f"Layers config directory not found: {layers_conf_dir}")
        app.layers_config = {'backgrounds': [], 'groups': [], 'layers': {}, 'hash_map': {}}
        app.anol_layers = {'backgroundLayer': [], 'overlays': []}

    # API Routes
    @app.route('/api/v1/app/<config>/config')
    @app.route('/api/v1/app/config')
    def get_config(config=None):
        """Return app configuration and layers for frontend."""
        try:
            app_config = load_app_config(
                config,
                app.config['APP_CONFIG_DIR']
            )
            layers_def = prepare_layers_def(
                app_config,
                app.anol_layers,
                app.layers_config.get('layers', {})
            )
            return jsonify({
                'app': app_config,
                'layers': layers_def
            })
        except Exception as e:
            log.error(f"Error loading config: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/static_geojson/<path:filename>')
    def serve_static_geojson(filename):
        """Serve static GeoJSON files."""
        return send_from_directory(
            app.config['STATIC_GEOJSON_DIR'],
            filename
        )

    @app.route('/proxy/wms/<hash>/service')
    def proxy_wms(hash):
        """Proxy WMS requests to hide actual service URLs."""
        hash_map = app.layers_config.get('hash_map', {})

        if hash not in hash_map:
            log.warning(f"Unknown proxy hash: {hash}")
            return jsonify({'error': 'Unknown service'}), 404

        target_url = hash_map[hash]

        # Forward all query parameters
        params = dict(request.args)

        try:
            # Make request to actual WMS server
            resp = requests.get(
                target_url,
                params=params,
                timeout=30,
                stream=True
            )

            # Build response with same content type
            excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
            headers = [(name, value) for name, value in resp.raw.headers.items()
                      if name.lower() not in excluded_headers]

            return Response(
                resp.content,
                status=resp.status_code,
                headers=headers
            )
        except requests.RequestException as e:
            log.error(f"Proxy error for {target_url}: {e}")
            return jsonify({'error': 'Proxy request failed'}), 502

    @app.route('/api/v1/app/<config>/catalog')
    @app.route('/api/v1/app/catalog')
    def get_catalog(config=None):
        """Return catalog-eligible groups for the catalog panel."""
        try:
            app_config = load_app_config(
                config,
                app.config['APP_CONFIG_DIR']
            )
            if not app_config.get('components', {}).get('catalog'):
                return jsonify({'groups': []})

            groups = prepare_catalog_names(
                app_config,
                app.anol_layers,
                app.layers_config.get('layers', {})
            )
            return jsonify({'groups': groups})
        except Exception as e:
            log.error(f"Error loading catalog: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/v1/app/<config>/catalog/group/<name>')
    @app.route('/api/v1/app/catalog/group/<name>')
    def get_catalog_group(config=None, name=None):
        """Return full group definition for a catalog item."""
        try:
            app_config = load_app_config(
                config,
                app.config['APP_CONFIG_DIR']
            )
            if not app_config.get('components', {}).get('catalog'):
                return jsonify({'error': 'Catalog not enabled'}), 404

            group_def = prepare_catalog_group_def(
                name,
                app_config,
                app.anol_layers,
                app.layers_config.get('layers', {})
            )
            if group_def is None:
                return jsonify({'error': f'Group "{name}" not found in catalog'}), 404

            return jsonify({'group': group_def})
        except Exception as e:
            log.error(f"Error loading catalog group: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/v1/app/<config>/catalog/names')
    @app.route('/api/v1/app/catalog/names')
    def get_catalog_names(config=None):
        """Resolve layer/group names to titles for featureinfo catalog display."""
        try:
            names_param = request.args.get('names', '')
            if not names_param:
                return jsonify({'groups': [], 'layers': []})

            names = [n.strip() for n in names_param.split(',') if n.strip()]
            if not names:
                return jsonify({'groups': [], 'layers': []})

            anol_layers = app.anol_layers
            result = {'groups': [], 'layers': []}

            # Build lookup of all groups and layers
            for group in anol_layers.get('overlays', []):
                if group['name'] in names:
                    result['groups'].append({
                        'name': group['name'],
                        'title': group['title']
                    })
                for layer in group.get('layers', []):
                    if layer['name'] in names:
                        result['layers'].append({
                            'name': layer['name'],
                            'title': layer['title']
                        })

            return jsonify(result)
        except Exception as e:
            log.error(f"Error resolving catalog names: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/health')
    def health():
        """Health check endpoint."""
        return jsonify({'healthy': True})

    @app.route('/')
    def index():
        """Redirect to API info."""
        return jsonify({
            'name': 'OLKD Svelte Backend',
            'version': '1.0.0',
            'endpoints': {
                'config': '/api/v1/app/<config>/config',
                'health': '/health'
            }
        })

    return app


# For running directly
if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=8080, debug=True)
