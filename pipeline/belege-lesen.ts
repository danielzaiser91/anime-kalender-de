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
import { chromium, type Page } from 'playwright'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { meldeAbbruch } from './lib/abbruch.ts'
import { todayIso } from '../shared/time.ts'
import type { NewsEintrag, Release, Title } from '../shared/types.ts'
import {
  adressenAusNews, adressenMitOffenemTermin, crunchyrollDatum, entzieheBild, isoTag, merkeLesung, textHash, traegtArtikeldatum, warteschlange, type BelegGedaechtnis, type Lesung,
} from './lib/beleg-lesung.ts'
import { ablegen } from './lib/beleg-ablage.ts'
import { belegAusschnitt } from './lib/beleg-bild.ts'
import { suchbegriffeJeAdresse, tageJeAdresse } from './lib/beleg-suche.ts'

const DATEI = 'data/beleg-lesungen.json'
/** Crunchyroll lässt nur einen Desktop-UA durch (wie `scrape-crunchyroll-woche.ts`); ADN liefert damit eine leere Seite. */
const UA_CRUNCHYROLL = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const STOERUNGEN_BIS_ABBRUCH = 3
/** Unter so vielen Zeichen ist es kein Artikel, sondern eine Hülle oder Fehlerseite. */
const MINDESTTEXT = 400

const args = process.argv.slice(2)
const zahl = (name: string, vorgabe: number) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : vorgabe)

/** Adressen, die einen noch offenen Termin belegen — oder noch nie gelesen wurden. */
function belegAdressen(gedaechtnis: BelegGedaechtnis, heute: string): string[] {
  return [...adressenMitOffenemTermin(readJson<Release[]>('public/data/releases.json', []), gedaechtnis, heute), ...adressenAusNews(readJson<NewsEintrag[]>('public/data/news.json', []))]
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
    if (!traegtArtikeldatum(url)) for (const l of e.lesungen) { l.ausgabe ??= l.veroeffentlicht; delete l.veroeffentlicht; delete l.aktualisiert }
  const adressen = args.includes('--adresse') ? [args[args.indexOf('--adresse') + 1]!] : belegAdressen(gedaechtnis, heute)
  const schlange = warteschlange(adressen, gedaechtnis, heute, zahl('--abstand', 7), zahl('--limit', 60))
  log(`Belege: ${schlange.length} Artikel fällig`)
  const suchbegriffe = suchbegriffeJeAdresse(readJson<Release[]>('public/data/releases.json', []), readJson<Title[]>('public/data/titles.json', []))
  const tage = tageJeAdresse(readJson<Release[]>('public/data/releases.json', []))
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
          /* Eine Produktseite nennt den Erscheinungstag der Ausgabe — eine andere Aussage als ein Veröffentlichungsdatum. */
          ausgabe: mitDatum ? undefined : (isoTag(g.veroeffentlicht) ?? crunchyrollDatum(g.veroeffentlicht)),
        }
        /* Eine als Wand entzogene Lesung zeigt nur die Wand — sie zählt weder als Vergleich noch bleibt sie neben der neuen stehen. */
        /* Das Datum in der Kopfzeile muss zu den Seitendaten passen — sonst stimmt eines von beiden nicht. */
        const kopf = mitDatum ? crunchyrollDatum(g.text.slice(0, 500)) : undefined
        if (kopf && lesung.veroeffentlicht && kopf !== lesung.veroeffentlicht && kopf !== lesung.aktualisiert) {
          lesung.datumsabweichung = kopf
          warn(`Beleg ${url}: Kopfzeile nennt ${kopf}, Seitendaten ${lesung.veroeffentlicht} — untersuchen`)
        }
        const letzte = gedaechtnis[url]?.lesungen.filter((l) => l.qs !== 'wand').at(-1)
        /* Ein neuer Text bei gleichen Daten darf nicht vorkommen: Er heißt, dass Unwesentliches den Hash ändert (Daniel, 03.10.2026). */
        if (letzte && letzte.hash !== hash && letzte.veroeffentlicht === lesung.veroeffentlicht && letzte.aktualisiert === lesung.aktualisiert && letzte.ausgabe === lesung.ausgabe) {
          lesung.aenderungOhneDatum = true
          warn(`Beleg ${url}: Text geändert, Daten gleich — untersuchen (tools/belege-pruefen.mjs)`)
        }
        /* Derselbe Text hat dasselbe Bild — eine Lesung mit neuem Datum verweist darauf, statt es neu zu erzeugen. */
        if (letzte?.hash === hash) Object.assign(lesung, { bild: letzte.bild, text: letzte.text, html: letzte.html, markierung: letzte.markierung })
        /* Ein neuer Stand bekommt sein Bild; fehlt es einem alten (Ablage war nicht erreichbar), wird es nachgeholt. */
        const ziel = letzte?.hash === hash ? letzte : lesung
        /* Auch ein Bild ohne Fundstelle wird neu gemacht (04.10.2026): Ältere Belege bekommen so ihre Markierung. */
        if (!ziel.bild || !ziel.qs || (!ziel.markierung && (suchbegriffe.get(url)?.length ?? 0) > 0)) {
          const basis = `${new URL(url).hostname}/${textHash(url)}/${ziel.am}-${hash}`
          const beleg = await belegAusschnitt(seite, suchbegriffe.get(url) ?? [], tage.get(url) ?? [])
          if (beleg === 'wand') {
            entzieheBild(gedaechtnis, url)
            throw new Error('Zustimmungswand bleibt im Bild — kein Beleg')
          }
          if (beleg) {
            ziel.qs = 'ok'
            if (beleg.markierung) ziel.markierung = lesung.markierung = beleg.markierung
            ziel.bild = await ablegen(`${basis}.webp`, beleg.bild, 'image/webp')
            ziel.text = await ablegen(`${basis}.txt.gz`, beleg.text, 'application/gzip')
          }
        }
        if (gedaechtnis[url]) gedaechtnis[url]!.lesungen = gedaechtnis[url]!.lesungen.filter((l) => l.qs !== 'wand')
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
