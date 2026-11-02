/**
 * Der echte Lauf von `check-folgentitel-sprache-bestand.ts` (Tor `check:bestand`) ruft die Lückenprüfung auf: gegen eine Kulisse mit 1.000 Folgenlisten,
 * auf der Arbeitsverzeichnis-Wurzel wie im Bau. Fängt, wenn der Aufruf `pruefeLuecken` fehlt (dann bliebe die fehlende Liste ohne Folge)
 * oder die Warnzeilen nicht ausgegeben werden. Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'folgentitel-luecke-lauf-'))
const schreibe = (pfad: string[], inhalt: unknown): void => {
  mkdirSync(join(kulisse, ...pfad.slice(0, -1)), { recursive: true })
  writeFileSync(join(kulisse, ...pfad), JSON.stringify(inhalt))
}
const titel21 = Array.from({ length: 21 }, (_, i) => [i + 1, `Titel ${i + 1}`])
for (let id = 1; id <= 1000; id++) schreibe(['public', 'data', 'folgen', `${id}.json`], { f: titel21, de: [[1, 21]] })
for (const name of ['anisearch-folgen', 'kitsu-folgen', 'tmdb-folgen', 'anisearch']) schreibe(['data', `${name}.json`], {})
schreibe(['data', 'rtlplus-folgen.json'], { titel: {} })

function lauf(): { status: number | null; aus: string; fehler: string } {
  const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline', 'check-folgentitel-sprache-bestand.ts')], { cwd: kulisse, encoding: 'utf8', timeout: 120_000, windowsHide: true })
  return { status: r.status, aus: r.stdout, fehler: r.stderr }
}

try {
  console.log('\nTor check:bestand ruft die Lückenprüfung')
  const ohneListe = lauf()
  pruefe('ohne Lückenliste: Exit 1 und „Lückenliste … fehlt" (Prozess lief bis zum Ende, Schlusszeile da)', ohneListe.status === 1 && ohneListe.fehler.includes('Lückenliste folgentitel-offen.json fehlt') && ohneListe.aus.includes('check-folgentitel-sprache-bestand:'), [ohneListe.status, ohneListe.fehler.slice(0, 300)])
  schreibe(['data', 'folgentitel-offen.json'], {})
  const sauber = lauf()
  pruefe('mit leerer Liste und ohne Lücken: Exit 0 und ✓-Zeile', sauber.status === 0 && sauber.aus.includes('✓ Folgentitel: 0 Folgen ohne deutschen Titel in 0 Titeln'), [sauber.status, sauber.aus.slice(-300), sauber.fehler.slice(0, 200)])
  schreibe(['public', 'data', 'folgen', '7.json'], { f: [[1, 'Eins'], ...Array.from({ length: 20 }, (_, i) => [i + 2, i === 4 ? '' : `Titel ${i + 2}`])], de: [[1, 21]] })
  const mitLuecke = lauf()
  pruefe('eine Lücke, nicht gelistet: Exit 0 und eine Warnzeile mit der Kennung 7', mitLuecke.status === 0 && mitLuecke.aus.includes('⚠ WARNUNG Folgentitel: 1 Titel mit mehr Lücken') && mitLuecke.aus.includes(': 7'), [mitLuecke.status, mitLuecke.aus.slice(-400)])
  schreibe(['data', 'folgentitel-offen.json'], { '7': { offen: 1, grund: 'Kulisse' } })
  const gelistet = lauf()
  pruefe('dieselbe Lücke gelistet: keine Warnzeile, ✓ mit einer Folge', gelistet.status === 0 && !gelistet.aus.includes('WARNUNG') && gelistet.aus.includes('✓ Folgentitel: 1 Folgen ohne deutschen Titel in 1 Titeln'), [gelistet.status, gelistet.aus.slice(-300)])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(`\ncheck-folgentitel-luecke-lauf: ${verletzt ? `${verletzt} Fehler` : 'ok'} (${faelle} Fälle)`)
process.exit(verletzt ? 1 : 0)
