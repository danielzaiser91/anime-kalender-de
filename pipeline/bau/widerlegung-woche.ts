/**
 * **Das Wochenprogramm widerlegt einen deutschen Termin** (02.10.2026).
 *
 * Crunchyrolls Wochenvorschau führt je Serie und Tag, in welcher Sprachfassung
 * eine Folge läuft (`data/crunchyroll-woche.json`). Steht dort für unseren
 * deutschen Termin am selben Tag nur `ja`, ist das ein **starker Beleg vom
 * selben Anbieter**: Die deutsche Fassung kommt so nicht. Gemessen am
 * 02.10.2026: 180 deutsche Crunchyroll-Termine, **2** im Fenster der Vorschau —
 * beide widerlegt (Apothekerin S3, 02.10.; Black Clover S2, 03.10.).
 *
 * Widerlegt wird **immer** — der Termin verschwindet aus dem Kalender
 * (`shared/logic.ts`). Gemeldet wird nur, was vorher **behauptet** war: Trägt
 * der Titel einen belegten deutschen Weg (`dub: true`) oder war der Termin
 * nicht bloß geschätzt, gehört eine `zurueckgezogen`-Meldung dazu (Daniel:
 * „widerlegt wird immer, gemeldet wird nur, was vorher behauptet wurde"); eine
 * reine Schätzung verschwindet still. Eigene Datei, weil weder `news.ts` noch
 * `10-termine.ts` die Ableitung tragen soll.
 */
import { readJson, log } from '../lib/util.ts'
import { crunchyrollSeriesId } from '../lib/crunchyroll.ts'
import { addDays } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'

/** Eine Zeile der Wochenvorschau, soweit sie hier zählt. */
export interface WochenZeile {
  seriesId?: string
  titel?: string
  sprache?: string
  datum?: string
}

export interface Wochenprogramm {
  wocheAb?: string
  artikel?: string
  eintraege?: WochenZeile[]
}

const GRUND =
  'Crunchyrolls Wochenprogramm führt an diesem Tag nur die japanische Fassung (OmU) — keine deutsche Folge.'

/** Deckt die Vorschau den Tag, und führt sie die Serie dort **nur** japanisch? */
export function widerlegtDurchWoche(sprachen: Set<string> | undefined): boolean {
  return Boolean(sprachen?.has('ja') && !sprachen.has('de'))
}

/** Die Serienkennung eines Releases — aus seiner Adresse oder aus dem Weg desselben Anbieters. */
function kennungDesReleases(release: Release, title: Title | undefined): string | undefined {
  return (
    crunchyrollSeriesId(release.platformUrl) ??
    /\/series\/([A-Z0-9]+)/i.exec(
      title?.streams.find((s) => s.platform === release.platform)?.url ?? '',
    )?.[1]
  )
}

/**
 * War der Termin vorher behauptet? Ein bloß **geschätzter** Termin ohne belegten
 * deutschen Weg ist es nicht — er verschwindet still, statt eine Meldung zu
 * erzeugen. Ein bestätigter Termin oder ein `dub: true` auf derselben Plattform
 * dagegen war eine Behauptung, die der Leser gesehen hat.
 */
function warBehauptet(release: Release, title: Title | undefined): boolean {
  if (!release.schedule.estimated) return true
  return Boolean(title?.streams.some((s) => s.platform === release.platform && s.dub === true))
}

/**
 * Setzt `widerlegt` an jeden deutschen Termin, den die Wochenvorschau widerlegt.
 * Gibt die Zahl zurück; der Bau protokolliert sie.
 */
export function widerlegeDeutscheTermine(
  releases: Release[],
  titles: Map<number, Title>,
  woche: Wochenprogramm = readJson<Wochenprogramm>('data/crunchyroll-woche.json', {}),
): number {
  const from = woche.wocheAb
  if (!from) return 0
  const bis = addDays(from, 6)

  /* Serienkennung + Tag → geführte Sprachen. Fehlt die Kennung, ist keine Aussage möglich. */
  const jeSerieTag = new Map<string, Set<string>>()
  for (const e of woche.eintraege ?? []) {
    if (!e.seriesId || !e.datum || !e.sprache) continue
    const k = `${e.seriesId}|${e.datum}`
    const set = jeSerieTag.get(k) ?? new Set<string>()
    set.add(e.sprache)
    jeSerieTag.set(k, set)
  }

  let n = 0
  for (const r of releases) {
    if (r.platform !== 'crunchyroll' || r.widerlegt) continue
    const datum = r.schedule?.firstEpisodeDate
    if (!datum || datum < from || datum > bis) continue
    const title = titles.get(r.titleId)
    const kennung = kennungDesReleases(r, title)
    if (!kennung) continue
    if (!widerlegtDurchWoche(jeSerieTag.get(`${kennung}|${datum}`))) continue
    r.widerlegt = { am: datum, grund: GRUND, quelle: woche.artikel, gemeldet: warBehauptet(r, title) }
    n++
    log(
      `  ${r.slug}: deutscher Termin am ${datum} durch das Wochenprogramm widerlegt` +
        (r.widerlegt.gemeldet ? ' — mit Meldung' : ' — bloße Schätzung, verschwindet still'),
    )
  }
  return n
}
