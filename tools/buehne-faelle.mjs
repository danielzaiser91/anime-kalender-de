#!/usr/bin/env node
/**
 * Schneidet die Fälle der Bühne (`web/buehne/`) aus `public/data/` in eine kleine, eingefrorene Datei.
 *
 * Jeder Fall ist eine ganze Reihe samt Terminen, Meldungen, Handlung, Disc und Sprechern — in der Form, wie die
 * ausgelieferte Seite sie sieht (eigene Kennungen `ak`, über dieselbe Übersetzung wie der Bau). Bilder werden zu
 * Platzhaltern, damit die Bühne keine fremde Adresse abruft. Die Datei wird nur auf Aufruf neu geschrieben; „heute"
 * ist fest, so bleibt ein Fall dauerhaft derselbe, auch wenn der Bestand weiterläuft.
 *
 * Aufruf: node tools/buehne-faelle.mjs        (oder: npm run buehne:faelle)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ladeAkVon, uebersetzeDatei } from '../pipeline/lib/ausgabe-kennung.ts'

const WURZEL = resolve(import.meta.dirname, '..')
const DATEN = resolve(WURZEL, 'public/data')
const ZIEL = resolve(WURZEL, 'web/buehne/faelle.json')

/** Fester Zeitpunkt der Bühne (UTC) — Sonntag, 11.10.2026: Tokyo Revengers Staffel 4 läuft, Folge 3 kommt am 16.10. */
const HEUTE = '2026-10-11T10:00:00Z'
const PLATZHALTER = 'https://platzhalter.invalid/cover/'
const PLATZHALTER_BILDER = 6

/** AniList-Kennung des geöffneten Titels; die Reihe ergibt sich daraus (`franchiseId`). */
const FAELLE = [
  { slug: 'tokyo-revengers', name: 'Tokyo Revengers (neue Staffel)', titel: 178083 },
  { slug: 'attack-on-titan', name: 'Attack on Titan (Staffeln, Filme, Specials)', titel: 110277 },
  { slug: '86', name: '86 (fertig)', titel: 131586 },
]

const lies = (name) => JSON.parse(readFileSync(resolve(DATEN, name), 'utf8'))
const liesWennDa = (name, rueckfall) => (existsSync(resolve(DATEN, name)) ? lies(name) : rueckfall)
const gruppe = (id) => id % 32

/** Bilder werden zu einem von sechs Platzhaltern (Dateien in `web/buehne/public/cover/`), stabil je Kennung; der Trailer entfällt (die Einbettung wäre ein fremder Abruf). */
function ohneBilder(daten) {
  const platzhalter = (id) => `${PLATZHALTER}${Math.abs(id) % PLATZHALTER_BILDER}.svg`
  const eintrag = ({ trailer: _trailer, ...t }, id) => ({
    ...t,
    ...(t.coverImage && { coverImage: platzhalter(id) }),
    ...(t.bannerImage && { bannerImage: platzhalter(id) }),
    ...(t.cover && { cover: platzhalter(id) }),
  })
  return Array.isArray(daten) ? daten.map((t) => eintrag(t, t.id)) : daten
}

function reiheVon(titelId) {
  const titel = lies('titles.json')
  const eigener = titel.find((t) => t.id === titelId)
  if (!eigener) throw new Error(`Titel ${titelId} fehlt in titles.json`)
  const wurzel = eigener.franchiseId ?? eigener.id
  const gehoert = (t) => (t.franchiseId ?? t.id) === wurzel
  return { wurzel, gehoert }
}

function schneide(fall, ak) {
  const { wurzel, gehoert } = reiheVon(fall.titel)
  const kern = lies('titles-core.json').filter(gehoert)
  const alle = lies('titles.json').filter(gehoert)
  const ohneSynchro = liesWennDa('ohne-synchro.json', []).filter(gehoert)
  const ids = new Set([...kern, ...alle, ...ohneSynchro].map((t) => t.id))
  const roh = {
    'titles-core.json': ohneBilder(kern),
    'titles.json': ohneBilder(alle),
    'ohne-synchro.json': ohneBilder(ohneSynchro),
    'releases.json': lies('releases.json').filter((r) => ids.has(r.titleId)),
    'events.json': lies('events.json').filter((e) => ids.has(e.titleId)),
    'meldungen.json': liesWennDa('meldungen.json', []).filter((m) => ids.has(m.titleId)),
    'franchises.json': { [wurzel]: ohneBilder(lies('franchises.json')[wurzel] ?? []) },
  }
  const fertig = Object.fromEntries(Object.entries(roh).map(([name, daten]) => [name, uebersetzeDatei(name, daten, ak)]))
  return { ...fertig, ...folgenVerzeichnis(ids, ak), ...teildateien(ids, ak) }
}

/** `folgen/index.json` (welche Titel eine Folgenliste haben) und `folgen/zaehlung.json`, auf die Titel des Falls verkleinert. */
function folgenVerzeichnis(ids, ak) {
  const mit = liesWennDa('folgen/index.json', []).filter((id) => ids.has(id))
  const zaehlung = liesWennDa('folgen/zaehlung.json', {})
  const eigene = Object.fromEntries(Object.entries(zaehlung).filter(([id]) => ids.has(Number(id))))
  return {
    'folgen/index.json': uebersetzeDatei('folgen/index.json', mit, ak),
    'folgen/zaehlung.json': uebersetzeDatei('folgen/zaehlung.json', eigene, ak),
  }
}

/** Das Großplakat `cg` (TMDB) fällt weg: Es würde beim Überfahren des Covers eine fremde Adresse laden. */
function ohneGrossbild({ cg: _cg, ...rest }) {
  return rest
}

/** Handlung, Disc, Sprecher und Folgenlisten nach `ak` — die Bühne setzt daraus `synopses/<n>.json` usw. wieder zusammen. */
function teildateien(ids, ak) {
  const synopsen = {}
  const disc = {}
  const sprecher = {}
  const folgen = {}
  for (const id of ids) {
    const s = liesWennDa(`synopses/${gruppe(id)}.json`, {})[id]
    if (s) synopsen[ak(id)] = ohneGrossbild(s)
    const d = liesWennDa(`disc/${gruppe(id)}.json`, {})[id]
    if (d) disc[ak(id)] = d
    const v = liesWennDa(`voices/${id}.json`, undefined)
    if (v) sprecher[ak(id)] = { ...v, ...(typeof v.titleId === 'number' && { titleId: ak(v.titleId) }) }
    const l = liesWennDa(`folgen/${id}.json`, undefined)
    if (l) folgen[ak(id)] = l
  }
  return { synopsen, disc, sprecher, folgen }
}

function main() {
  const { akVon } = ladeAkVon(resolve(WURZEL, 'data/kennungen.json'))
  const faelle = {}
  for (const fall of FAELLE) {
    faelle[fall.slug] = { name: fall.name, titleId: akVon(fall.titel), ...schneide(fall, akVon) }
  }
  const ausgabe = { heute: HEUTE, meta: lies('meta.json'), faelle }
  writeFileSync(ZIEL, `${JSON.stringify(ausgabe)}\n`)
  for (const [slug, f] of Object.entries(faelle)) console.log(`${slug}: ${f['titles.json'].length} Titel, ${f['releases.json'].length} Releases, ${f['events.json'].length} Termine`)
  console.log(`${ZIEL}: ${Math.round(readFileSync(ZIEL).length / 1024)} KB`)
}

main()
