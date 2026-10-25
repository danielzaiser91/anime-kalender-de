/**
 * **Ein Befund gehört der Seite, nicht ihrer Schreibweise** (29.09.2026).
 *
 * Dieselbe Amazon-Seite wird unter zwei Adressformen gemessen — `/dp/<ASIN>` und
 * `/gp/video/detail/<ASIN>` — und beide können **verschiedene** Ergebnisse tragen. Bei „The Dragon
 * Dentist" (87539) stand `/dp/B0FXJQFN8R` als 200 vom 20.09. und `/gp/video/detail/B0FXJQFN8R` als
 * „region" vom 28.09.: Der Bau sah den älteren Eintrag, die Prüfung den jüngeren — dieselbe Seite,
 * zwei Urteile.
 *
 * Deshalb gibt es **eine** Stelle, die den Befund je Seite bestimmt: `adressKern` fasst zusammen,
 * der **jüngste** Messwert entscheidet. Bau und `check:tote-adressen` benutzen beide diese Funktion,
 * damit die Regel nicht wieder auseinanderläuft.
 */
import { adressKern } from './dub-confirmed.ts'

export interface LinkBefund {
  status: number | string
  prime?: boolean
  geprueftAm?: string
}

/**
 * Die einzige Regel für „echte Auskunft“: HTTP-Status unter 500 außer 403/429 (Abwehr, beweist nichts) und
 * Amazons Regionssatz. 5xx (500, 503 …) heißt „Dienst nicht erreichbar“ und sagt nichts über die Adresse;
 * `unklar`, `timeout`, `fehler` zählen ebenfalls nicht.
 */
export function istAuskunft(status: unknown): boolean {
  if (status === 'region') return true
  return typeof status === 'number' && status < 500 && status !== 403 && status !== 429
}

/** Unbrauchbare Adresse: 404 oder Regionssperre (eine endgültige Auskunft, nie eine Nichtauskunft). */
export function istTot(status: unknown): boolean {
  return status === 404 || status === 'region'
}

/** Der jüngste Befund je Seite (`adressKern`) — der ältere derselben Seite fällt weg. */
export function juengsteJeKern(befunde: Record<string, LinkBefund>): Map<string, LinkBefund> {
  const karte = new Map<string, LinkBefund>()
  for (const [url, befund] of Object.entries(befunde)) {
    const k = adressKern(url)
    const alt = karte.get(k)
    if (!alt || String(befund.geprueftAm ?? '') > String(alt.geprueftAm ?? '')) karte.set(k, befund)
  }
  return karte
}

/**
 * Ob eine Adresse im Link-Lauf dran ist: nie geprüft, `unklar` oder 5xx (Dienst nicht erreichbar, sagt
 * nichts über die Adresse) sind beim nächsten Lauf wieder fällig, alles andere erst nach `grenze` (ISO-Datum).
 */
export function istFaellig(alt: LinkBefund | undefined, grenze: string): boolean {
  if (!alt || alt.status === 'unklar') return true
  if (typeof alt.status === 'number' && alt.status >= 500) return true
  return (alt.geprueftAm ?? 'z') < grenze
}
