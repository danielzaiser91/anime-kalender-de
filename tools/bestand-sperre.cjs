/**
 * Sperre für `check:logic` (Wächter, 12.10.2026): Eine Prüfung aus `tools/check-logic-liste.txt` darf den gebauten Bestand
 * (`public/data`) nicht lesen. Der Bestand liegt oft hinter neueren Rohdaten zurück; eine solche Prüfung machte am 12.10. fünf freigegebene
 * PRs rot, ohne dass ein PR etwas dafür konnte. Solche Prüfungen gehören in `tools/check-bestand-liste.txt` (`check:bestand`).
 *
 * `tools/check-logic-alle.mjs` lädt diese Datei per `NODE_OPTIONS=--require` in jede Prüfung (auch in deren Unterprozesse).
 * `BESTAND_ERLAUBT` (kommagetrennt) nennt die Pfade einer Ausnahme (`tools/check-logic-bestand-ausnahmen.json`); jeder erlaubte Lesezugriff
 * wird in `BESTAND_SPUR` vermerkt, damit der Aufrufer eine überflüssige Ausnahme erkennt.
 */
const fs = require('node:fs')
const { fileURLToPath } = require('node:url')
const os = require('node:os')
const path = require('node:path')

const erlaubt = (process.env.BESTAND_ERLAUBT ?? '').split(',').filter(Boolean)
const spur = process.env.BESTAND_SPUR

function pfadVon(p) {
  if (p instanceof URL) return fileURLToPath(p).replace(/\\/g, '/')
  return typeof p === 'string' ? p.replace(/\\/g, '/') : ''
}

const TEMP_ORDNER = [os.tmpdir(), fs.realpathSync(os.tmpdir())].map((t) => t.replace(/\\/g, '/').toLowerCase())

/** Unter dem Temp-Ordner liegen Attrappen der Tests (`…/public/data` einer Kopie), nie der echte Bestand. */
function imTemp(pfad) {
  const abs = path.resolve(pfad).replace(/\\/g, '/').toLowerCase()
  return TEMP_ORDNER.some((t) => abs.startsWith(`${t}/`))
}

function bestandPfad(p) {
  const voll = pfadVon(p)
  const m = /(?:^|\/)(public\/data(?:\/[^?#]*)?)$/.exec(voll)
  return m && !imTemp(voll) ? m[1] : null
}

function pruefe(funktion, p) {
  const pfad = bestandPfad(p)
  if (!pfad) return
  if (erlaubt.includes(pfad)) {
    if (spur) fs.appendFileSync(spur, `${pfad}\n`)
    return
  }
  throw new Error(`${funktion}(${pfad}): check:logic darf den gebauten Bestand nicht lesen. Die Prüfung gehört in tools/check-bestand-liste.txt (check:bestand), siehe tools/bestand-sperre.cjs.`)
}

const LESER = ['readFileSync', 'readFile', 'readdirSync', 'readdir', 'openSync', 'open', 'createReadStream', 'opendirSync']
for (const name of LESER) {
  const original = fs[name]
  fs[name] = function (p, ...rest) {
    pruefe(name, p)
    return original.call(this, p, ...rest)
  }
}
for (const name of ['readFile', 'readdir', 'open']) {
  const original = fs.promises[name]
  fs.promises[name] = function (p, ...rest) {
    pruefe(`promises.${name}`, p)
    return original.call(this, p, ...rest)
  }
}
