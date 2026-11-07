/**
 * Test für `tools/bau-vergleich-news.mjs`: News-Delta je Titel, auch über `beschreibeDatei` (Verdrahtung).
 * Fälle: unverändert, neue Meldung, weggefallene, geänderte, Einfügung vorn (Stellenvergleich würde verschieben),
 * zwei gleiche Schlüssel am Tag, Kappung, kaputter Text.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { newsDelta } from './bau-vergleich-news.mjs'
import { beschreibeDatei } from './bau-vergleich-stand.mjs'

const gruppe = (titelId, titel, meldungen, am = '2999-01-02') => ({ am, titelId, titel, slug: `t-${titelId}`, meldungen })
const neu = (platform, extra = {}) => ({ art: 'neu', platform, ...extra })
const text = (liste) => JSON.stringify(liste)

const basis = [gruppe(11, 'Alpha', [neu('joyn')]), gruppe(22, 'Beta', [neu('prime', { quelle: 'https://a.example/x' })])]

// Unverändert: keine Zeile.
assert.deepEqual(newsDelta(text(basis), text(basis)), [])

// Einfügung vorn: nur die neue Meldung, die Verschiebung der übrigen zählt nicht.
const vorn = [gruppe(33, 'Gamma', [neu('netflix')]), ...basis]
assert.deepEqual(newsDelta(text(basis), text(vorn)), ['news.json je Titel: 1 neu, 0 weggefallen, 0 geändert', '  + Gamma (33): 2999-01-02 neu netflix'])

// Weggefallen und geändert (anderer Beleg, gleicher Schlüssel) mit verschiedenen Zählern.
const geaendert = [gruppe(22, 'Beta', [neu('prime', { quelle: 'https://b.example/y' })])]
assert.deepEqual(newsDelta(text(basis), text(geaendert)), [
  'news.json je Titel: 0 neu, 1 weggefallen, 1 geändert',
  '  ~ Beta (22): 2999-01-02 neu prime (Inhalt geändert)',
  '  - Alpha (11): 2999-01-02 neu joyn',
])

// Zwei gleiche Schlüssel am selben Tag zählen einzeln.
const doppelt = [gruppe(11, 'Alpha', [neu('joyn'), neu('joyn')])]
assert.deepEqual(newsDelta(text(basis.slice(0, 1)), text(doppelt)), ['news.json je Titel: 1 neu, 0 weggefallen, 0 geändert', '  + Alpha (11): 2999-01-02 neu joyn'])

// Anderer Tag derselben Meldung ist neu und weg.
const andererTag = [gruppe(11, 'Alpha', [neu('joyn')], '2999-01-03'), basis[1]]
assert.equal(newsDelta(text(basis), text(andererTag))[0], 'news.json je Titel: 1 neu, 1 weggefallen, 0 geändert')

// Kappung bei 40 Zeilen.
const viele = Array.from({ length: 45 }, (_, i) => gruppe(1000 + i, `T${i}`, [neu('joyn')]))
const gekappt = newsDelta('[]', text(viele))
assert.equal(gekappt.length, 1 + 40 + 1)
assert.equal(gekappt.at(-1), '  … und 5 weitere')

// Kaputter oder leerer Text: kein Absturz, wie leere Liste.
assert.deepEqual(newsDelta('', text(vorn.slice(0, 1))).length, 2)
assert.deepEqual(newsDelta('{', '{'), [])

// Verdrahtung: beschreibeDatei hängt das Delta nur an news.json an, nicht an andere Dateien.
const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-news-'))
try {
  const seite = (name, liste) => {
    const ordner = path.join(wurzel, name)
    mkdirSync(path.join(ordner, 'public/data'), { recursive: true })
    writeFileSync(path.join(ordner, 'public/data/news.json'), text(liste))
    writeFileSync(path.join(ordner, 'public/data/andere.json'), text(liste))
    return ordner
  }
  const kontext = { git: () => '', basis: 'x', glatt: (s) => s, eigene: new Set() }
  const [a, b] = [seite('a', basis), seite('b', vorn)]
  const news = beschreibeDatei(kontext, a, b, 'public/data/news.json')
  assert.ok(news.includes('  + Gamma (33): 2999-01-02 neu netflix'), news.join('\n'))
  const andere = beschreibeDatei(kontext, a, b, 'public/data/andere.json')
  assert.ok(!andere.some((z) => z.startsWith('news.json je Titel')), 'Delta nur für news.json')
  const gleich = beschreibeDatei(kontext, a, seite('c', basis), 'public/data/news.json')
  assert.ok(!gleich.some((z) => z.startsWith('news.json je Titel')), 'unveränderte Datei ohne Delta')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('bau-vergleich-news: ok (8 Fälle + Verdrahtung)')
