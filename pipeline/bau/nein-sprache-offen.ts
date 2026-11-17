import { log } from '../lib/util.ts'
import { type Release, type Title } from '../../shared/types.ts'

const KEIN_STREAM = new Set(['disc', 'kino', 'tv'])

/**
 * **Ein automatischer Termin trägt `sprache: 'offen'`, wo ein Handbeleg die Plattform verneint** (17.11.2026; Trinity Seven: Heavens Library, Yandere Dark Elf,
 * 156040 — Aniverse-Kanal): Die Meldung sagt „Deutsch“, Amazons Tonspur und JustWatch zeigen nur Japanisch. Wer recht hat, steht ohne Messung der Kanalseite
 * nicht fest; der Termin bleibt (nichts gestrichen), sagt aber selbst „Synchro offen“ (wie `adn-sprache-offen.ts`) statt einer Synchro, die der Handbeleg
 * verneint. Handeinträge und Termine mit eigener `sprache` bleiben, ebenso Titel, die an der Plattform einen Weg mit `dub: true` haben.
 * Läuft nach der Synchro-Phase und vor den Ereignissen. Gibt die Kennungen der gekennzeichneten Termine zurück.
 */
export function kennzeichneNeinTermineAlsOffen(releases: Release[], titles: Map<number, Title>, neinGilt: (id: number, plattform: string, ab: string) => boolean): string[] {
  const offen = releases.filter(
    (r) =>
      r.automatisch &&
      !r.sprache &&
      r.releaseType !== 'disc' &&
      !KEIN_STREAM.has(r.platform) &&
      neinGilt(r.titleId, r.platform, r.schedule?.firstEpisodeDate ?? '') &&
      !titles.get(r.titleId)?.streams.some((s) => s.platform === r.platform && s.dub === true && !s.dubAbgeleitet),
  )
  for (const r of offen) r.sprache = 'offen'
  if (offen.length) log(`${offen.length} automatische Termine mit belegtem Nein als „Synchro offen“ geführt: ${offen.map((r) => r.slug).join(', ')}`)
  return offen.map((r) => r.slug)
}
