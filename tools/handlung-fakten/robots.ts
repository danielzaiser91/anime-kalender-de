/** robots.txt jedes Hosts, den der Sammler abruft: lesen, auswerten, vor jedem Abruf befragen. */
import { UA } from './typen.ts'

export interface Regel {
  erlaubt: boolean
  muster: RegExp
  laenge: number
}

const SONDERZEICHEN = /[.+?^${}()|[\]\\]/g

/** Regeln des Blocks „User-agent: *“ einer robots.txt; `*` und `$` gelten als Platzhalter, wie bei Suchmaschinen. */
export function leseRegeln(robots: string): Regel[] {
  const regeln: Regel[] = []
  let stern = false
  let imKopf = true
  for (const zeile of robots.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(\S*)/.exec(zeile.replace(/#.*/, ''))
    if (!m) continue
    const feld = m[1]!.toLowerCase()
    const wert = m[2]!
    if (feld === 'user-agent') {
      if (!imKopf) stern = false
      imKopf = true
      stern ||= wert === '*'
      continue
    }
    imKopf = false
    if (!stern || !wert || (feld !== 'allow' && feld !== 'disallow')) continue
    const ende = wert.endsWith('$')
    const roh = (ende ? wert.slice(0, -1) : wert).replace(SONDERZEICHEN, '\\$&').replace(/\*/g, '.*')
    regeln.push({ erlaubt: feld === 'allow', muster: new RegExp(`^${roh}${ende ? '$' : ''}`), laenge: wert.length })
  }
  return regeln
}

/** Die längste passende Regel gilt, bei Gleichstand Allow; ohne Treffer ist der Pfad erlaubt. */
export function istErlaubt(regeln: Regel[], pfad: string): boolean {
  const treffer = regeln.filter((x) => x.muster.test(pfad)).sort((a, b) => b.laenge - a.laenge || Number(b.erlaubt) - Number(a.erlaubt))
  return treffer[0]?.erlaubt ?? true
}

export type Host = 'de.wikipedia.org' | 'en.wikipedia.org'
export type Regeln = Record<Host, Regel[]>

const PROBE = '/wiki/Beispiel?action=raw'

/** Liest die robots.txt beider Hosts und bricht ab, wenn `/wiki/<Seite>?action=raw` dort gesperrt ist. Die Regeln bleiben für die Abrufe in Gebrauch. */
export async function pruefeRobots(fetchFn: typeof fetch = fetch): Promise<Regeln> {
  const raus = {} as Regeln
  for (const host of ['de.wikipedia.org', 'en.wikipedia.org'] as const) {
    const res = await fetchFn(`https://${host}/robots.txt`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`robots.txt von ${host} nicht lesbar (${res.status})`)
    raus[host] = leseRegeln(await res.text())
    if (!istErlaubt(raus[host], PROBE)) throw new Error(`robots.txt von ${host} sperrt ${PROBE}`)
  }
  return raus
}
