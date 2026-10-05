import { type Env } from './env.ts'

/**
 * **Favoriten in unserer eigenen Kennung `ak`** (Stufe 1, 05.10.2026).
 *
 * Neue Listen werden mit dem Vorsatz `ak:` gespeichert, wenn der Browser `ak: 1` mitschickt. Eine Liste ohne Vorsatz stammt aus der Zeit
 * davor (AniList-Kennungen) und wird beim Lesen über `data/anilist-ak.json` der Seite umgerechnet — bis zum **05.11.2026**
 * (ein Monat Karenz, Daniel: danach nur noch `ak`). Dann entfallen `ladeAbbild`, der Zweig ohne Vorsatz und `data/anilist-ak.json`;
 * die Prüfung in `pipeline/check-logic.ts` wird an dem Tag rot.
 */
const VORSATZ = 'ak:'

let abbildGeladen: { bis: number; karte: Map<number, number> } | undefined

/** AniList-Kennung → ak, von der Seite (höchstens stündlich neu). */
export async function ladeAbbild(env: Pick<Env, 'SITE_URL'>): Promise<Map<number, number> | undefined> {
  if (abbildGeladen && abbildGeladen.bis > Date.now()) return abbildGeladen.karte
  const res = await fetch(`${env.SITE_URL.replace(/\/$/, '')}/data/anilist-ak.json`, { cf: { cacheTtl: 3600 } } as RequestInit)
  /* Ohne Datei (Seite noch nicht ausgeliefert) wird nichts gemerkt und nichts umgerechnet. */
  if (!res.ok) return undefined
  const paare = (await res.json()) as [number, number][]
  abbildGeladen = { bis: Date.now() + 3600_000, karte: new Map(paare.map(([ak, anilist]) => [anilist, ak])) }
  return abbildGeladen.karte
}

/** Liest eine gespeicherte Liste; ohne Vorsatz wird über `abbild` umgerechnet (fehlt es, bleiben die Zahlen, wie sie sind). */
export function leseFavoriten(raw: string | null | undefined, abbild?: Map<number, number>): Set<number> {
  const text = raw ?? ''
  const neu = text.startsWith(VORSATZ)
  const zahlen = (neu ? text.slice(VORSATZ.length) : text)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0)
  return new Set(neu || !abbild ? zahlen : zahlen.map((id) => abbild.get(id)).filter((id): id is number => id !== undefined))
}

/** Nur ganze Zahlen übernehmen — die Liste kommt aus dem Browser; `ak: 1` kennzeichnet sie als unsere Kennung. */
export function schreibeFavoriten(input: unknown, ak: unknown): string {
  if (!Array.isArray(input)) return ''
  const liste = [...new Set(input.map(Number).filter((v) => Number.isInteger(v) && v > 0))].join(',')
  return liste && ak === 1 ? VORSATZ + liste : liste
}

/** Zahl der Einträge einer gespeicherten Liste. */
export function zaehleFavoriten(raw: string): number {
  return leseFavoriten(raw).size
}
