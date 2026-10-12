import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { esc } from './titel-seite.ts'
import { LIZENZ_SEITEN } from '../../shared/lizenzen.ts'

/**
 * **Eigene deutsche Handlungstexte** (`data/handlung-eigen.yaml`, Daniel 12.10.2026, Option C): aus den Fakten mehrerer Quellen selbst geschrieben, nie abgeschrieben.
 * Sie gelten nur, wo weder eine Quelle noch das aniSearch-Archiv einen deutschen Text liefert; sobald einer da ist, ist der Eintrag veraltet und gehört gelöscht.
 */
export const HANDLUNG_EIGEN = 'data/handlung-eigen.yaml'
export const LIZENZ_WIKIPEDIA = 'CC BY-SA 4.0'

export interface EigeneQuelle {
  name: string
  url: string
}

export interface EigeneHandlung {
  id: number
  text: string
  /** `titel`: beschreibt den Titel selbst; `reihe`: nur die Reihe (zur Staffel liefert keine Quelle Handlung). */
  umfang: 'titel' | 'reihe'
  /** Lizenz dieses Textes (bei einer Wikipedia-Quelle gilt Share-Alike). */
  lizenz: string
  quellen: EigeneQuelle[]
}

export function ladeEigeneHandlungen(pfad = resolve(ROOT, HANDLUNG_EIGEN)): EigeneHandlung[] {
  if (!existsSync(pfad)) return []
  return (yaml.load(readFileSync(pfad, 'utf8')) as EigeneHandlung[] | null) ?? []
}

/** Strukturfehler, je Eintrag lesbar mit Kennung; leer = Datei in Ordnung. */
export function eigeneHandlungFehler(eintraege: EigeneHandlung[]): string[] {
  const fehler: string[] = []
  const gesehen = new Set<number>()
  for (const e of eintraege) {
    const at = `Handlung ${e.id}`
    if (!Number.isInteger(e.id) || e.id <= 0) fehler.push(`${at}: id fehlt oder ist keine Titel-Kennung`)
    else if (gesehen.has(e.id)) fehler.push(`${at}: doppelt vergeben`)
    else gesehen.add(e.id)
    if (typeof e.text !== 'string' || !e.text.trim()) fehler.push(`${at}: text fehlt`)
    if (e.umfang !== 'titel' && e.umfang !== 'reihe') fehler.push(`${at}: umfang ist titel oder reihe, nicht "${e.umfang}"`)
    if (!e.lizenz) fehler.push(`${at}: lizenz fehlt`)
    const quellen = e.quellen ?? []
    if (!quellen.length) fehler.push(`${at}: keine Quelle angegeben`)
    if (quellen.some((q) => !q.name || !/^https:\/\//.test(q.url ?? ''))) fehler.push(`${at}: jede Quelle braucht name und https-Adresse`)
    if (new Set(quellen.map((q) => q.name)).size < quellen.length) fehler.push(`${at}: zwei Quellen mit gleichem Namen — nur eine je Name`)
    if (quellen.some((q) => /wikipedia\.org/.test(q.url ?? '')) && e.lizenz !== LIZENZ_WIKIPEDIA) fehler.push(`${at}: Wikipedia-Quelle verlangt die Lizenz ${LIZENZ_WIKIPEDIA}`)
  }
  return fehler
}

/**
 * Welche Einträge gelten: nur für bekannte Titel, die sonst keinen deutschen Text haben (`hatText`).
 * `ungenutzt` nennt die übrigen samt Grund — ein Text, der nicht mehr gebraucht wird, soll auffallen statt zu veralten.
 */
export function eigeneTexteAktiv(
  eintraege: EigeneHandlung[],
  hatText: (titelId: number) => boolean,
  bekannt: (titelId: number) => boolean,
): { aktiv: EigeneHandlung[]; ungenutzt: { id: number; grund: string }[] } {
  const aktiv: EigeneHandlung[] = []
  const ungenutzt: { id: number; grund: string }[] = []
  for (const e of eintraege) {
    if (!bekannt(e.id)) ungenutzt.push({ id: e.id, grund: 'Titel nicht im Bestand' })
    else if (hatText(e.id)) ungenutzt.push({ id: e.id, grund: 'eine Quelle führt jetzt eine deutsche Handlung' })
    else aktiv.push(e)
  }
  return { aktiv, ungenutzt }
}

/** Synopsen, wie die Teilen-Seiten sie lesen (`public/data/synopses/`). */
export type SynopsenFuerSeiten = Record<string, { de?: string; en?: string; eigen?: { quellen: EigeneQuelle[]; lizenz: string } }>

/** Zeile unter dem Text einer Teilen-Seite (kein Panel, keine Link-Leiste): Quellen und Lizenz eines eigenen Textes mit Links; sonst leer. */
export function seitenQuelle(s: SynopsenFuerSeiten[string] | undefined): string {
  const e = s?.eigen
  if (!e) return ''
  const link = (url: string, name: string) => `<a href="${esc(url)}" rel="nofollow" style="color:#7dd3fc;">${esc(name)}</a>`
  const lizenzUrl = LIZENZ_SEITEN[e.lizenz]
  const lizenz = lizenzUrl ? link(lizenzUrl, e.lizenz) : esc(e.lizenz)
  return `<p style="margin:-1rem 0 1.5rem;font-size:.85rem;color:#9aa5bd;">Zusammengefasst nach ${e.quellen.map((q) => link(q.url, q.name)).join(', ')} (${lizenz}).</p>`
}
