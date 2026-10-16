/**
 * Zusicherung: **Ob Deutsch auf einer Prime-Seite zählt, entscheidet die gelesene Seite, nicht die Prüflisten-Adresse** (16.10.2026).
 * Fährt den Prime-Schritt der Bauphase 9 (`uebernehmePrimeUndCrVorschlaege`) gegen eine Kulisse (`AK_ROOT`) mit erfundenen Titeln und liest an ihren Prime-Verweisen ab,
 * ob das Häkchen gesetzt wird. Fälle: Seite ≠ Adresse, gemischte Kanal-Seite (JoJo B0CH1GVRKK, 19 von 20 Folgen Deutsch), Suchadresse,
 * Eintrag ohne gelesene Seite. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'kanal-je-seite-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}

const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const suche = (wort: string) => `https://www.amazon.de/s?k=${wort}&i=instant-video`
const KANAL = 'Abos: aniversede, ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'

/** Ein Titel mit Kanal-Ja auf `asin` und einem jüngeren Nein auf einer anderen Adresse (sonst überspringt der Bau die Adresse des letzten Belegs). */
function belege(id: number, asin: string, kanalUrl: string, kaufSeite?: string, spaetesJa?: boolean): string {
  const spaet = spaetesJa ? `- anilistId: ${id}
  platform: primevideo
  url: ${kanalUrl}
  dub: true
  checkedAt: '2026-10-01'
  zweiteQuelle: JustWatch
` : ''
  const kauf = kaufSeite ? `- anilistId: ${id}
  platform: primevideo
  url: ${dp(kaufSeite)}
  dub: false
  checkedAt: '2026-09-30'
  note: "Tonspuren: Deutsch — Amazon-Seite ${kaufSeite}: Kauf ohne Deutsch, Abos: Prime"
` : ''
  return kauf + `- anilistId: ${id}
  platform: primevideo
  url: ${kanalUrl}
  dub: true
  checkedAt: '2026-10-01'
  note: "Tonspuren: Deutsch — Amazon-Seite ${asin}: alle 20 Folgen geprüft, ${KANAL}"
` + spaet + `
- anilistId: ${id}
  platform: primevideo
  url: ${dp('B0FREMDEND')}
  dub: false
  checkedAt: '2026-10-02'
`
}

const folgen = (anzahl: number, davonDeutsch: number) =>
  Array.from({ length: anzahl }, (_, i) => ({ unsere: i + 1, sprachen: i < davonDeutsch ? ['Deutsch', 'Japanisch'] : ['Japanisch'] }))

interface Fall {
  id: number
  name: string
  kanalSeite: string
  /** Adresse des Kanal-Belegs, wenn sie nicht die der Kanal-Seite ist. */
  kanalUrl?: string
  /** Ein Nein ohne Kanal-Warnung zur gelesenen Seite: Es darf nie als Kanal zählen. */
  kaufSeite?: string
  /** Das Kanal-Ja wurde später durch ein echtes Ja (zweite Quelle) abgelöst: Die Seite ist dann Deutsch. */
  spaetesJa?: boolean
  url: string
  seite: string | null
  de: number
  von: number
  erwartet: boolean
}
const faelle: Fall[] = [
  { id: 9001, name: 'Seite ≠ Adresse, Seite ohne Kanal-Beleg: Deutsch zählt', kanalSeite: 'B0KANALAAA', kaufSeite: 'B0ANDERSEE', url: dp('B0KANALAAA'), seite: 'B0ANDERSEE', de: 4, von: 4, erwartet: true },
  { id: 9002, name: 'Kanal-Seite unter eigener Adresse: kein Häkchen', kanalSeite: 'B0KANALBBB', url: dp('B0KANALBBB'), seite: 'B0KANALBBB', de: 4, von: 4, erwartet: false },
  { id: 9003, name: 'gemischte Kanal-Seite (19 von 20): kein Häkchen', kanalSeite: 'B0CH1GVRKK', kanalUrl: dp('B0CG7S59KL'), url: dp('B0CG7S59KL'), seite: 'B0CH1GVRKK', de: 19, von: 20, erwartet: false },
  { id: 9004, name: 'Suchadresse, gelesene Seite ohne Kanal: Deutsch zählt', kanalSeite: 'B0KANALCCC', url: suche('eins'), seite: 'B0ANDERSEE', de: 3, von: 3, erwartet: true },
  { id: 9005, name: 'Suchadresse, gelesene Seite ist Kanal: kein Häkchen', kanalSeite: 'B0KANALDDD', url: suche('zwei'), seite: 'B0KANALDDD', de: 3, von: 3, erwartet: false },
  { id: 9006, name: 'ohne gelesene Seite zählt die Kanal-Adresse', kanalSeite: 'B0KANALEEE', url: dp('B0KANALEEE'), seite: null, de: 3, von: 3, erwartet: false },
  { id: 9007, name: 'ohne gelesene Seite zählt eine Suchadresse nie als Kanal', kanalSeite: 'B0KANALFFF', kanalUrl: suche('drei'), url: suche('drei'), seite: null, de: 3, von: 3, erwartet: true },
  { id: 9008, name: 'Kanal-Ja durch echtes Ja abgelöst: Deutsch zählt', kanalSeite: 'B0KANALGGG', spaetesJa: true, url: dp('B0KANALGGG'), seite: 'B0KANALGGG', de: 3, von: 3, erwartet: true },
]

/** Netflix und Disney+ melden Sprachen als „de|Deutsch“ bzw. „de“, Disney+ ohne `/de-de/` (16.10.2026): derselbe Weg wie bei Prime, nie ein zweiter für dieselbe Seite. */
const DIS = 'https://www.disneyplus.com/de-de/browse/entity-aaaa'
const andere = [
  { id: 9101, plattform: 'netflix', url: 'https://www.netflix.com/title/91010', sprachen: ['de|Deutsch', 'ja|Japanisch [Original]'], vorhanden: [] as string[], erwartetWege: 1, erwartetDub: true },
  { id: 9102, plattform: 'disneyplus', url: 'https://www.disneyplus.com/browse/entity-bbbb', sprachen: ['de', 'ja'], vorhanden: [] as string[], erwartetWege: 1, erwartetDub: true },
  { id: 9103, plattform: 'disneyplus', url: 'https://www.disneyplus.com/browse/entity-aaaa', sprachen: ['de'], vorhanden: [DIS], erwartetWege: 1, erwartetDub: true },
  { id: 9104, plattform: 'netflix', url: 'https://www.netflix.com/title/91040', sprachen: ['ja|Japanisch [Original]'], vorhanden: [] as string[], erwartetWege: 0, erwartetDub: false },
]

const fehler: string[] = []
try {
  schreibe('data/dub-confirmed.yaml', faelle.map((f) => belege(f.id, f.kanalSeite, f.kanalUrl ?? dp(f.kanalSeite), f.kaufSeite, f.spaetesJa)).join(''))
  const zugeordnet: Record<string, unknown> = {}
  for (const f of faelle) {
    zugeordnet[`${f.url}#0`] = { titleId: f.id, plattform: 'primevideo', asin: 'B0EPISODE01', seite: f.seite ?? undefined, folgen: folgen(f.von, f.de) }
  }
  for (const a of andere) zugeordnet[`${a.url}#0`] = { titleId: a.id, plattform: a.plattform, asin: null, folgen: [{ unsere: 1, sprachen: a.sprachen }] }
  schreibe('data/prime-zugeordnet.json', JSON.stringify(zugeordnet))
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()
  const titles = new Map<number, Title>(faelle.map((f) => [f.id, { id: f.id, slug: `kanal-${f.id}`, streams: [] } as unknown as Title]))
  for (const a of andere) {
    const streams = a.vorhanden.map((url) => ({ platform: a.plattform, url }))
    titles.set(a.id, { id: a.id, slug: `andere-${a.id}`, streams } as unknown as Title)
  }
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
    const prime = titles.get(f.id)!.streams.filter((s) => s.platform === 'primevideo')
    const haken = prime.some((s) => s.dub === true)
    if (!prime.length) fehler.push(`${f.name}: gar kein Prime-Verweis angelegt (Kulisse greift nicht)`)
    else if (haken !== f.erwartet) fehler.push(`${f.name}: Häkchen ${haken}, erwartet ${f.erwartet}`)
  }
  for (const a of andere) {
    const wege = titles.get(a.id)!.streams.filter((s) => s.platform === a.plattform)
    if (wege.length !== a.erwartetWege) fehler.push(`${a.plattform} ${a.id}: ${wege.length} Weg(e), erwartet ${a.erwartetWege}`)
    else if (wege.some((s) => s.dub === true) !== a.erwartetDub) fehler.push(`${a.plattform} ${a.id}: Häkchen ${!a.erwartetDub}, erwartet ${a.erwartetDub}`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-kanal-je-seite:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-je-seite: ${faelle.length + andere.length} Fälle ok.`)
