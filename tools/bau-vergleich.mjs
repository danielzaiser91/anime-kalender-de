#!/usr/bin/env node
/**
 * Beweist, dass ein Umbau von `pipeline/build.ts` nichts am Ergebnis ändert: Baut den Datensatz
 * für zwei Commits und vergleicht alles, was der Bau schreibt.
 *
 * Gebaut wird je Commit in einem eigenen Git-Worktree — das Arbeitsverzeichnis bleibt
 * unangetastet, man kann währenddessen weiterarbeiten. Das Ergebnis eines Commits wird unter
 * `$TMPDIR/bau-vergleich/` aufgehoben; die Basis baut deshalb nur beim ersten Mal (≈ 5 min).
 *
 * `data/cache/` liegt nicht im Repo. Statt des echten Caches wird ein Ersatz aus
 * `public/data/titles.json` und `franchises.json` des Basis-Commits nachgebildet. Der ist nicht
 * echt, aber für beide Seiten derselbe — und mehr braucht ein Gleichheitsbeweis nicht. Beide
 * Seiten starten von `public/data/` der Basis; `data/` (Handdateien, ohne `data/cache/`) bringt
 * jede Seite selbst mit, so dass Änderungen des Kandidaten an `data/*.yaml`, `*.json` mitgebaut
 * und verglichen werden (seit 12.10.2026; vorher bauten beide mit `data/` der Basis, und ein PR
 * auf Handdateien meldete „gleich“). Grund für die Option `--basisdaten` (altes Verhalten): Liegt
 * der Kandidat hinter der Basis, zeigt der Vergleich sonst Änderungen von `main` als Unterschied;
 * die Ausgabe warnt davor. Meldet der Vergleich „gleich“, obwohl `data/` sich unterscheidet, steht
 * ein Hinweis dabei.
 *
 * Der Bau läuft mit `BAU_VERGLEICH=1`: Widersprüche im Ergebnis (`pipeline/lib/bau-widerspruch.ts`)
 * brechen ihn dann nicht ab, sondern stehen als Warnung im Protokoll, das mitverglichen wird. Der
 * Ersatz-Cache ist nicht der echte, und eine Invariante, die dort reißt, hätte sonst jede Basis
 * verhindert (12.10.2026: Bookworm-Dublette, Prime-Häkchen ohne Beleg). Bei verschiedenen JSON-Dateien
 * nennt die Ausgabe die betroffenen Felder (`vergleich-unterschied.mjs`), z. B. `streams[].dubQuelle`.
 *
 * Aufruf:
 *   node tools/bau-vergleich.mjs [--basisdaten] [basis] [kandidat]    Vorgabe: origin/main gegen HEAD
 * Exit 0 = gleich, 1 = verschieden, 2 = Bau der Basis selbst gescheitert, 3 = läuft schon (Sperre;
 * wartet vorher bis zu 10 min auf den laufenden Vergleich).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { gleichTrotzDatenHinweis, zurueckliegtHinweis } from './bau-vergleich-daten.mjs'
import { wartAufSperre } from './einzel-sperre.mjs'
import { beschreibeUnterschied } from './vergleich-unterschied.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const ABLAGE = join(tmpdir(), 'bau-vergleich')
const git = (...args) => execFileSync('git', ['-C', WURZEL, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

const TEXTDATEI = /\.(json|ics|xml|html|txt|md)$/

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
}

/**
 * Löscht den Baum samt Verwaltungseintrag. Nicht `git worktree remove`: unter Windows lässt es die
 * node_modules-Junction samt Ordner liegen, und der nächste `worktree add` scheitert daran.
 * `rmSync` folgt der Junction nicht, das echte node_modules bleibt.
 */
function entferneBaum(baum) {
  rmSync(baum, { recursive: true, force: true })
  git('worktree', 'prune')
}

/**
 * Baut den Code von `sha` auf `public/data` von `basisSha`; liefert das Verzeichnis mit allem Geschriebenen.
 * `data/` bringt `sha` selbst mit, außer mit `basisDaten` (dann das der Basis). Für die Basis selbst ist beides gleich.
 */
function baue(sha, basisSha, basisDaten) {
  const eigeneDaten = !basisDaten && sha !== basisSha
  const ziel = join(ABLAGE, `${sha.slice(0, 12)}-auf-${basisSha.slice(0, 12)}${eigeneDaten ? '-daten' : ''}`)
  if (existsSync(join(ziel, '_protokoll.txt'))) return ziel
  const baum = join(ABLAGE, `baum-${sha.slice(0, 12)}`)
  entferneBaum(baum)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  const imBaum = (...args) => execFileSync('git', ['-C', baum, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  try {
    // `junction`: unter Windows ohne Administratorrechte möglich, anderswo ignoriert.
    symlinkSync(join(WURZEL, 'node_modules'), join(baum, 'node_modules'), 'junction')
    imBaum('checkout', basisSha, '--', 'public/data', ...(eigeneDaten ? [] : ['data']))
    imBaum('commit', '-q', '--allow-empty', '-m', 'Bestand der Basis', '--no-verify')
    ersatzCache(join(baum, 'data/cache'), basisSha)
    console.log(`baue ${sha.slice(0, 12)} …`)
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

/** Im Vergleichsmodus bricht ein Widerspruch den Bau nicht ab, sondern steht im Protokoll — hier wird die Zahl genannt. */
function meldeWiderspruchWarnungen(seite, ordner) {
  const n = readFileSync(join(ordner, '_protokoll.txt'), 'utf8').split('\n').filter((z) => z.includes('Widerspruch (Vergleichsmodus)')).length
  if (n) console.log(`${seite}: ${n} Widerspruch-Meldungen des Baus als Warnung durchgelassen (Vergleichsmodus) — Einzelheiten im Protokoll ${ordner}`)
}

await wartAufSperre('bau-vergleich', 10 * 60_000)
const argumente = process.argv.slice(2)
const basisDaten = argumente.includes('--basisdaten')
const [basisName, kandidatName] = argumente.filter((x) => !x.startsWith('--'))
const basis = git('rev-parse', basisName ?? 'origin/main')
const kandidat = git('rev-parse', kandidatName ?? 'HEAD')
const a = baue(basis, basis, basisDaten)
if (!readFileSync(join(a, '_protokoll.txt'), 'utf8').startsWith('exit 0')) {
  console.error(`Der Bau der Basis ${basis.slice(0, 12)} scheitert selbst — siehe ${a}/_protokoll.txt`)
  process.exit(2)
}
const b = baue(kandidat, basis, basisDaten)
if (!basisDaten) for (const zeile of zurueckliegtHinweis(git, basis, kandidat)) console.log(zeile)
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
if (!verschieden.length) {
  console.log(`gleich: ${kandidat.slice(0, 12)} schreibt dasselbe wie ${basis.slice(0, 12)}`)
  for (const zeile of gleichTrotzDatenHinweis(git, basis, kandidat, !basisDaten)) console.log(zeile)
  process.exit(0)
}
for (const f of verschieden) {
  console.log(f)
  if (!TEXTDATEI.test(f)) continue
  const lies = (ordner) => (existsSync(join(ordner, f)) ? readFileSync(join(ordner, f), 'utf8') : '')
  for (const zeile of beschreibeUnterschied(f, lies(a), lies(b))) console.log(zeile)
}
console.log(`VERSCHIEDEN (${verschieden.length} Dateien) — Einzelheiten: ${a} gegen ${b}`)
process.exit(1)
