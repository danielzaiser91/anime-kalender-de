/**
 * **Tageszähler für Feed-Abrufe** (B5, 23.10.2026): Abrufe je UTC-Tag und Zahl verschiedener Token, damit die
 * Annahme „8 Abrufe je Abo und Tag“ (A6) gemessen werden kann.
 *
 * Verschiedene Token zählt ein HyperLogLog mit 256 Registern über den SHA-256 des Tokens (Fehler rund 6,5 %,
 * kein Token liegt in der Datenbank). Gebucht wird gesammelt wie beim Lesedeckel: je Isolate laufen Abrufe und
 * angehobene Register auf, ein Upsert-Stapel schreibt sie ab `BUCHEN_AB` Abrufen oder nach `BUCHEN_NACH_MS`,
 * nie öfter als alle `MIN_ABSTAND_MS`.
 * Schreibzeilen je Stapel: 1 (Abrufe) + angehobene Register (höchstens 256) + 1 (Buchung in `schreib_tag`, damit der
 * Schreib-Deckel mitzählt) und ein DELETE alter Tage: höchstens 259, je Abruf also deutlich unter 1. Ein Isolate
 * schreibt nie mehr als `MAX_ZEILEN_TAG` Zeilen am Tag (danach ist der Zähler bis 00:00 UTC aus) und wiederholt kein
 * Register, das es schon geschrieben hat; Zufalls-Token verbrauchen so höchstens diese Grenze je Isolate. Ein Fehler beim Buchen bricht nie den Feed ab; das Gesammelte bleibt für den nächsten Versuch
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

/** Obergrenze der Schreibzeilen je Isolate und Tag: Zufalls-Token (404) dürfen das Kontingent nicht verbrauchen. */
export const MAX_ZEILEN_TAG = 1000

/** `gebucht`: Register, die dieser Isolate heute schon geschrieben hat (nur Anhebungen gehen erneut in einen Stapel). */
export type Sammler = {
  tag: string
  abrufe: number
  register: Map<number, number>
  zuletztGebucht: number
  gebucht: Map<number, number>
  zeilen: number
  aus: boolean
}

export const neuerSammler = (): Sammler => ({
  tag: '',
  abrufe: 0,
  register: new Map(),
  zuletztGebucht: 0,
  gebucht: new Map(),
  zeilen: 0,
  aus: false,
})
const standard = neuerSammler()

export const utcTag = (d: Date): string => d.toISOString().slice(0, 10)

/** Register und Rang aus dem Token-Hash: Byte 0 wählt das Register, die nächsten 32 Bit den Rang. */
export async function registerUndRang(token: string): Promise<{ reg: number; rang: number }> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  const w = ((b[1] << 24) | (b[2] << 16) | (b[3] << 8) | b[4]) >>> 0
  return { reg: b[0], rang: rangVon(w) }
}

/** Rang = Stelle der ersten 1 in 32 Bit (1 bis 32), bei 0 gilt 33. */
export const rangVon = (w: number): number => (w === 0 ? 33 : Math.clz32(w) + 1)

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

type Stand = { tag: string; abrufe: number; register: Map<number, number> }

/** Schreibzeilen eines Stapels: Abrufe, Register und die Buchung im Schreib-Deckel (ohne das DELETE alter Tage). */
const zeilenVon = (stand: Stand): number => stand.register.size + 2

async function buche(env: Env, stand: Stand): Promise<void> {
  const upsertMax = `INSERT INTO feed_abrufe (tag, reg, wert) VALUES (?1, ?2, ?3)
    ON CONFLICT(tag, reg) DO UPDATE SET wert = max(wert, ?3)`
  const alt = new Date(`${stand.tag}T00:00:00Z`)
  alt.setUTCDate(alt.getUTCDate() - AUFBEWAHREN_TAGE)
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO feed_abrufe (tag, reg, wert) VALUES (?1, ?2, ?3)
       ON CONFLICT(tag, reg) DO UPDATE SET wert = wert + ?3`,
    ).bind(stand.tag, ABRUFE, stand.abrufe),
    ...[...stand.register].map(([reg, rang]) => env.DB.prepare(upsertMax).bind(stand.tag, reg, rang)),
    /* Dieselbe Zeilenzahl im Tageszähler des Schreib-Deckels (tagesdeckel.ts), damit er den Zähler mitzählt. */
    env.DB.prepare(
      `INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?1, ?2, 0)
       ON CONFLICT(tag) DO UPDATE SET zeilen = zeilen + ?2`,
    ).bind(stand.tag, zeilenVon(stand)),
    env.DB.prepare('DELETE FROM feed_abrufe WHERE tag < ?1').bind(utcTag(alt)),
  ])
}

/**
 * Entnimmt das Gesammelte sofort, vor jedem `await`: Ein Isolate bedient Anfragen nebenläufig, gleichzeitige
 * Abrufe buchen so nichts doppelt und zählen während des Stapels in den frischen Sammler.
 */
function entnimm(s: Sammler, jetzt: number): Stand {
  const stand = { tag: s.tag, abrufe: s.abrufe, register: new Map(s.register) }
  s.abrufe = 0
  s.register.clear()
  s.zuletztGebucht = jetzt
  return stand
}

/** Bei Fehler wandert der Stand zurück in den Sammler (begrenzt: ein Zähler und höchstens 256 Register). */
function gibZurueck(s: Sammler, stand: Stand): void {
  s.abrufe += stand.abrufe
  for (const [reg, rang] of stand.register) if (rang > (s.register.get(reg) ?? 0)) s.register.set(reg, rang)
}

/** Bucht den Stand; `false` bei Fehler. */
async function versuche(env: Env, stand: Stand): Promise<boolean> {
  if (stand.abrufe === 0) return true
  try {
    await buche(env, stand)
    return true
  } catch (e) {
    console.warn('FEED-ZAEHLER: Buchen fehlgeschlagen', e)
    return false
  }
}

/** Bucht den Stand des laufenden Tages unter der Tagesgrenze der Schreibzeilen; am Limit ist der Zähler für den Tag aus. */
async function buecheStand(env: Env, s: Sammler, stand: Stand): Promise<void> {
  const zeilen = zeilenVon(stand)
  if (s.zeilen + zeilen > MAX_ZEILEN_TAG) {
    s.aus = true
    console.warn(`FEED-ZAEHLER: Tagesgrenze von ${MAX_ZEILEN_TAG} Schreibzeilen erreicht, Zähler heute aus`)
    return
  }
  if (!(await versuche(env, stand))) return gibZurueck(s, stand)
  s.zeilen += zeilen
  for (const [reg, rang] of stand.register) s.gebucht.set(reg, rang)
}

/** Zählt einen Feed-Abruf. Wirft nie: der Feed hat Vorrang vor der Zählung. */
export async function zaehleFeedAbruf(env: Env, token: string, jetzt: Date, s: Sammler = standard): Promise<void> {
  try {
    const tag = utcTag(jetzt)
    const ms = jetzt.getTime()
    if (s.tag !== tag) {
      const alterTag = entnimm(s, ms)
      s.tag = tag
      s.gebucht = new Map()
      s.zeilen = 0
      s.aus = false
      await versuche(env, alterTag) /* einmal versucht, dann verworfen: nie mit dem neuen Tag vermischen */
    }
    if (s.aus) return
    const { reg, rang } = await registerUndRang(token)
    s.abrufe++
    if (rang > Math.max(s.register.get(reg) ?? 0, s.gebucht.get(reg) ?? 0)) s.register.set(reg, rang)
    const seit = ms - s.zuletztGebucht
    if (seit < MIN_ABSTAND_MS || (s.abrufe < BUCHEN_AB && seit < BUCHEN_NACH_MS)) return
    await buecheStand(env, s, entnimm(s, ms))
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
