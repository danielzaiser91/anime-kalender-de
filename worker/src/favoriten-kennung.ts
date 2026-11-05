import { type Env } from './env.ts'

/** **Favoriten in unserer eigenen Kennung `ak`** (Stufe 1, 05.10.2026); die Umrechnung aus AniList-Kennungen ist seit 05.11.2026 entfernt. */
import { leseFavoriten, VORSATZ, type Kennungen } from './favoriten-lesen.ts'
export { leseFavoriten, type Kennungen }

let umleitungGeladen: { bis: number; karte: Map<number, number> } | undefined

/** Zusammengeführte Titel, alt → neu (`ak-umleitung.json` der Seite, höchstens stündlich neu; Dubletten 08.10.2026). Dauerhaft, nicht Teil der Karenz. */
async function ladeUmleitung(env: Pick<Env, 'SITE_URL'>): Promise<Map<number, number> | undefined> {
  if (umleitungGeladen && umleitungGeladen.bis > Date.now()) return umleitungGeladen.karte
  const res = await fetch(`${env.SITE_URL.replace(/\/$/, '')}/data/ak-umleitung.json`, { cf: { cacheTtl: 3600 } } as RequestInit)
  if (!res.ok) return undefined
  umleitungGeladen = { bis: Date.now() + 3600_000, karte: new Map((await res.json()) as [number, number][]) }
  return umleitungGeladen.karte
}

export async function ladeKennungen(env: Pick<Env, 'SITE_URL'>): Promise<Kennungen> {
  return { umleitung: await ladeUmleitung(env).catch(() => undefined) }
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
