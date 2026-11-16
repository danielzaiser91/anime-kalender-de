#!/usr/bin/env node
/**
 * **Layout-Shift beim Erstladen einer Ansicht messen** (Direktaufruf der Adresse, Nachladen abgewartet), ohne Server gegen `dist/`.
 * Aufruf: `npm run check:cls-erstladen` (Tor im Job PR-Aussehen) bzw. `node tools/cls-erstladen.mjs [--desktop|--handy] [--grenze 0.1]`;
 * Exit 1, wenn eine Route die Grenze reißt. Liefert je Route die Summe und die verschobenen Elemente.
 * Anlass: Datenbank, News und Saison sprangen am Desktop um 0,2 bis 0,3, weil der Fuß neben dem Platzhalter im Bild stand; `cls-wechsel` misst nur Woche <-> Monat.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, devices } from 'playwright'
import { BASIS, ausDistLiefern } from './tempo-kern.mjs'
import { distPruefen } from './dist-frisch.mjs'
import { browserDa } from './browser-weiche.mjs'
import { GRENZE, clsSumme, shiftHaken } from './cls-wechsel.mjs'

/** Routen mit nachladendem Inhalt; die Kalender-Ansichten stehen mit drin, damit eine Regression dort auffällt. */
export const ROUTEN = ['#/woche', '#/monat', '#/datenbank', '#/news', '#/saison', '#/entdecken', '#/abo', '#/newsletter', '#/quellen']

const DATEN_VERZOEGERUNG_MS = 400

const PROFILE = {
  desktop: () => ({ viewport: { width: 1600, height: 900 } }),
  handy: () => ({ ...devices['Pixel 7'] }),
}

/** Lädt jede Route einzeln in frischem Kontext und liefert { route, cls, eintraege }. */
export async function erstladenMessen({ dist, profil, routen = ROUTEN }) {
  const browser = await chromium.launch()
  try {
    const ergebnisse = []
    for (const route of routen) {
      const ctx = await browser.newContext({ ...PROFILE[profil](), serviceWorkers: 'block' })
      await ctx.route(/^https?:\/\//, (r) => (`${new URL(r.request().url()).origin}/` === BASIS ? r.fallback() : r.abort()))
      await ausDistLiefern(ctx, dist)
      // Datendateien brauchen im Netz Zeit; ohne Verzögerung gewinnt das Laden das Rennen gegen das erste Zeichnen und die Messung wäre blind.
      await ctx.route(/\.json(\?|$)/, async (r) => {
        await new Promise((fertig) => setTimeout(fertig, DATEN_VERZOEGERUNG_MS))
        await r.fallback()
      })
      const seite = await ctx.newPage()
      await seite.addInitScript(shiftHaken)
      await seite.goto(`${BASIS}${route}`, { waitUntil: 'load' })
      await seite.waitForTimeout(3000)
      const eintraege = await seite.evaluate(() => window.__shifts)
      ergebnisse.push({ route, cls: clsSumme(eintraege), eintraege })
      await ctx.close()
    }
    return ergebnisse
  } finally {
    await browser.close()
  }
}

/** Fälle, in denen die Daten einer Ansicht nie ankommen: abgewiesen (Fehler) oder hängend (Frist 8 s). Danach muss der Fuß sichtbar und kein Platzhalter mehr da sein. */
export const LADEFAELLE = [
  { name: 'News abgewiesen', route: '#/news', datei: /news\.json/, verhalten: 'abweisen', warteMs: 2500 },
  { name: 'Saison abgewiesen', route: '#/saison', datei: /saison\.json/, verhalten: 'abweisen', warteMs: 2500 },
  { name: 'News hängt', route: '#/news', datei: /news\.json/, verhalten: 'haengen', warteMs: 9500 },
  { name: 'Saison hängt', route: '#/saison', datei: /saison\.json/, verhalten: 'haengen', warteMs: 9500 },
]

/** Urteil über den Zustand nach dem Warten: Fuß sichtbar und kein Platzhalter. */
export function fussUrteil({ platz, fuss }) {
  return platz === 0 && fuss === 'visible'
}

/** Lädt jeden Fall des Ladefehlers in frischem Kontext und liefert { name, platz, fuss, ok }. */
export async function ladefehlerMessen({ dist, profil }) {
  const browser = await chromium.launch()
  try {
    const ergebnisse = []
    for (const fall of LADEFAELLE) {
      const ctx = await browser.newContext({ ...PROFILE[profil](), serviceWorkers: 'block' })
      await ctx.route(/^https?:\/\//, (r) => (`${new URL(r.request().url()).origin}/` === BASIS ? r.fallback() : r.abort()))
      await ausDistLiefern(ctx, dist)
      await ctx.route(fall.datei, (r) => (fall.verhalten === 'abweisen' ? r.abort() : new Promise(() => {})))
      const seite = await ctx.newPage()
      await seite.goto(`${BASIS}${fall.route}`, { waitUntil: 'load' })
      await seite.waitForTimeout(fall.warteMs)
      const zustand = await seite.evaluate(() => ({
        platz: document.querySelectorAll('[data-ladeplatz]').length,
        fuss: document.querySelector('footer') ? getComputedStyle(document.querySelector('footer')).visibility : 'fehlt',
      }))
      ergebnisse.push({ name: fall.name, ...zustand, ok: fussUrteil(zustand) })
      await ctx.close()
    }
    return ergebnisse
  } finally {
    await browser.close()
  }
}

async function main() {
  const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
  if (!browserDa('cls-erstladen', chromium)) return
  const wurzel = path.resolve(import.meta.dirname, '..')
  if (!distPruefen(wurzel)) return
  const grenze = Number(arg('grenze', GRENZE))
  const gewaehlt = Object.keys(PROFILE).filter((p) => process.argv.includes(`--${p}`))
  for (const profil of gewaehlt.length ? gewaehlt : Object.keys(PROFILE)) {
    const ergebnisse = await erstladenMessen({ dist: path.join(wurzel, 'dist'), profil })
    console.log(`cls-erstladen ${profil}: ${ergebnisse.length} Routen, Grenze ${grenze}`)
    for (const r of ergebnisse) {
      const zu = r.cls >= grenze
      console.log(`${profil.padEnd(8)} ${r.route.padEnd(13)} CLS ${r.cls}${zu ? '  ZU HOCH' : ''}`)
      if (zu) for (const e of r.eintraege) for (const q of e.quellen) console.log(`           ${e.value.toFixed(4)} ${q.knoten} y ${q.von} -> ${q.nach}`)
      if (zu) process.exitCode = 1
    }
  }
  const fehlerfaelle = await ladefehlerMessen({ dist: path.join(wurzel, 'dist'), profil: 'desktop' })
  console.log(`cls-erstladen Ladefehler: ${fehlerfaelle.length} Fälle`)
  for (const f of fehlerfaelle) {
    console.log(`${f.name.padEnd(18)} Platzhalter ${f.platz}, Fuß ${f.fuss}${f.ok ? '' : '  FUSS FEHLT'}`)
    if (!f.ok) process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
