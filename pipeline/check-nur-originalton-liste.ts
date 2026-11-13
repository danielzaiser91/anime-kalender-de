/**
 * Zusicherungen zu `schreibeNurOriginalton()` aus `pipeline/lib/nur-originalton-liste.ts` an einer Kulisse (`AK_ROOT`): Liste 23 mit
 * Zahl im Kopf, je Meldung Artikel, Termin (`?` ohne) und dem ersten Satz mit Untertitel/Originalton/OmU/(UT), sonst „–“; ohne
 * Meldung „Keine.“ Eine Meldung an Claude geht nur bei Meldungen und geänderter Liste raus. Läuft in `check:logic`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const kulisse = mkdtempSync(join(tmpdir(), 'nur-originalton-'))
process.env.AK_ROOT = kulisse
const LISTE = join(kulisse, 'daniel-zum-abarbeiten/listen/23-nur-originalton.md')
const POST = join(kulisse, 'data/meldungen-an-claude.jsonl')
const meldungen = () => (existsSync(POST) ? readFileSync(POST, 'utf8').trim().split('\n') : []).map((z) => JSON.parse(z) as { quelle: string; schwere: string; text: string; datei2?: string })

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

try {
  const { schreibeNurOriginalton } = await import('./lib/nur-originalton-liste.ts')
  type Vorschlag = Parameters<typeof schreibeNurOriginalton>[0][number]
  const v = (titel: string, dates: { iso?: string; context: string }[]): Vorschlag => ({ articleTitle: titel, articleUrl: `https://a.test/${titel}`, dates }) as unknown as Vorschlag

  schreibeNurOriginalton([])
  const leer = readFileSync(LISTE, 'utf8')
  pruefe('leer: Kopf mit 0', leer.startsWith('# Meldungen mit nur Originalton (0)\n'), true)
  pruefe('leer: Keine.', leer.endsWith('\n\nKeine.\n'), true)
  pruefe('leer: keine Meldung an Claude', meldungen(), [])

  const liste = [
    v('A', [{ iso: '2026-12-01', context: 'Start am 1. Dezember' }, { context: 'im Originalton mit deutschen Untertiteln' }]),
    v('B', [{ context: 'Ab Januar als OmU' }]),
    v('C', [{ iso: '2026-11-20', context: 'TV-Premiere am 20.11.' }, { iso: '2026-11-27', context: 'Stream ab 27.11. (UT)' }]),
    v('D', []),
  ]
  schreibeNurOriginalton(liste)
  const md = readFileSync(LISTE, 'utf8')
  pruefe('Kopf zählt', md.split('\n')[0], '# Meldungen mit nur Originalton (4)')
  pruefe('Zeilen', md.split('\n').filter((z) => z.startsWith('- ')), [
    '- [A](https://a.test/A) — Termin 2026-12-01: „im Originalton mit deutschen Untertiteln"',
    '- [B](https://a.test/B) — Termin ?: „Ab Januar als OmU"',
    '- [C](https://a.test/C) — Termin 2026-11-27: „Stream ab 27.11. (UT)"',
    '- [D](https://a.test/D) — Termin ?: „–"',
  ])
  pruefe('Meldung an Claude bei Änderung', meldungen().map((m) => [m.quelle, m.schwere, m.text, m.datei2]), [
    ['bestand-bauen', 'hinweis', '4 Meldungen ohne deutschen Termin (nur Originalton): A | B | C | D', 'daniel-zum-abarbeiten/listen/23-nur-originalton.md'],
  ])

  schreibeNurOriginalton(liste)
  pruefe('gleiche Liste: keine zweite Meldung', meldungen().length, 1)
  schreibeNurOriginalton(liste.slice(0, 1))
  pruefe('geänderte Liste: neue Meldung', meldungen().length, 2)
  schreibeNurOriginalton([])
  pruefe('wieder leer: Datei bleibt mit Keine., keine Meldung', [readFileSync(LISTE, 'utf8').endsWith('Keine.\n'), meldungen().length], [true, 2])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-nur-originalton-liste: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-nur-originalton-liste: alle Zusicherungen grün')
