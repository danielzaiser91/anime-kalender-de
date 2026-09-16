/**
 * Deutsche Disc-Ausgaben aus dem aniSearch-Archiv — als **Bezugsweg**, nicht als Termin.
 *
 * **Warum es das braucht.** Am 29.08.2026 zeigen 1.041 Titel keinen einzigen
 * Weg, 693 davon mit belegter deutscher Synchro. Für den Leser steht dort „Kein
 * Anbieter bekannt", und das ist bei einem Anime von 2002 auch richtig: Er lief
 * nie bei einem Streamingdienst. Es gab ihn auf DVD.
 *
 * **Die Angabe liegt im Haus.** `data/anisearch-raw/` archiviert die
 * Titelseiten, und deren Abschnitt `<section id="items">` führt jede
 * Veröffentlichung mit Datum, Bezeichnung und Artikelseite. Gemessen an den 294
 * wegelosen Titeln mit Archivdatei: **205 haben eine deutsche Disc-Ausgabe**,
 * 179 davon mit belegter Synchro.
 *
 * Das ist derselbe Abschnitt, aus dem `extract-disc-dates.ts` **künftige**
 * Termine zieht. Der Unterschied ist die Richtung: Dort geht es um den
 * Kalender, hier um die Frage „wo bekomme ich das".
 *
 * **Drei Grenzen, alle beabsichtigt:**
 *
 * - **Kein Synchro-Beleg.** Eine deutsche Disc kann untertitelt sein; im Archiv
 *   steht wörtlich „Saber Marionette J (OmU)". Der Verweis trägt deshalb keine
 *   Sprachangabe — genau wie jeder andere `watchLink`.
 * - **Kein Versprechen auf Verfügbarkeit.** Eine DVD von 2005 ist oft vergriffen.
 *   Der Verweis führt auf die Artikelseite bei aniSearch, die die Ausgabe
 *   beschreibt; ob sie noch zu kaufen ist, sagt der Händler.
 * - **Nur deutsche Ausgaben.** aniSearch führt US-, UK- und französische
 *   gleichberechtigt und markiert sie mit einem Flaggenbild; deutsche tragen
 *   keine Flagge (belegt am 13.08.2026). In der Messung waren 1.182 von 1.387
 *   Blöcken ausländisch — ohne diesen Filter wäre der Ertrag Unsinn.
 *
 * **Kein Abruf.** Gelesen wird ausschließlich das Archiv, das der aniSearch-Lauf
 * ohnehin anlegt.
 *
 * Aufruf: `npm run data:disc-ausgaben`
 */
import { gunzipSync } from 'node:zlib'
import { readFileSync, readdirSync } from 'node:fs'
import { log, readJson, writeJson } from './lib/util.ts'
import type { Title } from '../shared/types.ts'

const ARCHIV = 'data/anisearch-raw'
const ZIEL = 'data/disc-ausgaben.json'

/** Eine Ausgabe, wie aniSearch sie führt. */
interface Ausgabe {
  /** Bezeichnung im Klartext — sie nennt oft schon den Träger und die Fassung. */
  edition: string
  /** Erscheinungsdatum, ISO. Auch Vergangenes zählt: Es ist der Bezugsweg. */
  datum: string
  /** Artikelseite bei aniSearch, wo es eine gibt. */
  url?: string
  /** Bildträger: „Blu-ray", „DVD", „4K UHD". */
  format?: string
  /** `gesamt` — Komplettset/Gesamtausgabe, `teil` — Volume/Box x/y, `einzel` — alles andere. */
  art?: 'gesamt' | 'teil' | 'einzel'
  /** Die Bezeichnung ohne Reihennamen und Formatklammer: „Box 1/4", „Komplettset". */
  kurz?: string
}

/**
 * **Welcher Bildträger — gelesen an der Plakette, nicht nur am Namen.**
 *
 * aniSearch setzt eine Plakette (`<div class="rank">Blu-ray</div>`) an Blu-ray, 4K,
 * eBook und Spiele — an DVDs **nicht**. „Dragon Quest: The Adventure of Dai -
 * Komplettset" ist die DVD neben „… - Komplettset [Blu-ray]" und fiel deshalb bis zum
 * 16.09.2026 heraus (Daniel: „die discs … sind in blueray und dvd aufgeteilt").
 * Gemessen über 27.695 deutsche Artikel: 4.499 Blu-ray-Plaketten, keine einzige für DVD.
 *
 * Ohne Plakette steht aber auch Manga („Bd. 12"), Figuren und Musik. Eine DVD ist es
 * deshalb nur, wenn es einen Blu-ray-Zwilling gleichen Namens gibt oder der Name ein
 * Video-Merkmal trägt.
 */
export function formatAus(edition: string, plakette: string | undefined, zwillinge: Set<string>): string | null {
  if (plakette) {
    if (/UHD/i.test(plakette)) return '4K UHD'
    if (/Blu-?ray/i.test(plakette)) return 'Blu-ray'
    if (/DVD/i.test(plakette)) return 'DVD'
    return null
  }
  if (/\[[^\]]*\]\s*$/.test(edition)) {
    if (/\[Blu-?ray\]/i.test(edition)) return 'Blu-ray'
    if (/\[DVD\]/i.test(edition)) return 'DVD'
    return null
  }
  if (/\bBd\.|Figur|Modell|\bOST\b|Soundtrack|\bSongs?\b|Album|\bCD\b|\bED:|\bOP:|Artbook|Roman|Poster|Kalender|Nendoroid/i.test(edition)) return null
  if (zwillinge.has(edition)) return 'DVD'
  if (/\bVol\.\s*\d+\/\d+|\bBox\b|Gesamtausgabe|Komplettset|Complete|Collection|Staffel|\bDVD\b|Mediabook|Steelbook|Digipack/i.test(edition)) return 'DVD'
  return null
}

/** Gesamtausgabe, Teil einer Reihe von Bänden oder eine einzelne Ausgabe (Film, Special). */
export function artAus(edition: string): 'gesamt' | 'teil' | 'einzel' {
  if (/\b\d+\s*\/\s*\d+\b/.test(edition) || /\bVol\.\s*\d/i.test(edition)) return 'teil'
  if (/Gesamtausgabe|Komplettset|Komplettbox|Complete|Collection/i.test(edition)) return 'gesamt'
  return 'einzel'
}

/** „Reihe - Box 1/4 [Blu-ray]" → „Box 1/4". */
export function kurzAus(edition: string): string {
  const ohneKlammer = edition.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
  const i = ohneKlammer.indexOf(' - ')
  return i >= 0 ? ohneKlammer.slice(i + 3).trim() : ohneKlammer
}

/**
 * Was als Bildträger zählt.
 *
 * Dieselbe Liste wie in `extract-disc-dates.ts`, aus demselben Grund: Der
 * Abschnitt mischt Blu-rays mit Manga-Bänden, Soundtracks und Sammelfiguren.
 * „Vol." allein wäre zu weit — es steht auch über Manga-Bänden —, deshalb nur
 * zusammen mit einem Trägerwort oder einer Gesamtausgabe.
 */
function istBildtraeger(edition: string): string | null {
  if (/\bBlu-?ray\b/i.test(edition)) return 'Blu-ray'
  if (/\bDVD\b/i.test(edition)) return 'DVD'
  if (/\b(Mediabook|Steelbook|Digipack)\b/i.test(edition)) return 'Sonderausgabe'
  if (/\bGesamtausgabe\b/i.test(edition)) return 'Gesamtausgabe'
  return null
}

function main(): void {
  const anisearch = readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const nachAsId = new Map<number, number>()
  for (const [id, e] of Object.entries(anisearch)) {
    if (e.anisearchId) nachAsId.set(e.anisearchId, Number(id))
  }
  const bekannt = new Set(titles.map((t) => t.id))

  const raus: Record<string, Ausgabe[]> = {}
  let geprueft = 0
  let auslaendisch = 0
  let verworfen = 0

  for (const datei of readdirSync(ARCHIV)) {
    if (!datei.endsWith('.html.gz')) continue
    const asId = Number(datei.replace('.html.gz', ''))
    const titleId = nachAsId.get(asId)
    if (!titleId || !bekannt.has(titleId)) continue

    const html = gunzipSync(readFileSync(`${ARCHIV}/${datei}`)).toString('utf8')
    const start = html.indexOf('<section id="items"')
    if (start < 0) continue
    const abschnitt = html.slice(start, html.indexOf('</section>', start))

    const eigene: Ausgabe[] = []
    const bloecke = [...abschnitt.matchAll(/<li class="merch\d+[^"]*" data-date="([^"]*)">([\s\S]*?)<\/li>/g)]
      .map((m) => ({
        datum: m[1]!,
        block: m[2]!,
        edition: /<span class="title">([^<]*)</.exec(m[2]!)?.[1]?.trim().replace(/&amp;/g, '&') ?? '',
      }))
      .filter((b) => b.edition)
    /* Namen, zu denen es eine „[Blu-ray]"-Fassung gibt — ihr Zwilling ohne Klammer ist die DVD. */
    const zwillinge = new Set(
      bloecke.filter((b) => /\s*\[Blu-?ray\]\s*$/i.test(b.edition)).map((b) => b.edition.replace(/\s*\[Blu-?ray\]\s*$/i, '')),
    )
    for (const { datum, block, edition } of bloecke) {
      geprueft++
      /* Ausländische Ausgaben tragen ein Flaggenbild, deutsche nicht. */
      if (/class="flag"[^>]*alt="[a-z]{2}"/.test(block)) {
        auslaendisch++
        continue
      }
      const plakette = /<div class="rank">([^<]*)</.exec(block)?.[1]
      const format = formatAus(edition, plakette, zwillinge) ?? (istBildtraeger(edition) ? 'DVD' : null)
      if (!format) {
        verworfen++
        continue
      }
      const pfad = /data-href="(article\/[^"]+)"/.exec(block)?.[1]
      eigene.push({
        edition,
        datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : '',
        ...(pfad ? { url: `https://www.anisearch.de/${pfad}` } : {}),
        format,
        art: artAus(edition),
        kurz: kurzAus(edition),
      })
    }
    if (!eigene.length) continue
    /* Die jüngste zuerst — sie ist am ehesten noch zu bekommen. */
    eigene.sort((a, b) => b.datum.localeCompare(a.datum))
    raus[String(titleId)] = eigene
  }

  writeJson(ZIEL, raus)
  const ohneWeg = titles.filter(
    (t) => !(t.streams ?? []).length && !(t.watchLinks ?? []).length && raus[String(t.id)],
  ).length
  log(
    `Disc-Ausgaben: ${Object.keys(raus).length} Titel mit deutscher Ausgabe ` +
      `(${geprueft} Blöcke geprüft, ${auslaendisch} ausländisch, ${verworfen} kein Bildträger)`,
  )
  log(`  davon ${ohneWeg} Titel, die sonst keinen einzigen Weg zeigen`)
}

/* Nur als Hauptlauf — die Zusicherungen importieren die Funktionen oben, und ein Import darf
   die Datei nicht neu schreiben (dieselbe Falle wie `disc-proposals-to-yaml.ts`, 30.08.2026). */
if (process.argv[1]?.replaceAll(String.fromCharCode(92), '/').endsWith('extract-disc-ausgaben.ts')) main()
