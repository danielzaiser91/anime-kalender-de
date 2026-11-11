/**
 * Bestandswache Folgestaffeln (11.11.2026), als Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`): Je Fall n Reihen mit zwei Titeln, die erste mit eigenem
 * JustWatch-Schlüssel (Staffel 2 führt einen Kanal), die zweite ohne Schlüssel; in `wirkend` Reihen trägt sie den Kanal schon als Bezugsweg.
 * Die Wache druckt die Warnzeile nur bei einem Sprung über 9 gegen den Stand 18, sperrt nie (Exit 0, „VERSTÖSSE: 0“).
 *
 * Aufruf: `npx tsx pipeline/check-jw-folgestaffel-bestand-lauf.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kanalUrl = (i: number) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.bestand-${i}`
const kanal = (i: number) => ({ anbieter: 'Aniverse Amazon Channel', art: 'FLATRATE', audio: ['de'], url: kanalUrl(i) })

/** `reihen` Reihen mit je Serie (900.000 + 2i) und Folgestaffel (900.001 + 2i); die ersten `wirkend` Folgestaffeln tragen den Kanal als Weg. */
function kulisse(reihen: number, wirkend: number): { titles: object[]; jw: Record<string, object> } {
  const titles: object[] = []
  const jw: Record<string, object> = {}
  for (let i = 0; i < reihen; i++) {
    const serie = 900_000 + 2 * i
    const basis = { format: 'TV', episodes: 12, franchiseId: 8000 + i, titleEn: `Fixture ${i}` }
    titles.push({ ...basis, id: serie, jpYear: 2018 })
    titles.push({ ...basis, id: serie + 1, jpYear: 2023, watchLinks: i < wirkend ? [{ name: 'Aniverse', kind: 'stream', url: kanalUrl(i) }] : [] })
    jw[String(serie)] = { jwId: `ts-${i}`, staffeln: [{ nr: 1, folgen: 12, angebote: [] }, { nr: 2, folgen: 12, angebote: [kanal(i)] }] }
  }
  return { titles, jw }
}

function lauf(reihen: number, wirkend: number): { status: number | null; out: string; err: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'folgestaffel-bestand-'))
  const { titles, jw } = kulisse(reihen, wirkend)
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titles))
  writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), reihen ? JSON.stringify(jw) : '{}')
  const skript = fileURLToPath(new URL('./check-jw-folgestaffel-bestand.ts', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, AK_ROOT: wurzel } })
  rmSync(wurzel, { recursive: true, force: true })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

const warnt = (out: string) => out.split('\n').some((z) => z.startsWith('⚠ WARNUNG Folgestaffel-Einträge'))
const faelle: [string, number, number, boolean, string][] = [
  ['Stand (18 wirken)', 20, 18, false, '20 angelegt, 18 wirken, 2 gesperrt'],
  ['obere Grenze (27 wirken, Sprung 9)', 30, 27, false, '30 angelegt, 27 wirken, 3 gesperrt'],
  ['über der Grenze (28 wirken, Sprung 10)', 30, 28, true, '30 angelegt, 28 wirken, 2 gesperrt'],
  ['untere Grenze (9 wirken, Sprung 9)', 12, 9, false, '12 angelegt, 9 wirken, 3 gesperrt'],
  ['unter der Grenze (8 wirken, Sprung 10)', 12, 8, true, '12 angelegt, 8 wirken, 4 gesperrt'],
  ['alle Einträge gesperrt (0 wirken)', 15, 0, true, '15 angelegt, 0 wirken, 15 gesperrt'],
]
console.log('\nFolgestaffel-Bestandswache (Prozess gegen Wegwerf-Wurzel):')
for (const [name, reihen, wirkend, warnung, zahlen] of faelle) {
  const r = lauf(reihen, wirkend)
  pruefe(`${name}: Prozess lief bis zum Ende (Exit 0, VERSTÖSSE: 0)`, r.status === 0 && r.out.includes('VERSTÖSSE: 0'), { status: r.status, err: r.err.slice(-400) })
  pruefe(`${name}: Zählzeile nennt ${zahlen}`, r.out.includes(`Folgestaffel-Einträge im Bestand: ${zahlen}`), r.out)
  pruefe(`${name}: Warnzeile ${warnung ? 'steht' : 'fehlt'}`, warnt(r.out) === warnung, r.out)
}
const leer = lauf(0, 0)
pruefe('ohne Titel und ohne JustWatch-Datei: Warnzeile „nicht gemessen“, Exit 0', leer.status === 0 && leer.out.includes('⚠ WARNUNG Folgestaffel-Einträge: nicht gemessen'), leer)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
