import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(here, 'client'),
  plugins: [react()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
