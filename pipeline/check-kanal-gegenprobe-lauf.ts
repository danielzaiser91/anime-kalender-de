/**
 * Prozess-Test: **Die Kanal-Gegenprobe vergleicht mit dem Angebot des gemeldeten Kanals, auch wenn der Abo-Name einen
 * Klammerzusatz trägt** („Abos: crunchyrollde (Meldung 4738)“, 22.09.2026). `kanal-gegenprobe.ts` läuft als eigener Prozess auf
 * einer Kulisse im Temp-Ordner (`AK_ROOT`); belegt die Verdrahtung von `kanalNamen()`. Ersetzt die Textprüfung in `check-logic.ts`.
 * Kulisse: Crunchyroll-Kanal ohne Deutsch, daneben ein Prime-Angebot mit Deutsch (andere Ausgabe).
 * Mit Kanalnamen trifft die Probe das Angebot ohne Deutsch (1 zur Handprüfung); ohne (Name leer oder mit Zusatz) fiele sie auf alle Angebote zurück (0).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = join(import.meta.dirname, '..')
const fehler: string[] = []
let faelle = 0

function lauf(name: string, abos: string, sollHand: number): void {
  faelle++
  const wurzel = mkdtempSync(join(tmpdir(), 'kanal-gegenprobe-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'daniel-zum-abarbeiten/listen'), { recursive: true })
    writeFileSync(join(wurzel, 'public/data/titles.json'), '[]')
    writeFileSync(
      join(wurzel, 'data/dub-confirmed.yaml'),
      `- anilistId: 900001\n  title: Probe\n  platform: primevideo\n  url: https://www.amazon.de/dp/B0KANAL\n  note: 'Kanal-Meldung. Abos: ${abos}'\n`,
    )
    const angebote = [
      { anbieter: 'Crunchyroll Amazon Channel', art: 'FLATRATE', audio: ['ja', 'es'] },
      { anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio: ['de'] },
    ]
    writeFileSync(join(wurzel, 'data/justwatch-audio.json'), JSON.stringify({ 900001: { geprueftAm: '2999-01-01', erstAm: '2999-01-01', angebote } }))
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const r = spawnSync(process.execPath, [tsx, join(REPO, 'pipeline', 'kanal-gegenprobe.ts')], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
    if (r.status !== 0) {
      fehler.push(`${name}: Exit ${r.status} ${(r.stderr ?? '').trim().slice(0, 200)}`)
      return
    }
    const zeile = /(\d+) zur Handprüfung\./.exec(r.stdout ?? '')?.[1]
    if (zeile !== String(sollHand)) fehler.push(`${name}: ${zeile} zur Handprüfung statt ${sollHand}`)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

lauf('Kanal ohne Zusatz', 'crunchyrollde', 1)
lauf('Kanal mit Klammerzusatz', 'crunchyrollde (Meldung 4738)', 1)
lauf('nur prime: Vergleich über alle Angebote', 'prime', 0)

if (fehler.length) {
  console.error(`FEHL check-kanal-gegenprobe-lauf:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-gegenprobe-lauf: ${faelle} Fälle ok.`)
