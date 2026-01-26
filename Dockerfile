# SvelteKit Frontend Dockerfile
# Multi-stage build for development and production

# ============================================
# Base stage with Node.js
# ============================================
FROM node:22-alpine AS base
WORKDIR /app

# ============================================
# Development stage
# ============================================
FROM base AS development
# Copy package files and config files needed for npm install
COPY package*.json ./
COPY svelte.config.js tsconfig.json vite.config.ts ./
RUN npm install
# Copy remaining source
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# Build stage for production
# ============================================
FROM base AS builder
# Copy package files and config files needed for npm install
COPY package*.json ./
COPY svelte.config.js tsconfig.json vite.config.ts ./
RUN npm ci
# Copy remaining source and build
COPY . .
RUN npm run build

# ============================================
# Production stage with nginx
# ============================================
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
