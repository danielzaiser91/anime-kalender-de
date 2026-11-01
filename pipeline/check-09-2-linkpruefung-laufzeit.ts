/**
 * Zusicherung: **Die Bauphase 09-2 (`werteLinkpruefungAus`) findet den Linkbefund einer Seite über ihre Kennung** — als Lauf gegen
 * eine Kulisse (`AK_ROOT`), nicht als Textsuche im Quelltext. Ersetzt in `check-logic.ts` die Zusicherung „linkBefunde fällt auf den
 * Befund derselben Seite zurück" (Haikyu!! Karasuno vs. Shiratorizawa, 21.09.2026; The Dragon Dentist, 29.09.2026: `/dp/` gemessen
 * 20.09. mit 200, `/gp/video/detail/` am 28.09. als „region" — es zählt der jüngste). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'linkpruefung-laufzeit-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const video = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '# leer\n')
  writeFileSync(
    join(kulisse, 'data/link-check.json'),
    JSON.stringify({
      /* Nur unter der Video-Adresse gemessen (Haikyu!!). */
      [video('B0NURVIDEO')]: { status: 'region', geprueftAm: '2026-09-20' },
      /* Beide Formen gemessen, die jüngere ist die Video-Adresse (Dragon Dentist). */
      [dp('B0JUENGERV')]: { status: 200, geprueftAm: '2026-09-20' },
      [video('B0JUENGERV')]: { status: 'region', geprueftAm: '2026-09-28' },
      /* Beide Formen gemessen, die jüngere ist die dp-Adresse. */
      [dp('B0JUENGERD')]: { status: 404, geprueftAm: '2026-09-28' },
      [video('B0JUENGERD')]: { status: 200, geprueftAm: '2026-09-20' },
      'https://example.org/nur-eine-form': { status: 200, geprueftAm: '2026-09-20' },
      /* Handprüfung gegen 404/region (Fairy Tail, 22.09.2026): je Adresse ein Fall. */
      [dp('B0HANDNONE')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0HANDNEWER')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0HANDOLDER')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0HANDGLEICH')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0HANDREGION')]: { status: 'region', geprueftAm: '2026-09-20' },
      [dp('B0HANDFREMD')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0VERWEIS')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0VERWEISALT')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0LAHM')]: { status: 'timeout', geprueftAm: '2026-09-20' },
      [dp('B0VERWEISGLEICH')]: { status: 404, geprueftAm: '2026-09-20' },
      [dp('B0REGIONNONE')]: { status: 'region', geprueftAm: '2026-09-20' },
    }),
  )
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')
  const { adressKern } = await import('./lib/dub-confirmed.ts')
  const handFaelle: [number, string][] = [
    [1, 'B0HANDNONE'],
    [2, 'B0HANDNEWER'],
    [3, 'B0HANDOLDER'],
    [4, 'B0HANDGLEICH'],
    [5, 'B0HANDREGION'],
    [6, 'B0HANDFREMD'],
    [7, 'B0VERWEIS'],
    [8, 'B0VERWEISALT'],
    [9, 'B0LAHM'],
    [10, 'B0REGIONNONE'],
    [11, 'B0VERWEISGLEICH'],
  ]
  const hand = new Map<number, Title>(
    handFaelle.map(([id, asin]) => [id, { id, streams: [{ platform: 'primevideo', url: dp(asin) }] } as unknown as Title]),
  )
  const beleg = (asin: string, checkedAt: string, url = dp(asin)) => ({ url, checkedAt, dub: true })
  const belege: Record<number, ReturnType<typeof beleg>> = {
    2: beleg('B0HANDNEWER', '2026-09-22'),
    3: beleg('B0HANDOLDER', '2026-09-18'),
    4: beleg('B0HANDGLEICH', '2026-09-20'),
    5: beleg('B0HANDREGION', '2026-09-22'),
    6: beleg('B0HANDFREMD', '2026-09-22', dp('B0ANDERE')),
  }
  const { linkBefunde } = werteLinkpruefungAus({
    ytKanal: {},
    ytKauf: new Set(),
    titles: hand,
    netflixOhneKennung: 0,
    checksJePlattform: new Map(),
    youtubeBefunde: {},
    belegFuer: (id) => belege[id] as never,
    vonHandBelegtAm: new Map([
      [adressKern(dp('B0VERWEIS')), '2026-09-22'],
      [adressKern(dp('B0VERWEISALT')), '2026-09-18'],
      [adressKern(dp('B0VERWEISGLEICH')), '2026-09-20'],
    ]),
    checks: new Map(),
    vorherTitles: [],
  })
  const bleibt = (id: number) => (hand.get(id)?.streams.length ?? 0) === 1
  erwarte('404 ohne Handprüfung: der Weg fällt weg', bleibt(1), false)
  erwarte('404, Beleg derselben Adresse jünger: der Weg bleibt', bleibt(2), true)
  erwarte('404, Beleg älter als der Befund: der Weg fällt weg', bleibt(3), false)
  erwarte('404, Beleg am selben Tag wie der Befund: der Weg fällt weg', bleibt(4), false)
  erwarte('region, Beleg jünger: der Weg bleibt', bleibt(5), true)
  erwarte('404, jüngerer Beleg gilt einer anderen Adresse: der Weg fällt weg', bleibt(6), false)
  erwarte('404, von Hand bestätigter Weg jünger: der Weg bleibt', bleibt(7), true)
  erwarte('404, von Hand bestätigter Weg älter: der Weg fällt weg', bleibt(8), false)
  erwarte('Zeitüberschreitung ist kein Grund zu entfernen', bleibt(9), true)
  erwarte('region ohne Handprüfung: der Weg fällt weg', bleibt(10), false)
  erwarte('404, von Hand bestätigter Weg am selben Tag: der Weg fällt weg', bleibt(11), false)
  erwarte('nur die Video-Adresse gemessen: die dp-Adresse findet den Befund', linkBefunde[dp('B0NURVIDEO')]?.status, 'region')
  erwarte('… und die Video-Adresse selbst ebenso', linkBefunde[video('B0NURVIDEO')]?.status, 'region')
  erwarte('beide gemessen, Video jünger: die dp-Adresse sieht den jüngeren Befund', linkBefunde[dp('B0JUENGERV')]?.status, 'region')
  erwarte('beide gemessen, Video jünger: die Video-Adresse sieht ihn ebenfalls', linkBefunde[video('B0JUENGERV')]?.status, 'region')
  erwarte('beide gemessen, dp jünger: die Video-Adresse sieht den jüngeren Befund', linkBefunde[video('B0JUENGERD')]?.status, 404)
  erwarte('eine Adresse ohne Befund bleibt ohne', linkBefunde[dp('B0UNBEKANNT')]?.status, undefined)
  erwarte('eine Adresse in nur einer Form bleibt unverändert', linkBefunde['https://example.org/nur-eine-form']?.status, 200)
  erwarte('ein Symbol-Schlüssel findet nichts', (linkBefunde as unknown as Record<symbol, unknown>)[Symbol('x')], undefined)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-09-2-linkpruefung-laufzeit:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-09-2-linkpruefung-laufzeit: ${pruefungen} Prüfungen ok.`)
