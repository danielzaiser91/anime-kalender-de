/**
 * Lauf `holeAdnNews` gegen eine Kulisse (AK_ROOT im Wegwerf-Ordner, fetch-Attrappe): die Logzeile zählt die
 * verworfenen Serienverweise (Klammer, Vergleich im Fließtext), nur aus deutschen Beiträgen.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const wurzel = mkdtempSync(join(tmpdir(), 'adn-news-lauf-'))
process.env.AK_ROOT = wurzel

const AD = 'https://animationdigitalnetwork.com'
const KNOPF = (n: number) => `<a class="wp-block-button__link" href="${AD}/de/video/${n}-x">auf die watchlist</a>`
const SERIE = (n: number) => `<a href="${AD}/de/video/${n}-x">x</a>`

const seite1 = [
  { link: 'https://news.example/de/a/', date: '2026-10-01T10:00:00', content: { rendered: `${KNOPF(1)}${SERIE(2)}` } },
  { link: 'https://news.example/de/b/', date: '2026-10-02T10:00:00', content: { rendered: `${KNOPF(3)}(${SERIE(4)})` } },
  { link: 'https://news.example/fr/c/', date: '2026-10-03T10:00:00', content: { rendered: `${KNOPF(5)}${SERIE(6)}` } },
]
let abrufe = 0
globalThis.fetch = (async () => new Response(JSON.stringify(abrufe++ === 0 ? seite1 : []), { status: 200 })) as typeof fetch

const zeilen: string[] = []
const echtesLog = console.log
console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
try {
  const { holeAdnNews } = await import('./lib/adn-news.ts')
  await holeAdnNews(true)
} finally {
  console.log = echtesLog
}

const zeile = zeilen.find((z) => z.includes('Serienverweise verworfen'))
assert.equal(zeile, '[pipeline] ADN-News: 2 Serienverweise verworfen (Klammer/Vergleich im Fließtext) in 2 Artikeln')
const stand = JSON.parse(readFileSync(join(wurzel, 'data', 'adn-news.json'), 'utf8'))
assert.deepEqual(stand.artikel.map((a: { showIds: number[] }) => a.showIds), [[1], [3]])
rmSync(wurzel, { recursive: true, force: true })
console.log('check-adn-news-lauf: Logzeile zählt 2 verworfene Serienverweise aus deutschen Beiträgen')
