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
    for (const m of abschnitt.matchAll(/<li class="merch\d+[^"]*" data-date="([^"]*)">([\s\S]*?)<\/li>/g)) {
      const [, datum, block] = m
      const edition = /<span class="title">([^<]*)</.exec(block!)?.[1]?.trim()
      if (!edition) continue
      geprueft++
      /* Ausländische Ausgaben tragen ein Flaggenbild, deutsche nicht. */
      if (/class="flag"[^>]*alt="[a-z]{2}"/.test(block!)) {
        auslaendisch++
        continue
      }
      if (!istBildtraeger(edition)) {
        verworfen++
        continue
      }
      const pfad = /data-href="(article\/[^"]+)"/.exec(block!)?.[1]
      eigene.push({
        edition,
        datum: /^\d{4}-\d{2}-\d{2}$/.test(datum!) ? datum! : '',
        ...(pfad ? { url: `https://www.anisearch.de/${pfad}` } : {}),
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

main()
