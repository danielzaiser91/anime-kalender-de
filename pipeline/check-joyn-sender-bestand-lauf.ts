/**
 * Prozesstest zu `check-joyn-sender-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`), endet immer mit Exit 0;
 * eine Lücke erscheint als `⚠ WARNUNG`-Zeile (die `commit-data.sh` greift) mit Titel und Sender, ohne Lücke fehlt die Zeile. Läuft in `check:logic`.
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
const wurzel = mkdtempSync(join(tmpdir(), 'joyn-bestand-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
const schreibe = (pfad: string, inhalt: unknown): void => writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
const tv = (titleId: number, name: string) => ({ slug: `s${titleId}`, titleId, name, platform: 'tv', sender: 'ProSieben MAXX', schedule: { firstEpisodeDate: '2026-01-01' } })

function lauf(titel: unknown[]): { status: number | null; ausgabe: string } {
  schreibe('public/data/releases.json', [tv(900001, 'Lücke Eins'), tv(900002, 'Mit Joyn')])
  schreibe('public/data/titles.json', titel)
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-joyn-sender-bestand.ts')], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}

try {
  const offen = lauf([{ id: 900001, streams: [] }, { id: 900002, streams: [{ platform: 'joyn', url: '' }] }])
  pruefe('mit Lücke: Exit 0, genau eine Warnzeile mit Titel und Sender, der Titel mit Joyn-Weg fehlt', offen.status === 0 && (offen.ausgabe.match(/⚠ WARNUNG Joyn-Lücke: 1 Titel/g) ?? []).length === 1 && offen.ausgabe.includes('Lücke Eins (900001, ProSieben MAXX)') && !offen.ausgabe.includes('Mit Joyn'), offen.ausgabe)
  pruefe('Ergebniszeile nennt die Zahl der Lücken', offen.ausgabe.includes('Joyn-Lücke (TV-Termin ohne Joyn-Weg): 1'), offen.ausgabe)
  const zu = lauf([{ id: 900001, streams: [{ platform: 'joyn', url: '' }] }, { id: 900002, streams: [{ platform: 'joyn', url: '' }] }])
  pruefe('ohne Lücke: Exit 0, keine Warnzeile, Zahl 0', zu.status === 0 && !zu.ausgabe.includes('⚠ WARNUNG') && zu.ausgabe.includes('Joyn-Lücke (TV-Termin ohne Joyn-Weg): 0'), zu.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-joyn-sender-bestand-lauf: OK — Warnzeile mit Lücke, still ohne Lücke')
