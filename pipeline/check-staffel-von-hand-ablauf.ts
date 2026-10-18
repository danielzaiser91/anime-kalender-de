/**
 * Zusicherung: **`check-staffel-von-hand-bestand.ts` endet rot, wenn ein Handeintrag in keiner Reihe steht**, und grün, wenn
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
const reihen = JSON.stringify({ 1: [{ id: 10 }, { id: 20 }, { id: 30 }] })

function lauf(yamlText: string): { status: number | null; err: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'ak-staffel-'))
  try {
    mkdirSync(join(kulisse, 'data'))
    mkdirSync(join(kulisse, 'public/data'), { recursive: true })
    writeFileSync(join(kulisse, 'data/staffel-von-hand.yaml'), yamlText)
    writeFileSync(join(kulisse, 'public/data/franchises.json'), reihen)
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
const leer = lauf('[]\n')
pruefe('Leere Handdatei: Exit 1', leer.status === 1, leer.err)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Staffel von Hand (Ablauf): Exit-Codes bestätigt')
