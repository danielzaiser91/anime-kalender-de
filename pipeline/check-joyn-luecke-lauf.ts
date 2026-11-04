/**
 * Prozesstest zu `check-joyn-luecke-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel (er liest relativ zum Arbeitsordner)
 * und endet immer mit Exit 0; eine Lücke ohne Ausnahme und eine Ausnahme ohne Lücke erscheinen als `⚠ WARNUNG`, eine gedeckte Lücke nicht.
 * Aufruf: npm run check:logic oder `tsx pipeline/check-joyn-luecke-lauf.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const repo = fileURLToPath(new URL('..', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'joyn-luecke-bestand-'))
mkdirSync(join(wurzel, 'data'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
const schreibe = (pfad: string, inhalt: unknown): void => writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
const joyn = { anbieter: 'Joyn', art: 'ADS', url: 'https://www.joyn.de/serien/probe' }
/* 900001 Lücke (Anime), -900002 Lücke (Cartoon), 900003 mit Joyn-Weg, 900004 ohne Joyn-Angebot. */
schreibe('public/data/titles.json', [
  { id: 900001, streams: [{ platform: 'netflix' }] },
  { id: 900003, streams: [{ platform: 'joyn' }] },
  { id: 900004, streams: [] },
])
schreibe('public/data/cartoons.json', [{ id: -900002, streams: [] }])
schreibe('data/justwatch-audio.json', {
  900001: { angebote: [joyn] },
  '-900002': { angebote: [joyn] },
  900003: { angebote: [joyn] },
  900004: { angebote: [{ anbieter: 'Netflix', url: 'https://www.netflix.com/title/1' }] },
})

function lauf(ausnahmen: unknown): { status: number | null; ausgabe: string } {
  schreibe('data/joyn-luecke-ausnahmen.json', ausnahmen)
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-joyn-luecke-bestand.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}
const warnungen = (a: string): number => (a.match(/⚠ WARNUNG/g) ?? []).length

try {
  const offen = lauf([])
  pruefe('ohne Ausnahmen: Exit 0, je eine Warnung für Anime-Lücke und Cartoon-Lücke', offen.status === 0 && warnungen(offen.ausgabe) === 2 && offen.ausgabe.includes('Titel 900001') && offen.ausgabe.includes('Titel -900002'), offen.ausgabe)
  pruefe('Ergebniszeile nennt 2 Lücken von 4 Titeln, 0 Ausnahmen, 2 offen', offen.ausgabe.includes('2 von 4 Titeln mit JustWatch-Joyn ohne Joyn-Weg, 0 Ausnahmen, 2 offen, 0 Ausnahmen ohne Lücke'), offen.ausgabe)
  const eine = lauf([{ id: 900001, grund: 'Probe' }])
  pruefe('eine Ausnahme deckt genau ihre Lücke: eine Warnung bleibt', eine.status === 0 && warnungen(eine.ausgabe) === 1 && eine.ausgabe.includes('Titel -900002') && !eine.ausgabe.includes('Titel 900001'), eine.ausgabe)
  const beide = lauf([{ id: 900001, grund: 'Probe' }, { id: -900002, grund: 'Probe' }])
  pruefe('beide Ausnahmen: Exit 0, keine Warnung', beide.status === 0 && warnungen(beide.ausgabe) === 0 && beide.ausgabe.includes('2 Ausnahmen, 0 offen, 0 Ausnahmen ohne Lücke'), beide.ausgabe)
  const veraltet = lauf([{ id: 900001, grund: 'Probe' }, { id: -900002, grund: 'Probe' }, { id: 900003, grund: 'Probe' }])
  pruefe('Ausnahme für einen Titel mit Joyn-Weg: eine Warnung „gilt nicht mehr“', veraltet.status === 0 && warnungen(veraltet.ausgabe) === 1 && veraltet.ausgabe.includes('Ausnahme für Titel 900003 gilt nicht mehr'), veraltet.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK — 5 Fälle')
