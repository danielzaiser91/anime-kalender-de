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
 * reine Schätzung verschwindet still.
 *
 * **Das Gedächtnis hält die Widerlegung über das Wochenfenster hinaus.** Sonst
 * fiele sie in der nächsten Woche zurück, sobald die Vorschau weiterzieht, und
 * die Seite behauptete wieder einen deutschen Start, den der Anbieter selbst
 * verneint hat. `data/widerlegte-termine.json` trägt sie, bis dieselbe
 * Wochenvorschau für den Tag ein `de` führt oder der Termin sich verschiebt.
 */
import { readJson, writeJson, log } from '../lib/util.ts'
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

/** Eine widerlegte deutsche Zusage, wie sie im Gedächtnis steht. */
export interface Widerlegung {
  am: string
  grund: string
  quelle?: string
  gemeldet: boolean
}

export type WiderlegungsGedaechtnis = Record<string, Widerlegung>

const DATEI = 'data/widerlegte-termine.json'
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

/** Serienkennung + Tag → geführte Sprachen. Fehlt die Kennung, ist keine Aussage möglich. */
function sprachenJeSerieTag(woche: Wochenprogramm): Map<string, Set<string>> {
  const karte = new Map<string, Set<string>>()
  for (const e of woche.eintraege ?? []) {
    if (!e.seriesId || !e.datum || !e.sprache) continue
    const k = `${e.seriesId}|${e.datum}`
    const set = karte.get(k) ?? new Set<string>()
    set.add(e.sprache)
    karte.set(k, set)
  }
  return karte
}

/**
 * Die Widerlegungen aus Vorschau und Gedächtnis zusammenführen — eine reine
 * Rechnung, damit `check:logic` sie ohne Datei prüfen kann.
 *
 * Im Fenster entscheidet die Vorschau: `de` hebt eine frühere Widerlegung auf,
 * nur `ja` schreibt eine neue. Außerhalb bleibt Gemerktes stehen, solange der
 * Termin derselbe ist; verschobene oder verschwundene Termine fallen heraus.
 */
export function sammleWiderlegungen(
  releases: Release[],
  titles: Map<number, Title>,
  woche: Wochenprogramm,
  gedaechtnis: WiderlegungsGedaechtnis,
): { anzahl: number; gedaechtnis: WiderlegungsGedaechtnis } {
  const from = woche.wocheAb
  const bis = from ? addDays(from, 6) : ''
  const sprachen = sprachenJeSerieTag(woche)
  const neu: WiderlegungsGedaechtnis = {}
  let anzahl = 0
  for (const r of releases) {
    if (r.platform !== 'crunchyroll') continue
    const datum = r.schedule?.firstEpisodeDate
    const title = titles.get(r.titleId)
    const kennung = kennungDesReleases(r, title)
    const imFenster = Boolean(from && datum && datum >= from && datum <= bis)
    const heute = imFenster && kennung ? sprachen.get(`${kennung}|${datum}`) : undefined
    if (heute?.has('de')) continue
    if (widerlegtDurchWoche(heute)) {
      neu[r.slug] = { am: datum!, grund: GRUND, quelle: woche.artikel, gemeldet: warBehauptet(r, title) }
      anzahl++
      continue
    }
    const alt = gedaechtnis[r.slug]
    if (alt && alt.am === datum) neu[r.slug] = alt
  }
  return { anzahl, gedaechtnis: neu }
}

/**
 * Widerlegt jeden deutschen Termin aus der Wochenvorschau, trägt das Ergebnis in
 * die Releases und führt das Gedächtnis fort. Gibt die Zahl der **neuen**
 * Widerlegungen zurück; der Bau protokolliert sie.
 */
export function widerlegeDeutscheTermine(releases: Release[], titles: Map<number, Title>): number {
  const woche = readJson<Wochenprogramm>('data/crunchyroll-woche.json', {})
  const gedaechtnis = readJson<WiderlegungsGedaechtnis>(DATEI, {})
  const { anzahl, gedaechtnis: neu } = sammleWiderlegungen(releases, titles, woche, gedaechtnis)
  for (const r of releases) {
    const gemerkt = neu[r.slug]
    if (gemerkt) r.widerlegt = gemerkt
  }
  writeJson(DATEI, neu, true)
  log(`${anzahl} deutsche Termin(e) durch das Wochenprogramm neu widerlegt, ${Object.keys(neu).length} im Gedächtnis`)
  return anzahl
}
