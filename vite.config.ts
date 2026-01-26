import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Use environment variable for backend URL (Docker uses service name, native uses localhost)
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		target: 'es2020'
	},
	optimizeDeps: {
		include: ['ol', 'proj4']
	},
	server: {
		proxy: {
			'/api': {
				target: backendUrl,
				changeOrigin: true
			},
			'/proxy': {
				target: backendUrl,
				changeOrigin: true
			},
			'/static_geojson': {
				target: backendUrl,
				changeOrigin: true
			}
		}
	}
});
