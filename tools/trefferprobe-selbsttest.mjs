#!/usr/bin/env node
/**
 * Selbsttest der Trefferprobe (`trefferprobe-browser.mjs`) an gebauten Fällen: Ohne ihn wäre die Probe grün, auch wenn sie
 * nichts mehr erkennt (in `dist/` liegt heute nichts Verdecktes). Läuft in `check:panel`.
 */
import { chromium } from 'playwright'
import { trefferprobe } from './trefferprobe-browser.mjs'
import { AUSNAHMEN } from './trefferprobe-ausnahmen.mjs'

const CSS = '<style>body{margin:0}.deck{position:absolute;left:0;top:0;width:100%;height:200px;background:#ccc}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.zeile{position:relative;height:60px}</style>'
const ALLE_ARTEN = '<a href="#x">a</a><button>b</button><div role="button" tabindex="0">r</div><input type="checkbox"><details><summary>s</summary></details>'

/** Jeder Fall: Name, Seiteninhalt, Optionen der Probe, erwartete Zahl geprüfter Elemente und Befunde. */
const FAELLE = [
  { name: 'alles anklickbar', html: `<div class="zeile">${ALLE_ARTEN}</div>`, geprueft: 5, befunde: 0 },
  { name: 'Überzug über allen fünf Arten', html: `<div class="zeile">${ALLE_ARTEN}<div class="deck"></div></div>`, geprueft: 5, befunde: 5 },
  { name: 'Knopf mit pointer-events:none', html: '<button style="pointer-events:none">p</button>', geprueft: 1, befunde: 1 },
  { name: 'visibility:hidden zählt nicht', html: '<button style="visibility:hidden">v</button><button>ok</button>', geprueft: 1, befunde: 0 },
  { name: 'display:none zählt nicht', html: '<button style="display:none">d</button><button>ok</button>', geprueft: 1, befunde: 0 },
  { name: 'aria-hidden zählt nicht', html: '<div aria-hidden="true"><button>h</button></div><button>ok</button>', geprueft: 1, befunde: 0 },
  { name: 'deaktivierter Knopf unter Überzug zählt nicht', html: '<div class="zeile"><button disabled>x</button><div class="deck"></div></div>', geprueft: 0, befunde: 0 },
  { name: 'unsichtbarer Schalter trägt Etikett (frei)', html: '<label>Schalter<input class="sr" type="checkbox"></label>', geprueft: 1, befunde: 0 },
  { name: 'unsichtbarer Schalter, Etikett verdeckt', html: '<div class="zeile"><label>Schalter<input class="sr" type="checkbox"></label><div class="deck"></div></div>', geprueft: 1, befunde: 1 },
  { name: 'benannte Ausnahme', html: '<div class="zeile"><button class="frei">e</button><div class="deck"></div></div>', ausnahmen: [{ waehler: 'button.frei', grund: 'Test' }], geprueft: 0, befunde: 0 },
{ name: 'echte Ausnahme: unsichtbarer Karten-Knopf bleibt frei', html: '<div class="zeile"><button class="ak-oeffnen sr-only">k</button><div class="deck"></div></div>', ausnahmen: AUSNAHMEN, geprueft: 0, befunde: 0 },  { name: 'echte Ausnahme gilt nicht für andere Knöpfe', html: '<div class="zeile"><button>a</button><button class="ak-oeffnen">b</button><button class="sr-only">c</button><div class="deck"></div></div>', ausnahmen: AUSNAHMEN, geprueft: 3, befunde: 3 },
  { name: 'weit unten (Scrollen) und höher als das Fenster', html: '<div style="height:3000px"></div><button>unten</button><button style="height:2000px;display:block">hoch</button>', geprueft: 2, befunde: 0 },
  { name: 'nur unter der Wurzel', html: '<div id="w"><button>drin</button></div><div class="zeile"><button>draussen</button><div class="deck"></div></div>', wurzel: '#w', geprueft: 1, befunde: 0 },
  { name: 'Größe null zählt nicht', html: '<a href="#x"></a><button>ok</button>', geprueft: 1, befunde: 0 },
  { name: 'fester Balken am Rand verdeckt nach dem Scrollen nichts', html: '<div style="position:fixed;bottom:0;left:0;right:0;height:100px;background:#ccc"></div><div style="height:3000px"></div><button>x</button><div style="height:3000px"></div>', geprueft: 1, befunde: 0 },
  { name: 'jeder verdeckte Knopf einzeln', html: '<div class="zeile"><button>gleich</button><div class="deck"></div></div>', wiederholt: 3, geprueft: 3, befunde: 3 },
]

async function pruefeFall(seite, f) {
  const html = f.wiederholt ? f.html.repeat(f.wiederholt) : f.html
  await seite.setContent(`${CSS}${html}`)
  const r = await seite.evaluate(trefferprobe, { wurzel: f.wurzel, ausnahmen: f.ausnahmen ?? [] })
  if (r.geprueft === f.geprueft && r.befunde.length === f.befunde) return null
  return `${f.name}: geprüft ${r.geprueft} (erwartet ${f.geprueft}), Befunde ${r.befunde.length} (erwartet ${f.befunde}) ${r.befunde.join(' | ')}`
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true })
const fehler = []
for (const f of FAELLE) {
  const e = await pruefeFall(seite, f)
  if (e) fehler.push(e)
}
await browser.close()
for (const e of fehler) console.log(`  ✕ Trefferprobe-Selbsttest ${e}`)
if (fehler.length) process.exitCode = 1
else console.log(`  ok  Trefferprobe-Selbsttest: ${FAELLE.length} Fälle`)
