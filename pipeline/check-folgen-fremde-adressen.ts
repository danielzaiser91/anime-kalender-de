/**
 * Zusicherung: **Die Zuordnung je Plattform-Folge nimmt keine Adresse, die ein Eintrag außerhalb von `titles.json` führt**
 * (29.10.2026). Hell Mode (185262) und Dragon Ball Super: Beerus (206814) standen mit 37 Folgen als Titel in
 * `folgen-zuordnung.json`, obwohl sie nur noch in `ohne-synchro.json` stehen. Geprüft wird `ordneFolgenOhneFremde` mit den
 * echten Schlüsseln und einer Attrappe des Bestands; jeder Fall verwirft gezählt. Läuft in `check:logic`.
 */
import { ordneFolgenOhneFremde } from './lib/folgen-fremde-adressen.ts'
import { adressIndex, type Beobachtung, type FolgenZuordnung } from './lib/folgen-je-folge.ts'
import type { Title } from '../shared/types.ts'

const FREMD = 'https://www.disneyplus.com/browse/entity-cfb90125-8678-4327-a1b8-e608f293eccd'
const EIGEN = 'https://www.amazon.de/gp/video/detail/B0EIGEN001'
const titel = new Map([[900002, { id: 900002, episodes: 12, streams: [{ url: EIGEN }, { url: FREMD }], watchLinks: [] } as unknown as Title]])
const beob = (id: number, url: string, asin: string, am: string): Beobachtung => ({
  id,
  plattform: 'primevideo',
  url,
  asin,
  gti: null,
  nummer: 1,
  titel: 'Folge',
  erschienen: null,
  titel_id: 900002,
  gemeldet_am: am,
})
const kontext = (istFremd: (u: string) => boolean) => ({
  titel,
  tmdb: {},
  asFolgen: {},
  asKennung: {},
  jeAdresse: adressIndex(titel, []),
  istFremd,
})
const fremdNurDisney = (u: string) => u.includes('disneyplus.com')
const fehler: string[] = []
const pruefe = (name: string, ok: boolean, wert?: unknown) => {
  if (!ok) fehler.push(`${name}: ${JSON.stringify(wert)}`)
}
const alt = (t: number): FolgenZuordnung => ({ titel: t, folge: 5, grund: 'titel', gesehen: '2026-09-01' })

/* Folge nur an der fremden Adresse: kein Titel, die frühere Zuordnung (auch auf einen Titel im Bestand) entfällt. */
const a = ordneFolgenOhneFremde(
  [beob(1, FREMD, 'FREMDONLY1', '2026-10-01T10:00'), beob(2, FREMD, 'FREMDONLY1', '2026-10-02T10:00')],
  kontext(fremdNurDisney),
  { 'primevideo:FREMDONLY1': alt(900002) },
)
pruefe('Folge nur an fremder Adresse', a.ergebnis['primevideo:FREMDONLY1']?.titel === undefined && a.ergebnis['primevideo:FREMDONLY1']?.grund === 'ohne-kandidat', a.ergebnis)
pruefe('jüngste Meldung als gesehen', a.ergebnis['primevideo:FREMDONLY1']?.gesehen === '2026-10-02T10:00', a.ergebnis)
pruefe('Zählung: 2 Beobachtungen, 1 Folge, 0 veraltet', a.verworfen.beobachtungen === 2 && a.verworfen.folgen === 1 && a.verworfen.veraltet === 0, a.verworfen)

/* Folge an beiden Adressen: die eigene zählt, die fremde nicht. */
const m = ordneFolgenOhneFremde(
  [beob(3, FREMD, 'GEMISCHT01', '2026-10-01T10:00'), beob(4, EIGEN, 'GEMISCHT01', '2026-10-01T11:00')],
  kontext(fremdNurDisney),
  {},
)
pruefe('gemischte Folge ordnet über die eigene Adresse zu', m.ergebnis['primevideo:GEMISCHT01']?.titel === 900002, m.ergebnis)
pruefe('Zählung gemischt: 1 Beobachtung, 0 Folgen', m.verworfen.beobachtungen === 1 && m.verworfen.folgen === 0, m.verworfen)

/* Ohne Sperre hängt dieselbe fremde Adresse die Folge an den Titel (der alte Weg). */
const ohneSperre = ordneFolgenOhneFremde([beob(5, FREMD, 'KONTROLLE01', '2026-10-01T10:00')], kontext(() => false), {})
pruefe('Kontrolle: ohne Sperre ordnet die Adresse zu', ohneSperre.ergebnis['primevideo:KONTROLLE01']?.titel === 900002, ohneSperre.ergebnis)

/* Frühere Zuordnung auf einen Titel außerhalb von titles.json (ohne Synchro) entfällt; eine auf einen Titel im Bestand bleibt. */
const v = ordneFolgenOhneFremde(
  [],
  kontext(() => false),
  { 'primevideo:B0G4S4F5W6': alt(185262), 'netflix:83189606': alt(206814), 'primevideo:IMBESTAND01': alt(900002) },
)
pruefe('veraltete Zuordnung entfällt (Hell Mode)', v.ergebnis['primevideo:B0G4S4F5W6']?.titel === undefined && v.ergebnis['primevideo:B0G4S4F5W6']?.grund === 'ohne-kandidat', v.ergebnis)
pruefe('veraltete Zuordnung entfällt (Beerus)', v.ergebnis['netflix:83189606']?.titel === undefined, v.ergebnis)
pruefe('Kontrolle: Zuordnung im Bestand bleibt', v.ergebnis['primevideo:IMBESTAND01']?.titel === 900002 && v.ergebnis['primevideo:IMBESTAND01']?.folge === 5, v.ergebnis)
pruefe('Zählung: 2 veraltet', v.verworfen.veraltet === 2 && v.verworfen.beobachtungen === 0, v.verworfen)

/* Eine Folge ohne Kennung zählt nicht als „nur fremd“. */
const ohneKennung = ordneFolgenOhneFremde([{ ...beob(6, FREMD, 'X', '2026-10-01T10:00'), asin: null }], kontext(fremdNurDisney), {})
pruefe('Beobachtung ohne Kennung: 1 verworfen, keine Folge', ohneKennung.verworfen.beobachtungen === 1 && ohneKennung.verworfen.folgen === 0, ohneKennung.verworfen)

if (fehler.length) {
  console.error(`check-folgen-fremde-adressen: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-folgen-fremde-adressen: 11 Zusicherungen grün, fremde Adressen und Titel außerhalb von titles.json ordnen keine Plattform-Folge zu.')
