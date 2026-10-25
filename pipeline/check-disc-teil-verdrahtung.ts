/**
 * Verdrahtung des Teil-Hinweis-Zählers im Bau (`ergaenzeTermineAusNewsUndTv`): Die Meldung mit unzuordenbarem
 * Part-Hinweis landet nicht als Termin, sondern in der Logzeile des Bauschritts. Läuft gegen einen Wegwerf-Ordner (`AK_ROOT`).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'disc-teil-'))
process.env.AK_ROOT = wurzel

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

async function main(): Promise<void> {
  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  const artikel = 'Disc-Termin des zweiten Parts von »Dracheball« + Design'
  const vorschlag = {
    articleTitle: artikel,
    articleUrl: 'https://www.anime2you.de/news/900004/x/',
    category: 'disc',
    platforms: ['disc'],
    titleId: 900004,
    dub: 'ja',
    dates: [{ iso: '2999-01-29', context: 'erscheint am 29.01.2999' }],
  }
  writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [vorschlag] }))

  const zeilen: string[] = []
  const alt = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const titles = new Map([[900004, { id: 900004, franchiseId: 900004, titleEn: 'Dracheball', format: 'TV' }]])
  const releases: unknown[] = []
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as unknown as Parameters<typeof ergaenzeTermineAusNewsUndTv>[0])
  } finally {
    console.log = alt
  }
  const zeile = zeilen.find((z) => z.includes('Part-/Cour-/Box-Hinweis'))
  pruefe('Bau: Meldung ohne Namenstreffer wird nicht Termin', releases.length === 0, releases.length)
  pruefe('Bau: Logzeile zählt 1 und nennt die Überschrift', !!zeile && zeile.includes('1 Anime2You-Meldungen') && zeile.includes(artikel), zeile)
}

try {
  await main()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`Disc-Teil-Verdrahtung: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
