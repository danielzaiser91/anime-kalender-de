#!/usr/bin/env node
/**
 * **Wie die Netflix-Prüfliste aussieht — mit den echten Zuständen.**
 *
 * Daniel am 11.09.2026 mit Bild: Die Pille zeigte bei Haikyu!! „S1 ✓ E1, 26 ·
 * E2–25", der Knopf daneben „✓ E26 geprüft". Beides war falsch, und keines der
 * Bildwerkzeuge zeigte den Dialog.
 *
 * Die Zustände werden hier **nicht nachgebaut**, sondern mit den Funktionen aus
 * `melder.js` ausgerechnet (`staffelnVon`, `folgeZustand`, `zustandZeilen`) —
 * gegen die ausgelieferte `offene-netflix.js` und eine Meldung als Kulisse.
 * Nachgestellt ist nur das Gerüst aus Zeile, Pille und Marken, mit denselben
 * Klassen wie in `dialogOeffnen()`.
 *
 * Aufruf: `node tools/netflix-dialog-bild.mjs`
 * Ergebnis: `docs/netflix-dialog.png`
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import vm from 'node:vm'

const css = readFileSync('extension/melder.css', 'utf8')
const quelle = readFileSync('extension/melder.js', 'utf8')
const schneide = (name) => new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(quelle)?.[0]
const namen = [
  'staffelnGruppiert',
  'staffelnVon',
  'meldungenMerken',
  'anbieterAufteilung',
  'zaehltDurch',
  'meldungAm',
  'listenZustand',
  'folgeZustand',
  'datumKurz',
  'zustandZeilen',
  'alsBereiche',
]
const fehlt = namen.filter((n) => !schneide(n))
if (fehlt.length) {
  console.error('Nicht im Quelltext: ' + fehlt.join(', '))
  process.exit(1)
}

const liste = (() => {
  const g = {}
  new Function('globalThis', readFileSync('extension/offene-netflix.js', 'utf8'))(g)
  return g.AK_OFFENE_TITEL
})()

/* Eine Kulisse für Gemeldetes und für „erneut": S1 E1 gemeldet, S3 als Wiedervorlage. */
const kulisse = structuredClone(liste)
if (kulisse['80090673']) {
  kulisse['80090673'].staffeln = kulisse['80090673'].staffeln.map((st) =>
    st.nr === 3 && st.erste === 1 ? { ...st, offen: true, zustand: 'erneut', seit: '2026-09-11T00:00:00Z' } : st,
  )
}
const kontext = {
  anbieterStaffeln: {},
  offeneTitel: kulisse,
  Number,
  Set,
  Map,
  Math,
  Boolean,
  String,
  Array,
  JSON,
  zeilen: null,
}
vm.createContext(kontext)
vm.runInContext(
  ['const MELDUNGEN = new Map()', ...namen.map(schneide)].join('\n\n') +
    `
meldungenMerken('80090673', [{ nummer: 1, staffel: 1, staffelBekannt: true, folge: '1', am: '2026-09-11T10:00:00Z' }])
zeilen = Object.entries(offeneTitel).map(([id, eintrag]) => ({
  titel: eintrag.titel,
  pillen: staffelnVon(id, eintrag).filter((st) => !st.film).map((st) => {
    const alle = Array.from({ length: st.folgen ?? 0 }, (_, i) => (st.erste ?? 1) + i)
    const zustaende = alle.map((n) => ({ n, ...folgeZustand(id, st.nr, n) }))
    const nur = (z) => zustaende.filter((x) => x.zustand === z).map((x) => x.n)
    return {
      nr: st.nr,
      erledigt: alsBereiche(nur('gemeldet')),
      melden: alsBereiche(nur('melden')),
      erneut: alsBereiche(nur('erneut')),
      titel: zustandZeilen(zustaende).join('\\n'),
      mehrere: staffelnVon(id, eintrag).length > 1,
    }
  }),
}))
`,
  kontext,
)

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 820, height: 520 } })
await seite.setContent(`<!doctype html><meta charset="utf-8">
<style>html{background:#141414}body{margin:0;font:13px/1.45 system-ui,sans-serif}${css}
.ak-dialog{position:static}</style>`)
await seite.evaluate((zeilen) => {
  const dialog = document.createElement('div')
  dialog.className = 'ak-dialog'
  const kasten = document.createElement('div')
  kasten.className = 'ak-kasten'
  const liste = document.createElement('div')
  liste.className = 'ak-liste'
  for (const z of zeilen) {
    const zeile = document.createElement('div')
    zeile.className = 'ak-zeile'
    const link = document.createElement('a')
    link.className = 'ak-titel'
    link.textContent = z.titel
    zeile.appendChild(link)
    const fuss = document.createElement('div')
    fuss.className = 'ak-fuss'
    const folgen = document.createElement('div')
    folgen.className = 'ak-folgen'
    for (const p of z.pillen) {
      const offen = p.melden.length || p.erneut.length
      const pille = document.createElement('span')
      pille.className = offen ? 'ak-folge' : 'ak-folge ak-fertig'
      pille.title = p.titel
      const teil = (klasse, text) => {
        const s = document.createElement('span')
        s.className = klasse
        s.textContent = text
        pille.appendChild(s)
      }
      if (p.mehrere) teil('ak-st', `S${p.nr}`)
      if (p.erledigt.length) teil('ak-durch', `✓ E${p.erledigt.join(', ')}`)
      if (p.melden.length) teil('ak-folge', `E${p.melden.join(', ')}`)
      if (p.erneut.length) teil('ak-folge ak-erneut', `↻ E${p.erneut.join(', ')}`)
      if (offen && p.mehrere) {
        const weg = document.createElement('button')
        weg.className = 'ak-staffel-weg'
        weg.textContent = '✕'
        pille.appendChild(weg)
      }
      folgen.appendChild(pille)
    }
    fuss.appendChild(folgen)
    zeile.appendChild(fuss)
    liste.appendChild(zeile)
  }
  kasten.appendChild(liste)
  dialog.appendChild(kasten)
  document.body.appendChild(dialog)
}, kontext.zeilen)

for (const z of kontext.zeilen) {
  console.log(z.titel)
  for (const p of z.pillen) console.log(`  S${p.nr}  ✓ ${p.erledigt.join(', ') || '—'}  |  zu melden ${p.melden.join(', ') || '—'}  |  ↻ ${p.erneut.join(', ') || '—'}`)
}
mkdirSync('docs', { recursive: true })
await seite.locator('.ak-kasten').screenshot({ path: 'docs/netflix-dialog.png' })
console.log('\n  Bild: docs/netflix-dialog.png')
await browser.close()
