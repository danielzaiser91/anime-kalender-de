/**
 * Prozesstest zu `check-kanal-merkliste-gesperrt.ts` (30.10.2026): der Wächter läuft ganz durch gegen eine Wegwerf-Wurzel (`AK_ROOT`).
 * Fälle: sauber (Exit 0), gesperrte Zeile (Exit 1, Kennung@Adresse im Fehlertext), dieselbe Adresse unter anderer Kennung (Exit 0),
 * fehlende Merkliste (Exit 1, Fehlertext), leere Liste (Exit 0), negative Kennungen (gesperrt / andere Kennung), echter Bestand (Exit 0).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const skript = join(wurzel, 'pipeline/check-kanal-merkliste-gesperrt.ts')
const ADRESSE = 'https://www.amazon.de/gp/video/detail/B0TESTSPERR'
const ADRESSE_NEG = 'https://www.amazon.de/gp/video/detail/B0TESTNEGAT'
const SPERRE =
  `- anilistId: 900001\n  url: ${ADRESSE}\n  grund: 'Test'\n  entferntAm: '2026-10-30'\n` +
  `- anilistId: -900005\n  url: ${ADRESSE_NEG}\n  grund: 'Test'\n  entferntAm: '2026-10-30'\n`

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function lauf(merkliste: unknown[] | null, env?: string) {
  const wo = mkdtempSync(join(tmpdir(), 'merkliste-gesperrt-'))
  try {
    mkdirSync(join(wo, 'data'), { recursive: true })
    writeFileSync(join(wo, 'data/belege-entfernt.yaml'), SPERRE)
    if (merkliste) writeFileSync(join(wo, 'data/kanal-seiten.json'), JSON.stringify(merkliste))
    const r = spawnSync(process.execPath, [tsx, skript], { env: { ...process.env, AK_ROOT: env ?? wo }, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    return { code: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wo, { recursive: true, force: true })
  }
}

const sauber = lauf([{ anilistId: 900002, url: 'https://www.amazon.de/gp/video/detail/B0TESTFREI' }])
pruefe('saubere Merkliste: Exit 0 und Schlusszeile', sauber.code === 0 && sauber.aus.includes('1 Zeilen, 0 gesperrt'), sauber)

const gesperrt = lauf([{ anilistId: 900002, url: 'https://www.amazon.de/gp/video/detail/B0TESTFREI' }, { anilistId: 900001, url: ADRESSE }])
pruefe('gesperrte Zeile: Exit 1 mit Kennung@Adresse', gesperrt.code === 1 && gesperrt.aus.includes(`900001@${ADRESSE}`), gesperrt)

const andere = lauf([{ anilistId: 900003, url: ADRESSE }])
pruefe('dieselbe Adresse unter anderer Kennung bleibt erlaubt', andere.code === 0, andere)

const fehlt = lauf(null)
pruefe('fehlende Merkliste: Exit 1 mit Fehlertext', fehlt.code === 1 && fehlt.aus.includes('data/kanal-seiten.json fehlt'), fehlt)

const leer = lauf([])
pruefe('leere Liste: Exit 0 und Schlusszeile', leer.code === 0 && leer.aus.includes('0 Zeilen, 0 gesperrt'), leer)

const negGesperrt = lauf([{ anilistId: -900005, url: ADRESSE_NEG }, { anilistId: -900006, url: 'https://www.amazon.de/gp/video/detail/B0TESTNEGFREI' }])
pruefe('negative Kennung gesperrt: Exit 1 mit Kennung@Adresse', negGesperrt.code === 1 && negGesperrt.aus.includes(`-900005@${ADRESSE_NEG}`), negGesperrt)

const negAndere = lauf([{ anilistId: -900007, url: ADRESSE_NEG }])
pruefe('negative Kennung: dieselbe Adresse unter anderer Kennung bleibt erlaubt', negAndere.code === 0, negAndere)

const echt = spawnSync(process.execPath, [tsx, skript], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60000 })
pruefe('echter Bestand: Exit 0', echt.status === 0 && echt.stdout.includes('0 gesperrt'), `${echt.stdout}${echt.stderr}`)

console.log(`Kanal-Merkliste gesperrt (Lauf): ${fehler === 0 ? 'alle Fälle ok' : `${fehler} Fehler`}`)
process.exit(fehler === 0 ? 0 : 1)
