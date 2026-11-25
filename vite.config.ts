import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  const devPwaStubPlugin = {
    name: 'dev-pwa-virtual-stub',
    resolveId(id: string) {
      if (id === 'virtual:pwa-register') {
        return '\0virtual:pwa-register';
      }
      return null;
    },
    load(id: string) {
      if (id === '\0virtual:pwa-register') {
        return 'export function registerSW() { return async () => {}; }\n';
      }
      return null;
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      isBuild
        ? VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'pwa-192x192.png',
              'pwa-512x512.png',
              'pwa-maskable-512x512.png',
              'assets/aistudio/1795053392389_370a02c2.jpg',
            ],
            manifest: {
              id: '/',
              name: 'رياض شات | غرف الصوت والألعاب والوكالات',
              short_name: 'رياض شات',
              description: 'منصة رياض شات للغرف الصوتية المباشرة، صالة الألعاب التفاعلية، والوكالات المعتمدة.',
              lang: 'ar',
              dir: 'rtl',
              theme_color: '#1A0B3B',
              background_color: '#09071A',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '/',
              scope: '/',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              cleanupOutdatedCaches: true,
              skipWaiting: true,
              clientsClaim: true,
              globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
              navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'gstatic-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
              ],
            },
            devOptions: {
              enabled: false,
              type: 'module',
            },
          })
        : devPwaStubPlugin,
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
