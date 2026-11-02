/**
 * Zusicherung: **Ein einzelnes Netflix-404 entfernt keinen Weg; erst das zweite im Abstand von mindestens zwei Tagen** (02.11.2026:
 * 14 Titel verloren ihren Netflix-Weg an einem einmaligen 404, obwohl alle Adressen seit 18.09. durchgehend 200 waren).
 * Dazu der Wächter: mehr als 10 % Lebt/Tot-Wechsel einer Plattform in einem Lauf (Mindestmenge 20) warnen.
 * 1. `netflixBefund`: Tabelle der Vorbefunde, Grenze 1/2/3 Tage, Jahreswechsel, andere Anbieter und Status unverändert.
 * 2. Kreislauf: Lauf 1 (200 -> 404), Bau, Lauf 2 am nächsten Tag, Bau, Lauf 3 nach einer Woche, Bau — durch die echte Bauphase 09-2.
 * 3. `zaehleWechsel` / `wechselWarnungen`: genau 10 % warnt nicht, 11 % ab 20 Adressen warnt, Nichtauskunft zählt nicht.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { LinkBefund } from './lib/link-befund.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'netflix-zweites-404-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const NF = 'https://www.netflix.com/title/81422700'
/** Ein Abgang wird nur vermerkt, wo der zuletzt ausgelieferte Stand Deutsch führte. */
const DEUTSCH = { id: 1735, streams: [{ platform: 'netflix', url: NF, dub: true }] } as unknown as Title

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '# leer\n')
  const { netflixBefund, nimmBefund, zaehleWechsel, wechselWarnungen } = await import('./lib/link-rauschen.ts')
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')

  /* 1. Tabelle. Werte fest eingetragen, nicht aus dem Modul gelesen. */
  const tot = (am: string): LinkBefund => ({ status: 404, geprueftAm: am })
  const ersterTag = (am: string, erstes: string): LinkBefund => ({ status: 'unklar', geprueftAm: am, erstes404: erstes })
  erwarte('200 -> 404: unklar mit erstem Tag', netflixBefund(NF, { status: 200, geprueftAm: '2026-09-20' }, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('nie geprüft -> 404: unklar', netflixBefund(NF, undefined, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('unklar ohne erstes404 (Nichtauskunft) -> 404: unklar', netflixBefund(NF, { status: 'unklar', geprueftAm: '2026-10-01' }, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('region-Vorbefund zählt nicht als erstes 404', netflixBefund(NF, { status: 'region', geprueftAm: '2026-10-01' }, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('Abstand 0 Tage: unklar, erster Tag bleibt', netflixBefund(NF, ersterTag('2026-11-02', '2026-11-02'), tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('Abstand 1 Tag: noch unklar, erster Tag bleibt', netflixBefund(NF, ersterTag('2026-11-02', '2026-11-02'), tot('2026-11-03')), ersterTag('2026-11-03', '2026-11-02'))
  erwarte('Abstand 2 Tage: 404 bestätigt', netflixBefund(NF, ersterTag('2026-11-02', '2026-11-02'), tot('2026-11-04')), tot('2026-11-04'))
  erwarte('Abstand 3 Tage: 404 bestätigt', netflixBefund(NF, ersterTag('2026-11-02', '2026-11-02'), tot('2026-11-05')), tot('2026-11-05'))
  erwarte('Jahreswechsel, 1 Tag: unklar', netflixBefund(NF, ersterTag('2026-12-31', '2026-12-31'), tot('2027-01-01')), ersterTag('2027-01-01', '2026-12-31'))
  erwarte('Jahreswechsel, 2 Tage: 404', netflixBefund(NF, ersterTag('2026-12-31', '2026-12-31'), tot('2027-01-02')), tot('2027-01-02'))
  erwarte('Vorbefund 404 (bestätigt): bleibt 404', netflixBefund(NF, tot('2026-09-20'), tot('2026-11-02')), tot('2026-11-02'))
  erwarte('200 bleibt 200', netflixBefund(NF, tot('2026-09-20'), { status: 200, geprueftAm: '2026-11-02' }), { status: 200, geprueftAm: '2026-11-02' })
  erwarte('Zeitüberschreitung bleibt', netflixBefund(NF, { status: 200 }, { status: 'timeout', geprueftAm: '2026-11-02' }), { status: 'timeout', geprueftAm: '2026-11-02' })
  const prime = 'https://www.amazon.de/dp/B0TEST0001'
  erwarte('anderer Anbieter: 404 sofort', netflixBefund(prime, { status: 200 }, tot('2026-11-02')), tot('2026-11-02'))
  erwarte('Netflix ohne www: ebenfalls Netflix', netflixBefund('https://netflix.com/title/81022603', undefined, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  erwarte('Host nur mit Netflix im Namen: kein Netflix', netflixBefund('https://notnetflix.com/title/1', undefined, tot('2026-11-02')), tot('2026-11-02'))
  erwarte('Fremdhost mit Netflix im Pfad: kein Netflix', netflixBefund('https://example.org/netflix.com/title/1', undefined, tot('2026-11-02')), tot('2026-11-02'))

  /* 2. Kreislauf durch die echte Bauphase: Lauf, Bau, nächster Lauf, Bau. */
  const baue = (befund: LinkBefund) => {
    writeFileSync(join(kulisse, 'data/link-check.json'), JSON.stringify({ [NF]: befund }))
    const titles = new Map<number, Title>([[1735, { id: 1735, streams: [{ platform: 'netflix', url: NF }], entfernteStreams: [] } as unknown as Title]])
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
    const t = titles.get(1735)
    return { wege: t?.streams.length, abgang: t?.entfernteStreams?.length ?? 0 }
  }
  const lauf1 = netflixBefund(NF, { status: 200, geprueftAm: '2026-09-20' }, tot('2026-11-02'))
  erwarte('Bau nach Lauf 1 (einzelnes 404): Weg bleibt', baue(lauf1), { wege: 1, abgang: 0 })
  const lauf2 = netflixBefund(NF, lauf1, tot('2026-11-03'))
  erwarte('Bau nach Lauf 2 (1 Tag später): Weg bleibt', baue(lauf2), { wege: 1, abgang: 0 })
  const lauf3 = netflixBefund(NF, lauf2, tot('2026-11-09'))
  erwarte('Bau nach Lauf 3 (zweites 404 nach einer Woche): Weg geht', baue(lauf3), { wege: 0, abgang: 1 })
  const erholt = netflixBefund(NF, lauf2, { status: 200, geprueftAm: '2026-11-09' })
  erwarte('Bau nach 200 statt zweitem 404: Weg bleibt, kein erstes404 mehr', [baue(erholt), (erholt as LinkBefund).erstes404], [{ wege: 1, abgang: 0 }, undefined])
  erwarte('Kontrolle: hartes 404 entfernt weiter', baue(tot('2026-11-02')), { wege: 0, abgang: 1 })

  /* 2b. `nimmBefund`: eine echte Nichtauskunft löscht keinen Befund, ein Netflix-404 geht über die Regel, das Paar wandert in die Zählung. */
  const paare: { url: string; alt: unknown; neu: unknown }[] = []
  const bestand: Record<string, LinkBefund> = { [NF]: { status: 200, geprueftAm: '2026-09-20' } }
  nimmBefund(bestand, NF, { status: 'unklar', geprueftAm: '2026-11-02' }, paare)
  erwarte('echtes unklar überschreibt kein 200', bestand[NF], { status: 200, geprueftAm: '2026-09-20' })
  nimmBefund(bestand, NF, tot('2026-11-02'), paare)
  erwarte('Netflix-404 im Bestand: unklar mit erstem Tag', bestand[NF], ersterTag('2026-11-02', '2026-11-02'))
  erwarte('Paare: alt/neu der Rohmessung', paare, [{ url: NF, alt: 200, neu: 'unklar' }, { url: NF, alt: 200, neu: 404 }])

  /* 3. Wächter. */
  const lauf = (anzahl: number, wechsler: number, host = 'www.netflix.com', alt: unknown = 200, neu: unknown = 404) =>
    Array.from({ length: anzahl }, (_, i) => ({ url: `https://${host}/title/${i}`, alt, neu: i < wechsler ? neu : alt }))
  const warnt = (p: ReturnType<typeof lauf>) => wechselWarnungen(zaehleWechsel(p)).length
  erwarte('20 Adressen, 2 Wechsel (genau 10 %): keine Warnung', warnt(lauf(20, 2)), 0)
  erwarte('20 Adressen, 3 Wechsel (15 %): Warnung', warnt(lauf(20, 3)), 1)
  erwarte('100 Adressen, 10 Wechsel (genau 10 %): keine Warnung', warnt(lauf(100, 10)), 0)
  erwarte('100 Adressen, 11 Wechsel: Warnung', warnt(lauf(100, 11)), 1)
  erwarte('19 Adressen, 19 Wechsel: unter der Mindestmenge keine Warnung', warnt(lauf(19, 19)), 0)
  erwarte('Richtung 404 -> 200 zählt ebenso', warnt(lauf(20, 5, 'www.netflix.com', 404, 200)), 1)
  erwarte('304 -> 404 zählt als lebt -> tot', warnt(lauf(20, 5, 'www.netflix.com', 304, 404)), 1)
  erwarte('Nichtauskunft (timeout) zählt weder als Wechsel noch als geprüft', warnt([...lauf(20, 2), ...lauf(50, 50, 'www.netflix.com', 200, 'timeout')]), 0)
  erwarte('Vorbefund fehlt: nicht geprüft', warnt(lauf(40, 40, 'www.netflix.com', null, 404)), 0)
  erwarte('Nachbarhost mischt sich nicht', warnt([...lauf(20, 2), ...lauf(20, 2, 'www.joyn.de')]), 0)
  const z = zaehleWechsel([...lauf(20, 3), ...lauf(25, 0, 'joyn.de')])
  erwarte('Zählung je Host (www. abgestreift)', z, [{ host: 'netflix.com', geprueft: 20, wechsel: 3 }, { host: 'joyn.de', geprueft: 25, wechsel: 0 }])
  const zeile = wechselWarnungen([{ host: 'netflix.com', geprueft: 204, wechsel: 88 }])[0] ?? ''
  erwarte('Warnzeile nennt Plattform und Zahlen im Format der Wache', [zeile.startsWith('⚠ WARNUNG'), zeile.includes('netflix.com 88 von 204')], [true, true])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-netflix-zweites-404: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-netflix-zweites-404: ${pruefungen} Fälle — einzelnes Netflix-404 lässt den Weg stehen, zweites nach 2 Tagen entfernt ihn, mehr als 10 % Wechsel je Plattform warnt.`)
