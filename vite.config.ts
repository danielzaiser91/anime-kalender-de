import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { eigeneKennungen } from './tools/vite-kennungen.ts'
import { datenKennung } from './tools/daten-kennung.ts'
import { vorladeSkript } from './tools/vite-vorladen.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
 * Als Kennung dient ein **Hash der Datendateien** (`tools/daten-kennung.ts`), nicht der Commit-Hash: Ein reiner Code-Deploy lässt die
 * Datenadressen in Ruhe, jede Datenänderung — auch von Hand, ohne neues `generatedAt` — ergibt eine neue Adresse.
 */
const buildId = datenKennung(fileURLToPath(new URL('./public/data', import.meta.url)))

/** Kennung des Codes: im CI die Commit-Kennung, lokal die Bauzeit. Sie steht im Bündel und in `version.json` (siehe `web/src/lib/aktualisierung.ts`). */
const appVersion = (process.env.GITHUB_SHA ?? `lokal-${Date.now()}`).slice(0, 12)

function versionDatei() {
  let ziel = ''
  return {
    name: 'version-datei',
    configResolved(c: { root: string; build: { outDir: string } }) {
      ziel = resolve(c.root, c.build.outDir, 'version.json')
    },
    closeBundle() {
      writeFileSync(ziel, JSON.stringify({ v: appVersion, daten: buildId }))
    },
  }
}

/**
 * **Die Startdaten laden parallel zum Programm, nicht danach** (18.09.2026, gemessen auf
 * einem gedrosselten Handy): Die vier JSON-Dateien der ersten Ansicht starteten erst bei
 * 1.353 ms, nachdem das Bündel (fertig bei 1.162 ms) ausgeführt war. Ein Preload im HTML
 * holt sie ab dem ersten Byte der Seite. `crossorigin` muss zu `fetch()` passen
 * (Modus cors), sonst lädt der Browser jede Datei zweimal. Welche Dateien: `tools/vite-vorladen.ts`.
 */
function datenVorladen() {
  return {
    name: 'daten-vorladen',
    transformIndexHtml(html: string) {
      let woche: { von: string; bis: string } | undefined
      try {
        const w = JSON.parse(readFileSync(new URL('./public/data/woche.json', import.meta.url), 'utf8'))
        if (w?.von && w?.bis) woche = { von: w.von, bis: w.bis }
      } catch {
        // Ohne Wochen-Datei starten alle Adressen aus den vollen Dateien.
      }
      return html.replace('</head>', `    ${vorladeSkript({ base, buildId, woche })}\n  </head>`)
    },
  }
}

export default defineConfig({
  base,
  root: 'web',
  publicDir: '../public',
  define: { __BUILD_ID__: JSON.stringify(buildId), __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), tailwindcss(), cloudflare(), datenVorladen(), eigeneKennungen(), versionDatei()],
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