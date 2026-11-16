import type { Treffer } from './maengel-regeln.ts'

/** Ablage des Registers (Schreiber: `pipeline/bau/13-12-maengel.ts`). */
export const MAENGEL_DATEI = 'data/maengel.json'

/** Wie lange eine behobene Zeile bleibt, damit ein Rückfall erkennbar ist. */
const BEHOBEN_TAGE = 90

export interface Zeile {
  t: number
  art: string
  wirkung: number
  seit: string
  wer: string
  status: 'offen' | 'behoben'
  /** Nur bei `behoben`: Tag der Behebung. */
  bis?: string
  /** Nur in dem Bau, in dem es geschah: neu im Register bzw. behoben und wieder offen. Der Bau danach lässt es weg. */
  ereignis?: 'neu' | 'rueckfall'
}

export interface Zaehler { offen: number; neu: number; behoben: number; rueckfall: number; ausnahme: number }
export interface Register { stand: string; zaehler: Record<string, Zaehler>; zeilen: Zeile[] }

const schluessel = (art: string, t: number): string => `${art}|${t}`

const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000)

/**
 * Schreibt das Register aus der Vorfassung und den Treffern von heute fort: `seit` bleibt, solange der Mangel offen bleibt; ein Treffer,
 * der in der Vorfassung `behoben` war, ist ein Rückfall und beginnt neu. Ohne Vorfassung (Erstlauf) gibt es kein „neu“, sonst stünde alles auf der Wache.
 * Ausnahmen (zu Recht leer) stehen nur im Zähler, nicht als Zeile.
 */
export function schreibeFort(alt: Register | null, treffer: Treffer[], arten: string[], heute: string): Register {
  const vorher = new Map((alt?.zeilen ?? []).map((z) => [schluessel(z.art, z.t), z]))
  const zaehler = Object.fromEntries(arten.map((a) => [a, { offen: 0, neu: 0, behoben: 0, rueckfall: 0, ausnahme: 0 }])) as Record<string, Zaehler>
  const zeilen: Zeile[] = []
  const offenHeute = new Set<string>()

  for (const x of treffer) {
    if (x.grund) { zaehler[x.art]!.ausnahme++; continue }
    const key = schluessel(x.art, x.t)
    offenHeute.add(key)
    const z = vorher.get(key)
    const gemeinsam = { t: x.t, art: x.art, wirkung: x.wirkung, wer: x.wer, status: 'offen' as const }
    if (z?.status === 'offen') zeilen.push({ ...gemeinsam, seit: z.seit })
    else if (z) { zaehler[x.art]!.rueckfall++; zeilen.push({ ...gemeinsam, seit: heute, ereignis: 'rueckfall' }) }
    else { if (alt) zaehler[x.art]!.neu++; zeilen.push({ ...gemeinsam, seit: heute, ...(alt ? { ereignis: 'neu' as const } : {}) }) }
    zaehler[x.art]!.offen++
  }

  for (const z of alt?.zeilen ?? []) {
    if (offenHeute.has(schluessel(z.art, z.t)) || !zaehler[z.art]) continue
    const { ereignis: _weg, ...rest } = z
    if (z.status === 'offen') { zaehler[z.art]!.behoben++; zeilen.push({ ...rest, status: 'behoben', bis: heute }) }
    else if (tageZwischen(z.bis ?? heute, heute) < BEHOBEN_TAGE) zeilen.push(rest)
  }

  const rang = new Map(arten.map((a, i) => [a, i]))
  zeilen.sort((a, b) => rang.get(a.art)! - rang.get(b.art)! || a.t - b.t)
  return { stand: heute, zaehler, zeilen }
}

/** Offene Mängel je Art, kompakt für die Tageszeile des Qualitätsverlaufs. */
export function offeneJeArt(r: Register): Record<string, number> {
  return Object.fromEntries(Object.entries(r.zaehler).map(([art, z]) => [art, z.offen]))
}

/** Arten, bei denen die Wache nichts meldet (Cover: eigener PR, steht nur im Register). */
export const OHNE_WACHE = new Set(['cover'])

/** Je Art ein Eintrag für `ereignis`, ohne die Arten der Ausnahme; Beispiele sind die ersten drei Kennungen. */
export function meldungen(r: Register, ereignis: 'neu' | 'rueckfall'): string[] {
  const je = new Map<string, number[]>()
  for (const z of r.zeilen) if (z.ereignis === ereignis && !OHNE_WACHE.has(z.art)) (je.get(z.art) ?? je.set(z.art, []).get(z.art)!).push(z.t)
  return [...je].map(([art, ids]) => `${art}: ${ids.length} (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ', …' : ''})`)
}

/** Gültiges JSON mit einer Zeile je Mangel, damit ein geänderter Mangel eine geänderte Zeile im Diff ist. */
export function serialisiere(r: Register): string {
  const zaehler = Object.entries(r.zaehler).map(([a, z]) => `    ${JSON.stringify(a)}: ${JSON.stringify(z)}`).join(',\n')
  const zeilen = r.zeilen.map((z) => `    ${JSON.stringify(z)}`).join(',\n')
  return `{\n  "stand": ${JSON.stringify(r.stand)},\n  "zaehler": {\n${zaehler}\n  },\n  "zeilen": [\n${zeilen}\n  ]\n}\n`
}

/** Präfixe der Zeilen, die der Schritt „Datenqualität messen“ (bestand-bauen.yml) liest. */
export const MAENGEL_NEU_ZEILE = 'MAENGEL_NEU '
export const MAENGEL_RUECKFALL_ZEILE = 'MAENGEL_RUECKFALL '

/** Je Ereignis eine Zeile mit allen Arten; ohne Register oder ohne Ereignis keine. */
export function maengelWarnZeilen(register: Register | null): string[] {
  if (!register) return []
  const zeilen: string[] = []
  for (const [ereignis, praefix] of [['neu', MAENGEL_NEU_ZEILE], ['rueckfall', MAENGEL_RUECKFALL_ZEILE]] as const) {
    const m = meldungen(register, ereignis)
    if (m.length) zeilen.push(`${praefix}${m.join('; ')}`)
  }
  return zeilen
}
