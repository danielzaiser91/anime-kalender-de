/**
 * Zusicherung: **Die geteilte Prime-Seite kennt eine Kanal-Seite auch dann, wenn nur die Merkliste sie nennt** (Prüfer 1613 R3, A2).
 * Fährt `setzePrimeTeilseiten` gegen eine Kulisse (`AK_ROOT`) ohne Handbeleg: Steht die Seite in `data/kanal-seiten.json`, bekommt der
 * Titel keinen Folgenbereich (Kanal-Titel, Prüfliste); fehlt die Merkliste, bekommt er ihn aus der Meldung. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-teilseiten-kanal-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const URL_SEITE = 'https://www.amazon.de/dp/B0TEILKAN1'
const folgen = Array.from({ length: 4 }, (_, i) => ({ unsere: i + 1, sprachen: ['Deutsch', 'Japanisch'] }))

function titel(id: number): Title {
  const stream = { platform: 'primevideo', url: URL_SEITE, dub: true, sharedWith: [9301, 9302] }
  return { id, slug: `teil-${id}`, episodes: 4, streams: [stream] } as unknown as Title
}

/** Ein Lauf; liefert je Titel, ob er einen Folgenbereich bekam. */
async function baue(): Promise<Map<number, boolean>> {
  const { setzePrimeTeilseiten } = await import('./bau/09-7-prime-teilseiten.ts')
  const titles = new Map<number, Title>([9301, 9302].map((id) => [id, titel(id)]))
  setzePrimeTeilseiten(titles, kulisse)
  return new Map([...titles].map(([id, t]) => [id, !!t.streams[0].dubRanges?.length]))
}

const fehler: string[] = []
try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  schreibe('data/dub-confirmed.yaml', '')
  schreibe('data/prime-zugeordnet.json', JSON.stringify({ [`${URL_SEITE}#0`]: { titleId: 9301, plattform: 'primevideo', asin: 'B0EPISODE01', seite: 'B0TEILKAN1', folgen } }))
  const merkEintrag = { anilistId: 9301, platform: 'primevideo', url: URL_SEITE, checkedAt: '', note: 'Amazon-Seite B0TEILKAN1 — ACHTUNG: Kanal-Titel', kanalOhneBeleg: true }
  schreibe('data/kanal-seiten.json', JSON.stringify([merkEintrag]))
  const mit = await baue()
  rmSync(join(kulisse, 'data/kanal-seiten.json'))
  const ohne = await baue()
  if (mit.get(9301) !== false) fehler.push(`Kanal-Seite nur in der Merkliste: Titel bekam Bereich (${mit.get(9301)})`)
  if (ohne.get(9301) !== true) fehler.push(`ohne Merkliste müsste die Meldung den Bereich geben (Kulisse greift nicht), war ${ohne.get(9301)}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-teilseiten-kanal:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log('check-prime-teilseiten-kanal: Kanal-Seite aus der Merkliste und ohne sie ok.')
