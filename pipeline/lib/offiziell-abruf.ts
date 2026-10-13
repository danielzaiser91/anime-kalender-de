/**
 * Der höfliche Abruf einer offiziellen Seite: robots.txt zuerst (höchstens `ROBOTS_TAGE` alt), Crawl-delay beachten, eine Seite je Host und Lauf,
 * Rohantwort in den Cache, Sperre = Pause statt Abbruch. Das Netz steckt hinter `Holer`, damit die Prüfung ohne Netz läuft.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { robotsErlaubt } from './sammelartikel-lauf.ts'
import { ROOT } from './util.ts'
import { CACHE_ORDNER } from './offiziell-pfade.ts'
import { lese, type Eintrag } from './offiziell-lesen.ts'
import type { Seite } from './offiziell-seiten.ts'
import { nachLesung, robotsFrisch, type HostStand } from './offiziell-stand.ts'

/** Unsere Kennung in robots.txt: ein Block für `anime-kalender` oder `anime-kalender.de` gilt uns. */
export const KENNUNG = 'anime-kalender.de'
export const UA = `Mozilla/5.0 (compatible; ${KENNUNG}/1.0; +https://anime-kalender.de)`
/** Länger als das wartet der Lauf nicht auf einen Crawl-delay; wer mehr verlangt, wird in diesem Lauf übersprungen. */
export const CRAWL_DELAY_GRENZE_S = 60

export interface Antwort {
  status: number
  text: string
  retryAfter?: number
}
export type Holer = (url: string) => Promise<Antwort>

export function netzHoler(): Holer {
  return async (url) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'manual', signal: AbortSignal.timeout(20_000) })
      const retry = Number(res.headers.get('retry-after'))
      return { status: res.status, text: res.ok ? await res.text() : '', retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined }
    } catch {
      return { status: 0, text: '' }
    }
  }
}

export const cacheDatei = (url: string): string => `${CACHE_ORDNER}/${new URL(url).host}/${createHash('sha1').update(url).digest('hex').slice(0, 10)}.txt`

/** Jede 200-Antwort geht roh in den Cache (`data/cache/offizielle-news/<host>/…`); ein späterer Lauf kann sie mit `nurCache` neu auswerten. */
export function mitCache(holer: Holer): Holer {
  return async (url) => {
    const a = await holer(url)
    if (a.status === 200) {
      const pfad = resolve(ROOT, cacheDatei(url))
      mkdirSync(dirname(pfad), { recursive: true })
      writeFileSync(pfad, a.text, 'utf8')
    }
    return a
  }
}

export function nurCache(): Holer {
  return async (url) => {
    const pfad = resolve(ROOT, cacheDatei(url))
    return existsSync(pfad) ? { status: 200, text: readFileSync(pfad, 'utf8') } : { status: 404, text: '' }
  }
}

/** Mindestabstand zwischen zwei Abrufen, gleich bei welchem Host. */
export function mitTakt(holer: Holer, ms: number, schlafen: (ms: number) => Promise<void>): Holer {
  let letzter = 0
  return async (url) => {
    const warten = letzter + ms - Date.now()
    if (warten > 0) await schlafen(warten)
    const a = await holer(url)
    letzter = Date.now()
    return a
  }
}

/** `Crawl-delay` in Sekunden für unsere Kennung (sonst für alle); 0, wenn keiner genannt ist. */
export function crawlDelay(robots: string): number {
  let agenten: string[] = []
  let letzteWarAgent = false
  const werte = { eigene: 0, alle: 0 }
  for (const roh of robots.split(/\r?\n/)) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(roh.replace(/#.*/, '').trim())
    if (!m) continue
    const feld = m[1]!.toLowerCase()
    if (feld === 'user-agent') {
      agenten = letzteWarAgent ? [...agenten, m[2]!.trim().toLowerCase()] : [m[2]!.trim().toLowerCase()]
      letzteWarAgent = true
      continue
    }
    letzteWarAgent = false
    if (feld !== 'crawl-delay' || !Number.isFinite(Number(m[2]))) continue
    if (agenten.some((a) => a !== '*' && KENNUNG.includes(a))) werte.eigene = Number(m[2])
    else if (agenten.includes('*')) werte.alle = Number(m[2])
  }
  return werte.eigene || werte.alle
}

export interface Lesung {
  eintraege: Eintrag[]
  stand: HostStand
}

/** Die robots.txt des Hosts: aus dem Stand, wenn frisch, sonst neu geholt. `undefined` heißt: nicht lesbar, Host in diesem Lauf nicht anfassen. */
async function robotsVon(seite: Seite, alt: HostStand | undefined, heute: string, holer: Holer): Promise<{ robots?: string; ausgang?: string; retryAfter?: number; status?: number; geholt: boolean }> {
  if (robotsFrisch(alt, heute)) return { robots: alt!.robots, geholt: false }
  const a = await holer(`https://${seite.host}/robots.txt`)
  if (a.status === 200) return { robots: a.text, geholt: true }
  if (a.status === 404 || a.status === 410) return { robots: '', geholt: true }
  return { ausgang: a.status === 401 || a.status === 403 || a.status === 429 ? 'gesperrt' : 'fehler', retryAfter: a.retryAfter, status: a.status, geholt: true }
}

/** Liest die News-Liste eines Hosts; jeder Fehlschlag wird zum Stand dieses Hosts, nie zum Abbruch des Laufs. */
export async function leseHost(seite: Seite, alt: HostStand | undefined, jetzt: Date, holer: Holer, schlafen: (ms: number) => Promise<void>): Promise<Lesung> {
  const heute = jetzt.toISOString().slice(0, 10)
  const r = await robotsVon(seite, alt, heute, holer)
  const grundlage = { ...alt, ...(r.robots === undefined ? {} : { robots: r.robots, robotsAm: r.geholt ? heute : alt?.robotsAm }) }
  const mitStand = (ausgang: string, retry?: number, status?: number): HostStand => ({ ...nachLesung(grundlage, ausgang, jetzt, retry), status })
  if (r.robots === undefined) return { eintraege: [], stand: mitStand(r.ausgang!, r.retryAfter, r.status) }
  const url = new URL(seite.url)
  if (!robotsErlaubt(r.robots, url.pathname + url.search, KENNUNG)) return { eintraege: [], stand: mitStand('robots') }
  const verlangt = Math.max(crawlDelay(r.robots), seite.pause ?? 0)
  if (verlangt > CRAWL_DELAY_GRENZE_S) return { eintraege: [], stand: mitStand('robots') }
  if (r.geholt && verlangt > 0) await schlafen(verlangt * 1000)
  const a = await holer(seite.url)
  if (a.status !== 200) return { eintraege: [], stand: mitStand(a.status === 403 || a.status === 429 || a.status === 503 ? 'gesperrt' : 'fehler', a.retryAfter, a.status) }
  const eintraege = lese(seite.muster, a.text, seite.url, heute, seite.eintrag)
  return { eintraege, stand: mitStand(eintraege.length ? 'ok' : 'leer') }
}
