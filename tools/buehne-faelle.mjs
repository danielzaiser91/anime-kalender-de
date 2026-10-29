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
 *         node tools/buehne-faelle.mjs --nur <slug>   rechnet nur diesen Fall neu, der Rest der Datei bleibt byteweise gleich
 *         (`--ziel <datei>` schreibt statt nach `web/buehne/faelle.json` in eine andere Datei, für Tests)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ladeAkVon, uebersetzeDatei } from '../pipeline/lib/ausgabe-kennung.ts'
import { namensIndex } from '../pipeline/bau/ohne-synchro-namen.ts'
import { leseOptionen, uebernimmFall } from './buehne-faelle-nur.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const DATEN = resolve(WURZEL, 'public/data')
const ZIEL = resolve(WURZEL, 'web/buehne/faelle.json')

/** Fester Zeitpunkt der Bühne (UTC) — Sonntag, 11.10.2026: Tokyo Revengers Staffel 4 läuft, Folge 3 kommt am 16.10. */
const HEUTE = '2026-10-11T10:00:00Z'
const PLATZHALTER = 'https://platzhalter.invalid/cover/'
const PLATZHALTER_BILDER = 6

/**
 * AniList-Kennung des geöffneten Titels; die Reihe ergibt sich daraus (`franchiseId`). Die Reihen dürfen sich nicht
 * überschneiden: `kachel` und `ganz` zeigen alle Fälle zusammen als Bestand (`faelle.ts`).
 */
const FAELLE = [
  { slug: 'tokyo-revengers', name: 'Tokyo Revengers (neue Staffel)', titel: 178083 },
  { slug: 'attack-on-titan', name: 'Attack on Titan (Staffeln, Filme, Specials)', titel: 110277 },
  { slug: 'one-piece', name: 'One Piece (lang laufend)', titel: 21 },
  { slug: '86', name: '86 (fertig)', titel: 131586 },
  { slug: 'hajime-no-ippo', name: 'Hajime no Ippo (ohne Synchro)', titel: 263 },
  { slug: 'cyberpunk-edgerunners', name: 'Cyberpunk: Edgerunners 2 (Netflix-Eigenproduktion)', titel: 195539 },
  { slug: 'chihiro', name: 'Chihiros Reise ins Zauberland (Film)', titel: 199 },
  { slug: 'golden-kamuy', name: 'Golden Kamuy (angekündigt, ohne Datum)', titel: 210073 },
  /* Disc-Fälle (Mockup `disc-bereich`, 27.10.2026): Termine samt aniSearch-Ausgaben, viele Editionen, genau eine Disc. */
  { slug: 'sakamoto-days', name: 'Sakamoto Days (Netflix, Disc-Termine seit und ab)', titel: 177709 },
  { slug: 'dan-da-dan', name: 'Dan Da Dan (Disc: Editionen, Gesamtausgabe kommend)', titel: 171018 },
  { slug: 'trigun-stampede', name: 'Trigun Stampede (genau eine Disc)', titel: 151040 },
  /* Synchro angekündigt, noch keine deutsche Folge (Streifen und Abzeichen auf der Kachel, F71). */
  { slug: 'black-clover-s2', name: 'Black Clover Staffel 2 (Synchro angekündigt)', titel: 195604 },
]

/**
 * Fernsehtag, Freitag 16.10.2026: die Reihen, die an diesem Tag im Fernsehen und im Streaming stehen (Mockup
 * `relative-uhrzeit`). One Piece (18:25/18:50) und Tokyo Revengers (19:00, geschätzt) sind schon Fälle oben. Ein Fall ist genau
 * eine Reihe, daher einer je Reihe; zusammen mit den übrigen zeigt der Bestand (`alle`) die ganze Woche um den Tag.
 */
const FERNSEHTAG = [
  { slug: 'fernsehtag-yashahime', name: 'Yashahime (TV 16:45)', titel: 118399 },
  { slug: 'fernsehtag-dragon-ball', name: 'Dragon Ball (TV 17:10 und 17:35)', titel: 223 },
  { slug: 'fernsehtag-detektiv-conan', name: 'Detektiv Conan (TV 17:55)', titel: 235 },
  { slug: 'fernsehtag-slime', name: 'Slime Staffel 4 (Crunchyroll 17:00)', titel: 182205 },
  { slug: 'fernsehtag-jojo', name: 'JoJo Steel Ball Run (Netflix, geschätzt)', titel: 190327 },
  { slug: 'fernsehtag-avatar', name: 'Avatar: Die sieben Häfen (Paramount+, ohne Uhrzeit)', titel: -284833 },
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
  return Array.isArray(daten) ? daten.map((t) => eintrag(t, t.id ?? t.titelId)) : daten
}

function reiheVon(titelId) {
  const eigener = [...lies('titles.json'), ...liesWennDa('ohne-synchro.json', [])].find((t) => t.id === titelId)
  /* Ein Termin ohne Titel im Katalog trägt eine negative Kennung (Avatar bei Paramount+): Er ist seine eigene Reihe. */
  if (!eigener && titelId >= 0) throw new Error(`Titel ${titelId} fehlt in titles.json und ohne-synchro.json`)
  const wurzel = eigener?.franchiseId ?? eigener?.id ?? titelId
  const gehoert = (t) => (t.franchiseId ?? t.id) === wurzel
  return { wurzel, gehoert }
}

function schneide(fall, ak) {
  const { wurzel, gehoert } = reiheVon(fall.titel)
  const kern = lies('titles-core.json').filter(gehoert)
  const alle = lies('titles.json').filter(gehoert)
  const ohneSynchro = liesWennDa('ohne-synchro.json', []).filter(gehoert)
  const ids = new Set([...kern, ...alle, ...ohneSynchro].map((t) => t.id))
  if (fall.titel < 0) ids.add(fall.titel)
  const roh = {
    'titles-core.json': ohneBilder(kern),
    'titles.json': ohneBilder(alle),
    'ohne-synchro.json': ohneBilder(ohneSynchro),
    'ohne-synchro-namen.json': namensIndex(ohneSynchro),
    'releases.json': lies('releases.json').filter((r) => ids.has(r.titleId)),
    'events.json': lies('events.json').filter((e) => ids.has(e.titleId)),
    'meldungen.json': liesWennDa('meldungen.json', []).filter((m) => ids.has(m.titleId)),
    'franchises.json': { [wurzel]: ohneBilder(lies('franchises.json')[wurzel] ?? []) },
    'news.json': ohneBilder(lies('news.json').filter((n) => ids.has(n.titelId))),
    'synonyme.json': Object.fromEntries(Object.entries(lies('synonyme.json')).filter(([id]) => ids.has(Number(id)))),
    // Die App fragt cartoons.json ab; der Katalog hat noch keinen Cartoon-Fall.
    'cartoons.json': [],
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

/** Zwei Fälle mit demselben Titel würden im Gesamtbestand doppelt stehen. */
function pruefeKeineUeberschneidung(faelle) {
  const gesehen = new Map()
  for (const [slug, f] of Object.entries(faelle)) {
    for (const t of [...f['titles.json'], ...f['ohne-synchro.json']]) {
      if (gesehen.has(t.id) && gesehen.get(t.id) !== slug) throw new Error(`Titel ${t.id} steht in ${gesehen.get(t.id)} und ${slug}`)
      gesehen.set(t.id, slug)
    }
  }
}

function schneideFall(fall, akVon) {
  return { name: fall.name, titleId: akVon(fall.titel), ...schneide(fall, akVon) }
}

/** Ohne Option: alles neu. Mit `--nur <slug>`: nur dieser Fall, der Rest der Datei bleibt, wie er ist. */
function baueAusgabe(nur, ziel, akVon) {
  const alleFaelle = [...FAELLE, ...FERNSEHTAG]
  if (!nur) {
    const faelle = Object.fromEntries(alleFaelle.map((fall) => [fall.slug, schneideFall(fall, akVon)]))
    return { heute: HEUTE, meta: lies('meta.json'), faelle }
  }
  const fall = alleFaelle.find((f) => f.slug === nur)
  if (!fall) throw new Error(`Unbekannter Fall ${nur}; bekannt: ${alleFaelle.map((f) => f.slug).join(', ')}`)
  if (!existsSync(ziel)) throw new Error(`--nur braucht eine vorhandene faelle.json, ${ziel} fehlt (erst ohne Option erzeugen)`)
  return uebernimmFall(JSON.parse(readFileSync(ziel, 'utf8')), nur, schneideFall(fall, akVon))
}

function main() {
  const { nur, ziel = ZIEL } = leseOptionen(process.argv.slice(2))
  const { akVon } = ladeAkVon(resolve(WURZEL, 'data/kennungen.json'))
  const ausgabe = baueAusgabe(nur, ziel, akVon)
  pruefeKeineUeberschneidung(ausgabe.faelle)
  writeFileSync(ziel, `${JSON.stringify(ausgabe)}\n`)
  for (const [slug, f] of Object.entries(ausgabe.faelle)) {
    if (!nur || slug === nur) console.log(`${slug}: ${f['titles.json'].length} Titel, ${f['releases.json'].length} Releases, ${f['events.json'].length} Termine`)
  }
  console.log(`${ziel}: ${Math.round(readFileSync(ziel).length / 1024)} KB`)
}

try {
  main()
} catch (fehler) {
  console.error(fehler.message)
  process.exitCode = 1
}
