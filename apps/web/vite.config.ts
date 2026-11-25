import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, __dirname, 'API_PROXY_TARGET');
  const apiProxy = {
    target: API_PROXY_TARGET || 'http://localhost:3000',
    changeOrigin: true,
  };
  const proxy = { '/api': apiProxy, '/transactions': apiProxy };

  return {
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: '@organizador/shared',
          replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
        },
        {
          find: '@/styled-system',
          replacement: path.resolve(__dirname, './styled-system'),
        },
        {
          find: '@',
          replacement: path.resolve(__dirname, './src'),
        },
      ],
    },
    server: {
      port: 5173,
      proxy,
    },
    preview: { proxy },
  };
});
