/**
 * Zusicherung zu `ladeBelegsignale().handbelegt` gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen ab 900001, nie gegen die echten Dateien:
 * nur ein Handbeleg mit `dub: true` ohne `nichtImBestand` zählt. Anlass: Prüfer zu PR 1717 (21.10.2026), die Mutation `!c.nichtImBestand` → `true` überlebte.
 * Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const JA = 900001
const JA_NICHT_IM_BESTAND = 900002
const NEIN = 900003
const NEIN_NICHT_IM_BESTAND = 900004
const eintrag = (id: number, dub: boolean, rest = '') =>
  `- anilistId: ${id}\n  title: "Kulisse ${id}"\n  platform: netflix\n  dub: ${dub}\n  checkedAt: '2026-10-13'\n  note: "Kulisse."\n${rest}`

const kulisse = mkdtempSync(join(tmpdir(), 'belegstaerke-handbelegt-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
writeFileSync(join(kulisse, 'data/synchron-forum-treffer.yaml'), '# leer\n')
writeFileSync(join(kulisse, 'data/anisearch-ids-hand.yaml'), '900101: 900500\n900102: 900500\n900103: 900501\n900104: 900502\n900105: 900502\n900106: 900502\n900107: 900503\n900108: 900503\n')
writeFileSync(
  join(kulisse, 'data/dub-confirmed.yaml'),
  [
    eintrag(JA, true),
    eintrag(JA_NICHT_IM_BESTAND, true, '  nichtImBestand: true\n'),
    eintrag(NEIN, false),
    eintrag(NEIN_NICHT_IM_BESTAND, false, '  nichtImBestand: true\n'),
  ].join(''),
)

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { ladeBelegsignale } = await import('./lib/belegstaerke.ts')
  console.log('\nBelegstärke: Filter der Handbelege gegen die Kulisse')
  const handbelegt = ladeBelegsignale([]).handbelegt
  const gefunden = [...handbelegt]
  pruefe('Handbeleg mit dub:true zählt', handbelegt.has(JA), gefunden)
  pruefe('dub:true mit nichtImBestand zählt nicht', !handbelegt.has(JA_NICHT_IM_BESTAND), gefunden)
  pruefe('dub:false zählt nicht', !handbelegt.has(NEIN), gefunden)
  pruefe('dub:false mit nichtImBestand zählt nicht', !handbelegt.has(NEIN_NICHT_IM_BESTAND), gefunden)
  pruefe('genau ein Titel in der Kulisse', handbelegt.size === 1, gefunden)
  console.log('\nBelegstärke: mitBelegstaerke liest die Herkunft der API-Tonspur')
  const { mitBelegstaerke, motnTonSchluessel } = await import('./lib/belegstaerke.ts')
  const api = { id: 900005, dubConfidence: 'low', streams: [{ platform: 'netflix', url: 'x', dub: true }] } as unknown as Title
  const mitApi = mitBelegstaerke([api], [], new Set([motnTonSchluessel(900005, 'x')]))[0]?.dubConfidence
  const ohne = mitBelegstaerke([api], [], new Set())[0]?.dubConfidence
  pruefe('Tonspur nur aus der API: normal', mitApi === 'normal', mitApi)
  pruefe('dieselbe Tonspur ohne Vermerk der API: high', ohne === 'high', ohne)
  console.log('\nBelegstärke: ein Teil im aniSearch-Sammeleintrag ohne Beleg zählt als Einzelquelle')
  /* 900101 und 900102 teilen den aniSearch-Eintrag 900500; 900103 hängt allein an 900501. Alle drei kamen mit der Stufe normal an. */
  const ohneBeleg = (id: number) => ({ id, dubConfidence: 'normal', streams: [] }) as unknown as Title
  const mitTon = { ...ohneBeleg(900102), streams: [{ platform: 'netflix', url: 'y', dub: true }] } as unknown as Title
  const [teil, mitTonSpur, allein] = mitBelegstaerke([ohneBeleg(900101), mitTon, ohneBeleg(900103)], [], new Set())
  pruefe('Teil ohne Beleg: Stufe low und alte Stufe low (kein Feld nötig)', teil?.dubConfidence === 'low' && teil.einzelquelle === undefined, teil)
  pruefe('Teil mit Tonspur: Stufe high, nicht Einzelquelle', mitTonSpur?.dubConfidence === 'high' && mitTonSpur.einzelquelle === undefined, mitTonSpur)
  pruefe('Titel allein am Eintrag: Stufe low, aber alte Stufe nicht low (einzelquelle false)', allein?.dubConfidence === 'low' && allein.einzelquelle === false, allein)
  /* Overlord: The Dark Hero und Girls und Panzer Finale 4 (Lauf 41235575193): JustWatch nennt Deutsch, also nie „Einzelquelle“ (sonst „Ohne bekannten Termin, aber Deutsch laut JustWatch“). */
  const mitJw = { ...ohneBeleg(900105), streams: [{ platform: 'primevideo', url: 'z', dubQuelle: 'justwatch', dubStand: '2026-10-19' }] } as unknown as Title
  const mitLink = { ...ohneBeleg(900106), watchLinks: [{ name: 'x', url: 'y', kind: 'buy', dubRanges: [{ from: 1, to: 1, dub: true }] }] } as unknown as Title
  const [nackt, jw, link] = mitBelegstaerke([ohneBeleg(900104), mitJw, mitLink], [], new Set())
  pruefe('Gruppe von drei: der Teil ohne alles zählt als Einzelquelle', nackt?.dubConfidence === 'low' && nackt.einzelquelle === undefined, nackt)
  pruefe('Gruppe von drei: JustWatch-Urteil am Teil: nicht Einzelquelle', jw?.dubConfidence === 'low' && jw.einzelquelle === false, jw)
  /* Eine Stufe über low (hier: Erstausgabe mit Synchro von Hand) bleibt, wie sie ist — die Regel greift nur bei low. */
  const mitErstausgabe = { ...ohneBeleg(900107), deErstausgabe: { synchro: true, von: '2026-01-01' } } as unknown as Title
  const [stufeNormal] = mitBelegstaerke([mitErstausgabe, ohneBeleg(900108)], [], new Set())
  pruefe('Teil im Sammeleintrag mit Synchro-Erstausgabe: Stufe normal, nicht Einzelquelle', stufeNormal?.dubConfidence === 'normal' && stufeNormal.einzelquelle === undefined, stufeNormal)
  pruefe('Gruppe von drei: Handlink mit Tonbereich am Teil: nicht Einzelquelle', link?.dubConfidence === 'low' && link.einzelquelle === false, link)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nBelegstärke (Handbelege): alle Zusicherungen halten.')
