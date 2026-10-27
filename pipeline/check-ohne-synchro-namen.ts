/**
 * Zusicherungen zum Namensindex der Titel ohne Synchro (`pipeline/bau/ohne-synchro-namen.ts`, Datei `ohne-synchro-namen.json`):
 * Felder, Sortierung, Übersetzung auf eigene Kennungen und Verdrahtung im Bau. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { namensIndex } from './bau/ohne-synchro-namen.ts'
import { uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const roh = (t: Record<string, unknown>) => t as unknown as Title
const zeilen = [
  roh({ id: 902, franchiseId: 800, titleRomaji: 'Zeta', titleEn: 'Zeta', titleNative: 'ゼータ', jpYear: 2004, jpEnd: '2004-12-01', genres: ['Action'], format: 'TV', land: 'JP', fsk: 12, coverImage: 'x.jpg', synopsis: 'lang' }),
  roh({ id: 901, titleRomaji: 'Alpha', titleEn: 'Alpha Story', titleDe: 'Alpha Geschichte', genres: [], jpYear: 1999 }),
  roh({ id: 903, titleRomaji: 'Alpha', jpYear: 2001 }),
]
const index = namensIndex(zeilen)

console.log('\nNamensindex: Inhalt')
pruefe('nach Romaji sortiert, bei Gleichstand nach Kennung', index.map((z) => z.id).join() === '901,903,902', index.map((z) => z.id))
pruefe('Felder des Suchhinweises bleiben', JSON.stringify(index[2]) === JSON.stringify({ id: 902, franchiseId: 800, titleRomaji: 'Zeta', jpYear: 2004, jpEnd: '2004-12-01', genres: ['Action'], format: 'TV', land: 'JP', fsk: 12 }), index[2])
pruefe('Cover, Inhaltsangabe und nativer Name fehlen', index.every((z) => !('coverImage' in z) && !('synopsis' in z) && !('titleNative' in z)), index)
pruefe('gleicher englischer Name wie der romanisierte steht nur einmal', !('titleEn' in index[2]!), index[2])
pruefe('abweichender englischer und deutscher Name bleiben', index[0]!.titleEn === 'Alpha Story' && index[0]!.titleDe === 'Alpha Geschichte', index[0])
pruefe('leere Liste und fehlende Felder fallen weg', !('genres' in index[0]!) && !('franchiseId' in index[0]!), index[0])
pruefe('die Eingabe bleibt unverändert (Reihenfolge, Felder)', zeilen[0]!.id === 902 && 'titleNative' in zeilen[0]!, zeilen[0])

console.log('\nNamensindex: Kennungen der Ausgabe')
const ak = (n: number) => n + 1000
const aus = uebersetzeDatei('ohne-synchro-namen.json', index, ak) as { id: number; franchiseId?: number; al: number }[]
pruefe('id und franchiseId auf ak, al bleibt die AniList-Kennung', aus[2]!.id === 1902 && aus[2]!.franchiseId === 1800 && aus[2]!.al === 902, aus[2])
pruefe('ohne franchiseId bleibt es ohne', !('franchiseId' in aus[0]!), aus[0])

console.log('\nNamensindex: Verdrahtung im Bau')
{
  const quelltext = readFileSync(new URL('./bau/nebendateien.ts', import.meta.url), 'utf8')
  const aufrufe = unbedingteAufrufe(quelltext, 'schreibeOhneSynchro').filter((a) => a.name === 'writeJson')
  const namen = aufrufe.find((a) => a.args[0]?.includes('ohne-synchro-namen.json'))
  const voll = aufrufe.find((a) => a.args[0]?.includes('/ohne-synchro.json'))
  pruefe('writeJson schreibt den Index aus allen Titeln hinter dem Schalter', namen?.args[1] === 'namensIndex(alle)', namen)
  pruefe('der Index kommt nach der vollen Datei', !!namen && !!voll && namen.stelle > voll.stelle, [namen?.stelle, voll?.stelle])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-ohne-synchro-namen: ok (Felder, Sortierung, Kennungen, Verdrahtung)')
