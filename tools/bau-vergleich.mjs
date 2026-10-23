#!/usr/bin/env node
/**
 * Beweist, dass ein Umbau von `pipeline/build.ts` nichts am Ergebnis ändert: Baut den Datensatz
 * für zwei Commits und vergleicht alles, was der Bau schreibt.
 *
 * Gebaut wird je Commit in einem eigenen Git-Worktree — das Arbeitsverzeichnis bleibt
 * unangetastet, man kann währenddessen weiterarbeiten. Das Ergebnis eines Commits wird unter
 * `$TMPDIR/bau-vergleich/` aufgehoben; die Basis baut deshalb nur beim ersten Mal (≈ 5 min). Läuft
 * schon ein Vergleich, reiht sich der Aufruf in eine Schlange ein (FIFO, Platz und Halter stehen in der Meldung) und wartet bis zu 45 min, bevor er mit Exit 3 aufgibt.
 * Ein gesperrter, aber auf der Platte fehlender `baum-*`-Worktree (Rest eines hart beendeten Laufs) wird nach der Sperre entfernt (`bau-vergleich-reste.mjs`).
 *
 * `data/cache/` liegt nicht im Repo. Statt des echten Caches wird ein Ersatz aus
 * `public/data/titles.json` und `franchises.json` des Basis-Commits nachgebildet. Der ist nicht
 * echt, aber für beide Seiten derselbe — und mehr braucht ein Gleichheitsbeweis nicht. Beide
 * Seiten starten von `public/data/` und `data/` der Basis; der Kandidat bekommt zusätzlich seine
 * eigenen Änderungen an `data/` seit der Merge-Basis (`git diff basis...kandidat`, `data/cache/`
 * ausgenommen), so dass ein PR auf Handdateien (`data/*.yaml`, `*.json`) mitgebaut und verglichen
 * wird (seit 12.10.2026; vorher bauten beide mit `data/` der Basis und meldeten „gleich“). Nur die
 * eigenen Änderungen, nicht das ganze `data/` des Kandidaten: Hinter der Basis liegend, brächte er
 * sonst die Sammler-Rohdaten von `main` als Unterschied mit. Meldet der Vergleich „gleich“, obwohl
 * der Kandidat `data/` ändert, steht ein Hinweis dabei. Dateien, die auch die Basis geändert hat, werden
 * zusammengeführt (`bau-vergleich-daten.mjs`), ein Konflikt bricht ab.
 *
 * Der Bau läuft mit `BAU_VERGLEICH=1`: Widersprüche im Ergebnis (`pipeline/lib/bau-widerspruch.ts`)
 * brechen ihn dann nicht ab, sondern stehen als Warnung im Protokoll, das mitverglichen wird. Der
 * Ersatz-Cache ist nicht der echte, und eine Invariante, die dort reißt, hätte sonst jede Basis
 * verhindert (12.10.2026: Bookworm-Dublette, Prime-Häkchen ohne Beleg). Bei verschiedenen JSON-Dateien
 * nennt die Ausgabe die betroffenen Felder (`vergleich-unterschied.mjs`), z. B. `streams[].dubQuelle`. Schreibt nur eine Seite eine
 * Datei, gilt für die andere der Stand der Basis (`bau-vergleich-stand.mjs`), der Feldvergleich läuft also trotzdem.
 *
 * Aufruf:
 *   node tools/bau-vergleich.mjs [--katalog[=Pfad]] [basis] [kandidat]    Vorgabe: origin/main gegen HEAD
 * `--katalog` legt den echten `anilist-katalog.json` (Hauptordner, oder Pfad) in den Ersatz-Cache; ohne ihn läuft der Katalogpfad nicht mit.
 * `REIHEN_QUELLE` und `SITE_URL` aus der Umgebung gelten für beide Bauten und stehen im Namen der Ablage (`bau-vergleich-ablage.mjs`).
 * Exit 0 = gleich, 1 = verschieden, 2 = Bau der Basis selbst gescheitert, 3 = läuft schon (Sperre;
 * wartet vorher der Reihe nach bis zu 45 min), 4 = Konflikt bei der Übernahme der eigenen
 * data/-Änderungen (nichts verglichen; Kandidat auf die Basis rebasen).
 *
 * Ist die Basis kein Vorfahre des Kandidaten (hinter `origin/main`, auseinandergelaufen), steht vor dem Lauf und am Ende eine
 * WARNUNG (`bau-vergleich-abstand.mjs`) samt Zahl der Dateien, die die Basis selbst geändert hat. Basis und Kandidat als feste
 * Hashes angeben, nicht gegen das wandernde `origin/main`. Die Sperre nennt wartenden Läufen PID, Hashes, Ort und Alter des Halters.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { ablageName, einstellungsZeilen, hauptordnerAus, liesOptionen } from './bau-vergleich-ablage.mjs'
import { eigeneAenderungen, gleichTrotzDatenHinweis, setzeDatenstand } from './bau-vergleich-daten.mjs'
import { logge } from './bau-vergleich-log.mjs'
import { beschreibeDatei } from './bau-vergleich-stand.mjs'
import { basisRotMeldung } from './bau-vergleich-protokoll.mjs'
import { raeumeVerwaisteBaeume } from './bau-vergleich-reste.mjs'
import { abstandsWarnung, fremdeUnterschiede, messeAbstand, vonBasisGeaendert } from './bau-vergleich-abstand.mjs'
import { EXIT, exitFuerFehler } from './bau-vergleich-urteil.mjs'
import { FRIST_MS, wartAufSperre } from './einzel-sperre-schlange.mjs'
import { wartAufSchwerenLauf } from './schwerer-lauf.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const ABLAGE = join(tmpdir(), 'bau-vergleich')
const git = (...args) => execFileSync('git', ['-C', WURZEL, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

const TEXTDATEI = /\.(json|ics|xml|html|txt|md)$/

// Der Ersatz-Cache hat keinen AniList-Katalog, der Katalogpfad (ohne-synchro.json, Katalog-Reihen) liefe also nie mit.
// `--katalog[=Pfad]` (oder `BAU_VERGLEICH_KATALOG`) legt dieselbe anilist-katalog.json in beide Bauten; die Ablage trägt ihren Inhalt und die Umgebung des Baus im Namen.
// Nur der Hauptordner hat einen gefüllten Cache; aus einem Worktree heraus zeigt `--katalog` deshalb auf dessen Datei.
const HAUPTORDNER = hauptordnerAus(git('rev-parse', '--git-common-dir'), WURZEL)
const { positionen, katalog: KATALOG_CACHE } = liesOptionen(process.argv.slice(2), process.env, HAUPTORDNER)

// Laufzeiten und Zeitstempel sind in jedem Lauf anders — sie gehören nicht zum Ergebnis.
const glatt = (s) =>
  s.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<zeit>').replace(/\d+(\.\d+)?\s?(ms|s)\b/g, '<dauer>')

function ersatzCache(ort, basisSha) {
  const lies = (datei) => JSON.parse(git('show', `${basisSha}:public/data/${datei}`))
  // Reihen als Fortsetzungsketten — ohne sie zerlegt der Bau keine Plattform-Serie in Staffeln,
  // und die Gegenprobe (`pruefeErgebnis`) bricht ab.
  const reihe = new Map()
  for (const glieder of Object.values(lies('franchises.json'))) {
    const sortiert = [...glieder].sort((a, b) => (a.jpStart ?? `${a.jpYear}`).localeCompare(b.jpStart ?? `${b.jpYear}`))
    sortiert.forEach((g, i) => reihe.set(g.id, { g, vor: sortiert[i - 1], nach: sortiert[i + 1] }))
  }
  const kante = (typ, g) => ({ relationType: typ, node: { id: g.id, type: 'ANIME', title: { romaji: g.name, english: null } } })
  const datum = (iso) => (iso ? { year: +iso.slice(0, 4), month: +iso.slice(5, 7), day: +iso.slice(8, 10) } : null)
  const byId = {}
  const byMal = {}
  const confidence = {}
  for (const t of lies('titles.json')) {
    const r = reihe.get(t.id)
    const m = {
      id: t.id,
      idMal: t.malId ?? null,
      title: { romaji: t.titleRomaji ?? null, english: t.titleEn ?? null, native: t.titleNative ?? null },
      format: t.format ?? null,
      status: t.jpEnd ? 'FINISHED' : 'RELEASING',
      episodes: t.episodes ?? null,
      duration: 24,
      season: t.jpSeason ?? null,
      seasonYear: t.jpYear ?? null,
      startDate: datum(r?.g.jpStart) ?? { year: t.jpYear ?? null, month: null, day: null },
      endDate: datum(t.jpEnd) ?? { year: null, month: null, day: null },
      relations: { edges: [r?.vor && kante('PREQUEL', r.vor), r?.nach && kante('SEQUEL', r.nach)].filter(Boolean) },
      genres: t.genres ?? [],
      tags: (t.keywords ?? []).map((name, i) => ({ name, rank: 90 - i, isMediaSpoiler: false, isAdult: false })),
      externalLinks: (t.streams ?? []).map((s) => ({ site: s.platform, url: s.url, type: 'STREAMING' })),
      studios: { nodes: (t.studios ?? []).map((name) => ({ name, isAnimationStudio: true })) },
      coverImage: { large: t.coverImage ?? null, extraLarge: t.coverImage ?? null },
      bannerImage: t.bannerImage ?? null,
      averageScore: t.score ?? null,
      isAdult: false,
      description: null,
    }
    byId[t.id] = m
    if (t.malId) byMal[t.malId] = m
    if (t.malId && t.dubConfidence) confidence[t.malId] = t.dubConfidence
  }
  mkdirSync(ort, { recursive: true })
  writeFileSync(join(ort, 'anilist-by-id.json'), JSON.stringify(byId))
  writeFileSync(join(ort, 'anilist-media.json'), JSON.stringify(byMal))
  writeFileSync(join(ort, 'dub-confidence.json'), JSON.stringify(confidence))
  if (KATALOG_CACHE) copyFileSync(KATALOG_CACHE, join(ort, 'anilist-katalog.json'))
}

/**
 * Löscht den Baum samt Verwaltungseintrag. Nicht `git worktree remove`: unter Windows lässt es die
 * node_modules-Junction samt Ordner liegen, und der nächste `worktree add` scheitert daran.
 * `rmSync` folgt der Junction nicht, das echte node_modules bleibt.
 */
function entferneBaum(baum) {
  rmSync(baum, { recursive: true, force: true })
  raeumeVerwaisteBaeume(git, ABLAGE)
}

/**
 * Baut den Code von `sha` auf dem Bestand von `basisSha` (`public/data`, `data/`) plus den eigenen Änderungen von
 * `sha` an `data/`; liefert das Verzeichnis mit allem Geschriebenen.
 */
function baue(sha, basisSha) {
  const ziel = join(ABLAGE, ablageName(sha, basisSha, KATALOG_CACHE, process.env))
  if (existsSync(join(ziel, '_protokoll.txt'))) return ziel
  const baum = join(ABLAGE, `baum-${sha.slice(0, 12)}`)
  entferneBaum(baum)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  const imBaum = (...args) => execFileSync('git', ['-C', baum, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  try {
    // `junction`: unter Windows ohne Administratorrechte möglich, anderswo ignoriert.
    symlinkSync(join(WURZEL, 'node_modules'), join(baum, 'node_modules'), 'junction')
    setzeDatenstand(git, imBaum, basisSha, sha)
    imBaum('commit', '-q', '--allow-empty', '-m', 'Bestand der Basis', '--no-verify')
    ersatzCache(join(baum, 'data/cache'), basisSha)
    logge(`baue ${sha.slice(0, 12)} …`)
    // Ohne `npx`/Shell: ein Prozess weniger, und das Kind stirbt mit dem Elternprozess.
    const lauf = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/build.ts'], {
      cwd: baum,
      env: { ...process.env, BAU_VERGLEICH: '1' },
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    })
    rmSync(ziel, { recursive: true, force: true })
    mkdirSync(ziel, { recursive: true })
    const geaendert = imBaum('status', '--porcelain', '--untracked-files=all')
      .split('\n')
      .filter(Boolean)
      .map((z) => z.slice(3))
      .filter((p) => !p.startsWith('data/cache/') && p !== 'node_modules')
    for (const pfad of geaendert) {
      const von = join(baum, pfad)
      const nach = join(ziel, pfad)
      mkdirSync(dirname(nach), { recursive: true })
      if (!existsSync(von)) writeFileSync(nach, '<gelöscht>\n')
      else if (TEXTDATEI.test(pfad)) writeFileSync(nach, glatt(readFileSync(von, 'utf8')))
      else cpSync(von, nach)
    }
    writeFileSync(join(ziel, '_protokoll.txt'), `exit ${lauf.status}\n${glatt(lauf.stdout)}\n--- stderr\n${glatt(lauf.stderr)}`)
    return ziel
  } finally {
    entferneBaum(baum)
  }
}

/** Baut den Kandidaten; ein Datenkonflikt beendet mit eigenem Exit-Code (`EXIT.KONFLIKT`), weil dann nichts verglichen wurde. */
function baueOderBeende(sha, basisSha) {
  try {
    return baue(sha, basisSha)
  } catch (fehler) {
    const code = exitFuerFehler(fehler)
    if (code === null) throw fehler
    console.error(`KONFLIKT — kein Vergleich: ${fehler.message}`)
    process.exit(code)
  }
}

/** Im Vergleichsmodus bricht ein Widerspruch den Bau nicht ab, sondern steht im Protokoll — hier wird die Zahl genannt. */
function meldeWiderspruchWarnungen(seite, ordner) {
  const n = readFileSync(join(ordner, '_protokoll.txt'), 'utf8').split('\n').filter((z) => z.includes('Widerspruch (Vergleichsmodus)')).length
  if (n) console.log(`${seite}: ${n} Widerspruch-Meldungen des Baus als Warnung durchgelassen (Vergleichsmodus) — Einzelheiten im Protokoll ${ordner}`)
}

const [basisName, kandidatName] = positionen
const basis = git('rev-parse', basisName ?? 'origin/main')
const kandidat = git('rev-parse', kandidatName ?? 'HEAD')
const abstand = messeAbstand(git, basis, kandidat)
const warnung = abstandsWarnung(abstand, basis, kandidat)
for (const zeile of [...warnung, ...einstellungsZeilen(KATALOG_CACHE, process.env)]) console.log(zeile)
logge(`Vergleich ${basis.slice(0, 12)} gegen ${kandidat.slice(0, 12)} gestartet, warte auf die Sperre`)
await wartAufSperre('bau-vergleich', FRIST_MS, undefined, `bau-vergleich ${basis.slice(0, 12)} gegen ${kandidat.slice(0, 12)} in ${WURZEL}`)
Object.assign(process.env, await wartAufSchwerenLauf(`bau-vergleich ${basis.slice(0, 12)} gegen ${kandidat.slice(0, 12)} in ${WURZEL}`))
raeumeVerwaisteBaeume(git, ABLAGE)
logge('Bau A (Basis) beginnt')
const a = baue(basis, basis)
logge('Bau A (Basis) fertig')
const basisProtokoll = readFileSync(join(a, '_protokoll.txt'), 'utf8')
if (!basisProtokoll.startsWith('exit 0')) {
  console.error(basisRotMeldung(basisProtokoll, basis.slice(0, 12), a))
  process.exit(EXIT.BAU_BASIS)
}
logge('Bau B (Kandidat) beginnt')
const b = baueOderBeende(kandidat, basis)
logge('Bau B (Kandidat) fertig, Vergleich beginnt')
meldeWiderspruchWarnungen('Basis', a)
meldeWiderspruchWarnungen('Kandidat', b)
/** Alle Dateien unter `ordner`, relativ und mit `/` — ohne `diff`, das es unter Windows nicht gibt. */
function dateienUnter(ordner) {
  return readdirSync(ordner, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(ordner, join(e.parentPath, e.name)).replaceAll('\\', '/'))
    .sort()
}
const liste = [...new Set([...dateienUnter(a), ...dateienUnter(b)])]
const verschieden = liste.filter((f) => {
  const [x, y] = [join(a, f), join(b, f)]
  return !existsSync(x) || !existsSync(y) || !readFileSync(x).equals(readFileSync(y))
})
logge(`Vergleich fertig: ${verschieden.length} verschiedene Dateien`)
if (!verschieden.length) {
  console.log(`gleich: ${kandidat.slice(0, 12)} schreibt dasselbe wie ${basis.slice(0, 12)}`)
  for (const zeile of gleichTrotzDatenHinweis(git, basis, kandidat)) console.log(zeile)
  for (const zeile of einstellungsZeilen(KATALOG_CACHE, process.env)) console.log(zeile)
  for (const zeile of warnung) console.log(zeile)
  process.exit(EXIT.GLEICH)
}
const standKontext = { git, basis, glatt, eigene: new Set(eigeneAenderungen(git, basis, kandidat).map((e) => e.pfad)) }
for (const f of verschieden) {
  console.log(f)
  if (!TEXTDATEI.test(f)) continue
  for (const zeile of beschreibeDatei(standKontext, a, b, f)) console.log(zeile)
}
if (warnung.length) {
  console.log(fremdeUnterschiede(verschieden, vonBasisGeaendert(git, abstand, basis)) ?? 'Keine der verschiedenen Dateien hat die Basis seit der Merge-Basis geändert.')
  for (const zeile of warnung) console.log(zeile)
}
console.log(`VERSCHIEDEN (${verschieden.length} Dateien) — Einzelheiten: ${a} gegen ${b}`)
process.exit(EXIT.VERSCHIEDEN)
