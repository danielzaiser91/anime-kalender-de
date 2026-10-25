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

/** Positivliste: HTTP-Status außer 403/429 (Abwehr, beweist nichts) und Amazons Regionssatz; `unklar`, `timeout`, `fehler` zählen nicht. Die einzige Regel für „echte Auskunft“. */
export function istAuskunft(status: unknown): boolean {
  if (status === 'region') return true
  return typeof status === 'number' && status !== 403 && status !== 429
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
