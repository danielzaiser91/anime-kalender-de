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
const fuenf = bewerteOffenDatei(datei(fehlt(5)))
pruefe('genau 5: nur Warnung (rot stoppt den Bestandsbau), deutlicherer Text', fuenf.stufe === 'warnung' && fuenf.fehlt === 5 && fuenf.text.includes('länger nicht'), fuenf)
pruefe('4: der Text ist noch der einfache', !gemischt.text.includes('länger nicht'), gemischt)
const mitNull = bewerteOffenDatei(JSON.stringify({ anzahl: 3, serien: [null, { grund: 'titelliste-fehlt' }, 7] }))
pruefe('null und Zahl als Eintrag: kein Absturz, zählt nur den echten', mitNull.stufe === 'warnung' && mitNull.fehlt === 1, mitNull)
pruefe('nur null-Einträge: ok, 0', stufe('{"anzahl":1,"serien":[null]}') === 'ok')
pruefe('4 plus 10 andere (Gesamt über 5): Warnung, einfacher Text', stufe(datei([...fehlt(4), ...Array(10).fill('kein-kandidat')])) === 'warnung')

const ordner = mkdtempSync(join(tmpdir(), 'adn-offen-wache-'))
const skript = fileURLToPath(new URL('./check-adn-offen-bestand.ts', import.meta.url))
function prozess(name: string, inhalt: string | null): { status: number; out: string; err: string } {
  const d = join(ordner, name)
  if (inhalt !== null) writeFileSync(d, inhalt)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, d], { encoding: 'utf8', windowsHide: true })
  return { status: r.status ?? -1, out: r.stdout, err: r.stderr }
}
const warnung = prozess('a.json', datei(fehlt(2)))
pruefe('Prozess: Warnung endet mit Exit 0, Zeile "⚠ WARNUNG ADN-Titelliste" auf stdout', warnung.status === 0 && warnung.out.includes('⚠ WARNUNG ADN-Titelliste:'), warnung)
const viele = prozess('b.json', datei(fehlt(6)))
pruefe('Prozess: viele (6) enden ebenfalls mit Exit 0 und Warnzeile', viele.status === 0 && viele.out.includes('⚠ WARNUNG'), viele)
const weg = prozess('c.json', null)
pruefe('Prozess: fehlende Datei endet mit Exit 1, Meldung auf stderr (nicht stdout)', weg.status === 1 && weg.err.includes('✖ ADN-Titelliste:') && weg.out === '', weg)
const kaputt = prozess('e.json', '{kaputt')
pruefe('Prozess: kaputte Datei endet mit Exit 1, Meldung auf stderr', kaputt.status === 1 && kaputt.err.includes('kein gültiges JSON') && kaputt.out === '', kaputt)
const falscheAnzahl = prozess('f.json', datei(fehlt(1), 7))
pruefe('Prozess: falsche Anzahl endet mit Exit 1, Meldung auf stderr', falscheAnzahl.status === 1 && falscheAnzahl.err.includes('passt nicht'), falscheAnzahl)
const gut = prozess('d.json', datei([]))
pruefe('Prozess: ok endet mit Exit 0, Zeile mit ✓ auf stdout', gut.status === 0 && gut.out.includes('✓ ADN-Titelliste:') && gut.err === '', gut)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
