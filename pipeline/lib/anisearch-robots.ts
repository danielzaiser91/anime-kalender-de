/**
 * robots.txt von aniSearch lesen und für den Cover-Pfad auswerten (11.10.2026, Daniel: Bilder herunterladen und selbst ausliefern ist erlaubt,
 * aber nur wenn robots.txt den Pfad nicht sperrt). Der Wortlaut beider Hosts liegt in `data/anisearch-robots.txt`; der Abruf geschieht nur in Actions.
 */

/** Ein Cover-Pfad, wie ihn der Sammler abruft; geprüft wird dieser konkrete Pfad, nicht nur das Verzeichnis. */
export const COVER_BEISPIELPFAD = '/images/anime/cover/12/12345_300.webp'

/** Unsere Kennung in Anfragen: Browser-Kennung, weil die API sonst mit 423 antwortet (anisearch-api.ts). */
export const UNSER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export const ROBOTS_HOSTS = ['www.anisearch.de', 'cdn.anisearch.de'] as const

interface Regel {
  erlaubt: boolean
  muster: string
}

/** Muster nach RFC 9309: `*` beliebig, `$` am Ende verankert; ein leeres Muster trifft nichts. */
function passt(muster: string, pfad: string): boolean {
  if (!muster) return false
  const verankert = muster.endsWith('$')
  const kern = verankert ? muster.slice(0, -1) : muster
  const re = kern.split('*').map((t) => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${re}${verankert ? '$' : ''}`).test(pfad)
}

/** Regeln der Gruppen, die für `agent` gelten: die Gruppe `*` und jede Gruppe, deren Name in der Kennung vorkommt. */
export function regelnFuer(text: string, agent: string): Regel[] {
  const regeln: Regel[] = []
  let namen: string[] = []
  let letzteWarRegel = true
  for (const roh of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*(?:#.*)?$/.exec(roh)
    if (!m) continue
    const feld = m[1]!.toLowerCase()
    const wert = m[2]!
    if (feld === 'user-agent') {
      if (letzteWarRegel) namen = []
      namen.push(wert.toLowerCase())
      letzteWarRegel = false
      continue
    }
    if (feld !== 'disallow' && feld !== 'allow') continue
    letzteWarRegel = true
    const gilt = namen.some((n) => n === '*' || (n !== '' && agent.toLowerCase().includes(n)))
    if (gilt) regeln.push({ erlaubt: feld === 'allow', muster: wert })
  }
  return regeln
}

/** Längste passende Regel gewinnt, bei Gleichstand Allow (RFC 9309); ohne passende Regel ist alles erlaubt. */
export function pfadErlaubt(text: string, pfad: string, agent: string = UNSER_AGENT): boolean {
  let beste: Regel | undefined
  for (const r of regelnFuer(text, agent)) {
    if (!passt(r.muster, pfad)) continue
    if (!beste || r.muster.length > beste.muster.length || (r.muster.length === beste.muster.length && r.erlaubt)) beste = r
  }
  return beste ? beste.erlaubt : true
}

const KOPF = /^### (\S+) \(HTTP (\d+)\)/

/** Zerlegt `data/anisearch-robots.txt` (ein Abschnitt je Host, Kopfzeile `### host (HTTP 200) Stand …`) in Host → Status und Wortlaut. */
export function abschnitte(datei: string): Record<string, { status: number; text: string }> {
  const aus: Record<string, { status: number; text: string }> = {}
  let host: string | undefined
  for (const zeile of datei.split(/\r?\n/)) {
    const k = KOPF.exec(zeile)
    if (k) {
      host = k[1]!
      aus[host] = { status: Number(k[2]), text: '' }
    } else if (host) aus[host]!.text += `${zeile}\n`
  }
  return aus
}

/** Alter der Datei in ms nach dem ältesten `Stand` der Kopfzeilen; ohne lesbaren Stand unendlich alt. */
export function robotsAlterMs(datei: string, jetzt: number): number {
  const staende = [...datei.matchAll(/^### \S+ \(HTTP \d+\) Stand (\S+)/gm)].map((m) => Date.parse(m[1]!))
  return staende.length && staende.every((s) => !Number.isNaN(s)) ? jetzt - Math.min(...staende) : Infinity
}

export interface RobotsUrteil {
  frei: boolean
  grund: string
}

/**
 * Darf der Cover-Pfad abgerufen werden? 200 wertet die Regeln aus, 404 heißt keine Beschränkung; jeder andere Status (403, 5xx) und ein fehlender
 * Abschnitt gelten als gesperrt, weil die Auskunft fehlt.
 */
export function coverFrei(datei: string): RobotsUrteil {
  const a = abschnitte(datei)
  for (const host of ROBOTS_HOSTS) {
    const e = a[host]
    if (!e) return { frei: false, grund: `${host}: kein Abschnitt in data/anisearch-robots.txt` }
    if (e.status === 404) continue
    if (e.status !== 200) return { frei: false, grund: `${host}/robots.txt antwortete HTTP ${e.status}` }
    if (!pfadErlaubt(e.text, COVER_BEISPIELPFAD)) return { frei: false, grund: `${host}/robots.txt sperrt ${COVER_BEISPIELPFAD} für alle oder für uns` }
  }
  return { frei: true, grund: 'robots.txt beider Hosts lässt den Cover-Pfad zu' }
}
