import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { cloudflare } from "@cloudflare/vite-plugin";

// Basis-Pfad: auf GitHub Pages liegt die Seite unter /<repo>/, lokal unter /
const base = process.env.PAGES_BASE ?? '/'

/**
 * Kennung dieses Builds — hängt an jeder Datenadresse.
 *
 * Sie löst ein Problem, das ohne sie nur mit Strg+Shift+R zu lösen war: Der
 * Service Worker und der Browser-Cache lieferten nach einem Deploy weiter die
 * alten `public/data/*.json`. Ein normales Neuladen half nicht, weil die
 * Adresse dieselbe blieb — und was unter derselben Adresse liegt, gilt beiden
 * Caches als dieselbe Datei (gemeldet von Daniel, 12.08.2026).
 *
 * Eine neue Kennung macht aus `/data/events.json` eine andere Adresse. Damit
 * ist es kein Auffrischen mehr, sondern ein Erstabruf — daran kommt kein Cache
 * vorbei.
 *
 * Die Kennung wird in das Bündel einkompiliert, und dessen Dateiname trägt
 * einen Hash. Neuer Deploy → neues HTML → neues Bündel → neue Kennung → neue
 * Datenadressen. Die Kette hält von selbst; niemand muss eine Versionsnummer
 * pflegen.
 *
 * Als Kennung dient der **Datenstand** (`meta.generatedAt`), nicht der
 * Commit-Hash. Der Unterschied kostet nichts und spart einiges: Ein Deploy, der
 * nur Code ändert, lässt die Datenadressen in Ruhe — niemand lädt deswegen
 * `titles.json` (551 KB) erneut. Ändern sich die Daten, ändert sich die
 * Kennung, und genau dann soll neu geladen werden. Der stündliche Lauf
 * committet ohnehin nur bei echter Änderung.
 */
function datenStand(): string {
  try {
    const meta = JSON.parse(readFileSync(new URL('./public/data/meta.json', import.meta.url), 'utf8'))
    // Nur Ziffern: "2026-08-12T14:07:33.001Z" → "20260812140733"
    if (meta?.generatedAt) return String(meta.generatedAt).replace(/\D/g, '').slice(0, 14);
  } catch {
    // Noch nie gebaut oder Datei kaputt — dann tut es die Notlösung unten.
  }
  return (process.env.GITHUB_SHA ?? String(Date.now())).slice(0, 12)
}

const buildId = datenStand()

export default defineConfig({
  base,
  root: 'web',
  publicDir: '../public',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})