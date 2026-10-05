/**
 * Der Taktgeber der Schnellmessung: ein Durable Object, das sich per Alarm alle fünf Minuten selbst weckt.
 *
 * Warum nicht ein Cron-Eintrag im Fünf-Minuten-Takt: Der Eintrag war bei Cloudflare registriert (5.10.2026 22:29), feuerte aber in 35 Minuten kein einziges Mal,
 * während `0 * * * *` pünktlich lief. Alarme eines Durable Objects sind dafür gebaut und laufen auch ohne Besucher.
 * Der stündliche Cron stellt nur sicher, dass der Alarm gesetzt ist (`sichereSchnellmessung`).
 */
import { runSchnellmessung, type SchnellEnv } from './schnellmessung.ts'

const TAKT_MS = 5 * 60_000

export class Schnellmesser implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: SchnellEnv,
  ) {}

  /** Setzt den Alarm, falls keiner ansteht. */
  async fetch(): Promise<Response> {
    if ((await this.state.storage.getAlarm()) === null) await this.state.storage.setAlarm(Date.now() + 1000)
    return new Response('ok')
  }

  async alarm(): Promise<void> {
    try {
      console.log(`[schnell] ${await runSchnellmessung(this.env, new Date())}`)
    } catch (err) {
      console.error('[schnell] fehlgeschlagen', err)
    }
    await this.state.storage.setAlarm(Date.now() + TAKT_MS)
  }
}

/** Vom stündlichen Cron aufgerufen: stellt sicher, dass der Taktgeber läuft. */
export async function sichereSchnellmessung(ns: DurableObjectNamespace): Promise<void> {
  await ns.get(ns.idFromName('takt')).fetch('https://schnellmesser/')
}
