/**
 * Zusicherung: **`data/prime-zugeordnet.json` wird nur über `leseZugeordnet` gelesen und geschrieben; eine von Hand gesperrte Seite
 * (`data/belege-entfernt.yaml`) zählt dort für keinen Leser** (19.10.2026, PR 1612 R4).
 * Anlass: Der Zuordner schreibt die Datei per `{...bisher, ...zugeordnet}`; eine wieder angelegte Zeile B0GVJFZD1W→20605 wäre in
 * `09-3` gesperrt, in `09-7` (geteilte Seiten) aber weiter gezählt worden. Fährt den echten Zuordner-Abschluss und `09-7` gegen eine Kulisse
 * (`AK_ROOT`). Läuft in `check:logic`. `09-3` deckt `check-prime-seiten-sperre.ts`; `11-6`/`cartoon-jw-seite` lesen über dieselbe Funktion (Lücke: ohne eigenen Fall).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-zugeordnet-lader-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const gp = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const SPERRE = 'B0SPERRE01'
const GESPERRT = 900031
const FREI = 900032
const folgen = Array.from({ length: 12 }, (_, i) => ({ unsere: i + 1, sprachen: ['Deutsch', 'Japanisch'] }))
const meldung = (titleId: number, asin: string) => ({ titleId, plattform: 'primevideo', seite: SPERRE, asin, folgen })

const fehler: string[] = []
try {
  schreibe('data/dub-confirmed.yaml', '[]\n')
  schreibe('public/data/cartoons.json', '[]')
  schreibe('public/data/ohne-synchro.json', '[]')
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  schreibe('data/belege-entfernt.yaml', JSON.stringify([{ anilistId: GESPERRT, url: `https://www.amazon.de/dp/${SPERRE}`, grund: 'Sperre', entferntAm: '2026-10-29' }]))
  schreibe('data/prime-zugeordnet.json', JSON.stringify({ [`${gp('B0ALTALT01')}#2`]: meldung(GESPERRT, 'B0ALTALT01') }))

  // Schreibweg: der Zuordner legt die gesperrte Zeile neu an (und eine freie Zeile desselben Laufs).
  const { schliesseRohfolgenAb } = await import('./lib/rohfolgen-abschluss.ts')
  schliesseRohfolgenAb({
    zugeordnet: { [`${gp(SPERRE)}#4`]: meldung(GESPERRT, 'B0NEUNEU01'), [`${gp(SPERRE)}#6`]: meldung(FREI, 'B0NEUNEU02') } as never,
    kanalWeg: [],
    offen: [],
    erledigt: [],
    veraltet: [],
    zaehler: { ueberFolgentitel: 0, uebersprungenStaffel: 0, ohneFolgenzuordnung: 0 },
  })
  const danach = JSON.parse(readFileSync(join(kulisse, 'data/prime-zugeordnet.json'), 'utf8')) as Record<string, { titleId: number }>
  const ids = Object.values(danach).map((m) => m.titleId)
  if (ids.includes(GESPERRT)) fehler.push(`Zuordner schrieb die gesperrte Zeile für ${GESPERRT} zurück`)
  if (!ids.includes(FREI)) fehler.push(`Kontrolle: die freie Zeile für ${FREI} fehlt nach dem Zuordner`)

  // Leseweg 09-7: dieselbe Datei, mit der gesperrten Zeile von Hand zurückgelegt — der Leser darf sie nicht zählen.
  schreibe('data/prime-zugeordnet.json', JSON.stringify({ [`${gp(SPERRE)}#4`]: meldung(GESPERRT, 'B0NEUNEU01'), [`${gp(SPERRE)}#6`]: meldung(FREI, 'B0NEUNEU02') }))
  const { setzePrimeTeilseiten } = await import('./bau/09-7-prime-teilseiten.ts')
  const titles = new Map<number, Title>(
    [GESPERRT, FREI].map((id) => [
      id,
      {
        id,
        slug: `lader-${id}`,
        episodes: 12,
        streams: [{ platform: 'primevideo', url: gp(SPERRE), dub: true, sharedWith: [GESPERRT, FREI].filter((x) => x !== id) }],
      } as unknown as Title,
    ]),
  )
  setzePrimeTeilseiten(titles, kulisse)
  const bereich = (id: number) => titles.get(id)!.streams[0]!.dubRanges?.length ?? 0
  if (bereich(GESPERRT) !== 0) fehler.push(`09-7 zählte die gesperrte Meldung für ${GESPERRT}: ${bereich(GESPERRT)} Bereich(e)`)
  if (bereich(FREI) === 0) fehler.push(`Kontrolle: 09-7 setzte für ${FREI} keinen Bereich`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-zugeordnet-lader:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log('check-prime-zugeordnet-lader: 4 Fälle ok.')
