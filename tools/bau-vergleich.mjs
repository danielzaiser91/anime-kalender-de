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
 * Seiten starten außerdem vom Datenbestand (`data/`, `public/data/`) der Basis.
 *
 * Aufruf:
 *   node tools/bau-vergleich.mjs [basis] [kandidat]    Vorgabe: origin/main gegen HEAD
 * Exit 0 = gleich, 1 = verschieden, 2 = Bau der Basis selbst gescheitert.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const ABLAGE = join(tmpdir(), 'bau-vergleich')
const git = (...args) => execFileSync('git', ['-C', WURZEL, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

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

/** Baut den Code von `sha` auf dem Bestand von `basisSha`; liefert das Verzeichnis mit allem Geschriebenen. */
function baue(sha, basisSha) {
  const ziel = join(ABLAGE, `${sha.slice(0, 12)}-auf-${basisSha.slice(0, 12)}`)
  if (existsSync(join(ziel, '_protokoll.txt'))) return ziel
  const baum = join(ABLAGE, `baum-${sha.slice(0, 12)}`)
  if (existsSync(baum)) git('worktree', 'remove', '--force', baum)
  git('worktree', 'add', '--quiet', '--detach', baum, sha)
  const imBaum = (...args) => execFileSync('git', ['-C', baum, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
  try {
    // `junction`: unter Windows ohne Administratorrechte möglich, anderswo ignoriert.
    symlinkSync(join(WURZEL, 'node_modules'), join(baum, 'node_modules'), 'junction')
    imBaum('checkout', basisSha, '--', 'public/data', 'data')
    imBaum('commit', '-q', '--allow-empty', '-m', 'Bestand der Basis', '--no-verify')
    ersatzCache(join(baum, 'data/cache'), basisSha)
    console.log(`baue ${sha.slice(0, 12)} …`)
    const lauf = spawnSync('npx', ['tsx', 'pipeline/build.ts'], {
      cwd: baum,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      shell: process.platform === 'win32', // npx ist dort npx.cmd
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
      else if (/\.(json|ics|xml|html|txt|md)$/.test(pfad)) writeFileSync(nach, glatt(readFileSync(von, 'utf8')))
      else cpSync(von, nach)
    }
    writeFileSync(join(ziel, '_protokoll.txt'), `exit ${lauf.status}\n${glatt(lauf.stdout)}\n--- stderr\n${glatt(lauf.stderr)}`)
    return ziel
  } finally {
    git('worktree', 'remove', '--force', baum)
  }
}

const basis = git('rev-parse', process.argv[2] ?? 'origin/main')
const kandidat = git('rev-parse', process.argv[3] ?? 'HEAD')
const a = baue(basis, basis)
if (!readFileSync(join(a, '_protokoll.txt'), 'utf8').startsWith('exit 0')) {
  console.error(`Der Bau der Basis ${basis.slice(0, 12)} scheitert selbst — siehe ${a}/_protokoll.txt`)
  process.exit(2)
}
const b = baue(kandidat, basis)
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
  process.exit(0)
}
console.log(verschieden.join('\n'))
console.log(`VERSCHIEDEN (${verschieden.length} Dateien) — Einzelheiten: ${a} gegen ${b}`)
process.exit(1)
