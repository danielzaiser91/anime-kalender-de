import { recordSource } from './health.ts'

/**
 * Zwischenstand der Quellen-Gesundheit für `check-links.ts`.
 *
 * Die Zeitgrenze des Wochenlaufs (45 min) bricht den Schritt mitten in der Amazon-Pause ab, bevor die
 * Schlusszeile `recordSource` läuft (19.10.2026). Darum wird vor der Pause und alle 100 Adressen geschrieben.
 * Als Erfolg zählt nur, was heute eine echte Auskunft war (nicht `unklar`): sonst würde ein Lauf, der nur
 * gegen die Sperre rannte, „gesund“ melden.
 */
export function meldeLinkCheckZwischenstand(
  bestand: Record<string, { status: unknown; geprueftAm?: string }>,
  heute: string,
  melde: typeof recordSource = recordSource,
): number {
  const auskuenfte = Object.values(bestand).filter((b) => b.geprueftAm === heute && b.status !== 'unklar').length
  melde('link-check', auskuenfte, auskuenfte ? undefined : 'bisher nur Nichtauskünfte', undefined, false)
  return auskuenfte
}

type Bestand = Parameters<typeof meldeLinkCheckZwischenstand>[0]

const heute = () => new Date().toISOString().slice(0, 10)

/** Vor der Sperr-Pause: Stand melden, dann warten (die Zeitgrenze kann in der Pause zuschlagen). */
export async function pauseMitStand(ms: number, bestand: Bestand, warte: (ms: number) => Promise<void>, melde: typeof recordSource = recordSource, tag = heute()): Promise<void> {
  meldeLinkCheckZwischenstand(bestand, tag, melde)
  await warte(ms)
}

/** Fortschrittszeile alle 100 Adressen samt Zwischenstand. */
export function fortschritt(geprueft: number, von: number, tot: number, bestand: Bestand, log: (s: string) => void, melde: typeof recordSource = recordSource, tag = heute()): void {
  if (geprueft % 100 !== 0) return
  log(`  ${geprueft}/${von} — ${tot} unbrauchbar`)
  meldeLinkCheckZwischenstand(bestand, tag, melde)
}
