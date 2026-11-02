/**
 * Prozesstest zum Block "Netflix-Staffelzählung" in `check-handbelege.ts` (PR 2635): das echte Skript läuft gegen eine Kulisse
 * (`AK_ROOT`, Wegwerf-Ordner unter `os.tmpdir()`) mit Beyblade X wie vor der Korrektur ("Folgen 2–48" an einer Liste ab Staffel 2).
 * Ohne Umrechnungsvermerk muss es mit Exit 1 enden, mit Vermerk mit Exit 0; geprüft wird auch der Text, damit ein Absturz nicht als Rot zählt.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WAECHTER = resolve(dirname(fileURLToPath(import.meta.url)), 'check-handbelege.ts')
let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${JSON.stringify(info)}`)
}

const NETFLIX = 'https://www.netflix.com/title/81924739'
const titel = [{ id: 900165, slug: 'beyblade-x', format: 'TV', streams: [{ platform: 'netflix', url: NETFLIX, dub: true, dubRanges: [{ from: 2, to: 48, dub: true }] }] }]
const beleg = (note: string): string => `- anilistId: 900165
  title: "Beyblade X"
  platform: netflix
  dub: true
  dubRanges:
    - from: 2
      to: 48
      dub: true
  checkedAt: '2026-08-26'
  note: "${note}"
`

function lauf(note: string): { status: number; text: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'check-handbelege-anbieter-'))
  try {
    for (const d of ['data/curated', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), beleg(note))
    writeFileSync(join(wurzel, 'data/anbieter-staffeln.json'), JSON.stringify({ 81924739: { staffeln: [{ seq: 2, name: '', folgen: 49, erste: 1 }], gemeldetAm: '2026-08-26' } }))
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
    for (const d of ['cartoons', 'ohne-synchro', 'releases']) writeFileSync(join(wurzel, `public/data/${d}.json`), '[]')
    try {
      const text = execFileSync(process.execPath, [WAECHTER], { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 120000 })
      return { status: 0, text }
    } catch (e) {
      const x = e as { status?: number; stdout?: string; stderr?: string }
      return { status: x.status ?? -1, text: `${x.stdout ?? ''}${x.stderr ?? ''}` }
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const rot = lauf('Folgen 2–48 mit deutschem Ton')
pruefe('ohne Vermerk: Exit 1 mit dem Befund der Staffelzählung', rot.status === 1 && rot.text.includes('Netflix-Staffelzählung statt unserer Zählung') && rot.text.includes('Bereich 2–48'), rot)
const gruen = lauf('Folgen 53–99 — Umrechnung: Staffel 2 beginnt bei unserer Folge 52')
pruefe('mit Vermerk: dieser Block lässt den Lauf durch', gruen.status === 0 && gruen.text.includes('1 Beleg(e) mit Umrechnungsvermerk'), gruen)

if (fehler) {
  console.error(`FEHL check-handbelege-anbieter-zaehlung-lauf: ${fehler}`)
  process.exit(1)
}
console.log('check-handbelege-anbieter-zaehlung-lauf: check-handbelege bricht ohne Umrechnungsvermerk ab und läuft mit Vermerk durch.')
