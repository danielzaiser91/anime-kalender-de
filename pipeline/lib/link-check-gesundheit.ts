import { recordSource } from './health.ts'
import { todayIso } from '../../shared/time.ts'

/** Positivliste: HTTP-Status außer 403/429 (Abwehr, beweist nichts) und Amazons Regionssatz; `unklar`, `timeout`, `fehler` zählen nicht. */
export function istAuskunft(status: unknown): boolean {
  if (status === 'region') return true
  return typeof status === 'number' && status !== 403 && status !== 429
}

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
  const auskuenfte = Object.values(bestand).filter((b) => b.geprueftAm === heute && istAuskunft(b.status)).length
  melde('link-check', auskuenfte, auskuenfte ? undefined : 'bisher nur Nichtauskünfte', undefined, false)
  return auskuenfte
}

type Bestand = Parameters<typeof meldeLinkCheckZwischenstand>[0]

const heute = () => todayIso()

/** Vor der Sperr-Pause: Befunde sichern, Stand melden, dann warten (die Zeitgrenze kann in der Pause zuschlagen). */
export async function pauseMitStand(ms: number, bestand: Bestand, warte: (ms: number) => Promise<void>, sichere: () => void, melde: typeof recordSource = recordSource, tag = heute()): Promise<void> {
  sichere()
  meldeLinkCheckZwischenstand(bestand, tag, melde)
  await warte(ms)
}

/** Fortschrittszeile alle 100 Adressen samt Zwischenstand und gesicherten Befunden. */
export function fortschritt(geprueft: number, von: number, tot: number, bestand: Bestand, log: (s: string) => void, sichere: () => void, melde: typeof recordSource = recordSource, tag = heute()): void {
  if (geprueft % 100 !== 0) return
  log(`  ${geprueft}/${von} — ${tot} unbrauchbar`)
  sichere()
  meldeLinkCheckZwischenstand(bestand, tag, melde)
}

/** Zählt einen Befund dieses Laufs: unbrauchbar (404/region) und, getrennt davon, echte Auskunft. */
export function zaehleBefund(zaehler: { tot: number; auskuenfte: number }, status: unknown): void {
  if (status === 404 || status === 'region') zaehler.tot++
  if (istAuskunft(status)) zaehler.auskuenfte++
}

/**
 * Argumente der Schlusszeile (nach dem Namen) des Laufs: gezählt wird, was in diesem Lauf echte Auskunft war (`istAuskunft`), nicht jede
 * geprüfte Adresse. Nichts fällig (0 geprüft) ist Normalfall; geprüft ohne eine Auskunft ist Misserfolg.
 */
export function linkCheckEnde(geprueft: number, auskuenfte: number): [number, string | undefined, undefined, boolean] {
  return [auskuenfte, geprueft && !auskuenfte ? 'nur Nichtauskünfte' : undefined, undefined, geprueft === 0]
}
