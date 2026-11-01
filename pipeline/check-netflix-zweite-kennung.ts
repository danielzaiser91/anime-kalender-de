/**
 * Zweite Netflix-Kennung als eigenes Prüfziel: `zusaetzlicheNetflixKennungen`, `ergaenzeZweiteKennungen` und der echte
 * Erzeuger `tools/extension-offene-liste.mjs` in einem Wegwerf-Ordner (`AK_ROOT`). Kennungen ab 900001 sind erfunden.
 * Aufruf: npx tsx pipeline/check-netflix-zweite-kennung.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zusaetzlicheNetflixKennungen } from './lib/netflix-zweite-kennung.ts'
import type { QuellenDateien, QuellenTitel } from './lib/netflix-quellen-abweichung.ts'
import { ergaenzeZweiteKennungen, zaehleZusatzZiele } from '../tools/netflix-zweite-kennung.mjs'

const fehler: string[] = []
let faelle = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  faelle++
  if (!ok) fehler.push(`${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const nf = (k: string) => `https://www.netflix.com/title/${k}`
const titel = (id: number, k: string | null, anisearchId?: number): QuellenTitel => ({ id, anisearchId, streams: k ? [{ platform: 'netflix', url: nf(k) }] : [] })
const dateien = (anisearch: Record<string, string[]>, justwatch: Record<string, string[]>): QuellenDateien => ({
  anisearch: Object.fromEntries(Object.entries(anisearch).map(([a, ks]) => [`x${a}`, { anisearchId: Number(a), streams: ks.map((k) => ({ url: nf(k) })) }])),
  justwatch: Object.fromEntries(Object.entries(justwatch).map(([id, ks]) => [id, { angebote: ks.map((k) => ({ url: nf(k) })) }])),
})
const zusatz = (t: QuellenTitel[], d: QuellenDateien) => Object.fromEntries(zusaetzlicheNetflixKennungen(t, d))

/* Rechenregel: eine Kennung eins, zwei Kennungen zwei Ziele, dieselbe fremde Kennung doppelt genannt ein Ziel. */
pruefe('eine Kennung in allen Quellen: kein Zusatz', Object.keys(zusatz([titel(1, '900001', 11)], dateien({ 11: ['900001'] }, { 1: ['900001'] }))).length === 0)
pruefe('aniSearch nennt eine zweite: ein Zusatz', JSON.stringify(zusatz([titel(2, '900001', 12)], dateien({ 12: ['900002'] }, {}))) === '{"2":["900002"]}')
pruefe('JustWatch nennt eine zweite: ein Zusatz', JSON.stringify(zusatz([titel(3, '900001', 13)], dateien({}, { 3: ['900003'] }))) === '{"3":["900003"]}')
pruefe(
  'dieselbe fremde Kennung aus zwei Quellen zählt einmal',
  JSON.stringify(zusatz([titel(4, '900001', 14)], dateien({ 14: ['900002'] }, { 4: ['900002', '900002'] }))) === '{"4":["900002"]}',
)
pruefe(
  'zwei verschiedene fremde Kennungen: zwei Zusätze, sortiert',
  JSON.stringify(zusatz([titel(5, '900001', 15)], dateien({ 15: ['900009'] }, { 5: ['900002'] }))) === '{"5":["900002","900009"]}',
)
pruefe('Titel ohne eigenen Netflix-Verweis bekommt keinen Zusatz', Object.keys(zusatz([titel(6, null, 16)], dateien({ 16: ['900001'] }, { 6: ['900002'] }))).length === 0)
pruefe('Umleitung (Ranma) ist keine zweite Kennung', Object.keys(zusatz([titel(7, '81171925', 17)], dateien({ 17: ['81301833'] }, {}))).length === 0)
pruefe('Umleitung Arrietty (aniSearch) ist keine zweite Kennung', Object.keys(zusatz([titel(9, '70216227', 19)], dateien({ 19: ['81253522'] }, {}))).length === 0)
pruefe('Umleitung Chihiro (JustWatch) ist keine zweite Kennung', Object.keys(zusatz([titel(10, '60023642', 20)], dateien({}, { 10: ['81253489'] }))).length === 0)
pruefe('Umleitung Nausicaä im Datensatz, Ziel bei aniSearch: gleiche Kennung', Object.keys(zusatz([titel(11, '81234986', 21)], dateien({ 21: ['70019062'] }, {}))).length === 0)
pruefe('Umleitung plus echte zweite Seite: nur die echte bleibt', JSON.stringify(zusatz([titel(12, '70216227', 22)], dateien({ 22: ['81253522', '81050090'] }, {}))) === '{"12":["81050090"]}')
const zweiEigene: QuellenTitel = { id: 8, anisearchId: 18, streams: [{ platform: 'netflix', url: nf('900001') }, { platform: 'netflix', url: nf('900002') }] }
pruefe('zwei Kennungen im Datensatz, keine fremde: kein Eintrag', zusatz([zweiEigene], dateien({ 18: ['900001'] }, {})).hasOwnProperty('8') === false, zusatz([zweiEigene], dateien({ 18: ['900001'] }, {})))

/* Einhängen in die Liste: gleiche Kennung doppelt eingetragen ergibt einen Eintrag, ein Fremdtitel bleibt unberührt. */
const eintrag = (id: number) => ({ t: { id }, dub: undefined, wartet: false })
const karte = () => new Map<string, { t: { id: number } }[]>([['900001', [eintrag(1)]], ['900005', [eintrag(9)]]])
const k1 = karte()
pruefe('Einhängen: ein neuer Eintrag', ergaenzeZweiteKennungen(k1, new Map([[1, ['900002']]])) === 1 && k1.get('900002')?.length === 1, [...k1.keys()])
const k2 = karte()
ergaenzeZweiteKennungen(k2, new Map([[1, ['900002']]]))
pruefe('Einhängen zweimal: weiterhin ein Eintrag', ergaenzeZweiteKennungen(k2, new Map([[1, ['900002']]])) === 0 && k2.get('900002')?.length === 1)
const k3 = karte()
pruefe('bereits geführte Kennung des Titels: nichts Neues', ergaenzeZweiteKennungen(k3, new Map([[1, ['900001']]])) === 0 && k3.get('900001')?.length === 1)
const k4 = karte()
ergaenzeZweiteKennungen(k4, new Map([[1, ['900005']]]))
pruefe('geteilte Seite: beide Titel an einer Kennung', k4.get('900005')?.map((e) => (e as { t: { id: number } }).t.id).join() === '9,1', [...k4.entries()])
pruefe('Titel ohne eigenen Eintrag: übersprungen', ergaenzeZweiteKennungen(karte(), new Map([[77, ['900002']]])) === 0)
const stand = { gesamt: 100, gemeldet: 60 }
const zahl = zaehleZusatzZiele(stand, new Map([[1, ['a', 'b']], [2, ['c']]]))
pruefe('Prüfstand: jede Zusatzkennung zählt zu Gesamt und Gemeldet', zahl === 3 && stand.gesamt === 103 && stand.gemeldet === 63, stand)

/* Echter Erzeuger in einem Wegwerf-Ordner. */
const stream = (k: string) => ({ platform: 'netflix', url: nf(k) })
const basis = { format: 'TV', episodes: 12, jpYear: 2015, jpSeason: 'SPRING' }
const TITEL = [
  { ...basis, id: 11, titleDe: 'Doppelt', anisearchId: 5011, streams: [stream('900001')] },
  { ...basis, id: 12, titleDe: 'Einfach', anisearchId: 5012, streams: [stream('900010')] },
  { ...basis, id: 13, titleDe: 'Gleiche zweite', anisearchId: 5013, streams: [stream('900020')] },
  { ...basis, id: 14, titleDe: 'Fremd', anisearchId: 5014, streams: [stream('900030')] },
  { ...basis, id: 15, titleDe: 'Nur JustWatch', anisearchId: 5015, streams: [stream('900050')] },
]
const ANISEARCH = {
  a: { anisearchId: 5011, streams: [{ url: nf('900001') }, { url: nf('900002') }] },
  b: { anisearchId: 5012, streams: [{ url: nf('900010') }] },
  c: { anisearchId: 5013, streams: [{ url: nf('900021') }] },
  d: { anisearchId: 5014, streams: [{ url: nf('900030') }] },
  e: { anisearchId: 5015, streams: [{ url: nf('900050') }] },
}
const JUSTWATCH = {
  13: { angebote: [{ url: nf('900021') }, { url: nf('900021') }] },
  14: { angebote: [{ url: nf('900030') }] },
  15: { angebote: [{ url: nf('900051') }] },
  '-5': { angebote: [{ url: nf('900041') }] },
}
const CARTOON = { ...basis, id: -5, titleDe: 'Cartoon', streams: [stream('900040')] }
function schreibe(wurzel: string, pfad: string, inhalt: unknown) {
  mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
  writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
}
const wurzel = mkdtempSync(join(tmpdir(), 'zweite-kennung-'))
try {
  schreibe(wurzel, 'public/data/titles.json', TITEL)
  schreibe(wurzel, 'public/data/cartoons.json', [CARTOON])
  schreibe(wurzel, 'public/data/releases.json', [])
  schreibe(wurzel, 'data/anbieter-staffeln.json', {})
  schreibe(wurzel, 'data/link-check.json', {})
  schreibe(wurzel, join('data', 'pruefliste-regeln.json'), { erweitert: true })
  schreibe(wurzel, 'data/anisearch.json', ANISEARCH)
  schreibe(wurzel, 'data/justwatch-audio.json', JUSTWATCH)
  mkdirSync(join(wurzel, 'extension'), { recursive: true })
  writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), '[]\n')
  const skript = fileURLToPath(new URL('../tools/extension-offene-liste.mjs', import.meta.url))
  const lauf = spawnSync(process.execPath, [skript], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8' })
  pruefe('Erzeuger endet mit Exit 0', lauf.status === 0 && /Netflix-Adressen/.test(lauf.stdout), { status: lauf.status, stderr: lauf.stderr.slice(0, 300) })
  const liste = JSON.parse(readFileSync(join(wurzel, 'extension/offene-netflix.js'), 'utf8').replace(/^[^{]*=\s*/, '')) as Record<string, { asTitel: number }>
  pruefe('Titel mit zwei Kennungen: zwei Ziele, beide für Titel 11', liste['900001']?.asTitel === 11 && liste['900002']?.asTitel === 11, Object.keys(liste))
  pruefe('Titel mit einer Kennung: ein Ziel', liste['900010']?.asTitel === 12 && Object.keys(liste).length === 9, Object.keys(liste))
  pruefe('fremde Kennung aus zwei Quellen: ein zusätzliches Ziel', liste['900020']?.asTitel === 13 && liste['900021']?.asTitel === 13, Object.keys(liste))
  pruefe('alle Quellen einig: kein Zusatz für Titel 14', liste['900030']?.asTitel === 14)
  pruefe('nur JustWatch nennt die zweite: ein zusätzliches Ziel', liste['900051']?.asTitel === 15, Object.keys(liste))
  pruefe('Cartoon: eigene Kennung geführt, JustWatch-Kennung nicht als Zusatz', liste['900040']?.asTitel === -5 && !('900041' in liste), Object.keys(liste))
  /* Prüfstand im selben Ordner: neun Ziele (sechs Verweise, drei Zusätze), alle offen und alle im Gesamt. */
  const stand = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/pruefstand.mjs', import.meta.url))], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8' })
  pruefe('Prüfstand endet mit Exit 0', stand.status === 0, { status: stand.status, stderr: stand.stderr.slice(0, 300) })
  const netflix = JSON.parse(readFileSync(join(wurzel, 'public/data/pruefstand.json'), 'utf8')).anbieter.find((a: { plattform: string }) => a.plattform === 'netflix')
  pruefe('Prüfstand: neun Ziele, Gesamt 9 (6 Verweise, 3 Zusätze)', netflix?.ziele.length === 9 && netflix.gesamt === 9 && netflix.offen === 9, netflix)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.log(`  ✖ Netflix zweite Kennung: ${fehler.length} Fehler`)
  for (const f of fehler) console.log(`    - ${f}`)
  process.exit(1)
}
console.log(`  ✓ Netflix zweite Kennung: ${faelle} Fälle grün (Rechenregel, Einhängen, Erzeuger im Wegwerf-Ordner)`)
