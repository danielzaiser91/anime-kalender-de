import type { Ausnahme, Zuordnung } from './tmdb-katalog.ts'

const ANIMATION = 16
const GENRE_AUSNAHMEN: Ausnahme[] = ['genre-leer', 'genre-studio', 'schlagwort']
const JAHR_AUSNAHMEN: Ausnahme[] = ['jahr-fehlt', 'jahr-folgen-lauf', 'jahr-kurzfilm', 'jahr-studio']
const PRAEFIX = { sicher: 'von Hand bestätigt', kein: 'von Hand verworfen', unsicher: 'von Hand geprüft, offen' } as const

/** Pflichtmerkmale eines von Hand bestätigten Eintrags: Kennung, Name, Genre Animation (sonst benannte Ausnahme), Jahr ±1 (sonst benannte Ausnahme). */
function pruefeBestaetigt(id: string, e: Zuordnung): string[] {
  const b = e.beleg
  if (!e.tmdbId || (e.art !== 'movie' && e.art !== 'tv')) return [`${id}: bestätigt ohne TMDB-Kennung oder Art`]
  if (!b) return [`${id}: bestätigt ohne Beleg`]
  const aus = b.ausnahme ?? []
  const fehler: string[] = []
  if (b.name !== 'original' && b.name !== 'latein') fehler.push(`${id}: Name nicht belegt (${b.name})`)
  if (b.tmdb !== `${e.art}/${e.tmdbId}`) fehler.push(`${id}: Beleg gehört zu ${b.tmdb}, Eintrag zeigt auf ${e.art}/${e.tmdbId}`)
  if (!b.genres.includes(ANIMATION) && !aus.some((a) => GENRE_AUSNAHMEN.includes(a))) fehler.push(`${id}: Genre ${b.genres.join(',') || 'leer'} ohne Animation und ohne Ausnahme`)
  if (aus.includes('genre-leer') && b.genres.length) fehler.push(`${id}: Ausnahme genre-leer, aber Genres ${b.genres.join(',')}`)
  const [al, tm] = b.jahr
  if (al === null || tm === null) {
    if (!aus.includes('jahr-fehlt')) fehler.push(`${id}: Jahr fehlt (AniList ${al}, TMDB ${tm}) ohne Ausnahme jahr-fehlt`)
  } else if (Math.abs(al - tm) > 1 && !aus.some((a) => JAHR_AUSNAHMEN.includes(a))) {
    fehler.push(`${id}: Jahr weicht ab (AniList ${al}, TMDB ${tm}) ohne Ausnahme`)
  }
  return fehler
}

/** Prüft alle Handurteile einer Zuordnung: Grund-Präfix je Stufe, bestätigte Einträge mit Pflichtmerkmalen, verworfene ohne Kennung, jede Kennung nur einmal bestätigt. */
export function pruefeHandEintraege(zuordnung: Record<string, Zuordnung>): string[] {
  const fehler: string[] = []
  const inhaber = new Map<string, string[]>()
  for (const [id, e] of Object.entries(zuordnung)) {
    if (e.stufe === 'sicher') inhaber.set(`${e.art}/${e.tmdbId}`, [...(inhaber.get(`${e.art}/${e.tmdbId}`) ?? []), id])
  }
  for (const [id, e] of Object.entries(zuordnung)) {
    if (e.von !== 'hand') continue
    if (!e.grund.startsWith(PRAEFIX[e.stufe])) fehler.push(`${id}: Grund beginnt nicht mit „${PRAEFIX[e.stufe]}“`)
    if (e.stufe === 'kein' && e.tmdbId) fehler.push(`${id}: verworfen, aber mit TMDB-Kennung`)
    if (e.stufe !== 'sicher') continue
    fehler.push(...pruefeBestaetigt(id, e))
    const geteilt = (inhaber.get(`${e.art}/${e.tmdbId}`) ?? []).filter((andere) => andere !== id)
    if (geteilt.length) fehler.push(`${id}: ${e.art}/${e.tmdbId} ist auch an ${geteilt.join(', ')} gebunden`)
  }
  return fehler
}
