/**
 * Zusicherung: **Eine Prime-Meldung legt keinen Weg an einer Seite an, die `data/belege-entfernt.yaml` für diesen Titel sperrt** (19.10.2026).
 * Anlass: Seite B0GVJFZD1W gehört zu Tokyo Ghoul:re, hing aber an Tokyo Ghoul (20605); kein Handbeleg eines anderen Titels sperrte sie
 * (`adresseFremdBelegt` greift erst mit Beleg). Fährt den Prime-Schritt der Bauphase 9 gegen eine Kulisse (`AK_ROOT`). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-seiten-sperre-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const gp = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const SPERRE = 'B0SPERRE01'
const FREI = 'B0FREIFREI'

const faelle = [
  { id: 900021, name: 'gesperrte Seite dieses Titels: kein Weg', schluessel: `${gp('B0CONTAIN1')}#2`, seite: SPERRE, erwartet: 0 },
  { id: 900022, name: 'Kontrolle: dieselbe Seite bei einem anderen Titel', schluessel: `${gp('B0CONTAIN2')}#2`, seite: SPERRE, erwartet: 1 },
  { id: 900021 + 100, name: 'Kontrolle: andere Seite desselben Titels', schluessel: `${gp('B0CONTAIN3')}#2`, seite: FREI, erwartet: 1 },
  { id: 900023, name: 'gesperrter Container im Schlüssel, Teilseite anders', schluessel: `${gp(SPERRE)}#4`, seite: FREI, erwartet: 0 },
  { id: 900024, name: 'Kontrolle: derselbe Container bei einem anderen Titel', schluessel: `${gp(SPERRE)}#5`, seite: FREI, erwartet: 1 },
]

const fehler: string[] = []
try {
  schreibe('data/dub-confirmed.yaml', '[]\n')
  schreibe('data/belege-entfernt.yaml', JSON.stringify([900021, 900023].map((anilistId) => ({ anilistId, url: gp(SPERRE), grund: 'Sperre', entferntAm: '2026-10-29' }))))
  const zugeordnet: Record<string, unknown> = {}
  for (const f of faelle) {
    zugeordnet[f.schluessel] = {
      titleId: f.id,
      plattform: 'primevideo',
      seite: f.seite,
      asin: f.seite,
      folgen: [{ unsere: 1, sprachen: ['Deutsch', 'Japanisch'] }],
    }
  }
  schreibe('data/prime-zugeordnet.json', JSON.stringify(zugeordnet))
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()
  const titles = new Map<number, Title>(
    faelle.map((f) => [f.id, { id: f.id, slug: `sperre-${f.id}`, streams: [] } as unknown as Title]),
  )
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
    if (wege.length !== f.erwartet) fehler.push(`${f.name}: ${wege.length} Weg(e), erwartet ${f.erwartet}`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-seiten-sperre:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prime-seiten-sperre: ${faelle.length} Fälle ok.`)
