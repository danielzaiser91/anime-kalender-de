

/**
 * Zustand der Cloud-Läufe — melden und abfragen.
 *
 * Warum überhaupt hier und nicht über die GitHub-API: Die erlaubt ohne
 * Anmeldung 60 Abrufe je Stunde. Eine Anzeige, die alle zehn Sekunden nachsieht,
 * verbraucht das in vier Minuten. Ein Token in eine Datei auf dem Schreibtisch zu
 * legen war die Alternative und ist der schlechtere Handel.
 *
 * Der zweite Grund wiegt schwerer: Ein Lauf weiß, was er tut. Die GitHub-API
 * sieht nur „Claude — Auftrag abarbeiten", der Lauf selbst kennt seinen Auftrag.
 *
 * GET ist offen — es sind Metadaten öffentlicher Läufe in einem öffentlichen
 * Repo. Deshalb bekommt dieser eine Pfad `Access-Control-Allow-Origin: *`
 * statt der sonst geltenden Beschränkung auf die eigene Seite: Die Anzeige läuft
 * als Datei vom Schreibtisch und hätte sonst den Ursprung `null`.
 */
/**
 * Zeitstempel in genau dem Format, in dem SQLite vergleichen kann.
 *
 * `datetime('now')` liefert `2026-08-21 13:00:48`, `toISOString()` dagegen
 * `2026-08-21T13:30:24.525Z`. SQLite vergleicht diese Spalte als **Text**, und
 * an Position 10 steht dann `T` (0x54) gegen ein Leerzeichen (0x20) — jeder
 * unserer Werte galt damit als neuer, unabhängig vom Datum. Die Folge: Weder
 * der Drei-Tage-Filter noch das Aufräumen nach vierzehn Tagen haben je
 * gegriffen, und niemandem wäre es aufgefallen, weil beide stumm zu viel
 * durchließen statt zu wenig (gefunden am 21.08.2026).
 *
 * Deshalb: Millisekunden weg, und die Abfragen rechnen mit `strftime` im
 * selben Format.
 */
export const ISO_JETZT = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now'"

export function jetztIso(): string {
  return new Date().toISOString().slice(0, 19) + 'Z'
}

/** Aus der Meldung eine Zahl machen — oder nichts, wenn dort keine steht. */
/**
 * Eine Zahl, oder ehrlich nichts.
 *
 * `Number(null)` ist **0**, und `0 >= 0` bestand die Prüfung — eine Angabe, die
 * es nicht gab, kam als Zahl Null in der Datenbank an. Bei jedem geöffneten
 * Titel entstand so eine Meldung „Folge 0, Staffel 0" (Daniel, 22.08.2026,
 * viermal beobachtet). Null sieht aus wie eine Angabe, ist aber keine.
 *
 * Dasselbe gilt für den leeren String: `Number('')` ist ebenfalls 0.
 */
export function zahlOderNull(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/**
 * **Berliner Stunde und Datum** (28.09.2026 aus index.ts hierher — die Datei war über der Grenze).
 *
 * Der Versand entscheidet anhand der Berliner Ortszeit, ob die Tages- oder die Wochenmail fällig
 * ist; hour ist die Stunde 0–23, iso das Datum YYYY-MM-DD.
 */
export function berlinParts(date: Date): { hour: number; iso: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { hour: Number(get('hour')) % 24, iso: `${get('year')}-${get('month')}-${get('day')}` }
}
