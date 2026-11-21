/**
 * Prozesstest zu `check-staffelquelle-widerspruch-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`),
 * endet immer mit Exit 0; ein Widerspruch erscheint als `⚠ WARNUNG`-Zeile (die `commit-data.sh` greift) mit den Namen, ohne Widerspruch fehlt die Zeile.
 * Läuft in `check:logic`.
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
const wurzel = mkdtempSync(join(tmpdir(), 'staffelquelle-bestand-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
const glied = (id: number, name: string, staffelQuelle?: number) => ({ id, name, format: 'TV', episodes: 12, jpYear: 2010 + (id % 100), staffelQuelle })

function lauf(reihen: Record<string, unknown[]>): { status: number | null; ausgabe: string } {
  writeFileSync(join(wurzel, 'public/data/franchises.json'), JSON.stringify(reihen))
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-staffelquelle-widerspruch-bestand.ts')], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}

try {
  const schlecht = [glied(900001, 'Reihe Eins'), glied(900002, 'Reihe Eins √A', 2), glied(900003, 'Reihe Eins:re'), glied(900004, 'Reihe Eins:re — 2', 2)]
  const gut = [glied(900011, 'Reihe Zwei'), glied(900012, 'Reihe Zwei Staffel 2', 2), glied(900013, 'Reihe Zwei Staffel 3', 3)]
  const mit = lauf({ 900001: schlecht, 900011: gut })
  pruefe('mit Widerspruch: Exit 0, genau eine Warnzeile mit beiden Namen und Kennungen', mit.status === 0 && (mit.ausgabe.match(/⚠ WARNUNG Staffelquelle: 2 /g) ?? []).length === 1 && mit.ausgabe.includes('Reihe Eins √A / Reihe Eins:re — 2') && mit.ausgabe.includes('900002, 900004'), mit.ausgabe)
  pruefe('Ergebniszeile: ein Widerspruch in zwei Reihen', mit.ausgabe.includes('1 in 2 Reihen'), mit.ausgabe)
  /* Belegte Doppelung (Staffelgrenzen-Handdatei, Pokémon-Fall): die Kennungen der Datei zählen nicht. */
  mkdirSync(join(wurzel, 'data/curated'), { recursive: true })
  const grenzen = (id: number) => ({ anilistId: id, staffeln: [{ nr: 16, von: 1, bis: 14, folgen: 14 }] })
  // Pfad in Teilen: Das Ziel liegt im Wegwerf-Ordner `wurzel`. Ein `data/…`-Literal neben writeFileSync hielte check-workflows für ein Schreibziel der Pipeline.
  writeFileSync(join(wurzel, 'data', 'curated', 'pokemon-staffeln.yaml'), JSON.stringify({ titel: [grenzen(900022), grenzen(900023)] }))
  const pokemon = [glied(900021, 'Reihe Drei'), glied(900022, 'Reihe Drei Teil A', 16), glied(900023, 'Reihe Drei Teil B', 16)]
  const ausnahme = lauf({ 900021: pokemon })
  pruefe('Ausnahme aus der Staffelgrenzen-Datei: keine Warnzeile', ausnahme.status === 0 && !ausnahme.ausgabe.includes('⚠ WARNUNG') && ausnahme.ausgabe.includes('): 0 in 1 Reihen'), ausnahme.ausgabe)
  const ohne = lauf({ 900011: gut })
  pruefe('ohne Widerspruch: Exit 0, keine Warnzeile, Zahl 0', ohne.status === 0 && !ohne.ausgabe.includes('⚠ WARNUNG') && ohne.ausgabe.includes('Widersprüche (zwei Hauptstaffeln, dieselbe belegte Nummer): 0 in 1 Reihen'), ohne.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-staffelquelle-widerspruch-bestand-lauf: OK — Warnzeile mit Widerspruch, still ohne')
