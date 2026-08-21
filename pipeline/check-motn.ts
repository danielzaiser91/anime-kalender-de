/**
 * Kontrollmessung für die Streaming Availability API — erst messen, dann
 * glauben.
 *
 * Bevor auch nur ein Wert dieser Quelle in den Datensatz geht, wird sie gegen
 * das gehalten, was wir schon **unabhängig** wissen: die 190 Crunchyroll-Seiten
 * aus `data/crunchyroll-dub.json` und die 39 Angaben, die ein Mensch in
 * `data/dub-confirmed.yaml` bestätigt hat. Verglichen wird
 * ausschließlich gegen Rohdaten, nie gegen `public/data/titles.json` — dort
 * steht am Ende auch das, was diese Quelle selbst geschrieben hat, und eine
 * Quelle, die sich selbst bestätigt, misst nichts.
 *
 * **Warum das dauerhaft läuft und nicht einmalig.** Eine Quelle ist keine
 * Eigenschaft, sondern ein Zustand: Sie kann ihre Felder umbenennen, ihre
 * Regionen verschieben oder schlicht falsch werden. Die Messung steht deshalb
 * als Prüfschritt vor dem Build und nicht als Absatz in einem Pull Request.
 *
 * **Was ein Widerspruch ist und was nicht.** Nur eine Richtung ist gefährlich:
 * Die Quelle meldet deutschen Ton, wo ein Mensch ausdrücklich „nur Untertitel"
 * festgehalten hat. Dann schleust sie ein falsches `true` ein. Die
 * Gegenrichtung — wir wissen von einer Synchro, die Quelle führt sie nicht —
 * ist **kein** Widerspruch, sondern ihr bekannter Verzug (siehe `lib/motn.ts`,
 * Grenze 1). Sie wird gezählt und ausgewiesen, aber sie lässt den Lauf nicht
 * rot werden.
 *
 * Der Lauf kostet **kein** Kontingent: Er liest nur den Bestand, den
 * `fetch-motn.ts` hinterlassen hat.
 *
 * Aufruf: npm run data:motn:check
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, warn, writeText } from './lib/util.ts'
import { dubKey, loadDubChecks } from './lib/dub-confirmed.ts'
import { beurteile, type CrDubData } from './lib/crunchyroll-dub.ts'
import { bewerteTreffer, passtZuSerie, staffelnDesFranchise, volltreffer } from './lib/adn.ts'
import { DIENSTE, LEER, ordneShowsZu, type MotnBeleg, type MotnDaten } from './lib/motn.ts'
import { releaseStatus } from '../shared/logic.ts'
import { anzeigeName } from '../shared/titles.ts'
import { todayIso } from '../shared/time.ts'
import type { PlatformId, Release, Title } from '../shared/types.ts'

/**
 * Wie viele harte Widersprüche der Lauf hinnimmt.
 *
 * Nicht null: Ein von Hand gesetztes `dub: false` kann veraltet sein — eine
 * Synchro kommt nach, und dann hat die Quelle recht und der alte Eintrag
 * unrecht. Ein einzelner solcher Fall darf den Nachtlauf nicht anhalten. Wird
 * es mehr als jeder zwanzigste Vergleich, ist nicht mehr der Einzeleintrag das
 * Problem, sondern die Quelle.
 */
const GRENZE = 0.05

const heute = todayIso()
const titles = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8')) as Title[]
const releases = readJson<Release[]>('public/data/releases.json', [])
const motn = readJson<MotnDaten>('data/motn.json', LEER)

if (!Object.keys(motn.shows ?? {}).length) {
  log('Kein Bestand aus der Streaming Availability API — nichts zu messen.')
  process.exit(0)
}

const belege = ordneShowsZu(
  titles,
  motn.shows,
  (t) => (t.franchiseId ? staffelnDesFranchise(titles, t.franchiseId) : []),
  { passtZuSerie, bewerteTreffer, volltreffer },
)
const titleById = new Map(titles.map((t) => [t.id, t]))

// --- Was wir unabhängig von dieser Quelle wissen -----------------------------

/** Belegte Angaben je Titel und Plattform, mit Herkunft. */
const bekannt = new Map<string, { dub: boolean; quelle: string }>()

for (const check of loadDubChecks()) {
  if (typeof check.dub !== 'boolean') continue
  bekannt.set(dubKey(check.anilistId, check.platform), { dub: check.dub, quelle: 'Handprüfung' })
}

/**
 * ADN fehlt hier bewusst.
 *
 * Der Sprachcode `vde` je Folge wäre ein erstklassiger Prüfstein — nur führt
 * diese Quelle ADN gar nicht. Belegt ist am 21.08.2026 einzig, dass bei
 * „Frieren" `crunchyroll`, `netflix` und `prime` unter `streamingOptions.de`
 * stehen. Eine Vergleichszeile, die nie greift, sieht aus wie eine Prüfung und
 * ist keine.
 */

/**
 * Crunchyroll trägt diese Messung.
 *
 * 190 Serienseiten mit belegter Tonspur je Folge stehen sieben Handprüfungen
 * bei Netflix gegenüber. Ohne sie hätte die Messung fast keine Grundlage — und
 * genau deshalb wird Crunchyroll aus dieser Quelle **erfasst**, obwohl aus ihr
 * nie eine Crunchyroll-Angabe in den Datensatz geht.
 */
const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
const nachUrl = new Map<string, Title[]>()
for (const title of titles) {
  for (const stream of title.streams) {
    if (stream.platform !== 'crunchyroll') continue
    const liste = nachUrl.get(stream.url) ?? []
    liste.push(title)
    nachUrl.set(stream.url, liste)
  }
}
for (const serie of crDub.serien) {
  for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
    const key = dubKey(urteil.titleId, 'crunchyroll')
    if (!bekannt.has(key)) bekannt.set(key, { dub: urteil.dub, quelle: 'Crunchyroll-Serienseite' })
  }
}

// --- Vergleich ---------------------------------------------------------------

interface Zeile {
  beleg: MotnBeleg
  name: string
  unser: { dub: boolean; quelle: string }
}

const bestaetigt: Zeile[] = []
const widerspruch: Zeile[] = []
const schweigen: Zeile[] = []
const jePlattform = new Map<PlatformId, { verglichen: number; bestaetigt: number; widerspruch: number; schweigen: number }>()

for (const beleg of belege) {
  const unser = bekannt.get(dubKey(beleg.titleId, beleg.platform))
  if (!unser) continue
  const name = anzeigeName(titleById.get(beleg.titleId) ?? { id: beleg.titleId })
  const zeile: Zeile = { beleg, name, unser }
  const z = jePlattform.get(beleg.platform) ?? { verglichen: 0, bestaetigt: 0, widerspruch: 0, schweigen: 0 }
  z.verglichen++
  if (unser.dub && beleg.deutsch) {
    bestaetigt.push(zeile)
    z.bestaetigt++
  } else if (!unser.dub && beleg.deutsch) {
    widerspruch.push(zeile)
    z.widerspruch++
  } else {
    // Wir wissen von einer Synchro, die Quelle führt sie (noch) nicht. Das ist
    // ihr Verzug, kein Gegenbeweis.
    schweigen.push(zeile)
    z.schweigen++
  }
  jePlattform.set(beleg.platform, z)
}

// --- Verzug: wie weit hinkt die Quelle unserem Stand hinterher? --------------
//
// Die Frage aus dem dritten Nachtrag, gemessen statt geschätzt: Bei einer
// laufenden Netflix-Serie steht in `schedule.observed`, welche Folge wir wann
// gesehen haben. Die höchste Folgennummer, die die Quelle für Netflix führt,
// dagegengehalten, ergibt den Rückstand in Folgen — und über das Datum der
// letzten Beobachtung den Rückstand in Tagen.

interface Verzug {
  name: string
  unsereFolge: number
  unserDatum: string
  ihreFolge: number
  tage: number
}
const verzuege: Verzug[] = []
const belegNachTitel = new Map<number, MotnBeleg[]>()
for (const b of belege) {
  const liste = belegNachTitel.get(b.titleId) ?? []
  liste.push(b)
  belegNachTitel.set(b.titleId, liste)
}
for (const release of releases) {
  if (release.platform !== 'netflix' || releaseStatus(release, heute) !== 'airing') continue
  const beobachtet = Object.entries(release.schedule.observed ?? {})
    .map(([e, d]) => ({ episode: Number(e), date: d }))
    .filter((b) => b.episode > 0 && b.date)
    .sort((a, b) => b.episode - a.episode)[0]
  if (!beobachtet) continue
  const beleg = (belegNachTitel.get(release.titleId) ?? []).find((b) => b.platform === 'netflix')
  if (!beleg) continue
  const bestand = motn.shows[beleg.imdbId]
  const gelistet = bestand?.dienste.netflix?.gelistet ?? []
  const hoechste = gelistet.filter((n) => n >= beleg.von && n <= beleg.bis).at(-1) ?? 0
  const ihreFolge = hoechste ? hoechste - beleg.von + 1 : 0
  verzuege.push({
    name: release.name,
    unsereFolge: beobachtet.episode,
    unserDatum: beobachtet.date,
    ihreFolge,
    tage: Math.round((Date.parse(heute) - Date.parse(beobachtet.date)) / 86_400_000),
  })
}

// --- Bericht -----------------------------------------------------------------

const verglichen = bestaetigt.length + widerspruch.length + schweigen.length
const quote = verglichen ? widerspruch.length / verglichen : 0

const md: string[] = [
  '# Kontrollmessung: Streaming Availability API',
  '',
  `Stand ${heute}. Erzeugt von \`npm run data:motn:check\`, **nicht von Hand pflegen**.`,
  '',
  `Bestand: **${Object.keys(motn.shows).length} Serien** der Quelle, davon **${belege.length} Zuordnungen**`,
  `zu unseren Einträgen. Davon ließen sich **${verglichen}** gegen einen unabhängigen Beleg halten`,
  '(Handprüfung oder Crunchyroll-Serienseite).',
  '',
  '| | Zahl |',
  '|---|---|',
  `| bestätigt (wir ja, Quelle ja) | ${bestaetigt.length} |`,
  `| **widersprochen** (wir nein, Quelle ja) | ${widerspruch.length} |`,
  `| Quelle schweigt (wir ja, Quelle führt es nicht) | ${schweigen.length} |`,
  '',
  '**Nur die mittlere Zeile ist ein Widerspruch.** Die untere ist der bekannte Verzug der Quelle:',
  'Sie belegt, was da ist, nie was fehlt (siehe `pipeline/lib/motn.ts`).',
  '',
  '## Je Anbieter',
  '',
  '| Anbieter | verglichen | bestätigt | widersprochen | Quelle schweigt |',
  '|---|---|---|---|---|',
  ...[...jePlattform.entries()]
    .sort((a, b) => b[1].verglichen - a[1].verglichen)
    .map(([p, z]) => `| ${p} | ${z.verglichen} | ${z.bestaetigt} | ${z.widerspruch} | ${z.schweigen} |`),
  '',
  '**Crunchyroll ist hier der Prüfstein, nicht das Ziel.** Für 190 Serien wissen wir aus unserem',
  'eigenen Abruf, ob dort eine deutsche Tonspur liegt — für Netflix wissen wir es fast nirgends',
  '(sieben Handprüfungen, Stand 21.08.2026). Ohne die Crunchyroll-Zeile wäre diese Messung leer.',
  '',
  'Übernommen wird trotzdem ausschließlich **Netflix**: Die Crunchyroll-Angaben dieser Quelle',
  'widersprechen sich zwischen Serien- und Episodenebene selbst, und für Prime Video und Disney+',
  'fehlt bislang jede Trefferquote.',
  '',
]

if (widerspruch.length) {
  md.push(
    '## Widersprüche im Einzelnen',
    '',
    '| Titel | Anbieter | unsere Angabe | Herkunft | Folgen der Quelle |',
    '|---|---|---|---|---|',
    ...widerspruch.map(
      (z) =>
        `| ${z.name.replace(/\|/g, '\\|')} | ${z.beleg.platform} | keine Synchro | ${z.unser.quelle} | ${z.beleg.von}–${z.beleg.bis} |`,
    ),
    '',
  )
}

if (verzuege.length) {
  md.push(
    '## Verzug bei laufenden Netflix-Staffeln',
    '',
    'Unsere jüngste **beobachtete** Folge gegen die jüngste, die die Quelle führt.',
    '',
    '| Release | unsere Folge | beobachtet am | Folge laut Quelle | Tage seit der Beobachtung |',
    '|---|---|---|---|---|',
    ...verzuege.map(
      (v) =>
        `| ${v.name.replace(/\|/g, '\\|')} | ${v.unsereFolge} | ${v.unserDatum} | ${v.ihreFolge || '—'} | ${v.tage} |`,
    ),
    '',
  )
}

md.push(
  '## Was diese Quelle liefern kann',
  '',
  ...Object.entries(DIENSTE).map(([id, platform]) => `- \`${id}\` → ${platform}`),
  '',
)

writeText('data/motn-messung.md', md.join('\n'))

log(`Kontrollmessung: ${verglichen} Vergleiche, ${bestaetigt.length} bestätigt, ${widerspruch.length} widersprochen, ${schweigen.length} ohne Angabe der Quelle`)
for (const z of widerspruch) {
  warn(`Widerspruch: „${z.name}" (${z.beleg.platform}) — ${z.unser.quelle} sagt „keine Synchro", die Quelle meldet deutschen Ton`)
}
for (const v of verzuege) {
  log(`Verzug: „${v.name}" — wir Folge ${v.unsereFolge} (${v.unserDatum}), die Quelle Folge ${v.ihreFolge || 0}`)
}
log(`Bericht: data/motn-messung.md`)

if (verglichen && quote > GRENZE) {
  console.error(
    `\nDie Quelle widerspricht in ${(quote * 100).toFixed(1)} % der Vergleiche einem belegten Nein ` +
      `(erlaubt sind ${(GRENZE * 100).toFixed(0)} %). Aus ihr darf nichts übernommen werden, bis geklärt ist, ` +
      'welche Seite recht hat — die Fälle stehen einzeln in data/motn-messung.md.',
  )
  process.exit(1)
}
