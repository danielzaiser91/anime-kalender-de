// ADN-News-Bilanz: Klassen neu/weg/anders/gleich, Zählzeile, Prozess (Datei und git:<ref> im Wegwerf-Repo). Kein Netz.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bilanz, leseAlt, standAusBeitraegen, zeilenDrucken } from './adn-news-bilanz.ts'
import type { AdnNews, WpPost } from '../pipeline/lib/adn-news.ts'

const AD = 'https://animationdigitalnetwork.com'
const KNOPF = (n: number) => `<a class="wp-block-button__link" href="${AD}/de/video/${n}-x">auf die watchlist</a>`
const SERIE = (n: number) => `<a href="${AD}/de/video/${n}-x">x</a>`
const art = (url: string, datum: string, showIds: number[]) => ({ titel: url, url, datum, showIds })

// Alt: 10 und 20 im Artikel A (beide), 30 in B, 40 in C. Neu: A nur noch 10 (20 weg), 30 in B' (anders), 40 gleich, 50 neu.
const alt: AdnNews = {
  geholtAm: '2026-10-01T00:00:00Z',
  artikel: [art('A', '2026-09-01', [10, 20]), art('B', '2026-09-02', [30]), art('C', '2026-09-03', [40])],
}
const neu: AdnNews = {
  geholtAm: '2026-10-02T00:00:00Z',
  artikel: [art('A', '2026-09-01', [10]), art('B2', '2026-09-05', [30]), art('C', '2026-09-03', [40]), art('D', '2026-09-06', [50])],
}
const zeilen = bilanz(alt, neu)
assert.deepEqual(zeilen.map((z) => `${z.showId}:${z.klasse}`), ['10:gleich', '20:weg', '30:anders', '40:gleich', '50:neu'])
assert.deepEqual(bilanz(null, null), [])
assert.equal(bilanz(alt, alt).every((z) => z.klasse === 'gleich'), true)

const ohneGleich = zeilenDrucken(zeilen, 3, false)
assert.equal(ohneGleich[0], 'ADN-News-Bilanz: 1 neu, 1 weg, 1 anders, 2 gleich; 3 Serienverweise verworfen')
assert.deepEqual(ohneGleich.slice(1), ['weg 20 alt=A neu=-', 'anders 30 alt=B neu=B2', 'neu 50 alt=- neu=D'])
assert.equal(zeilenDrucken(zeilen, 3, true).length, 6)

// Aus rohen Beiträgen: Knopf 1 + Fließtext 2 -> nur 1 (ein Verweis verworfen); französischer Beitrag zählt nicht.
const beitraege: WpPost[] = [
  { link: 'https://n.example/de/a/', date: '2026-10-05T10:00:00', content: { rendered: `${KNOPF(1)}${SERIE(2)}` } },
  { link: 'https://n.example/fr/b/', date: '2026-10-06T10:00:00', content: { rendered: `${KNOPF(3)}${SERIE(4)}` } },
]
const { stand, verworfen } = standAusBeitraegen(beitraege, '2999-12-31T00:00:00Z')
assert.deepEqual(stand.artikel.map((a) => a.showIds), [[1]])
assert.equal(verworfen, 1)

// Prozess gegen ein Wegwerf-Repo: alter Stand liegt nur im ersten Commit (git:HEAD~1), 2 war damals belegt.
const dir = mkdtempSync(join(tmpdir(), 'adn-bilanz-'))
try {
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', timeout: 30_000, windowsHide: true })
  git('init', '-q')
  git('config', 'user.email', 'a@b.c')
  git('config', 'user.name', 'x')
  git('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'data'))
  const alt1: AdnNews = { geholtAm: '2026-10-01T00:00:00Z', artikel: [art('https://n.example/de/a/', '2026-10-05', [1, 2])] }
  writeFileSync(join(dir, 'data', 'adn-news.json'), JSON.stringify(alt1))
  git('add', '.')
  git('commit', '-q', '-m', 'alt')
  writeFileSync(join(dir, 'data', 'adn-news.json'), JSON.stringify({ geholtAm: '2026-10-02T00:00:00Z', artikel: [] }))
  git('commit', '-q', '-am', 'neu')
  assert.deepEqual(leseAlt('git:HEAD~1', dir), alt1)

  writeFileSync(join(dir, 'beitraege.json'), JSON.stringify(beitraege))
  writeFileSync(join(dir, 'alt.json'), JSON.stringify(alt1))
  const skript = fileURLToPath(new URL('./adn-news-bilanz.ts', import.meta.url))
  const lauf = (...a: string[]) =>
    spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), skript, ...a], { cwd: dir, encoding: 'utf8', timeout: 60_000, windowsHide: true })
  const r = lauf(join(dir, 'beitraege.json'), join(dir, 'alt.json'))
  assert.equal(r.status, 0, r.stderr)
  assert.equal(
    r.stdout,
    'ADN-News-Bilanz: 0 neu, 1 weg, 0 anders, 1 gleich; 1 Serienverweise verworfen\nweg 2 alt=https://n.example/de/a/ neu=-\n',
  )
  const g = lauf(join(dir, 'beitraege.json'), 'git:HEAD~1', '--gleich')
  assert.equal(g.status, 0, g.stderr)
  assert.match(g.stdout, /gleich 1 alt=https:\/\/n\.example\/de\/a\/ neu=https:\/\/n\.example\/de\/a\/\n/)
  const falsch = lauf()
  assert.equal(falsch.status, 2)
  assert.match(falsch.stderr, /Aufruf:/)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('adn-news-bilanz.test: neu/weg/anders/gleich, Zählzeile, Prozess mit Datei und git:<ref> ok')
