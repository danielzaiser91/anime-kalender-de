/**
 * Zusicherung: **Eine Prime-Meldung legt keinen Weg zu einer Adresse an, die irgendein Handbeleg verneint** (19.10.2026).
 * Anlass: „Date A Live" (15583) hat drei Nein-Belege (B0C7LZHHTH, B0C7LZCS5H, B0CZS6FBVY); `checks` hält je Titel nur den letzten,
 * die Meldung zu B0C7LZCS5H legte den in 09-2 entfernten Weg neu an (Bestandsbau 39249344862, check:handbelege rot).
 * Fährt den Prime-Schritt der Bauphase 9 gegen eine Kulisse (`AK_ROOT`) und liest die Prime-Verweise ab. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-nein-beleg-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`

const nein = (id: number, asin: string) => `- anilistId: ${id}
  platform: primevideo
  url: ${dp(asin)}
  dub: false
  checkedAt: '2026-08-28'
  note: "Amazon-Seite ${asin}: alle 12 Folgen geprüft, Abos: keine Angabe"
`
const ja = (id: number, asin: string) => `- anilistId: ${id}
  platform: primevideo
  url: ${dp(asin)}
  dub: true
  checkedAt: '2026-08-28'
  note: "Tonspuren: Deutsch — Amazon-Seite ${asin}: alle 12 Folgen geprüft, Abos: Prime"
`

const weg = (id: number, asin: string, plattform = 'primevideo') => `- anilistId: ${id}
  platform: ${plattform}
  url: ${dp(asin)}
  available: false
  checkedAt: '2026-08-28'
`

interface Fall {
  id: number
  name: string
  /** Handbelege des Titels in Dateireihenfolge — der letzte landet in `checks`. */
  belege: string
  /** Adresse, zu der gemeldet wird. */
  meldung: string
  erwartetWege: number
}
const faelle: Fall[] = [
  {
    id: 15583,
    name: 'Date A Live: Meldung zu einem früheren von drei Nein-Belegen (echter Anlassfall)',
    belege: nein(15583, 'B0C7LZCS5H') + nein(15583, 'B0C7LZHHTH') + nein(15583, 'B0CZS6FBVY'),
    meldung: 'B0C7LZCS5H',
    erwartetWege: 0,
  },
  {
    id: 900001,
    name: 'Meldung zum mittleren von drei Nein-Belegen',
    belege: nein(900001, 'B0AAAAAAA1') + nein(900001, 'B0AAAAAAA2') + nein(900001, 'B0AAAAAAA3'),
    meldung: 'B0AAAAAAA2',
    erwartetWege: 0,
  },
  {
    id: 900002,
    name: 'Meldung zu einer Adresse ohne Beleg: Weg wird angelegt (kein Plattform-Nein)',
    belege: nein(900002, 'B0BBBBBBB1') + nein(900002, 'B0BBBBBBB3'),
    meldung: 'B0BBBBBBB2',
    erwartetWege: 1,
  },
  {
    id: 900003,
    name: 'zwei Ausgaben, Ja und Nein: Meldung zur Ja-Seite legt den Weg an',
    belege: ja(900003, 'B0CCCCCCC1') + nein(900003, 'B0CCCCCCC2'),
    meldung: 'B0CCCCCCC1',
    erwartetWege: 1,
  },
  {
    id: 900004,
    name: 'Nein als "nicht verfügbar" (available: false) zählt wie dub: false',
    belege: weg(900004, 'B0DDDDDDD1') + nein(900004, 'B0DDDDDDD2') + nein(900004, 'B0DDDDDDD3'),
    meldung: 'B0DDDDDDD1',
    erwartetWege: 0,
  },
  {
    id: 900005,
    name: 'Nein einer anderen Plattform mit derselben Adresse sperrt Prime nicht',
    belege: weg(900005, 'B0EEEEEEE1', 'disneyplus') + nein(900005, 'B0EEEEEEE2'),
    meldung: 'B0EEEEEEE1',
    erwartetWege: 1,
  },
]

const fehler: string[] = []
try {
  schreibe('data/dub-confirmed.yaml', faelle.map((f) => f.belege).join(''))
  const zugeordnet: Record<string, unknown> = {}
  for (const f of faelle) {
    zugeordnet[`${dp(f.meldung)}#0`] = {
      titleId: f.id,
      plattform: 'primevideo',
      asin: f.meldung,
      folgen: [{ unsere: 1, sprachen: ['Deutsch', 'Japanisch'] }],
    }
  }
  schreibe('data/prime-zugeordnet.json', JSON.stringify(zugeordnet))
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()
  const titles = new Map<number, Title>(faelle.map((f) => [f.id, { id: f.id, slug: `nein-${f.id}`, streams: [] } as unknown as Title]))
  uebernehmePrimeUndCrVorschlaege({
    titles,
    checks: new Map(alleChecks.map((c) => [dubKey(c.anilistId, c.platform), c])),
    alleChecks,
    lautPruefungTot: () => false,
    tmdbTitles: {},
    ytKanal: {},
    zugangJeAdresse: new Map(),
    joynZugang: new Map(),
    ytKauf: new Set(),
    geprueft: 0,
    entfernt: 0,
    ytAusTonspur: 0,
    adressen: 0,
    totEntfernt: 0,
    ytEntfernt: 0,
    linkBefunde: {},
    checksJePlattform: new Map(),
    anisearch: {},
    belegFuer: () => undefined,
  })
  for (const f of faelle) {
    const wege = titles.get(f.id)!.streams.filter((s) => s.platform === 'primevideo')
    if (wege.length !== f.erwartetWege) fehler.push(`${f.name}: ${wege.length} Weg(e), erwartet ${f.erwartetWege}`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-nein-beleg:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prime-nein-beleg: ${faelle.length} Fälle ok.`)
