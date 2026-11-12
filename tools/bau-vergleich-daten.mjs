/**
 * Handdateien unter `data/` (ohne `data/cache/`, das liegt nicht im Repo) für `bau-vergleich.mjs`:
 * Der Kandidat baut auf dem Stand der Basis plus seinen eigenen Änderungen seit der Merge-Basis.
 * Das ganze `data/` des Kandidaten zu nehmen, hieße bei einem Kandidaten hinter der Basis, die
 * Sammler-Rohdaten von `main` als Unterschied zu melden. Eine Datei, die Basis und Kandidat beide
 * geändert haben, wird daher zusammengeführt (Diff Merge-Basis..Kandidat auf die Basis angewandt).
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DATEN = ['data', ':(exclude)data/cache']

/** Die eigenen data/-Änderungen des Kandidaten lassen sich nicht auf den Stand der Basis anwenden. */
export class DatenKonflikt extends Error {}

/** Änderungen des Kandidaten seit der Merge-Basis unter `data/`: `[{ status: 'A'|'M'|'D', pfad }]`. */
export function eigeneAenderungen(git, basis, kandidat) {
  return git('-c', 'core.quotepath=off', 'diff', '--name-status', '--no-renames', `${basis}...${kandidat}`, '--', ...DATEN)
    .split('\n')
    .filter(Boolean)
    .map((zeile) => {
      const [status, pfad] = zeile.split('\t')
      return { status, pfad }
    })
}

/**
 * Wendet die eigenen Änderungen des Kandidaten (Merge-Basis..Kandidat) auf den Baum an, der den Stand der Basis hat.
 * Bei einem Konflikt bricht es ab: keine Seite wird still genommen.
 */
function wendeEigeneAn(git, imBaum, basisSha, sha) {
  const ordner = mkdtempSync(join(tmpdir(), 'bau-vergleich-diff-'))
  try {
    const diff = join(ordner, 'eigene.diff')
    git('diff', '--binary', '--no-renames', '--output', diff, `${basisSha}...${sha}`, '--', ...DATEN)
    try {
      imBaum('apply', '--3way', '--whitespace=nowarn', diff)
    } catch (fehler) {
      const meldung = `${fehler.stderr ?? ''}${fehler.stdout ?? ''}`.trim() || fehler.message
      throw new DatenKonflikt(
        `Konflikt: Die data/-Änderungen von ${sha.slice(0, 12)} lassen sich nicht auf den Stand von ${basisSha.slice(0, 12)} ` +
          `anwenden (Basis und Kandidat haben dieselbe Stelle geändert). Kandidat auf die Basis rebasen.\n${meldung}`,
      )
    }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

/**
 * Bringt den Baum von `sha` auf `public/data` und `data/` der Basis und legt die eigenen Änderungen des Kandidaten
 * (neu/geändert/gelöscht, mit der Basis zusammengeführt) darauf. Gibt die Änderungen zurück.
 */
export function setzeDatenstand(git, imBaum, basisSha, sha) {
  imBaum('rm', '-rfq', '--ignore-unmatch', 'data')
  imBaum('checkout', basisSha, '--', 'public/data', 'data')
  const eigene = sha === basisSha ? [] : eigeneAenderungen(git, basisSha, sha)
  if (eigene.length) wendeEigeneAn(git, imBaum, basisSha, sha)
  return eigene
}

/** Kürzt eine Dateiliste für die Ausgabe. */
const nenne = (dateien) => dateien.slice(0, 5).join(', ') + (dateien.length > 5 ? `, … (+${dateien.length - 5})` : '')

/** Hinweis für die Ausgabe „gleich“: Der Kandidat ändert Handdateien, ohne dass der Bau etwas anderes schreibt. */
export function gleichTrotzDatenHinweis(git, basis, kandidat) {
  const eigene = eigeneAenderungen(git, basis, kandidat).map((e) => e.pfad)
  if (!eigene.length) return []
  return [`Hinweis: Der Kandidat ändert ${eigene.length} Dateien unter data/ (${nenne(eigene)}); mitgebaut, der Bau schreibt trotzdem dasselbe.`]
}

/** Erste Kennung einer aniSearch-Zeile (wie `ANISEARCH_ID_BASIS` in `pipeline/bau/anisearch-titel.ts`). */
export const ANISEARCH_ID_BASIS = 10_000_000

/**
 * Titel für den Ersatz-Cache. Mit Katalog fehlen aniSearch-Zeilen: der echte Cache kennt sie nicht, der Bau legt sie
 * aus dem aniSearch-Cache selbst an — eine aufgenommene Zeile erschiene sonst als „verschieden“, obwohl der Bau sie streicht.
 */
export const titelFuerErsatzCache = (titel, mitKatalog) => (mitKatalog ? titel.filter((t) => t.id < ANISEARCH_ID_BASIS) : titel)

/**
 * Verweise eines Titels für den Ersatz-Cache: seine Streams plus die in `data/verweise-entfernt.json` entfernten.
 * AniList führt sie weiter, der Bau streicht sie erst; ohne sie bliebe jede Änderung an dieser Streichung unsichtbar.
 */
export function verweiseFuerErsatzCache(titel, entfernte) {
  const verweis = (site, url) => ({ site, url, type: 'STREAMING' })
  const bekannt = new Set((titel.streams ?? []).map((s) => s.url))
  const zurueck = entfernte.filter((e) => e.titleId === titel.id && e.url && !bekannt.has(e.url)).map((e) => verweis(e.plattform, e.url))
  return [...(titel.streams ?? []).map((s) => verweis(s.platform, s.url)), ...zurueck]
}

/**
 * Inhalt des Ersatz-Caches aus dem Bestand der Basis (rein, ohne Dateien): AniList-Nachbildung nach Kennung und MAL-ID.
 * `franchises`: Inhalt von franchises.json, `entfernte`: Verweise aus verweise-entfernt.json, `mitKatalog`: Bau mit --katalog.
 */
export function ersatzCacheInhalt({ titel, franchises, entfernte, mitKatalog }) {
  // Reihen als Fortsetzungsketten — ohne sie zerlegt der Bau keine Plattform-Serie in Staffeln,
  // und die Gegenprobe (`pruefeErgebnis`) bricht ab.
  const reihe = new Map()
  for (const glieder of Object.values(franchises)) {
    const sortiert = [...glieder].sort((a, b) => (a.jpStart ?? `${a.jpYear}`).localeCompare(b.jpStart ?? `${b.jpYear}`))
    sortiert.forEach((g, i) => reihe.set(g.id, { g, vor: sortiert[i - 1], nach: sortiert[i + 1] }))
  }
  const kante = (typ, g) => ({ relationType: typ, node: { id: g.id, type: 'ANIME', title: { romaji: g.name, english: null } } })
  const datum = (iso) => (iso ? { year: +iso.slice(0, 4), month: +iso.slice(5, 7), day: +iso.slice(8, 10) } : null)
  const byId = {}
  const byMal = {}
  const confidence = {}
  for (const t of titelFuerErsatzCache(titel, mitKatalog)) {
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
      externalLinks: verweiseFuerErsatzCache(t, entfernte),
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
  return { byId, byMal, confidence }
}

/**
 * Entfernte Verweise der Basis (`data/verweise-entfernt.json`). Fehlt die Datei in der Basis (ältere Basis), gilt „keine“;
 * jeder andere Fehler (kaputtes JSON, git) wird geworfen, sonst wäre die Rückgabe der Wege still wirkungslos.
 */
export function liesEntfernteVerweise(git, basisSha) {
  let text
  try {
    text = git('show', `${basisSha}:data/verweise-entfernt.json`)
  } catch (fehler) {
    const meldung = `${fehler.stderr ?? ''}${fehler.message ?? ''}`
    if (/does not exist in|exists on disk, but not in/.test(meldung)) return []
    throw fehler
  }
  return JSON.parse(text).verweise ?? []
}

/**
 * Schreibt den Ersatz-Cache in `ort`: Bestand (`public/data`) und entfernte Verweise von `basisSha`, bei `katalogPfad`
 * (`--katalog`) ohne aniSearch-Zeilen und mit dem Katalog daneben. `git` ist die Git-Funktion des Aufrufers.
 */
export function schreibeErsatzCache(ort, git, basisSha, katalogPfad) {
  const lies = (datei) => JSON.parse(git('show', `${basisSha}:public/data/${datei}`))
  const { byId, byMal, confidence } = ersatzCacheInhalt({
    titel: lies('titles.json'),
    franchises: lies('franchises.json'),
    entfernte: liesEntfernteVerweise(git, basisSha),
    mitKatalog: Boolean(katalogPfad),
  })
  mkdirSync(ort, { recursive: true })
  writeFileSync(join(ort, 'anilist-by-id.json'), JSON.stringify(byId))
  writeFileSync(join(ort, 'anilist-media.json'), JSON.stringify(byMal))
  writeFileSync(join(ort, 'dub-confidence.json'), JSON.stringify(confidence))
  if (katalogPfad) copyFileSync(katalogPfad, join(ort, 'anilist-katalog.json'))
}
