// Zusicherung: Jede aniSearch-Amazon-Adresse kommt in die Prüfschlange von check-links, auch bei Titeln ohne Prime-Such-Stream (Ragna Crimson, 12.11.2026); Vorrang nur bei Prime-Suche.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { aniSearchAmazon } from '../pipeline/lib/anisearch-amazon-adressen.ts'

const RAGNA = 'https://www.amazon.de/dp/B0F1XK58VQ'
const SUCHE = 'https://www.amazon.de/s?k=Fremd'
const FREMD = 'https://www.amazon.de/gp/video/detail/B0FREMD001'
const anisearch = {
  '146493': { streams: [{ url: RAGNA + '?tag=x' }, { url: 'https://www.netflix.com/title/1' }, { url: SUCHE }] },
  '5': { streams: [{ url: FREMD }] },
}

/* --- Funktion: Titel ohne Stream (Prime-Handbeleg) bekommt die Adresse, aber keinen Vorrang --- */
const ohne = aniSearchAmazon([{ id: 146493, streams: [] }], anisearch)
assert.deepEqual([...ohne.alle], [RAGNA], 'ohne Prime-Such-Stream: Adresse (ohne ?tag) in der Schlange, nur Amazon-Videoadressen')
assert.equal(ohne.vorrang.size, 0, 'ohne Prime-Such-Stream: kein Vorrang')
/* --- mit Prime-Suche: Vorrang; anderer Prime-Stream (keine Suche): kein Vorrang --- */
const sucht = aniSearchAmazon([{ id: 5, streams: [{ platform: 'primevideo', url: SUCHE }] }], anisearch)
assert.deepEqual([...sucht.vorrang], [FREMD], 'Prime-Suche: Vorrang')
const anderer = aniSearchAmazon([{ id: 5, streams: [{ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0X' }] }], anisearch)
assert.deepEqual([...anderer.alle], [FREMD], 'anderer Prime-Stream: Adresse in der Schlange')
assert.equal(anderer.vorrang.size, 0, 'anderer Prime-Stream: kein Vorrang')
assert.equal(aniSearchAmazon([{ id: 999, streams: [] }], anisearch).alle.size, 0, 'Titel ohne aniSearch-Eintrag: nichts')

/* --- Echter Lauf: check-links ruft die Adresse ab (Fetch-Attrappe 404) und bucht den Befund --- */
const wurzel = resolve(import.meta.dirname, '..')
const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'link-anisearch-amazon-'))
mkdirSync(join(tmp, 'public', 'data'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })
writeFileSync(join(tmp, 'public', 'data', 'titles.json'), JSON.stringify([{ id: 146493, streams: [] }]))
writeFileSync(join(tmp, 'data', 'anisearch.json'), JSON.stringify(anisearch))
const stub = join(tmp, 'fetch-stub.mjs')
writeFileSync(stub, 'globalThis.fetch = async () => new Response("", { status: 404 })')
const r = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(wurzel, 'node_modules/tsx/dist/esm/index.mjs')).href, '--import', pathToFileURL(stub).href, join(wurzel, 'pipeline/check-links.ts'), '--pause', '1', '--sperrpause', '1'],
  { cwd: tmp, env: { ...process.env, AK_ROOT: tmp }, windowsHide: true, encoding: 'utf8', timeout: 60000 },
)
assert.equal(r.status, 0, `Lauf endet mit 0:\n${r.stdout}${r.stderr}`)
const bestand = JSON.parse(readFileSync(join(tmp, 'data', 'link-check.json'), 'utf8')) as Record<string, { status: number }>
rmSync(tmp, { recursive: true, force: true })
assert.equal(bestand[RAGNA]?.status, 404, `Lauf: tote Seite als 404 festgehalten:\n${r.stdout}`)
assert.equal(bestand[FREMD], undefined, 'Lauf: Adresse eines Titels, der nicht im Datensatz steht, bleibt draußen')
console.log('link-anisearch-amazon: aniSearch-Amazon-Adresse ohne Prime-Such-Stream in der Schlange, Vorrang nur bei Suche, Lauf bucht 404: ok')
