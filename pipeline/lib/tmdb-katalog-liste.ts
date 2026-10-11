import type { KatalogTitel, Zuordnung } from './tmdb-katalog.ts'

const tmdbLink = (kennung: string): string => `[${kennung}](https://www.themoviedb.org/${kennung})`
const zelle = (s: string): string => s.replace(/\|/g, '/')

/** Zählt die Stufen einer Zuordnung. */
export function zaehleStufen(zuordnung: Record<string, Zuordnung>): Record<'sicher' | 'unsicher' | 'kein', number> {
  const z = { sicher: 0, unsicher: 0, kein: 0 }
  for (const e of Object.values(zuordnung)) z[e.stufe]++
  return z
}

/** Die Prüfliste zum Nachsehen von Hand: alle unsicheren Treffer mit Titel, Jahr, Art, TMDB-Link und Grund. */
export function pruefliste(zuordnung: Record<string, Zuordnung>, titel: Map<number, KatalogTitel>): string {
  const z = zaehleStufen(zuordnung)
  const zeilen = Object.entries(zuordnung)
    .filter(([, e]) => e.stufe === 'unsicher')
    .map(([id, e]) => {
      const t = titel.get(Number(id))
      const kennungen = [`${e.art}/${e.tmdbId}`, ...(e.kandidaten ?? [])].map(tmdbLink).join(' ')
      return `| ${zelle(t?.en || t?.romaji || t?.native || id)} | ${t?.jahr ?? '–'} | ${t?.format ?? '–'} | [${id}](https://anilist.co/anime/${id}) | ${kennungen} | ${zelle(e.grund)} |`
    })
  return [
    '# TMDB-Zuordnung der Nur-AniList-Titel: unsichere Treffer',
    '',
    `Erzeugt von \`pipeline/fetch-tmdb-katalog.ts\` aus \`data/tmdb-katalog-zuordnung.json\`: ${z.sicher} sicher, ${z.unsicher} unsicher (diese Liste), ${z.kein} ohne Treffer. Ein unsicherer Treffer wird nie automatisch gebunden; erst nachsehen, ob TMDB dasselbe Werk meint.`,
    '',
    '| Titel | Jahr | Format | AniList | TMDB | Grund |',
    '|---|---|---|---|---|---|',
    ...zeilen,
    '',
  ].join('\n')
}
