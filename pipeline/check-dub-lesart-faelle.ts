/**
 * Fälle zur Ratsche `check-dub-lesart.ts`: reine Funktion (Syntaxbaum) und der Wächter als Prozess
 * gegen eine Wegwerf-Wurzel unter os.tmpdir() mit shared/ und pipeline/bau/.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { dubLesungen, offeneLesungen } from './lib/dub-lesart.ts'

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

const ROH = `export function a(t) {\n  return t.streams.some((s) => s.dub === true)\n}\n`
const MIT_HELFER = `export function a(t) {\n  return t.streams.some((s) => s.dub === true && !s.dubAbgeleitet)\n}\n`
const MIT_HELFER_FUNKTION = `export function a(t) {\n  return t.streams.some((s) => s.dub === true && !istLautAnbieter(s))\n}\n`
const NACHBAR = `function b(s) {\n  return s.dubAbgeleitet\n}\nfunction a(t) {\n  return t.streams.some((s) => s.dub === true)\n}\n`
const MARKE_DAVOR = `function a(t) {\n  // dub-lesart: irgendwie – Menge\n  return t.streams.some((s) => s.dub === true)\n}\n`
const MARKE_GLEICHE_ZEILE = `function a(t) {\n  return t.streams.some((s) => s.dub === true) // dub-lesart: handbeleg\n}\n`
const MARKE_ZWEI_DAVOR = `function a(t) {\n  // dub-lesart: irgendwie\n  const x = 1\n  return t.streams.some((s) => s.dub === true)\n}\n`
const UMGEDREHT = `function a(s) {\n  return true === s.dub\n}\n`
const NUR_KOMMENTAR = `// s.dub === true\nconst t = 's.dub === true'\nfunction a(s) {\n  return s.dub === false || s.dub\n}\n`
const SETZT = `function a(s) {\n  s.dub = true\n  return { dub: true }\n}\n`
const PFEIL = `export const a = (t) => {\n  return t.streams.some((s) => s.dub === true && !s.dubAbgeleitet)\n}\n`
const PFEIL_OHNE = `export const a = (t) => {\n  return t.streams.some((s) => s.dub === true)\n}\n`

pruefe('rohe Lesung ist offen, Zeile 2', JSON.stringify(offeneLesungen(ROH).map((l) => l.zeile)) === '[2]', offeneLesungen(ROH))
pruefe('dubAbgeleitet in der Funktion: in Ordnung', offeneLesungen(MIT_HELFER).length === 0)
pruefe('istLautAnbieter in der Funktion: in Ordnung', offeneLesungen(MIT_HELFER_FUNKTION).length === 0)
pruefe('dubAbgeleitet in der Nachbarfunktion deckt nicht', offeneLesungen(NACHBAR).length === 1)
pruefe('Marke in der Zeile davor: in Ordnung', offeneLesungen(MARKE_DAVOR).length === 0)
pruefe('Marke in derselben Zeile: in Ordnung', offeneLesungen(MARKE_GLEICHE_ZEILE).length === 0)
pruefe('Marke zwei Zeilen davor deckt nicht', offeneLesungen(MARKE_ZWEI_DAVOR).length === 1)
pruefe('true === s.dub wird gelesen', dubLesungen(UMGEDREHT).length === 1)
pruefe('Kommentar, Zeichenkette, === false, bloßes s.dub: keine Lesung', dubLesungen(NUR_KOMMENTAR).length === 0)
pruefe('Setzen (dub = true, dub: true) ist keine Lesung', dubLesungen(SETZT).length === 0)
pruefe('Pfeilfunktion mit Helfer: in Ordnung', offeneLesungen(PFEIL).length === 0)
pruefe('Pfeilfunktion ohne Helfer: offen', offeneLesungen(PFEIL_OHNE).length === 1)

function lauf(dateien: Record<string, string>, grenze: number): { status: number | null; aus: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'dub-lesart-'))
  try {
    mkdirSync(join(kulisse, 'shared'))
    mkdirSync(join(kulisse, 'pipeline/bau'), { recursive: true })
    mkdirSync(join(kulisse, 'tools'))
    writeFileSync(join(kulisse, 'tools/dub-lesart-grenzen.json'), JSON.stringify({ offen: grenze }))
    for (const [pfad, text] of Object.entries(dateien)) writeFileSync(join(kulisse, pfad), text)
    const l = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-dub-lesart.ts'), '--wurzel', kulisse], { encoding: 'utf8', timeout: 120_000 })
    return { status: l.status, aus: `${l.stdout}${l.stderr}` }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

const neu = lauf({ 'pipeline/bau/neu.ts': ROH }, 0)
pruefe('Prozess: neue Lesung in pipeline/bau bei Grenze 0 ist rot, nennt Datei:Zeile', neu.status === 1 && neu.aus.includes('pipeline/bau/neu.ts:2'), neu.aus)
const ausShared = lauf({ 'shared/neu.ts': ROH }, 0)
pruefe('Prozess: neue Lesung in shared ist rot', ausShared.status === 1 && ausShared.aus.includes('shared/neu.ts:2'), ausShared.aus)
const ueberHelfer = lauf({ 'pipeline/bau/neu.ts': MIT_HELFER, 'shared/neu.ts': MARKE_DAVOR }, 0)
pruefe('Prozess: Stelle über dubAbgeleitet oder mit Marke bleibt grün', ueberHelfer.status === 0 && ueberHelfer.aus.includes('0 offene'), ueberHelfer.aus)
const genau = lauf({ 'pipeline/bau/neu.ts': ROH }, 1)
pruefe('Prozess: genau an der Grenze (1 von 1) grün', genau.status === 0 && genau.aus.includes('1 offene Lese-Stellen (höchstens 1)'), genau.aus)
const zwei = lauf({ 'pipeline/bau/a.ts': ROH, 'pipeline/bau/b.ts': ROH }, 1)
pruefe('Prozess: eine Stelle über der Grenze (2 von 1) rot', zwei.status === 1, zwei.aus)
const echt = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-dub-lesart.ts')], { encoding: 'utf8', timeout: 120_000 })
pruefe('Prozess: echter Bestand hält die Grenze', echt.status === 0, `${echt.stdout}${echt.stderr}`)

console.log(`dub-lesart-faelle: ${gesamt - verletzt} von ${gesamt} Fällen in Ordnung`)
process.exit(verletzt ? 1 : 0)
