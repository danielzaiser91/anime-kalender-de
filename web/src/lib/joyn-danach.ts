import type { Release, Title } from '@shared/types.ts'
import { liveAdresse } from './live-adresse.ts'

/**
 * Joyn stellt jede ProSieben-MAXX-Folge mit dem Sendeende ein (docs/wissen/quellen.md, 06.11.2026).
 * Die Adresse der Joyn-Seite des Titels, wenn dieser TV-Termin auf MAXX liegt und der Titel einen Joyn-Weg hat.
 * Keine Uhrzeit: der Slot ist länger als die Laufzeit (Werbung), ein Wert aus `runtimeMin` käme zu früh.
 */
export function joynDanach(release: Release, title: Title): string | undefined {
  if (release.platform !== 'tv' || liveAdresse(release.sender)?.name !== 'Joyn') return undefined
  return title.streams?.find((s) => s.platform === 'joyn' && s.url)?.url
}
