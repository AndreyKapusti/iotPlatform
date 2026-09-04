import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const controlTarget = process.env.VITE_CONTROL_URL || 'http://localhost:8000';
const ingestTarget = process.env.VITE_INGEST_URL || 'http://localhost:8001';
const wsIngestTarget = process.env.VITE_WS_URL || 'ws://localhost:8001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1/auth': { target: controlTarget, changeOrigin: true },
      '/api/v1/devices': { target: controlTarget, changeOrigin: true },
      '/api/v1/dashboards': { target: controlTarget, changeOrigin: true },
      '/api/v1/ingest': { target: ingestTarget, changeOrigin: true },
      '/api/v1/telemetry': { target: ingestTarget, changeOrigin: true },
      '/api/v1/ws': { target: wsIngestTarget, ws: true, changeOrigin: true },
    },
  },
});
