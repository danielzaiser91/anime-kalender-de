/**
 * Prozesstest zu `check-handbeleg-notizseite-bestand.ts` (02.11.2026): das echte Skript läuft in einem Wegwerf-Ordner mit
 * kleinem Bestand. Belegt die Verdrahtung (Bestand lesen, Altfall-Ratsche, Exit-Code), nicht nur die Funktion dahinter.
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
const skript = resolve('pipeline/check-handbeleg-notizseite-bestand.ts')
const weg = (asin: string) => ({ platform: 'primevideo', url: `https://www.amazon.de/gp/video/detail/${asin}` })
const block = (id: number, asin: string) =>
  `- anilistId: ${id}\n  title: "T${id}"\n  platform: primevideo\n  url: https://www.amazon.de/gp/video/detail/${asin}\n  dub: true\n`

function lauf(titel: object[], yamlText: string): { status: number | null; aus: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'notizseite-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
    writeFileSync(join(wurzel, 'data/prime-zugeordnet.json'), '{}')
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), yamlText)
    const r = spawnSync(process.execPath, [tsx, skript], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const altfall = lauf([{ id: 14967, streams: [weg('B09JV7CC61')] }], block(10719, 'B09JV7CC61'))
pruefe('Altfall (Haganai) in der Ratsche: Exit 0 und Zähler', altfall.status === 0 && /1 Treffer, davon 1 Altfälle/.test(altfall.aus), altfall)

const neu = lauf([{ id: 900011, streams: [weg('B0NEU00001')] }], block(900010, 'B0NEU00001'))
pruefe('Neuer Treffer: Exit 1 mit Schlüssel im Text', neu.status === 1 && neu.aus.includes('900010@B0NEU00001'), neu)

const sauber = lauf([{ id: 900011, streams: [weg('B0NEU00001')] }], block(900011, 'B0NEU00001'))
pruefe('Eigene Seite: Exit 0, kein Treffer, Altfall-Warnung', sauber.status === 0 && /0 Treffer/.test(sauber.aus) && sauber.aus.includes('⚠ WARNUNG'), sauber)

if (fehler) process.exit(1)
console.log(`check-handbeleg-notizseite-lauf: ${faelle} Fälle grün, Skript, Ratsche und Exit-Code laufen als Prozess.`)
