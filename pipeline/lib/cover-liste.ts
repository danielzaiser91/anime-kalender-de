import { readJson, writeText } from './util.ts'
import type { GrundBestand, PlakatBestand } from './tmdb-plakat-suche.ts'
import type { Title } from '../../shared/types.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md'
const ANISEARCH_AB = 10_000_000

const zelle = (s: string): string => s.replace(/\|/g, '/').replace(/\s+/g, ' ')
const tmdbSuche = (t: Title): string => `https://www.themoviedb.org/search?query=${encodeURIComponent(t.titleEn ?? t.titleRomaji ?? '')}`
const anilist = (t: Title): string => (t.id > 0 && t.id < ANISEARCH_AB ? `[${t.id}](https://anilist.co/anime/${t.id})` : '–')

function tmdbSpalte(t: Title, kandidaten: string[] | undefined): string {
  const links = (kandidaten ?? []).map((k) => `[${k}](https://www.themoviedb.org/${k})`)
  return [`[Suche](${tmdbSuche(t)})`, ...links].join(' ')
}

function zeile(t: Title, grund: string, kandidaten: string[] | undefined): string {
  const name = zelle(t.titleEn ?? t.titleRomaji ?? String(t.id))
  return `| ${name} | ${t.jpYear ?? '–'} | ${t.format ?? '–'} | ${anilist(t)} | ${grund} | ${tmdbSpalte(t, kandidaten)} |`
}

const KOPF = '| Titel | Jahr | Format | AniList | Grund | TMDB |\n|---|---|---|---|---|---|'

/**
 * **Die Liste der Titel, deren Cover nicht von TMDB kommt** (Daniel, 11.10.2026) zum Prüfen von Hand: erst die ohne jedes Cover, dann die mit
 * AniList-Cover und gesuchtem, aber nicht gefundenem TMDB-Plakat. Titel, die noch nicht gesucht wurden, zählt nur die Kopfzeile.
 */
export function schreibeCoverListe(bestand: PlakatBestand, gruende: GrundBestand): void {
  const alle = [...readJson<Title[]>('public/data/titles.json', []), ...readJson<Title[]>('public/data/ohne-synchro.json', [])]
  const gesehen = new Set<number>()
  const ohneCover: string[] = []
  const anilistCover: string[] = []
  let ungesucht = 0
  let mitTmdb = 0
  for (const t of alle) {
    if (gesehen.has(t.id)) continue
    gesehen.add(t.id)
    const id = String(t.id)
    if (bestand[id]?.p) mitTmdb++
    else if (!t.coverImage) ohneCover.push(zeile(t, gruende[id]?.grund ?? (id in bestand ? 'kein Treffer (frühere Suche)' : 'noch nicht gesucht'), gruende[id]?.kandidaten))
    else if (id in gruende || id in bestand) anilistCover.push(zeile(t, gruende[id]?.grund ?? 'kein Treffer (frühere Suche)', gruende[id]?.kandidaten))
    else ungesucht++
  }
  const text = [
    '# Cover ohne TMDB-Plakat',
    '',
    `Erzeugt von \`pipeline/fetch-tmdb-poster.ts\` (Stand der Suche; ${alle.length} Titel gesamt): ${mitTmdb} Titel haben ein TMDB-Plakat, ${anilistCover.length} behalten das AniList-Cover (TMDB ohne sicheren Treffer), ${ohneCover.length} haben gar kein Cover, ${ungesucht} AniList-Titel sind noch nicht bei TMDB gesucht.`,
    '',
    'Gründe: **kein Treffer** (TMDB kennt keinen Titel gleichen Namens), **unsicher** (Name gleich, aber Jahr oder Genre Animation nicht belegt; Kandidaten verlinkt), **mehrere Kandidaten** (zwei Werke gleich nah), **kein Plakat** (Treffer ohne Hochformat).',
    '',
    `## Ohne jedes Cover (${ohneCover.length})`,
    '',
    KOPF,
    ...ohneCover,
    '',
    `## AniList-Cover bleibt (${anilistCover.length})`,
    '',
    KOPF,
    ...anilistCover,
    '',
  ].join('\n')
  writeText(DATEI, text)
}
