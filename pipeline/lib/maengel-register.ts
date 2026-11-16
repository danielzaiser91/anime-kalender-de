import type { Treffer } from './maengel-regeln.ts'

/** Ablage des Registers (Schreiber: `pipeline/bau/13-12-maengel.ts`). */
export const MAENGEL_DATEI = 'data/maengel.json'

/** Wie lange eine behobene oder abwesende Zeile bleibt, damit ein Rückfall bzw. die Rückkehr erkennbar ist. */
const BEHOBEN_TAGE = 90

/**
 * `abwesend`: der Titel steht nicht mehr in `titles.json` (der Mangel ist nicht behoben, nur nicht mehr zu messen); kehrt er mit dem Mangel zurück,
 * ist das weder „neu“ noch ein Rückfall, `seit` bleibt.
 */
export interface Zeile {
  t: number
  art: string
  wirkung: number
  seit: string
  wer: string
  status: 'offen' | 'behoben' | 'abwesend'
  /** Nur bei `behoben` und `abwesend`: Tag, an dem es dazu wurde. */
  bis?: string
  /** Nur in dem Bau, in dem es geschah: neu im Register bzw. behoben und wieder offen. Der Bau danach lässt es weg. */
  ereignis?: 'neu' | 'rueckfall'
}

/** Wirkung und Abbauweg je Art stehen im Zähler, damit Leser ohne TypeScript (`tools/maengel.mjs`) sie auch bei Arten ohne offene Zeile kennen. */
export interface Zaehler { wirkung: number; wer: string; offen: number; neu: number; behoben: number; rueckfall: number; ausnahme: number }
/** `hinweis` steht nur in dem Bau, in dem etwas auffiel (z. B. kaputte Vorfassung); die Wache gibt ihn weiter. */
export interface Register { stand: string; zaehler: Record<string, Zaehler>; zeilen: Zeile[]; hinweis?: string }
export interface ArtInfo { art: string; wirkung: number; wer: string }

const schluessel = (art: string, t: number): string => `${art}|${t}`

const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000)

type Offen = Omit<Zeile, 'seit' | 'ereignis'>

/** Eine heutige Zeile für einen offenen Treffer; `neu`/`rueckfall` zählen nur bei einer Art, die die Vorfassung schon kannte. */
function offeneZeile(x: Treffer, z: Zeile | undefined, artBekannt: boolean, heute: string, zaehler: Zaehler): Zeile {
  const gemeinsam: Offen = { t: x.t, art: x.art, wirkung: x.wirkung, wer: x.wer, status: 'offen' }
  if (z?.status === 'offen' || z?.status === 'abwesend') return { ...gemeinsam, seit: z.seit }
  if (z) {
    zaehler.rueckfall++
    return { ...gemeinsam, seit: heute, ereignis: 'rueckfall' }
  }
  if (!artBekannt) return { ...gemeinsam, seit: heute }
  zaehler.neu++
  return { ...gemeinsam, seit: heute, ereignis: 'neu' }
}

/** Eine Zeile der Vorfassung, die heute kein offener Treffer ist: behoben, abwesend oder (nach 90 Tagen) weg. */
function altZeile(z: Zeile, titelDa: boolean, heute: string, zaehler: Zaehler): Zeile | null {
  const { ereignis: _weg, ...rest } = z
  if (z.status === 'offen' && !titelDa) return { ...rest, status: 'abwesend', bis: heute }
  if (z.status === 'offen' || (z.status === 'abwesend' && titelDa)) {
    zaehler.behoben++
    return { ...rest, status: 'behoben', bis: heute }
  }
  return tageZwischen(z.bis ?? heute, heute) < BEHOBEN_TAGE ? rest : null
}

/**
 * Schreibt das Register aus der Vorfassung und den Treffern von heute fort: `seit` bleibt, solange der Mangel offen bleibt; ein Treffer,
 * der in der Vorfassung `behoben` war, ist ein Rückfall und beginnt neu. Ohne Vorfassung (Erstlauf) und bei einer Art, die die Vorfassung noch nicht
 * kannte, gibt es kein „neu“, sonst stünde alles auf der Wache. Ausnahmen (zu Recht leer) stehen nur im Zähler, nicht als Zeile.
 * `titelIds`: die Titel im Hauptbestand; ein offener Mangel, dessen Titel fehlt, wird `abwesend` statt „behoben“.
 */
export function schreibeFort(alt: Register | null, treffer: Treffer[], arten: ArtInfo[], heute: string, titelIds: ReadonlySet<number>): Register {
  const vorher = new Map((alt?.zeilen ?? []).map((z) => [schluessel(z.art, z.t), z]))
  const zaehler = Object.fromEntries(arten.map((a) => [a.art, { wirkung: a.wirkung, wer: a.wer, offen: 0, neu: 0, behoben: 0, rueckfall: 0, ausnahme: 0 }])) as Record<string, Zaehler>
  const zeilen: Zeile[] = []
  const offenHeute = new Set<string>()

  for (const x of treffer) {
    if (x.grund) {
      zaehler[x.art]!.ausnahme++
      continue
    }
    offenHeute.add(schluessel(x.art, x.t))
    const artBekannt = Boolean(alt && x.art in alt.zaehler)
    zeilen.push(offeneZeile(x, vorher.get(schluessel(x.art, x.t)), artBekannt, heute, zaehler[x.art]!))
    zaehler[x.art]!.offen++
  }

  for (const z of alt?.zeilen ?? []) {
    if (offenHeute.has(schluessel(z.art, z.t)) || !zaehler[z.art]) continue
    const neu = altZeile(z, titelIds.has(z.t), heute, zaehler[z.art]!)
    if (neu) zeilen.push(neu)
  }

  const rang = new Map(arten.map((a, i) => [a.art, i]))
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
  const hinweis = r.hinweis ? `,\n  "hinweis": ${JSON.stringify(r.hinweis)}` : ''
  return `{\n  "stand": ${JSON.stringify(r.stand)},\n  "zaehler": {\n${zaehler}\n  },\n  "zeilen": [\n${zeilen}\n  ]${hinweis}\n}\n`
}

/** Präfixe der Zeilen, die der Schritt „Datenqualität messen“ (bestand-bauen.yml) liest. */
export const MAENGEL_NEU_ZEILE = 'MAENGEL_NEU '
export const MAENGEL_RUECKFALL_ZEILE = 'MAENGEL_RUECKFALL '
export const MAENGEL_VORFASSUNG_ZEILE = 'MAENGEL_VORFASSUNG '

/** Je Ereignis eine Zeile mit allen Arten, dazu der Hinweis des Baus; ohne Register oder ohne Ereignis keine. */
export function maengelWarnZeilen(register: Register | null): string[] {
  if (!register) return []
  const zeilen: string[] = []
  for (const [ereignis, praefix] of [['neu', MAENGEL_NEU_ZEILE], ['rueckfall', MAENGEL_RUECKFALL_ZEILE]] as const) {
    const m = meldungen(register, ereignis)
    if (m.length) zeilen.push(`${praefix}${m.join('; ')}`)
  }
  if (register.hinweis) zeilen.push(`${MAENGEL_VORFASSUNG_ZEILE}${register.hinweis}`)
  return zeilen
}
