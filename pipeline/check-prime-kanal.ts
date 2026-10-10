/**
 * Zusicherungen zu „Prime Video (Crunchyroll)“ (10.10.2026, Slime Staffel 4: Crunchyroll „23 Fg.“,
 * Prime-Kanal „Fg. 1–19“). Läuft in `check:logic`. Erfundene Titel, Termine in der Vergangenheit.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'
import { titelMitTerminBereichen } from '../web/src/components/detail/stream-bereiche.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

/** Folgen 1 bis `erschienen` wöchentlich ab 2020, die übrigen erst 2099 — also noch nicht erschienen. */
function crunchyrollWoche(erschienen: number, gesamt: number): Release {
  const observed: Record<string, string> = {}
  for (let n = 1; n <= gesamt; n++) {
    const tag = new Date(Date.UTC(2020, 0, 3 + 7 * (n - 1)))
    observed[String(n)] = n <= erschienen ? tag.toISOString().slice(0, 10) : '2099-01-01'
  }
  return {
    slug: 'cr-test',
    titleId: 1,
    name: 'Testserie',
    platform: 'crunchyroll',
    platformUrl: 'https://www.crunchyroll.com/de/series/TEST',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2020-01-03', time: '17:00', episodeCount: gesamt, observed },
    sources: [],
  } as unknown as Release
}

function titel(streams: StreamLink[], episodes = 24): Title {
  return { id: 1, episodes, format: 'TV', streams } as unknown as Title
}

const cr = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/TEST', dub: true, ...extra }) as StreamLink
const kanal = (extra: Partial<StreamLink> = {}): StreamLink =>
  ({ platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/TEST', dub: true, kanal: 'Crunchyroll', ...extra }) as StreamLink

/** Die Pille je Weg, so wie das Panel sie rechnet; die Übersetzung gibt Schlüssel und Zahl zurück. */
function pillen(t: Title, releases: Release[]): Record<string, string> {
  const mit = titelMitTerminBereichen(t, releases)!
  const releaseJePlattform = new Map<string, Release>()
  for (const r of releases) if (!releaseJePlattform.has(r.platform)) releaseJePlattform.set(r.platform, r)
  const uebersetze = ((k: string, p?: Record<string, unknown>) => (p ? `${k}${JSON.stringify(p)}` : k)) as never
  const auskunft = folgenAuskunft({ releases, title: mit, t: uebersetze, releaseJePlattform, today: '2026-10-10' })
  return Object.fromEntries(mit.streams!.map((s) => [s.platform, auskunft(s)]))
}

const rel = [crunchyrollWoche(23, 24)]
const bereich19 = [{ from: 1, to: 19, dub: true }]

const slime = pillen(titel([cr(), kanal({ dubRanges: bereich19 })]), rel)
pruefe('Slime: Crunchyroll zeigt 23 Folgen', slime.crunchyroll === 'detail.folgenKurz{"n":23}', slime)
pruefe('Slime: Prime-Kanal zeigt dieselben 23 statt 1–19', slime.primevideo === slime.crunchyroll, slime)

const ohneRanges = pillen(titel([cr(), kanal()]), rel)
pruefe('Kanal ohne eigene Bereiche zählt die Crunchyroll-Folgen', ohneRanges.primevideo === 'detail.folgenKurz{"n":23}', ohneRanges)

const weiter = pillen(titel([cr(), kanal({ dubRanges: [{ from: 1, to: 22, dub: true }] })]), [crunchyrollWoche(20, 24)])
pruefe('Ist Prime weiter, bleibt sein Beleg', weiter.primevideo === 'detail.folgenBereich{"bereich":"1–22"}', weiter)

const crBereiche = pillen(titel([cr({ dubRanges: [{ from: 1, to: 21, dub: true }] }), kanal({ dubRanges: bereich19 })]), [])
pruefe('Ohne Wochenplan übernimmt der Kanal die belegten Bereiche von Crunchyroll', crBereiche.primevideo === crBereiche.crunchyroll, crBereiche)

const goldenWind = pillen(titel([cr({ dub: false }), kanal({ dubRanges: bereich19 })]), rel)
pruefe('Crunchyroll ohne Deutsch: der Kanal erbt nichts', goldenWind.primevideo === 'detail.folgenBereich{"bereich":"1–19"}', goldenWind)

const anderer = { platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/ANDERS', dub: true, kanal: 'Aniverse', dubRanges: bereich19 } as StreamLink
const aniverse = pillen(titel([cr(), anderer]), rel)
pruefe('Ein anderer Kanal bleibt unberührt', aniverse.primevideo === 'detail.folgenBereich{"bereich":"1–19"}', aniverse)

const ohneKanal = pillen(titel([cr(), kanal({ kanal: undefined, dubRanges: bereich19 })]), rel)
pruefe('Prime ohne Kanal-Angabe bleibt unberührt', ohneKanal.primevideo === 'detail.folgenBereich{"bereich":"1–19"}', ohneKanal)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-prime-kanal: ok')
