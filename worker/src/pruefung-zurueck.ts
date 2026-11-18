/**
 * **Zurückgestellte Titel: der Worker kennt sie** (15.11.2026).
 *
 * Daniel: Laufstatus „Netflix 160“, die Erweiterung „0 zu prüfen, 160 zurückgestellt“. Das Zurückstellen lag nur im
 * Browser; der Prüfstand zählte alle als offen. Jetzt meldet die Erweiterung ihre Zurückstellungen (`POST ?zurueck=1`),
 * eine JSON-Zeile je Anbieter in `pruefung_zurueck` (Migration 064), und `?stand=1` zieht sie von `titel` ab.
 *
 * **Schreiben:** eine Zeile je Meldung, und nur bei geändertem Inhalt (`WHERE daten <> excluded.daten`). Nie eine
 * Zeile je Titel (Tageskontingent, `tagesdeckel.ts`). **Ablauf ohne Cron:** `leseZurueck` verwirft Abgelaufenes.
 */
import { type Env } from './env.ts'
import { kennungAus, type Ablehnung } from './pruefung-ablehnung.ts'

/** Anbieter, deren Erweiterung Zurückstellungen meldet. */
export const ZURUECK_PLATTFORMEN = ['netflix']
export const ZURUECK_HOECHSTENS_EINTRAEGE = 2000
/** So weit reicht ein Eintrag höchstens voraus: die 30 Tage der Erweiterung plus eine Stunde Toleranz. */
export const ZURUECK_HOECHSTENS_MS = 30 * 24 * 3600 * 1000 + 3600 * 1000
const GRUND_LAENGE = 80
const KENNUNG = /^[\w-]{1,40}$/

export type ZurueckEintrag = { grund: string; bis: number }
export type ZurueckEintraege = Record<string, ZurueckEintrag>

/** Der Rumpf der Meldung, geprüft: `eintraege` ohne Abgelaufenes, `bis` gedeckelt; sonst die Ablehnung. */
export function pruefeZurueck(roh: unknown, jetzt: number): { plattform: string; eintraege: ZurueckEintraege } | Ablehnung {
  const daten = (roh && typeof roh === 'object' ? roh : {}) as { plattform?: unknown; eintraege?: unknown }
  if (typeof daten.plattform !== 'string' || !ZURUECK_PLATTFORMEN.includes(daten.plattform)) {
    return { status: 400, grund: 'Anbieter unbekannt' }
  }
  const e = daten.eintraege
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { status: 400, grund: 'eintraege fehlt' }
  /* Sortiert: dieselbe Menge ergibt denselben Text, auf den der Vergleich beim Speichern baut. */
  const kennungen = Object.keys(e).sort()
  if (kennungen.length > ZURUECK_HOECHSTENS_EINTRAEGE) return { status: 400, grund: 'zu viele Einträge' }
  const eintraege: ZurueckEintraege = {}
  for (const kennung of kennungen) {
    const wert = (e as Record<string, unknown>)[kennung]
    const w = (wert && typeof wert === 'object' ? wert : {}) as { grund?: unknown; bis?: unknown }
    if (!KENNUNG.test(kennung) || typeof w.bis !== 'number' || !Number.isFinite(w.bis)) continue
    if (w.bis <= jetzt) continue
    const grund = typeof w.grund === 'string' ? w.grund.slice(0, GRUND_LAENGE) : ''
    eintraege[kennung] = { grund, bis: Math.min(w.bis, jetzt + ZURUECK_HOECHSTENS_MS) }
  }
  return { plattform: daten.plattform, eintraege }
}

/**
 * Eine Zeile je Anbieter; unveränderter Inhalt schreibt nichts (0 Zeilen). `version` (Migration 065) ist die Erweiterung, die die
 * Menge zuletzt geändert hat: sie steht nicht in der Änderungsbedingung, ein Versionswechsel allein schreibt nichts.
 */
export async function speichereZurueck(env: Env, plattform: string, eintraege: ZurueckEintraege, jetzt: Date, version: string | null = null): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO pruefung_zurueck (plattform, daten, gemeldet_am, ext_version) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(plattform) DO UPDATE SET daten = excluded.daten, gemeldet_am = excluded.gemeldet_am, ext_version = excluded.ext_version
     WHERE pruefung_zurueck.daten <> excluded.daten`,
  )
    .bind(plattform, JSON.stringify(eintraege), jetzt.toISOString(), version)
    .run()
}

/** Die gespeicherten Zurückstellungen je Anbieter, ohne Abgelaufenes. Ohne die Tabelle (Migration fehlt): leer. */
export async function leseZurueck(env: Env, jetzt: number): Promise<Map<string, ZurueckEintraege>> {
  const ergebnis = new Map<string, ZurueckEintraege>()
  let zeilen: { plattform: string; daten: string }[]
  try {
    zeilen = (await env.DB.prepare('SELECT plattform, daten FROM pruefung_zurueck').all<{ plattform: string; daten: string }>()).results ?? []
  } catch (e) {
    if (/no such table/i.test(String((e as Error)?.message ?? e))) return ergebnis
    throw e
  }
  for (const z of zeilen) {
    if (typeof z.daten !== 'string') continue
    let alle: ZurueckEintraege
    try {
      alle = JSON.parse(z.daten) as ZurueckEintraege
    } catch {
      continue
    }
    const aktiv = Object.entries(alle ?? {}).filter(([, v]) => typeof v?.bis === 'number' && v.bis > jetzt)
    if (aktiv.length) ergebnis.set(z.plattform, Object.fromEntries(aktiv))
  }
  return ergebnis
}

type Ziel = { url: string; titel: string; zurueck?: true }

/**
 * Ein gerechneter Anbieter des Prüfstands ohne seine zurückgestellten Titel: `titel` sinkt, `zurueck` zählt sie,
 * `ziel` zeigt auf den ersten nicht zurückgestellten, die Zurückgestellten stehen am Ende von `ziele` mit `zurueck: true`.
 * **`ziele` verliert keinen Eintrag:** die Erweiterung hält für erledigt, was dort fehlt, und räumte sonst ihre eigene
 * Zurückstellung ab.
 */
export function ohneZurueck<A extends { plattform: string; titel: number; ziel: string | null; ziele: Ziel[] }>(a: A, zurueck: Map<string, ZurueckEintraege>) {
  const eintraege = zurueck.get(a.plattform)
  const still = (z: Ziel) => eintraege !== undefined && Object.hasOwn(eintraege, kennungAus(z.url) ?? '')
  /* Die ersten `titel` Einträge sind Titelseiten, danach folgen Suchadressen (`rechneAnbieter`). */
  const zurueckAnzahl = a.ziele.slice(0, a.titel).filter(still).length
  const offene = a.ziele.filter((z) => !still(z))
  const stille = a.ziele.filter(still).map((z) => ({ ...z, zurueck: true as const }))
  return { ...a, titel: a.titel - zurueckAnzahl, zurueck: zurueckAnzahl, ziel: offene[0]?.url ?? null, ziele: [...offene, ...stille] }
}

/** Rechnet jeden Anbieter und nimmt die noch gültigen Zurückstellungen heraus (eine D1-Lesung je Aufruf). */
export async function rechneOhneZurueck<R, A extends { plattform: string; titel: number; ziel: string | null; ziele: Ziel[] }>(
  { env, jetzt, roh, rechne }: { env: Env; jetzt: number; roh: R[]; rechne: (r: R) => A },
) {
  const zurueck = await leseZurueck(env, jetzt)
  return roh.map((r) => ohneZurueck(rechne(r), zurueck))
}
