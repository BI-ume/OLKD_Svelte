import os
import re
import time
import base64
import tempfile
import shutil
import yaml
import logging

from flask import Blueprint, Response, current_app, jsonify, render_template, request

from munimap.layers import load_layers_config, create_anol_layers

log = logging.getLogger('munimap.admin')

admin_bp = Blueprint(
    'admin', __name__,
    url_prefix='/admin',
    template_folder='templates',
    static_folder='static',
    static_url_path='/admin/static',
)

_RELOAD_FLAG = '.admin_reload'


# ── Auth ──────────────────────────────────────────────────────────────────────

def _check_auth():
    """Return True when request carries a valid admin token, or no token is configured."""
    token = current_app.config.get('ADMIN_TOKEN', '')
    if not token:
        return True  # dev fallback: open access when no token configured

    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:].strip() == token
    if auth.startswith('Basic '):
        try:
            _, password = base64.b64decode(auth[6:]).decode().split(':', 1)
            return password == token
        except Exception:
            pass
    return False


def _unauthorized():
    return jsonify({'error': 'Nicht autorisiert'}), 401


# ── Filename validation ───────────────────────────────────────────────────────

def _safe_name(name):
    """Validate and normalise a YAML config filename. Returns None if unsafe."""
    name = name.strip()
    basename = name[:-5] if name.endswith('.yaml') else name
    if not re.match(r'^[a-zA-Z0-9_\-]+$', basename):
        return None
    return basename + '.yaml'


def _list_yamls(directory):
    try:
        return sorted(f for f in os.listdir(directory) if f.endswith('.yaml'))
    except OSError:
        return []


def _touch_reload_flag(directory):
    try:
        with open(os.path.join(directory, _RELOAD_FLAG), 'w') as f:
            f.write(str(time.time()))
    except OSError as e:
        log.warning(f'Could not write reload flag: {e}')


# ── Admin page ────────────────────────────────────────────────────────────────

@admin_bp.get('/')
@admin_bp.get('')
def index():
    return render_template('admin_index.html')


@admin_bp.get('/projects')
def projects():
    app_config_dir = current_app.config.get('APP_CONFIG_DIR', '')
    names = [f[:-5] for f in _list_yamls(app_config_dir)] if app_config_dir else []
    return render_template('admin_projects.html', projects=names)


# ── Auth ──────────────────────────────────────────────────────────────────────

@admin_bp.post('/api/verify')
def verify_token():
    """Validate the admin token without returning any data."""
    if not _check_auth():
        return _unauthorized()
    return jsonify({'ok': True})


# ── App-configs CRUD ──────────────────────────────────────────────────────────

@admin_bp.get('/api/configs/app')
def list_app_configs():
    if not _check_auth():
        return _unauthorized()
    return jsonify({'files': _list_yamls(current_app.config['APP_CONFIG_DIR'])})


@admin_bp.get('/api/configs/app/<name>')
def get_app_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['APP_CONFIG_DIR'], name)
    if not os.path.exists(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    return jsonify({'name': name, 'content': open(path, encoding='utf-8').read()})


@admin_bp.put('/api/configs/app/<name>')
def save_app_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    content = request.get_data(as_text=True)
    try:
        yaml.safe_load(content)
    except yaml.YAMLError as e:
        return jsonify({'error': f'Ungültiges YAML: {e}'}), 400
    path = os.path.join(current_app.config['APP_CONFIG_DIR'], name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return jsonify({'message': f'{name} gespeichert'})


@admin_bp.post('/api/configs/app/<name>')
def create_app_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['APP_CONFIG_DIR'], name)
    if os.path.exists(path):
        return jsonify({'error': f'{name} existiert bereits'}), 409
    content = request.get_data(as_text=True) or ''
    if content:
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            return jsonify({'error': f'Ungültiges YAML: {e}'}), 400
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return jsonify({'message': f'{name} erstellt'}), 201


@admin_bp.delete('/api/configs/app/<name>')
def delete_app_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['APP_CONFIG_DIR'], name)
    if not os.path.exists(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    os.remove(path)
    return jsonify({'message': f'{name} gelöscht'})


# ── Layers-configs CRUD ───────────────────────────────────────────────────────

@admin_bp.get('/api/configs/layers')
def list_layers_configs():
    if not _check_auth():
        return _unauthorized()
    return jsonify({'files': _list_yamls(current_app.config['LAYERS_CONF_DIR'])})


@admin_bp.get('/api/configs/layers/<name>')
def get_layers_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['LAYERS_CONF_DIR'], name)
    if not os.path.exists(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    return jsonify({'name': name, 'content': open(path, encoding='utf-8').read()})


@admin_bp.put('/api/configs/layers/<name>')
def save_layers_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    content = request.get_data(as_text=True)
    try:
        yaml.safe_load(content)
    except yaml.YAMLError as e:
        return jsonify({'error': f'Ungültiges YAML: {e}'}), 400

    layers_dir = current_app.config['LAYERS_CONF_DIR']

    # Semantic dry-run: validate that all layer/group references still resolve
    with tempfile.TemporaryDirectory() as tmpdir:
        for f in os.listdir(layers_dir):
            if f.endswith('.yaml'):
                shutil.copy2(os.path.join(layers_dir, f), os.path.join(tmpdir, f))
        with open(os.path.join(tmpdir, name), 'w', encoding='utf-8') as f:
            f.write(content)
        try:
            load_layers_config(tmpdir)
        except Exception as e:
            return jsonify({'error': f'Konfigurationsfehler: {e}'}), 400

    with open(os.path.join(layers_dir, name), 'w', encoding='utf-8') as f:
        f.write(content)
    _touch_reload_flag(layers_dir)
    return jsonify({'message': f'{name} gespeichert'})


@admin_bp.post('/api/configs/layers/<name>')
def create_layers_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['LAYERS_CONF_DIR'], name)
    if os.path.exists(path):
        return jsonify({'error': f'{name} existiert bereits'}), 409
    content = request.get_data(as_text=True) or ''
    if content:
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            return jsonify({'error': f'Ungültiges YAML: {e}'}), 400
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    _touch_reload_flag(current_app.config['LAYERS_CONF_DIR'])
    return jsonify({'message': f'{name} erstellt'}), 201


@admin_bp.delete('/api/configs/layers/<name>')
def delete_layers_config(name):
    if not _check_auth():
        return _unauthorized()
    name = _safe_name(name)
    if name is None:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    path = os.path.join(current_app.config['LAYERS_CONF_DIR'], name)
    if not os.path.exists(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    os.remove(path)
    _touch_reload_flag(current_app.config['LAYERS_CONF_DIR'])
    return jsonify({'message': f'{name} gelöscht'})


# ── Reload ────────────────────────────────────────────────────────────────────

@admin_bp.post('/api/reload')
def reload_layers():
    if not _check_auth():
        return _unauthorized()
    app = current_app._get_current_object()
    try:
        cfg = load_layers_config(
            app.config['LAYERS_CONF_DIR'],
            proxy_hash_salt=app.config.get('PROXY_HASH_SALT', '')
        )
        app.layers_config = cfg
        app.anol_layers = create_anol_layers(cfg)
        app.layers_last_loaded = time.time()
        return jsonify({'message': f"Layer-Konfiguration neu geladen ({len(cfg['layers'])} Layer)"})
    except Exception as e:
        log.error(f'Admin reload failed: {e}')
        return jsonify({'error': str(e)}), 500
