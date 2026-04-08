import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(`${Date.now()}`),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }

          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
            return 'mui-vendor';
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      outDir: 'dist',
      filename: 'sw.js',
      scope: '/',
      base: '/',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Soulvest Commune',
        short_name: 'Soulvest',
        description: 'Soulvest Commune Resident App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    {
      name: 'github-pages-spa-fallback',
      apply: 'build',
      generateBundle(_options, bundle) {
        const indexAsset = bundle['index.html'];

        if (!indexAsset || indexAsset.type !== 'asset') {
          return;
        }

        bundle['404.html'] = {
          ...indexAsset,
          fileName: '404.html',
        };
      },
    },
  ],
});
