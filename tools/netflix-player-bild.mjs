#!/usr/bin/env node
/**
 * **Im Netflix-Player ist nichts von der Erweiterung zu sehen** (Daniel, 09.10.2026).
 *
 * Der Kasten oben links („Folge 4: deutsche Tonspur gefunden · Als deutsch melden") ist seit
 * 4.24.18 aus dem Code gestrichen; Daniel meldet von der Übersicht, nie aus dem Player. Geprüft
 * wird mit dem echten Stylesheet: Auf einer Wiedergabeseite (`html.ak-im-player`) ist `.ak-box`
 * unsichtbar, nur ein Durchgang (`html.ak-durchgang`, Notausgang) holt ihn zurück. Dass die
 * Melde-Erkennung dabei weiterläuft, belegt `extension/melder-uebersicht.test.cjs`.
 *
 * Aufruf: `node tools/netflix-player-bild.mjs` · `npm run check:netflix-player`
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const css = readFileSync('extension/melder.css', 'utf8')
const melder = readFileSync('extension/melder.js', 'utf8')

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

console.log('Der Netflix-Player ohne Erweiterung:\n')

/* Die Anzeige darf nicht zurückkommen: weder Code noch Stil. */
pruefe('melder.js baut keine Player-Anzeige', !/ak-player|playerAnzeige|playerZeigen/.test(melder))
pruefe('melder.css hat keinen Stil dafür', !/ak-player/.test(css))

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 900, height: 400 } })
await seite.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}${css}</style>
<div class="ak-box" style="position:fixed;right:10px;bottom:10px;width:200px;height:80px;background:#fff"><div>Kasten</div></div>`)

const sichtbar = () => seite.evaluate(() => getComputedStyle(document.querySelector('.ak-box')).display !== 'none')
const markiere = (klassen) =>
  seite.evaluate((k) => { document.documentElement.className = k }, klassen)

await markiere('')
pruefe('Kontrolle: auf einer normalen Seite ist der Kasten da', await sichtbar())
await markiere('ak-im-player')
pruefe('im Player ist der Kasten weg', !(await sichtbar()))
await markiere('ak-im-player ak-durchgang')
pruefe('nur im Durchgang bleibt der Notausgang', await sichtbar())
await browser.close()

process.exit(fehler.length ? 1 : 0)
