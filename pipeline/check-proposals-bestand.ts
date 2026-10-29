/**
 * Zusicherungen zur Zusammenführung frischer Anime2You-Vorschläge mit dem Bestand (`lib/proposals-bestand.ts`).
 * Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { vorschlaegeMitBestand } from './lib/proposals-bestand.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

interface V {
  articleUrl: string
  publishedAt: string
  sammel?: unknown
  sammelGelesen?: string
  volltextGelesen?: string
  dates?: string[]
  verschiebungen?: { titel: string; alt: string; neu: string }[]
  discZeilen?: { titel: string }[]
  discGelesen?: string
}

const ALT: V = { articleUrl: 'https://x/alt', publishedAt: '2026-10-01' }
const frisch = (p: V): V => ({ articleUrl: p.articleUrl, publishedAt: p.publishedAt })

const ohneFeed = vorschlaegeMitBestand<V>([ALT], [])
pruefe('Bestand ohne Feed-Treffer bleibt', ohneFeed.length === 1 && ohneFeed[0]!.articleUrl === 'https://x/alt', ohneFeed)

const neu = vorschlaegeMitBestand<V>([ALT], [{ articleUrl: 'https://x/neu', publishedAt: '2026-10-02' }])
pruefe('neuer Treffer kommt zum Bestand', neu.map((p) => p.articleUrl).join() === 'https://x/alt,https://x/neu', neu)

const mitSammel: V = { ...ALT, sammel: [{ titel: 'A' }], sammelGelesen: '2026-10-05' }
const sammel = vorschlaegeMitBestand<V>([mitSammel], [frisch(mitSammel)])
pruefe('gelesene Sammelartikel-Liste bleibt', JSON.stringify(sammel[0]!.sammel) === '[{"titel":"A"}]' && sammel[0]!.sammelGelesen === '2026-10-05', sammel)

const mitVolltext: V = { ...ALT, volltextGelesen: '2026-10-05', dates: ['2026-11-01'] }
const volltext = vorschlaegeMitBestand<V>([mitVolltext], [{ ...frisch(mitVolltext), dates: [] }])
pruefe('Tage aus dem Volltext bleiben', volltext[0]!.dates?.join() === '2026-11-01' && volltext[0]!.volltextGelesen === '2026-10-05', volltext)

/* Der echte Anlass: „Neun Blu-ray-Termine … verschoben" (Anime2You, 16.10.2026) trägt in `data/proposals/anime2you.json` neun Zeilen; ein Stundenlauf überschrieb sie mit dem Feed-Treffer ohne Tabelle. */
const NEUN: V = {
  articleUrl: 'https://www.anime2you.de/news/1061001/neun-animoon-crunchyroll-hardball-disc-verschiebungen/',
  publishedAt: '2026-10-16',
  verschiebungen: [
    { titel: 'Virgin Road – Vol. 2 (Limited Edition)', alt: '2026-10-30', neu: '2026-12-04' },
    { titel: 'Good Luck Girl! – Vol. 1 (Limited Edition mit Sammelschuber)', alt: '2026-11-20', neu: '2027-02-05' },
  ],
}
const tabelle = vorschlaegeMitBestand<V>([NEUN], [frisch(NEUN)])
pruefe('Stundenlauf: Verschiebungs-Tabelle bleibt erhalten', tabelle[0]!.verschiebungen?.length === 2 && tabelle[0]!.verschiebungen[1]!.neu === '2027-02-05', tabelle)
const leereTabelle = vorschlaegeMitBestand<V>([{ ...NEUN, verschiebungen: [] }], [frisch(NEUN)])
pruefe('auch eine gelesene, leere Tabelle bleibt (kein erneutes Holen bei jedem Lauf)', Array.isArray(leereTabelle[0]!.verschiebungen) && leereTabelle[0]!.verschiebungen.length === 0, leereTabelle)
const frischeTabelle = vorschlaegeMitBestand<V>([ALT], [{ ...NEUN }])
pruefe('neuer Treffer mit eigener Tabelle behält sie', frischeTabelle.find((p) => p.articleUrl === NEUN.articleUrl)?.verschiebungen?.length === 2, frischeTabelle)

const MIT_DISC: V = { ...ALT, discZeilen: [{ titel: 'A' }], discGelesen: '2026-10-28' }
const disc = vorschlaegeMitBestand<V>([MIT_DISC], [frisch(MIT_DISC)])
pruefe('Stundenlauf: gelesene Disc-Übersicht bleibt samt Lesedatum', JSON.stringify(disc[0]!.discZeilen) === '[{"titel":"A"}]' && disc[0]!.discGelesen === '2026-10-28', disc)
const ohneDisc = vorschlaegeMitBestand<V>([ALT], [frisch(ALT)])
pruefe('ohne gelesene Übersicht entstehen keine Disc-Felder', !('discZeilen' in ohneDisc[0]!) && !('discGelesen' in ohneDisc[0]!), ohneDisc)

/* Klasse schließen: Jedes optionale Feld von `Proposal` (Syntaxbaum von `scrape-anime2you.ts`) bleibt erhalten oder steht hier als „kommt aus dem Feed“. Ein neues Nachhol-Feld ohne Erhaltung löscht der Stundenlauf sonst still (verschiebungen und discZeilen, 29.10.2026). */
const KOMMT_AUS_DEM_FEED = ['pause', 'zeiten', 'hinweis']
const quelle = ts.createSourceFile('scrape-anime2you.ts', readFileSync(new URL('./scrape-anime2you.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const optional: string[] = []
quelle.forEachChild((n) => {
  if (!ts.isInterfaceDeclaration(n) || n.name.text !== 'Proposal') return
  for (const m of n.members) if (ts.isPropertySignature(m) && m.questionToken && ts.isIdentifier(m.name)) optional.push(m.name.text)
})
pruefe('Proposal: optionale Felder gelesen', optional.length >= 9, optional)
const nachholfelder = optional.filter((f) => !KOMMT_AUS_DEM_FEED.includes(f))
const vollerBestand: Record<string, unknown> = { articleUrl: 'https://x/voll', publishedAt: '2026-10-01', dates: ['2026-11-01'] }
for (const f of nachholfelder) vollerBestand[f] = f.endsWith('Gelesen') ? '2026-10-05' : [{ marker: f }]
const erhalten = vorschlaegeMitBestand<V>([vollerBestand as unknown as V], [{ articleUrl: 'https://x/voll', publishedAt: '2026-10-01' }])
const verloren = nachholfelder.filter((f) => JSON.stringify((erhalten[0] as unknown as Record<string, unknown>)[f]) !== JSON.stringify(vollerBestand[f]))
pruefe('Stundenlauf: jedes Nachhol-Feld von Proposal bleibt erhalten', verloren.length === 0, verloren)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nVorschläge mit Bestand: alle Zusicherungen erfüllt')
