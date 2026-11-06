/**
 * Zusicherung: **Ein Netflix-404 aus der Linkprüfung entfernt einen Weg nur, wenn kein Massen-404-Lauf und keine frische
 * JustWatch-Angabe dagegen steht** (04.11.2026: 91 Netflix-Adressen im Lauf auf 404, 14 Titel verloren ihren Weg, von Hand alle verfügbar).
 * 1. `gewerteteBefunde`: Tabelle JustWatch-Alter (35/36 Tage), Angebotsart, Anbieter, Staffel-Angebote, Adressform.
 * 2. Lauf-Riegel: 10 % ändern nichts, mehr als 10 % schon, unter 20 Adressen nie, Wechsel des Lauftags.
 * 3. Durch die echte Bauphase 09-2: Weg bleibt bei frischem JustWatch oder Massenlauf, geht ohne beides (Gegenprobe).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { LinkBefund } from './lib/link-befund.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'netflix-404-gate-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const nf = (id: number | string) => `https://www.netflix.com/title/${id}`
const tot = (am: string): LinkBefund => ({ status: 404, geprueftAm: am })
const lebt = (am: string): LinkBefund => ({ status: 200, geprueftAm: am })
const unklarErst = (am: string): LinkBefund => ({ status: 'unklar', geprueftAm: am, erstes404: am })
const HEUTE = '2026-11-06'
const jwAngebot = (url: string, art = 'FLATRATE', anbieter = 'Netflix') => ({ anbieter, art, url })
/** Ein einzelnes totes Netflix mit `n - 1` lebenden daneben im Lauf `am`: Quote 1/n, hier mit `tote` toten. */
const lauf = (am: string, n: number, tote: number, ab = 1000): Record<string, LinkBefund> => {
  const b: Record<string, LinkBefund> = {}
  for (let i = 0; i < n; i++) b[nf(ab + i)] = i < tote ? tot(am) : lebt(am)
  return b
}

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '# leer\n')
  const { gewerteteBefunde, jwNetflixStand, rauschTage, netflixId } = await import('./lib/netflix-404-gate.ts')
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')

  /* 1. JustWatch-Riegel. */
  const jw = (am: string, angebote: object[], staffeln?: object[]) => ({ '1': { geprueftAm: am, angebote, staffeln } })
  const stand = (am: string, art = 'FLATRATE', anbieter = 'Netflix') => jwNetflixStand(jw(am, [jwAngebot(nf(555), art, anbieter)]) as never)
  const urteil = (jwStand: Map<string, string>, b: Record<string, LinkBefund> = { [nf(555)]: tot('2026-11-04') }) => gewerteteBefunde(b, jwStand, HEUTE).befunde[nf(555)]
  const bleibt = { status: 'unklar', geprueftAm: '2026-11-04', erstes404: '2026-11-04' }
  erwarte('JW 0 Tage alt: Weg bleibt', urteil(stand('2026-11-06')), bleibt)
  erwarte('JW 35 Tage alt: Weg bleibt', urteil(stand('2026-10-02')), bleibt)
  erwarte('JW 36 Tage alt: 404 gilt', urteil(stand('2026-10-01')), tot('2026-11-04'))
  erwarte('JW führt die Adresse als Kauf: 404 gilt', urteil(stand('2026-11-06', 'BUY')), tot('2026-11-04'))
  erwarte('JW führt die Adresse als Leihe: 404 gilt', urteil(stand('2026-11-06', 'RENT')), tot('2026-11-04'))
  erwarte('JW-Anbieter Netflix Standard with Ads: Weg bleibt', urteil(stand('2026-11-06', 'FLATRATE', 'Netflix Standard with Ads')), bleibt)
  erwarte('JW-Anbieter Disney+: 404 gilt', urteil(stand('2026-11-06', 'FLATRATE', 'Disney Plus')), tot('2026-11-04'))
  erwarte('JW führt eine andere Netflix-Kennung: 404 gilt', urteil(jwNetflixStand(jw('2026-11-06', [jwAngebot(nf(556))]) as never)), tot('2026-11-04'))
  erwarte('JW nur in einer Staffel: Weg bleibt', urteil(jwNetflixStand(jw('2026-11-06', [], [{ angebote: [jwAngebot(nf(555))] }]) as never)), bleibt)
  erwarte('JW-Eintrag ohne Stand zählt nicht', urteil(jwNetflixStand({ '1': { angebote: [jwAngebot(nf(555))] } } as never)), tot('2026-11-04'))
  erwarte('zwei JW-Einträge: der jüngere zählt', jwNetflixStand({ ...jw('2026-09-01', [jwAngebot(nf(555))]), '2': { geprueftAm: '2026-11-01', angebote: [jwAngebot(nf(555))] } } as never).get('555'), '2026-11-01')
  erwarte('Adresse mit Sprachpfad: gleiche Kennung', netflixId('https://www.netflix.com/de/title/555'), '555')
  erwarte('Adresse /watch/: gleiche Kennung', netflixId('https://www.netflix.com/watch/555'), '555')
  erwarte('fremder Host: keine Kennung', netflixId('https://example.org/netflix.com/title/555'), undefined)
  erwarte('ohne JW: 404 gilt', urteil(new Map()), tot('2026-11-04'))
  const fremd = 'https://www.joyn.de/serien/x'
  erwarte('anderer Anbieter bleibt 404', gewerteteBefunde({ [fremd]: tot('2026-11-04') }, new Map([['555', HEUTE]]), HEUTE).befunde[fremd], tot('2026-11-04'))
  erwarte('Netflix-200 bleibt unberührt', urteil(stand('2026-11-06'), { [nf(555)]: lebt('2026-11-04') }), lebt('2026-11-04'))
  erwarte('Rückgabe zählt: lauf nein, jw ja', gewerteteBefunde({ [nf(555)]: tot('2026-11-04') }, stand('2026-11-06'), HEUTE).ungewertet, [{ url: nf(555), lauf: false, jw: true }])

  /* 2. Lauf-Riegel (Mindestmenge 20, mehr als 10 %). */
  const rausch = (b: Record<string, LinkBefund>) => [...rauschTage(b)]
  erwarte('2 von 20 (genau 10 %): kein Rauschen', rausch(lauf('2026-11-04', 20, 2)), [])
  erwarte('10 von 100 (10 %): kein Rauschen', rausch(lauf('2026-11-04', 100, 10)), [])
  erwarte('11 von 100 (11 %): Rauschen', rausch(lauf('2026-11-04', 100, 11)), ['2026-11-04'])
  erwarte('3 von 20 (15 %): Rauschen', rausch(lauf('2026-11-04', 20, 3)), ['2026-11-04'])
  erwarte('19 Adressen, alle tot: zu klein, kein Rauschen', rausch(lauf('2026-11-04', 19, 19)), [])
  erwarte('20 Adressen, 1 tot: kein Rauschen', rausch(lauf('2026-11-04', 20, 1)), [])
  erwarte('erstes 404 (unklar, gleicher Tag) zählt als 404', rausch({ ...lauf('2026-11-04', 19, 0), [nf(1)]: unklarErst('2026-11-04'), [nf(2)]: unklarErst('2026-11-04'), [nf(3)]: unklarErst('2026-11-04') }), ['2026-11-04'])
  erwarte('unklar ohne erstes404 zählt weder als Menge noch als 404', rausch({ ...lauf('2026-11-04', 19, 0), [nf(7)]: { status: 'unklar', geprueftAm: '2026-11-04' }, [nf(8)]: { status: 503, geprueftAm: '2026-11-04' } }), [])
  erwarte('Läufe werden je Tag gezählt', rausch({ ...lauf('2026-11-02', 20, 0), ...lauf('2026-11-04', 20, 10, 2000) }), ['2026-11-04'])
  const massen = { ...lauf('2026-11-04', 20, 5), ...lauf('2026-11-03', 20, 1, 3000) }
  const g = gewerteteBefunde(massen, new Map(), HEUTE)
  erwarte('Massenlauf: 404 vom Lauftag zurückgehalten', [g.befunde[nf(1000)], g.ungewertet.length], [{ status: 'unklar', geprueftAm: '2026-11-04', erstes404: '2026-11-04' }, 5])
  erwarte('Massenlauf: 404 aus ruhigem Lauf gilt', g.befunde[nf(3000)], tot('2026-11-03'))
  erwarte('Massenlauf: Kennzeichen lauf ja, jw nein', g.ungewertet[0], { url: nf(1000), lauf: true, jw: false })
  erwarte('Eingabe bleibt unverändert', massen[nf(1000)], tot('2026-11-04'))
  erwarte('anderer Anbieter im Massenlauf bleibt 404', gewerteteBefunde({ ...lauf('2026-11-04', 20, 10), [fremd]: tot('2026-11-04') }, new Map(), HEUTE).befunde[fremd], tot('2026-11-04'))

  /* 3. Durch die echte Bauphase 09-2. JustWatch-Stände mit Fernzukunft bzw. Altdatum, damit der Test keine Uhr liest. */
  const DEUTSCH = { id: 1735, streams: [{ platform: 'netflix', url: nf(80000603), dub: true }] } as unknown as Title
  const baue = (befunde: Record<string, LinkBefund>, jwDatei: object) => {
    writeFileSync(join(kulisse, 'data/link-check.json'), JSON.stringify(befunde))
    writeFileSync(join(kulisse, 'data/justwatch-audio.json'), JSON.stringify(jwDatei))
    const titles = new Map<number, Title>([[1735, { id: 1735, streams: [{ platform: 'netflix', url: nf(80000603) }], entfernteStreams: [] } as unknown as Title]])
    werteLinkpruefungAus({
      ytKanal: {},
      ytKauf: new Set(),
      titles,
      netflixOhneKennung: 0,
      checksJePlattform: new Map(),
      youtubeBefunde: {},
      belegFuer: () => undefined,
      vonHandBelegtAm: new Map(),
      checks: new Map(),
      vorherTitles: [DEUTSCH],
    })
    return { wege: titles.get(1735)?.streams.length, abgang: titles.get(1735)?.entfernteStreams?.length ?? 0 }
  }
  const eigenes = { [nf(80000603)]: tot('2026-11-04') }
  const jwFrisch = jw('2999-12-31', [jwAngebot(nf(80000603))])
  const jwAlt = jw('2000-01-01', [jwAngebot(nf(80000603))])
  erwarte('Bau: 404, JW frisch: Weg bleibt', baue(eigenes, jwFrisch), { wege: 1, abgang: 0 })
  erwarte('Bau: 404, JW führt Adresse nicht: Weg geht (Gegenprobe)', baue(eigenes, jw('2999-12-31', [jwAngebot(nf(1))])), { wege: 0, abgang: 1 })
  erwarte('Bau: 404, JW veraltet: Weg geht', baue(eigenes, jwAlt), { wege: 0, abgang: 1 })
  erwarte('Bau: 404, keine JW-Datei: Weg geht', baue(eigenes, {}), { wege: 0, abgang: 1 })
  erwarte('Bau: Massenlauf, JW schweigt: Weg bleibt', baue({ ...lauf('2026-11-04', 20, 5), ...eigenes }, {}), { wege: 1, abgang: 0 })
  erwarte('Bau: ruhiger Lauf, JW schweigt: Weg geht', baue({ ...lauf('2026-11-04', 20, 1, 5000), ...eigenes }, {}), { wege: 0, abgang: 1 })
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler.length) {
  for (const f of fehler) console.error(`✖ ${f}`)
  console.log(`VERSTÖSSE: ${fehler.length}`)
  process.exit(1)
}
console.log(`Netflix-404-Gate: ${pruefungen} Fälle grün (JustWatch-Alter, Angebotsart, Massenlauf, Bauphase 09-2).`)
console.log('VERSTÖSSE: 0')
