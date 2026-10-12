/**
 * **Eine unveränderte Meldung schreibt (fast) nichts** (11.10.2026).
 *
 * Der „alle durchgehen"-Lauf meldet Titel erneut, deren Inhalt sich nicht geändert hat; jede
 * dieser Meldungen kostete rund 12 geschriebene D1-Zeilen (löschen + einfügen samt Indexen). Der
 * Hash über den ganzen Rumpf (inklusive Rohfolgen) entscheidet: Trägt die offene Zeile derselben
 * Folge denselben Hash, ist nichts neu zu speichern. Seit 12.10.2026 gilt das auch nach dem Abhaken:
 * Ohne offene Zeile entscheidet die jüngste übernommene (`haltUebernommeneFrisch`).
 *
 * **Eine Ausnahme: der Zeitstempel.** Der Prüfstand und die Erweiterung rechnen „erledigt" nach
 * `gemeldet_am` gegen den Zeitpunkt des letzten Listenbaus (`pruefstand.json`, `erzeugtAm`; Bleach-Fall
 * im Kopf von `pruefung-stand.ts`). Eine Meldung, die vor diesem Bau liegt, zählt für ein
 * Wiedervorlage-Ziel nicht mehr — würde der Hash sie überspringen, bliebe das Ziel ewig offen und
 * würde bei jedem Durchgang neu gemeldet. Deshalb wird `gemeldet_am` bei gleichem Hash erneuert,
 * aber nur, wenn der alte Wert vor dem aktuellen Listenbau liegt (eine Zeile, einmal je Listenbau);
 * sonst bleibt es bei 0 geschriebenen Zeilen.
 *
 * Die Zeilen der gemeldeten Folgen eines Aufrufs werden mit **einer** Abfrage geladen: ein Stapel
 * hat höchstens 50 Abfragen (Subrequests), eine Abfrage je Meldung sprengte das Budget. Der Listenbau
 * wird nur geholt, wenn ein Treffer da ist, und dann einmal je Aufruf.
 */
import { type Env } from './env.ts'
import { jetztIso, zahlOderNull } from './werte.ts'

type OffeneZeile = { id: number; hash: string | null; gemeldetAm: string }

/** Offene Zeilen je Schlüssel (Adresse, Folge, Staffel, Seite); mehrere sind Dubletten. */
export type OffeneHashes = {
  zeilen: Map<string, OffeneZeile[]>
  /** Je Schlüssel die jüngste übernommene Zeile (jüngste `gemeldet_am`, bei Gleichstand höchste `id`). */
  uebernommene: Map<string, OffeneZeile>
  /** Zeitpunkt des letzten Listenbaus, einmal je Aufruf geholt. */
  listenbauAm: () => Promise<string | null>
}

export type Folge = { url: string; folgeNr: number | null; staffelNr: number | null; seitenKennung: string | null }

const schluessel = (f: Folge) => JSON.stringify([f.url, f.folgeNr, f.staffelNr, f.seitenKennung])

/** JSON mit sortierten Schlüsseln, damit dieselbe Meldung immer denselben Text ergibt. */
export function normalisiert(wert: unknown): unknown {
  if (Array.isArray(wert)) return wert.map(normalisiert)
  if (wert && typeof wert === 'object') {
    const geordnet: Record<string, unknown> = {}
    for (const k of Object.keys(wert).sort()) geordnet[k] = normalisiert((wert as Record<string, unknown>)[k])
    return geordnet
  }
  return wert
}

export async function meldungsHash(daten: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(normalisiert(daten)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `erzeugtAm` aus `data/pruefstand.json` (wie `pruefung-stand.ts`), ohne die Datei `null`. */
async function holeListenbauAm(env: Env): Promise<string | null> {
  try {
    const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
      cf: { cacheTtl: 60 },
    } as RequestInit)
    return res.ok ? (((await res.json()) as { erzeugtAm?: string }).erzeugtAm ?? null) : null
  } catch {
    return null
  }
}

type Zeile = {
  id: number
  url: string
  folge_nr: number | null
  staffel: number | null
  seiten_kennung: string | null
  hash: string | null
  gemeldet_am: string
  uebernommen: number
}

/**
 * Die Folge einer Meldung — die eine Ableitung für Laden, Vergleichen und Ersetzen (`speichereDaten`).
 * Wird derselbe Titel zweimal geschickt, gilt der jüngere Blick; verglichen wird über alle vier Teile:
 * - **Staffel:** Amazon führt Sammelseiten, unter `B0GFPBT6FG` liegen alle drei Staffeln von „Oshi no Ko",
 *   nur durch den Verweis-Parameter getrennt (gemessen 23.08.2026). Ohne sie löschte Staffel 3 die Staffel 1.
 * - **Seitenkennung:** Prime führt oft zwei Ausgaben unter einer Adresse („My First Girlfriend is a Gal":
 *   Kauftitel mit 11 Folgen und die Crunchyroll-Fassung mit 10). Ohne sie löschte die zweite die erste.
 * `IS` statt `=` in der SQL-Bedingung, weil `NULL = NULL` in SQLite nichts liefert und ältere Meldungen
 * weder Staffel noch Kennung tragen.
 */
export function folgeVon(daten: Record<string, unknown>): Folge {
  return {
    url: String(daten.url ?? '').trim(),
    folgeNr: zahlOderNull(daten.folge_nr),
    staffelNr: zahlOderNull(daten.staffel),
    seitenKennung: typeof daten.seiten_kennung === 'string' ? daten.seiten_kennung : null,
  }
}

/**
 * Die Zeilen genau der gemeldeten Folgen, gelesen über `pruefung_folge`: offene und übernommene.
 * Seit 12.10.2026 je Folge statt je Adresse: eine Seite mit n Folgen las bei jeder Meldung alle ihre
 * Zeilen, ein Durchgang kostete rund n² Lesezeilen (Migration 053, `docs/wissen/betrieb.md`).
 * Die Schlüssel reisen als JSON in einem Parameter: eine Abfrage, egal wie viele Folgen (Stapelgrenze).
 */
export async function ladeOffeneHashes(env: Env, folgen: Folge[]): Promise<OffeneHashes> {
  const zeilen: OffeneHashes['zeilen'] = new Map()
  const uebernommene: OffeneHashes['uebernommene'] = new Map()
  let bau: Promise<string | null> | undefined
  const offene: OffeneHashes = { zeilen, uebernommene, listenbauAm: () => (bau ??= holeListenbauAm(env)) }
  const einzigartig = [...new Map(folgen.map((f) => [schluessel(f), f])).values()]
  if (!einzigartig.length) return offene
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.url, p.folge_nr, p.staffel, p.seiten_kennung, p.hash, p.gemeldet_am, p.uebernommen
       FROM json_each(?1) k CROSS JOIN pruefung p
      WHERE p.url = json_extract(k.value, '$[0]') AND p.folge_nr IS json_extract(k.value, '$[1]')
        AND p.staffel IS json_extract(k.value, '$[2]') AND p.seiten_kennung IS json_extract(k.value, '$[3]')`,
  )
    .bind(JSON.stringify(einzigartig.map((f) => [f.url, f.folgeNr, f.staffelNr, f.seitenKennung])))
    .all<Zeile>()
  for (const r of results ?? []) {
    const k = schluessel({ url: r.url, folgeNr: r.folge_nr, staffelNr: r.staffel, seitenKennung: r.seiten_kennung })
    const z = { id: r.id, hash: r.hash, gemeldetAm: r.gemeldet_am }
    if (!r.uebernommen) zeilen.set(k, [...(zeilen.get(k) ?? []), z])
    else if (juenger(z, uebernommene.get(k))) uebernommene.set(k, z)
  }
  return offene
}

const juenger = (a: OffeneZeile, b: OffeneZeile | undefined) =>
  !b || a.gemeldetAm > b.gemeldetAm || (a.gemeldetAm === b.gemeldetAm && a.id > b.id)

/** Die Zeilen-IDs der offenen Zeilen derselben Folge (mehrere sind Dubletten). */
export function offeneIds(offene: OffeneHashes, f: Folge): number[] {
  return (offene.zeilen.get(schluessel(f)) ?? []).map((z) => z.id)
}

/** Erneuert `gemeldet_am` nur, wenn die Zeile vor dem aktuellen Listenbau liegt. */
async function haltFrisch(env: Env, offene: OffeneHashes, zeile: OffeneZeile): Promise<void> {
  const bau = await offene.listenbauAm()
  if (!bau || zeile.gemeldetAm >= bau) return
  const jetzt = new Date().toISOString().slice(0, 19) + 'Z'
  await env.DB.prepare('UPDATE pruefung SET gemeldet_am = ?1 WHERE id = ?2').bind(jetzt, zeile.id).run()
}

/** Ein Zeitpunkt als Datum in Ortszeit Europe/Berlin (wie `berlinDatum` in `pipeline/fetch-pruefungen.ts`). */
const berlinTag = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))

/**
 * Gleicher Inhalt wie die jüngste übernommene Zeile: nichts einfügen, `gemeldet_am` nur erneuern, wenn
 * ein Leser den Unterschied sieht (12.10.2026):
 * - anderes Datum, in Berlin (`checkedAt` im Bau, `fetch-pruefungen.ts`) oder in UTC (`tag` der Urteile,
 *   `fetch-urteile.ts`): erneuern und die Zeile wieder öffnen, der Bau liest nur offene.
 * - Zeile vor dem letzten Listenbau: Wiedervorlage und Zähler rechnen `gemeldet_am > erzeugtAm`
 *   (`pruefung-stand.ts`, `pruefung-zaehlen.ts`); dafür genügt `gemeldet_am`, die Zeile bleibt übernommen.
 * Sonst 0 geschriebene Zeilen. Grenze: Zwei widersprüchliche Meldungen derselben Adresse am selben Tag
 * behalten ihre Reihenfolge nicht (so auch bei offenen Zeilen).
 */
async function haltUebernommeneFrisch(env: Env, offene: OffeneHashes, zeile: OffeneZeile): Promise<void> {
  const jetzt = jetztIso()
  const neuerTag = berlinTag(zeile.gemeldetAm) !== berlinTag(jetzt) || zeile.gemeldetAm.slice(0, 10) !== jetzt.slice(0, 10)
  const bau = neuerTag ? null : await offene.listenbauAm()
  if (!neuerTag && !(bau && zeile.gemeldetAm < bau)) return
  await env.DB.prepare(`UPDATE pruefung SET gemeldet_am = ?1${neuerTag ? ', uebernommen = 0' : ''} WHERE id = ?2`)
    .bind(jetzt, zeile.id)
    .run()
}

/**
 * Genau eine offene Zeile mit gleichem Hash; mehrere (Dubletten) werden wie bisher aufgeräumt.
 * Ohne offene Zeile entscheidet die jüngste übernommene derselben Folge (A, B, A schreibt A neu).
 */
export async function istUnveraendert(env: Env, offene: OffeneHashes | undefined, f: Folge, hash: string): Promise<boolean> {
  if (!offene) return false
  const treffer = offene.zeilen.get(schluessel(f))
  if (!treffer) {
    const letzte = offene.uebernommene.get(schluessel(f))
    if (letzte?.hash !== hash) return false
    await haltUebernommeneFrisch(env, offene, letzte)
    return true
  }
  if (treffer.length !== 1 || treffer[0]!.hash !== hash) return false
  await haltFrisch(env, offene, treffer[0]!)
  return true
}

/** Hash der Meldung samt Antwort, ob die offene Zeile derselben Folge ihn schon trägt. */
export async function pruefeUnveraendert(
  env: Env,
  offene: OffeneHashes | undefined,
  daten: Record<string, unknown>,
  folge: Folge,
): Promise<{ hash: string; unveraendert: boolean }> {
  const hash = await meldungsHash(daten)
  return { hash, unveraendert: await istUnveraendert(env, offene, folge, hash) }
}
