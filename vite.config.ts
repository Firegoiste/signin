import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'three': path.resolve(__dirname, 'node_modules/three'),
        '@react-three/fiber': path.resolve(__dirname, 'node_modules/@react-three/fiber'),
        '@react-three/drei': path.resolve(__dirname, 'node_modules/@react-three/drei'),
      },
    },
    optimizeDeps: {
      include: ['three', '@react-three/fiber', '@react-three/drei'],
    },
    server: {
      hmr: false,
      allowedHosts: ['signin-production-7cbe.up.railway.app', '.up.railway.app'],
    },
  };
});
