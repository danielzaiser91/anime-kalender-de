/**
 * Fortschritt eines laufenden Abrufs an die Statusanzeige melden.
 *
 * Warum das nötig war: Ein Lauf über 594 Crunchyroll-Seiten stand in der
 * Anzeige zwei Stunden lang als „läuft seit 54 Minuten" — mehr wusste sie
 * nicht. Ob er bei Seite 3 oder 500 war, ließ sich von außen nicht sagen, denn
 * GitHub gibt das Protokoll eines **laufenden** Schritts nicht heraus (Daniel,
 * 21.08.2026: „wie lang brauch der reparaturlauf noch").
 *
 * Der Zuschnitt kommt von ihm: **Jede Aufgabe zählt auf ihre Art.** Ein Scraper
 * über eine bekannte Menge meldet `3/594`, ein Abruf ohne Gesamtzahl meldet nur,
 * woran er gerade ist. Deshalb sind Zahl, Gesamtzahl und Text drei getrennte
 * Angaben — und alle drei sind freiwillig.
 *
 * Aufruf aus jedem Pipeline-Skript:
 *
 *     const melde = fortschrittsMelder(adressen.length)
 *     for (const [i, adresse] of adressen.entries()) {
 *       …
 *       void melde(i + 1, kurzname)
 *     }
 */
import { log } from './util.ts'

/**
 * Höchstens eine Meldung je Sekunde — aber keine geht verloren.
 *
 * Eine erste Fassung drosselte auf zwanzig Sekunden und verwarf alles
 * dazwischen, mit der Begründung, 594 Meldungen seien zu viel. Daniel am
 * 21.08.2026: „wieso sollten 594 meldungen nicht ok sein? es geht schließlich
 * nur um ne kleine zahl anzeige" — und er hat recht. Der Worker ist unser
 * eigener, Cloudflare erlaubt 100.000 Anfragen am Tag, und eine Meldung ist ein
 * paar hundert Byte.
 *
 * Sein Gegenvorschlag ist die bessere Lösung und steht jetzt hier: **stapeln
 * statt verwerfen.** Kommt eine Meldung zu früh, wird sie nicht weggeworfen,
 * sondern als jüngster Stand gemerkt und beim nächsten erlaubten Zeitpunkt
 * geschickt. Die Anzeige bekommt damit immer die aktuelle Zahl, und die Last
 * bleibt gedeckelt, egal wie schnell ein Lauf zählt.
 *
 * Eine Sekunde, weil die Anzeige selbst nur alle zehn Sekunden nachsieht —
 * feiner zu melden hätte keinen Empfänger.
 */
const MINDESTABSTAND_MS = 1000

/** Die Adresse steht als Umgebungsvariable bereit; ohne sie passiert nichts. */
const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'

/**
 * Erzeugt einen Melder für einen Lauf.
 *
 * Läuft das Skript lokal — ohne `LAUF_TOKEN` und ohne `GITHUB_RUN_ID` —, gibt
 * er einen Melder zurück, der nichts tut. Das ist Absicht: Ein Abruf von Hand
 * soll keine Statuszeile erzeugen, und ein fehlendes Token darf nie einen Lauf
 * abbrechen.
 */
export function fortschrittsMelder(gesamt?: number): (jetzt: number, text?: string) => void {
  const token = process.env.LAUF_TOKEN
  const laufId = process.env.GITHUB_RUN_ID
  if (!token || !laufId) return () => {}
  const meinToken: string = token
  const meineLaufId: string = laufId

  let zuletztGesendet = 0
  let wartend: { jetzt: number; text?: string } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let stillGescheitert = false

  async function senden(stand: { jetzt: number; text?: string }): Promise<void> {
    zuletztGesendet = Date.now()
    try {
      const antwort = await fetch(`${WORKER}/lauf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': meinToken },
        body: JSON.stringify({
          lauf_id: meineLaufId,
          repo: process.env.GITHUB_REPOSITORY ?? '',
          workflow: process.env.GITHUB_WORKFLOW ?? '',
          auftrag: process.env.LAUF_AUFTRAG || undefined,
          zustand: 'laeuft',
          fortschritt: stand.jetzt,
          fortschritt_gesamt: gesamt,
          fortschritt_text: stand.text,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!antwort.ok && !stillGescheitert) {
        stillGescheitert = true
        log(`Fortschrittsmeldung abgelehnt (HTTP ${antwort.status}) — der Lauf geht weiter`)
      }
    } catch {
      /**
       * Eine gescheiterte Statusmeldung darf niemals einen Lauf beenden.
       *
       * Am 21.08.2026 hat genau das einen fertigen Auftrag rot gemacht: Der
       * Abmeldeschritt fand sein Skript nicht und beendete den Job mit Exit 127.
       * Hier wird deshalb geschluckt — und nur einmal ins Protokoll geschrieben,
       * damit ein dauerhaft kaputter Melder nicht jede Zeile zumüllt.
       */
      if (!stillGescheitert) {
        stillGescheitert = true
        log('Fortschrittsmeldung nicht zustellbar — der Lauf geht weiter')
      }
    }
  }

  return (jetzt: number, text?: string) => {
    const stand = { jetzt, text }
    const seitdem = Date.now() - zuletztGesendet

    if (seitdem >= MINDESTABSTAND_MS) {
      void senden(stand)
      return
    }

    // Zu früh: als jüngsten Stand merken. Ein bereits laufender Timer schickt
    // ihn — ein zweiter würde nur dieselbe Zahl doppelt senden.
    wartend = stand
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      const nachzuholen = wartend
      wartend = null
      if (nachzuholen) void senden(nachzuholen)
      // Der Timer hält den Prozess sonst am Leben, obwohl der Lauf fertig ist.
    }, MINDESTABSTAND_MS - seitdem)
    timer.unref?.()
  }
}
