/**
 * Bestandsteil von `check-anisearch-paar-widerspruch.ts`: Jedes Paar der aniSearch-Brücke (`data/anisearch-mal.json`), dessen Titel und Seiteneintrag sich
 * widersprechen, steht in `data/anisearch-mal-verworfen.json`. Ein neuer Widerspruch aus dem täglichen Abruf bleibt als Warnung stehen (Exit 0, rot stoppte den ganzen Bestandsbau), bis ein Mensch ihn
 * einordnet (verwerfen oder, bei bloßer Umschrift, die Regel schärfen). Liest `public/data`, gehört deshalb in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { paarWiderspricht } from './lib/anisearch-paar-widerspruch.ts'

type Zeile = { id: number; malId?: number; titleRomaji?: string; titleEn?: string; titleNative?: string; titleDe?: string; jpYear?: number; episodes?: number }
type Seite = { t?: string; en?: string; n?: string; de?: string; y?: number; f?: number }

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

const bruecke = lies<Record<string, number>>('data/anisearch-mal.json')
const verworfen = lies<Record<string, { anisearch: number }>>('data/anisearch-mal-verworfen.json')
const eintraege = lies<Record<string, Seite>>('data/anisearch-eintraege.json')
const nachMal = new Map<number, Zeile>()
for (const z of [...lies<Zeile[]>('public/data/titles.json'), ...lies<Zeile[]>('public/data/ohne-synchro.json')]) if (z.malId) nachMal.set(z.malId, z)

const offen: string[] = []
let geprueft = 0
for (const [mal, anisearch] of Object.entries(bruecke)) {
  const z = nachMal.get(Number(mal))
  const s = eintraege[anisearch]
  if (!z || !s) continue
  geprueft++
  if (verworfen[mal]?.anisearch === anisearch) continue
  if (paarWiderspricht({ names: [z.titleRomaji, z.titleEn, z.titleNative, z.titleDe], jahr: z.jpYear, folgen: z.episodes }, { names: [s.t, s.en, s.n, s.de], jahr: s.y, folgen: s.f })) {
    offen.push(`MAL ${mal} ↔ aniSearch ${anisearch}: ${z.titleRomaji} (${z.jpYear}, ${z.episodes}) gegen ${s.t} (${s.y}, ${s.f})`)
  }
}
console.log(`aniSearch-Brücke: ${geprueft} Paare mit Titel und Seiteneintrag geprüft, ${Object.keys(verworfen).length} verworfen, ${offen.length} offener Widerspruch`)
for (const o of offen.slice(0, 10)) console.log(`  ⚠ WARNUNG aniSearch-Brücke, Widerspruch (in data/anisearch-mal-verworfen.json eintragen, wenn es zwei Werke sind): ${o}`)
console.log('VERSTÖSSE: 0')
