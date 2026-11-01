/**
 * Prozesstest zu `check-anisearch-paar-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel (er liest relativ zum Arbeitsordner) und
 * endet immer mit Exit 0; ein offener Widerspruch erscheint als `⚠ WARNUNG`, ein verworfener oder unverdächtiger nicht. Aufruf: npm run check:logic oder
 * `tsx pipeline/check-anisearch-paar-bestand-lauf.ts`
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
const wurzel = mkdtempSync(join(tmpdir(), 'paar-bestand-'))
mkdirSync(join(wurzel, 'data'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
const schreibe = (pfad: string, inhalt: unknown): void => writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
/* MAL 700001 ↔ Seite 9000001: zwei Werke; MAL 700002 ↔ Seite 9000002: gleicher Name, nur Umschrift. */
schreibe('data/anisearch-mal.json', { 700001: 9_000_001, 700002: 9_000_002 })
schreibe('data/anisearch-ids-katalog.json', { 900001: 9_000_001 })
schreibe('data/anisearch-eintraege.json', {
  9000001: { t: 'Ccc Ddd', y: 2020, f: 10 },
  9000002: { t: 'Honekami', y: 2023, f: 1 },
})
schreibe('public/data/titles.json', [
  { id: 900001, malId: 700001, titleRomaji: 'Aaa Bbb', jpYear: 2020, episodes: 1 },
  { id: 900002, malId: 700002, titleRomaji: 'Hone Kami', jpYear: 2021, episodes: 1 },
])
schreibe('public/data/ohne-synchro.json', [])

function lauf(verworfen: unknown): { status: number | null; ausgabe: string } {
  schreibe('data/anisearch-mal-verworfen.json', verworfen)
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-anisearch-paar-bestand.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}

try {
  const offen = lauf({})
  pruefe('ohne Streichliste: Exit 0, genau eine Warnung für das Fehlpaar, die Umschrift bleibt still', offen.status === 0 && (offen.ausgabe.match(/⚠ WARNUNG/g) ?? []).length === 1 && offen.ausgabe.includes('MAL 700001'), offen.ausgabe)
  pruefe('Ergebniszeile nennt 2 geprüfte Paare und 1 offenen Widerspruch', offen.ausgabe.includes('2 Paare mit Titel und Seiteneintrag geprüft, 0 verworfen, 1 offener Widerspruch'), offen.ausgabe)
  const verworfen = lauf({ 700001: { anisearch: 9_000_001, grund: 'Probe' } })
  pruefe('mit Eintrag auf der Liste: Exit 0, keine Warnung', verworfen.status === 0 && !verworfen.ausgabe.includes('⚠ WARNUNG') && verworfen.ausgabe.includes('1 verworfen, 0 offener Widerspruch'), verworfen.ausgabe)
  const andereSeite = lauf({ 700001: { anisearch: 9_000_009, grund: 'Probe' } })
  pruefe('Eintrag mit anderer Seite deckt das Paar nicht: Warnung bleibt', andereSeite.status === 0 && andereSeite.ausgabe.includes('⚠ WARNUNG'), andereSeite.ausgabe)
  const katalogBindet = lauf({ 700001: { anisearch: 9_000_001, anilist: 900001, grund: 'Probe' } })
  pruefe('Katalog bindet die verworfene Seite: genau eine Katalog-Warnung', katalogBindet.status === 0 && (katalogBindet.ausgabe.match(/aniSearch-Katalog bindet/g) ?? []).length === 1, katalogBindet.ausgabe)
  const katalogAnders = lauf({ 700001: { anisearch: 9_000_001, anilist: 900002, grund: 'Probe' } })
  pruefe('Katalog führt den Titel nicht mit dieser Seite: keine Katalog-Warnung', katalogAnders.status === 0 && !katalogAnders.ausgabe.includes('aniSearch-Katalog bindet'), katalogAnders.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK — 6 Fälle')
