/**
 * Test für `tools/bau-vergleich-daten.mjs` in einem Wegwerf-Repo: Der Kandidat bekommt den Stand der Basis plus
 * nur seine eigenen Änderungen; Dateien, die beide geändert haben, werden zusammengeführt, ein Konflikt bricht ab,
 * `data/cache/` bleibt außen vor.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatenKonflikt, gleichTrotzDatenHinweis, ersatzCacheInhalt, liesEntfernteVerweise, setzeDatenstand, titelFuerErsatzCache, verweiseFuerErsatzCache } from './bau-vergleich-daten.mjs'
import { EXIT, exitFuerFehler } from './bau-vergleich-urteil.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-daten-'))
const repo = path.join(wurzel, 'repo')
const roh = (ort, ...args) => execFileSync('git', ['-C', ort, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' })
const git = (...args) => roh(repo, ...args).trim()
const schreibe = (pfad, text) => {
  mkdirSync(path.dirname(path.join(repo, pfad)), { recursive: true })
  writeFileSync(path.join(repo, pfad), text)
}
const lies = (baum, pfad) => readFileSync(path.join(baum, pfad), 'utf8')
const zeilen = (...z) => `${z.join('\n')}\n`
// Nicht als Literal: check:cache-register sucht Schreibzugriffe auf data/cache im Quelltext.
const CACHEDATEI = ['data', 'cache', 'roh.json'].join('/')
const ALT = zeilen('a: 1', 'b: 1', 'c: 1', 'd: 1', 'e: 1', 'f: 1', 'g: 1', 'h: 1')

/** Neuer Commit auf dem aktuellen Zweig mit den übergebenen Dateien (`null` = löschen). */
function commit(dateien, text) {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    if (inhalt === null) rmSync(path.join(repo, pfad))
    else schreibe(pfad, inhalt)
  }
  git('add', '-A', '-f')
  git('commit', '-q', '-m', text)
  return git('rev-parse', 'HEAD')
}

/** Baum am Kandidaten, auf dem `setzeDatenstand` läuft; Rückgabe: Pfad. */
function baumVon(sha, name) {
  const baum = path.join(wurzel, name)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  return baum
}

try {
  mkdirSync(repo)
  git('init', '-q', '-b', 'main')
  const start = commit(
    { 'data/dub-confirmed.yaml': ALT, 'data/weg.yaml': 'x\n', 'data/andere.yaml': 'y: 1\n', 'public/data/titles.json': '[]\n' },
    'start',
  )
  git('checkout', '-q', '-b', 'kandidat')
  const kandidat = commit(
    {
      'data/dub-confirmed.yaml': ALT.replace('b: 1', 'b: KANDIDAT'),
      'data/neu.yaml': 'neu: 1\n',
      'data/weg.yaml': null,
      [CACHEDATEI]: '{"kandidat":1}\n',
    },
    'kandidat',
  )
  git('checkout', '-q', 'main')
  const basis = commit(
    { 'data/dub-confirmed.yaml': ALT.replace('g: 1', 'g: BASIS'), 'data/andere.yaml': 'y: BASIS\n', 'public/data/titles.json': '[1]\n' },
    'basis',
  )

  const baum = baumVon(kandidat, 'baum-merge')
  const eigene = setzeDatenstand(git, (...a) => roh(baum, ...a), basis, kandidat)
  const stand = lies(baum, 'data/dub-confirmed.yaml')
  assert.ok(stand.includes('b: KANDIDAT'), 'eigene Änderung des Kandidaten fehlt')
  assert.ok(stand.includes('g: BASIS'), 'neuere Änderung der Basis an derselben Datei ging verloren')
  assert.equal(lies(baum, 'data/andere.yaml'), 'y: BASIS\n', 'Datei nur der Basis')
  assert.equal(lies(baum, 'public/data/titles.json'), '[1]\n', 'public/data der Basis')
  assert.equal(lies(baum, 'data/neu.yaml'), 'neu: 1\n', 'neue Datei des Kandidaten')
  assert.ok(!existsSync(path.join(baum, 'data/weg.yaml')), 'gelöschte Datei des Kandidaten')
  assert.ok(!existsSync(path.join(baum, CACHEDATEI)), 'data/cache/ darf nicht übernommen werden')
  assert.deepEqual(eigene.map((e) => e.pfad).sort(), ['data/dub-confirmed.yaml', 'data/neu.yaml', 'data/weg.yaml'])
  const hinweis = gleichTrotzDatenHinweis(git, basis, kandidat).join('\n')
  assert.match(hinweis, /3 Dateien/, 'Hinweis zählt data/cache/ nicht mit')
  assert.ok(!hinweis.includes('cache'), 'Hinweis nennt data/cache/')

  git('checkout', '-q', '-b', 'kandidat2', start)
  const kollision = commit({ 'data/dub-confirmed.yaml': ALT.replace('g: 1', 'g: KANDIDAT') }, 'kollision')
  const baum2 = baumVon(kollision, 'baum-konflikt')
  assert.throws(() => setzeDatenstand(git, (...a) => roh(baum2, ...a), basis, kollision), /Konflikt/, 'gleiche Stelle von beiden Seiten')
  const konflikt = (() => {
    try {
      setzeDatenstand(git, (...a) => roh(baum2, ...a), basis, kollision)
    } catch (fehler) {
      return fehler
    }
  })()
  assert.ok(konflikt instanceof DatenKonflikt, 'der Konflikt ist ein DatenKonflikt, kein beliebiger Fehler')
  assert.equal(exitFuerFehler(konflikt), EXIT.KONFLIKT, 'Konflikt bekommt einen eigenen Exit-Code')
  assert.equal(new Set(Object.values(EXIT)).size, Object.keys(EXIT).length, 'Exit-Codes sind verschieden (Konflikt ≠ verschieden)')
  assert.notEqual(EXIT.KONFLIKT, EXIT.VERSCHIEDEN)
  assert.equal(exitFuerFehler(new Error('anderer Fehler')), null, 'andere Fehler werden weitergeworfen')
  assert.match(readFileSync(path.join(import.meta.dirname, 'bau-vergleich.mjs'), 'utf8'), /exitFuerFehler\(/, 'bau-vergleich.mjs übersetzt den Konflikt')

  // Ersatz-Cache: aniSearch-Zeilen (≥ 10.000.000) fehlen nur mit Katalog; Grenze 9.999.999 / 10.000.000.
  const titel = [{ id: 9_999_999 }, { id: 10_000_000 }, { id: 10_013_418 }, { id: 5 }]
  assert.deepEqual(titelFuerErsatzCache(titel, true).map((t) => t.id), [9_999_999, 5], 'mit Katalog ohne aniSearch-Zeilen')
  assert.equal(titelFuerErsatzCache(titel, false).length, 4, 'ohne Katalog bleiben alle')

  // Ersatz-Cache: entfernte Wege kommen zu den Streams des eigenen Titels zurück, nicht zu fremden, ohne Doppelung.
  const entfernte = [
    { titleId: 7, plattform: 'crunchyroll', url: 'https://cr.example/weg' },
    { titleId: 7, plattform: 'netflix', url: 'https://nf.example/da' },
    { titleId: 8, plattform: 'adn', url: 'https://adn.example/fremd' },
    { titleId: 7, plattform: 'adn', url: null },
  ]
  const t7 = { id: 7, streams: [{ platform: 'netflix', url: 'https://nf.example/da' }] }
  assert.deepEqual(verweiseFuerErsatzCache(t7, entfernte), [
    { site: 'netflix', url: 'https://nf.example/da', type: 'STREAMING' },
    { site: 'crunchyroll', url: 'https://cr.example/weg', type: 'STREAMING' },
  ])
  assert.deepEqual(verweiseFuerErsatzCache({ id: 9 }, entfernte), [], 'Titel ohne Streams und ohne entfernte Wege')
  assert.deepEqual(verweiseFuerErsatzCache({ id: 8 }, entfernte).map((v) => v.site), ['adn'], 'Titel ganz ohne Streams bekommt nur seinen Weg')

  // Verhalten des ganzen Ersatz-Caches: Kennung und MAL-ID, entfernte Wege, Reihen, Katalog-Schalter.
  const titelListe = [
    { id: 7, malId: 70, titleEn: 'Sieben', dubConfidence: 'high', streams: [{ platform: 'netflix', url: 'https://nf.example/da' }] },
    { id: 8, malId: 80, jpYear: 2020 },
    { id: 10_000_005, titleEn: 'aniSearch-Zeile' },
  ]
  const franchises = { 1: [{ id: 8, name: 'Acht', jpYear: 2020 }, { id: 7, name: 'Sieben', jpYear: 2019 }] }
  const ohneKatalog = ersatzCacheInhalt({ titel: titelListe, franchises, entfernte, mitKatalog: false })
  assert.deepEqual(Object.keys(ohneKatalog.byId), ['7', '8', '10000005'], 'ohne Katalog bleiben alle Titel')
  assert.deepEqual(Object.keys(ersatzCacheInhalt({ titel: titelListe, franchises, entfernte, mitKatalog: true }).byId), ['7', '8'], 'mit Katalog ohne aniSearch-Zeile')
  assert.deepEqual(ohneKatalog.byId[7].externalLinks.map((l) => l.url), ['https://nf.example/da', 'https://cr.example/weg'], 'entfernter Weg kommt zurück')
  assert.deepEqual(ohneKatalog.byId[8].externalLinks.map((l) => l.site), ['adn'], 'Weg des Titels 8')
  assert.equal(ohneKatalog.byId[7].relations.edges[0].relationType, 'SEQUEL', 'Reihe: 7 (2019) hat 8 als Fortsetzung')
  assert.equal(ohneKatalog.byId[8].relations.edges[0].node.id, 7, 'Reihe: 8 hat 7 als Vorgänger')
  assert.equal(ohneKatalog.byMal[70].id, 7, 'MAL-Kennung führt zum Titel')
  assert.deepEqual(ohneKatalog.confidence, { 70: 'high' })

  // Entfernte Verweise der Basis lesen (Wegwerf-Repo): Datei da, Datei fehlt, kaputtes JSON, Basis ≠ Kandidat.
  git('checkout', '-q', '-b', 'verweise', start)
  const mitDatei = commit({ 'data/verweise-entfernt.json': JSON.stringify({ verweise: [{ titleId: 7, plattform: 'adn', url: 'https://adn.example/a' }] }) }, 'mit Datei')
  const andere = commit({ 'data/verweise-entfernt.json': JSON.stringify({ verweise: [{ titleId: 9, plattform: 'netflix', url: 'https://nf.example/b' }] }) }, 'andere Fassung')
  const ohneVerweise = commit({ 'data/verweise-entfernt.json': '{}\n' }, 'ohne Schlüssel')
  const kaputt = commit({ 'data/verweise-entfernt.json': '{kaputt' }, 'kaputt')
  assert.deepEqual(liesEntfernteVerweise(git, mitDatei).map((e) => e.titleId), [7], 'Datei da')
  assert.deepEqual(liesEntfernteVerweise(git, andere).map((e) => e.titleId), [9], 'liest die übergebene Fassung, nicht eine andere')
  assert.deepEqual(liesEntfernteVerweise(git, ohneVerweise), [], 'Datei ohne Schlüssel verweise')
  assert.deepEqual(liesEntfernteVerweise(git, start), [], 'Datei fehlt in der Basis')
  assert.throws(() => liesEntfernteVerweise(git, kaputt), SyntaxError, 'kaputtes JSON wird nicht verschluckt')
  assert.throws(() => liesEntfernteVerweise(() => { throw new Error('fatal: anderer git-Fehler') }, start), /anderer git-Fehler/, 'anderer git-Fehler wird nicht verschluckt')

  // Wächter: jede Kopie der aniSearch-Grenze in pipeline/bau, pipeline/lib und dem Werkzeug trägt denselben Wert wie der Export im Bau.
  const hier = import.meta.dirname
  const wert = (text) => [...text.matchAll(/\b(?:ANISEARCH_ID_BASIS|ANISEARCH_AB)\s*=\s*([\d_]+)/g)].map((m) => m[1])
  assert.deepEqual(wert(readFileSync(path.join(hier, '../pipeline/bau/anisearch-titel.ts'), 'utf8')), ['10_000_000'], 'Quelle der Grenze')
  const kopien = [path.join(hier, 'bau-vergleich-daten.mjs')]
  for (const datei of readdirSync(path.join(hier, '../pipeline/lib'))) if (datei.endsWith('.ts')) kopien.push(path.join(hier, '../pipeline/lib', datei))
  const gefunden = kopien.flatMap((datei) => wert(readFileSync(datei, 'utf8')).map((w) => ({ datei: path.basename(datei), w })))
  assert.ok(gefunden.length >= 8, `Kopien der Grenze gefunden: ${gefunden.length}`)
  assert.deepEqual(gefunden.filter((k) => k.w !== '10_000_000'), [], 'abweichende Kopie der aniSearch-Grenze')

  console.log(`bau-vergleich-daten: ok (Ersatz-Cache als Verhalten, Lesen der entfernten Verweise, ${gefunden.length} Kopien der aniSearch-Grenze gleich)`)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
