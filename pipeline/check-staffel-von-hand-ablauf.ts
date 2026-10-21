/**
 * Zusicherung: **`check-staffel-von-hand-bestand.ts` endet rot, wenn ein Handeintrag in keiner Reihe steht oder seine Staffelnummer nicht ankommt**, und grün, wenn
 * alle drin sind — als eigener Prozess gegen eine Kulisse (`AK_ROOT`), nicht gegen den echten Bestand. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const wurzel = resolve(import.meta.dirname, '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const eintrag = (id: number) => `- anilistId: ${id}\n  staffel: 2\n  quelle: https://x\n  belegtAm: '2026-10-18'\n`
const glied = (id: number, staffelQuelle?: number) => ({ id, staffelQuelle })
const reihen = (a = glied(10, 2), b = glied(20, 2), c = glied(30, 2)) => JSON.stringify({ 1: [a], 2: [glied(5, 9)], 3: [b], 4: [glied(6)], 5: [c] })

function lauf(yamlText: string, franchises = reihen()): { status: number | null; err: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'ak-staffel-'))
  try {
    mkdirSync(join(kulisse, 'data'))
    mkdirSync(join(kulisse, 'public/data'), { recursive: true })
    writeFileSync(join(kulisse, 'data/staffel-von-hand.yaml'), yamlText)
    writeFileSync(join(kulisse, 'public/data/franchises.json'), franchises)
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-staffel-von-hand-bestand.ts')], {
      env: { ...process.env, AK_ROOT: kulisse },
      encoding: 'utf8',
    })
    return { status: r.status, err: r.stderr }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const gut = lauf(eintrag(10) + eintrag(20) + eintrag(30))
pruefe('Alle Kennungen in einer Reihe: Exit 0', gut.status === 0, gut.err)
const mitte = lauf(eintrag(10) + eintrag(99) + eintrag(30))
pruefe('Eine Kennung in der Mitte ohne Reihe: Exit 1 und die Kennung genannt', mitte.status === 1 && mitte.err.includes('99') && !mitte.err.includes('AniList 10 ') && !mitte.err.includes('AniList 30 '), mitte.err)
const vorn = lauf(eintrag(99) + eintrag(20))
pruefe('Kennung vorn ohne Reihe: Exit 1', vorn.status === 1, vorn.err)
const hinten = lauf(eintrag(10) + eintrag(99))
pruefe('Kennung hinten ohne Reihe: Exit 1', hinten.status === 1, hinten.err)
/* Die Nummer kommt im Bestand nicht an (Bau ohne `alleStaffelQuellen()`): rot, auch wenn die Kennung in der Reihe steht. */
const drei = eintrag(10) + eintrag(20) + eintrag(30)
const ohneNummer = lauf(drei, reihen(glied(10, 2), glied(20), glied(30, 2)))
pruefe('Staffelnummer fehlt in der Mitte: Exit 1 und die Kennung genannt', ohneNummer.status === 1 && ohneNummer.err.includes('AniList 20 ') && !ohneNummer.err.includes('AniList 10 '), ohneNummer.err)
const vornOhne = lauf(drei, reihen(glied(10), glied(20, 2), glied(30, 2)))
pruefe('Staffelnummer fehlt vorn: Exit 1', vornOhne.status === 1, vornOhne.err)
const hintenOhne = lauf(drei, reihen(glied(10, 2), glied(20, 2), glied(30)))
pruefe('Staffelnummer fehlt hinten: Exit 1', hintenOhne.status === 1, hintenOhne.err)
const andere = lauf(drei, reihen(glied(10, 2), glied(20, 3), glied(30, 2)))
pruefe('Andere Staffelnummer als die Handdatei: Exit 1', andere.status === 1 && andere.err.includes('im Bestand: staffelQuelle 3'), andere.err)
const leer = lauf('[]\n')
pruefe('Leere Handdatei: Exit 1', leer.status === 1, leer.err)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Staffel von Hand (Ablauf): Exit-Codes bestätigt')
