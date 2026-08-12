/**
 * Erreichbarkeitsprüfung aller Seiten.
 *
 * Grundgedanke: Der Wächter liegt bei Cloudflare und damit **außerhalb** aller
 * überwachten Hoster (GitHub Pages, Plesk, lima-city). Ein Wächter auf
 * derselben Infrastruktur wie das Bewachte wäre wertlos — fällt sie aus, fällt
 * er mit aus und schweigt.
 *
 * Benachrichtigungen sind bewusst gedeckelt:
 *   - was rot ist, wird im selben Lauf **nachgeprüft** — ein einzelnes 503 aus
 *     einem CDN ist kein Ausfall, aber der Nutzer erfährt einen echten binnen
 *     Minuten und nicht erst zur nächsten vollen Stunde
 *   - höchstens **eine** Störungsmail pro Tag, egal wie oft es scheitert
 *   - **wöchentlich** eine Zusammenfassung, auch wenn alles läuft
 *
 * Die wöchentliche Mail ist kein Bericht, sondern der Lebensnachweis des
 * Wächters. Ohne sie sähe ein ausgefallener Wächter genauso aus wie „alles in
 * Ordnung": still.
 */
import { SITES, type Site } from './sites.ts'

export interface CheckResult {
  site: Site
  ok: boolean
  status: number
  ms: number
  reason?: string
}

/** Cloudflare deckelt gleichzeitige ausgehende Verbindungen — daher in Gruppen. */
const BATCH = 5
const TIMEOUT_MS = 15000

async function checkOne(site: Site): Promise<CheckResult> {
  const started = Date.now()
  try {
    const res = await fetch(site.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'anime-kalender-monitor/1.0 (+https://anime-kalender.de)' },
    })
    const ms = Date.now() - started
    const body = await res.text()

    if (res.status < 200 || res.status >= 300) {
      return { site, ok: false, status: res.status, ms, reason: `HTTP ${res.status}` }
    }
    // Ein 200 mit leerem Rumpf ist der stille Ausfall, den reine
    // Status-Prüfungen übersehen.
    if (site.minBytes && body.length < site.minBytes) {
      return {
        site,
        ok: false,
        status: res.status,
        ms,
        reason: `nur ${body.length} Bytes (erwartet ≥ ${site.minBytes})`,
      }
    }
    if (site.expect && !body.includes(site.expect)) {
      return { site, ok: false, status: res.status, ms, reason: `Text „${site.expect}" fehlt` }
    }
    return { site, ok: true, status: res.status, ms }
  } catch (err) {
    const message = String((err as Error).message ?? err)
    // Abgelaufene oder falsche Zertifikate landen hier ebenfalls — Workers
    // können die Restlaufzeit nicht auslesen, wohl aber den Fehlschlag.
    return {
      site,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      reason: /timed? ?out|aborted/i.test(message) ? `keine Antwort nach ${TIMEOUT_MS / 1000}s` : message.slice(0, 80),
    }
  }
}

export async function checkAllSites(): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for (let i = 0; i < SITES.length; i += BATCH) {
    results.push(...(await Promise.all(SITES.slice(i, i + BATCH).map(checkOne))))
  }
  return results
}

/**
 * Wie oft eine rote Seite nachgeprüft wird und in welchem Abstand.
 *
 * Zwei zusätzliche Versuche mit je 45 Sekunden Pause: Eine Störung ist damit
 * nach spätestens anderthalb Minuten bestätigt statt nach einer Stunde, und ein
 * Aussetzer wie das Fastly-503 vom 11.08.2026 fällt trotzdem durchs Raster.
 *
 * Warum das im Worker gefahrlos ist: Cloudflare rechnet Wartezeit **nicht** auf
 * die CPU-Zeit an („Waiting on network requests does not count toward CPU
 * time"), und ein Cron-Lauf darf bis zu 15 Minuten dauern. Nachgeprüft werden
 * ohnehin nur die roten Seiten — im Normalfall keine.
 */
const RECHECKS = 2
const RECHECK_PAUSE_MS = 45_000

const schlafe = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Prüft rote Seiten im selben Lauf noch einmal nach.
 *
 * Gibt für jede Seite zurück, ob sie **durchgehend** rot blieb. Antwortet sie
 * bei einem der Versuche wieder, war es ein Aussetzer — dann zählt das Ergebnis
 * des letzten Versuchs, und es geht keine Mail hinaus.
 *
 * Der frühere Weg lief über einen Zähler in der Datenbank: erst der zweite rote
 * Lauf galt als Störung. Das kostete bei stündlichem Takt bis zu einer Stunde
 * Verzug — zu viel für einen Wächter, dessen Zweck es ist, früh Bescheid zu
 * sagen.
 */
export async function confirmOutages(rot: CheckResult[]): Promise<CheckResult[]> {
  if (!rot.length) return []
  let verdaechtig = rot
  for (let runde = 1; runde <= RECHECKS && verdaechtig.length; runde++) {
    await schlafe(RECHECK_PAUSE_MS)
    const erneut = await Promise.all(verdaechtig.map((r) => checkOne(r.site)))
    // Wer jetzt antwortet, fliegt raus; der Rest geht in die nächste Runde.
    verdaechtig = erneut.filter((r) => !r.ok)
  }
  return verdaechtig
}
