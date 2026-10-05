#!/usr/bin/env node
/**
 * **Stufe 0 der eigenen Kennungen** (`docs/wissen/konzept-eigene-ids.md`, Daniel 04.10.2026): Jeder Titel bekommt eine eigene,
 * nie wiederverwendete Zahl (`ak`), gespeichert in `data/kennungen.json`.
 *
 * Die Datei wird nur ergänzt: Bestehende Zeilen bleiben, wie sie sind; neue Titel (AniList-Kennung noch nicht eingetragen) bekommen die
 * nächste freie Zahl, nach AniList-Kennung aufsteigend vergeben, damit ein Lauf reproduzierbar ist. Ein Titel, der aus den Quellen
 * verschwindet, bleibt in der Datei. Noch liest nichts aus ihr; Stufe 1 übersetzt an der Ausgabe.
 *
 * Quellen der Titel: `public/data/titles.json` (Bestand), `public/data/ohne-synchro.json` (hinter dem Toggle) und die aniSearch-Zuordnung
 * `data/anisearch.json` (AniList-Kennung → aniSearch-Kennung).
 *
 * Format: `{ "naechste": 17843, "titel": [[ak, anilist, aniSearch], …] }` — `aniSearch` ist 0, wo keine Zuordnung vorliegt.
 *
 * Aufruf: node tools/kennungen-erzeugen.mjs [--trocken]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const trocken = process.argv.includes('--trocken')
const lies = (pfad, vorgabe) => (existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : vorgabe)

const alt = lies('data/kennungen.json', { naechste: 1, titel: [] })
const jeAnilist = new Map(alt.titel.map((z) => [z[1], z]))

const ids = new Set()
/* Auch die Titel tragen ihre aniSearch-Kennung (`anisearchId`), hinter dem Toggle für 11.607 Titel, die noch nicht abgerufen sind. */
const ausTitel = new Map()
for (const datei of ['public/data/titles.json', 'public/data/ohne-synchro.json']) {
  const liste = lies(datei, [])
  for (const t of Array.isArray(liste) ? liste : Object.values(liste)) {
    if (!Number.isInteger(t?.id)) continue
    ids.add(t.id)
    if (Number.isInteger(t.franchiseId) && t.franchiseId > 0) ids.add(t.franchiseId)
    if (Number.isInteger(t.anisearchId) && t.anisearchId > 0) ausTitel.set(t.id, t.anisearchId)
  }
}
/* Auch Reihen-Mitglieder, Termine und Meldungen nennen Titel, die in keiner der beiden Listen stehen; die Übersetzung der Ausgabe braucht für jede genannte Kennung eine eigene. */
const reihen = lies('public/data/franchises.json', {})
for (const [schluessel, mitglieder] of Object.entries(reihen)) {
  ids.add(Number(schluessel))
  for (const m of mitglieder) if (Number.isInteger(m?.id) && m.id > 0) ids.add(m.id)
}
for (const [datei, feld] of [['releases', 'titleId'], ['events', 'titleId'], ['meldungen', 'titleId'], ['news', 'titelId'], ['neu-mit-synchro', 'id']]) {
  for (const x of lies(`public/data/${datei}.json`, [])) if (Number.isInteger(x?.[feld]) && x[feld] > 0) ids.add(x[feld])
}
for (const [schluessel, v] of Object.entries(lies('public/data/reihen.json', {}))) {
  ids.add(Number(schluessel))
  if (Number.isInteger(v?.f) && v.f > 0) ids.add(v.f)
}
const aniSearch = lies('data/anisearch.json', {})
const eintraege = aniSearch.eintraege ?? aniSearch
const aniSearchVon = (anilist) => Number(eintraege[String(anilist)]?.anisearchId) || ausTitel.get(anilist) || 0

let naechste = alt.naechste
const neu = [...ids].filter((id) => !jeAnilist.has(id)).sort((a, b) => a - b)
for (const id of neu) {
  const zeile = [naechste++, id, aniSearchVon(id)]
  alt.titel.push(zeile)
  jeAnilist.set(id, zeile)
}
/* Eine später gefundene aniSearch-Zuordnung wird nachgetragen; eine eingetragene ändert sich nicht still. */
let ergaenzt = 0
for (const z of alt.titel) {
  if (z[2]) continue
  const a = aniSearchVon(z[1])
  if (a) {
    z[2] = a
    ergaenzt++
  }
}
alt.naechste = naechste
const mitSearch = alt.titel.filter((z) => z[2]).length
console.log(`${ids.size} Titel in den Quellen, ${neu.length} neue Kennungen, ${ergaenzt} aniSearch-Zuordnungen ergänzt; ${alt.titel.length} Zeilen, davon ${mitSearch} mit aniSearch (${Math.round((mitSearch / alt.titel.length) * 100)} %).`)
const doppelt = alt.titel.length - new Set(alt.titel.map((z) => z[0])).size
if (doppelt) throw new Error(`${doppelt} Kennungen doppelt vergeben`)
if (!trocken) {
  const zeilen = alt.titel.map((z) => `[${z.join(',')}]`)
  writeFileSync('data/kennungen.json', `{"naechste":${alt.naechste},"titel":[\n${zeilen.join(',\n')}\n]}\n`)
  console.log('data/kennungen.json geschrieben.')
}
