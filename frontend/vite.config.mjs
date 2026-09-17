import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    {
      name: 'dev-source-no-cache',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/src/')) {
            delete req.headers['if-none-match'];
            delete req.headers['if-modified-since'];
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
          next();
        });
      }
    },
    react()
  ],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: { agent: resolve(process.cwd(), 'index.html'), authoring: resolve(process.cwd(), 'authoring.html') },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('node_modules/katex')) return 'katex-vendor';
          return undefined;
        }
      }
    }
  },
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js']
  },
  server: {
    host: '127.0.0.1',
    port: 5187,
    headers: {
      'Cache-Control': 'no-store'
    }
  }
});
