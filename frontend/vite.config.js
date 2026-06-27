import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const apiTarget = env.VITE_API_URL;

  if (!apiTarget) {
    throw new Error('VITE_API_URL is not defined');
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(projectRoot, 'index.html'),
          admin: resolve(projectRoot, 'admin.html'),
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
