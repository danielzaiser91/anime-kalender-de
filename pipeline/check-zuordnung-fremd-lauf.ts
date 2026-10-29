/**
 * Prozesstest zu `check-zuordnung-fremd-bestand.ts` (29.10.2026): das Skript läuft als eigener Prozess gegen eine Kulisse in
 * einem Wegwerf-Ordner (cwd und `AK_ROOT`), mit der echten Netflix-Adresse von Kulipari (Cartoon -74222) und Hero Mask (105096).
 * Geprüft werden Exit-Code, Schlusszeile und die Titelmarke: ohne Eintrag in der Bekannt-Liste rot mit Marke, mit Eintrag grün,
 * mit einem Eintrag ohne Treffer rot. Läuft in `check:logic`; das Skript selbst läuft in `check:bestand` gegen den echten Bestand.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { liesMarken } from '../tools/quarantaene.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const KULIPARI = 'https://www.netflix.com/title/80057610'
const GRISAIA = 'https://www.amazon.de/gp/video/detail/B0DMMT9B67'
const wurzel = mkdtempSync(join(tmpdir(), 'zuordnung-fremd-'))
const schreibe = (datei: string, inhalt: string) => {
  mkdirSync(join(wurzel, datei, '..'), { recursive: true })
  writeFileSync(join(wurzel, datei), inhalt)
}
schreibe('public/data/cartoons.json', JSON.stringify([{ id: -74222, titleEn: 'Kulipari', streams: [{ url: KULIPARI }] }]))
schreibe('public/data/ohne-synchro.json', '[]')
schreibe('data/dub-confirmed.yaml', `- anilistId: 145740\n  url: ${GRISAIA}\n`)
schreibe('data/prime-zugeordnet.json', JSON.stringify({ [`${KULIPARI}#0`]: { titleId: 105096, plattform: 'netflix' }, [GRISAIA]: { titleId: 99470, plattform: 'primevideo', seite: 'B0DMMT9B67' } }))

let fehler = 0
let faelle = 0
function lauf(bekannt: string[]) {
  schreibe(join('data', 'zuordnung-fremd-bekannt.json'), JSON.stringify(bekannt))
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-zuordnung-fremd-bestand.ts')], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

try {
  const neu = lauf([])
  pruefe('Neuer Treffer: Exit 1, Titel, Adresse und Besitzer genannt', neu.status === 1 && neu.aus.includes(`Titel 105096, Adresse ${KULIPARI}, Besitzer cartoons.json:-74222`) && neu.aus.includes(`Titel 99470, Adresse ${GRISAIA}, Besitzer Handbeleg:145740`), neu)
  pruefe('Neuer Treffer: Titelmarke für 105096', [105096, 99470].every((id) => liesMarken(neu.aus).some((m) => m.titleId === id && m.pruefung === 'zuordnung-fremd')), neu.aus)
  const BEKANNT = [`105096 ${KULIPARI}`, `99470 ${GRISAIA}`]
  const bekannt = lauf(BEKANNT)
  pruefe('Bekannter Treffer: Exit 0, Schlusszeile, keine Marke', bekannt.status === 0 && /check-zuordnung-fremd-bestand: 2 Altfälle bekannt/.test(bekannt.aus) && liesMarken(bekannt.aus).length === 0, bekannt)
  const veraltet = lauf([`1 ${KULIPARI}x`, ...BEKANNT])
  pruefe('Zeile ohne Treffer: Exit 1', veraltet.status === 1 && veraltet.aus.includes('streichen'), veraltet)
  pruefe('Unsortierte Bekannt-Liste: Exit 1', lauf([...BEKANNT].reverse()).status === 1)
  pruefe('Doppelte Zeile in der Bekannt-Liste: Exit 1', lauf([BEKANNT[0]!, BEKANNT[0]!, BEKANNT[1]!]).status === 1)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) process.exit(1)
console.log(`check-zuordnung-fremd-lauf: ${faelle} Fälle grün, das Bestandsskript meldet neue fremde Zuordnungen mit Marke und Exit 1.`)
