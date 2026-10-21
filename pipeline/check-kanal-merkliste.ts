/**
 * Zusicherung: **Das Ergebnis des Baus hängt nicht davon ab, ob der Kanal-Handbeleg im Lauf ankam** (19.10.2026, Issue #1601).
 * Fährt den Prime-Schritt der Bauphase 9 (`uebernehmePrimeUndCrVorschlaege`) gegen eine Kulisse (`AK_ROOT`) in drei Welten:
 * A mit dem Kanal-Handbeleg (9203: inzwischen mit zweiter Quelle, die Merkliste nennt die Seite noch), B ohne ihn (zurückgestellt) aber mit `data/kanal-seiten.json`, C ohne beides (der Zustand vor dem Fix).
 * A und B müssen dasselbe Häkchen ergeben (kein Deutsch auf der Kanal-Seite), C zeigt, dass die Merkliste es trägt. Dazu der Schreibweg:
 * `schreibeBelege()` legt die Merkliste an, ein zweiter Lauf ändert nichts. Läuft in `check:logic`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'kanal-merkliste-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const KANAL = 'Abos: crunchyrollde, ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'

interface Fall {
  id: number
  name: string
  /** Seite, auf der die Rohfolgen gelesen wurden. */
  seite: string
  /** Hat der Titel einen Kanal-Handbeleg für diese Seite? */
  kanal: boolean
  /** Mit zweiter Quelle: Der Handbeleg gilt vor der Merkliste. */
  zweiteQuelle?: boolean
  /** Ein jüngerer Beleg derselben Adresse ohne Kanal-Warnung hat das Ja bestätigt (so wird es geladen: Ja bleibt). */
  echtesJa?: boolean
  /** Nach dem Zurückstellen bleibt ein Ja einer anderen Seite hinter derselben Adresse stehen; es deckt die Kanal-Seite nicht. */
  andereSeite?: string
  /** Die Kanal-Adresse des Belegs, wenn sie von der gelesenen Seite abweicht (`kanalSeite` steht in der Notiz); der Titel hat keinen weiteren Beleg (Clannad). */
  adresse?: string
  kanalSeite?: string
  /** Adresse der Rohfolgen-Gruppe, wenn sie von der des Belegs abweicht (dann ist der Eintrag der Liste nicht ihrer). */
  gruppeAn?: string
  erwartet: boolean
}
const faelle: Fall[] = [
  { id: 9201, name: 'Kanal-Seite: kein Häkchen, mit und ohne Handbeleg', seite: 'B0MERKAAAA', kanal: true, erwartet: false },
  { id: 9202, name: 'zweite Kanal-Seite eines anderen Titels', seite: 'B0MERKBBBB', kanal: true, erwartet: false },
  { id: 9203, name: 'Kanal-Seite mit zweiter Quelle: Deutsch zählt', seite: 'B0MERKCCCC', kanal: true, zweiteQuelle: true, erwartet: true },
  { id: 9206, name: 'Kanal-Ja später durch echtes Ja bestätigt: nie in der Merkliste', seite: 'B0MERKEEEE', kanal: true, echtesJa: true, erwartet: true },
  { id: 9207, name: 'Ja einer anderen Seite hinter derselben Adresse deckt die Kanal-Seite nicht', seite: 'B0MERKFFFF', kanal: true, andereSeite: 'B0MERKGGGG', erwartet: false },
  { id: 9208, name: 'Seite ohne Kanal unter einer Kanal-Adresse: die Merkliste hält sie wie der Handbeleg auf (Clannad)', seite: 'B0MERKHHHH', adresse: 'B0MERKIIII', kanalSeite: 'B0MERKJJJJ', kanal: true, erwartet: false },
  { id: 9209, name: 'Eintrag der Liste zu einer anderen Adresse desselben Titels hält diese Gruppe nicht auf', seite: 'B0MERKKKKK', adresse: 'B0MERKLLLL', gruppeAn: 'B0MERKKKKK', kanalSeite: 'B0MERKLLLL', kanal: true, erwartet: true },
  { id: 9210, name: 'Adresse im Eintrag der Liste eines anderen Titels: die Gruppe wird nicht angelegt (fremd belegt)', seite: 'B0MERKIIII', adresse: 'B0MERKIIII', kanal: false, erwartet: false },
  { id: 9211, name: 'Gruppe unter der Kanal-Adresse eines anderen Titels, eigene Seite frei: behält ihr Häkchen', seite: 'B0MERKMMMM', adresse: 'B0MERKMMMM', gruppeAn: 'B0MERKIIII', kanal: false, erwartet: true },
  { id: 9204, name: 'Titel ohne Kanal-Beleg: Deutsch zählt', seite: 'B0MERKDDDD', kanal: false, erwartet: true },
]

/** Ein Kanal-Beleg (mit Ja) und, damit der Bau die Adresse nicht als „letzter Beleg“ überspringt, ein jüngeres Nein einer fremden Adresse. */
function belege(f: Fall, mitKanal: boolean, spaeteZweite = false): string {
  const kanal = !mitKanal ? '' : `- anilistId: ${f.id}
  platform: primevideo
  url: ${dp(f.adresse ?? f.seite)}
  dub: true
  checkedAt: '2026-10-01'${spaeteZweite && f.zweiteQuelle ? '\n  zweiteQuelle: JustWatch' : ''}
  note: "Tonspuren: Deutsch — Amazon-Seite ${f.kanalSeite ?? f.seite}: alle 4 Folgen geprüft, ${KANAL}"
`
  const echt = mitKanal && f.echtesJa ? `- anilistId: ${f.id}
  platform: primevideo
  url: ${dp(f.seite)}
  dub: true
  checkedAt: '2026-10-03'
  note: "Tonspuren: Deutsch — Amazon-Seite ${f.seite}: alle 4 Folgen geprüft"
` : ''
  const anders = !mitKanal && f.andereSeite ? `- anilistId: ${f.id}
  platform: primevideo
  url: ${dp(f.seite)}
  dub: true
  checkedAt: '2026-10-03'
  note: "Tonspuren: Deutsch — Amazon-Seite ${f.andereSeite}: alle 4 Folgen geprüft"
` : ''
  if (f.adresse) return kanal
  return `${kanal}${echt}${anders}
- anilistId: ${f.id}
  platform: primevideo
  url: ${dp('B0FREMDEND')}
  dub: false
  checkedAt: '2026-10-02'
`
}

const folgen = Array.from({ length: 4 }, (_, i) => ({ unsere: i + 1, sprachen: ['Deutsch', 'Japanisch'] }))

/** Ein Bau der Prime-Phase; liefert je Titel, ob ein Prime-Weg ein Deutsch-Häkchen bekam. */
async function baue(): Promise<Map<number, boolean>> {
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()
  const titles = new Map<number, Title>(faelle.map((f) => [f.id, { id: f.id, slug: `merk-${f.id}`, streams: [] } as unknown as Title]))
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
  return new Map(faelle.map((f) => [f.id, titles.get(f.id)!.streams.some((s) => s.platform === 'primevideo' && s.dub === true)]))
}

const fehler: string[] = []
try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const zugeordnet: Record<string, unknown> = {}
  for (const f of faelle) zugeordnet[`${dp(f.gruppeAn ?? f.adresse ?? f.seite)}#${f.id}`] = { titleId: f.id, plattform: 'primevideo', asin: 'B0EPISODE01', seite: f.seite, folgen }
  schreibe('data/prime-zugeordnet.json', JSON.stringify(zugeordnet))
  const yamlKanal = faelle.map((f) => belege(f, f.kanal)).join('')
  const yamlA = faelle.map((f) => belege(f, f.kanal, true)).join('')
  const yamlOhne = faelle.map((f) => belege(f, false)).join('')

  const { schreibeBelege } = await import('./lib/dub-confirmed.ts')
  const { MERKLISTE } = await import('./lib/kanal-merkliste.ts')
  const melde: string[] = []
  schreibeBelege(join(kulisse, 'data/dub-confirmed.yaml'), yamlKanal, (t) => melde.push(t))
  const listeA = readFileSync(join(kulisse, MERKLISTE), 'utf8')
  schreibe('data/dub-confirmed.yaml', yamlA)
  const welten: Record<'A' | 'B' | 'C', Map<number, boolean>> = { A: await baue(), B: new Map(), C: new Map() }

  schreibe('data/dub-confirmed.yaml', yamlOhne)
  welten.B = await baue()
  rmSync(join(kulisse, MERKLISTE))
  welten.C = await baue()

  schreibeBelege(join(kulisse, 'data/dub-confirmed.yaml'), yamlKanal, (t) => melde.push(t))
  if (readFileSync(join(kulisse, MERKLISTE), 'utf8') !== listeA) fehler.push('zweiter Schreiblauf ändert die Merkliste')
  if (melde.filter((t) => t.includes('gemerkt')).length !== 2) fehler.push(`Merkliste angelegt/ergänzt: ${melde.filter((t) => t.includes('gemerkt')).join(' | ')}`)
  if (!existsSync(join(kulisse, MERKLISTE))) fehler.push('Merkliste fehlt nach dem Schreiben')
  const eintraege = JSON.parse(listeA) as { anilistId: number }[]
  if (eintraege.length !== 6) fehler.push(`Merkliste hält ${eintraege.length} Einträge, erwartet 6`)

  for (const f of faelle) {
    const [a, b, c] = [welten.A.get(f.id), welten.B.get(f.id), welten.C.get(f.id)]
    if (a !== f.erwartet) fehler.push(`${f.name}: mit Handbeleg Häkchen ${a}, erwartet ${f.erwartet}`)
    if (!f.zweiteQuelle && b !== f.erwartet) fehler.push(`${f.name}: Handbeleg zurückgestellt, Häkchen ${b}, erwartet ${f.erwartet}`)
    if (f.kanal && !f.zweiteQuelle && c !== true) fehler.push(`${f.name}: ohne Handbeleg und Merkliste müsste das alte Ja erscheinen (Kulisse greift nicht), war ${c}`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-kanal-merkliste:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-merkliste: ${faelle.length} Fälle in drei Welten ok.`)
