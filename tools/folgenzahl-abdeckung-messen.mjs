/**
 * **Wie viele deutsche Verweise haben eine belastbare Folgenzahl — und woher?**
 *
 * Entstanden am 14.09.2026 für die Anbieter-Pillen. Die erste Messung zählte
 * nur `dubRanges` am Verweis und kam auf 5 %; Daniel: „guck nochmal genau in
 * bestand ob wir evtl schon mehr wissen". Mit allen Quellen waren es 66 %, und
 * der Rest sind abgeschlossene Serien. Die Lehre steht in CLAUDE.md
 * („Wer eine Abdeckung misst, zählt alle Quellen").
 *
 * Kategorien je deutschem Verweis (Titel × Anbieter), in dieser Reihenfolge:
 *   film          Format MOVIE — ein Film ist eine Folge
 *   bereiche      Folgenbereiche am Verweis (Handbeleg, Meldung)
 *   crunchyroll   Crunchyroll-Dub-Bestand mit deutschen Folgen je Staffel
 *   motn          Streaming-Availability-Archiv: deutsche Folgen je Dienst
 *   adn           ADN-Historie: Folgen mit deutscher Tonspur
 *   abgeschlossen Serie mit japanischem Ende in der Vergangenheit, ohne Einzelbeleg
 *   laufend       alles Übrige — hier kennt die Pille keine Zahl
 *
 * Aufruf: node tools/folgenzahl-abdeckung-messen.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p) => JSON.parse(readFileSync(resolve(WURZEL, p), 'utf8'))
const heute = new Date().toISOString().slice(0, 10)

const titel = lies('public/data/titles.json')
const cr = lies('data/crunchyroll-dub.json').serien ?? []
const motn = lies('data/motn.json')
const adn = lies('data/adn-vde-historie.json').serien ?? {}

const slug = (u) => String(u).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase()
const crNachKennung = new Set()
const crNachSlug = new Set()
for (const s of cr) {
  const deutsch = (s.staffeln ?? []).reduce((n, st) => n + (st.deutscheFolgen?.length ?? st.deutsch ?? 0), 0)
  if (!deutsch) continue
  if (s.seriesId) crNachKennung.add(s.seriesId)
  if (s.url) crNachSlug.add(slug(s.url))
}

const zaehl = {}
const je = (p, k) => {
  zaehl[p] = zaehl[p] ?? { gesamt: 0 }
  zaehl[p][k] = (zaehl[p][k] ?? 0) + 1
  zaehl[p].gesamt++
}

for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.dub !== true) continue
    const p = s.platform
    if (t.format === 'MOVIE') { je(p, 'film'); continue }
    if ((s.dubRanges ?? []).some((r) => r.dub)) { je(p, 'bereiche'); continue }
    if (p === 'crunchyroll') {
      const kennung = /\/series\/([A-Z0-9]+)/i.exec(s.url)?.[1]
      if ((kennung && crNachKennung.has(kennung)) || crNachSlug.has(slug(s.url))) { je(p, 'crunchyroll'); continue }
    }
    if (['netflix', 'primevideo', 'disneyplus'].includes(p)) {
      const imdb = motn.gesucht?.[String(t.id)]?.imdbId
      const d = imdb ? motn.shows?.[imdb]?.dienste?.[p]?.deutsch : undefined
      if (Array.isArray(d) && d.length) { je(p, 'motn'); continue }
    }
    if (p === 'adn') {
      const id = /\/video\/(\d+)/.exec(s.url)?.[1]
      if (id && adn[id] && Object.keys(adn[id]).length) { je(p, 'adn'); continue }
    }
    if (t.jpEnd && t.jpEnd < heute) { je(p, 'abgeschlossen'); continue }
    je(p, 'laufend')
  }
}

const spalten = ['film', 'bereiche', 'crunchyroll', 'motn', 'adn', 'abgeschlossen', 'laufend']
const summe = { gesamt: 0 }
for (const v of Object.values(zaehl)) for (const [k, n] of Object.entries(v)) summe[k] = (summe[k] ?? 0) + n
console.log('Anbieter'.padEnd(12), 'gesamt'.padStart(6), ...spalten.map((s) => s.padStart(13)))
const zeilen = Object.entries(zaehl).sort((a, b) => b[1].gesamt - a[1].gesamt)
for (const [p, v] of [...zeilen, ['SUMME', summe]]) {
  console.log(p.padEnd(12), String(v.gesamt).padStart(6), ...spalten.map((s) => String(v[s] ?? 0).padStart(13)))
}
const anteil = (n) => Math.round((100 * (n ?? 0)) / summe.gesamt)
const belegt = ['film', 'bereiche', 'crunchyroll', 'motn', 'adn'].reduce((n, k) => n + (summe[k] ?? 0), 0)
console.log(`\nFilm oder Einzelbeleg: ${belegt} von ${summe.gesamt} (${anteil(belegt)} %)`)
console.log(`Abgeschlossene Serien ohne Einzelbeleg: ${summe.abgeschlossen ?? 0} (${anteil(summe.abgeschlossen)} %)`)
console.log(`Laufend ohne Einzelbeleg (Pille ohne Zahl): ${summe.laufend ?? 0} (${anteil(summe.laufend)} %)`)
