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
 * **Lese-Deckel (12.10.2026):** Dasselbe Konto hat 5 Mio. gelesene Zeilen je UTC-Tag; sie waren am 12.10.2026
 * gegen 14:20 MESZ erschöpft, danach standen Status, Meldungen, Board und Durchgänge bis 02:00 MESZ. Die
 * Route addiert deshalb `meta.rows_read` in dieselbe Zeile (`schreib_tag.gelesen`, Migration 052) und
 * antwortet ab `DECKEL_LESEN` genauso mit 429. Gemessen (workerd, `tools/worker-meldung-lesezeilen-messen.ts`):
 * eine Meldung liest die Zeilen ihrer Adresse + 3, ein Disney+-Durchgang über eine Seite mit n Folgen also n²
 * (24 Folgen 655, 200 Folgen 40.607), Netflix je 10er-Stapel n + 2, Prime unverändert 4. Herleitung der Schwelle:
 * 5,0 Mio. Kontingent − rund 2,0 Mio. Grundlast der übrigen Wege (4,87 Mio. am 12.10. − 2,9 Mio. aus PR 968, mit
 * den Meldungen jenes Tages darin, also eher zu hoch) − 1,5 Mio. Reserve für Spitzen (Bau-Läufe, Board, Status
 * nach einem Neustart) = 1,5 Mio. Nachprüfen anhand von `wrangler d1 insights` nach ein paar Tagen.
 *
 * **Das echte D1-Limit wird genauso beantwortet:** Verweigert D1 selbst (`istD1Tageslimit`), auch wenn die
 * Meldung den Fehler fängt, kommt dieselbe 429 statt 500 — nur diese erkennt die Erweiterung als Pause.
 *
 * Ein Fehler beim Zählen sperrt nichts: Der Deckel ist ein Schutz, keine Voraussetzung. Mehrere
 * gleichzeitige Anfragen können ihn um die Zeilen der laufenden Anfragen überschreiten.
 */
import { type Env } from './env.ts'
import { fehlerLog } from './werte.ts'

export const DECKEL_ZEILEN = 50_000
export const DECKEL_LESEN = 1_500_000

type D1Antwort = { meta?: { rows_written?: number; rows_read?: number; changes?: number } }

/** Was eine Anfrage (oder der Tag) an D1-Zeilen geschrieben und gelesen hat. */
export type Zeilen = { geschrieben: number; gelesen: number }

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
 * Der Fehler, mit dem D1 nach dem echten Tageskontingent antwortet, z. B.
 * `D1_ERROR: Your account has exceeded D1's free tier daily row read limit.` (Wortlaut vom 01.09.2026,
 * docs/wissen/betrieb.md; der Schreib-Fall ist nach demselben Muster angenommen, nicht belegt).
 */
export function istD1Tageslimit(e: unknown): boolean {
  return /free tier daily row (read|write)|daily row (read|write)s? limit/i.test(String((e as Error)?.message ?? e))
}

/**
 * Die Datenbank so verpackt, dass jede Antwort auf `run`, `all` und `batch` ihre geschriebenen und
 * gelesenen Zeilen in die Summe gibt. Anweisungen für `batch` werden vorher ausgepackt (D1 prüft die
 * Herkunft). `limit()` meldet, ob D1 selbst das Tageskontingent verweigert hat — auch wenn die
 * Meldung den Fehler fängt (Stapel, Rohfolgen).
 */
export function zaehlendeDb(db: D1Database): { db: D1Database; zeilen: () => Zeilen; limit: () => boolean } {
  const summe: Zeilen = { geschrieben: 0, gelesen: 0 }
  let limit = false
  const beobachte = async <T extends D1Antwort | D1Antwort[]>(frage: Promise<T>): Promise<T> => {
    try {
      return await frage
    } catch (e) {
      if (istD1Tageslimit(e)) limit = true
      throw e
    }
  }
  const echte = new WeakMap<object, D1PreparedStatement>()
  const zaehle = (r: D1Antwort) => {
    summe.geschrieben += Number(r?.meta?.rows_written ?? r?.meta?.changes ?? 0)
    summe.gelesen += Number(r?.meta?.rows_read ?? 0)
    return r
  }
  const huelle = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const h = new Proxy(stmt, {
      get(ziel, name) {
        if (name === 'bind') return (...a: unknown[]) => huelle(ziel.bind(...a))
        if (name === 'run' || name === 'all') return async () => zaehle(await beobachte(ziel[name]()))
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
      const antworten = await beobachte(db.batch(liste.map((s) => echte.get(s) ?? s)))
      antworten.forEach(zaehle)
      return antworten
    },
  }
  return { db: verpackt as unknown as D1Database, zeilen: () => ({ ...summe }), limit: () => limit }
}

let zaehlerAusGemeldet = false

/**
 * Der Zähler ist kaputt (meist: Migration 052 fehlt): beide Deckel sind dann still abgeschaltet.
 * Einmal je Isolate eine Zeile mit eindeutigem Text ins Protokoll (`wrangler tail`, Workers Logs); gesperrt wird nichts.
 */
function zaehlerAus(wo: string, e: unknown): void {
  if (zaehlerAusGemeldet) return
  zaehlerAusGemeldet = true
  fehlerLog(`TAGESDECKEL AUS (${wo}): Zähler schreib_tag nicht nutzbar, Lese- und Schreib-Deckel greifen nicht — Migration 052 eingespielt?`, e)
}

/** Bisher am Tag geschriebene und gelesene Zeilen; bei einem Lesefehler 0 (offen lassen, nicht sperren). */
async function heutigerStand(env: Env, tag: string): Promise<Zeilen> {
  try {
    const zeile = await env.DB.prepare('SELECT zeilen, gelesen FROM schreib_tag WHERE tag = ?1')
      .bind(tag)
      .first<{ zeilen: number; gelesen: number }>()
    return { geschrieben: zeile?.zeilen ?? 0, gelesen: zeile?.gelesen ?? 0 }
  } catch (e) {
    zaehlerAus('lesen', e)
    return { geschrieben: 0, gelesen: 0 }
  }
}

/**
 * Eine Zeile je Anfrage: geschriebene und gelesene Zeilen in denselben Tageszähler. Das Buchen schreibt
 * selbst eine Zeile (der Upsert läuft auf der unverpackten Datenbank) und wird deshalb mitgezählt:
 * Eine Schleife unveränderter Meldungen, die sonst nichts schreibt, erreicht so den Schreib-Deckel,
 * statt bis zum Lese-Deckel ungezählt Zeilen zu verbrauchen.
 */
async function verbuchen(env: Env, tag: string, { geschrieben, gelesen }: Zeilen): Promise<void> {
  if (geschrieben <= 0 && gelesen <= 0) return
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?1, ?2, ?3)
         ON CONFLICT(tag) DO UPDATE SET zeilen = zeilen + ?2, gelesen = gelesen + ?3`,
      ).bind(tag, geschrieben + 1, gelesen),
      env.DB.prepare('DELETE FROM schreib_tag WHERE tag < ?1').bind(tag),
    ])
  } catch (e) {
    zaehlerAus('buchen', e)
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

/** Führt `lauf` nur unter beiden Deckeln aus und bucht danach die geschriebenen und gelesenen Zeilen. */
export async function mitTagesdeckel<K extends MitDb>(kontext: K, lauf: (k: K) => Promise<Response>, jetzt = new Date()): Promise<Response> {
  const tag = utcTag(jetzt)
  const stand = await heutigerStand(kontext.env, tag)
  if (stand.geschrieben >= DECKEL_ZEILEN || stand.gelesen >= DECKEL_LESEN) return deckelAntwort(kontext.antwort, jetzt)
  const zaehler = zaehlendeDb(kontext.env.DB)
  let antwort: Response
  try {
    antwort = await lauf({ ...kontext, env: { ...kontext.env, DB: zaehler.db } })
  } catch (e) {
    if (zaehler.limit()) return deckelAntwort(kontext.antwort, jetzt)
    throw e
  }
  /* D1 hat verweigert, die Meldung den Fehler gefangen (Stapel: je Meldung `ok: false`): auch das ist das Tageslimit. */
  if (zaehler.limit()) return deckelAntwort(kontext.antwort, jetzt)
  await verbuchen(kontext.env, tag, zaehler.zeilen())
  return antwort
}
