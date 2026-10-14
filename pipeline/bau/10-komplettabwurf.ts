import { log } from '../lib/util.ts'
import type { Release } from '../../shared/types.ts'
import { KATALOG_MIN_FOLGEN } from '../../shared/katalog-release.ts'
import { rolleTermineAus } from './10-termine.ts'
import { markiereErstausgabe } from './erstausgabe-markieren.ts'

/**
 * Hat Crunchyroll die ganze Staffel auf einmal gebracht? Belegt ist nur die letzte Folge als einzige Kachel: Ihre Nummer
 * ist die belegte Staffellänge, und keine frühere Woche war je im Kalender (Snowball Earth, 12.10.2026: Folge 13/13 am Mo,
 * dahinter zwölf zurückgerechnete Wochentermine ab 20.07.). Eine laufende Serie zeigt vor ihrem Finale andere Folgen.
 */
export function istKomplettabwurf(r: Release): boolean {
  const s = r.schedule
  const gesehen = Object.entries(s.observed ?? {})
  if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || !s.estimated || s.firstEpisodeNumber) return false
  if (gesehen.length !== 1 || s.episodeCountAssumed || !s.episodeCount || s.episodeCount < KATALOG_MIN_FOLGEN) return false
  return Number(gesehen[0]![0]) === s.episodeCount
}

/** Der Tag der einen Kachel wird der Termin „alle Folgen“; nichts wird zurückgerechnet. */
export function alsKomplettabwurf(r: Release): Release {
  const { episodeCount, observed, time } = r.schedule
  const [tag] = Object.values(observed!)
  return {
    ...r,
    releaseType: 'batch',
    herkunft: `Crunchyroll führt nur die letzte Folge (${episodeCount} von ${episodeCount}) als einzigen deutschen Termin, davor nie eine Folge: abgeleitet als Komplettabwurf.`,
    schedule: { firstEpisodeDate: tag!, time, episodeCount },
    year: Number(tag!.slice(0, 4)),
  }
}

/** Wandelt die Komplettabwürfe um; liefert deren Kennungen. */
export function wandleKomplettabwuerfeUm(releases: Release[]): string[] {
  const treffer = releases.filter(istKomplettabwurf)
  for (const r of treffer) releases[releases.indexOf(r)] = alsKomplettabwurf(r)
  return treffer.map((r) => r.slug)
}

/**
 * Phase 10 mit Komplettabwürfen: erst jetzt, nachdem die Phasen davor die Folgentage des Crunchyroll-Katalogs nachgetragen haben.
 * Vorher hätte „eine Kachel“ auch Serien getroffen, deren frühere Folgen der Katalog noch belegt (zwölf Folgen am 15.07., 04.-05.2026).
 */
export function rolleTermineAusMitKomplettabwurf(args: Parameters<typeof rolleTermineAus>[0]): ReturnType<typeof rolleTermineAus> {
  const slugs = wandleKomplettabwuerfeUm(args.releases)
  if (slugs.length) log(`${slugs.length} Crunchyroll-Komplettabwürfe statt Wochentakt: ${slugs.join(', ')}`)
  markiereErstausgabe({ alle: args.releases, pruefen: args.releases, titles: args.titles })
  return rolleTermineAus(args)
}
