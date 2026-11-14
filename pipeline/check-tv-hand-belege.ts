/**
 * Zusicherungen zu `belegeHandTermine()` aus `lib/tv-hand-belege.ts`: Ein TV-Handtermin ohne eigene Beobachtungen übernimmt die Tage
 * der gesichteten Folgen desselben Titels und Senders (Sender ohne Groß/klein), nur ab seinem Start und nur im Bereich seiner Folgen
 * (`firstEpisodeNumber` bis `+ episodeCount - 1`). Keine Übernahme ohne Folgenliste (nicht `folgenBelegt`), bei Auto-Terminen,
 * anderen Plattformen, eigenen Beobachtungen, fehlendem Start, anderem Sender oder Titel. Rückgabe: Zahl der belegten Termine.
 * Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import type { TvSendung } from './fetch-tv-programm.ts'
import { belegeHandTermine } from './lib/tv-hand-belege.ts'
import type { WikiListen } from './lib/tv-termine.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const TITEL = new Map<number, Title>([
  [5, { id: 5, titleDe: 'Yaiba', format: 'TV', episodes: 24 } as Title],
  [6, { id: 6, titleDe: 'Andere', format: 'TV', episodes: 12 } as Title],
])
const WIKI: WikiListen = { 5: { seite: 'Yaiba', folgen: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((dt, i) => ({ nr: i + 1, dt })) } }
const sendung = (tag: string, folge: string | undefined, sender = 'Kabel Eins', titleId = 5): TvSendung => ({
  titleId,
  titel: 'Yaiba',
  ...(folge ? { folge } : {}),
  sender,
  start: `${tag}T20:15:00+01:00`,
  ende: `${tag}T20:45:00+01:00`,
  gesehenAm: tag,
})
// Folgen 1–5 an fünf Tagen; Folge 5 nach einem Tag Pause.
const SENDUNGEN = [
  sendung('2026-11-02', 'Alpha'),
  sendung('2026-11-03', 'Beta'),
  sendung('2026-11-04', 'Gamma'),
  sendung('2026-11-05', 'Delta'),
  sendung('2026-11-07', 'Epsilon'),
]
const hand = (schedule: Partial<Release['schedule']>, mehr: Partial<Release> = {}): Release =>
  ({
    slug: 'yaiba-kabel-eins',
    titleId: 5,
    platform: 'tv',
    sender: 'kabel eins',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-03', episodeCount: 3, firstEpisodeNumber: 2, ...schedule },
    sources: ['https://example.org'],
    ...mehr,
  }) as Release

const lauf = (releases: Release[], sendungen = SENDUNGEN, wiki = WIKI) => ({ zahl: belegeHandTermine(releases, sendungen, TITEL, wiki), releases })

// Grundfall: Folgen 2–4 ab dem 03.11., Sender ohne Groß/klein.
{
  const { zahl, releases } = lauf([hand({})])
  pruefe('Grundfall: einer belegt', zahl, 1)
  pruefe('Grundfall: Tage der Folgen 2–4', releases[0]!.schedule.observed, { 2: '2026-11-03', 3: '2026-11-04', 4: '2026-11-05' })
  pruefe('Grundfall: folgenBelegt', releases[0]!.folgenBelegt, true)
}
// Ohne firstEpisodeNumber ab Folge 1; ohne episodeCount kein Bereich.
pruefe('ab Folge 1', lauf([hand({ firstEpisodeNumber: undefined, firstEpisodeDate: '2026-11-02', episodeCount: 2 })]).releases[0]!.schedule.observed, { 1: '2026-11-02', 2: '2026-11-03' })
pruefe('ohne Folgenzahl: nichts', lauf([hand({ episodeCount: undefined })]).zahl, 0)
// Start schneidet: Folgen vor dem Start fallen weg, auch wenn sie im Bereich liegen.
pruefe('Start schneidet', lauf([hand({ firstEpisodeDate: '2026-11-04', episodeCount: 5 })]).releases[0]!.schedule.observed, { 3: '2026-11-04', 4: '2026-11-05', 5: '2026-11-07' })
pruefe('Start nach allen Sichtungen: nichts', lauf([hand({ firstEpisodeDate: '2026-11-08' })]).zahl, 0)

// Was bleibt, wie es ist.
const unveraendert = (text: string, r: Release, sendungen = SENDUNGEN, wiki = WIKI) => {
  const vorher = JSON.stringify(r)
  const { zahl } = lauf([r], sendungen, wiki)
  pruefe(`${text}: nicht belegt`, [zahl, JSON.stringify(r) === vorher], [0, true])
}
unveraendert('Auto-Termin', hand({}, { slug: 'auto-5-tv-kabel-eins' }))
unveraendert('andere Plattform', hand({}, { platform: 'crunchyroll' }))
unveraendert('eigene Beobachtungen', hand({ observed: { 2: '2026-11-03' } }))
unveraendert('ohne Start', hand({ firstEpisodeDate: undefined }))
unveraendert('anderer Sender', hand({}, { sender: 'ProSieben MAXX' }))
unveraendert('ohne Sender', hand({}, { sender: undefined }))
unveraendert('anderer Titel', hand({}, { titleId: 6 }))
unveraendert('ohne Folgenliste', hand({}), SENDUNGEN, {})
unveraendert('eine Sichtung ohne Folgentitel', hand({}), [...SENDUNGEN, sendung('2026-11-08', undefined)])

// Leere Beobachtungen zählen als keine; mehrere Handtermine werden einzeln gezählt.
pruefe('leere observed: belegt', lauf([hand({ observed: {} })]).zahl, 1)
pruefe('zwei Handtermine', lauf([hand({}), hand({ firstEpisodeDate: '2026-11-07', firstEpisodeNumber: 5, episodeCount: 1 }, { slug: 'yaiba-teil-2' })]).zahl, 2)
pruefe('leere Eingabe', lauf([], [], {}).zahl, 0)

if (fehler) {
  console.error(`check-tv-hand-belege: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-tv-hand-belege: ok')
