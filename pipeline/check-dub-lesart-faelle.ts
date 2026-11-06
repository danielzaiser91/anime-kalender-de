/**
 * Fälle zur Ratsche `check-dub-lesart.ts`: reine Funktion (Syntaxbaum), das Urteil über Zählstand und Grenzen
 * und der Wächter als Prozess gegen eine Wegwerf-Wurzel unter os.tmpdir() (einmal mit echtem git).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { basisFehlt, urteil } from './check-dub-lesart.ts'
import { dubLesart, dubLesungen, offeneLesungen } from './lib/dub-lesart.ts'

const wurzel = resolve(import.meta.dirname, '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const offen = (text: string): number => offeneLesungen(text).length
const fn = (zeilen: string[]): string => `function a(t) {\n${zeilen.map((z) => `  ${z}`).join('\n')}\n}\n`

const ROH = fn(['return t.streams.some((s) => s.dub === true)'])
const NACHBAR = `function b(s) {\n  return s.dubAbgeleitet\n}\n${fn(['return t.streams.some((s) => s.dub === true)'])}`

// Reine Funktion: Lesungen und Helfer
pruefe('rohe Lesung ist offen, Zeile 2', JSON.stringify(offeneLesungen(ROH).map((l) => l.zeile)) === '[2]', offeneLesungen(ROH))
pruefe('dubAbgeleitet als Bezeichner in der Funktion: in Ordnung', offen(fn(['return t.streams.some((s) => s.dub === true && !s.dubAbgeleitet)'])) === 0)
pruefe('istLautAnbieter als Bezeichner in der Funktion: in Ordnung', offen(fn(['return t.streams.some((s) => s.dub === true && !istLautAnbieter(s))'])) === 0)
pruefe('dubAbgeleitet in der Nachbarfunktion deckt nicht', offen(NACHBAR) === 1)
pruefe('dubAbgeleitet nur im Kommentar deckt nicht (A3)', offen(fn(['// dubAbgeleitet', 'return t.streams.some((s) => s.dub === true)'])) === 1)
pruefe('istLautAnbieter nur in einer Zeichenkette deckt nicht (A3)', offen(fn(["const w = 'istLautAnbieter'", 'return t.streams.some((s) => s.dub === true)'])) === 1)
pruefe('Lambda auf Dateiebene: das Wort in einer anderen Anweisung deckt nicht (A3)', offen("const dubAbgeleitet = 1\nexport const L = [(s) => s.dub === true]\n") === 1)
pruefe('Lambda auf Dateiebene mit Helfer in derselben Anweisung: in Ordnung', offen('export const L = [(s) => s.dub === true && !s.dubAbgeleitet]\n') === 0)
pruefe('true === s.dub wird gelesen', dubLesungen(fn(['return true === s.dub'])).length === 1)
pruefe('s.dub == true wird gelesen (A6)', dubLesungen(fn(['return s.dub == true'])).length === 1)
pruefe('(s.dub) === true wird gelesen (A6)', dubLesungen(fn(['return (s.dub) === true'])).length === 1)
pruefe('s.dub === (true) wird gelesen (A6)', dubLesungen(fn(['return s.dub === (true)'])).length === 1)
pruefe("s['dub'] === true wird gelesen (A6)", dubLesungen(fn(["return s['dub'] === true"])).length === 1)
pruefe("s[schluessel] === true ist keine Lesung (Header: nicht gesehen)", dubLesungen(fn(['return s[schluessel] === true'])).length === 0)
pruefe('Kommentar, Zeichenkette, === false, bloßes s.dub: keine Lesung', dubLesungen("// s.dub === true\nconst t = 's.dub === true'\nfunction a(s) {\n  return s.dub === false || s.dub\n}\n").length === 0)
pruefe('Setzen (dub = true, dub: true) ist keine Lesung', dubLesungen(fn(['s.dub = true', 'return { dub: true }'])).length === 0)
pruefe('Pfeilfunktion mit Helfer: in Ordnung', offen('export const a = (t) => {\n  return t.streams.some((s) => s.dub === true && !s.dubAbgeleitet)\n}\n') === 0)
pruefe('Pfeilfunktion ohne Helfer: offen', offen('export const a = (t) => {\n  return t.streams.some((s) => s.dub === true)\n}\n') === 1)

// Marken
pruefe('Marke mit Grund in der Zeile davor: in Ordnung', offen(fn(['// dub-lesart: irgendwie – Menge', 'return t.streams.some((s) => s.dub === true)'])) === 0)
pruefe('Marke mit Grund in derselben Zeile: in Ordnung', offen(fn(['return t.streams.some((s) => s.dub === true) // dub-lesart: handbeleg'])) === 0)
pruefe('Marke zwei Zeilen davor deckt nicht', offen(fn(['// dub-lesart: irgendwie', 'const x = 1', 'return t.streams.some((s) => s.dub === true)'])) === 1)
pruefe('Marke ohne Grund deckt nicht (A1)', offen(fn(['return t.streams.some((s) => s.dub === true) // dub-lesart:'])) === 1)
pruefe('Marke ohne Grund auf der Zeile davor deckt nicht (A1)', offen(fn(['// dub-lesart:', 'return t.streams.some((s) => s.dub === true)'])) === 1)
const LECK = fn(['const a = t.streams.some((s) => s.dub === true) // dub-lesart: irgendwie', 'const b = t.streams.some((s) => s.dub === true)', 'return a && b'])
pruefe('Marke mit Code in Zeile N deckt Zeile N+1 nicht (A2)', JSON.stringify(offeneLesungen(LECK).map((l) => l.zeile)) === '[3]', offeneLesungen(LECK))
const TOT = fn(['// dub-lesart: irgendwie – ohne Lesung darunter', 'const x = 1', 'return x'])
pruefe('tote Marke wird gezählt (A4)', dubLesart(TOT).marken === 1 && dubLesart(TOT).tote === 1, dubLesart(TOT))
pruefe('Marke ohne Grund ist tot (A4)', dubLesart(fn(['return s.dub === true // dub-lesart:'])).tote === 1)
pruefe('gedeckte Marke ist nicht tot', dubLesart(fn(['return s.dub === true // dub-lesart: handbeleg'])).tote === 0)

// Urteil über Zählstand, Grenzen, Basis
const ST = (n: number, m: number, t: string[] = []) => ({ offen: Array.from({ length: n }, (_, i) => `x.ts:${i + 1}`), marken: m, tote: t })
pruefe('Urteil: Stand gleich Grenze ist in Ordnung', urteil(ST(2, 3), { offen: 2, marken: 3 }).length === 0)
pruefe('Urteil: mehr offene Stellen als Grenze rot', urteil(ST(3, 3), { offen: 2, marken: 3 }).length === 1)
pruefe('Urteil: mehr Marken als Grenze rot (A4)', urteil(ST(2, 4), { offen: 2, marken: 3 }).length === 1)
pruefe('Urteil: tote Marke rot (A4)', urteil(ST(2, 3, ['x.ts (1)']), { offen: 2, marken: 3 }).length === 1)
pruefe('Urteil: Grenze offen zu hoch meldet „auf 1 senken“ (A8)', urteil(ST(1, 3), { offen: 2, marken: 3 }).some((f) => f.includes('auf 1 senken')))
pruefe('Urteil: Grenze marken zu hoch meldet „auf 2 senken“ (A8)', urteil(ST(2, 2), { offen: 2, marken: 3 }).some((f) => f.includes('auf 2 senken')))
pruefe('Urteil: Basis niedriger bei offen ist rot (A8)', urteil(ST(2, 3), { offen: 2, marken: 3 }, { offen: 1, marken: 3 }).some((f) => f.includes('Basis erhöht')))
pruefe('Urteil: Basis niedriger bei marken ist rot (A8)', urteil(ST(2, 3), { offen: 2, marken: 3 }, { offen: 2, marken: 2 }).some((f) => f.includes('Basis erhöht')))
pruefe('Basis fehlt: in CI Meldung', basisFehlt(undefined, true) !== undefined)
pruefe('Basis fehlt: ohne CI keine Meldung', basisFehlt(undefined, false) === undefined)
pruefe('Basis da: in CI keine Meldung', basisFehlt({ offen: 1, marken: 1 }, true) === undefined)
pruefe('Urteil: Basis gleich ist in Ordnung', urteil(ST(2, 3), { offen: 2, marken: 3 }, { offen: 2, marken: 3 }).length === 0)

// Prozess gegen Wegwerf-Wurzel
function kulisseAnlegen(dateien: Record<string, string>, grenzen: { offen: number; marken: number }): string {
  const kulisse = mkdtempSync(join(tmpdir(), 'dub-lesart-'))
  mkdirSync(join(kulisse, 'shared'))
  mkdirSync(join(kulisse, 'pipeline/bau'), { recursive: true })
  mkdirSync(join(kulisse, 'tools'))
  writeFileSync(join(kulisse, 'tools/dub-lesart-grenzen.json'), JSON.stringify(grenzen))
  for (const [pfad, text] of Object.entries(dateien)) writeFileSync(join(kulisse, pfad), text)
  return kulisse
}

function wachter(kulisse: string, extra: string[] = [], ci = false): { status: number | null; aus: string } {
  const env = { ...process.env }
  if (ci) env.CI = 'true'
  else delete env.CI
  const l = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-dub-lesart.ts'), '--wurzel', kulisse, ...extra], { encoding: 'utf8', timeout: 120_000, cwd: kulisse, env })
  return { status: l.status, aus: `${l.stdout}${l.stderr}` }
}

function lauf(dateien: Record<string, string>, grenzen: { offen: number; marken: number }): { status: number | null; aus: string } {
  const kulisse = kulisseAnlegen(dateien, grenzen)
  try {
    return wachter(kulisse)
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

const MARKIERT = fn(['return t.streams.some((s) => s.dub === true) // dub-lesart: handbeleg'])
const neu = lauf({ 'pipeline/bau/neu.ts': ROH }, { offen: 0, marken: 0 })
pruefe('Prozess: neue Lesung in pipeline/bau bei Grenze 0 ist rot, nennt Datei:Zeile', neu.status === 1 && neu.aus.includes('pipeline/bau/neu.ts:2'), neu.aus)
const ausShared = lauf({ 'shared/neu.ts': ROH }, { offen: 0, marken: 0 })
pruefe('Prozess: neue Lesung in shared ist rot', ausShared.status === 1 && ausShared.aus.includes('shared/neu.ts:2'), ausShared.aus)
const gedeckt = lauf({ 'pipeline/bau/neu.ts': fn(['return s.dub === true && !s.dubAbgeleitet']), 'shared/neu.ts': MARKIERT }, { offen: 0, marken: 1 })
pruefe('Prozess: Stelle über dubAbgeleitet oder mit Marke bleibt grün', gedeckt.status === 0 && gedeckt.aus.includes('0 offene') && gedeckt.aus.includes('1 Marken'), gedeckt.aus)
const genau = lauf({ 'pipeline/bau/neu.ts': ROH }, { offen: 1, marken: 0 })
pruefe('Prozess: genau an der Grenze (1 von 1) grün', genau.status === 0 && genau.aus.includes('1 offene Lese-Stellen (höchstens 1)'), genau.aus)
const zwei = lauf({ 'pipeline/bau/a.ts': ROH, 'pipeline/bau/b.ts': ROH }, { offen: 1, marken: 0 })
pruefe('Prozess: eine Stelle über der Grenze (2 von 1) rot', zwei.status === 1, zwei.aus)
const zuHoch = lauf({ 'pipeline/bau/neu.ts': ROH }, { offen: 2, marken: 0 })
pruefe('Prozess: Grenze über dem Zählstand rot mit „auf 1 senken“ (A8)', zuHoch.status === 1 && zuHoch.aus.includes('auf 1 senken'), zuHoch.aus)
const tot = lauf({ 'pipeline/bau/neu.ts': TOT }, { offen: 0, marken: 1 })
pruefe('Prozess: Marke ohne Lesung ist rot (A4)', tot.status === 1 && tot.aus.includes('Marke ohne Lesung'), tot.aus)
const zwanzigste = lauf({ 'pipeline/bau/neu.ts': MARKIERT, 'shared/x.ts': MARKIERT }, { offen: 0, marken: 1 })
pruefe('Prozess: eine Marke mehr als die Grenze ist rot (A4)', zwanzigste.status === 1 && zwanzigste.aus.includes('Mehr Marken'), zwanzigste.aus)

// Basisvergleich mit echtem git (Wegwerf-Repo): Grenze im Zweig angehoben, Basis niedriger
function git(kulisse: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: kulisse, timeout: 30_000, stdio: 'ignore', windowsHide: true })
}
const gitKulisse = kulisseAnlegen({ 'pipeline/bau/a.ts': ROH }, { offen: 1, marken: 0 })
try {
  git(gitKulisse, 'init', '-q')
  git(gitKulisse, 'add', '-A')
  git(gitKulisse, 'commit', '-q', '-m', 'basis')
  const ohneAnheben = wachter(gitKulisse, ['--basis', 'HEAD'])
  pruefe('Prozess mit git: Grenze gleich der Basis grün', ohneAnheben.status === 0 && ohneAnheben.aus.includes('Basisvergleich ja'), ohneAnheben.aus)
  writeFileSync(join(gitKulisse, 'pipeline/bau/b.ts'), ROH)
  writeFileSync(join(gitKulisse, 'tools/dub-lesart-grenzen.json'), JSON.stringify({ offen: 2, marken: 0 }))
  const angehoben = wachter(gitKulisse, ['--basis', 'HEAD'])
  pruefe('Prozess mit git: neue Lesung samt angehobener Grenze ist rot (A8)', angehoben.status === 1 && angehoben.aus.includes('Basis erhöht'), angehoben.aus)
  const ohneBasis = wachter(gitKulisse, ['--basis', 'gibt-es-nicht'])
  pruefe('Prozess mit git: unlesbare Basis entfällt, Zählstand zählt weiter', ohneBasis.status === 0 && ohneBasis.aus.includes('Basisvergleich entfällt'), ohneBasis.aus)
  const ciOhneBasis = wachter(gitKulisse, ['--basis', 'gibt-es-nicht'], true)
  pruefe('Prozess mit git: in CI ohne Basis ist rot (A8)', ciOhneBasis.status === 1 && ciOhneBasis.aus.includes('entfällt in CI'), ciOhneBasis.aus)
  git(gitKulisse, 'add', '-A')
  git(gitKulisse, 'commit', '-q', '-m', 'angehoben')
  const ciMitBasis = wachter(gitKulisse, ['--basis', 'HEAD~1'], true)
  pruefe('Prozess mit git: in CI mit Basis ist die Zeile „Basisvergleich ja“ und der Vergleich greift', ciMitBasis.status === 1 && ciMitBasis.aus.includes('Basisvergleich ja') && ciMitBasis.aus.includes('Basis erhöht'), ciMitBasis.aus)
} finally {
  rmSync(gitKulisse, { recursive: true, force: true })
}

const echt = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-dub-lesart.ts')], { encoding: 'utf8', timeout: 120_000 })
pruefe('Prozess: echter Bestand hält die Grenzen', echt.status === 0, `${echt.stdout}${echt.stderr}`)

console.log(`dub-lesart-faelle: ${gesamt - verletzt} von ${gesamt} Fällen in Ordnung`)
process.exit(verletzt ? 1 : 0)
