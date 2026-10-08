/**
 * **PoC: Sammelartikel selbst lesen** (08.10.2026, Fahrplan Schritte 6–7 in `docs/autonomie-plan.md`).
 *
 * Liest Anbieter-Sammelartikel von Anime2You und Crunchyrolls Season-Artikel, macht daraus Aussagen
 * (`lib/aussagen*.ts`), ordnet sie dem Bestand zu (`lib/aussagen-zuordnung.ts`) und vergleicht mit dem,
 * was der Kalender schon weiß. Schreibt eine Vorschlagsdatei — **nicht in den Bau eingehängt**, nichts
 * davon erreicht `data/curated/` oder die Seite. Zahlen und Gegenprobe: `docs/wissen/sammelartikel-poc.md`.
 *
 * Aufruf: npx tsx pipeline/sammelartikel-poc.ts [--roh <Ordner>] [--holen] [--aus <Datei>] [--nur <Teil der Adresse>]
 *   --roh    Ordner mit gespeicherten HTML-Kopien (werden beim Holen dort abgelegt; ohne --holen nur gelesen)
 *   --holen  Artikel live holen (Anime2You per fetch, Crunchyroll per Playwright), auch wenn eine Kopie liegt
 *   --aus    Ausgabedatei (Vorgabe data/proposals/aussagen.json)
 *   --mit-inhalt  Handlungstexte mit ausgeben (sonst nur ihre Länge — fremde Texte gehören nicht ins Repo)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { artikelZeilen } from './lib/sammelartikel.ts'
import { aussagenAusAnime2You } from './lib/aussagen-anime2you.ts'
import { artikelDaten, aussagenAusLineup, aussagenAusSynchros, crunchyrollZeilen } from './lib/aussagen-crunchyroll.ts'
import { Katalog, ordneZu, type KatalogTitel, type Offen, type Zuordnung } from './lib/aussagen-zuordnung.ts'
import type { Aussage, Leser } from './lib/aussagen.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

/** Der Prüfkorpus: die Artikel, an denen der PoC gemessen wurde (Gegenprobe von Hand in der Doku). */
export const KORPUS: { url: string; leser: Leser }[] = [
  { url: 'https://www.anime2you.de/news/1052708/netflix-anime-neu-im-oktober-2026/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1054748/adn-neuzugaenge-im-oktober-2026/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1058202/crunchyroll-cold-sato-san-und-mehr/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1057488/crunchyroll-reborn-as-a-space-mercenary-und-mehr/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1057429/netflix-blue-box-staffel-2-und-mehr/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1055850/aniverse-reincarnated-as-a-sword-und-mehr/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1054668/akiba-pass-tv-zwei-herbst-2026-simulcasts/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1051128/disney-plus-campfire-cooking-und-mehr/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1054791/prime-video-attack-on-titan-und-mehr/', leser: 'anime2you-sammel' },
  /* Anime2Yous Spiegel der beiden Crunchyroll-Season-Artikel vom selben Tag — der Weg ohne Crunchyrolls Nutzungsbedingungen. */
  { url: 'https://www.anime2you.de/news/1050694/crunchyroll-herbst-2026-synchros/', leser: 'anime2you-sammel' },
  { url: 'https://www.anime2you.de/news/1050718/crunchyroll-19-neue-herbst-2026-simulcasts/', leser: 'anime2you-sammel' },
  { url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026', leser: 'crunchyroll-lineup' },
  { url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026', leser: 'crunchyroll-synchros' },
  { url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/6/17/crunchyroll-anime-lineup-sommer-2026', leser: 'crunchyroll-lineup' },
  { url: 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/6/17/crunchyroll-deutsche-synchros-sommer-2026', leser: 'crunchyroll-synchros' },
]

export interface Bestand {
  /** Was der Kalender zu diesem Titel und Anbieter schon führt. */
  status: 'neu' | 'bekannt' | 'abweichend' | 'ohne-zuordnung'
  release?: { slug: string; firstEpisodeDate?: string }
  ankuendigung?: { omuAb: string; synchro: string }
  hatSynchroBelege?: boolean
}

export interface Ergebnis extends Aussage {
  zuordnung?: Zuordnung
  offen?: Offen
  bestand: Bestand
}

function dateiname(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/_+$/, '').slice(0, 140) + '.html'
}

async function holeAnime2You(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) { warn(`${url}: HTTP ${res.status}`); return undefined }
  return res.text()
}

async function holeCrunchyroll(urls: string[]): Promise<Map<string, string>> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const raus = new Map<string, string>()
  try {
    const page = await (await browser.newContext({ userAgent: UA_BROWSER, locale: 'de-DE' })).newPage()
    for (const url of urls) {
      const antwort = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3000)
      const html = await page.content()
      if (antwort?.status() !== 200 || !/"datePublished"/.test(html)) { warn(`${url}: HTTP ${antwort?.status()}, ${html.length} Zeichen`); continue }
      raus.set(url, html)
      await sleep(2000)
    }
  } finally {
    await browser.close()
  }
  return raus
}

/** HTML je Artikel: aus dem Rohordner, sonst live — und dann dort ablegen. */
async function artikelHtml(korpus: typeof KORPUS, roh: string | undefined, holen: boolean): Promise<Map<string, string>> {
  const raus = new Map<string, string>()
  const fehlen: typeof KORPUS = []
  for (const k of korpus) {
    const pfad = roh ? join(roh, dateiname(k.url)) : undefined
    if (pfad && !holen && existsSync(pfad)) raus.set(k.url, readFileSync(pfad, 'utf8'))
    else fehlen.push(k)
  }
  for (const k of fehlen.filter((k) => k.leser === 'anime2you-sammel')) {
    const html = await holeAnime2You(k.url)
    if (html) raus.set(k.url, html)
    await sleep(1500)
  }
  const cr = fehlen.filter((k) => k.leser !== 'anime2you-sammel').map((k) => k.url)
  if (cr.length) for (const [url, html] of await holeCrunchyroll(cr)) raus.set(url, html)
  if (roh) {
    mkdirSync(roh, { recursive: true })
    for (const k of fehlen) if (raus.has(k.url)) writeFileSync(join(roh, dateiname(k.url)), raus.get(k.url)!)
  }
  return raus
}

function anime2YouKopf(html: string): { veroeffentlicht: string; aktualisiert?: string; ueberschrift: string } {
  const pub = /property="article:published_time" content="([^"]+)"/.exec(html)?.[1]?.slice(0, 10) ?? ''
  const mod = /property="article:modified_time" content="([^"]+)"/.exec(html)?.[1]?.slice(0, 10)
  const titel = /"headline":"([^"]+)"/.exec(html)?.[1]?.replace(/\\u00bb|\\u00ab/g, '') ?? ''
  return { veroeffentlicht: pub, ...(mod ? { aktualisiert: mod } : {}), ueberschrift: titel }
}

export function aussagenAus(url: string, leser: Leser, html: string): Aussage[] {
  if (leser === 'anime2you-sammel') {
    const kopf = anime2YouKopf(html)
    return aussagenAusAnime2You(artikelZeilen(html).split('\n').map((z) => z.trim()).filter(Boolean), { url, ...kopf })
  }
  const daten = artikelDaten(html)
  const quelle = { url, veroeffentlicht: daten.veroeffentlicht, ...(daten.aktualisiert ? { aktualisiert: daten.aktualisiert } : {}), leser }
  const zeilen = crunchyrollZeilen(html)
  return leser === 'crunchyroll-lineup' ? aussagenAusLineup(zeilen, quelle) : aussagenAusSynchros(zeilen, quelle)
}

interface AusgabeTitel extends KatalogTitel { ankuendigung?: { omuAb: string; synchro: string }; ohneSynchro?: boolean }

/**
 * Katalog aus den veröffentlichten Dateien: Titel mit Synchro plus Katalog ohne. `jpStart` trägt nur der
 * Katalog; für Titel mit Synchro steht er in `franchises.json` (Reihen-Sortierung). Im Bau selbst läge
 * beides in der `jpStart`-Karte aus `bau/02-titel.ts`.
 */
function katalogLaden(): { katalog: Katalog; titel: Map<number, AusgabeTitel> } {
  const mit = Object.values(readJson<Record<string, AusgabeTitel>>('public/data/titles.json', {}))
  const ohne = readJson<AusgabeTitel[]>('public/data/ohne-synchro.json', [])
  const synonyme = readJson<Record<string, string[]>>('public/data/synonyme.json', {})
  const reihen = readJson<Record<string, { id: number; jpStart?: string }[]>>('public/data/franchises.json', {})
  const startAusReihe = new Map<number, string>()
  for (const glieder of Object.values(reihen)) for (const g of glieder) if (g.jpStart && g.jpStart.length === 10) startAusReihe.set(g.id, g.jpStart)
  const titel = new Map<number, AusgabeTitel>()
  for (const t of [...mit, ...ohne]) {
    const alt = titel.get(t.id)
    const jpStart = t.jpStart ?? alt?.jpStart ?? startAusReihe.get(t.id)
    titel.set(t.id, { ...alt, ...t, ...(jpStart ? { jpStart } : {}), ohneSynchro: alt ? alt.ohneSynchro && t.ohneSynchro : t.ohneSynchro, synonyme: synonyme[String(t.id)] ?? [] })
  }
  return { katalog: new Katalog([...titel.values()]), titel }
}

/**
 * Was der Kalender schon weiß: Ein Start mit Tag ist `bekannt`, wenn ein Release des Titels beim Anbieter
 * denselben Tag trägt, `abweichend` bei anderem Tag. Eine Synchro-Ankündigung und ein OmU-Start sind
 * `bekannt`, wenn der Titel eine Ankündigung, ein Crunchyroll-Release oder Synchro-Belege hat.
 */
function bestandZu(a: Aussage, z: Zuordnung | undefined, titel: Map<number, AusgabeTitel>, releases: { slug: string; titleId: number; platform: string; schedule?: { firstEpisodeDate?: string } }[]): Bestand {
  if (!z) return { status: 'ohne-zuordnung' }
  const t = titel.get(z.anilistId)
  const passend = releases.filter((r) => r.titleId === z.anilistId && a.plattformen.includes(r.platform))
  const gleich = passend.find((r) => !a.datum || r.schedule?.firstEpisodeDate === a.datum)
  const r = gleich ?? passend[0]
  const hatSynchroBelege = Boolean(t && !t.ohneSynchro)
  const status: Bestand['status'] =
    a.art === 'synchro-angekuendigt' || a.art === 'omu-start'
      ? t?.ankuendigung || passend.length || (a.deutsch !== 'nein' && hatSynchroBelege) ? 'bekannt' : 'neu'
      : gleich ? 'bekannt' : passend.length ? 'abweichend' : 'neu'
  return {
    status,
    ...(r ? { release: { slug: r.slug, ...(r.schedule?.firstEpisodeDate ? { firstEpisodeDate: r.schedule.firstEpisodeDate } : {}) } } : {}),
    ...(t?.ankuendigung ? { ankuendigung: { omuAb: t.ankuendigung.omuAb, synchro: t.ankuendigung.synchro } } : {}),
    hatSynchroBelege,
  }
}

function zaehle<T>(xs: T[], f: (x: T) => string): Record<string, number> {
  const r: Record<string, number> = {}
  for (const x of xs) r[f(x)] = (r[f(x)] ?? 0) + 1
  return r
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const wert = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const roh = wert('--roh')
  const nur = wert('--nur')
  const aus = wert('--aus') ?? 'data/proposals/aussagen.json'
  const korpus = nur ? KORPUS.filter((k) => k.url.includes(nur)) : KORPUS
  const html = await artikelHtml(korpus, roh, args.includes('--holen'))
  const { katalog, titel } = katalogLaden()
  const releases = readJson<Parameters<typeof bestandZu>[3]>('public/data/releases.json', [])

  const ergebnisse: Ergebnis[] = []
  const jeArtikel: Record<string, unknown>[] = []
  for (const k of korpus) {
    const h = html.get(k.url)
    if (!h) { warn(`${k.url}: nicht gelesen`); continue }
    const aussagen = aussagenAus(k.url, k.leser, h)
    const erg = aussagen.map((a): Ergebnis => {
      const { zuordnung, offen } = ordneZu(a, katalog)
      return { ...a, ...(zuordnung ? { zuordnung } : {}), ...(offen ? { offen } : {}), bestand: bestandZu(a, zuordnung, titel, releases) }
    })
    ergebnisse.push(...erg)
    const zeile = {
      artikel: k.url, leser: k.leser, veroeffentlicht: aussagen[0]?.quelle.veroeffentlicht, aussagen: erg.length,
      ...('uebersprungen' in aussagen ? { uebersprungen: (aussagen as { uebersprungen?: number }).uebersprungen } : {}),
      deutsch: zaehle(erg, (e) => e.deutsch), zugeordnet: zaehle(erg.filter((e) => e.zuordnung), (e) => e.zuordnung!.wie),
      offen: erg.filter((e) => e.offen).length, bestand: zaehle(erg.filter((e) => e.zuordnung), (e) => e.bestand.status),
    }
    jeArtikel.push(zeile)
    log(`${k.url}\n  ${erg.length} Aussagen · deutsch ${JSON.stringify(zeile.deutsch)} · zugeordnet ${JSON.stringify(zeile.zugeordnet)} · offen ${zeile.offen} · Bestand ${JSON.stringify(zeile.bestand)}`)
    for (const e of erg.filter((e) => e.offen)) log(`    offen: »${e.titel}«${e.zusatz ? ` – ${e.zusatz}` : ''} (${e.datum ?? 'ohne Tag'}, ${e.deutsch}) — ${e.offen!.grund}`)
  }
  /* Handlungstexte sind fremde Sprachwerke (Rechte offen, siehe Doku) — ins Repo geht nur ihre Länge. */
  const ohneInhalt = ergebnisse.map(({ inhalt, ...e }) => ({ ...e, ...(inhalt ? { inhaltZeichen: inhalt.length } : {}) }))
  writeJson(aus, { stand: new Date().toISOString().slice(0, 10), hinweis: 'PoC, nicht in den Bau eingehängt — docs/wissen/sammelartikel-poc.md', jeArtikel, aussagen: args.includes('--mit-inhalt') ? ergebnisse : ohneInhalt }, true)
  log(`${ergebnisse.length} Aussagen aus ${jeArtikel.length} Artikeln → ${aus}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
