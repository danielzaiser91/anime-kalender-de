#!/usr/bin/env node
/**
 * **Hält der offene Tab still?** (18.11.2026, Daniel: Rechner laut, während der Tab offen war; Auftrag perf-waechter)
 *
 * Je Ansicht 70 s Leerlauf (über eine Minutengrenze, wegen des „Läuft jetzt“-Takts): CPU- und Skriptanteil, Layouts und
 * Stil-Neuberechnungen (CDP `Performance.getMetrics`), laufende `setInterval` mit Takt und Aufrufer, unendliche Animationen.
 * Danach die Leck-Wache: Heap nach erzwungener Bereinigung vor und nach 20 Ansichtswechseln (nach einer Aufwärmrunde).
 * Desktop 1280 px ohne Drosselung (wie die Live-Basis vom 18.11.2026); Grenzen in `leerlauf-urteil.mjs`.
 *
 * Aufruf: `node tools/leerlauf-tempo.mjs [--dist dist] [--dauer 70] [--ausgabe datei.json]` (ohne `--dist`: Live-Seite).
 * Exit 1, wenn eine Grenze gerissen ist.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { BASIS, ausDistLiefern, ergebnis, heapNachGc, leerlaufMessen, messhaken, timerHaken } from './tempo-kern.mjs'
import { urteil } from './leerlauf-urteil.mjs'

const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
const DIST = arg('dist')
const DAUER_MS = Number(arg('dauer', 70)) * 1000
/** Nach dem Laden so lange warten, bis Startarbeit (volle Daten, Bildprüfung ≤ 6 s in `start-daten.ts`) vorbei ist. */
const EINSCHWINGEN_MS = 10000
const ANSICHTEN = [
  ['Kalender', ''],
  ['Datenbank', '#/datenbank?wm=80&wx=1&staffeln=1'],
]
/** Eine Runde Ansichtswechsel, endet wieder in der Woche; 4 Runden = 20 Wechsel. */
const RUNDE = ['#/monat', '#/datenbank?wm=80&wx=1&staffeln=1', '#/news', '#/datenbank?t=21', '#/woche']
const RUNDEN = 4
/** Caches (Panel, News, Datenbank-Zeilen) füllen sich in den ersten zwei Runden: 18.11.2026 je Runde +0,8/+0,15/+0,12/… MB, danach < 0,1 MB. */
const AUFWAERMEN = 2

async function neueSeite(browser, adresse) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  if (DIST) await ausDistLiefern(ctx, DIST)
  const seite = await ctx.newPage()
  await seite.addInitScript(timerHaken)
  await seite.addInitScript(messhaken)
  const cdp = await ctx.newCDPSession(seite)
  await seite.goto(BASIS + adresse, { waitUntil: 'load' })
  await seite.waitForTimeout(EINSCHWINGEN_MS)
  return { ctx, seite, cdp }
}

/** Wechselt per Adresse (wie ein Klick in der Navigation) und wartet, bis 500 ms lang nichts mehr passiert. */
async function wechsle(seite, hash) {
  await seite.evaluate((h) => (location.hash = h), hash)
  await ergebnis(seite)
}

async function leckWache(browser) {
  const { ctx, seite, cdp } = await neueSeite(browser, '#/woche')
  for (let r = 0; r < AUFWAERMEN; r++) for (const h of RUNDE) await wechsle(seite, h)
  const vorher = await heapNachGc(seite, cdp)
  for (let r = 0; r < RUNDEN; r++) for (const h of RUNDE) await wechsle(seite, h)
  const nachher = await heapNachGc(seite, cdp)
  await ctx.close()
  return { vorher, nachher, wechsel: RUNDEN * RUNDE.length }
}

function bericht(ansichten, leck, fehler) {
  const mb = (b) => (b / 1048576).toFixed(2)
  const zeilen = ansichten.map((a) => `| ${a.name} | ${(a.cpu * 100).toFixed(2)} % | ${a.scriptMsJeS} ms/s | ${a.layoutsJeMin} | ${a.stileJeMin} | ${a.heapMb} MB | ${a.knoten} | ${a.intervalle.map((i) => `${i.takt} ms`).join(', ') || '–'} | ${a.animationen.length} |`)
  const kurz = ansichten.flatMap((a) => a.kurzlebig.map((i) => `- ${a.name}: Intervall ${i.takt} ms von ${i.angelegt} bis ${i.beendet} ms nach dem Laden (beendet sich selbst; ${i.ort})`))
  return [
    `### Leerlauf (${ansichten[0]?.sekunden ?? 0} s je Ansicht, Desktop, ${DIST ? `dist ${DIST}` : BASIS})`,
    '',
    '| Ansicht | CPU | Script | Layouts/min | Stile/min | Heap | DOM-Knoten | Intervalle | Animationen |',
    '|---|---|---|---|---|---|---|---|---|',
    ...zeilen,
    '',
    leck ? `Leck-Wache: Heap nach Bereinigung ${mb(leck.vorher)} → ${mb(leck.nachher)} MB nach ${leck.wechsel} Ansichtswechseln (Δ ${mb(leck.nachher - leck.vorher)} MB)` : '',
    ...kurz,
    '',
    fehler.length ? fehler.map((f) => `- ✖ ${f}`).join('\n') : '✓ Leerlauf und Leck-Wache in den Grenzen',
    '',
  ].join('\n')
}

async function main() {
  const browser = await chromium.launch()
  const ansichten = []
  for (const [name, adresse] of ANSICHTEN) {
    const { ctx, seite, cdp } = await neueSeite(browser, adresse)
    ansichten.push({ name, ...(await leerlaufMessen(seite, cdp, DAUER_MS)) })
    await ctx.close()
  }
  const leck = await leckWache(browser)
  await browser.close()
  const fehler = urteil(ansichten, leck)
  const md = bericht(ansichten, leck, fehler)
  console.log(md)
  if (arg('ausgabe')) {
    mkdirSync(path.dirname(arg('ausgabe')), { recursive: true })
    writeFileSync(arg('ausgabe'), JSON.stringify({ ansichten, leck, fehler }, null, 2))
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
  process.exit(fehler.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
