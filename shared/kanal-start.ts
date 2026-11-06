import type { Release, StreamLink } from './types.ts'

/**
 * **Der Start in einem Prime-Kanal bei einem Titel, den der Anbieter schon zum Kauf oder zur Leihe führt** (Angel's Egg, 03.11.2026:
 * ab 05.11. im Aniverse-Kanal, bei Prime Video aber längst als Kauf-/Leihtitel da). Der Termin ist dann kein Erststart des Anbieters,
 * sondern ein neuer Weg (Abo) auf derselben Plattform. Gibt den Kanal zurück („Aniverse“), sonst `undefined`.
 *
 * Nur ein eigener Kauf-Weg ohne Kanal mit belegtem Deutsch zählt; ein Weg, der nur noch als Vermerk steht (`entferntAm`), nicht.
 */
export function kanalStartBeiKaufweg(streams: readonly StreamLink[], release: Pick<Release, 'platform' | 'kanal' | 'releaseType' | 'sprache'>): string | undefined {
  if (!release.kanal || release.releaseType === 'disc' || release.sprache === 'omu') return undefined
  const kaufbar = streams.some((s) => s.platform === release.platform && !s.kanal && s.zugang === 'kauf' && s.dub === true && !s.dubAbgeleitet && !s.entferntAm)
  return kaufbar ? release.kanal : undefined
}
