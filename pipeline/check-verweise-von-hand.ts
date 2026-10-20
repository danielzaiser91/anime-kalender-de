/**
 * Zusicherung: `ergaenzeVerweiseVonHand` legt den Weg samt Prime-Kanal an, verdoppelt nichts und überspringt unvollständige Einträge
 * (Anlass: Reborn as a Space Mercenary, 11.10.2026, Prime-Seite über Crunchyroll). Läuft gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen,
 * nie gegen die echte Datei; deren Eintragsform prüft `check-verweise-von-hand-bestand.ts`. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { laufeInKulisse } from './lib/kulisse-lauf.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'verweise-von-hand-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data'), { recursive: true })
const SEITE = 'https://www.amazon.de/gp/video/detail/B0KULISSE01'
const SCHON = 'https://www.amazon.de/gp/video/detail/B0KULISSE02'
writeFileSync(
  join(kulisse, 'data/verweise-von-hand.yaml'),
  `- anilistId: 900001
  platform: primevideo
  url: ${SEITE}
  kanal: Crunchyroll
  belegtAm: '2026-10-11'
- anilistId: 900002
  platform: primevideo
  url: ${SCHON}
- anilistId: 900003
  platform: primevideo
- anilistId: 900099
  platform: primevideo
  url: https://www.amazon.de/gp/video/detail/B0KULISSE03
`,
)

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${ist === undefined ? '' : ` — gefunden: ${JSON.stringify(ist)}`}`)
}

try {
  const { ergaenzeVerweiseVonHand } = await import('./lib/verweise-von-hand.ts')
  const titel = (id: number, streams: unknown[] = []) => [id, { id, streams } as unknown as Title] as const
  const wege = new Map<number, Title>([titel(900001), titel(900002, [{ platform: 'primevideo', url: `${SCHON}?ref_=x` }]), titel(900003)])
  const belegtAm = ergaenzeVerweiseVonHand(wege)
  console.log('\nHandverweise: Kulisse mit erfundenen Kennungen')
  const weg = wege.get(900001)!.streams[0]
  pruefe('Prime-Seite wird als Weg mit Crunchyroll-Kanal angelegt', weg?.platform === 'primevideo' && weg.url === SEITE && weg.kanal === 'Crunchyroll', weg)
  pruefe('ein schon geführter Verweis (gleicher Adresskern) wird nicht verdoppelt', wege.get(900002)!.streams.length === 1, wege.get(900002)!.streams)
  pruefe('ein Eintrag ohne Adresse legt nichts an', wege.get(900003)!.streams.length === 0, wege.get(900003)!.streams)
  pruefe('ein Eintrag zu einem Titel außerhalb des Bestands bricht nicht ab', wege.size === 3)
  pruefe('belegtAm kommt unter dem Adresskern zurück', [...belegtAm.values()].join() === '2026-10-11' && belegtAm.size === 1, [...belegtAm])

  console.log('\nHandverweise: die Bestandsprüfung gegen eigene Kulissen')
  const bestand = (yamlText: string | undefined) => laufeInKulisse('check-verweise-von-hand-bestand.ts', yamlText === undefined ? {} : { 'data/verweise-von-hand.yaml': yamlText })
  /** Rot heißt: Exit 1 und die Meldung nennt den zweiten Eintrag (ein Absturz an anderer Stelle zählt nicht). */
  const rot2 = (text: string) => {
    const r = bestand(text)
    return r.code === 1 && r.aus.includes('Nr. 2')
  }
  const gut = '- anilistId: 900001\n  platform: primevideo\n  url: https://www.amazon.de/gp/video/detail/B0KULISSE01\n'
  pruefe('vollständiger Eintrag: grün', bestand(gut).code === 0, bestand(gut).aus)
  pruefe('keine Datei: grün', bestand(undefined).code === 0)
  pruefe('Eintrag ohne Adresse: rot', rot2(gut + '- anilistId: 900002\n  platform: primevideo\n'))
  pruefe('Eintrag ohne Kennung: rot', rot2(gut + '- platform: primevideo\n  url: https://x.example/a\n'))
  pruefe('Eintrag ohne Anbieter: rot', rot2(gut + '- anilistId: 900002\n  url: https://x.example/a\n'))
  pruefe('Adresse ohne https: rot', rot2(gut + '- anilistId: 900002\n  platform: primevideo\n  url: http://x.example/a\n'))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nHandverweise: alle Zusicherungen halten.')
