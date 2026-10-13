import { type Env } from './env.ts'

/**
 * **Die Vollexporte des Baus liegen in R2, nicht im Cache der Edge.**
 *
 * `caches.default` gilt je Rechenzentrum; die GitHub-Läufe kommen aus wechselnden und treffen ihn
 * kaum — am 05.10.2026 las der Export 2,8 Mio. Zeilen am Tag (586 Seitenabrufe, Kontingent 5 Mio.).
 * R2 ist für alle Rechenzentren derselbe Ort.
 *
 * Ein Schreibzugriff setzt nur eine Marke (`export/_ungueltig`); ein Auszug gilt danach noch `FRIST_MS`,
 * dann wird er beim nächsten Abruf neu gerechnet. Der Bau fragt höchstens alle paar Minuten, die
 * Erweiterung meldet fast im Minutentakt — ohne Frist rechnete jede Meldung den ganzen Auszug neu
 * (gemessen 05.10.2026: rund 100.000 gelesene Zeilen je Stunde).
 *
 * **Die Marke setzt nur, was Zeilen geändert hat** (12.10.2026): Abhaken berührt nur `uebernommen`, und das
 * enthält allein der Auszug `offen-*` (Marke `export/_ungueltig-offen`); `alle-*`, `pruefung-alle-*` und `namen`
 * lesen die Spalte nicht. Jede Marke wird höchstens einmal in `MARKE_ABSTAND_MS` geschrieben (Merker je
 * Isolate). Ein Auszug gilt deshalb erst als frisch, wenn er mehr als `MARKE_ABSTAND_MS` nach der Marke
 * gebaut wurde; sonst kann eine übersprungene Änderung fehlen, und es gilt die Frist.
 */
const VORSATZ = 'export/'
const MARKE = VORSATZ + '_ungueltig'
const MARKE_OFFEN = VORSATZ + '_ungueltig-offen'
const MARKE_ABSTAND_MS = 60_000
/** Wann welche Marke zuletzt geschrieben wurde (je Isolate; ein neuer Isolate schreibt sofort). */
const letzteMarke = new Map<string, number>()
const FRIST_MS = 10 * 60_000
/** Die Serienamen je Adresse (`namen`) lesen die ganze Tabelle `pruefung` (17.533 Zeilen, 22 Abrufe am 12.10.2026) und ändern sich selten. */
export const FRIST_NAMEN_MS = 6 * 60 * 60_000

export async function ausSpeicher(
  env: Env,
  schluessel: string,
  bauen: () => Promise<unknown>,
  fristMs: number = FRIST_MS,
): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const treffer = await env.BELEGE?.get(VORSATZ + schluessel)
  if (treffer) {
    const marke = await juengsteMarke(env, schluessel)
    const alt = treffer.uploaded.getTime()
    if (marke + MARKE_ABSTAND_MS <= alt || Date.now() - alt < fristMs) return new Response(await treffer.text(), { headers: kopf })
  }
  const text = JSON.stringify(await bauen())
  await env.BELEGE?.put(VORSATZ + schluessel, text)
  return new Response(text, { headers: kopf })
}

/** Der Zeitpunkt der jüngsten Marke, die diesen Auszug betrifft (0: keine); `offen-*` hängt an beiden Marken. */
async function juengsteMarke(env: Env, schluessel: string): Promise<number> {
  const marken = schluessel.startsWith('offen-') ? [MARKE, MARKE_OFFEN] : [MARKE]
  const koepfe = await Promise.all(marken.map((m) => env.BELEGE?.head(m)))
  return Math.max(0, ...koepfe.map((k) => k?.uploaded.getTime() ?? 0))
}

/**
 * Die Marke ist nur ein Hinweis: scheitert sie (R2 erlaubt einen Schreibzugriff je Sekunde und Schlüssel), gilt die Frist.
 * `'alle'` verwirft jeden Auszug (Meldung oder Löschen haben Zeilen geändert), `'offen'` nur `offen-*` (Abhaken).
 */
export async function exporteVerwerfen(env: Env, art: 'alle' | 'offen' = 'alle'): Promise<void> {
  const marke = art === 'offen' ? MARKE_OFFEN : MARKE
  const jetzt = Date.now()
  if (jetzt - (letzteMarke.get(marke) ?? 0) < MARKE_ABSTAND_MS) return
  try {
    await env.BELEGE?.put(marke, new Date(jetzt).toISOString())
    letzteMarke.set(marke, jetzt)
  } catch (e) {
    console.error(`export marke: ${(e as Error)?.name ?? 'Fehler'}`)
  }
}
