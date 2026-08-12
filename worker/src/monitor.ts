/**
 * Erreichbarkeitsprüfung aller Seiten.
 *
 * Grundgedanke: Der Wächter liegt bei Cloudflare und damit **außerhalb** aller
 * überwachten Hoster (GitHub Pages, Plesk, lima-city). Ein Wächter auf
 * derselben Infrastruktur wie das Bewachte wäre wertlos — fällt sie aus, fällt
 * er mit aus und schweigt.
 *
 * Benachrichtigungen sind bewusst gedeckelt:
 *   - eine Seite gilt erst als gestört, wenn sie **zwei** Läufe hintereinander
 *     nicht antwortet — ein einzelnes 503 aus einem CDN ist kein Ausfall
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
