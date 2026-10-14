/**
 * **Eine Folge in die Titelzeile schreiben** (13.10.2026, Migration 055, Pilot Disney+).
 *
 * Statt je Folge eine Zeile in `pruefung` und `prime_folge` (11 geschriebene D1-Zeilen) liest die Meldung die
 * Titelzeile (eine Zeile), setzt ihre Folge ein und schreibt die Zeile zurück — nur wenn sich etwas geändert hat.
 *
 * ## Gleichzeitige Meldungen: Version statt Sperre
 *
 * Disney+ meldet mit drei Bahnen gleichzeitig (`extension/disney.js`), zwei Meldungen desselben Titels lesen also
 * dieselbe Fassung. `UPDATE … WHERE version = ?` ändert nur, wenn niemand dazwischen geschrieben hat
 * (`meta.changes = 0` sonst); dann wird neu gelesen und die Folge noch einmal eingesetzt. D1 führt Schreibzugriffe
 * nacheinander aus, die Prüfung ist also lückenlos. Ein Zusammenführen im Worker ohne Version bliebe ein Lesen-Ändern-Schreiben
 * und verlöre dieselben Updates. Nach `VERSUCHE` Fehlschlägen antwortet der Worker 503; die Erweiterung wiederholt
 * (`disney-netz.js`).
 *
 * ## Welche Meldungen hierher gehören
 *
 * Nur Anbieter aus `TITELZEILE_PLATTFORMEN` (leer = aus) und nur Adressen, die schon eine Titelzeile haben oder
 * noch gar keine Meldung: Eine Adresse mit Altzeilen bleibt bei `pruefung`/`prime_folge`, bis
 * `worker/einmalig/titel-zeile-einspielen.sql` sie umgezogen hat — sonst verdrängte die erste Titelzeile ihre Altzeilen aus den
 * Lesern und die übrigen Folgen fehlten.
 */
import { type Env } from './env.ts'
import { ereignisSenden } from './ereignisse.ts'
import { jetztIso } from './werte.ts'
import { leiteAb, type Abgeleitet } from './pruefung-ableiten.ts'
import { auffrischen } from './titelzeile-auffrischen.ts'
import { hakeTitelzeilenAb, oeffneTitelzeilenWieder } from './titelzeile-aufgaben.ts'
import { aendereTitelzeile, ladeZeile } from './titelzeile-zeile.ts'
import { eintragAusMeldung, eintragsId, kopfAusMeldung, leereDaten, setzeEin, type Eintrag, type TitelDaten } from './titelzeile-format.ts'

type Kontext = { env: Env; ctx: ExecutionContext<unknown> | undefined; antwort: (body: unknown, status?: number) => Response }

const anbieterListe = (env: Env) => (env.TITELZEILE_PLATTFORMEN ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/** Eine Meldung eines Anbieters aus der Liste. Mehrere Rohfolgen in einer Meldung (Prime) beantwortet `versucheTitelzeile`. */
const gehoertHierher = (env: Env, daten: Record<string, unknown>) => anbieterListe(env).includes(String(daten.plattform))

/** Altzeilen in `pruefung` oder `prime_folge`: bis das Einspielen sie umgezogen hat, würde eine Titelzeile sie verdrängen. */
async function hatAltzeilen(env: Env, url: string, plattform: string): Promise<boolean> {
  const { results } = await env.DB.prepare(
    `SELECT 1 AS da FROM pruefung WHERE url = ?1
     UNION ALL SELECT 1 FROM prime_folge WHERE url = ?1 AND plattform = ?2 LIMIT 1`,
  )
    .bind(url, plattform)
    .all()
  return (results?.length ?? 0) > 0
}

/** Der Eintrag zur Meldung; bei gleichem Inhalt wird nur der Zeitpunkt nachgezogen, wo ein Leser ihn sieht. */
async function setze(env: Env, alt: TitelDaten, eintrag: Eintrag, kopf: ReturnType<typeof kopfAusMeldung>) {
  const r = setzeEin(alt, eintrag, kopf)
  if (r.art !== 'gleich') return { daten: r.daten, art: r.art }
  const frisch = r.vorher && (await auffrischen(env, r.vorher))
  if (frisch) return { daten: { ...r.daten, f: r.daten.f.map((e) => (e[0] === frisch[0] && e[1] === frisch[1] ? frisch : e)) }, art: r.art }
  return { daten: r.kopfNeu ? r.daten : null, art: r.art }
}

/**
 * Die Meldung in der Titelzeile ablegen, oder `null`, wenn sie den bisherigen Weg geht.
 * Antwort wie der bisherige Weg: `{ ok, befund }`, bei gleichem Inhalt mit `unveraendert`.
 */
async function versucheTitelzeile(k: Kontext, daten: Record<string, unknown>, ab: Abgeleitet): Promise<Response | null> {
  if (!gehoertHierher(k.env, daten)) return null
  const url = String(daten.url ?? '').trim()
  const plattform = String(daten.plattform)
  const zeile = await ladeZeile(k.env, url, plattform)
  if (!zeile && (await hatAltzeilen(k.env, url, plattform))) return null
  if (Array.isArray(daten.rohfolgen) && daten.rohfolgen.length > 1) {
    return zeile ? k.antwort({ error: 'Titelzeile: eine Meldung trägt höchstens eine Rohfolge' }, 400) : null
  }
  const eintrag = eintragAusMeldung(daten, ab, jetztIso())
  if (eintragsId(0, eintrag) === null) {
    return zeile ? k.antwort({ error: 'staffel oder folge_nr liegt außerhalb des Bereichs der Titelzeile' }, 400) : null
  }
  const kopf = kopfAusMeldung(daten)
  let art = 'gleich'
  const ergebnis = await aendereTitelzeile(k.env, { url, plattform, zeile }, async (alt) => {
    const neu = await setze(k.env, alt ?? leereDaten(), eintrag, kopf)
    art = neu.art
    return neu.daten
  })
  if (ergebnis === 'belegt') return k.antwort({ error: 'Titelzeile gerade belegt, bitte wiederholen' }, 503)
  if (art === 'gleich') return k.antwort({ ok: true, befund: ab.befund, unveraendert: true })
  k.ctx?.waitUntil(ereignisSenden(k.env, 'pruefung', { plattform }))
  return k.antwort({ ok: true, befund: ab.befund })
}

/** Der Einstieg aus `speichereDaten`: die Antwort, wenn die Meldung in die Titelzeile gehört, sonst `null` (bisheriger Weg, auch für die Fehlerantworten). */
export async function titelzeileOderNull(k: Kontext, daten: Record<string, unknown>): Promise<Response | null> {
  if (!String(daten.url ?? '').trim() || !gehoertHierher(k.env, daten)) return null
  const ab = leiteAb(daten)
  return 'fehler' in ab ? null : await versucheTitelzeile(k, daten, ab)
}

/**
 * Aufträge der Pipeline für Folgen in Titelzeilen: `uebernommen` hakt Ids ab 2·10⁹ je Titel in einer Zeile ab (`pruefung` kennt sie nicht,
 * die Antwort `markiert` zählt wie bisher), `reoeffnen` öffnet zusätzlich die Titelzeilen und zählt sie zu `reoeffnet` dazu.
 */
export async function mitTitelzeilenAuftrag(env: Env, daten: Record<string, unknown>, weiter: () => Promise<Response>): Promise<Response> {
  if (Array.isArray(daten.uebernommen)) await hakeTitelzeilenAb(env, daten.uebernommen.map(Number), 'meldung')
  const wieder = daten.reoeffnen as { plattform?: string; seit?: string } | null | undefined
  if (!wieder || typeof wieder !== 'object' || !wieder.plattform || !wieder.seit) return await weiter()
  const offen = await oeffneTitelzeilenWieder(env, wieder.plattform, wieder.seit)
  const antwort = await weiter()
  if (!offen || !antwort.ok) return antwort
  const inhalt = (await antwort.json()) as { reoeffnet?: number }
  return new Response(JSON.stringify({ ...inhalt, reoeffnet: (inhalt.reoeffnet ?? 0) + offen }), antwort)
}
