import type { Release, ReleaseEvent } from '../../shared/types.ts'
import type { expandEvents } from '../../shared/logic.ts'
import { folgenblockBis } from '../../shared/folgenblock.ts'
import { formatDate, weekdayName } from '../../shared/time.ts'

/**
 * Erscheinen mehrere belegte Folgen am selben Tag (Avatar: Die sieben Häfen, freitags drei), steht der Plural — entschieden von
 * derselben Funktion wie im Panel (`folgenblockBis`, `antwort-block.ts`): TV-Sichtungen, fortgeschriebene und ausgebliebene Folgen bilden keinen Block.
 */
function naechsteFolgeLabel(events: ReturnType<typeof expandEvents>, kommend: ReleaseEvent): string {
  return folgenblockBis(events, kommend) ? 'Nächste Folgen' : 'Nächste Folge'
}

/**
 * Datum und Uhrzeit des Termins. **Ohne künftigen Termin ist das Datum der Start, keine „nächste
 * Folge"** — die alte Fassung schrieb „Nächste Folge: Fr, 31.01.2025" über eine längst
 * abgeschlossene Staffel (27.09.2026). Eine Uhrzeit steht dann auch nicht mehr da. Ein Katalogtitel
 * ist „im Angebot seit", nicht „erschienen am" (`dateMeaning`).
 */
export function terminZeilen(release: Release, events: ReturnType<typeof expandEvents>, today: string): { label: string; value: string }[] {
  const kommend = events.find((e) => e.date >= today)
  const termin = kommend ?? events[0]
  if (!termin) return []
  const woechentlich = release.releaseType === 'weekly'
  const zeilen = [
    {
      label: release.erstausgabe ? 'Erstveröffentlichung' : release.dateMeaning === 'available-from' ? 'Im Angebot seit' : kommend ? (woechentlich ? naechsteFolgeLabel(events, kommend) : 'Termin') : woechentlich ? 'Erste Folge' : 'Erschienen',
      value: `${weekdayName(termin.date, true)}, ${formatDate(termin.date)}`,
    },
  ]
  if (kommend) {
    const zeit = kommend.time ? `${kommend.time} Uhr` : release.releaseType === 'disc' ? 'im Handel' : 'noch offen'
    zeilen.push({ label: 'Uhrzeit', value: zeit })
  }
  return zeilen
}
