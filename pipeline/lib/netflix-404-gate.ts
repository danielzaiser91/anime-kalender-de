import type { LinkBefund } from './link-befund.ts'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './util.ts'

/**
 * Ein Netflix-404 aus der Linkprüfung entfernt einen Weg nur, wenn es echt ist. Die CI bekommt von Netflix zeitweise
 * Massen-404 (02.11.: 26 % der Adressen eines Laufs, 04.11.: 37 %; Naruto Shippuden, Boruto und elf weitere Titel
 * verloren ihren Weg, von Hand am 06.11. alle verfügbar). Zwei Riegel, beide ersetzen das 404 durch `unklar` (der Weg bleibt):
 *
 * 1. Führt `justwatch-audio.json` die Netflix-Adresse als Abo-Angebot mit Stand von höchstens `JW_MAX_ALTER_TAGE` Tagen, bleibt sie.
 *    35 Tage = Auffrischzyklus der Datei (der älteste Eintrag war am 06.11.2026 25 Tage alt, Stände 12.10./19.10./26.10./04.11.)
 *    plus eine Woche Reserve. `motn-links.json` zählt nicht: sie wird aus einem Archiv nur ergänzt, nie bereinigt, und trägt kein Datum.
 * 2. Ein Lauf, in dem mehr als `LAUF_GRENZE_PROZENT` der gemessenen Netflix-Adressen 404 meldeten (ab `LAUF_MINDESTMENGE` Adressen),
 *    bestätigt nichts. Normale Läufe: 0 von 35 (03.11.), 1 von 11 (26.10.). Der Lauf ist der Tag `geprueftAm`.
 */
export const JW_MAX_ALTER_TAGE = 35
export const LAUF_GRENZE_PROZENT = 10
export const LAUF_MINDESTMENGE = 20

export const netflixId = (url: string): string | undefined => /^https?:\/\/(?:www\.)?netflix\.com\/(?:[a-z-]+\/)?(?:title|watch)\/(\d+)/i.exec(url)?.[1]

interface JwAngebot {
  anbieter?: string
  art?: string
  url?: string
}
export interface JwEintrag {
  geprueftAm?: string
  angebote?: JwAngebot[]
  staffeln?: { angebote?: JwAngebot[] }[]
}

/** Netflix-Kennung → jüngster Stand eines JustWatch-Eintrags, der sie als Abo-Angebot (nicht Kauf/Leihe) führt. */
export function jwNetflixStand(jw: Record<string, JwEintrag>): Map<string, string> {
  const stand = new Map<string, string>()
  for (const e of Object.values(jw)) {
    const am = e?.geprueftAm
    if (!am) continue
    const alle = [...(e.angebote ?? []), ...(e.staffeln ?? []).flatMap((s) => s.angebote ?? [])]
    for (const a of alle) {
      if (!/^netflix/i.test(a.anbieter ?? '') || a.art === 'BUY' || a.art === 'RENT' || !a.url) continue
      const id = netflixId(a.url)
      if (id && am > (stand.get(id) ?? '')) stand.set(id, am)
    }
  }
  return stand
}

const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000)

/** Ein 404 der ersten Messung steht noch als `unklar` mit `erstes404` am selben Tag. */
const rohes404 = (b: LinkBefund): boolean => b.status === 404 || (b.status === 'unklar' && b.erstes404 !== undefined && b.erstes404 === b.geprueftAm)

/**
 * Lauftage (`geprueftAm`), an denen mehr als die Grenze der gemessenen Netflix-Adressen 404 meldeten, oder mindestens
 * `LAUF_MINDESTMENGE` Adressen allein (die Quote aus dem Reststand eines Tages schrumpft mit jeder Teilneumessung, die 404 desselben
 * Tages blieben sonst bei den letzten wenigen ohne Schutz). Läufe ab dem Vermerk `rausch` brauchen das nicht: er steht im Befund.
 */
export function rauschTage(befunde: Record<string, LinkBefund>): Set<string> {
  const je = new Map<string, { n: number; tot: number }>()
  for (const [url, b] of Object.entries(befunde)) {
    if (netflixId(url) === undefined || !b.geprueftAm) continue
    const tot = rohes404(b)
    if (!tot && b.status !== 200) continue
    const z = je.get(b.geprueftAm) ?? { n: 0, tot: 0 }
    z.n++
    if (tot) z.tot++
    je.set(b.geprueftAm, z)
  }
  return new Set([...je].filter(([, z]) => z.tot >= LAUF_MINDESTMENGE || (z.n >= LAUF_MINDESTMENGE && z.tot * 100 > z.n * LAUF_GRENZE_PROZENT)).map(([tag]) => tag))
}

export interface Ungewertet {
  url: string
  /** Der Lauf war ein Massen-404 (Regel 2). */
  lauf: boolean
  /** JustWatch führt die Adresse noch (Regel 1). */
  jw: boolean
}

/**
 * Die Befunde, wie der Bau sie liest: ein bestätigtes Netflix-404, das einer der beiden Riegel nicht trägt, steht als `unklar`
 * mit `erstes404`. Die Datei `link-check.json` bleibt unverändert, der Lauf beurteilt weiter seine eigene Messung.
 */
export function gewerteteBefunde(
  roh: Record<string, LinkBefund>,
  jwStand: ReadonlyMap<string, string>,
  heute: string,
): { befunde: Record<string, LinkBefund>; ungewertet: Ungewertet[] } {
  const laut = rauschTage(roh)
  const befunde: Record<string, LinkBefund> = { ...roh }
  const ungewertet: Ungewertet[] = []
  for (const [url, b] of Object.entries(roh)) {
    const id = netflixId(url)
    if (id === undefined || b.status !== 404) continue
    const lauf = b.rausch === true || laut.has(String(b.geprueftAm))
    const stand = jwStand.get(id)
    const jw = stand !== undefined && tageZwischen(stand, heute) <= JW_MAX_ALTER_TAGE
    if (!lauf && !jw) continue
    befunde[url] = { ...b, status: 'unklar', erstes404: b.geprueftAm }
    ungewertet.push({ url, lauf, jw })
  }
  return { befunde, ungewertet }
}

/** Zeile fürs Bau-Log; leer, wenn nichts zurückgehalten wurde. */
export function ungewertetZeile(u: readonly Ungewertet[]): string {
  if (!u.length) return ''
  const lauf = u.filter((x) => x.lauf).length
  const jw = u.filter((x) => x.jw).length
  return `${u.length} Netflix-404 nicht als Abgang gewertet (Massen-404-Lauf: ${lauf}, JustWatch führt die Adresse: ${jw})`
}

/** `data/link-check.json` so gewertet, wie Bau und Bestandswächter sie lesen; `heute` ist der Bautag, `wurzel` der Ordner mit `data/`. */
export function ladeGewerteteBefunde(heute: string, wurzel: string = ROOT): { befunde: Record<string, LinkBefund>; ungewertet: Ungewertet[] } {
  const lies = <T>(pfad: string): T => {
    const voll = resolve(wurzel, pfad)
    return (existsSync(voll) ? JSON.parse(readFileSync(voll, 'utf8')) : {}) as T
  }
  const jw = jwNetflixStand(lies<Record<string, JwEintrag>>('data/justwatch-audio.json'))
  return gewerteteBefunde(lies<Record<string, LinkBefund>>('data/link-check.json'), jw, heute)
}
