/**
 * **Tageszähler für Feed-Abrufe** (B5, 23.10.2026): Abrufe je UTC-Tag und Zahl verschiedener Token, damit die
 * Annahme „8 Abrufe je Abo und Tag“ (A6) gemessen werden kann.
 *
 * Verschiedene Token zählt ein HyperLogLog mit 256 Registern über den SHA-256 des Tokens (Fehler rund 6,5 %,
 * kein Token liegt in der Datenbank). Gebucht wird gesammelt wie beim Lesedeckel: je Isolate laufen Abrufe und
 * angehobene Register auf, ein Upsert-Stapel schreibt sie ab `BUCHEN_AB` Abrufen oder nach `BUCHEN_NACH_MS`,
 * nie öfter als alle `MIN_ABSTAND_MS`.
 * Schreibzeilen je Stapel: 1 (Abrufe) + Zahl der angehobenen Register (höchstens 256), je Abruf also
 * deutlich unter 1. Ein Fehler beim Buchen bricht nie den Feed ab; das Gesammelte bleibt für den nächsten Versuch
 * (Tageswechsel: der alte Tag wird einmal versucht, dann verworfen).
 */
import { type Env } from './env.ts'

export const BUCHEN_AB = 500
export const BUCHEN_NACH_MS = 10 * 60_000
/** Frühestens so oft wird gebucht, auch nach einem Fehler (fehlt die Tabelle, scheitert nicht jeder Abruf). */
export const MIN_ABSTAND_MS = 60_000
export const REGISTER = 256
const ABRUFE = -1
const AUFBEWAHREN_TAGE = 30

export type Sammler = { tag: string; abrufe: number; register: Map<number, number>; zuletztGebucht: number }

export const neuerSammler = (): Sammler => ({ tag: '', abrufe: 0, register: new Map(), zuletztGebucht: 0 })
const standard = neuerSammler()

export const utcTag = (d: Date): string => d.toISOString().slice(0, 10)

/** Register und Rang aus dem Token-Hash: Byte 0 wählt das Register, die nächsten 32 Bit den Rang. */
export async function registerUndRang(token: string): Promise<{ reg: number; rang: number }> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  const w = ((b[1] << 24) | (b[2] << 16) | (b[3] << 8) | b[4]) >>> 0
  return { reg: b[0], rang: w === 0 ? 33 : Math.clz32(w) + 1 }
}

/** Schätzung verschiedener Token aus den Registern (fehlende Register zählen 0). */
export function schaetzeTokens(register: ReadonlyMap<number, number>): number {
  let summe = 0
  let leer = 0
  for (let i = 0; i < REGISTER; i++) {
    const wert = register.get(i) ?? 0
    if (wert === 0) leer++
    summe += 2 ** -wert
  }
  const alpha = 0.7213 / (1 + 1.079 / REGISTER)
  const roh = (alpha * REGISTER * REGISTER) / summe
  return Math.round(roh <= 2.5 * REGISTER && leer > 0 ? REGISTER * Math.log(REGISTER / leer) : roh)
}

async function buche(env: Env, s: Sammler): Promise<void> {
  const upsertMax = `INSERT INTO feed_abrufe (tag, reg, wert) VALUES (?1, ?2, ?3)
    ON CONFLICT(tag, reg) DO UPDATE SET wert = max(wert, ?3)`
  const alt = new Date(`${s.tag}T00:00:00Z`)
  alt.setUTCDate(alt.getUTCDate() - AUFBEWAHREN_TAGE)
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO feed_abrufe (tag, reg, wert) VALUES (?1, ?2, ?3)
       ON CONFLICT(tag, reg) DO UPDATE SET wert = wert + ?3`,
    ).bind(s.tag, ABRUFE, s.abrufe),
    ...[...s.register].map(([reg, rang]) => env.DB.prepare(upsertMax).bind(s.tag, reg, rang)),
    env.DB.prepare('DELETE FROM feed_abrufe WHERE tag < ?1').bind(utcTag(alt)),
  ])
}

/** Bucht das Gesammelte; bei Fehler bleibt es stehen (begrenzt: ein Zähler und höchstens 256 Register). */
async function leere(env: Env, s: Sammler, jetzt: number): Promise<void> {
  if (s.abrufe === 0) return
  try {
    await buche(env, s)
  } catch (e) {
    console.warn('FEED-ZAEHLER: Buchen fehlgeschlagen', e)
    s.zuletztGebucht = jetzt
    return
  }
  s.abrufe = 0
  s.register.clear()
  s.zuletztGebucht = jetzt
}

/** Zählt einen Feed-Abruf. Wirft nie: der Feed hat Vorrang vor der Zählung. */
export async function zaehleFeedAbruf(env: Env, token: string, jetzt: Date, s: Sammler = standard): Promise<void> {
  try {
    const tag = utcTag(jetzt)
    const ms = jetzt.getTime()
    if (s.tag !== tag) {
      await leere(env, s, ms)
      s.abrufe = 0 /* der alte Tag wurde einmal versucht, nie mit dem neuen vermischen */
      s.register.clear()
      s.tag = tag
      s.zuletztGebucht = ms
    }
    const { reg, rang } = await registerUndRang(token)
    s.abrufe++
    if (rang > (s.register.get(reg) ?? 0)) s.register.set(reg, rang)
    const seit = ms - s.zuletztGebucht
    if (seit >= MIN_ABSTAND_MS && (s.abrufe >= BUCHEN_AB || seit >= BUCHEN_NACH_MS)) await leere(env, s, ms)
  } catch (e) {
    console.warn('FEED-ZAEHLER aus', e)
  }
}

/** Abrufe und geschätzte verschiedene Token eines Tages (Auswertung für A6). */
export async function leseFeedAbrufe(env: Env, tag: string): Promise<{ abrufe: number; tokens: number }> {
  const { results } = await env.DB.prepare('SELECT reg, wert FROM feed_abrufe WHERE tag = ?1').bind(tag).all<{ reg: number; wert: number }>()
  const register = new Map<number, number>()
  let abrufe = 0
  for (const r of results ?? []) {
    if (r.reg === ABRUFE) abrufe = r.wert
    else register.set(r.reg, r.wert)
  }
  return { abrufe, tokens: schaetzeTokens(register) }
}

export const FEED_PFAD = '/feed/favoriten.ics'

/** Zählt die Anfrage, wenn sie ein Feed-Abruf mit Adresse ist; vor Cache und Datenbank, also auch Treffer des Edge-Caches. */
export async function zaehleWennFeed(request: Request, env: Env, jetzt: Date, s: Sammler = standard): Promise<void> {
  const url = new URL(request.url)
  const k = (url.searchParams.get('k') ?? '').trim()
  if (url.pathname === FEED_PFAD && k) await zaehleFeedAbruf(env, k, jetzt, s)
}
