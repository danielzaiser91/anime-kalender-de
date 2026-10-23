/**
 * Zusicherungen zur festen Uhr im Antwort-Kasten (14.10.2026): `berechneAntwort({ jetzt })` reicht die Uhr an jede Stelle weiter, die
 * „erschienen" entscheidet (offene Folgen, Nachleger-Filter, Zählung, „fertig"-Urteil, Disc-Bänder). Alle Termine liegen im März 2026,
 * die Uhr steht mitten darin — die Systemuhr (immer später) würde jede Stelle anders entscheiden, der Test hängt also nicht vom Datum ab.
 * Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-03-20'
const JETZT = new Date('2026-03-20T12:00:00Z')

/** Folge n am 06.03. + 7 Tage je Folge: 06., 13. (erschienen), 20. (heute, ohne Uhrzeit bis Tagesende offen), 27.03. */
function wochenplan(): Release {
  const observed: Record<number, string> = { 1: '2026-03-06', 2: '2026-03-13', 3: '2026-03-20', 4: '2026-03-27', 5: '2026-04-03' }
  return {
    slug: 'jetzt-test',
    titleId: 1,
    name: 'Jetzttest',
    platform: 'paramountplus',
    platformUrl: 'https://www.paramountplus.com/de/shows/test/',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-03-06', lastEpisodeDate: '2026-04-03', episodeCount: 5, observed },
    sources: [],
  } as unknown as Release
}

/** Ein Band je Datum, Kaufausgabe (kein Streaming-Release). */
function band(slug: string, datum: string): Release {
  return {
    slug,
    titleId: 1,
    name: `Jetzttest – ${slug}`,
    platform: 'disc',
    platformUrl: 'https://www.example.org/',
    releaseType: 'disc',
    schedule: { firstEpisodeDate: datum, lastEpisodeDate: datum },
    sources: [],
  } as unknown as Release
}

const titel = { id: 1, format: 'TV', episodes: 5, titleDe: 'Jetzttest' } as unknown as Title

const laeuft = berechneAntwort({ title: titel, releases: [wochenplan()], today: HEUTE, jetzt: JETZT })
pruefe('Uhr: offene Folgen und Zählung folgen `jetzt` (2 erschienen, Folge 3 ist die nächste)', laeuft?.art === 'laeuft' && laeuft.raus === 2 && laeuft.haupt.episode === 3, JSON.stringify(laeuft?.art))

/* Synchro belegt, Staffel in Japan zu Ende, Wochentakt mittendrin: bleibt „läuft", solange Folgen ausstehen (`deutscherWochentaktLaeuft`). */
const synchro = { ...titel, hasVoices: true, jpEnd: '2025-12-31', streams: [{ platform: 'crunchyroll', url: 'https://www.example.org/cr', dub: true }] } as unknown as Title
const mitSynchro = berechneAntwort({ title: synchro, releases: [wochenplan()], today: HEUTE, jetzt: JETZT })
pruefe('Uhr: „fertig"-Urteil nutzt `jetzt` (Wochentakt mittendrin = läuft)', mitSynchro?.art === 'laeuft', mitSynchro?.art)

/*
  Uhr VOR dem ersten Termin: Das „erschienen"-Urteil des ersten `some` in `deutscherWochentaktLaeuft` hängt allein an `jetzt`. Mit der Systemuhr
  (nach allen Terminen) wäre dort alles erschienen und der Wochentakt „läuft" — das zweite `some` (nichts offen) bleibt beim Weglassen unbemerkt,
  solange beide dieselbe Uhr nutzen; erst die gemischte Uhr (erstes `some` System, zweites fest) kippt das Urteil. Hier: noch nichts erschienen = kein Takt.
*/
const VOR_ALLEM = new Date('2026-03-01T12:00:00Z')
const vorStart = berechneAntwort({ title: synchro, releases: [wochenplan()], today: HEUTE, jetzt: VOR_ALLEM })
pruefe('Uhr: vor dem ersten Termin läuft noch kein Wochentakt (belegt abgeschlossen = fertig)', vorStart?.art === 'fertig', vorStart?.art)

const baende = berechneAntwort({ title: titel, releases: [band('vol-1', '2026-03-06'), band('vol-2', '2026-03-27')], today: HEUTE, jetzt: JETZT })
pruefe('Uhr: Disc-Bänder zählen mit `jetzt` (Band 1 raus, Band 2 nicht)', baende?.art === 'disc' && baende.baende?.[0]?.raus === true && baende.baende?.[1]?.raus === false, JSON.stringify(baende))

if (fehler) process.exit(1)
console.log('check-antwort-jetzt: ok')
