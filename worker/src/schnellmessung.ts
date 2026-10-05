/**
 * Schnellmessung: alle fünf Minuten die Seite und ihre Kerndatei abrufen und Zeit bis zum ersten Byte und Gesamtzeit speichern.
 *
 * Der stündliche Wächter (`monitor.ts`) sieht einen Lag von wenigen Sekunden nicht — er misst einmal pro Stunde. Diese Messung
 * liefert den Verlauf („wann, wie oft, wie lang") und einen Alarm, wenn mehrere Messungen hintereinander schlecht sind.
 * Der Abruf läuft bei Cloudflare, also außerhalb von GitHub Pages; er zeigt, was ein Besucher von außen erreicht.
 */
import { sendMail, type Mail, type MailEnv } from './mail.ts'
import { LANGSAM_MS, SCHLECHT_IN_FOLGE, alarmEntscheidung } from '../../shared/schnellmessung-regeln.ts'

export interface Probe {
  name: string
  url: string
  minBytes: number
}

export const PROBEN: Probe[] = [
  { name: 'Seite', url: 'https://anime-kalender.de/', minBytes: 500 },
  { name: 'Daten', url: 'https://anime-kalender.de/data/titles-core.json', minBytes: 1000 },
]

const TIMEOUT_MS = 15000
const AUFBEWAHREN_TAGE = 14

export interface Messung {
  url: string
  ok: boolean
  status: number
  ttfbMs: number
  totalMs: number
  grund?: string
}

export async function messe(probe: Probe): Promise<Messung> {
  const start = Date.now()
  try {
    const res = await fetch(probe.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'anime-kalender-monitor/1.0 (+https://anime-kalender.de)' },
    })
    const ttfbMs = Date.now() - start
    const laenge = (await res.arrayBuffer()).byteLength
    const totalMs = Date.now() - start
    if (res.status < 200 || res.status >= 300) return { url: probe.url, ok: false, status: res.status, ttfbMs, totalMs, grund: `HTTP ${res.status}` }
    if (laenge < probe.minBytes) return { url: probe.url, ok: false, status: res.status, ttfbMs, totalMs, grund: `nur ${laenge} Bytes` }
    return { url: probe.url, ok: true, status: res.status, ttfbMs, totalMs }
  } catch (err) {
    const totalMs = Date.now() - start
    return { url: probe.url, ok: false, status: 0, ttfbMs: totalMs, totalMs, grund: String((err as Error).message ?? err).slice(0, 80) }
  }
}

/** Was GitHub selbst zu Pages meldet (githubstatus.com), damit ein Alarm sofort zeigt, ob der Hoster gestört ist oder wir. */
export async function githubPagesStatus(): Promise<string> {
  try {
    const res = await fetch('https://www.githubstatus.com/api/v2/summary.json', { signal: AbortSignal.timeout(8000) })
    const j = (await res.json()) as { components?: { name: string; status: string }[]; incidents?: { name: string; status: string }[] }
    const pages = j.components?.find((c) => c.name === 'Pages')?.status ?? 'unbekannt'
    const vorfaelle = (j.incidents ?? []).map((i) => `${i.name} (${i.status})`).join('; ')
    return `GitHub Pages laut githubstatus.com: ${pages}${vorfaelle ? `; offene Vorfälle: ${vorfaelle}` : '; keine offenen Vorfälle'}`
  } catch (err) {
    return `githubstatus.com nicht abrufbar (${String((err as Error).message ?? err).slice(0, 60)})`
  }
}

export interface SchnellEnv extends MailEnv {
  DB: D1Database
  MONITOR_EMAIL?: string
}

export async function runSchnellmessung(env: SchnellEnv, now: Date): Promise<string> {
  const nowIso = now.toISOString()
  const messungen = await Promise.all(PROBEN.map(messe))
  await env.DB.batch([
    ...messungen.map((m) =>
      env.DB.prepare('INSERT OR IGNORE INTO site_probe (url, checked_at, ok, status, ttfb_ms, total_ms, grund) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(
        m.url, nowIso, m.ok ? 1 : 0, m.status, m.ttfbMs, m.totalMs, m.grund ?? null,
      ),
    ),
    env.DB.prepare('DELETE FROM site_probe WHERE checked_at < ?1').bind(new Date(now.getTime() - AUFBEWAHREN_TAGE * 86_400_000).toISOString()),
  ])
  const meldungen: string[] = []
  for (const probe of PROBEN) meldungen.push(await alarmPruefen(env, probe, nowIso))
  return meldungen.join(' | ')
}

async function alarmPruefen(env: SchnellEnv, probe: Probe, nowIso: string): Promise<string> {
  const { results } = await env.DB.prepare('SELECT ok, total_ms, grund FROM site_probe WHERE url = ?1 ORDER BY checked_at DESC LIMIT ?2').bind(probe.url, SCHLECHT_IN_FOLGE).all<{ ok: number; total_ms: number; grund: string | null }>()
  const letzte = results ?? []
  const offen = await env.DB.prepare('SELECT id FROM monitor_alarm WHERE url = ?1 AND geschlossen_am IS NULL').bind(probe.url).first<{ id: number }>()
  const entscheidung = alarmEntscheidung(letzte, Boolean(offen))
  if (entscheidung === 'zu' && offen) {
    await env.DB.prepare('UPDATE monitor_alarm SET geschlossen_am = ?1 WHERE id = ?2').bind(nowIso, offen.id).run()
    return `${probe.name}: Alarm geschlossen`
  }
  if (entscheidung !== 'auf') return `${probe.name}: ${letzte[0]?.total_ms ?? '?'} ms`
  const hoster = await githubPagesStatus()
  const grund = `${letzte[0]?.grund ?? `langsamer als ${LANGSAM_MS} ms`}; ${hoster}`
  await env.DB.prepare('INSERT INTO monitor_alarm (url, seit, grund) VALUES (?1, ?2, ?3)').bind(probe.url, nowIso, grund).run()
  if (env.MONITOR_EMAIL) {
    const mail: Mail = {
      to: env.MONITOR_EMAIL,
      subject: `Anime-Kalender: ${probe.name} antwortet schlecht`,
      text: `${probe.url}\nSeit drei Messungen in Folge (je 5 Minuten Abstand) zu langsam oder nicht erreichbar.\nLetzter Grund: ${grund}\nAuswertung: Tabellen site_probe und monitor_alarm in der Datenbank.`,
      html: `<p><b>${probe.url}</b></p><p>Seit drei Messungen in Folge (je 5 Minuten Abstand) zu langsam oder nicht erreichbar.</p><p>Letzter Grund: ${grund}</p>`,
      fromName: 'Anime-Kalender Wächter',
    }
    await sendMail(env, mail).catch((e) => console.error('[schnell] Mail fehlgeschlagen', e))
  }
  return `${probe.name}: ALARM (${grund})`
}
