import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/Soulvest-Commune/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      outDir: 'dist',
      filename: 'sw.js',
      scope: '/Soulvest-Commune/',
      base: '/Soulvest-Commune/',
      manifest: {
        name: 'Soulvest Commune',
        short_name: 'Soulvest',
        description: 'Soulvest Commune Resident App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/Soulvest-Commune/',
        scope: '/Soulvest-Commune/',
        icons: [
          {
            src: '/Soulvest-Commune/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/Soulvest-Commune/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/Soulvest-Commune/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
