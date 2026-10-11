/**
 * **Eine unveränderte Meldung schreibt (fast) nichts** (11.10.2026).
 *
 * Der „alle durchgehen"-Lauf meldet Titel erneut, deren Inhalt sich nicht geändert hat; jede
 * dieser Meldungen kostete rund 12 geschriebene D1-Zeilen (löschen + einfügen samt Indexen). Der
 * Hash über den ganzen Rumpf (inklusive Rohfolgen) entscheidet: Trägt die offene Zeile derselben
 * Folge denselben Hash, ist nichts neu zu speichern. Eine abgehakte (`uebernommen = 1`) Zeile zählt
 * nicht — dann entsteht einmal eine neue offene Zeile, danach greift der Hash.
 *
 * **Eine Ausnahme: der Zeitstempel.** Der Prüfstand und die Erweiterung rechnen „erledigt" nach
 * `gemeldet_am` gegen den Zeitpunkt des letzten Listenbaus (`pruefstand.json`, `erzeugtAm`; Bleach-Fall
 * im Kopf von `pruefung-stand.ts`). Eine Meldung, die vor diesem Bau liegt, zählt für ein
 * Wiedervorlage-Ziel nicht mehr — würde der Hash sie überspringen, bliebe das Ziel ewig offen und
 * würde bei jedem Durchgang neu gemeldet. Deshalb wird `gemeldet_am` bei gleichem Hash erneuert,
 * aber nur, wenn der alte Wert vor dem aktuellen Listenbau liegt (eine Zeile, einmal je Listenbau);
 * sonst bleibt es bei 0 geschriebenen Zeilen.
 *
 * Die offenen Zeilen aller Adressen eines Aufrufs werden mit **einer** Abfrage geladen: ein Stapel
 * hat höchstens 50 Abfragen (Subrequests), eine Abfrage je Meldung sprengte das Budget. Der Listenbau
 * wird nur geholt, wenn ein Treffer da ist, und dann einmal je Aufruf.
 */
import { type Env } from './env.ts'

type OffeneZeile = { id: number; hash: string | null; gemeldetAm: string }

/** Offene Zeilen je Schlüssel (Adresse, Folge, Staffel, Seite); mehrere sind Dubletten. */
export type OffeneHashes = {
  zeilen: Map<string, OffeneZeile[]>
  /** Zeitpunkt des letzten Listenbaus, einmal je Aufruf geholt. */
  listenbauAm: () => Promise<string | null>
}

export type Folge = { url: string; folgeNr: number | null; staffelNr: number | null; seitenKennung: string | null }

const schluessel = (f: Folge) => JSON.stringify([f.url, f.folgeNr, f.staffelNr, f.seitenKennung])

/** JSON mit sortierten Schlüsseln, damit dieselbe Meldung immer denselben Text ergibt. */
function normalisiert(wert: unknown): unknown {
  if (Array.isArray(wert)) return wert.map(normalisiert)
  if (wert && typeof wert === 'object') {
    const geordnet: Record<string, unknown> = {}
    for (const k of Object.keys(wert).sort()) geordnet[k] = normalisiert((wert as Record<string, unknown>)[k])
    return geordnet
  }
  return wert
}

export async function meldungsHash(daten: Record<string, unknown>): Promise<string> {
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
}

/** Die offenen Zeilen der Adressen, gelesen über `pruefung_url_zeit`. */
export async function ladeOffeneHashes(env: Env, urls: string[]): Promise<OffeneHashes> {
  const zeilen: OffeneHashes['zeilen'] = new Map()
  let bau: Promise<string | null> | undefined
  const offene: OffeneHashes = { zeilen, listenbauAm: () => (bau ??= holeListenbauAm(env)) }
  const einzigartig = [...new Set(urls)]
  if (!einzigartig.length) return offene
  const { results } = await env.DB.prepare(
    `SELECT id, url, folge_nr, staffel, seiten_kennung, hash, gemeldet_am FROM pruefung
      WHERE uebernommen = 0 AND url IN (${einzigartig.map(() => '?').join(',')})`,
  )
    .bind(...einzigartig)
    .all<Zeile>()
  for (const r of results ?? []) {
    const k = schluessel({ url: r.url, folgeNr: r.folge_nr, staffelNr: r.staffel, seitenKennung: r.seiten_kennung })
    zeilen.set(k, [...(zeilen.get(k) ?? []), { id: r.id, hash: r.hash, gemeldetAm: r.gemeldet_am }])
  }
  return offene
}

/** Erneuert `gemeldet_am` nur, wenn die Zeile vor dem aktuellen Listenbau liegt. */
async function haltFrisch(env: Env, offene: OffeneHashes, zeile: OffeneZeile): Promise<void> {
  const bau = await offene.listenbauAm()
  if (!bau || zeile.gemeldetAm >= bau) return
  const jetzt = new Date().toISOString().slice(0, 19) + 'Z'
  await env.DB.prepare('UPDATE pruefung SET gemeldet_am = ?1 WHERE id = ?2').bind(jetzt, zeile.id).run()
}

/** Genau eine offene Zeile mit gleichem Hash; mehrere (Dubletten) werden wie bisher aufgeräumt. */
export async function istUnveraendert(env: Env, offene: OffeneHashes | undefined, f: Folge, hash: string): Promise<boolean> {
  const treffer = offene?.zeilen.get(schluessel(f))
  if (!offene || treffer?.length !== 1 || treffer[0]!.hash !== hash) return false
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
