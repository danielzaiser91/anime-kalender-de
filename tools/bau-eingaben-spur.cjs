/**
 * Spur des Seitenbaus (17.10.2026): `tools/bau-eingaben.mjs` lädt diese Datei per `NODE_OPTIONS=--require` in jeden Node-Prozess des Baus
 * (auch Unterprozesse). Sie merkt sich jeden Pfad unter der Repo-Wurzel, den eine fs-Funktion bekommt, und schreibt die Menge beim Ende
 * des Prozesses nach `$BAU_SPUR/<pid>.txt` (Zeile: `<funktion>\t<Pfad ab Wurzel>`). Ausgewertet wird dort, nicht hier.
 */
const fs = require('node:fs')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

const ORDNER = process.env.BAU_SPUR
const WURZEL = path.resolve(__dirname, '..')
const gesehen = new Set()

function merke(funktion, p) {
  const roh = p instanceof URL ? fileURLToPath(p) : typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : ''
  if (!roh) return
  const rel = path.relative(WURZEL, path.resolve(roh)).replace(/\\/g, '/')
  if (rel.startsWith('..') || path.isAbsolute(rel) || /^(node_modules|dist)(\/|$)/.test(rel)) return
  gesehen.add(`${funktion}\t${rel}`)
}

function umhuelle(ziel, vorsatz) {
  for (const name of Object.keys(ziel)) {
    const original = ziel[name]
    if (typeof original !== 'function' || /^[A-Z]/.test(name)) continue
    // Object.assign behält Anhängsel wie `realpathSync.native`, die Vite aufruft.
    ziel[name] = Object.assign(function (p, ...rest) {
      merke(`${vorsatz}${name}`, p)
      return original.call(this, p, ...rest)
    }, original)
  }
}

if (ORDNER) {
  umhuelle(fs, '')
  umhuelle(fs.promises, 'promises.')
  process.on('exit', () => {
    fs.writeFileSync(path.join(ORDNER, `${process.pid}.txt`), [...gesehen].join('\n'))
  })
}
