/**
 * Zusicherungen zu den geteilten Prime-Seiten (`lib/prime-teilseiten.ts`, `bau/09-7-prime-teilseiten.ts`): ein Folgenbereich nur aus
 * einer eindeutigen Meldung (eine Meldung des Titels zur Seite, Nummern in 1 bis Folgenzahl, keine doppelt, Gruppe nicht zwei Titeln
 * zugeordnet, kein Kanal-Titel), sonst ein Grund für die Prüfliste. Die Seiten sind den echten nachgebaut (Food Wars 24 + 13 in zwei
 * Gruppen, Hyouka mit Lücken). Läuft in `check:logic`; der Bestandsteil steht in `check-prime-teilseiten-bestand.ts`.
 */
import { ordnePrimeSeiteZu, type PrimeMeldung, type PrimeUrteil } from './lib/prime-teilseiten.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

const SEITE = 'amazon:b0seite001'
const URL_SEITE = 'https://www.amazon.de/gp/video/detail/B0SEITE001'

type Folge = PrimeMeldung['folgen'][number]
const deutsch = (nummern: number[]): Folge[] => nummern.map((n) => ({ unsere: n, sprachen: ['Deutsch', '日本語'] }))
const reihe = (von: number, bis: number): number[] => Array.from({ length: bis - von + 1 }, (_, i) => von + i)
const meldung = (titleId: number, asin: string | null, folgen: Folge[], mehr: Partial<PrimeMeldung> = {}): PrimeMeldung => ({
  titleId,
  asin,
  plattform: 'primevideo',
  folgen,
  ...mehr,
})
const urteil = (ms: [string, PrimeMeldung][], id: number, episodes: number, kanal = false): PrimeUrteil =>
  ordnePrimeSeiteZu([{ id, episodes }], ms, SEITE, kanal).get(id)!
const bereich = (u: PrimeUrteil): string => ('bereiche' in u ? u.bereiche.map((b) => `${b.from}-${b.to}`).join() : `offen:${u.grund}`)

// 1. Eindeutige Meldung: alle zwölf Folgen deutsch.
const eins = urteil([[URL_SEITE, meldung(1, 'A1', deutsch(reihe(1, 12)))]], 1, 12)
pruefe('eindeutige Meldung gibt 1–12', bereich(eins) === '1-12', bereich(eins))

// 2. Lücken bleiben Lücken (Hyouka: Folge 4 nicht gemeldet).
const luecke = urteil([[URL_SEITE, meldung(1, 'A1', deutsch([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]))]], 1, 22)
pruefe('Lücken bleiben Lücken, Rest der Staffel bleibt ohne Angabe', bereich(luecke) === '1-3,5-12', bereich(luecke))

// 3. Nur die deutschen Folgen werden geschrieben.
const gemischt = urteil([[URL_SEITE, meldung(1, 'A1', [...deutsch([1, 2]), { unsere: 3, sprachen: ['日本語'] }, ...deutsch([4])])]], 1, 4)
pruefe('eine nur japanische Folge wird nicht geschrieben', bereich(gemischt) === '1-2,4-4', bereich(gemischt))

// 4. Zwei Staffeln auf einer Seite, zwei Gruppen: beide bekommen ihren Bereich (Food Wars 24 + 13).
const foodWars: [string, PrimeMeldung][] = [
  [`${URL_SEITE}#0`, meldung(1, 'G0', deutsch(reihe(1, 24)))],
  [`${URL_SEITE}#1`, meldung(2, 'G1', deutsch(reihe(1, 13)))],
]
const fw = ordnePrimeSeiteZu([{ id: 1, episodes: 24 }, { id: 2, episodes: 13 }], foodWars, SEITE, false)
pruefe('zwei Gruppen, zwei Titel: 1–24 und 1–13', bereich(fw.get(1)!) === '1-24' && bereich(fw.get(2)!) === '1-13', [bereich(fw.get(1)!), bereich(fw.get(2)!)])

// 5. Offene Fälle mit Grund.
const kanal = urteil([[URL_SEITE, meldung(1, 'A1', deutsch(reihe(1, 12)))]], 1, 12, true)
pruefe('Kanal-Titel: keine Folge belegt', bereich(kanal).startsWith('offen:Kanal-Titel'), bereich(kanal))
const keine = urteil([], 1, 12)
pruefe('ohne Meldung offen', bereich(keine).startsWith('offen:keine Meldung'), bereich(keine))
const fremd = urteil([[URL_SEITE, meldung(9, 'A9', deutsch(reihe(1, 12)))]], 1, 12)
pruefe('Meldung eines anderen Titels zählt nicht', bereich(fremd).startsWith('offen:keine Meldung'), bereich(fremd))
const netflix = urteil([[URL_SEITE, meldung(1, 'A1', deutsch(reihe(1, 12)), { plattform: 'netflix' })]], 1, 12)
pruefe('Meldung eines anderen Anbieters zählt nicht', bereich(netflix).startsWith('offen:keine Meldung'), bereich(netflix))
const zwei = urteil([[`${URL_SEITE}#0`, meldung(1, 'A1', deutsch(reihe(1, 12)))], [`${URL_SEITE}#1`, meldung(1, 'A2', deutsch(reihe(1, 6)))]], 1, 12)
pruefe('zwei Meldungen desselben Titels zur Seite: offen', bereich(zwei).startsWith('offen:2 Meldungen'), bereich(zwei))
const ohneDeutsch = urteil([[URL_SEITE, meldung(1, 'A1', [{ unsere: 1, sprachen: ['日本語'] }])]], 1, 12)
pruefe('keine deutsche Folge in der Meldung: offen', bereich(ohneDeutsch).startsWith('offen:in der Meldung'), bereich(ohneDeutsch))
const ohneNummer = urteil([[URL_SEITE, meldung(1, 'A1', [...deutsch([1, 2]), { unsere: null, sprachen: ['Deutsch'] }])]], 1, 12)
pruefe('deutsche Folge ohne unsere Nummer: offen', bereich(ohneNummer).startsWith('offen:1 deutsche Folge'), bereich(ohneNummer))
const doppelt = urteil([[URL_SEITE, meldung(1, 'A1', deutsch([1, 2, 2, 3]))]], 1, 12)
pruefe('eine Nummer doppelt vergeben: offen', bereich(doppelt).startsWith('offen:eine unserer'), bereich(doppelt))
const draussen = urteil([[URL_SEITE, meldung(1, 'A1', deutsch([1, 2, 13]))]], 1, 12)
pruefe('Nummer über der Folgenzahl: offen', bereich(draussen).startsWith('offen:Folgennummer 13'), bereich(draussen))
const unbekannt = urteil([[URL_SEITE, meldung(1, 'A1', deutsch([1]))]], 1, 0)
pruefe('Folgenzahl unbekannt: offen', bereich(unbekannt).startsWith('offen:Folgenzahl'), bereich(unbekannt))

// 6. Dieselbe Gruppe unter zwei Titeln: beide offen.
const gleicheGruppe: [string, PrimeMeldung][] = [
  [`${URL_SEITE}#0`, meldung(1, 'G0', deutsch(reihe(1, 12)))],
  [`${URL_SEITE}#1`, meldung(2, 'G0', deutsch(reihe(1, 12)))],
]
const gg = ordnePrimeSeiteZu([{ id: 1, episodes: 12 }, { id: 2, episodes: 12 }], gleicheGruppe, SEITE, false)
pruefe('dieselbe Folgengruppe bei zwei Titeln: beide offen', bereich(gg.get(1)!).startsWith('offen:dieselbe Folgengruppe') && bereich(gg.get(2)!).startsWith('offen:dieselbe Folgengruppe'), [bereich(gg.get(1)!), bereich(gg.get(2)!)])

// 7. Die gemeldete Seite schlägt die Adresse der Ablage.
const andere = [[URL_SEITE, meldung(1, 'A1', deutsch(reihe(1, 12)), { seite: 'B0ANDERE01' })]] as [string, PrimeMeldung][]
pruefe('gemeldet auf anderer Seite: hier offen, Grund nennt die andere', bereich(urteil(andere, 1, 12)).includes('anderen Seite (B0ANDERE01)'), bereich(urteil(andere, 1, 12)))
const hierher = [['https://www.amazon.de/gp/video/detail/B0ABLAGE01', meldung(1, 'A1', deutsch(reihe(1, 12)), { seite: 'B0SEITE001' })]] as [string, PrimeMeldung][]
pruefe('gemeldete Seite gleich unserer: gilt, auch wenn die Ablage-Adresse eine andere ist', bereich(urteil(hierher, 1, 12)) === '1-12', bereich(urteil(hierher, 1, 12)))

// 8. Hyouka (al 12189): erste Hälfte auf der Seite selbst, zweite Hälfte unter derselben Ablage-Adresse, aber von einer anderen Seite gemeldet.
const HYOUKA = 'https://www.amazon.de/gp/video/detail/B0B5JVJKCD'
const hyoukaErste = meldung(12189, 'B0B5HV9GG6', deutsch([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]), { seite: 'B0B5JVJKCD' })
const hyoukaZweite = meldung(12189, 'B0DBRCH6C1', deutsch(reihe(13, 22)), { seite: 'B0DC75L8BJ' })
const hyouka = (ms: [string, PrimeMeldung][], episodes = 22): string =>
  bereich(ordnePrimeSeiteZu([{ id: 12189, episodes }], ms, 'amazon:b0b5jvjkcd', false).get(12189)!)
const beide: [string, PrimeMeldung][] = [[`${HYOUKA}#0`, hyoukaErste], [HYOUKA, hyoukaZweite]]
pruefe('Hyouka: beide Hälften zusammen, Folge 4 bleibt offen', hyouka(beide) === '1-3,5-22', hyouka(beide))
pruefe('Hyouka: Reihenfolge der Meldungen egal', hyouka([beide[1]!, beide[0]!]) === '1-3,5-22', hyouka([beide[1]!, beide[0]!]))
pruefe('Hyouka: nur die zweite Hälfte bleibt ungeklärt', hyouka([beide[1]!]).startsWith('offen:Meldung kam von einer anderen Seite (B0DC75L8BJ)'), hyouka([beide[1]!]))
const ueberlapp: [string, PrimeMeldung][] = [beide[0]!, [HYOUKA, meldung(12189, 'B0DBRCH6C1', deutsch(reihe(12, 22)), { seite: 'B0DC75L8BJ' })]]
pruefe('Hyouka: sich überschneidende Nummern machen es offen', hyouka(ueberlapp).startsWith('offen:eine unserer Folgennummern ist in der Meldung doppelt'), hyouka(ueberlapp))
pruefe('Hyouka: Nummer über der Folgenzahl macht es offen', hyouka(beide, 20).startsWith('offen:Folgennummer 21'), hyouka(beide, 20))
const fremdeZweite: [string, PrimeMeldung][] = [beide[0]!, [HYOUKA, meldung(7, 'B0DBRCH6C1', deutsch(reihe(1, 10)), { seite: 'B0DC75L8BJ' })]]
pruefe('Hyouka: Zusatz-Meldung eines anderen Titels zählt nicht dazu', hyouka(fremdeZweite) === '1-3,5-12', hyouka(fremdeZweite))
const andereAblage: [string, PrimeMeldung][] = [beide[0]!, ['https://www.amazon.de/gp/video/detail/B0ANDERE99', hyoukaZweite]]
pruefe('Hyouka: Zusatz-Meldung unter fremder Ablage-Adresse zählt nicht dazu', hyouka(andereAblage) === '1-3,5-12', hyouka(andereAblage))
const andererAnbieter: [string, PrimeMeldung][] = [beide[0]!, [HYOUKA, { ...hyoukaZweite, plattform: 'netflix' }]]
pruefe('Hyouka: Zusatz-Meldung eines anderen Anbieters zählt nicht dazu', hyouka(andererAnbieter) === '1-3,5-12', hyouka(andererAnbieter))
const gruppeGeteilt: [string, PrimeMeldung][] = [...beide, [`${HYOUKA}#1`, meldung(8, 'B0DBRCH6C1', deutsch(reihe(1, 10)), { seite: 'B0B5JVJKCD' })]]
pruefe('Hyouka: Folgengruppe der Zusatz-Meldung auch einem anderen Titel der Seite gemeldet: offen', hyouka(gruppeGeteilt).startsWith('offen:dieselbe Folgengruppe (B0DBRCH6C1)'), hyouka(gruppeGeteilt))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den geteilten Prime-Seiten verletzt`)
  process.exit(1)
}
console.log('Geteilte Prime-Seiten: Zusicherungen erfüllt')
