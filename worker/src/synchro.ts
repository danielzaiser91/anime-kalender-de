/**
 * **Die Farb-Auskunft für die Crunchyroll-Watchlist** (30.09.2026) — `POST /synchro`.
 *
 * Warum es diese Route gibt, steht in `shared/synchro.ts`: Crunchyrolls Watchlist-Text („Jetzt/
 * Erneut anschauen") trug monatelang die deutsche Verfügbarkeit mit und zählt seit einem Update
 * jede Synchro. Die Erweiterung entscheidet deshalb nicht mehr nach diesem Text, sondern fragt hier.
 *
 * Bewusst schlank und zustandslos: **eine** Anfrage mit allen sichtbaren Watchlist-Einträgen,
 * **eine** Antwort mit ebenso vielen Farben. Kein Abo, kein Zwischenspeicher in der Erweiterung,
 * keine Datenbank — gelesen wird die gebaute Datei (`public/data/synchro.json`) mit kurzer
 * Cloudflare-Zwischenspeicherung, damit ein voller Watchlist-Aufbau nicht jedes Mal den Ursprung trifft.
 *
 * Nicht geheim: Die Antwort enthält nur, was auch auf der Website steht. Geschützt ist sie durch
 * POST-Pflicht, eine Obergrenze je Anfrage und `no-store` — wer sie missbraucht, fällt auf.
 */
import { farbeFuer, type SynchroDaten, type SynchroEintrag } from '../../shared/synchro.ts'

const QUELLE = 'https://anime-kalender.de/data/synchro.json'
/** Obergrenze je Anfrage — eine Watchlist ist klein, ein Missbrauch soll nicht durchgehen. */
const MAX_EINTRAEGE = 500

const KOPF = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
}

function fehler(text: string, status: number): Response {
  return new Response(JSON.stringify({ error: text }), { status, headers: KOPF })
}

export async function handleSynchro(request: Request): Promise<Response> {
  if (request.method !== 'POST') return fehler('POST erwartet', 405)

  let koerper: { eintraege?: SynchroEintrag[] }
  try {
    koerper = await request.json()
  } catch {
    return fehler('Ungültige Anfrage.', 400)
  }
  const eintraege = (koerper.eintraege ?? []).slice(0, MAX_EINTRAEGE)

  const antwort = await fetch(QUELLE, { cf: { cacheTtl: 60, cacheEverything: true } })
  if (!antwort.ok) return fehler('Quelle nicht erreichbar', 503)
  const daten = (await antwort.json()) as SynchroDaten
  if (daten.v !== 1) return fehler('Unbekannte Fassung', 503)

  const jetzt = Date.now()
  return new Response(JSON.stringify({ stand: daten.erzeugtAm, farben: eintraege.map((e) => farbeFuer(e, daten, jetzt)) }), {
    headers: KOPF,
  })
}
