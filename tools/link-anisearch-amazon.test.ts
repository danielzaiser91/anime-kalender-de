// Zusicherung: Jede aniSearch-Amazon-Adresse kommt in die Prüfschlange von check-links, auch bei Titeln ohne Prime-Such-Stream (Ragna Crimson, 12.11.2026) — je ASIN einmal (Stream gp/video/detail und aniSearch dp sind dieselbe Seite), höchstens 40 neue je Lauf, Altfällige behalten ihre Plätze; Vorrang nur bei Prime-Suche.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { aniSearchAmazon, begrenzeZusatz } from '../pipeline/lib/anisearch-amazon-adressen.ts'
import { waehleArbeit } from '../pipeline/lib/link-check-gesundheit.ts'

const RAGNA = 'https://www.amazon.de/dp/B0F1XK58VQ'
const SUCHE = 'https://www.amazon.de/s?k=Fremd'
const FREMD = 'https://www.amazon.de/gp/video/detail/B0FREMD001'
const anisearch = {
  '146493': { streams: [{ url: RAGNA + '?tag=x' }, { url: 'https://www.netflix.com/title/1' }, { url: SUCHE }] },
  '5': { streams: [{ url: FREMD }] },
  '6': { streams: [{ url: FREMD }] },
}

/* --- Funktion: Titel ohne Stream (Prime-Handbeleg) bekommt die Adresse, aber keinen Vorrang --- */
const ohne = aniSearchAmazon([{ id: 146493, streams: [] }], anisearch)
assert.deepEqual([...ohne.zusatz], [RAGNA], 'ohne Prime-Such-Stream: Adresse (ohne ?tag) als Zusatz, nur Amazon-Videoadressen')
assert.equal(ohne.vorrang.size, 0, 'ohne Prime-Such-Stream: kein Vorrang')
/* --- mit Prime-Suche: Vorrang; anderer Prime-Stream (keine Suche): kein Vorrang --- */
const sucht = aniSearchAmazon([{ id: 5, streams: [{ platform: 'primevideo', url: SUCHE }] }], anisearch)
assert.deepEqual([...sucht.vorrang], [FREMD], 'Prime-Suche: Vorrang')
assert.equal(sucht.zusatz.size, 0, 'Prime-Suche: Adresse steht nur im Vorrang')
const anderer = aniSearchAmazon([{ id: 5, streams: [{ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0X' }] }], anisearch)
assert.deepEqual([...anderer.zusatz], [FREMD], 'anderer Prime-Stream: Adresse als Zusatz')
assert.equal(anderer.vorrang.size, 0, 'anderer Prime-Stream: kein Vorrang')
assert.equal(aniSearchAmazon([{ id: 999, streams: [] }], anisearch).zusatz.size, 0, 'Titel ohne aniSearch-Eintrag: nichts')
/* Dieselbe Adresse bei einem Titel mit Suche (Vorrang) und einem ohne: Vorrang gewinnt, kein Zusatz. */
const beide = aniSearchAmazon([{ id: 5, streams: [{ platform: 'primevideo', url: SUCHE }] }, { id: 6, streams: [] }], anisearch)
assert.deepEqual([[...beide.vorrang], [...beide.zusatz]], [[FREMD], []], 'Vorrang und Zusatz überschneiden sich nicht')

/* --- A3: dieselbe Seite unter anderer Form ist schon in der Schlange: genau eine Adresse --- */
const STREAM_GP = 'https://www.amazon.de/gp/video/detail/B0F1XK58VQ'
const ragnaTitel = [{ id: 146493, streams: [] }]
assert.equal(aniSearchAmazon(ragnaTitel, anisearch, new Set([STREAM_GP])).zusatz.size, 0, 'Stream gp/video/detail/X, aniSearch dp/X: nur die Stream-Adresse')
assert.equal(aniSearchAmazon(ragnaTitel, anisearch, new Set([RAGNA])).zusatz.size, 0, 'dieselbe dp-Adresse schon bekannt: nichts doppelt')
assert.deepEqual([...aniSearchAmazon(ragnaTitel, anisearch, new Set([STREAM_GP.replace('B0F1XK58VQ', 'B0F1XK58VR')])).zusatz], [RAGNA], 'andere ASIN: Adresse bleibt')
const zweiFormen = { '1': { streams: [{ url: 'https://www.amazon.de/dp/B0DEDUP002' }] }, '2': { streams: [{ url: 'https://www.amazon.de/gp/video/detail/B0DEDUP002' }] } }
assert.equal(aniSearchAmazon([{ id: 1, streams: [] }, { id: 2, streams: [] }], zweiFormen).zusatz.size, 1, 'zwei aniSearch-Formen derselben ASIN: eine Adresse')

/* --- A2: 100 neue und 50 altfällige Adressen, Platz für 90: Altfällige bleiben vollständig --- */
const alt = Array.from({ length: 50 }, (_, i) => `https://www.amazon.de/gp/video/detail/B0ALT${String(i).padStart(5, '0')}`)
const neu = new Set(Array.from({ length: 100 }, (_, i) => `https://www.amazon.de/dp/B0NEU${String(i).padStart(5, '0')}`))
const jahr = (u: string) => `2026-0${1 + (alt.indexOf(u) % 9)}-01`
const offen = [...neu, ...alt]
const ohneRiegel = waehleArbeit(offen, (u) => (alt.includes(u) ? jahr(u) : undefined), new Set(), 90)
assert.equal(ohneRiegel.filter((u) => alt.includes(u)).length, 0, 'Kontrolle ohne Riegel: neue Adressen (geprueftAm leer) verdrängen alle Altfälligen')
const mitRiegel = waehleArbeit(begrenzeZusatz(offen, neu, 40), (u) => (alt.includes(u) ? jahr(u) : undefined), new Set(), 90)
assert.equal(mitRiegel.filter((u) => alt.includes(u)).length, 50, 'mit Riegel: alle 50 Altfälligen im Lauf')
assert.equal(mitRiegel.filter((u) => neu.has(u)).length, 40, 'mit Riegel: genau 40 neue')
assert.deepEqual(begrenzeZusatz(['a', 'z1', 'b', 'z2', 'z3'], new Set(['z1', 'z2', 'z3']), 1), ['a', 'z1', 'b'], 'Riegel 1: erste Zusatzadresse bleibt, Rest und Reihenfolge der anderen unverändert')

/* --- Echter Lauf: check-links ruft die Adresse ab (Fetch-Attrappe 404), bucht den Befund, entdoppelt und begrenzt --- */
const wurzel = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'link-anisearch-amazon-'))
mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })
const kappen = Array.from({ length: 45 }, (_, i) => ({ id: 200 + i, asin: `B0CAP${String(i).padStart(5, '0')}` }))
const lauf = {
  ...anisearch,
  '7': { streams: [{ url: 'https://www.amazon.de/dp/B0DEDUP001' }] },
  ...Object.fromEntries(kappen.map((k) => [String(k.id), { streams: [{ url: `https://www.amazon.de/dp/${k.asin}` }] }])),
}
const titelListe = [
  { id: 146493, streams: [] },
  { id: 7, streams: [{ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0DEDUP001' }] },
  ...kappen.map((k) => ({ id: k.id, streams: [] })),
]
writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify(titelListe))
writeFileSync(join(tmp, 'data', 'anisearch.json'), JSON.stringify(lauf))
const aufrufe = join(tmp, 'aufrufe.txt')
const stub = join(tmp, 'fetch-stub.mjs')
writeFileSync(
  stub,
  'import { appendFileSync } from "node:fs"\nglobalThis.fetch = async (u) => { appendFileSync(process.env.AUFRUFE, String(u) + "\\n"); return new Response("", { status: 404 }) }',
)
const r = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '1'],
  { cwd: tmp, env: { ...process.env, AK_ROOT: tmp, AUFRUFE: aufrufe }, windowsHide: true, encoding: 'utf8', timeout: 60000 },
)
assert.equal(r.status, 0, `Lauf endet mit 0:\n${r.stdout}${r.stderr}`)
const bestand = JSON.parse(readFileSync(join(tmp, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: number }>
const abrufe = readFileSync(aufrufe, 'utf8').split('\n').filter(Boolean)
rmSync(tmp, { recursive: true, force: true })
assert.equal(bestand[RAGNA]?.status, 404, `Lauf: tote Seite als 404 festgehalten:\n${r.stdout}`)
assert.equal(bestand[FREMD], undefined, 'Lauf: Adresse eines Titels, der nicht im Datensatz steht, bleibt draußen')
assert.equal(abrufe.filter((u) => u.includes('B0DEDUP001') && u.includes('/gp/video/detail/')).length, 1, 'Lauf: Stream-Adresse einmal abgerufen')
assert.equal(abrufe.filter((u) => u.includes('/dp/B0DEDUP001')).length, 0, 'Lauf: dieselbe ASIN als aniSearch-dp nicht noch einmal')
const neueDp = new Set(abrufe.filter((u) => u.includes('/dp/')))
assert.equal(neueDp.size, 40, `Lauf: 46 neue aniSearch-Adressen, 40 davon abgerufen (${neueDp.size})`)
console.log('link-anisearch-amazon: aniSearch-Amazon-Adresse ohne Prime-Such-Stream in der Schlange, je ASIN einmal, 40 neue je Lauf, Altfällige bleiben, Vorrang nur bei Suche, Lauf bucht 404: ok')
