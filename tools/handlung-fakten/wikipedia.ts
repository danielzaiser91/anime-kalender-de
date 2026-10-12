/**
 * Wikipedia-Rohtext holen: nur `/wiki/<Seite>?action=raw` (robots.txt erlaubt das; `/w/` und `/api/` sind gesperrt), höchstens ein Abruf je Sekunde,
 * Antworten im Cache (auch 404), Fehler führen zu Pause und Wiederholung, nie zum Abbruch des Laufs.
 * HTTP-Weiterleitungen werden nicht automatisch verfolgt: ein einziger Sprung auf dieselbe Wikipedia, nur wenn robots.txt den Zielpfad erlaubt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CACHE, UA } from './typen.ts'
import { istErlaubt } from './robots.ts'
import type { Regeln } from './robots.ts'
import { istWeiterleitung } from './wikitext.ts'

export type Sprache = 'de' | 'en'

export interface Abruf {
  status: 'ok' | '404' | 'fehler' | 'gesperrt'
  text?: string
  /** Seitenname nach Weiterleitungen. */
  seite: string
  /** Angefragter Name, wenn eine Weiterleitung gefolgt wurde. */
  weitergeleitetVon?: string
  datei?: string
}

export type Holer = (sprache: Sprache, seite: string) => Promise<Abruf>

export interface HolerOptionen {
  fetchFn?: typeof fetch
  warteFn?: (ms: number) => Promise<void>
  /** Mindestabstand zwischen zwei Abrufen. */
  pauseMs?: number
  /** Wartezeiten vor Wiederholung nach 429/5xx/Netzfehler; danach gilt die Seite als „fehler“ und der Lauf geht weiter. */
  backoffSek?: number[]
  ordner?: string
  /** robots.txt-Regeln je Host (`pruefeRobots`); ein gesperrter Pfad wird nie abgerufen. */
  regeln?: Regeln
}

const PAUSE_MS = 1100
const BACKOFF_SEK = [20, 60, 180]
const MAX_WEITERLEITUNGEN = 2

type Index = Record<string, { status: 200 | 404; datei?: string; ziel?: string }>

const dateiname = (sprache: Sprache, seite: string) => `${sprache}-${seite.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 120)}.wiki`

export const wikiUrl = (sprache: Sprache, seite: string) => `https://${sprache}.wikipedia.org/wiki/${encodeURIComponent(seite.replace(/ /g, '_'))}`

export function erstelleHoler(opt: HolerOptionen = {}): Holer {
  const fetchFn = opt.fetchFn ?? fetch
  const warte = opt.warteFn ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const pause = opt.pauseMs ?? PAUSE_MS
  const backoff = opt.backoffSek ?? BACKOFF_SEK
  const ordner = opt.ordner ?? `${CACHE}/wiki`
  const indexPfad = `${ordner}/index.json`
  mkdirSync(ordner, { recursive: true })
  const index: Index = existsSync(indexPfad) ? JSON.parse(readFileSync(indexPfad, 'utf8')) : {}
  let letzter = 0

  async function takt() {
    const warten = letzter + pause - Date.now()
    if (warten > 0) await warte(warten)
    letzter = Date.now()
  }

  /** Ein HTTP-Sprung (3xx) wird nur auf derselben Wikipedia und nur zu einem laut robots.txt erlaubten Pfad verfolgt, sonst nicht abgerufen. */
  async function abrufMitSprung(sprache: Sprache, url: string): Promise<Response | 'gesperrt'> {
    const res = await fetchFn(url, { headers: { 'User-Agent': UA }, redirect: 'manual' })
    if (res.status < 300 || res.status >= 400) return res
    const host = `${sprache}.wikipedia.org`
    const ziel = new URL(res.headers.get('location') ?? '', url)
    if (ziel.protocol !== 'https:' || ziel.host !== host) return 'gesperrt'
    if (opt.regeln && !istErlaubt(opt.regeln[host], ziel.pathname + ziel.search)) return 'gesperrt'
    await takt()
    const zweite = await fetchFn(ziel.href, { headers: { 'User-Agent': UA }, redirect: 'manual' })
    return zweite.status >= 300 && zweite.status < 400 ? 'gesperrt' : zweite
  }

  async function einmal(sprache: Sprache, seite: string): Promise<{ status: 'ok' | '404' | 'fehler' | 'gesperrt'; text?: string }> {
    const pfad = `${new URL(wikiUrl(sprache, seite)).pathname}?action=raw`
    if (opt.regeln && !istErlaubt(opt.regeln[`${sprache}.wikipedia.org`], pfad)) return { status: 'gesperrt' }
    for (let versuch = 0; versuch <= backoff.length; versuch++) {
      await takt()
      try {
        const res = await abrufMitSprung(sprache, `${wikiUrl(sprache, seite)}?action=raw`)
        if (res === 'gesperrt') return { status: 'gesperrt' }
        if (res.status === 404) return { status: '404' }
        if (res.ok) return { status: 'ok', text: await res.text() }
        console.log(`  Wikipedia ${res.status} bei ${sprache}:${seite}`)
        const nach = Number(res.headers.get('retry-after'))
        if (versuch < backoff.length) await warte(Math.min(300, nach > 0 ? nach : backoff[versuch]!) * 1000)
      } catch (e) {
        console.log(`  Netzfehler bei ${sprache}:${seite}: ${(e as Error).message}`)
        if (versuch < backoff.length) await warte(backoff[versuch]! * 1000)
      }
    }
    return { status: 'fehler' }
  }

  async function hole(sprache: Sprache, seite: string, tiefe = 0, von?: string): Promise<Abruf> {
    const schluessel = `${sprache}:${seite}`
    const bekannt = index[schluessel]
    let status: 'ok' | '404' | 'fehler' | 'gesperrt' = bekannt ? (bekannt.status === 404 ? '404' : 'ok') : 'fehler'
    let text: string | undefined
    if (bekannt?.status === 200) text = readFileSync(`${ordner}/${bekannt.datei}`, 'utf8')
    else if (!bekannt) {
      const neu = await einmal(sprache, seite)
      status = neu.status
      text = neu.text
      if (status === 'ok' || status === '404') {
        index[schluessel] = status === 'ok' ? { status: 200, datei: dateiname(sprache, seite) } : { status: 404 }
        if (text !== undefined) writeFileSync(`${ordner}/${dateiname(sprache, seite)}`, text)
        writeFileSync(indexPfad, JSON.stringify(index))
      }
    }
    if (status !== 'ok' || text === undefined) return { status, seite }
    const ziel = istWeiterleitung(text)
    if (ziel && tiefe < MAX_WEITERLEITUNGEN) return hole(sprache, ziel, tiefe + 1, von ?? seite)
    return { status: 'ok', text, seite, weitergeleitetVon: von, datei: dateiname(sprache, seite) }
  }

  return (sprache, seite) => hole(sprache, seite)
}
