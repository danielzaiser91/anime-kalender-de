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
    }),
  )
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')
  const { linkBefunde } = werteLinkpruefungAus({
    ytKanal: {},
    ytKauf: new Set(),
    titles: new Map<number, Title>(),
    netflixOhneKennung: 0,
    checksJePlattform: new Map(),
    youtubeBefunde: {},
    belegFuer: () => undefined,
    vonHandBelegtAm: new Map(),
    checks: new Map(),
  })
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
