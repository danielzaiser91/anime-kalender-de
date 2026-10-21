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

export interface TerminKopf {
  /** „Fr, 16.10." — das Jahr steht nur, wenn es nicht das laufende ist. */
  datum: string
  /** Neben der Datumsmarke: die Folgen des Termins; leer, wenn das Datum keine Folgen trägt. */
  folge: string
  /** Eine Zeile darunter: was das Datum bedeutet (Katalog, Erstveröffentlichung) und die Uhrzeit eines künftigen Termins. */
  fakt: string
}

function datumKurz(iso: string, heute: string): string {
  const tag = formatDate(iso)
  return `${weekdayName(iso, true)}, ${iso.slice(0, 4) === heute.slice(0, 4) ? tag.slice(0, 6) : tag}`
}

/** „Folge 7 von 13", „Folgen 4–6 von 13"; Nummern aus dem Termin, die Zahl mit ≈, wenn sie angenommen ist. */
function folgenText(release: Release, events: ReturnType<typeof expandEvents>, kommend: ReleaseEvent): string {
  if (kommend.episode == null || release.releaseType !== 'weekly') return ''
  const bis = folgenblockBis(events, kommend)
  const von = bis ? `Folgen ${kommend.episode}–${bis}` : `Folge ${kommend.episode}`
  const gesamt = release.schedule.episodeCount
  if (!gesamt) return von
  return `${von} von ${release.schedule.episodeCountAssumed ? '≈' : ''}${gesamt}`
}

/** Was das Datum ohne künftigen Termin bedeutet; „Im Angebot seit" ≠ „erschienen am" (`dateMeaning`). */
function datumBedeutung(release: Release, kommend: boolean): string {
  if (release.erstausgabe) return 'Erstveröffentlichung'
  if (release.dateMeaning === 'available-from') return kommend ? 'im Angebot ab diesem Tag' : 'im Angebot seit diesem Tag'
  if (kommend) return ''
  return release.releaseType === 'weekly' ? 'erste Folge' : 'erschienen'
}

/** Die Eckdaten des Vorschaubilds in der Darstellung „Datum groß": dieselben Aussagen wie `terminZeilen`, anders verteilt. */
export function terminKopf(release: Release, events: ReturnType<typeof expandEvents>, today: string): TerminKopf | undefined {
  const kommend = events.find((e) => e.date >= today)
  const termin = kommend ?? events[0]
  if (!termin) return undefined
  const datum = datumKurz(termin.date, today)
  if (!kommend) return { datum, folge: '', fakt: datumBedeutung(release, false) }
  const zeit = kommend.time ? `${kommend.timeEstimated ? '≈ ' : ''}${kommend.time} Uhr` : release.releaseType === 'disc' ? 'im Handel' : 'Uhrzeit noch offen'
  const folge = folgenText(release, events, kommend)
  return { datum, folge, fakt: folge ? zeit : [datumBedeutung(release, true), zeit].filter(Boolean).join(' · ') }
}
