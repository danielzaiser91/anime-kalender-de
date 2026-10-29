/**
 * Riegel am Zuordner (29.10.2026): `schliesseRohfolgenAb` legt keine Zuordnung an eine Adresse, die ein Handbeleg einer anderen
 * Kennung oder ein Cartoon führt; sie kommt als offen mit Grund in `prime-unzugeordnet.json`. Fährt den echten Abschluss gegen
 * eine Kulisse (`AK_ROOT`), dazu die Trennung mit den fünf echten Adressen vom 29.10.2026 (Kulipari, Grisaia). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const kulisse = mkdtempSync(join(tmpdir(), 'zuordner-riegel-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const lies = <T>(datei: string): T => JSON.parse(readFileSync(join(kulisse, 'data', datei), 'utf8')) as T
const gp = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const KULIPARI = 'https://www.netflix.com/title/80057610'
const FREMD_SEITE = gp('B0DMMT9B67')
const EIGEN_SEITE = gp('B0EIGEN001')
const folgen = (n: number) => Array.from({ length: n }, (_, i) => ({ unsere: i + 1, sprachen: ['Deutsch'] }))
const prime = (titleId: number, seite: string, n: number) => ({ titleId, plattform: 'primevideo', seite, asin: null, folgen: folgen(n) })
const netflix = (titleId: number, n: number) => ({ titleId, plattform: 'netflix', asin: null, folgen: folgen(n) })

let faelle = 0
const fehler: string[] = []
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (!ok) fehler.push(`${name}${ist === undefined ? '' : ` ${JSON.stringify(ist)}`}`)
}

try {
  schreibe('data/dub-confirmed.yaml', `- anilistId: 145740\n  url: ${FREMD_SEITE}\n- anilistId: 900001\n  url: ${EIGEN_SEITE}\n`)
  schreibe('public/data/cartoons.json', JSON.stringify([{ id: -74222, streams: [{ url: KULIPARI }] }]))
  schreibe('public/data/ohne-synchro.json', '[]')
  schreibe('data/prime-zugeordnet.json', JSON.stringify({ [gp('B0ALTBEST1')]: prime(900005, 'B0ALTBEST1', 3) }))

  const { schliesseRohfolgenAb } = await import('./lib/rohfolgen-abschluss.ts')
  const offen = [{ url: 'https://x.test/schon-offen', titel: 'Schon offen', grund: 'g', folgen: 1 }]
  schliesseRohfolgenAb({
    zugeordnet: {
      // Container-Schlüssel (#0): es zählt die Seite, nicht der Schlüssel.
      [`${gp('B0CONTAIN1')}#0`]: prime(900002, 'B0DMMT9B67', 12),
      [`${gp('B0CONTAIN1')}#1`]: prime(900002, 'B0DMMT9B67', 5),
      [`${KULIPARI}#0`]: netflix(900003, 4),
      [EIGEN_SEITE]: prime(900001, 'B0EIGEN001', 12),
      [`${gp('B0NEUNEU01')}#0`]: prime(900004, 'B0NEUNEU01', 7),
      [FREMD_SEITE]: prime(145740, 'B0DMMT9B67', 12),
    } as never,
    kanalWeg: [],
    offen,
    erledigt: [],
    veraltet: [],
    zaehler: { ueberFolgentitel: 0, uebersprungenStaffel: 0, ohneFolgenzuordnung: 0 },
  })
  const zugeordnet = lies<Record<string, { titleId: number }>>('prime-zugeordnet.json')
  const unzugeordnet = lies<{ url: string; grund: string; folgen: number }[]>('prime-unzugeordnet.json')
  const ids = Object.values(zugeordnet).map((z) => z.titleId)
  pruefe('fremde Prime-Adresse (Container #0/#1, Seite zählt) nicht zugeordnet', !ids.includes(900002), zugeordnet)
  pruefe('fremde Netflix-Adresse eines Cartoons nicht zugeordnet', !ids.includes(900003), zugeordnet)
  pruefe('Gegenfall: eigene Handbeleg-Adresse zugeordnet', ids.includes(900001), zugeordnet)
  pruefe('Gegenfall: Adresse ohne Besitzer zugeordnet', ids.includes(900004), zugeordnet)
  pruefe('Gegenfall: Adresse des Handbelegs derselben Kennung zugeordnet', ids.includes(145740), zugeordnet)
  pruefe('Bestand bleibt stehen', ids.includes(900005), zugeordnet)
  const container = unzugeordnet.find((o) => o.url === gp('B0CONTAIN1'))
  pruefe('Container: eine offene Zeile mit beiden Folgenzahlen und Grund', unzugeordnet.filter((o) => o.url === gp('B0CONTAIN1')).length === 1 && container?.folgen === 17 && container.grund.includes('Handbeleg:145740') && container.grund.includes('900002'), unzugeordnet)
  pruefe('Cartoon-Seite offen mit Besitzer', !!unzugeordnet.find((o) => o.url === KULIPARI)?.grund.includes('cartoons.json:-74222'), unzugeordnet)
  pruefe('bisher Offenes bleibt', unzugeordnet.some((o) => o.url === 'https://x.test/schon-offen'), unzugeordnet)
  pruefe('genau drei offene Zeilen', unzugeordnet.length === 3, unzugeordnet)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-zuordner-riegel:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-zuordner-riegel: ${faelle} Fälle ok.`)
