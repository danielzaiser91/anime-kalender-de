/**
 * Abruf einer Datendatei mit Neuversuchen.
 *
 * Ein kurzer Aussetzer (503 beim Wechsel der Fassung, Netzwechsel am Handy, 429) soll den Besucher nicht auf die Fehlerseite bringen
 * (16.11.2026, `releases.json` mit 503). Die Neuversuche laufen nacheinander: nie zwei Anfragen derselben Datei zugleich.
 */

/** Pausen vor dem 1., 2., 3. Neuversuch: zusammen 4,6 s, kurz genug für einen Ladezustand, lang genug für einen Deploy-Wechsel. */
export const NEUVERSUCH_PAUSEN_MS: readonly number[] = [400, 1200, 3000]

export interface NeuversuchOptionen {
  /** Pausen vor den Neuversuchen; Tests setzen `[0, 0, 0]`. */
  pausen?: readonly number[]
  /** Wartefunktion; Tests ersetzen sie. */
  warte?: (ms: number) => Promise<void>
  /** Der eigentliche Abruf. */
  abruf?: (adresse: string) => Promise<Response>
}

export class DatenLadefehler extends Error {
  constructor(
    readonly datei: string,
    readonly status?: number,
  ) {
    super(status === undefined ? `${datei} konnte nicht geladen werden (Netz)` : `${datei} konnte nicht geladen werden (${status})`)
  }
}

/** Wie viele Neuversuche ein Ausgang verdient: Aussetzer drei, ein fehlendes Dateichen (Deploy-Wechsel) einen, alles andere keinen. */
function neuversucheFuer(status: number | undefined): number {
  if (status === undefined || status >= 500 || status === 429) return 3
  return status === 404 ? 1 : 0
}

const schlafen = (ms: number) => new Promise<void>((fertig) => setTimeout(fertig, ms))

export async function holeMitNeuversuch<T>(adresse: string, datei: string, opt: NeuversuchOptionen = {}): Promise<T> {
  const { pausen = NEUVERSUCH_PAUSEN_MS, warte = schlafen, abruf = (a: string) => fetch(a) } = opt
  for (let versuch = 0; ; versuch++) {
    let fehler: DatenLadefehler
    try {
      const res = await abruf(adresse)
      if (res.ok) return (await res.json()) as T
      fehler = new DatenLadefehler(datei, res.status)
    } catch (e) {
      /* Netzfehler und abgebrochene oder abgeschnittene Antwort: dieselbe Behandlung. */
      fehler = new DatenLadefehler(datei, undefined)
      fehler.cause = e
    }
    if (versuch >= neuversucheFuer(fehler.status)) throw fehler
    await warte(pausen[versuch] ?? pausen[pausen.length - 1] ?? 0)
  }
}
