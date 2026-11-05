/**
 * Zusicherung: **Ein einzelnes Netflix-404 entfernt keinen Weg; erst das zweite im Abstand von mindestens zwei Tagen** (02.11.2026:
 * 14 Titel verloren ihren Netflix-Weg an einem einmaligen 404, obwohl alle Adressen seit 18.09. durchgehend 200 waren).
 * Dazu der Wächter: mehr als 10 % Lebt/Tot-Wechsel einer Plattform in einem Lauf (Mindestmenge 20) warnen.
 * 1. `netflixBefund`: Tabelle der Vorbefunde, Grenze 1/2/3 Tage, Jahreswechsel, andere Anbieter und Status unverändert.
 * 1b. Seit 05.11.2026: ein Netflix-404 entfernt keinen Weg mit belegtem Deutsch (Handbeleg, Vorstand, geführter Abgang), auch kein bestätigtes —
 *     die CI sah dieselben 34 Adressen drei Tage lang als 404, das zweite 404 war kein unabhängiger Beleg. Andere Anbieter unverändert.
 * 2. Kreislauf: Lauf 1 (200 -> 404), Bau, Lauf 2 am nächsten Tag, Bau, Lauf 3 nach einer Woche, Bau — durch die echte Bauphase 09-2.
 * 3. `zaehleWechsel` / `wechselWarnungen`: genau 10 % warnt nicht, 11 % ab 20 Adressen warnt, Nichtauskunft zählt nicht.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { LinkBefund } from './lib/link-befund.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

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
  const { netflixBefund, nimmBefund, zaehleWechsel, wechselWarnungen, zweitesNetflix404, hat404 } = await import('./lib/link-rauschen.ts')
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')
  const { dubKey } = await import('./lib/dub-confirmed.ts')

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
  /** Der Bau über einen Titel mit einem Netflix-Weg `weg`; `befunde` ist der Inhalt von `link-check.json`. */
  const baueMit = (befunde: Record<string, LinkBefund>, weg: string, vorher: Title[] = [DEUTSCH], plattform = 'netflix', belege = new Map<string, DubCheck[]>()) => {
    writeFileSync(join(kulisse, 'data/link-check.json'), JSON.stringify(befunde))
    const titles = new Map<number, Title>([[1735, { id: 1735, streams: [{ platform: plattform, url: weg }], entfernteStreams: [] } as unknown as Title]])
    werteLinkpruefungAus({
      ytKanal: {},
      ytKauf: new Set(),
      titles,
      netflixOhneKennung: 0,
      checksJePlattform: belege,
      youtubeBefunde: {},
      belegFuer: () => undefined,
      vonHandBelegtAm: new Map(),
      checks: new Map(),
      vorherTitles: vorher,
    })
    return titles.get(1735)
  }
  const baue = (befund: LinkBefund, vorher?: Title[], plattform?: string, url = NF, belege?: Map<string, DubCheck[]>) => {
    const t = baueMit({ [url]: befund }, url, vorher, plattform, belege)
    return { wege: t?.streams.length, abgang: t?.entfernteStreams?.length ?? 0 }
  }
  /* Netflix-Riegel (Bau 09-2): zwei Formen derselben Kennung, die neue (`/title/`) mit erstem 404, die alte (`/watch/`) lebt. */
  const ALT = 'https://www.netflix.com/watch/82850867'
  const NEU = 'https://www.netflix.com/title/82850867'
  const weg = (befunde: Record<string, LinkBefund>) => baueMit(befunde, ALT)?.streams.map((s) => s.url)
  const erst = ersterTag('2026-11-02', '2026-11-02')
  const lebt = { status: 200, geprueftAm: '2026-11-01' }
  erwarte('Riegel: neue Form mit erstem 404, alte lebt: alte Form bleibt', weg({ [ALT]: lebt, [NEU]: erst }), [ALT])
  erwarte('Riegel: neue Form bestätigt 404, alte lebt: alte Form bleibt', weg({ [ALT]: lebt, [NEU]: tot('2026-11-02') }), [ALT])
  erwarte('Riegel: beide mit erstem 404: vereinheitlicht', weg({ [ALT]: erst, [NEU]: erst }), [NEU])
  erwarte('Riegel: alte Form mit erstem 404, neue lebt: vereinheitlicht', weg({ [ALT]: erst, [NEU]: lebt }), [NEU])
  erwarte('Riegel: Nichtauskunft ohne erstes404 in der neuen Form: vereinheitlicht', weg({ [ALT]: lebt, [NEU]: { status: 'unklar', geprueftAm: '2026-11-02' } }), [NEU])
  erwarte('Riegel: ohne Messung der neuen Form: vereinheitlicht', weg({ [ALT]: lebt }), [NEU])
  const lauf1 = netflixBefund(NF, { status: 200, geprueftAm: '2026-09-20' }, tot('2026-11-02'))
  erwarte('Bau nach Lauf 1 (einzelnes 404): Weg bleibt', baue(lauf1), { wege: 1, abgang: 0 })
  const lauf2 = netflixBefund(NF, lauf1, tot('2026-11-03'))
  erwarte('Bau nach Lauf 2 (1 Tag später): Weg bleibt', baue(lauf2), { wege: 1, abgang: 0 })
  const lauf3 = netflixBefund(NF, lauf2, tot('2026-11-09'))
  erwarte('Bau nach Lauf 3 (zweites 404 nach einer Woche) bei belegtem Deutsch: Weg bleibt', baue(lauf3), { wege: 1, abgang: 0 })
  erwarte('Bau nach Lauf 3 ohne belegtes Deutsch: Weg geht, ohne Abgangsvermerk', baue(lauf3, []), { wege: 0, abgang: 0 })
  erwarte('Bau nach Lauf 3, Vorstand ohne Ja (dub false): Weg geht', baue(lauf3, [{ id: 1735, streams: [{ platform: 'netflix', url: NF, dub: false }] } as unknown as Title]), { wege: 0, abgang: 0 })
  /* Der Vorstand zählt auch den schon geführten Abgang: nach dem Bau vom 04.11. kommt der Weg so zurück. */
  const alsAbgang = [{ id: 1735, streams: [], entfernteStreams: [{ platform: 'netflix', url: NF, dub: true }] } as unknown as Title]
  erwarte('Bau nach Lauf 3, Deutsch nur als geführter Abgang: Weg bleibt', baue(lauf3, alsAbgang), { wege: 1, abgang: 0 })
  const handBeleg = new Map([[dubKey(1735, 'netflix'), [{ dub: true } as unknown as DubCheck]]])
  erwarte('Bau nach Lauf 3, Deutsch nur per Handbeleg: Weg bleibt', baue(lauf3, [], 'netflix', NF, handBeleg), { wege: 1, abgang: 0 })
  const joyn = 'https://www.joyn.de/serien/x'
  const joynVorher = [{ id: 1735, streams: [{ platform: 'joyn', url: joyn, dub: true }] } as unknown as Title]
  erwarte('Anderer Anbieter mit belegtem Deutsch: bestätigtes 404 entfernt weiter', baue(tot('2026-11-09'), joynVorher, 'joyn', joyn), { wege: 0, abgang: 1 })
  const erholt = netflixBefund(NF, lauf2, { status: 200, geprueftAm: '2026-11-09' })
  erwarte('Bau nach 200 statt zweitem 404: Weg bleibt, kein erstes404 mehr', [baue(erholt), (erholt as LinkBefund).erstes404], [{ wege: 1, abgang: 0 }, undefined])
  erwarte('Kontrolle: hartes 404 ohne belegtes Deutsch entfernt weiter', baue(tot('2026-11-02'), []), { wege: 0, abgang: 0 })
  erwarte('Netflix mit belegtem Deutsch, Region-Befund: entfernt weiter (nur 404 ist Rauschen)', baue({ status: 'region', geprueftAm: '2026-11-02' }), { wege: 0, abgang: 1 })

  erwarte('Adresse nicht lesbar: kein Netflix', netflixBefund('keine adresse', undefined, tot('2026-11-02')), tot('2026-11-02'))
  erwarte('erstes404 nur aus unklar: ein Rest an anderem Status zählt nicht', netflixBefund(NF, { status: 200, geprueftAm: '2026-10-01', erstes404: '2026-10-01' }, tot('2026-11-05')), ersterTag('2026-11-05', '2026-11-05'))

  /* 2b. `nimmBefund`: eine echte Nichtauskunft löscht keinen Befund, ein Netflix-404 geht über die Regel, das Paar wandert in die Zählung. */
  const paare: { url: string; alt: unknown; neu: unknown }[] = []
  const bestand: Record<string, LinkBefund> = { [NF]: { status: 200, geprueftAm: '2026-09-20' } }
  nimmBefund(bestand, NF, { status: 'unklar', geprueftAm: '2026-11-02' }, paare)
  erwarte('echtes unklar überschreibt kein 200', bestand[NF], { status: 200, geprueftAm: '2026-09-20' })
  nimmBefund(bestand, NF, tot('2026-11-02'), paare)
  erwarte('Netflix-404 im Bestand: unklar mit erstem Tag', bestand[NF], ersterTag('2026-11-02', '2026-11-02'))
  erwarte('Paare: alt/neu der Rohmessung', paare, [{ url: NF, alt: 200, neu: 'unklar' }, { url: NF, alt: 200, neu: 404 }])
  const andere = 'https://www.joyn.de/serien/x'
  const frisch: Record<string, LinkBefund> = {}
  nimmBefund(frisch, andere, { status: 'unklar', geprueftAm: '2026-11-02' }, [])
  erwarte('echtes unklar ohne Vorbefund wird gespeichert', frisch[andere], { status: 'unklar', geprueftAm: '2026-11-02' })
  nimmBefund(frisch, andere, { status: 'unklar', geprueftAm: '2026-11-09' }, [])
  erwarte('unklar über altem unklar erneuert das Datum', frisch[andere], { status: 'unklar', geprueftAm: '2026-11-09' })

  /* 2c. Das vermerkte erste 404 übersteht Nichtauskünfte; die Frist beginnt nicht von vorn. */
  const alt1 = ersterTag('2026-10-25', '2026-10-20')
  const folge = (neu: LinkBefund): LinkBefund | undefined => {
    const b: Record<string, LinkBefund> = { [NF]: alt1 }
    nimmBefund(b, NF, neu, [])
    return b[NF]
  }
  erwarte('unklar auf erstes404: Tag bleibt', folge({ status: 'unklar', geprueftAm: '2026-11-02' }), ersterTag('2026-11-02', '2026-10-20'))
  erwarte('503 auf erstes404: Tag bleibt', folge({ status: 503, geprueftAm: '2026-11-02' }), { status: 503, geprueftAm: '2026-11-02', erstes404: '2026-10-20' })
  erwarte('timeout auf erstes404: Tag bleibt', folge({ status: 'timeout', geprueftAm: '2026-11-02' }), { status: 'timeout', geprueftAm: '2026-11-02', erstes404: '2026-10-20' })
  erwarte('zweites 404 nach Nichtauskunft zählt ab dem ersten Tag', folge(tot('2026-11-02')), tot('2026-11-02'))
  erwarte('200 auf erstes404: Vermerk fällt weg', folge({ status: 200, geprueftAm: '2026-11-02' }), { status: 200, geprueftAm: '2026-11-02' })
  erwarte('unklar auf unklar ohne erstes404: kein Vermerk erfunden', (() => {
    const b: Record<string, LinkBefund> = { [NF]: { status: 'unklar', geprueftAm: '2026-10-25' } }
    nimmBefund(b, NF, { status: 'unklar', geprueftAm: '2026-11-02' }, [])
    return b[NF]
  })(), { status: 'unklar', geprueftAm: '2026-11-02' })
  erwarte('5xx auf 200 mit Rest-Vermerk: kein Vermerk übernommen', (() => {
    const b: Record<string, LinkBefund> = { [NF]: { status: 200, geprueftAm: '2026-10-25', erstes404: '2026-10-20' } }
    nimmBefund(b, NF, { status: 503, geprueftAm: '2026-11-02' }, [])
    return b[NF]
  })(), { status: 503, geprueftAm: '2026-11-02' })
  const wartend = zweitesNetflix404({ [NF]: erst, 'https://www.netflix.com/title/2': { status: 'unklar', geprueftAm: '2026-11-02' }, 'https://www.netflix.com/title/3': tot('2026-11-02'), 'https://www.joyn.de/x': erst, 'https://www.netflix.com/title/4': { status: 200, geprueftAm: '2026-11-02', erstes404: '2026-10-01' } })
  erwarte('Vorrang: nur Netflix mit erstem 404', wartend, [NF])
  const haengt = (status: number | string): LinkBefund => ({ status, geprueftAm: '2026-10-25', erstes404: '2026-10-20' })
  erwarte('Vorrang: auch 503 und timeout tragen den Vermerk', zweitesNetflix404({ 'https://www.netflix.com/title/5': haengt(503), 'https://www.netflix.com/title/6': haengt('timeout') }), ['https://www.netflix.com/title/5', 'https://www.netflix.com/title/6'])
  erwarte('hat404: bestätigt, erstes, Nichtauskunft, lebt, nichts', [hat404(tot('2026-11-02')), hat404(erst), hat404({ status: 'unklar' }), hat404({ status: 200 }), hat404(undefined)], [true, true, false, false, false])
  erwarte('hat404: 503 und timeout mit Vermerk zählen, 200 mit Rest-Vermerk nicht', [hat404(haengt(503)), hat404(haengt('timeout')), hat404({ ...haengt(200) })], [true, true, false])
  /* Kette 404 -> Nichtauskunft -> 404: die Frist läuft vom ersten Tag, auch über 503/timeout. */
  erwarte('503 mit Vermerk, 404 nach 13 Tagen: bestätigt', netflixBefund(NF, haengt(503), tot('2026-11-02')), tot('2026-11-02'))
  erwarte('timeout mit Vermerk, 404 nach 2 Tagen: bestätigt', netflixBefund(NF, haengt('timeout'), tot('2026-10-22')), tot('2026-10-22'))
  erwarte('503 mit Vermerk, 404 nach 1 Tag: unklar mit altem Tag', netflixBefund(NF, haengt(503), tot('2026-10-21')), ersterTag('2026-10-21', '2026-10-20'))
  erwarte('503 ohne Vermerk, 404: Frist beginnt neu', netflixBefund(NF, { status: 503, geprueftAm: '2026-10-25' }, tot('2026-11-02')), ersterTag('2026-11-02', '2026-11-02'))
  const kette = (statuses: Array<number | string>, tag: string): LinkBefund | undefined => {
    const b: Record<string, LinkBefund> = { [NF]: alt1 }
    statuses.forEach((s, i) => nimmBefund(b, NF, { status: s, geprueftAm: `2026-10-${26 + i}` }, []))
    nimmBefund(b, NF, tot(tag), [])
    return b[NF]
  }
  erwarte('Kette 503, timeout, unklar, dann 404 nach der Frist: bestätigt', kette([503, 'timeout', 'unklar'], '2026-11-02'), tot('2026-11-02'))
  erwarte('Kette 503, timeout, dann 404: Vermerk überlebt beide Nichtauskünfte', kette([503, 'timeout'], '2026-10-29')?.status, 404)

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
  erwarte('Region (Amazon) zählt als tot', warnt(lauf(20, 5, 'www.amazon.de', 200, 'region')), 1)
  erwarte('503 ist keine Auskunft und kein Wechsel (404 -> 503)', warnt(lauf(20, 20, 'www.netflix.com', 404, 503)), 0)
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
console.log(`check-netflix-zweites-404: ${pruefungen} Fälle — einzelnes Netflix-404 lässt den Weg stehen, zweites nach 2 Tagen entfernt ihn nur ohne belegtes Deutsch, mehr als 10 % Wechsel je Plattform warnt.`)
