/**
 * **Lese-Deckel für jede Anfrage** (15.10.2026).
 *
 * Bis heute zählte nur die Meldungs-Route (`mitTagesdeckel`) ihre gelesenen Zeilen. Die Lese-Routen liefen am
 * Zähler vorbei, darunter `GET /pruefung?token=` (`offenePruefungen`, rund 36.000 Zeilen je Aufruf), den die
 * Erweiterung auf jeder Prime-Seite rief: Am 15.10.2026 waren um 12:48 MESZ 6,72 Mio. Zeilen gelesen, D1 stand
 * bis 02:00 MESZ.
 *
 * Jetzt läuft jede Anfrage über eine zählende Datenbank (`zaehlendeDb`, auch `first()`), und ihre gelesenen
 * Zeilen fließen in denselben Tageszähler `schreib_tag.gelesen`. Ab `DECKEL_LESEN` bekommen die Routen der
 * Werkzeuge (`GEDECKELT`) ohne gültiges Token beim ersten D1-Zugriff 429 — was aus dem Cache kommt, berührt D1
 * nicht und wird weiter ausgeliefert. Frei bleiben Token-Anfragen (Bau, Läufe, Meldungen unter ihrem eigenen
 * Deckel) und alles für Besucher (Newsletter samt Abmeldung, Push, Favoriten, Kalender-Abo, Health): Ihnen
 * bleibt die Reserve zwischen `DECKEL_LESEN` und dem Kontingent.
 *
 * Der Riegel je Anfrage (`RIEGEL_LESEN_JE_ANFRAGE`) bleibt bei den Meldungen: Der Bau liest legitim rund
 * 36.000 Zeilen in einer Anfrage und würde mit ihm den ganzen Tag sperren.
 *
 * **Gebucht wird gesammelt:** Je Isolate laufen die Zeilen auf, gebucht wird ab `BUCHEN_AB`. Eine Buchung je
 * Anfrage schriebe bei Zehntausenden kleiner Anfragen ebenso viele Zeilen ins Schreib-Kontingent (100.000 am
 * Tag); so sind es höchstens Kontingent / `BUCHEN_AB` = 5.000. Ein beendeter Isolate verliert weniger als
 * `BUCHEN_AB` Zeilen.
 */
import { type Env } from './env.ts'
import { tokenGleich, tokenMitUebergang } from './lauf-token.ts'
import { DECKEL_LESEN, deckelAntwort, heutigerStand, utcTag, verbuchen, zaehlendeDb } from './tagesdeckel.ts'

export const BUCHEN_AB = 1_000

/**
 * Routen der Erweiterung: ohne gültiges Token ab `DECKEL_LESEN` gesperrt. `/lauf`, `/verlauf` und `/status` fehlen
 * absichtlich (15.10.2026): zusammen unter 30.000 Zeilen am Tag, mit Sperre wäre die Statusanzeige am Deckel blind.
 * Ihre Lesungen zählen weiter (`zaehlendeDb` zählt jede Anfrage), nur die 429 entfällt.
 */
export const GEDECKELT = ['/pruefung', '/netzfund', '/vorfall']

/** Gelesene Zeilen dieses Isolates, die noch nicht im Tageszähler stehen. */
let ungebucht = 0

class DeckelErreicht extends Error {}

/** Mit gültigem Token (Bau, Läufe, Meldungen, Wartung) oder für Besucher: nie vom Lese-Deckel gesperrt. */
export function istFrei(request: Request, env: Env): boolean {
  const url = new URL(request.url)
  if (!GEDECKELT.includes(url.pathname)) return true
  const token = tokenMitUebergang(request)
  return token !== '' && (tokenGleich(token, env.LAUF_TOKEN) || tokenGleich(token, env.DEBUG_TOKEN))
}

/** Führt `lauf` mit zählender Datenbank aus; gesperrte Routen bekommen am Deckel 429 mit dem Kopf `kopf`. */
export async function mitLesedeckel(
  request: Request,
  env: Env,
  kopf: Record<string, string>,
  lauf: (env: Env) => Promise<Response>,
  jetzt = new Date(),
): Promise<Response> {
  let gesperrt = false
  /* Einmal je Anfrage, beim ersten D1-Zugriff; jeder weitere wartet auf dasselbe Ergebnis (auch den Fehler). */
  const pruefe = async () => {
    if ((await heutigerStand(env, utcTag(jetzt))).gelesen < DECKEL_LESEN) return
    gesperrt = true
    throw new DeckelErreicht()
  }
  let geprueft: Promise<void> | null = null
  const zaehler = zaehlendeDb(env.DB, istFrei(request, env) ? undefined : () => (geprueft ??= pruefe()))
  const antwort = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: kopf })
  try {
    const r = await lauf({ ...env, DB: zaehler.db })
    /* Die Route hat den Fehler gefangen: Am Deckel bleibt es trotzdem die 429. */
    return gesperrt ? deckelAntwort(antwort, jetzt) : r
  } catch (e) {
    if (gesperrt) return deckelAntwort(antwort, jetzt)
    throw e
  } finally {
    await sammleUndBuche(env, utcTag(jetzt), zaehler.zeilen().gelesen)
  }
}

/** Sammelt die gelesenen Zeilen der Anfrage und bucht ab `BUCHEN_AB` alles Gesammelte in einem Upsert. */
async function sammleUndBuche(env: Env, tag: string, gelesen: number): Promise<void> {
  ungebucht += gelesen
  if (ungebucht < BUCHEN_AB) return
  const menge = ungebucht
  ungebucht = 0
  await verbuchen(env, tag, { geschrieben: 0, gelesen: menge })
}

/** Nur für Tests: der Sammelstand des Isolates. */
export function ungebuchtFuerTest(neu?: number): number {
  if (neu !== undefined) ungebucht = neu
  return ungebucht
}
