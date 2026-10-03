/**
 * **Belege lesen: je Artikel Hash, Datum und ein privates Bild** (Daniel, 02.10.2026: „Screenshot,
 * privat").
 *
 * Die Termine im Bestand nennen ihre Quellen; dieser Lauf öffnet die Artikel darunter in einem
 * echten Browser (Crunchyroll beantwortet einen Abruf ohne Browser nur mit der Cloudflare-Hülle),
 * hält je Lesung Text-Hash, „Veröffentlicht" und „Aktualisiert" fest und legt Bild und HTML in der
 * privaten R2-Ablage des Workers ab (`/beleg`). Das Gedächtnis steht in `data/beleg-lesungen.json`.
 *
 * Eine Störung ist kein Befund: Liefert eine Seite keinen Artikeltext, wird nichts gemerkt. Nach
 * drei Störungen in Folge endet der Lauf — eine Sperre wird abgewartet, nicht durchgefragt.
 *
 * Aufruf: npx tsx pipeline/belege-lesen.ts [--limit 25] [--abstand 7] [--adresse <url>]
 */
import { gzipSync } from 'node:zlib'
import { chromium, type Page } from 'playwright'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { meldeAbbruch } from './lib/abbruch.ts'
import { todayIso } from '../shared/time.ts'
import type { Release } from '../shared/types.ts'
import {
  crunchyrollDatum, isoTag, merkeLesung, textHash, traegtArtikeldatum, warteschlange, type BelegGedaechtnis, type Lesung,
} from './lib/beleg-lesung.ts'
import { ablegen } from './lib/beleg-ablage.ts'

const DATEI = 'data/beleg-lesungen.json'
/** Crunchyroll lässt nur einen Desktop-UA durch (wie `scrape-crunchyroll-woche.ts`); ADN liefert damit eine leere Seite. */
const UA_CRUNCHYROLL = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const STOERUNGEN_BIS_ABBRUCH = 3
/** Unter so vielen Zeichen ist es kein Artikel, sondern eine Hülle oder Fehlerseite. */
const MINDESTTEXT = 400

const args = process.argv.slice(2)
const zahl = (name: string, vorgabe: number) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : vorgabe)

/** Alle Adressen, die im ausgelieferten Bestand einen Termin oder eine Meldung belegen. */
function belegAdressen(): string[] {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  return releases.flatMap((r) => [...(r.quellen ?? []).map((q) => q.url), ...(r.sources ?? [])])
}

interface Gelesen {
  text: string
  veroeffentlicht?: string
  aktualisiert?: string
}

async function lies(seite: Page, url: string): Promise<Gelesen> {
  await seite.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  /* Der Text steht in `<article>` (Crunchyroll, Anime2You) oder in `<main>` (aniSearch; ADN hat ein leeres `<article>`). */
  await seite
    .waitForFunction((n) => Math.max(...['article', 'main'].map((s) => document.querySelector(s)?.textContent?.length ?? 0)) > n, MINDESTTEXT, { timeout: 20_000 })
    .catch(() => undefined)
  return seite.evaluate(() => {
    const meta = (p: string) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ?? undefined
    const body = document.body.innerText
    const texte = ['article', 'main'].map((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '')
    return {
      text: texte.sort((a, b) => b.length - a.length)[0]!,
      veroeffentlicht: meta('article:published_time') ?? /Veröffentlicht:\s*([^\n]+)/.exec(body)?.[1],
      aktualisiert: meta('article:modified_time') ?? /Aktualisiert:\s*([^\n]+)/.exec(body)?.[1],
    }
  })
}

async function main(): Promise<void> {
  const heute = todayIso()
  const gedaechtnis = readJson<BelegGedaechtnis>(DATEI, {})
  /* Altlast vom 02.10.2026: Produktseiten trugen den Erscheinungstag der Ausgabe als Veröffentlichungsdatum. */
  for (const [url, e] of Object.entries(gedaechtnis))
    if (!traegtArtikeldatum(url)) for (const l of e.lesungen) { delete l.veroeffentlicht; delete l.aktualisiert }
  const adressen = args.includes('--adresse') ? [args[args.indexOf('--adresse') + 1]!] : belegAdressen()
  const schlange = warteschlange(adressen, gedaechtnis, heute, zahl('--abstand', 7), zahl('--limit', 25))
  log(`Belege: ${schlange.length} Artikel fällig`)
  const browser = await chromium.launch()
  let gelesen = 0
  let neu = 0
  let stoerungen = 0
  try {
    const ansicht = { locale: 'de-DE', viewport: { width: 1280, height: 900 } }
    const cr = await browser.newPage({ ...ansicht, userAgent: UA_CRUNCHYROLL })
    const andere = await browser.newPage(ansicht)
    for (const s of [cr, andere]) await s.addInitScript('window.__name = (f) => f')
    for (const url of schlange) {
      try {
        const seite = url.includes('crunchyroll.com') ? cr : andere
        const g = await lies(seite, url)
        if (g.text.length < MINDESTTEXT) throw new Error(`kein Artikeltext (${g.text.length} Zeichen)`)
        stoerungen = 0
        const hash = textHash(g.text)
        const mitDatum = traegtArtikeldatum(url)
        const lesung: Lesung = {
          am: heute,
          hash,
          veroeffentlicht: mitDatum ? (isoTag(g.veroeffentlicht) ?? crunchyrollDatum(g.veroeffentlicht)) : undefined,
          aktualisiert: mitDatum ? (isoTag(g.aktualisiert) ?? crunchyrollDatum(g.aktualisiert)) : undefined,
        }
        const letzte = gedaechtnis[url]?.lesungen.at(-1)
        /* Derselbe Text hat dasselbe Bild — eine Lesung mit neuem Datum verweist darauf, statt es neu zu erzeugen. */
        if (letzte?.hash === hash) Object.assign(lesung, { bild: letzte.bild, html: letzte.html })
        /* Ein neuer Stand bekommt sein Bild; fehlt es einem alten (Ablage war nicht erreichbar), wird es nachgeholt. */
        const ziel = letzte?.hash === hash ? letzte : lesung
        if (!ziel.bild) {
          const basis = `${new URL(url).hostname}/${textHash(url)}/${ziel.am}-${hash}`
          /* Crunchyrolls Cookie-Banner läge quer über dem Artikel — entfernt, nicht beantwortet. */
          await seite.evaluate(() => document.querySelector('#onetrust-consent-sdk')?.remove())
          ziel.bild = await ablegen(`${basis}.jpg`, await seite.screenshot({ fullPage: true, type: 'jpeg', quality: 60 }), 'image/jpeg')
          ziel.html = await ablegen(`${basis}.html.gz`, gzipSync(await seite.content()), 'application/gzip')
        }
        if (merkeLesung(gedaechtnis, url, lesung)) neu++
        gelesen++
      } catch (e) {
        warn(`Beleg nicht gelesen: ${url} — ${(e as Error).message}`)
        if (++stoerungen >= STOERUNGEN_BIS_ABBRUCH) {
          warn(`${STOERUNGEN_BIS_ABBRUCH} Störungen in Folge — der Lauf endet hier, das Erreichte wird geschrieben.`)
          break
        }
      }
    }
  } finally {
    await browser.close()
  }
  writeJson(DATEI, gedaechtnis, true)
  recordSource('beleg-lesungen', gelesen)
  log(`Belege: ${gelesen} gelesen, ${neu} mit neuem Stand, ${Object.keys(gedaechtnis).length} im Gedächtnis`)
}

main().catch(async (err) => {
  recordSource('beleg-lesungen', 0, (err as Error).message, 0)
  await meldeAbbruch('beleg-lesungen', err, 'belege')
  console.error(err)
  process.exit(1)
})
