/**
 * Wächter für das Website-Hosting auf Cloudflare (`tools/web-hosting.ts`): Dateibudget von `dist/` und die
 * Website-Config `wrangler.web.jsonc` ohne Worker-Code und ohne Bindings.
 *
 * Aufruf: `npx tsx tools/web-hosting.test.ts`
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bewerteDateibudget, dateibudgetErgebnis, leseJsonc, pruefeWebConfig, zaehleDateien } from './web-hosting.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

// Dateibudget: genau am Budget grün, eins drüber rot; Prognose aus dem Zuwachs je Tag.
pruefe(bewerteDateibudget(15_000, '2026-10-17').ok, 'Budget erreicht (15.000) ist grün')
pruefe(!bewerteDateibudget(15_001, '2026-10-17').ok, 'Budget + 1 (15.001) ist rot')
pruefe(!bewerteDateibudget(20_000, '2026-10-17').ok, 'Grenze 20.000 ist rot')
const heute = bewerteDateibudget(10_169, '2026-10-17').text
pruefe(heute.startsWith('10169 Dateien in dist/ (Budget 15000, Grenze 20000)'), `Text nennt Zahl, Budget und Grenze: ${heute}`)
pruefe(bewerteDateibudget(20_000, '2026-10-17').text.includes('Grenze erreicht'), 'an der Grenze: Grenze erreicht')
// (15000 − 10169) / 73 = 66,2 → 67 Tage; (20000 − 10169) / 73 = 134,7 → 135 Tage; (20000 − 15500) / 73 = 61,6 → 62 Tage.
pruefe(heute.includes('Budget ≈ 2026-12-23') && heute.includes('Grenze ≈ 2027-03-01'), 'Prognose: Budget 23.12.2026, Grenze 01.03.2027')
pruefe(bewerteDateibudget(15_500, '2026-10-17').text.includes('Budget erreicht, Grenze ≈ 2026-12-18'), 'Prognose über dem Budget: erreicht, Grenze nach 62 Tagen (18.12.2026)')

// Website-Config: die echte ist sauber, jede Abweichung wird gemeldet.
const echt = leseJsonc(readFileSync(join(wurzel, 'wrangler.web.jsonc'), 'utf8'))
pruefe(pruefeWebConfig(echt).length === 0, `wrangler.web.jsonc ist sauber ${JSON.stringify(pruefeWebConfig(echt))}`)
const mit = (aenderung: Record<string, unknown>) => pruefeWebConfig({ ...echt, ...aenderung })
const mitAssets = (aenderung: Record<string, unknown>) => mit({ assets: { ...(echt.assets as object), ...aenderung } })
const faelle: [string, string[]][] = [
  ['main gesetzt', mit({ main: 'src/index.ts' })],
  ['D1-Bindung', mit({ d1_databases: [{ binding: 'DB', database_name: 'x', database_id: 'y' }] })],
  ['KV-Bindung', mit({ kv_namespaces: [{ binding: 'KV', id: 'x' }] })],
  ['R2-Bindung', mit({ r2_buckets: [{ binding: 'R2', bucket_name: 'x' }] })],
  ['Service-Bindung', mit({ services: [{ binding: 'NEWSLETTER', service: 'newsletter' }] })],
  ['assets.run_worker_first', mitAssets({ run_worker_first: true })],
  ['assets.binding', mitAssets({ binding: 'ASSETS' })],
  ['SPA-Fallback (Soft-404)', mitAssets({ not_found_handling: 'single-page-application' })],
  ['anderer Name', mit({ name: 'anime-kalender-de' })],
  ['anderes Verzeichnis', mitAssets({ directory: './public' })],
]
for (const [name, gefunden] of faelle) pruefe(gefunden.length === 1, `${name} wird gemeldet: ${gefunden.join('; ')}`)
const ohneAssets = pruefeWebConfig({ name: 'anime-kalender-web' })
pruefe(ohneAssets.length === 2, `ohne assets: Verzeichnis und 404-Seite fehlen ${JSON.stringify(ohneAssets)}`)
pruefe(leseJsonc('// Kommentar\n{ "a": 1 }').a === 1, 'JSONC: Kommentarzeile fällt weg')

// Ohne Wurzel-Config greift `wrangler` ohne --config nichts Falsches (die alte SPA-Config, 26.08.2026).
for (const name of ['wrangler.json', 'wrangler.jsonc', 'wrangler.toml']) pruefe(!existsSync(join(wurzel, name)), `keine ${name} in der Wurzel`)

// Verdrahtung: beide Bauketten enden mit dem Dateibudget (bei `build` innerhalb der Spur `bau-eingaben.mjs`).
const skripte = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')).scripts as Record<string, string>
for (const name of ['build', 'build:schlank']) pruefe(skripte[name].replace(/node tools\/bau-eingaben\.mjs "([^"]*)"/, (_, innen) => innen).endsWith(' && tsx tools/dateibudget.ts'), `${name} endet mit tsx tools/dateibudget.ts`)

// Deploy nennt die Website-Config (ohne --config findet wrangler keine), und die Vite-Config lädt kein Cloudflare-Plugin mehr.
pruefe(skripte.deploy.endsWith(' wrangler deploy --config wrangler.web.jsonc'), 'deploy nennt --config wrangler.web.jsonc')
pruefe(!readFileSync(join(wurzel, 'vite.config.ts'), 'utf8').includes('cloudflare'), 'vite.config.ts lädt kein Cloudflare-Plugin')

// Exit-Code des Laufs: am Budget 0, eins drüber 1 mit FEHL.
const amBudget = dateibudgetErgebnis(15_000, '2026-10-17')
pruefe(amBudget.code === 0 && !amBudget.zeile.includes('FEHL') && amBudget.zeile.includes('Budget erreicht, Grenze ≈ 2026-12-25'), `am Budget Exit 0: ${amBudget.zeile}`)
const drueber = dateibudgetErgebnis(15_001, '2026-10-17')
pruefe(drueber.code === 1 && drueber.zeile.includes('FEHL 15001 Dateien'), `eins drüber Exit 1: ${drueber.zeile}`)

// Der Zähler zählt Dateien in allen Ebenen, nicht Ordner; der Lauf meldet die Zahl (1 + 2 + 3 = 6).
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const tmp = mkdtempSync(join(tmpdir(), 'dateibudget-'))
try {
  mkdirSync(join(tmp, 'a', 'b', 'leer'), { recursive: true })
  for (const datei of ['x', 'a/x', 'a/y', 'a/b/x', 'a/b/y', 'a/b/z']) writeFileSync(join(tmp, datei), '')
  pruefe(zaehleDateien(tmp) === 6, `zaehleDateien: ${zaehleDateien(tmp)}, erwartet 6`)
  const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'tools/dateibudget.ts'), tmp], { encoding: 'utf8' })
  pruefe(lauf.status === 0 && lauf.stdout.startsWith('[dateibudget] 6 Dateien in dist/'), `Lauf: ${lauf.stdout.trim()}`)
  // Aufruf ohne Argument (so ruft ihn `build` auf) zählt `dist/` im Arbeitsordner, nicht den Nachbarn `public/` (3 gegen 5 Dateien).
  mkdirSync(join(tmp, 'ohne', 'dist'), { recursive: true })
  mkdirSync(join(tmp, 'ohne', 'public'), { recursive: true })
  for (const datei of ['dist/a', 'dist/b', 'dist/c', 'public/a', 'public/b', 'public/c', 'public/d', 'public/e']) writeFileSync(join(tmp, 'ohne', datei), '')
  const ohneArg = spawnSync(process.execPath, [tsx, join(wurzel, 'tools/dateibudget.ts')], { encoding: 'utf8', cwd: join(tmp, 'ohne') })
  pruefe(ohneArg.status === 0 && ohneArg.stdout.startsWith('[dateibudget] 3 Dateien in dist/'), `Lauf ohne Argument zählt dist/: ${ohneArg.stdout.trim()}${ohneArg.stderr.trim()}`)
  // Rotpfad ohne 15.001 echte Dateien (auf Windows Minuten): ein Vorlader meldet für den Ordner „GROSS“ 15.001 Dateien.
  const vorlader = join(tmp, 'gross.mjs')
  writeFileSync(
    vorlader,
    [
      "import fs from 'node:fs'",
      "import { syncBuiltinESMExports } from 'node:module'",
      'const echt = fs.readdirSync',
      "fs.readdirSync = (p, o) => (String(p).endsWith('GROSS') ? Array.from({ length: 15001 }, () => ({ isFile: () => true })) : echt(p, o))",
      'syncBuiltinESMExports()',
    ].join('\n'),
  )
  const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(vorlader).href}` }
  const rot = spawnSync(process.execPath, [tsx, join(wurzel, 'tools/dateibudget.ts'), join(tmp, 'GROSS')], { encoding: 'utf8', env })
  pruefe(rot.status === 1 && rot.stderr.startsWith('[dateibudget] FEHL 15001 Dateien') && !rot.stdout, `Lauf über dem Budget: Exit ${rot.status}, ${rot.stderr.trim()}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler) {
  console.error(`web-hosting: ${fehler} Fehler`)
  process.exit(1)
}
console.log('web-hosting: alles grün')
