/**
 * Gewinnt deutsche Disc-Termine aus dem archivierten aniSearch-Bestand.
 *
 * Jede aniSearch-Seite führt unter „Neuerscheinungen" die Veröffentlichungen zum
 * Titel — mit maschinenlesbarem Datum, Jahre im Voraus, über **alle** Publisher
 * hinweg. Damit erübrigt sich das Auslesen einzelner Verlagsseiten: peppermint
 * rendert seine Übersicht per JavaScript, AniMoon und Universum waren nicht
 * erreichbar, polyband sperrt Bots. Hier steht alles an einem Ort, in einer
 * Quelle, die uns das Lesen erlaubt.
 *
 * **Aber nicht nur die deutschen.** Bis zum 13.08.2026 stand hier „die deutschen
 * Veröffentlichungen", und das war schlicht falsch: Die Liste führt US-, UK- und
 * französische Ausgaben gleichberechtigt mit. Weil der Auszug sie alle nahm und
 * jedem Vorschlag den **deutschen** Publisher aus `info.languages` anhängte, sah
 * eine britische Blu-ray im Vorschlag aus wie eine deutsche von Crunchyroll.
 * Drei angebliche Terminwidersprüche gingen allein darauf zurück (Daniel,
 * 13.08.2026: „wieder us und uk … wir haben kein Interesse an Releases für
 * andere Sprachen als Deutsch").
 *
 * **Kein Abruf.** Gelesen wird ausschließlich das Archiv unter
 * `data/anisearch-raw/`, das der aniSearch-Lauf ohnehin anlegt.
 *
 * Das Ergebnis sind **Vorschläge**, keine Termine: Die Liste mischt Blu-rays
 * mit Manga-Bänden und Sammelfiguren, und ob eine „Vol. 2/3" die deutsche
 * Fassung des hier gemeinten Anime ist, entscheidet ein Mensch. Wie bei
 * Anime2You landet das Ergebnis deshalb in `data/proposals/`.
 *
 * Aufruf: npm run data:disc-proposals
 */
import { gunzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { todayIso } from '../shared/time.ts'
import type { Release, Title } from '../shared/types.ts'

const ARCHIV = 'data/anisearch-raw'

interface AnisearchEintrag {
  anisearchId: number
  info?: { languages?: { language: string; title?: string; publisher?: string[] }[] }
}

export interface DiscProposal {
  /** AniList-Kennung des Anime, zu dem die Ausgabe gehört. */
  titleId: number
  /** Name des Anime, wie wir ihn führen. */
  anime: string
  /** Bezeichnung der Ausgabe, wie aniSearch sie schreibt. */
  edition: string
  /** ISO-Datum der Veröffentlichung. */
  date: string
  /** Warum das als Disc gilt — damit die Prüfung von Hand schnell geht. */
  grund: string
  publisher?: string
  /** Adresse der Ausgabe bei aniSearch. */
  url: string
  /** true, wenn zu diesem Anime bereits ein Disc-Termin im Datensatz steht. */
  bekannt: boolean
}

/**
 * Entscheidet, ob eine Ausgabe ein Bildträger ist.
 *
 * Die Liste mischt vier Warengruppen, und nur eine gehört in einen
 * Anime-Kalender. Sicher erkennbar sind:
 *
 *   - **Disc** — `[Blu-ray]`, `[DVD]`, Box, Gesamtausgabe, Staffel, und die
 *     Bruchzählung „Vol. 2/3", die es bei Büchern nicht gibt
 *   - **Buch** — `[eBook]` und die deutsche Bandzählung „Bd. 02"
 *   - **Merchandise** — Figuren, Nendoroid, Pop!, Spiele
 *
 * Was in keine Gruppe fällt, wird verworfen statt geraten: Ein falscher
 * Disc-Termin im Kalender ist teurer als ein fehlender.
 */
function istDisc(titel: string): string | undefined {
  if (/\[(e-?book|ebook)\]/i.test(titel)) return undefined
  if (/\b(Bd\.|Band)\s*\d/i.test(titel)) return undefined
  if (/Nendoroid|\bPop!|\bFigur\b|Plüsch|\[Switch\]|\[PS[45]\]|Soundtrack|\bOST\b/i.test(titel)) {
    return undefined
  }

  if (/\[(blu-?ray[^\]]*|dvd[^\]]*)\]/i.test(titel)) return 'Bildträger im Titel benannt'
  if (/\bVol\.\s*\d+\s*\/\s*\d+/i.test(titel)) return 'Volume-Zählung („Vol. 2/3")'
  if (/\bBox\b|Komplett(box|set)|Gesamtausgabe|Complete/i.test(titel)) return 'Box oder Gesamtausgabe'
  if (/\bStaffel\b|\bSeason\b/i.test(titel)) return 'Staffel-Ausgabe'
  return undefined
}

function main(): void {
  if (!existsSync(ARCHIV)) {
    warn(`Kein Archiv unter ${ARCHIV} — erst "npm run data:anisearch" laufen lassen.`)
    return
  }

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const anisearch = readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {})
  if (!titles.length) {
    warn('Keine Titel — erst "npm run data:build" laufen lassen.')
    return
  }

  // Archiv ist nach aniSearch-Kennung abgelegt, unser Datensatz nach AniList.
  const nachAnisearchId = new Map<number, string>()
  for (const [titleId, eintrag] of Object.entries(anisearch)) {
    if (eintrag.anisearchId) nachAnisearchId.set(eintrag.anisearchId, titleId)
  }
  const titelNach = new Map(titles.map((t) => [t.id, t]))
  // Zu welchen Anime steht schon ein Disc-Termin im Datensatz?
  const mitDisc = new Set(releases.filter((r) => r.releaseType === 'disc').map((r) => r.titleId))

  const heute = todayIso()
  const vorschlaege: DiscProposal[] = []
  let geprüft = 0
  let verworfen = 0
  /** Ausgaben mit Landesflagge — US, UK, FR. Nicht unsere Baustelle. */
  let auslaendisch = 0

  for (const datei of readdirSync(ARCHIV)) {
    if (!datei.endsWith('.html.gz')) continue
    const anisearchId = Number(datei.replace('.html.gz', ''))
    const titleId = Number(nachAnisearchId.get(anisearchId))
    const anime = titelNach.get(titleId)
    if (!anime) continue

    const html = gunzipSync(readFileSync(`${ARCHIV}/${datei}`)).toString('utf8')
    const start = html.indexOf('<section id="items"')
    if (start < 0) continue
    const abschnitt = html.slice(start, html.indexOf('</section>', start))

    const de = anisearch[titleId]?.info?.languages?.find((l) => l.language === 'Deutsch')

    for (const m of abschnitt.matchAll(
      /<li class="merch\d+[^"]*" data-date="([^"]*)">([\s\S]*?)<\/li>/g,
    )) {
      const [, datum, block] = m
      // Nur Künftiges. Was erschienen ist, hilft einem Kalender nicht mehr.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < heute) continue
      /*
        **Der 31.12. ist bei aniSearch kein Termin, sondern ein Jahr.**

        Wo ein Verlag nur „2026" angekündigt hat, trägt der Eintrag den letzten
        Tag des Jahres. Am 29.08.2026 betraf das vier von 61 Vorschlägen —
        Bleach, Bleach TYBW, Dragon Ball Z und „Mein Nachbar Totoro", allesamt
        Reihen mit einer nächsten Box ohne Datum. Im Kalender stünde daraus die
        Behauptung, Totoro erscheine am Silvestertag.

        Der Handel veröffentlicht mittwochs und freitags; ein echter
        Verkaufsstart am 31.12. ist die Ausnahme, die diese Sperre zu Recht
        mitnimmt — lieber ein Termin zu wenig als ein erfundener.
      */
      if (datum.endsWith('-12-31')) continue
      const edition = /<span class="title">([^<]*)</.exec(block)?.[1]?.trim()
      if (!edition) continue
      geprüft++

      /**
       * Ausländische Ausgaben verwerfen.
       *
       * aniSearch markiert sie mit einem Flaggenbild im Block
       * (`<img … class="flag" alt="us">`); **deutsche Ausgaben tragen keine
       * Flagge**. Das ist keine Vermutung, sondern am Archiv abgelesen: Bei
       * „My Hero Academia: Vigilantes" steht die deutsche Gesamtausgabe vom
       * 04.09. ohne Flagge, daneben zwei gleichnamige `Season 1 [Blu-ray]` mit
       * `alt="us"` (08.09.) und `alt="gb"` (14.09.).
       *
       * Ein Kalender für deutsche Synchronfassungen hat für die keinen
       * Verwendungszweck — schlimmer noch, sie erzeugen Widersprüche zu
       * korrekten deutschen Terminen und kosten Prüfzeit von Hand.
       */
      const flagge = /class="flag"[^>]*alt="([a-z]{2})"/.exec(block)?.[1]
      if (flagge) {
        auslaendisch++
        continue
      }
      const grund = istDisc(edition)
      if (!grund) {
        verworfen++
        continue
      }
      const pfad = /data-href="(article\/[^"]+)"/.exec(block)?.[1]
      vorschlaege.push({
        titleId,
        anime: anime.titleDe ?? anime.titleEn ?? anime.titleRomaji ?? String(titleId),
        edition,
        date: datum,
        grund,
        publisher: de?.publisher?.[0],
        url: pfad ? `https://www.anisearch.de/${pfad}` : `https://www.anisearch.de/anime/${anisearchId}`,
        bekannt: mitDisc.has(titleId),
      })
    }
  }

  vorschlaege.sort((a, b) => a.date.localeCompare(b.date) || a.anime.localeCompare(b.anime))
  writeJson(
    'data/proposals/disc-anisearch.json',
    { scrapedAt: new Date().toISOString(), quelle: ARCHIV, proposals: vorschlaege },
    true,
  )

  // Was davon steht noch nicht im Datensatz? Verglichen wird Anime **und**
  // Datum: Zu einem Anime können mehrere Ausgaben gehören, und derselbe Anime
  // mit einem anderen Termin ist ein neuer Eintrag.
  const vorhanden = new Set(
    releases
      .filter((r) => r.releaseType === 'disc')
      .map((r) => `${r.titleId}|${r.schedule.firstEpisodeDate}`),
  )
  const neue = vorschlaege.filter((v) => !vorhanden.has(`${v.titleId}|${v.date}`))
  // Mehrere Editionen am selben Tag (Standard, Limited, Steelcase) sind für
  // den Kalender **ein** Termin — deshalb beide Zahlen nennen.
  const neueTermine = new Set(neue.map((v) => `${v.titleId}|${v.date}`)).size

  log(
    `Disc-Vorschläge: ${vorschlaege.length} künftige deutsche Ausgaben aus ${geprüft} Einträgen ` +
      `(${auslaendisch} ausländische, ${verworfen} als Buch, Figur oder Unklares verworfen)`,
  )
  log(
    `  davon noch nicht im Datensatz: ${neue.length} Ausgaben an ${neueTermine} Terminen ` +
      `zu ${new Set(neue.map((v) => v.titleId)).size} Anime`,
  )
  for (const v of neue.slice(0, 12)) {
    log(`  ${v.date}  ${v.anime.slice(0, 24).padEnd(26)} ${v.edition.slice(0, 44)}`)
  }
}

main()
