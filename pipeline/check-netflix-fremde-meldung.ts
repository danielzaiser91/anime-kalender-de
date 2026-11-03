/**
 * Fremde Netflix-Meldungen (13.10.2026): Barbie-Folgen unter The Loud House. Die Zeilen stammen aus der Meldungskopie
 * vom 02.11.2026 (Staffelkennung 81184773, gti 81184787 … 81184798). Geprüft werden Sperre, Wächter und die Sperrliste selbst.
 */
import { readFileSync } from 'node:fs'
import { bereinigeAltbestand } from './lib/rohfolgen-staffelmisch.ts'
import { doppelteNetflixKennungen, ladeFremdeMeldungen, ohneFremdeNetflixMeldungen, type FremdeMeldung } from './lib/netflix-fremde-meldung.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const N = (id: string) => `https://www.netflix.com/title/${id}`
const BARBIE = N('81184735')
const LOUD = N('81186971')
const GTI_BARBIE_S2 = [81184787, 81184789, 81184792, 81184790, 81184793, 81184791, 81184795, 81184794, 81184796, 81184799, 81184788, 81184797, 81184798]
let nr = 0
const zeile = (url: string, gti: number | null, staffelText: string | null, rest: Record<string, unknown> = {}) => ({
  id: ++nr,
  url,
  gti: gti == null ? null : String(gti),
  nummer: nr,
  titel: `T${nr}`,
  erschienen: null as string | null,
  sprachen: '["Deutsch"]',
  gemeldet_am: '2026-10-13T15:53:32Z',
  plattform: 'netflix' as string | null,
  staffel_nr: 2 as number | null,
  staffel_text: staffelText,
  seiten_kennung: null as string | null,
  ...rest,
})
const barbie = GTI_BARBIE_S2.map((g) => zeile(BARBIE, g, '81184773'))
const unterLoud = GTI_BARBIE_S2.map((g) => zeile(LOUD, g, '81184773', { gemeldet_am: '2026-10-13T15:54:12Z' }))
const loudEigen = [81947014, 81947026, 81947035].map((g) => zeile(LOUD, g, '81944948', { staffel_nr: 3 }))
const sperre = ladeFremdeMeldungen()

console.log('Fremde Netflix-Meldungen')
pruefe('Sperrliste hat zehn Einträge (Wächter bei 0 rot)', sperre.length === 10, sperre.length)
const alle = [...barbie, ...unterLoud, ...loudEigen]
const ohne = bereinigeAltbestand(alle, sperre)
pruefe('Loud House verliert die 13 Barbie-Zeilen', ohne.veraltet.length === 13 && ohne.veraltet.every((i) => unterLoud.some((z) => z.id === i)), ohne.veraltet)
pruefe('Barbie und Loud Houses eigene Staffel 3 bleiben', ohne.folgen.length === 16 && barbie.every((z) => ohne.folgen.includes(z)) && loudEigen.every((z) => ohne.folgen.includes(z)))
pruefe('ohne Sperrliste bleibt alles (Standardwert)', bereinigeAltbestand(alle).folgen.length === 29)

console.log('Wächter')
pruefe('vor der Sperre: Staffelkennung und 13 Folgen unter zwei Adressen', doppelteNetflixKennungen(alle).length === 14, doppelteNetflixKennungen(alle))
pruefe('Befund nennt Kennung und beide Adressen', doppelteNetflixKennungen(alle)[0] === `Staffelkennung 81184773 unter ${BARBIE} und ${LOUD}`, doppelteNetflixKennungen(alle)[0])
pruefe('nach der Sperre: nichts', doppelteNetflixKennungen(ohne.folgen).length === 0)
pruefe('nur die Staffelkennung doppelt (andere gti): ein Befund', doppelteNetflixKennungen([zeile(BARBIE, 1, '81184773'), zeile(LOUD, 2, '81184773')]).length === 1)
pruefe('nur die gti doppelt (Menütext statt Kennung): ein Befund', doppelteNetflixKennungen([zeile(BARBIE, 7, 'Staffel 1'), zeile(LOUD, 7, 'Staffel 1')]).length === 1)
pruefe('Menütext „Staffel 2“ unter zwei Adressen ist keine Kennung', doppelteNetflixKennungen([zeile(BARBIE, 1, 'Staffel 2'), zeile(LOUD, 2, 'Staffel 2')]).length === 0)
pruefe('dieselbe Adresse zweimal ist kein Befund', doppelteNetflixKennungen([zeile(BARBIE, 1, '81184773'), zeile(BARBIE, 1, '81184773')]).length === 0)
const prime = (url: string) => zeile(url, 5, '81184773', { plattform: 'primevideo' })
pruefe('Prime-Zeilen zählen nicht', doppelteNetflixKennungen([prime('https://www.amazon.de/dp/B0A'), prime('https://www.amazon.de/dp/B0B')]).length === 0)

console.log('Sperre je Zweig')
const eintrag = (e: Partial<FremdeMeldung>): FremdeMeldung[] => [{ url: LOUD, richtig: BARBIE, beleg: 'x', ...e }]
const eine = (s: FremdeMeldung[], z: ReturnType<typeof zeile>) => ohneFremdeNetflixMeldungen([z], s).verworfen.length
pruefe('Kennung an der falschen Adresse: weg', eine(eintrag({ kennungen: ['81184773'] }), zeile(LOUD, 1, '81184773')) === 1)
pruefe('Kennung an der richtigen Adresse: bleibt', eine(eintrag({ kennungen: ['81184773'] }), zeile(BARBIE, 1, '81184773')) === 0)
pruefe('andere Kennung an der falschen Adresse: bleibt', eine(eintrag({ kennungen: ['81184773'] }), zeile(LOUD, 1, '81944948')) === 0)
pruefe('gti an der falschen Adresse: weg', eine(eintrag({ gti: ['5'] }), zeile(LOUD, 5, 'Staffel 1')) === 1)
pruefe('andere gti an der falschen Adresse: bleibt', eine(eintrag({ gti: ['5'] }), zeile(LOUD, 6, 'Staffel 1')) === 0)
pruefe('Zeile ohne gti und ohne Text: bleibt', eine(eintrag({ gti: ['5'], kennungen: ['1'] }), zeile(LOUD, null, null)) === 0)

console.log('Die acht Adresspaare mit gleicher Staffelkennung (Meldungskopie 02.11.2026) und die zwei weiteren über die gti')
const PAARE: [string, string, string][] = [
  ['70171947', '70171942', '70124778'],
  ['81499847', '80193163', '80193313'],
  ['81183924', '81161575', '81496234'],
  ['81186971', '81184735', '81184773'],
  ['81091393', '81239555', '81239556'],
  ['81259476', '81246530', '81246545'],
  ['81279322', '81273085', '81273086'],
  ['81788312', '81727242', '81727243'],
]
for (const [falsch, richtig, kennung] of PAARE) {
  pruefe(`${falsch}: Kennung ${kennung} weg, an ${richtig} bleibt sie`, eine(sperre, zeile(N(falsch), 1, kennung)) === 1 && eine(sperre, zeile(N(richtig), 1, kennung)) === 0)
}
pruefe('81969861 (Tougen Anki): Dangers-Folge 81788314 weg, eigene Staffel 82069977 bleibt', eine(sperre, zeile(N('81969861'), 81788314, 'Staffel 1')) === 1 && eine(sperre, zeile(N('81969861'), 82069001, '82069977')) === 0)
pruefe('81227574 (Kung Fu Panda): Dee-Film 81382725 weg, eigene Staffel 81227575 bleibt', eine(sperre, zeile(N('81227574'), 81382725, 'Das Prequel')) === 1 && eine(sperre, zeile(N('81227574'), 81227600, '81227575')) === 0)
pruefe('81183924 (Dragon Age): „Staffel 3“-Folge 81515752 weg', eine(sperre, zeile(N('81183924'), 81515752, 'Staffel 3')) === 1)

console.log('Sperrliste')
const roh = JSON.parse(readFileSync(new URL('../data/netflix-fremde-meldungen.json', import.meta.url), 'utf8')) as FremdeMeldung[]
pruefe('jeder Eintrag: Netflix-Adressen, verschieden, mit Beleg und Kennung oder gti', roh.every((e) => /^https:\/\/www\.netflix\.com\/title\/\d+$/.test(e.url) && /^https:\/\/www\.netflix\.com\/title\/\d+$/.test(e.richtig) && e.url !== e.richtig && e.beleg.length > 40 && ((e.kennungen?.length ?? 0) + (e.gti?.length ?? 0)) > 0))
pruefe('keine Adresse zweimal (sonst ein Eintrag zu viel)', new Set(roh.map((e) => e.url)).size === roh.length)
pruefe('nach Adresse sortiert', roh.every((e, i) => i === 0 || roh[i - 1]!.url < e.url))

if (fehler) {
  console.error(`FEHL check-netflix-fremde-meldung: ${fehler} Fälle`)
  process.exit(1)
}
console.log('check-netflix-fremde-meldung: Sperre, Wächter und zehn Sperrlisten-Einträge geprüft.')
