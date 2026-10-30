import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? './' : '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'apk-mime-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.endsWith('.apk') || req.url.includes('MineSafe_IoT_Mobile'))) {
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', 'attachment; filename="MineSafe_IoT_Mobile_v2.4.apk"');
              res.setHeader('Cache-Control', 'public, max-age=86400');
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Proxy seguro para MineSafe AI Analysis API (FastAPI)
      // Permite a la web consultar /api/ai/* sin exponer la clave privada en el cliente
      proxy: {
        '/api/ai': {
          target: process.env.MINESAFE_AI_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/ai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey = process.env.MINESAFE_AI_API_KEY;
              if (apiKey && !proxyReq.getHeader('authorization')) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

  };
});
