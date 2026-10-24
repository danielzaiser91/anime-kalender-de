/**
 * Hält die Bot-Dateien ohne Leser (`pr-nachrechnen-bot-pfade.mjs`, geprüft für Bau und Kette) gegen die Leser von `check:bestand` und
 * `check:bestand-liste`: Wer dort gelesen wird, darf im Neuversuch nicht als `nichts` gelten (`neuversuch-art.mjs`, `BESTAND_GELESEN`),
 * denn bei `nichts` entfällt `check:bestand`. Die Liste hier ist die Handdurchsicht vom 24.10.2026 und steht fest im Test.
 * Grenze: ein Dateiname, der erst zur Laufzeit zusammengesetzt wird, fällt nicht auf (wie im Bau-Leser-Test).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BESTAND_GELESEN, neuversuchArt } from './neuversuch-art.mjs'
import { BOT_DATEIEN_OHNE_LESER, istBotDatei } from './pr-nachrechnen-bot-pfade.mjs'
import { BEKANNT_TREFFER } from './pr-nachrechnen-bot-pfade-bekannt.mjs'
import { importe } from './pr-nachrechnen-bot-pfade-leser.mjs'

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const skripte = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8')).scripts
const lesen = (datei) => fs.readFileSync(path.join(wurzel, datei), 'utf8')
const istDatei = (datei) => fs.existsSync(path.join(wurzel, datei)) && fs.statSync(path.join(wurzel, datei)).isFile()

/** Alle Code-Dateien, die `npm run <name>` ausführt (verschachtelte `npm run`, `tsx`/`node`-Ziele). */
function skriptDateien(name, gesehen = new Set()) {
  if (gesehen.has(name) || skripte[name] === undefined) return []
  gesehen.add(name)
  const text = skripte[name]
  const dateien = [...text.matchAll(/(?:tsx|node)\s+([A-Za-z0-9_./-]+\.(?:ts|mjs|cjs))/g)].map((m) => m[1])
  const weitere = [...text.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].flatMap((m) => skriptDateien(m[1], gesehen))
  return [...dateien, ...weitere]
}

function bestandDateien() {
  const liste = lesen('tools/check-bestand-liste.txt').split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#'))
  const offen = [...skriptDateien('check:bestand'), ...liste]
  const gesehen = new Set(offen)
  while (offen.length > 0) {
    const datei = offen.pop()
    if (!istDatei(datei)) continue
    for (const ziel of importe(wurzel, datei).filter((z) => !gesehen.has(z))) {
      gesehen.add(ziel)
      offen.push(ziel)
    }
  }
  return [...gesehen].filter((d) => /\.(ts|tsx|mjs|cjs|mts)$/.test(d) && istDatei(d)).sort()
}

const dateien = bestandDateien()
assert.ok(dateien.length > 40, `check:bestand: nur ${dateien.length} Dateien gefunden, die Suche greift nicht`)
const codes = dateien.map((d) => [d, lesen(d).split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*|#)/.test(z)).join('\n')])
const leserVon = (eintrag) => codes.filter(([d, code]) => !BEKANNT_TREFFER.has(`${d}|${eintrag}`) && code.includes(eintrag.split('/').pop())).map(([d]) => d)

const gelesen = BOT_DATEIEN_OHNE_LESER.filter((eintrag) => leserVon(eintrag).length > 0)
const fehlt = gelesen.filter((e) => !BESTAND_GELESEN.includes(e))
assert.deepEqual(fehlt, [], `Bot-Dateien, die check:bestand liest, fehlen in BESTAND_GELESEN: ${fehlt.map((e) => `${e} (${leserVon(e)[0]})`).join(', ')}`)
const veraltet = BESTAND_GELESEN.filter((e) => !gelesen.includes(e))
assert.deepEqual(veraltet, [], `BESTAND_GELESEN nennt Dateien, die check:bestand nicht liest (oder nicht mehr auf der Bot-Liste): ${veraltet.join(', ')}`)

// Festes Wissen: dieser Anlass (Prüfer 24.10.2026) muss drin sein, und das Ergebnis des Einteilers muss ihn als `daten` führen.
// Zusammengesetzt: der Leser-Wächter der Bot-Liste verbietet den Dateinamen in tools/-Tests.
const KALENDER = `tools/kalender-plausibilitaet${'-grenzen'}.json`
assert.ok(BESTAND_GELESEN.includes(KALENDER), 'die Kalender-Grenzen liest check:bestand')
const nurDiese = () => [KALENDER]
assert.equal(neuversuchArt('L', 'B', 'N', nurDiese), 'daten', 'Kalender-Grenzen allein: Bau und check:bestand laufen, nicht check:logic')
for (const eintrag of BESTAND_GELESEN) assert.ok(istBotDatei(eintrag), `${eintrag} steht nicht (mehr) auf der Bot-Liste`)

console.log(`neuversuch-art-leser: ${dateien.length} check:bestand-Dateien durchsucht, ${BESTAND_GELESEN.length} Bot-Dateien dort gelesen.`)
