/**
 * Laufzeittest statt Quelltext-Zusicherung für `fetch-pruefungen.ts` (Muster 2472): Der Abholer läuft als Prozess gegen eine Attrappe
 * (`tools/meldung-staffel-mock.mjs`: Reihe aus Staffel 1, OVA und Staffel 2 unter einer Netflix-Adresse).
 * 1. Staffel 2 gemeldet (Auftrag nannte Staffel 1): der Beleg geht an „Staffelreihe 2“ — nicht an den Auftragstitel, nicht an die OVA
 *    an der Position 2 der Reihe (Staffelnummer über die Namen, nicht über `slice`; vier falsche Belege am 10.09.2026).
 * 2. Staffel 1 und 2 unter derselben Netflix-Adresse werden nicht in eine Staffel zusammengelegt (Quintuplets, 18.09.2026); eine Prime-Seite
 *    mit zwei Staffelnummern in einer Gruppe geht nicht in den Staffelblock.
 * 3. Ohne `--trocken` landet der Beleg über `haengeBelegeAn` in `data/dub-confirmed.yaml` der Wegwerf-Wurzel (`AK_ROOT`).
 * 4. Staffel 2 gemeldet, unser Titel trägt keine Zahl (Haikyu!! TO THE TOP, 22.09.2026): kennt `data/anbieter-staffeln.json` Netflix' Staffel 2,
 *    wird die Meldung über die Aufteilung verteilt und es gibt einen Beleg; ohne diese Auskunft bleibt sie liegen.
 * 5. 24 durchgezählte Meldungen mit Notiz je Folge: der Beleg der ersten Staffel (Folge 1–12) trägt die Notiz seiner letzten Meldung (Folge 12),
 *    nicht die der Gruppe (Haikyu!!, 22.09.2026: „gemessen: Folge 14 und 25“ stand auch am Titel mit den Rändern 1 und 13).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-staffel-mock.mjs')).href
const fehler: string[] = []

function lauf(szenario: string, extra: string[], ak?: string) {
  const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts'), ...extra], {
    cwd: wurzel,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, LAUF_TOKEN: 'test', AK_SZENARIO: szenario, ...(ak ? { AK_ROOT: ak } : {}) },
  })
  if (r.status !== 0) fehler.push(`Lauf ${szenario} ${extra.join(' ')} endete mit ${r.status}: ${r.stderr.slice(-300)}`)
  return r
}
const belegTitel = (text: string) => text.split('\n').filter((z) => /^- anilistId: \d+$/.test(z)).map((z) => z.replace('- anilistId: ', ''))

const zwei = belegTitel(lauf('zwei', ['--trocken']).stdout)
if (zwei.join() !== '900003') fehler.push(`Staffel 2: Beleg für ${zwei.join(', ') || 'keinen'} statt nur 900003`)
const gemischt = belegTitel(lauf('gemischt', ['--trocken']).stdout)
if (gemischt.join() !== '900001,900003') fehler.push(`Staffel 1 und 2: Belege für ${gemischt.join(', ') || 'keinen'} statt 900001 und 900003`)

/* Eine Prime-Seite mit Meldungen zweier Staffeln: der Staffelblock verlangt EINE Staffelnummer und fasst die Gruppe nicht an. */
const primeGemischt = belegTitel(lauf('primegemischt', ['--trocken']).stdout)
if (primeGemischt.join() !== '900001') fehler.push(`Prime-Seite mit Staffel 1 und 2: Belege für ${primeGemischt.join(', ') || 'keinen'} statt nur 900001`)

/* Wegwerf-Wurzel, optional mit Netflix' Aufteilung (zwei Staffeln) für die Adresse der Attrappe. */
function trockenIn(szenario: string, mitAufteilung: boolean) {
  const wurzelTmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-trocken-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(wurzelTmp, ordner), { recursive: true })
    if (mitAufteilung) {
      const staffeln = [1, 2].map((seq) => ({ seq, name: `Staffel ${seq}`, folgen: 12, erste: 1 }))
      writeFileSync(join(wurzelTmp, 'data/anbieter-staffeln.json'), JSON.stringify({ 81152346: { staffeln, gemeldetAm: '2026-09-22' } }))
    }
    return lauf(szenario, ['--trocken'], wurzelTmp).stdout
  } finally {
    rmSync(wurzelTmp, { recursive: true, force: true })
  }
}
const VERTEILT = "über Netflix' Staffelaufteilung verteilt"
const mitAuskunft = trockenIn('ohnezahl', true)
if (belegTitel(mitAuskunft).join() !== '900001' || !mitAuskunft.includes(VERTEILT) || !mitAuskunft.includes('Netflix-Seite: Staffeltest')) fehler.push(`Staffel 2 ohne Zahl im Namen, Aufteilung bekannt: kein Beleg über die Aufteilung: ${mitAuskunft.slice(0, 300)}`)
const ohneAuskunft = trockenIn('ohnezahl', false)
if (belegTitel(ohneAuskunft).length || ohneAuskunft.includes(VERTEILT)) fehler.push(`Staffel 2 ohne Zahl, Aufteilung unbekannt: Meldung muss liegenbleiben: ${ohneAuskunft.slice(0, 300)}`)
const notizen = trockenIn('notizen', false)
  .split('\n')
  .filter((z) => z.startsWith('  note: '))
if (notizen.length !== 1 || !notizen[0]!.includes('Randprobe Folge 12"')) fehler.push(`Notiz je Staffel: ${notizen.join(' | ')}`)

const tmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-laufzeit-'))
try {
  for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(tmp, ordner), { recursive: true })
  writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), '# leer\n')
  lauf('zwei', [], tmp)
  const yaml = readFileSync(join(tmp, 'data/dub-confirmed.yaml'), 'utf8')
  if (!yaml.includes('anilistId: 900003') || yaml.includes('anilistId: 900002')) fehler.push(`dub-confirmed.yaml ohne den Beleg für 900003: ${yaml.slice(0, 200)}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-fetch-pruefungen-laufzeit: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-fetch-pruefungen-laufzeit: Staffel 2 an Staffelreihe 2 (nicht OVA), Staffel 1 und 2 getrennt, Beleg in dub-confirmed.yaml angehängt, Staffel ohne Zahl über Netflix\' Aufteilung verteilt, Notiz je Staffel.')
