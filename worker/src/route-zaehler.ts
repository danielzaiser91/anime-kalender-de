/**
 * **Tageszähler der Anfragen je Route** (09.11.2026): Anlass war die Spitze vom 6. und 7. November im Skript
 * `newsletter` (~3,6 Tsd. Anfragen/h, ohne D1-Lesen), deren Pfad die Messung nicht kannte. Jede Anfrage zählt
 * unter ihrem Pfad (Segmente mit Ziffern oder über 24 Zeichen → `:id`, nie Query, Token oder Adresse); je Isolate
 * höchstens `MAX_ROUTEN` verschiedene Schlüssel, der Rest zählt unter `(andere)`.
 *
 * Gebucht wird gesammelt wie in `feed-zaehler.ts`: ab `BUCHEN_AB` Anfragen oder `BUCHEN_NACH_MS` nach dem letzten Mal,
 * nie öfter als alle `MIN_ABSTAND_MS`; ein Isolate, das früher endet, verliert sein Gesammeltes — die Zahlen sind
 * eine Untergrenze, genug, um eine Spitze einer Route zuzuordnen. Schreibzeilen je Stapel: Routen + 1 (Buchung in
 * `schreib_tag`) + ein DELETE alter Tage; ein Isolate schreibt nie mehr als `MAX_ZEILEN_TAG` Zeilen am Tag.
 * Ein Fehler beim Buchen bricht nie die Anfrage ab.
 */
import { type Env } from './env.ts'

export const BUCHEN_AB = 500
export const BUCHEN_NACH_MS = 10 * 60_000
export const MIN_ABSTAND_MS = 60_000
export const MAX_ROUTEN = 40
export const MAX_ZEILEN_TAG = 1000
export const ANDERE = '(andere)'
const AUFBEWAHREN_TAGE = 30

export type RouteSammler = { tag: string; anzahl: number; zaehler: Map<string, number>; schluessel: Set<string>; zuletzt: number; zeilen: number; aus: boolean }

export const neuerRouteSammler = (): RouteSammler => ({ tag: '', anzahl: 0, zaehler: new Map(), schluessel: new Set(), zuletzt: 0, zeilen: 0, aus: false })
export const standard = neuerRouteSammler()

const utcTag = (d: Date): string => d.toISOString().slice(0, 10)

/** Pfad → Schlüssel: höchstens vier Segmente, Kennungen als `:id`. */
export function routenSchluessel(pfad: string): string {
  const teile = pfad.split('/').filter(Boolean).slice(0, 4)
  if (!teile.length) return '/'
  return '/' + teile.map((t) => (/\d/.test(t) || t.length > 24 ? ':id' : t)).join('/')
}

type Stand = { tag: string; zaehler: Map<string, number> }

function entnimm(s: RouteSammler, jetzt: number): Stand {
  const stand = { tag: s.tag, zaehler: new Map(s.zaehler) }
  s.zaehler.clear()
  s.anzahl = 0
  s.zuletzt = jetzt
  return stand
}

function gibZurueck(s: RouteSammler, stand: Stand): void {
  for (const [route, n] of stand.zaehler) s.zaehler.set(route, (s.zaehler.get(route) ?? 0) + n)
  s.anzahl += [...stand.zaehler.values()].reduce((a, n) => a + n, 0)
}

async function buche(env: Env, stand: Stand): Promise<void> {
  const alt = new Date(`${stand.tag}T00:00:00Z`)
  alt.setUTCDate(alt.getUTCDate() - AUFBEWAHREN_TAGE)
  const upsert = `INSERT INTO route_abrufe (tag, route, n) VALUES (?1, ?2, ?3) ON CONFLICT(tag, route) DO UPDATE SET n = n + ?3`
  await env.DB.batch([
    ...[...stand.zaehler].map(([route, n]) => env.DB.prepare(upsert).bind(stand.tag, route, n)),
    env.DB.prepare(
      `INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?1, ?2, 0) ON CONFLICT(tag) DO UPDATE SET zeilen = zeilen + ?2`,
    ).bind(stand.tag, stand.zaehler.size + 1),
    env.DB.prepare('DELETE FROM route_abrufe WHERE tag < ?1').bind(utcTag(alt)),
  ])
}

/** Bucht einen Stand unter der Tagesgrenze; bei Fehler geht er zurück in den Sammler. */
async function buecheStand(env: Env, s: RouteSammler, stand: Stand): Promise<void> {
  const zeilen = stand.zaehler.size + 1
  if (s.zeilen + zeilen > MAX_ZEILEN_TAG) {
    s.aus = true
    console.warn(`ROUTE-ZAEHLER: Tagesgrenze von ${MAX_ZEILEN_TAG} Schreibzeilen erreicht, Zähler heute aus`)
    return
  }
  try {
    await buche(env, stand)
    s.zeilen += zeilen
  } catch (e) {
    console.warn('ROUTE-ZAEHLER: Buchen fehlgeschlagen', e)
    gibZurueck(s, stand)
  }
}

/** Zählt eine Anfrage unter ihrer Route. Wirft nie: die Anfrage hat Vorrang vor der Zählung. */
export async function zaehleRoute(env: Env, pfad: string, jetzt: Date, s: RouteSammler = standard): Promise<void> {
  try {
    const tag = utcTag(jetzt)
    const ms = jetzt.getTime()
    if (s.tag !== tag) {
      const alterTag = s.anzahl ? entnimm(s, ms) : null
      Object.assign(s, { tag, schluessel: new Set(), zeilen: 0, aus: false, zuletzt: ms })
      if (alterTag) await buecheStand(env, { ...s, zeilen: 0, aus: false }, alterTag)
    }
    if (s.aus) return
    let route = routenSchluessel(pfad)
    if (!s.schluessel.has(route)) route = s.schluessel.size < MAX_ROUTEN ? (s.schluessel.add(route), route) : ANDERE
    s.zaehler.set(route, (s.zaehler.get(route) ?? 0) + 1)
    s.anzahl++
    const seit = ms - s.zuletzt
    if (seit < MIN_ABSTAND_MS || (s.anzahl < BUCHEN_AB && seit < BUCHEN_NACH_MS)) return
    await buecheStand(env, s, entnimm(s, ms))
  } catch (e) {
    console.warn('ROUTE-ZAEHLER aus', e)
  }
}

/** Die häufigsten Routen eines Tages für `/health`; `null`, wenn die Tabelle nicht lesbar ist. */
export async function leseRouten(env: Pick<Env, 'DB'>, tag: string, anzahl = 10): Promise<{ route: string; n: number }[] | null> {
  try {
    const { results } = await env.DB.prepare('SELECT route, n FROM route_abrufe WHERE tag = ?1 ORDER BY n DESC LIMIT ?2')
      .bind(tag, anzahl)
      .all<{ route: string; n: number }>()
    return results ?? []
  } catch {
    return null
  }
}
