/**
 * Prozesstest zu `check-handbeleg-note-asin-bestand.ts` (03.11.2026): das echte Skript läuft in einem Wegwerf-Ordner mit
 * kleinem Bestand. Belegt den Rotpfad (Exit 1, Fehlerzeile, Titelmarke), den Grünpfad und den Filter über die Ratsche des
 * Notizseiten-Wächters, nicht nur die Funktion dahinter.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const tsx = resolve('node_modules/tsx/dist/cli.mjs')
const skript = resolve('pipeline/check-handbeleg-note-asin-bestand.ts')
const block = (id: number, asin: string, notizAsin: string) =>
  `- anilistId: ${id}\n  title: "T${id}"\n  platform: primevideo\n  url: https://www.amazon.de/gp/video/detail/${asin}\n  dub: true\n  note: "Tonspuren: Deutsch — Amazon-Seite ${notizAsin}: alle 12 Folgen geprüft"\n`

function lauf(titelIds: number[], yamlText: string): { status: number | null; aus: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'note-asin-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titelIds.map((id) => ({ id }))))
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), yamlText)
    const r = spawnSync(process.execPath, [tsx, skript], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

// 900010 trägt die Seite von 900011 in der Notiz (Adresse eigen, Messung fremd).
const fremd = block(900011, 'B0SEITE011', 'B0SEITE011') + block(900010, 'B0SEITE010', 'B0SEITE011')
const rot = lauf([900010, 900011], fremd)
pruefe('Neuer Treffer: Exit 1', rot.status === 1, rot)
pruefe('Neuer Treffer: Fehlerzeile mit Schlüssel', rot.aus.includes('✖ Neue Treffer') && rot.aus.includes('900010@B0SEITE011'), rot)
pruefe('Neuer Treffer: Titelmarke für 900010, nicht für 900011', rot.aus.includes('"titleId":900010,"pruefung":"handbeleg-note-asin"') && !rot.aus.includes('"titleId":900011'), rot)
pruefe('Neuer Treffer: Zählzeile nennt 1 neu', /1 Treffer, davon 0 Altfälle \(Ratsche 0, Ziel 0\), 1 neu/.test(rot.aus), rot)

const gruen = lauf([900010, 900011], block(900011, 'B0SEITE011', 'B0SEITE011') + block(900010, 'B0SEITE010', 'B0SEITE010'))
pruefe('Eigene Seiten: Exit 0, keine Marke, 0 Treffer', gruen.status === 0 && !gruen.aus.includes('handbeleg-note-asin ') && /0 Treffer/.test(gruen.aus), gruen)

// Doppelführung mit dem Notizseiten-Wächter: dessen Altfall (20913 mit der Seite B0C8TKFF2J) filtert dieser Wächter aus.
const altfall = lauf([20913, 900011], block(900011, 'B0C8TKFF2J', 'B0C8TKFF2J') + block(20913, 'B0C8THGKXC', 'B0C8TKFF2J'))
pruefe('Altfall des Notizseiten-Wächters: Exit 0, 0 Treffer', altfall.status === 0 && /0 Treffer/.test(altfall.aus), altfall)

const leer = lauf([], '')
pruefe('Leere Belege: Exit 0', leer.status === 0 && /0 Treffer/.test(leer.aus), leer)

if (fehler) process.exit(1)
console.log(`check-handbeleg-note-asin-lauf: ${faelle} Fälle grün, Skript, Titelmarke und Exit-Code laufen als Prozess.`)
