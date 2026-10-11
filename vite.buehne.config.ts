import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { anbieterZeichen } from './web/buehne/vite-anbieter.ts'
import { buehnenWeichen } from './web/buehne/vite-weichen.ts'

/**
 * Eigener Bau der Bühne (`npm run buehne:bauen`, Konzept: `daniel-zum-abarbeiten/listen/mockup-buehne-konzept.md`).
 * Dieselbe Quelle wie die Seite, aber ein anderer Einstieg (`web/buehne.html`) und ein anderer Zielordner: Die Ausgabe
 * der Seite bleibt unberührt, und `public/data/` wird nicht mitkopiert — die Bühne trägt ihre Fälle selbst.
 */
export default defineConfig({
  base: './',
  root: 'web',
  publicDir: 'buehne/public',
  define: { __BUILD_ID__: JSON.stringify('buehne'), __APP_VERSION__: JSON.stringify('buehne') },
  plugins: [react(), tailwindcss(), buehnenWeichen(), anbieterZeichen()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../buehne-dist',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./web/buehne.html', import.meta.url)) },
  },
})
