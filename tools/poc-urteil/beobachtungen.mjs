#!/usr/bin/env node
/**
 * PoC Stufe 1 — alle Behauptungen als einheitliche Beobachtungen (docs/konzept-meldungen-architektur.md).
 *
 * Liest die Rohmeldungen aus D1 (Export als JSON, Pfad als Argument) und die Handbelege aus
 * `data/dub-confirmed.yaml`. Einträge, die der Einleser aus Meldungen erzeugt hat (Abschnitte
 * „Aus dem Browser gemeldet"), zählen nicht noch einmal — ihre Quelle ist die Rohmeldung.
 * Schreibt nichts in den Bestand; Ausgabe: Beobachtungen als JSON (zweites Argument) und eine Zählung.
 *
 * Aufruf: node tools/poc-urteil/beobachtungen.mjs <pruefung-roh.json> <ausgabe.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'

const [rohPfad, ausPfad] = process.argv.slice(2)
if (!rohPfad || !ausPfad) {
  console.error('Aufruf: node tools/poc-urteil/beobachtungen.mjs <pruefung-roh.json> <ausgabe.json>')
  process.exit(1)
}

const beobachtungen = []

/* --- Quelle 1: Rohmeldungen der Erweiterung ------------------------------------------------- */
const roh = JSON.parse(readFileSync(rohPfad, 'utf8'))
const zeilen = Array.isArray(roh) ? (roh[0]?.results ?? roh) : roh.results
for (const z of zeilen) {
  const weg = z.befund === 'weg'
  const angenommen = /ANGENOMMEN/.test(z.notiz ?? '')
  /* Ein Nein von einer Kanal-Seite ist ohne Kanal-Abo kein Beleg (CLAUDE.md) — eigene Art, niedriges Gewicht. */
  const kanal = /crunchyroll|aniverse|animedigital|pokemon|prosieben|kixi|midnight|arthouse|rtl/i.test(z.abos ?? '')
  beobachtungen.push({
    quelle: 'erweiterung',
    art: angenommen ? 'angenommen' : z.folge_nr == null ? 'abgeleitet' : 'gemessen',
    kanalNein: kanal && z.befund === 'kein_dub',
    anbieter: z.plattform,
    seite: z.seiten_kennung ?? null,
    url: z.url,
    anbieterStaffel: z.staffel ?? null,
    anbieterFolge: z.folge_nr ?? null,
    folgenAufSeite: z.folgen ?? null,
    titelId: z.titel_id ?? null,
    vorhanden: weg ? 'nein' : 'ja',
    tonDe: weg ? 'unbekannt' : z.befund === 'dub' ? 'ja' : 'nein',
    zeitpunkt: z.gemeldet_am,
    notiz: z.notiz ?? null,
    ref: `pruefung:${z.id}`,
  })
}

/* --- Quelle 2: Handbelege, ohne die aus Meldungen eingelesenen ---------------------------- */
const text = readFileSync('data/dub-confirmed.yaml', 'utf8')
const eingelesen = new Set()
{
  let imBrowserAbschnitt = false
  let zaehler = -1
  for (const zeile of text.split('\n')) {
    if (/^# ---/.test(zeile)) imBrowserAbschnitt = /Aus dem Browser gemeldet|Kanal-Meldungen mit zweiter Quelle/.test(zeile)
    if (/^- anilistId:/.test(zeile)) {
      zaehler++
      if (imBrowserAbschnitt) eingelesen.add(zaehler)
    }
  }
}
const belege = yaml.load(text) ?? []
let handGezaehlt = 0
belege.forEach((b, i) => {
  if (eingelesen.has(i) || b?.anilistId == null) return
  handGezaehlt++
  const basis = {
    quelle: 'hand',
    anbieter: b.platform,
    url: b.url ?? null,
    titelId: b.anilistId,
    zeitpunkt: String(b.checkedAt ?? ''),
    ref: `dub-confirmed:${i}`,
  }
  if (b.available === false) {
    beobachtungen.push({ ...basis, art: 'gemessen', folge: null, vorhanden: 'nein', tonDe: 'unbekannt' })
    return
  }
  if (Array.isArray(b.dubRanges) && b.dubRanges.length) {
    for (const r of b.dubRanges) {
      const gemessen = new Set(r.checked ?? [])
      for (let n = r.from; n <= r.to; n++) {
        beobachtungen.push({
          ...basis,
          art: gemessen.size && !gemessen.has(n) ? 'angenommen' : 'gemessen',
          folge: n,
          vorhanden: 'ja',
          tonDe: r.dub ? 'ja' : 'nein',
        })
      }
    }
    return
  }
  if (typeof b.dub === 'boolean') {
    beobachtungen.push({ ...basis, art: 'gemessen', folge: null, vorhanden: 'ja', tonDe: b.dub ? 'ja' : 'nein' })
  }
})

writeFileSync(ausPfad, JSON.stringify(beobachtungen))

/* --- Zählung ------------------------------------------------------------------------------ */
const zaehle = (f) => {
  const m = new Map()
  for (const b of beobachtungen) m.set(f(b), (m.get(f(b)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}
console.log(`${beobachtungen.length} Beobachtungen (${zeilen.length} Rohmeldungen, ${handGezaehlt} Handbelege; ${eingelesen.size} eingelesene Belege nicht doppelt gezählt)`)
for (const [k, v] of zaehle((b) => `${b.quelle} · ${b.art} · vorhanden ${b.vorhanden} · Deutsch ${b.tonDe}${b.kanalNein ? ' · Kanal-Nein' : ''}`))
  console.log(String(v).padStart(7), k)
const ohneTitel = beobachtungen.filter((b) => b.quelle === 'erweiterung' && b.titelId == null).length
console.log(`\nRohmeldungen ohne titel_id (brauchen die Zuordnung über Adresse): ${ohneTitel}`)
