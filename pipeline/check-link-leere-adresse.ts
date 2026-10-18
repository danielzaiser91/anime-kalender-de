/**
 * Zusicherung: **Die Link-Prüfung stürzt an Wegen ohne Adresse nicht ab** (18.10.2026). Seit dem Bau aus Terminen
 * (`bau/11-7-wege-aus-terminen.ts`) tragen Wege `url: ''`; `new URL('')` beendete den Wochenlauf am 12.10. nach 18 s,
 * ohne einen Abruf. Fährt `check-links.ts` ganz als eigenen Prozess gegen eine Kulisse im Temp-Ordner (`AK_ROOT`, cwd):
 * zwei unbrauchbare Adressen und eine gültige, schon frisch geprüfte — Exit 0, die Zeile mit der Zahl, der Bestand bleibt.
 * Ohne Netz: die gültige Adresse ist nicht fällig, also wird nichts abgerufen.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const gueltig = 'https://www.joyn.de/serien/frisch-geprueft'
const heute = new Date().toISOString().slice(0, 10)

const kulisse = mkdtempSync(join(tmpdir(), 'ak-link-leer-'))
let fehler = 0
try {
  mkdirSync(join(kulisse, 'public/data'), { recursive: true })
  mkdirSync(join(kulisse, 'data'), { recursive: true })
  const wege = [
    { platform: 'disneyplus', url: '' },
    { platform: 'netflix', url: 'keine-adresse' },
    { platform: 'joyn', url: gueltig },
  ]
  writeFileSync(join(kulisse, 'public/data/titles.json'), JSON.stringify([{ id: 900001, streams: wege }]))
  writeFileSync(join(kulisse, 'data/link-check.json'), JSON.stringify({ [gueltig]: { status: 200, geprueftAm: heute } }))
  const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-links.ts')], {
    cwd: kulisse,
    env: { ...process.env, AK_ROOT: kulisse },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
  const ausgabe = `${lauf.stdout}${lauf.stderr}`
  const bestand = JSON.parse(readFileSync(join(kulisse, 'data/link-check.json'), 'utf8')) as Record<string, unknown>
  const pruefungen: Array<[string, boolean]> = [
    ['Exit 0', lauf.status === 0],
    ['Zeile mit Zahl 2', /^.*2 Einträge ohne gültige Adresse übersprungen\./m.test(ausgabe)],
    ['gültige Adresse bleibt im Bestand', gueltig in bestand],
    ['keine unbrauchbare Adresse im Bestand', !('' in bestand) && !('keine-adresse' in bestand)],
  ]
  for (const [name, ok] of pruefungen) {
    if (!ok) {
      fehler++
      console.error(`FAIL ${name}`)
    }
  }
  if (fehler) console.error(ausgabe.slice(-1500))
  else console.log('check-link-leere-adresse: ok — 2 Wege ohne Adresse übersprungen, Lauf Exit 0')
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
process.exit(fehler ? 1 : 0)
