import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app runs in the system web engine. On macOS 12 that is WebKit from
// Safari 15 or later, so the build targets Safari 15.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: ['safari15', 'es2021'], outDir: 'dist', emptyOutDir: true },
});
