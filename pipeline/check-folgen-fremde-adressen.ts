/**
 * Zusicherung: **Die Zuordnung je Plattform-Folge nimmt keine Adresse, die ein Eintrag außerhalb von `titles.json` führt**
 * (29.10.2026). Hell Mode (185262) und Dragon Ball Super: Beerus (206814) standen mit 37 Folgen als Titel in
 * `folgen-zuordnung.json`, obwohl sie nur noch in `ohne-synchro.json` stehen. Geprüft wird `ordneFolgenOhneFremde` mit den
 * echten Schlüsseln und einer Attrappe des Bestands; jeder Fall verwirft gezählt. Läuft in `check:logic`.
 */
import { entfallenZeile, ohneKennungZeile, ordneFolgenOhneFremde } from './lib/folgen-fremde-adressen.ts'
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

pruefe('veraltete Zuordnung behält ihr gesehen', v.ergebnis['primevideo:B0G4S4F5W6']?.gesehen === '2026-09-01', v.ergebnis)

/* Nur an der fremden Adresse und früher auf einen Titel außerhalb: zählt als fremd, nicht zusätzlich als veraltet. */
const nf = ordneFolgenOhneFremde([beob(7, FREMD, 'FREMDALT01', '2026-10-03T10:00')], kontext(fremdNurDisney), { 'primevideo:FREMDALT01': alt(185262) })
pruefe('fremde Folge mit veralteter Zuordnung: 1 Folge, 0 veraltet', nf.verworfen.folgen === 1 && nf.verworfen.veraltet === 0, nf.verworfen)

/* Veraltete Zuordnung, aber die Folge hat eine eigene Adresse: sie wird neu zugeordnet statt gestrichen. */
const ne = ordneFolgenOhneFremde([beob(8, EIGEN, 'NEUZUORD01', '2026-10-03T10:00')], kontext(fremdNurDisney), { 'primevideo:NEUZUORD01': alt(185262) })
pruefe('veraltete Zuordnung mit eigener Adresse ordnet neu zu', ne.ergebnis['primevideo:NEUZUORD01']?.titel === 900002 && ne.verworfen.veraltet === 1, ne)

/* Die fremde Beobachtung einer gemischten Folge zählt nicht mit: sonst wären es zwei Kandidaten. */
const zwei = new Map([...titel, [900003, { id: 900003, episodes: 12, streams: [{ url: FREMD }], watchLinks: [] } as unknown as Title]])
const gemischt = ordneFolgenOhneFremde(
  [{ ...beob(9, FREMD, 'GEMISCHT02', '2026-10-01T10:00'), titel_id: 900003 }, beob(10, EIGEN, 'GEMISCHT02', '2026-10-01T11:00')],
  { ...kontext(fremdNurDisney), titel: zwei, jeAdresse: adressIndex(zwei, []) },
  {},
)
pruefe('gemischte Folge: fremder Titel fällt nicht als Kandidat an', gemischt.ergebnis['primevideo:GEMISCHT02']?.titel === 900002, gemischt.ergebnis)

/* Eine Folge ohne Kennung zählt nicht als „nur fremd“. */
const ohneKennung = ordneFolgenOhneFremde([{ ...beob(6, FREMD, 'X', '2026-10-01T10:00'), asin: null }], kontext(fremdNurDisney), {})
pruefe('Beobachtung ohne Kennung: 1 verworfen, keine Folge', ohneKennung.verworfen.beobachtungen === 1 && ohneKennung.verworfen.folgen === 0, ohneKennung.verworfen)

/* Aufstellung der entfallenden Einträge je Titel: nur Einträge, die vorher einen Titel hatten und jetzt keinen, je Titel gezählt. */
const au = ordneFolgenOhneFremde(
  [beob(11, FREMD, 'AUF000001', '2026-10-01T10:00'), beob(12, FREMD, 'AUF000002', '2026-10-01T10:00'), beob(13, FREMD, 'AUF000003', '2026-10-01T10:00'), beob(14, EIGEN, 'AUF000004', '2026-10-01T10:00')],
  kontext(fremdNurDisney),
  {
    'primevideo:AUF000001': alt(900002),
    'primevideo:AUF000002': alt(900002),
    'primevideo:AUF000003': alt(185262),
    'primevideo:AUF000004': alt(900002),
    'primevideo:OHNETITEL1': { grund: 'ohne-kandidat', gesehen: '2026-09-01' },
  },
)
pruefe('entfallen je Titel: 900002 zweimal, 185262 einmal, Eintrag an eigener Adresse und ohne Titel zählen nicht', au.verworfen.entfallen[900002] === 2 && au.verworfen.entfallen[185262] === 1 && Object.keys(au.verworfen.entfallen).length === 2, au.verworfen.entfallen)
pruefe('Aufstellung: größte Zahl zuerst', entfallenZeile({ 185262: 1, 900002: 2, 5: 1 }) === '900002: 2, 5: 1, 185262: 1', entfallenZeile({ 185262: 1, 900002: 2, 5: 1 }))
pruefe('Aufstellung ohne Einträge', entfallenZeile({}) === 'keine', entfallenZeile({}))

/* Beobachtungen ohne Kennung: eigene zählen, fremde und solche mit ASIN oder gti nicht; Beispiele höchstens fünf, ohne Doppelte. */
const netflix = (id: number, titel: string, gti: string | null): Beobachtung => ({ ...beob(id, EIGEN, '', '2026-10-01T10:00'), plattform: 'netflix', asin: null, gti, titel })
const ok = ordneFolgenOhneFremde([beob(30, EIGEN, 'MITASIN001', '2026-10-01T10:00'), netflix(31, 'Mit gti', 'GTI31')], kontext(fremdNurDisney), {})
pruefe('mit ASIN oder gti: 0 ohne Kennung', ok.verworfen.ohneKennung === 0 && ok.verworfen.ohneKennungBeispiele.length === 0, ok.verworfen)
const eins = ordneFolgenOhneFremde([netflix(32, 'Einzige Folge', null)], kontext(fremdNurDisney), {})
pruefe('genau eine ohne Kennung: 1 und ein Beispiel', eins.verworfen.ohneKennung === 1 && eins.verworfen.ohneKennungBeispiele[0] === 'netflix: Einzige Folge', eins.verworfen)
const viele = ordneFolgenOhneFremde(
  [...[1, 2, 3, 4, 5, 6, 7].map((n) => netflix(40 + n, `Folge ${n}`, null)), netflix(50, 'Folge 1', null), { ...netflix(51, 'Fremd', null), url: FREMD }],
  kontext(fremdNurDisney),
  {},
)
pruefe('viele: 8 eigene gezählt, fremde nicht, 5 verschiedene Beispiele', viele.verworfen.ohneKennung === 8 && viele.verworfen.ohneKennungBeispiele.length === 5 && viele.verworfen.ohneKennungBeispiele[4] === 'netflix: Folge 5', viele.verworfen)
pruefe('Zeile mit Beispielen', ohneKennungZeile(eins.verworfen) === 'Beobachtungen ohne ASIN und gti (fallen aus der Zuordnung): 1 (z. B. netflix: Einzige Folge)', ohneKennungZeile(eins.verworfen))
pruefe('Zeile ohne Beispiele', ohneKennungZeile(ok.verworfen) === 'Beobachtungen ohne ASIN und gti (fallen aus der Zuordnung): 0', ohneKennungZeile(ok.verworfen))

if (fehler.length) {
  console.error(`check-folgen-fremde-adressen: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-folgen-fremde-adressen: 23 Zusicherungen grün, fremde Adressen und Titel außerhalb von titles.json ordnen keine Plattform-Folge zu.')
