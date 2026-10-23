import { ADN_CALENDAR_URL, adnKatalogShow } from './grundlagen.ts'
import { log } from '../lib/util.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type PlatformId, type Release, type Title } from '../../shared/types.ts'

type BelegFuer = (titleId: number, plattform: PlatformId, url?: string) => DubCheck | undefined

/** Sagt ADN, ein Mensch oder die Quelle des Termins selbst, dass es die Synchro gibt? */
function hatSprachzusage(release: Release, titel: Title | undefined, belegFuer: BelegFuer): boolean {
  if (release.sources?.some((u) => u === ADN_CALENDAR_URL || adnKatalogShow(u) !== undefined)) return true // aus ADNs Kalender oder Katalog-Folgenliste, beide nur Folgen mit `vde`
  if (titel?.streams.some((s) => s.platform === 'adn' && s.dub === true)) return true // vde im Archiv (`adn-sprachen.ts`) oder am Starttag (`adn-kuratiert-ton.ts`)
  return belegFuer(release.titleId, 'adn')?.dub === true
}

/**
 * **Ein kuratierter ADN-Neuzugang ohne Sprachzusage trägt `sprache: 'offen'`** (14.10.2026; Daniel 13.10.: „warum werden diese titel als im angebot in großen kacheln
 * angezeigt?“ — vier Bleach-Filme, bevor ADNs Daten sie belegten). „Im Angebot seit“ (`dateMeaning: 'available-from'`) sagt nichts über den Ton; ADN führt Neuzugänge
 * teils nur mit Untertiteln. Die Kachel sagt dann selbst „Synchro offen“ (`Marken.tsx`), und spätere Leser (`ohneBelegteSynchro`, die News)
 * zählen den Termin nicht als Beleg für eine Synchro. Ausgenommen: Handeinträge mit eigener `sprache`, automatische Termine (deren Quelle prüft `auto-release-pruefung.ts`)
 * und alles, was Sprachzusage hat — ADNs Kalender oder Katalog als Quelle, ein ADN-Weg mit `dub: true` oder ein Handbeleg „deutsch“.
 * Läuft nach der Synchro-Phase, wenn die Wege ihr Urteil tragen, und vor den Terminen (`events.json` übernimmt `sprache` aus dem Release).
 * Gibt die Kennungen der gekennzeichneten Termine zurück.
 */
export function kennzeichneAdnNeuzugaengeOhneSprache(releases: Release[], titles: Map<number, Title>, belegFuer: BelegFuer): string[] {
  const offen = releases.filter(
    (r) =>
      r.platform === 'adn' &&
      r.dateMeaning === 'available-from' &&
      !r.sprache &&
      !r.automatisch &&
      !hatSprachzusage(r, titles.get(r.titleId), belegFuer),
  )
  for (const r of offen) r.sprache = 'offen'
  if (offen.length) log(`${offen.length} kuratierte ADN-Neuzugänge ohne Sprachzusage als „Synchro offen“ geführt: ${offen.map((r) => r.slug).join(', ')}`)
  return offen.map((r) => r.slug)
}
