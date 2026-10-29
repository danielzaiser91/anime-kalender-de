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
 * drei Störungen in Folge bei einem Anbieter ruht dieser bis zum nächsten Lauf — eine Sperre wird
 * abgewartet, nicht durchgefragt; die übrigen Anbieter werden weiter gelesen (`lib/beleg-stoerung.ts`). Eine gescheiterte
 * Adresse steht danach hinter den übrigen (`lib/beleg-fehlschlag.ts`, Marken in `data/beleg-fehlschlaege.json`).
 *
 * Aufruf: npx tsx pipeline/belege-lesen.ts [--limit 25] [--abstand 7] [--adresse <url>]
 */
import { chromium } from 'playwright'
import { readJson, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { meldeAbbruch } from './lib/abbruch.ts'
import { todayIso } from '../shared/time.ts'
import type { NewsEintrag, Release } from '../shared/types.ts'
import { adressenAusNews, adressenMitOffenemTermin, bildOhnePruefung, traegtArtikeldatum, type BelegGedaechtnis } from './lib/beleg-lesung.ts'
import type { Fehlschlaege } from './lib/beleg-fehlschlag.ts'
import { schreibeOhneFundstelle } from './lib/beleg-ohne-fundstelle.ts'
import { zuordnungFuerLesen } from './lib/beleg-suche.ts'
import { fuehreLaufAus } from './lib/beleg-lauf.ts'

const DATEI = 'data/beleg-lesungen.json'
/** Letzter Fehlschlag je Adresse (`lib/beleg-fehlschlag.ts`); Laufgedächtnis, keine Datenkorrektur. */
const FEHLSCHLAEGE = 'data/beleg-fehlschlaege.json'
/** Crunchyroll lässt nur einen Desktop-UA durch (wie `scrape-crunchyroll-woche.ts`); ADN liefert damit eine leere Seite. */
const UA_CRUNCHYROLL = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const args = process.argv.slice(2)
const zahl = (name: string, vorgabe: number) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : vorgabe)

/** Adressen, die einen noch offenen Termin belegen — oder noch nie gelesen wurden. */
function belegAdressen(gedaechtnis: BelegGedaechtnis, heute: string): string[] {
  /* Dazu der Altbestand ohne Wand-Prüfung und entzogene Wände: Sie hängen oft an abgeschlossenen Terminen und kämen sonst nie wieder dran. */
  const nachzuholen = Object.keys(gedaechtnis).filter((u) => bildOhnePruefung(gedaechtnis[u]))
  return [...adressenMitOffenemTermin(readJson<Release[]>('public/data/releases.json', []), gedaechtnis, heute), ...adressenAusNews(readJson<NewsEintrag[]>('public/data/news.json', [])), ...nachzuholen]
}

/** Zwei Seiten im Browser: Crunchyroll mit Desktop-UA, alle anderen mit dem Standard. */
async function oeffneBrowser() {
  const browser = await chromium.launch()
  try {
    const ansicht = { locale: 'de-DE', viewport: { width: 1280, height: 900 } }
    const cr = await browser.newPage({ ...ansicht, userAgent: UA_CRUNCHYROLL })
    const andere = await browser.newPage(ansicht)
    for (const s of [cr, andere]) await s.addInitScript('window.__name = (f) => f')
    return { cr, andere, schliessen: () => browser.close() }
  } catch (e) {
    await browser.close()
    throw e
  }
}

async function main(): Promise<void> {
  const heute = todayIso()
  const gedaechtnis = readJson<BelegGedaechtnis>(DATEI, {})
  /* Altlast vom 02.10.2026: Produktseiten trugen den Erscheinungstag der Ausgabe als Veröffentlichungsdatum. */
  for (const [url, e] of Object.entries(gedaechtnis))
    if (!traegtArtikeldatum(url)) for (const l of e.lesungen) { l.ausgabe ??= l.veroeffentlicht; delete l.veroeffentlicht; delete l.aktualisiert }
  const adressen = args.includes('--adresse') ? [args[args.indexOf('--adresse') + 1]!] : belegAdressen(gedaechtnis, heute)
  const { suchbegriffe, gruppen, tage } = zuordnungFuerLesen(readJson)
  const fehlschlaege = readJson<Fehlschlaege>(FEHLSCHLAEGE, {})
  const speichern = (gelesen: number): void => {
    writeJson(DATEI, gedaechtnis, true)
    writeJson(FEHLSCHLAEGE, fehlschlaege, true)
    recordSource('beleg-lesungen', gelesen)
    schreibeOhneFundstelle(gedaechtnis, gruppen)
  }
  await fuehreLaufAus({ gedaechtnis, heute, suchbegriffe, gruppen, tage, adressen, fehlschlaege, limit: zahl('--limit', 60), abstand: zahl('--abstand', 7) }, { oeffne: oeffneBrowser, speichern })
}

main().catch(async (err) => {
  recordSource('beleg-lesungen', 0, (err as Error).message, 0)
  await meldeAbbruch('beleg-lesungen', err, 'belege')
  console.error(err)
  process.exit(1)
})
