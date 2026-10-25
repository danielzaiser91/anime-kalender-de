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
import type { CrDubData } from '../lib/crunchyroll-dub.ts'
import { addDays, toIsoDate } from '../../shared/time.ts'
import type { Release, Title } from '../../shared/types.ts'
import { staffelDesTitels } from './widerlegung-staffel.ts'

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
  katalogBelegt: (kennung: string, datum: string) => boolean = () => false,
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
    /* Der Dub-Bestand datiert die deutsche Folge selbst: eine Messung schlägt den Plan der Vorschau, auch ein gemerktes Nein. */
    if (kennung && datum && katalogBelegt(kennung, datum)) continue
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

/** „Staffel 3“ / „Season 3“ am Ende des Staffelnamens im Katalog. */
const STAFFEL_IM_NAMEN = /(?:staffel|season)\s+(\d+)\s*$/i

/**
 * Die deutschen Folgen **der Staffel Nr. `staffel`** der Serie unter `url`, die der Katalog am Tag `ab` oder später führt,
 * als zusammenhängende Bereiche. Folgennummern zählen je Staffel neu: Schwesterstaffeln zählen nicht mit.
 */
export function deutscheBereicheSeit(crDub: CrDubData, url: string | undefined, ab: string, staffel: number): { from: number; to: number; dub: boolean }[] {
  const serie = crDub.serien.find((e) => e.katalog === 'de' && e.url === url)
  const nummern = (serie?.staffeln ?? [])
    .filter((st) => Number(STAFFEL_IM_NAMEN.exec(st.name)?.[1]) === staffel)
    .flatMap((st) => st.deutscheFolgen ?? [])
    .filter((f) => f.verfuegbarAb !== undefined && f.verfuegbarAb.slice(0, 10) >= ab)
    .map((f) => f.nummer)
    .filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
  const bereiche: { from: number; to: number; dub: boolean }[] = []
  for (const n of [...new Set(nummern)].sort((a, b) => a - b)) {
    const letzter = bereiche.at(-1)
    if (letzter && letzter.to === n - 1) letzter.to = n
    else bereiche.push({ from: n, to: n, dub: true })
  }
  return bereiche
}

/**
 * Bereiche gegen die Folgenzahl der Staffel: mit Zahl gekappt (check-cr-teilseiten-bestand); ohne Zahl (laufende Staffel,
 * AniList nennt keine) unverändert — sie bestehen nur aus Folgen, die der Katalog als deutsch führt, nie aus einer geschätzten Spanne.
 */
function bereicheInFolgenzahl<B extends { from: number; to: number }>(bereiche: B[], episodes: number | undefined): B[] {
  if (!episodes) return bereiche
  return bereiche.filter((b) => b.from <= episodes).map((b) => ({ ...b, to: Math.min(b.to, episodes) }))
}

/**
 * Ein geteilter Reihen-Weg belegt kein Deutsch für eine Staffel, deren deutsche
 * Termine auf diesem Anbieter **alle** widerlegt sind. Das `dub: true` gehört dann
 * den Schwesterstaffeln (die Serienkennung ist ein Franchise); für diese Staffel
 * bleibt die Sprache offen, statt an der Pille „DE ✓" neben „widerlegt" zu stehen.
 *
 * Führt der Crunchyroll-Katalog (`crDub`) für den Weg aber deutsche Folgen ab dem Tag der
 * Widerlegung oder später, ist die Widerlegung veraltet (Reincarnated Aristocrat S3, Folge 1
 * deutsch ab 18.10.2026): Der Weg bleibt und trägt genau diese Folgen als `dubRanges`.
 */
export function loeseGeteilteWegeVonWiderlegten(releases: Release[], titles: Map<number, Title>, crDub: CrDubData): number {
  const jeTitelPlattform = new Map<string, Release[]>()
  for (const r of releases) {
    const k = `${r.titleId}|${r.platform}`
    jeTitelPlattform.set(k, [...(jeTitelPlattform.get(k) ?? []), r])
  }
  let geloest = 0
  for (const [k, liste] of jeTitelPlattform) {
    if (!liste.every((r) => r.widerlegt)) continue
    const [id, plattform] = k.split('|')
    const titel = titles.get(Number(id))
    const spaetester = liste.map((r) => r.widerlegt!.am).sort().at(-1)!
    const staffel = titel && staffelDesTitels(titel, titles.values())
    for (const s of titel?.streams ?? []) {
      if (s.platform !== plattform || s.dub !== true || (s.sharedWith ?? 0) < 2 || s.dubRanges?.length) continue
      const bereiche = staffel ? bereicheInFolgenzahl(deutscheBereicheSeit(crDub, s.url, spaetester, staffel), titel?.episodes) : []
      if (bereiche.length) {
        s.dubRanges = bereiche
        continue
      }
      delete s.dub
      geloest++
    }
  }
  if (geloest) log(`${geloest} geteilte Wege tragen für eine widerlegte Staffel kein „deutsch" mehr`)
  return geloest
}

/** Führt der deutsche Katalog der Serie eine deutsche Folge, die an genau diesem Tag (Europe/Berlin) erschien? */
export function deutscheFolgeAmTag(crDub: CrDubData, kennung: string, datum: string): boolean {
  const serie = crDub.serien.find((e) => e.katalog === 'de' && e.seriesId === kennung)
  return (serie?.staffeln ?? []).some((st) =>
    (st.deutscheFolgen ?? []).some((f) => f.verfuegbarAb !== undefined && toIsoDate(new Date(f.verfuegbarAb)) === datum),
  )
}

/**
 * Widerlegt jeden deutschen Termin aus der Wochenvorschau, trägt das Ergebnis in
 * die Releases und führt das Gedächtnis fort. Gibt die Zahl der **neuen**
 * Widerlegungen zurück; der Bau protokolliert sie.
 */
export function widerlegeDeutscheTermine(releases: Release[], titles: Map<number, Title>): number {
  const woche = readJson<Wochenprogramm>('data/crunchyroll-woche.json', {})
  const gedaechtnis = readJson<WiderlegungsGedaechtnis>(DATEI, {})
  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  const { anzahl, gedaechtnis: neu } = sammleWiderlegungen(releases, titles, woche, gedaechtnis, (k, d) => deutscheFolgeAmTag(crDub, k, d))
  for (const r of releases) {
    const gemerkt = neu[r.slug]
    if (gemerkt) r.widerlegt = gemerkt
  }
  loeseGeteilteWegeVonWiderlegten(releases, titles, crDub)
  writeJson(DATEI, neu, true)
  log(`${anzahl} deutsche Termin(e) durch das Wochenprogramm neu widerlegt, ${Object.keys(neu).length} im Gedächtnis`)
  return anzahl
}
