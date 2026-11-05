/**
 * Prozess-Test: **`check:tote-adressen` lässt eine jüngere Handprüfung derselben Adresse gelten** (Fairy Tail, 22.09.2026).
 * Das Skript läuft als eigener Prozess in einer Kulisse im Temp-Ordner (cwd; es liest seine Dateien relativ dazu).
 * Ersetzt die Quelltext-Zusicherung `includes('handGesehen')` in `check-logic.ts`. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = join(import.meta.dirname, '..')
const URL = 'https://www.amazon.de/dp/B0TOTHAND'
const fehler: string[] = []
let faelle = 0

const NETFLIX = 'https://www.netflix.com/title/81422700'

function lauf(name: string, belegYaml: string, verweiseYaml: string, soll: 0 | 1, weg: { platform: string; dub?: boolean; status?: number | string } = { platform: 'primevideo' }): void {
  const adresse = weg.platform === 'netflix' ? NETFLIX : URL
  faelle++
  const wurzel = mkdtempSync(join(tmpdir(), 'tote-adressen-'))
  try {
    mkdirSync(join(wurzel, 'public/data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify([{ id: 900001, titleDe: 'Probe', streams: [{ platform: weg.platform, url: adresse, dub: weg.dub }] }]))
    writeFileSync(join(wurzel, 'data/link-check.json'), JSON.stringify({ [adresse]: { status: weg.status ?? 404, geprueftAm: '2026-09-20' } }))
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), belegYaml)
    writeFileSync(join(wurzel, 'data/verweise-von-hand.yaml'), verweiseYaml)
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const r = spawnSync(process.execPath, [tsx, join(REPO, 'pipeline', 'check-tote-adressen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
    const schluss = `VERSTÖSSE: ${soll === 0 ? 0 : 1}`
    if (r.status !== soll || !(r.stdout ?? '').includes(schluss)) {
      fehler.push(`${name}: Exit ${r.status} statt ${soll}, Ausgabe „${(r.stdout ?? '').trim().slice(-80)}“ ${(r.stderr ?? '').trim().slice(0, 200)}`)
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const beleg = (checkedAt: string, extra = '') => `- url: ${URL}\n  checkedAt: '${checkedAt}'\n${extra}`
lauf('404 ohne Handprüfung: tot', '[]\n', '[]\n', 1)
lauf('Beleg jünger als der Befund: nicht tot', beleg('2026-09-22'), '[]\n', 0)
lauf('Beleg am selben Tag: tot', beleg('2026-09-20'), '[]\n', 1)
lauf('Beleg älter: tot', beleg('2026-09-18'), '[]\n', 1)
lauf('Beleg jünger, aber „weg“: tot', beleg('2026-09-22', '  available: false\n'), '[]\n', 1)
lauf('von Hand bestätigter Weg jünger: nicht tot', '[]\n', `- url: ${URL}\n  belegtAm: '2026-09-22'\n`, 0)
lauf('von Hand bestätigter Weg älter: tot', '[]\n', `- url: ${URL}\n  belegtAm: '2026-09-18'\n`, 1)
/* Netflix-404 mit belegtem Deutsch bleibt (Bau 09-2, 05.11.2026); jede andere Teilbedingung allein macht es wieder tot. */
lauf('Netflix 404 mit dub true: nicht tot', '[]\n', '[]\n', 0, { platform: 'netflix', dub: true })
lauf('Netflix 404 mit dub false: tot', '[]\n', '[]\n', 1, { platform: 'netflix', dub: false })
lauf('Netflix 404 ohne Urteil: tot', '[]\n', '[]\n', 1, { platform: 'netflix' })
lauf('Netflix region mit dub true: tot', '[]\n', '[]\n', 1, { platform: 'netflix', dub: true, status: 'region' })
lauf('Prime 404 mit dub true: tot', '[]\n', '[]\n', 1, { platform: 'primevideo', dub: true })

if (fehler.length) {
  console.error(`FEHL check-tote-adressen-lauf:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-tote-adressen-lauf: ${faelle} Fälle ok.`)
