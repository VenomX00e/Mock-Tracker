import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        manifest: {
          name: 'Mock Tracker',
          short_name: 'MockApp',
          description: 'Track your mock exams intelligently',
          theme_color: '#4f46e5',
          icons: [
            {
              src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22192%22 height=%22192%22 fill=%22none%22 stroke=%22%234f46e5%22 stroke-width=%2216%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 viewBox=%220 0 256 256%22%3E%3Cpath d=%22M128 32C74.98 32 32 74.98 32 128s42.98 96 96 96 96-42.98 96-96S181.02 32 128 32zm0 176c-44.11 0-80-35.89-80-80s35.89-80 80-80 80 35.89 80 80-35.89 80-80 80zM88 128l24 24 56-56%22%3E%3C/path%3E%3C/svg%3E',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22512%22 height=%22512%22 fill=%22none%22 stroke=%22%234f46e5%22 stroke-width=%2232%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 viewBox=%220 0 512 512%22%3E%3Cpath d=%22M256 64c-105.88 0-192 86.12-192 192s86.12 192 192 192 192-86.12 192-192S361.88 64 256 64zm0 352c-88.22 0-160-71.78-160-160s71.78-160 160-160 160 71.78 160 160-71.78 160-160 160zm-80-160l48 48 112-112%22%3E%3C/path%3E%3C/svg%3E',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      allowedHosts: true,
    },
  };
});
