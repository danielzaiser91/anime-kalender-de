/**
 * **Ausbleiben binnen Minuten messen** (Messer): Im Fünf-Minuten-Takt liest der Worker für die gerade fälligen deutschen
 * Crunchyroll-Folgen die Folgenliste ihrer Staffel und merkt sich in R2, wann `de-DE` zum ersten Mal darin stand.
 * Regeln (Probelauf 2c, 18.11.2026): nur die Folgenliste, monoton, kein Umgehen des Zwischenspeichers, „ausgeblieben“
 * frühestens Termin + 26 min (`shared/ausbleiben-messen.ts`).
 *
 * **Kein D1** (Website und Takt dürfen D1 nicht belasten): der Stand liegt in R2 (`BELEGE`), die Termine kommen aus der
 * ohnehin geladenen `events.json` (eine Ladung für Push und Messer, `einmal`).
 *
 * **Abschaltweg ohne Deploy:** Der Messer läuft nur, wenn in R2 der Schlüssel `ausbleiben/schalter` genau `an` enthält
 * (fehlt er oder steht etwas anderes darin, ist er aus). `POST /beleg?key=ausbleiben/schalter` mit `X-Lauf-Token` und Rumpf
 * `an` oder `aus` schaltet. Der Takt prüft zuerst nur diesen Schlüssel.
 */
import type { ReleaseEvent } from '../../shared/types.ts'
import { berlinToUtc } from '../../shared/time.ts'
import { lesungFaellig, lesungAusFolgenliste, deutscheStaffel, nachLesung, serieAusSlug, urteil, type Lesung, type ZielStand } from '../../shared/ausbleiben-messen.ts'
import { imTagesfenster } from './push-fenster.ts'
import { fehlerLog } from './werte.ts'

export const SCHALTER_SCHLUESSEL = 'ausbleiben/schalter'
export const STAND_SCHLUESSEL = 'ausbleiben/stand.json'
/** So viele Termine je Takt: Die Free-Stufe erlaubt 50 Unteraufrufe je Aufruf, der Push-Takt teilt sie sich. */
export const ZIELE_JE_LAUF = 4
/** Stände älterer Termine fallen aus R2 (der Messer liest höchstens 24 h nach dem Termin). */
const STAND_AUFBEWAHREN_MS = 3 * 24 * 36e5

const API = 'https://beta-api.crunchyroll.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

export interface MessEnv {
  BELEGE?: R2Bucket
}

export interface MessZiel {
  schluessel: string
  serie: string
  folge: number
  slotMs: number
}

/** Eine Ladung für mehrere Verbraucher desselben Aufrufs. */
export function einmal<T>(lade: () => Promise<T>): () => Promise<T> {
  let versprechen: Promise<T> | undefined
  return () => (versprechen ??= lade())
}

/**
 * Die Termine, bei denen jetzt eine Sichtung fehlen kann: Vorfilter über das Datum (String), dann nur Wochenpläne bei
 * Crunchyroll mit `ohneSichtung`, Uhrzeit und Serienkennung; erst danach die Zeitzonenrechnung. Der früheste Termin zuerst.
 */
export function waehleZiele(termine: ReleaseEvent[], jetzt: Date): MessZiel[] {
  const ziele: MessZiel[] = []
  for (const e of imTagesfenster(termine, jetzt, jetzt)) {
    const serie = serieAusSlug(e.releaseSlug)
    if (!e.ohneSichtung || e.platform !== 'crunchyroll' || !e.time || e.episode == null || !serie) continue
    const slotMs = berlinToUtc(e.date, e.time).getTime()
    ziele.push({ schluessel: `${serie}:${e.episode}:${e.date}`, serie, folge: e.episode, slotMs })
  }
  return ziele.sort((a, b) => a.slotMs - b.slotMs)
}

async function leseJson(env: MessEnv, schluessel: string): Promise<unknown> {
  const o = await env.BELEGE?.get(schluessel)
  return o ? JSON.parse(await o.text()) : null
}

/** Der Schalter: nur der Wert `an` schaltet ein. */
export async function istAn(env: MessEnv): Promise<boolean> {
  const o = await env.BELEGE?.get(SCHALTER_SCHLUESSEL)
  return o ? (await o.text()).trim() === 'an' : false
}

type Antwort = { json: unknown } | { stopp: string } | { fehler: string }

async function abruf(holen: typeof fetch, url: string, init: RequestInit): Promise<Antwort> {
  try {
    const r = await holen(url, { ...init, signal: AbortSignal.timeout(8000) })
    if (r.status === 403 || r.status === 429) return { stopp: `HTTP ${r.status}` }
    if (!r.ok) return { fehler: `HTTP ${r.status}` }
    return { json: await r.json() }
  } catch (err) {
    return { fehler: String((err as Error).message ?? err).slice(0, 60) }
  }
}

async function tokenHolen(holen: typeof fetch): Promise<string | { stopp: string } | { fehler: string }> {
  const a = await abruf(holen, `${API}/auth/v1/token`, {
    method: 'POST',
    headers: { authorization: 'Basic Y3Jfd2ViOg==', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
    body: 'grant_type=client_id',
  })
  if (!('json' in a)) return a
  const t = (a.json as { access_token?: unknown }).access_token
  return typeof t === 'string' ? t : { fehler: 'kein Token' }
}

/** Liest eine Folge: erst (nur einmal je Termin) die Staffel, dann die Folgenliste. */
async function lies(holen: typeof fetch, token: string, z: MessZiel, stand: ZielStand): Promise<{ lesung: Lesung; staffel?: string } | { stopp: string }> {
  const kopf = { authorization: `Bearer ${token}`, 'user-agent': UA }
  let staffel = stand.staffel
  if (!staffel) {
    const s = await abruf(holen, `${API}/content/v2/cms/series/${z.serie}/seasons?locale=de-DE`, { headers: kopf })
    if ('stopp' in s) return s
    staffel = 'json' in s ? (deutscheStaffel(s.json) ?? undefined) : undefined
    if (!staffel) return { lesung: { art: 'keine' } }
  }
  const e = await abruf(holen, `${API}/content/v2/cms/seasons/${staffel}/episodes?locale=de-DE`, { headers: kopf })
  if ('stopp' in e) return e
  return { staffel, lesung: 'json' in e ? lesungAusFolgenliste(e.json, z.folge) : { art: 'keine' } }
}

type StandDatei = Record<string, ZielStand>

/** Der Takt: Schalter, Ziele, Lesungen, Stand. Rückgabe ist die Protokollzeile. */
export async function ausbleibenMessen(env: MessEnv, jetzt: Date, ladeTermine: () => Promise<ReleaseEvent[]>, holen: typeof fetch = fetch): Promise<string> {
  if (jetzt.getUTCMinutes() === 0) return 'volle Stunde: wie beim Push übernimmt der nächste Takt' // sonst würde die Termindatei hier erstmals je Stunde zusätzlich geladen
  if (!env.BELEGE) return 'aus: keine Ablage'
  if (!(await istAn(env))) return 'aus: Schalter'
  const ziele = waehleZiele(await ladeTermine(), jetzt)
  if (ziele.length === 0) return 'ziele=0'
  const jetztMs = jetzt.getTime()
  const gespeichert = ((await leseJson(env, STAND_SCHLUESSEL)) as StandDatei | null) ?? {}
  const stand: StandDatei = {}
  for (const [k, s] of Object.entries(gespeichert)) if (jetztMs - s.slotMs <= STAND_AUFBEWAHREN_MS) stand[k] = s
  const dran = ziele.filter((z) => lesungFaellig(stand[z.schluessel] ?? { slotMs: z.slotMs }, jetztMs)).slice(0, ZIELE_JE_LAUF)
  if (dran.length === 0) return `ziele=${ziele.length} dran=0`
  const token = await tokenHolen(holen)
  if (typeof token !== 'string') return `ziele=${ziele.length} dran=${dran.length} token: ${'stopp' in token ? token.stopp : token.fehler}`
  const zaehl = { erschienen: 0, ausgeblieben: 0, offen: 0, unbekannt: 0 }
  let stopp: string | undefined
  for (const z of dran) {
    const alt = stand[z.schluessel] ?? { slotMs: z.slotMs }
    const r = await lies(holen, token, z, alt)
    if ('stopp' in r) { stopp = r.stopp; break }
    stand[z.schluessel] = { ...nachLesung(alt, r.lesung, jetztMs), ...(r.staffel ? { staffel: r.staffel } : {}) }
    zaehl[urteil(stand[z.schluessel])]++
  }
  await env.BELEGE.put(STAND_SCHLUESSEL, JSON.stringify(stand), { httpMetadata: { contentType: 'application/json' } })
  return `ziele=${ziele.length} dran=${dran.length} ${JSON.stringify(zaehl)}${stopp ? ` gestoppt: ${stopp}` : ''}`
}

/** Wie `ausbleibenMessen`, mit Protokollzeile und aufgefangenem Fehler (ein Fehler hier darf den Push-Takt nicht stören). */
export const ausbleibenMitLog = (env: MessEnv, jetzt: Date, ladeTermine: () => Promise<ReleaseEvent[]>): Promise<void> =>
  ausbleibenMessen(env, jetzt, ladeTermine)
    .then((msg) => console.log(`[ausbleiben] ${msg}`))
    .catch((err) => fehlerLog('[ausbleiben] fehlgeschlagen', err))
