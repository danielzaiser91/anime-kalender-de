/**
 * Zusicherung: **Kanal-Belege verlieren beim Einlesen ihre Nein-Bereiche** (Mob Psycho 100 III, 17.09.2026: Zickzack-Lücken aus
 * Crunchyroll-Kanal-Seiten erschienen als „✕ DE" an der Prime-Pille). Lauf von `ladeHandbelege` gegen eine Kulisse
 * (`AK_ROOT`) — ersetzt die Quelltext-Zusicherung auf `kanalMitLuecken` in `check-logic.ts`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'kanal-luecken-'))
process.env.AK_ROOT = wurzel
const fehler: string[] = []
let faelle = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  faelle++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

const bereiche = `  dubRanges:
    - { from: 1, to: 3, dub: true }
    - { from: 4, to: 4, dub: false }
    - { from: 5, to: 8, dub: true }
`
const eintrag = (id: number, note: string, rest: string) =>
  `- anilistId: ${id}\n  platform: primevideo\n  url: https://www.amazon.de/dp/B0KANAL${id}\n  checkedAt: '2026-09-17'\n  note: '${note}'\n${rest}`
const yaml = [
  eintrag(900001, 'Kanal-Titel: Amazon zeigt die Sprachen des Kanals', bereiche + '  zweiteQuelle: JustWatch\n'),
  eintrag(900002, 'Kanal-Titel: Amazon zeigt die Sprachen des Kanals', bereiche),
  eintrag(900003, 'eigene Prime-Folgen', bereiche),
  eintrag(900004, 'Kanal-Titel: nur Nein', '  dubRanges:\n    - { from: 1, to: 4, dub: false }\n  zweiteQuelle: JustWatch\n'),
].join('')

try {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), yaml)
  const { ladeHandbelege } = await import('./lib/dub-confirmed.ts')
  const belege = ladeHandbelege()
  const bereichVon = (id: number) => belege.find((b) => b.anilistId === id)?.dubRanges?.map((r) => `${r.from}-${r.to}:${r.dub}`)
  erwarte('alle vier Belege gelesen', belege.length, 4)
  erwarte('Kanal-Titel mit zweiter Quelle: Lücke fällt weg, die Ja-Bereiche bleiben', bereichVon(900001), ['1-3:true', '5-8:true'])
  erwarte('Kanal-Titel ohne zweite Quelle: das Ja ist kein Beleg, die Bereiche entfallen', bereichVon(900002), undefined)
  erwarte('eigener Prime-Titel: Lücken bleiben', bereichVon(900003), ['1-3:true', '4-4:false', '5-8:true'])
  erwarte('Kanal-Titel nur mit Nein: unverändert', bereichVon(900004), ['1-4:false'])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`FEHL check-kanal-luecken-lader:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-luecken-lader: ${faelle} Fälle ok.`)
