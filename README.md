# OLKD Svelte

A SvelteKit-based map application with OpenLayers, migrated from the AngularJS-based bielefeldGEOCLIENT.

## Requirements

### Debian/Ubuntu

```sh
# Docker
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Without Docker (native development)
sudo apt install nodejs npm python3 python3-venv
```

### Arch Linux / Manjaro

```sh
# Docker
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Without Docker (native development)
sudo pacman -S nodejs npm python python-virtualenv
```

## Project Structure

```
OLKD_Svelte/
├── src/                          # SvelteKit frontend
│   ├── lib/
│   │   ├── components/           # Svelte components (Map, Layerswitcher)
│   │   ├── layers/               # Layer classes (TiledWMS, WMTS, etc.)
│   │   ├── services/             # API client
│   │   └── stores/               # Svelte stores (config, map, layers)
│   └── routes/                   # SvelteKit routes
├── backend/                      # Standalone Flask API
│   ├── munimap/                  # Flask application
│   ├── configs/                  # YAML configuration files
│   │   ├── app_configs/          # Application configurations
│   │   ├── layers_conf/          # Layer definitions
│   │   └── static_geojson/       # Static GeoJSON files
│   └── Dockerfile
├── Dockerfile                    # Frontend Dockerfile (multi-stage)
├── docker-compose.yml            # Development setup
├── docker-compose.prod.yml       # Production setup
├── nginx.conf                    # Production nginx config
├── start-dev.sh                  # Native development startup script
└── package.json
```

## Quick Start (Docker)

### Development

```sh
docker compose up
```

This starts:
- Flask API on http://localhost:8080
- SvelteKit dev server on http://localhost:5173

Open http://localhost:5173/app/default/ to view the application.

Source code is mounted as volumes, so changes will hot-reload automatically.

### Production

```sh
docker compose -f docker-compose.prod.yml up -d
```

This builds optimized images and serves the app on http://localhost:80 with nginx.

### Useful Docker Commands

```sh
# Rebuild after Dockerfile changes
docker compose build --no-cache

# View logs
docker compose logs -f

# Stop containers
docker compose down

# Remove all containers and volumes
docker compose down -v
```

## Quick Start (Native)

### Development (both frontend and backend)

```sh
./start-dev.sh
```

### Frontend Only (with external backend)

```sh
npm install
npm run dev
```

### Backend Only

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
FLASK_APP=munimap.app:create_app flask run --host=0.0.0.0 --port=8080
```

## API Endpoints

- `GET /api/v1/app/<config>/config` - Application and layer configuration
- `GET /api/v1/app/config` - Default configuration
- `GET /proxy/wms/<hash>/service` - WMS proxy for map tiles
- `GET /static_geojson/<filename>` - Static GeoJSON files
- `GET /health` - Health check

## Building for Production

### With Docker

```sh
docker compose -f docker-compose.prod.yml build
```

### Without Docker

```sh
npm run build
```

The build output will be in the `build/` directory.

## Configuration

### Application Configuration

Edit `backend/configs/app_configs/default.yaml` to customize:
- Map center, zoom, projection
- Enabled components (layerswitcher, print, etc.)
- Background and overlay layer selection
- Default visible layers

### Layer Configuration

Add/modify YAML files in `backend/configs/layers_conf/` to define:
- WMS/WMTS/GeoJSON layers
- Layer groups
- Layer metadata and styling

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript, OpenLayers 10
- **Backend**: Flask, Python 3.12
- **Production**: nginx, gunicorn
- **Containerization**: Docker, Docker Compose
