/** Test der Wache `check-adn-offen-bestand.ts` mit Kulisse (kein Echtdatenzugriff). */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { bewerteOffenDatei } from './lib/adn-offen-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const datei = (gruende: string[], anzahl = gruende.length) =>
  JSON.stringify({ anzahl, serien: gruende.map((grund, i) => ({ showId: 100 + i, grund, kandidaten: [] })) })
const fehlt = (n: number) => Array(n).fill('titelliste-fehlt') as string[]
const stufe = (s: string | null) => bewerteOffenDatei(s).stufe

pruefe('Datei fehlt: rot', stufe(null) === 'rot')
pruefe('kein JSON: rot', stufe('{kaputt') === 'rot')
pruefe('leere Datei: rot', stufe('') === 'rot')
pruefe('Feld serien fehlt: rot', stufe('{"anzahl":0}') === 'rot')
pruefe('serien keine Liste: rot', stufe('{"anzahl":0,"serien":{}}') === 'rot')
pruefe('anzahl passt nicht: rot', stufe(datei(fehlt(1), 7)) === 'rot')
pruefe('null als Inhalt: rot', stufe('null') === 'rot')
pruefe('leere Liste: ok, 0', stufe(datei([])) === 'ok' && bewerteOffenDatei(datei([])).fehlt === 0)
pruefe('andere Gründe zählen nicht: ok', stufe(datei(['kein-kandidat', 'mehrdeutig', 'vergeben'])) === 'ok')
pruefe('genau 1: Warnung, fehlt 1', stufe(datei(fehlt(1))) === 'warnung' && bewerteOffenDatei(datei(fehlt(1))).fehlt === 1)
const gemischt = bewerteOffenDatei(datei([...fehlt(4), 'mehrdeutig']))
pruefe('4 mit Fremdgrund gemischt: Warnung, fehlt 4', gemischt.stufe === 'warnung' && gemischt.fehlt === 4, gemischt)
pruefe('genau 5: rot', stufe(datei(fehlt(5))) === 'rot')
pruefe('4 plus 10 andere (Gesamt über 5): Warnung', stufe(datei([...fehlt(4), ...Array(10).fill('kein-kandidat')])) === 'warnung')

const ordner = mkdtempSync(join(tmpdir(), 'adn-offen-wache-'))
const skript = fileURLToPath(new URL('./check-adn-offen-bestand.ts', import.meta.url))
function prozess(name: string, inhalt: string | null): number {
  const d = join(ordner, name)
  if (inhalt !== null) writeFileSync(d, inhalt)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, d], { encoding: 'utf8', windowsHide: true })
  return r.status ?? -1
}
pruefe('Prozess: Warnung endet mit Exit 0', prozess('a.json', datei(fehlt(2))) === 0)
pruefe('Prozess: rot endet mit Exit 1', prozess('b.json', datei(fehlt(6))) === 1)
pruefe('Prozess: fehlende Datei endet mit Exit 1', prozess('c.json', null) === 1)
pruefe('Prozess: ok endet mit Exit 0', prozess('d.json', datei([])) === 0)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
