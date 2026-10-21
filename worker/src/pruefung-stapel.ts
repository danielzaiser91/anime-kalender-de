/**
 * **Ein Stapel antwortet je Meldung — und wirft nie.**
 *
 * Am 10.10.2026 speicherte der Worker einen 10er-Stapel vollständig und warf danach eine
 * ungefangene Ausnahme (`scriptThrewException`): Cloudflare antwortete mit einer 500-Seite ohne
 * CORS, die Erweiterung sah nur „Failed to fetch" und hielt alle 10 für ungemeldet. Zwei
 * Kandidaten, aus den Analytics nicht zu trennen: zehn gleichzeitige Schreibzugriffe auf dieselbe
 * R2-Marke (R2 erlaubt einen je Sekunde und Schlüssel) und die Grenze von 50 Subrequests je Aufruf
 * (kostenloser Plan; 10 × 5 + 2 = 52). Beides ist hier ausgeschlossen: die Marke schreibt der
 * Aufrufer einmal, und mehr Meldungen als das Budget trägt, werden nicht angefasst, sondern als
 * nicht gespeichert zurückgemeldet — die Erweiterung schickt sie dann erneut.
 *
 * Jede abgelehnte Meldung trägt ihren `grund` (Klartext) im Ergebnis und steht im Protokoll
 * (pruefung-ablehnung.ts) — seit dem 11.10.2026, als ein ganzer Stapel „bestätigt 0" meldete.
 */
import { ablehnungLoggen, ausnahmeAls, type Ablehnung } from './pruefung-ablehnung.ts'

export type StapelErgebnis = { ok: true; befund: string | null } | { ok: false; status: number; grund: string }

/** 50 Subrequests im kostenlosen Plan, abzüglich Marke in R2, Ereignis an das Durable Object und Puffer. */
export const ANFRAGEN_BUDGET = 44

/**
 * Datenbankaufrufe einer Meldung: Löschen und Einfügen, mit Rohfolgen dazu je ein `batch`
 * zum Aufräumen und zum Einfügen (ein `batch` zählt als ein Aufruf — gemessen: eine
 * Prime-Meldung mit 90 Rohfolgen ging am 19.09.2026 in einem Aufruf durch).
 */
export function anfragenJeMeldung(meldung: unknown): number {
  const rohfolgen = (meldung as { rohfolgen?: unknown } | null)?.rohfolgen
  return Array.isArray(rohfolgen) && rohfolgen.length ? 4 : 2
}

export async function verarbeiteStapel(
  stapel: unknown[],
  einzeln: (meldung: unknown) => Promise<StapelErgebnis>,
  schonVerbraucht = 0,
): Promise<StapelErgebnis[]> {
  let verbraucht = schonVerbraucht
  const ergebnisse = await Promise.all(
    stapel.map(async (meldung): Promise<StapelErgebnis> => {
      verbraucht += anfragenJeMeldung(meldung)
      if (verbraucht > ANFRAGEN_BUDGET) {
        return abgelehnt(meldung, { status: 503, grund: 'Subrequest-Budget des Stapels überschritten' })
      }
      try {
        const r = await einzeln(meldung)
        return r.ok ? r : abgelehnt(meldung, r)
      } catch (e) {
        return abgelehnt(meldung, ausnahmeAls(e))
      }
    }),
  )
  const fehlgeschlagen = ergebnisse.filter((r) => !r.ok).length
  if (fehlgeschlagen) console.error(`pruefung stapel: ${fehlgeschlagen} von ${stapel.length} nicht gespeichert`)
  return ergebnisse
}

/** Ergebnis einer abgelehnten Meldung: ins Protokoll schreiben, Grund an die Erweiterung zurückgeben. */
function abgelehnt(meldung: unknown, ablehnung: Ablehnung): StapelErgebnis {
  ablehnungLoggen('pruefung/stapel', ablehnung, meldung)
  return { ok: false, status: ablehnung.status, grund: ablehnung.grund }
}
