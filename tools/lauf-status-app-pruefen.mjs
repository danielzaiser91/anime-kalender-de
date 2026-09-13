#!/usr/bin/env node
/**
 * **Die Laufstatus-App — startet sie, und gehen ihre Links in den richtigen Browser?**
 *
 * Seit dem 13.09.2026 läuft die Anzeige als eigenes Electron-Programm
 * (`C:\code\ai\__assets\tools\lauf-status\app\`), nicht mehr als Chrome-Fenster.
 * Anlass: `--window-size` aus dem alten Startskript galt für den ganzen
 * Chrome-Prozess, und Daniels normale Fenster erbten die 420 Pixel.
 *
 * Gemessen wird, was die Hülle leisten muss, und das meiste davon sieht man auf
 * keinem Bild:
 *
 * - Das Fenster hat seine Größe, und die Seite hat geladen.
 * - **Die Pillen öffnen im Standardbrowser.** Die Seite öffnet synchron ein
 *   leeres Fenster und setzt seine Adresse erst nach einem `fetch`. Geht das
 *   schief, navigiert die Anzeige selbst weg — oder der Link landet in einem
 *   Electron-Fenster ohne Daniels Anmeldung und ohne seine Erweiterung.
 * - Ein normaler Verweis mit `target="_blank"` geht ebenfalls hinaus.
 * - Die Anzeige selbst lässt sich nicht wegnavigieren.
 *
 * **Der Standardbrowser wird dabei nie geöffnet:** `shell.openExternal` wird im
 * Hauptprozess durch einen Zähler ersetzt, bevor irgendetwas geklickt wird.
 *
 * Aufruf: `node tools/lauf-status-app-pruefen.mjs`
 * Ergebnis: `docs/lauf-status-app.png`
 */
import { _electron as electron } from 'playwright'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'C:/code/ai/__assets/tools/lauf-status/app'
const EXE = path.join(APP, 'node_modules/electron/dist/electron.exe')

if (!existsSync(EXE)) {
  console.error(`Electron fehlt: ${EXE} — vorher \`npm install\` im App-Ordner.`)
  process.exit(1)
}

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

const programm = await electron.launch({ executablePath: EXE, args: [APP] })

/* Zuerst den Ausgang sperren — kein Test darf Daniels Browser öffnen. */
await programm.evaluate(({ shell }) => {
  globalThis.__extern = []
  shell.openExternal = async (url) => {
    globalThis.__extern.push(url)
  }
})

const seite = await programm.firstWindow()
await seite.waitForLoadState('domcontentloaded')
/* Die Anzeige holt ihre Daten nach — ein Moment für den ersten Aufbau. */
await seite.waitForTimeout(2500)

console.log('Die Laufstatus-App:\n')

const fenster = await programm.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.isVisible())
  const [breite, hoehe] = w ? w.getSize() : [0, 0]
  return { breite, hoehe, titel: w?.getTitle() ?? '' }
})
pruefe('das Fenster ist 420 × 760 groß', fenster.breite === 420 && fenster.hoehe === 760, `${fenster.breite} × ${fenster.hoehe}`)
pruefe('es trägt den Titel der Seite', fenster.titel === 'Laufstatus', fenster.titel)
pruefe('die Seite ist die aus dem Werkzeugordner', /lauf-status\/index\.html$/.test(seite.url()), seite.url())

await seite.screenshot({ path: path.join(WURZEL, 'docs', 'lauf-status-app.png') })

/* 1. Der Weg der Pillen: leeres Fenster jetzt, Adresse nach einem await. */
await seite.evaluate(async () => {
  const f = window.open('', '_blank')
  await new Promise((r) => setTimeout(r, 150))
  if (f) f.location.href = 'https://example.com/pille'
  else window.location.href = 'https://example.com/pille-rueckfall'
})
await seite.waitForTimeout(1200)

/* 2. Ein gewöhnlicher Verweis mit target=_blank. */
await seite.evaluate(() => {
  const a = document.createElement('a')
  a.href = 'https://example.com/verweis'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
})
await seite.waitForTimeout(600)

/* 3. Der Versuch, die Anzeige selbst wegzunavigieren. */
await seite.evaluate(() => {
  window.location.href = 'https://example.com/weg'
})
await seite.waitForTimeout(800)

const extern = await programm.evaluate(() => globalThis.__extern)
const nochDa = seite.url()
const offen = await programm.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)

pruefe('eine Pille öffnet im Standardbrowser', extern.includes('https://example.com/pille'), JSON.stringify(extern))
pruefe('ohne den Rückfall der Seite auszulösen', !extern.includes('https://example.com/pille-rueckfall'))
pruefe('ein Verweis mit target=_blank ebenso', extern.includes('https://example.com/verweis'), JSON.stringify(extern))
pruefe('die Anzeige lässt sich nicht wegnavigieren', /lauf-status\/index\.html$/.test(nochDa), nochDa)
pruefe('und das Wegnavigieren geht stattdessen hinaus', extern.includes('https://example.com/weg'), JSON.stringify(extern))
pruefe('kein Hilfsfenster bleibt übrig', offen === 1, `${offen} Fenster`)

await programm.close()
console.log('\n  Bild: docs/lauf-status-app.png')
process.exit(fehler.length ? 1 : 0)
