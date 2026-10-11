/**
 * **Tagesdeckel für schreibende Meldungen** (11.10.2026).
 *
 * Das Gratis-Kontingent von D1 sind 100.000 geschriebene Zeilen am UTC-Tag, je Cloudflare-Konto
 * (Newsletter-Worker und Ticket-Board teilen es). Ein „alle durchgehen"-Lauf der Erweiterung
 * schrieb am 11.10.2026 in 39 Minuten rund 150.000 Zeilen; danach scheiterten Newsletter-Anmeldung,
 * Push-Status, Cron und Board bis 02:00 MESZ.
 *
 * Die Meldungs-Route (POST /pruefung, Stapel und Einzelmeldung) zählt deshalb die geschriebenen
 * Zeilen — `meta.rows_written` aus den D1-Antworten, also samt Indexen — in `schreib_tag` und
 * antwortet ab `DECKEL_ZEILEN` mit 429 und `Retry-After` bis 00:00 UTC. Die Hälfte des Kontingents
 * bleibt Reserve für alles, was nie gedeckelt wird: Newsletter-Anmeldung, Push, Cron, Läufe
 * (`lauf_status` ~11.000 Zeilen am Tag), Wächter, Aufträge der Pipeline (abhaken, wieder öffnen).
 *
 * Ein Fehler beim Zählen sperrt nichts: Der Deckel ist ein Schutz, keine Voraussetzung. Mehrere
 * gleichzeitige Anfragen können ihn um die Zeilen der laufenden Anfragen überschreiten.
 */
import { type Env } from './env.ts'
import { fehlerLog } from './werte.ts'

export const DECKEL_ZEILEN = 50_000

type D1Antwort = { meta?: { rows_written?: number; changes?: number } }

/** Der UTC-Tag, auf den auch das Kontingent zurückgesetzt wird. */
export function utcTag(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 10)
}

export function sekundenBisMitternachtUtc(jetzt: Date): number {
  const morgen = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate() + 1)
  return Math.max(1, Math.ceil((morgen - jetzt.getTime()) / 1000))
}

/** Eine Meldung, kein Auftrag der Pipeline (abhaken, wieder öffnen) und keine Erwartung. */
export function istMeldung(daten: Record<string, unknown>): boolean {
  if (Array.isArray(daten.stapel)) return true
  if (daten.reoeffnen || daten.erwartung) return false
  if (Array.isArray(daten.rohfolgenUebernommen) || Array.isArray(daten.uebernommen)) return false
  return typeof daten.url === 'string'
}

/**
 * Die Datenbank so verpackt, dass jede Antwort auf `run`, `all` und `batch` ihre geschriebenen
 * Zeilen in die Summe gibt. Anweisungen für `batch` werden vorher ausgepackt (D1 prüft die Herkunft).
 */
export function zaehlendeDb(db: D1Database): { db: D1Database; zeilen: () => number } {
  let summe = 0
  const echte = new WeakMap<object, D1PreparedStatement>()
  const zaehle = (r: D1Antwort) => {
    summe += Number(r?.meta?.rows_written ?? r?.meta?.changes ?? 0)
    return r
  }
  const huelle = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const h = new Proxy(stmt, {
      get(ziel, name) {
        if (name === 'bind') return (...a: unknown[]) => huelle(ziel.bind(...a))
        if (name === 'run' || name === 'all') return async () => zaehle(await ziel[name]())
        const wert = Reflect.get(ziel, name)
        return typeof wert === 'function' ? wert.bind(ziel) : wert
      },
    })
    echte.set(h, stmt)
    return h
  }
  const verpackt = {
    prepare: (sql: string) => huelle(db.prepare(sql)),
    batch: async (liste: D1PreparedStatement[]) => {
      const antworten = await db.batch(liste.map((s) => echte.get(s) ?? s))
      antworten.forEach(zaehle)
      return antworten
    },
  }
  return { db: verpackt as unknown as D1Database, zeilen: () => summe }
}

/** Bisher am Tag geschriebene Zeilen; bei einem Lesefehler 0 (offen lassen, nicht sperren). */
async function heutigerStand(env: Env, tag: string): Promise<number> {
  try {
    const zeile = await env.DB.prepare('SELECT zeilen FROM schreib_tag WHERE tag = ?1').bind(tag).first<{ zeilen: number }>()
    return zeile?.zeilen ?? 0
  } catch (e) {
    fehlerLog('tagesdeckel lesen', e)
    return 0
  }
}

async function verbuchen(env: Env, tag: string, zeilen: number): Promise<void> {
  if (zeilen <= 0) return
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO schreib_tag (tag, zeilen) VALUES (?1, ?2) ON CONFLICT(tag) DO UPDATE SET zeilen = zeilen + ?2',
      ).bind(tag, zeilen),
      env.DB.prepare('DELETE FROM schreib_tag WHERE tag < ?1').bind(tag),
    ])
  } catch (e) {
    fehlerLog('tagesdeckel schreiben', e)
  }
}

export function deckelAntwort(antwort: (body: unknown, status?: number) => Response, jetzt: Date): Response {
  const sekunden = sekundenBisMitternachtUtc(jetzt)
  const r = antwort(
    {
      ok: false,
      error: 'Tageslimit erreicht',
      tageslimit: true,
      retryAfter: sekunden,
      weiterAb: new Date(jetzt.getTime() + sekunden * 1000).toISOString(),
    },
    429,
  )
  r.headers.set('Retry-After', String(sekunden))
  return r
}

type MitDb = { env: Env; antwort: (body: unknown, status?: number) => Response }

/** Führt `lauf` nur unter dem Deckel aus und bucht danach die geschriebenen Zeilen. */
export async function mitTagesdeckel<K extends MitDb>(kontext: K, lauf: (k: K) => Promise<Response>, jetzt = new Date()): Promise<Response> {
  const tag = utcTag(jetzt)
  if ((await heutigerStand(kontext.env, tag)) >= DECKEL_ZEILEN) return deckelAntwort(kontext.antwort, jetzt)
  const zaehler = zaehlendeDb(kontext.env.DB)
  const antwort = await lauf({ ...kontext, env: { ...kontext.env, DB: zaehler.db } })
  await verbuchen(kontext.env, tag, zaehler.zeilen())
  return antwort
}
