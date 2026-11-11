/**
 * Prozesstest zur Prüfung „veralteter Beleg“ in `check-handbelege.ts` (PR 3287, A5): das echte Skript läuft gegen eine Kulisse
 * (`AK_ROOT`, Wegwerf-Ordner unter `os.tmpdir()`). Ohne Aufruf von `veralteterBeleg` wäre Fall 1 grün, mit einem Dauer-Fund Fall 2 rot.
 * Fall 1: die jüngste Zeile (`available: true` ohne Adresse) trägt für `loadDubChecks()` keine Aussage und fällt weg: ein verschluckter Beleg, Exit 1.
 * Fall 2: die jüngste Zeile ist ein Ladefehler-Nein (Chaika, 28.09.): kein Fund, Exit 0.
 * Fall 3: dieselbe Zeile, aber ein echtes Nein liegt dazwischen und ist jünger als das Ja: gewählt wird das Nein, Exit 0.
 * Geprüft wird auch der Text, damit ein Absturz nicht als Rot zählt.
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

const ADRESSE = 'https://www.amazon.de/dp/B07LHCSXV6'
const titel = (dub: boolean) => [{ id: 900201, slug: 'veraltet-probe', format: 'TV', streams: dub ? [{ platform: 'primevideo', url: ADRESSE, dub }] : [] }]
const kopf = (url: boolean, datum: string): string => `- anilistId: 900201
  title: "Veraltet Probe"
  platform: primevideo
${url ? `  url: ${ADRESSE}\n` : ''}  checkedAt: '${datum}'
`
const JA = (url: boolean): string => `${kopf(url, '2026-08-28')}  dub: true
  note: "Tonspuren: Deutsch — alle 10 Folgen geprüft"
`
const LADEFEHLER = `${kopf(true, '2026-09-28')}  dub: false
  note: "Amazon-Seite B07LHCSXV6: nur 0 von 12 Folgen geladen — Rest ungeprüft, Abos: keine Angabe"
`
const ECHTES_NEIN = `${kopf(true, '2026-09-10')}  dub: false
  note: "Amazon-Seite B07LHCSXV6: alle 12 Folgen geprüft, keine deutsche Tonspur"
`
const VERSCHLUCKT = `${kopf(false, '2026-09-28')}  available: true
`

function lauf(yamlText: string, dub = true): { status: number; text: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'check-handbelege-veraltet-'))
  try {
    for (const d of ['data/curated', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), yamlText)
    writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel(dub)))
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

const verschluckt = lauf(JA(false) + VERSCHLUCKT)
pruefe('jüngste Zeile ohne Aussage für den Leser: Exit 1 mit „veralteten Beleg“', verschluckt.status === 1 && verschluckt.text.includes('benutzen einen veralteten Beleg') && verschluckt.text.includes('VERSTÖSSE: 1'), verschluckt)
const ladefehler = lauf(JA(true) + LADEFEHLER)
pruefe('Ja, jüngstes Ladefehler-Nein: kein Fund', ladefehler.status === 0 && ladefehler.text.includes('überall gilt der jüngste'), ladefehler)
const dazwischen = lauf(JA(true) + ECHTES_NEIN + LADEFEHLER, false)
pruefe('Ja, echtes Nein, jüngster Ladefehler: das Nein gilt, kein Fund', dazwischen.status === 0 && dazwischen.text.includes('überall gilt der jüngste'), dazwischen)

if (fehler) {
  console.error(`FEHL check-handbelege-veraltet-lauf: ${fehler}`)
  process.exit(1)
}
console.log('check-handbelege-veraltet-lauf: check-handbelege meldet einen verschluckten Beleg und lässt einen Ladefehler als jüngste Zeile durch.')
