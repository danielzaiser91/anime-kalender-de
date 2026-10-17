/**
 * Spur des Seitenbaus (17.10.2026): `tools/bau-eingaben.mjs` lädt diese Datei per `NODE_OPTIONS=--require` in jeden Node-Prozess und Thread
 * des Baus. Sie hängt jeden neuen Pfad unter der Repo-Wurzel, den eine fs-Funktion bekommt, sofort an `$BAU_SPUR/<pid>-<thread>.txt` an
 * (Zeile: `<funktion>\t<Pfad ab Wurzel>`, Wurzel als `.`), und zum Schluss `ende`. Fehlt `ende` (Thread per `terminate()`, Absturz), gibt es
 * keinen Abdruck. Unterprozesse und Worker mit eigener env bekommen Spur und Vorlader nachgereicht. Ausgewertet wird dort, nicht hier.
 */
const fs = require('node:fs')
const path = require('node:path')
const { fileURLToPath } = require('node:url')
const childProcess = require('node:child_process')
const workerThreads = require('node:worker_threads')

const ORDNER = process.env.BAU_SPUR
const VORLADER = `--require ${__filename.replace(/\\/g, '/')}`
const WURZEL = path.resolve(__dirname, '..')
const gesehen = new Set()
const { openSync, writeSync } = fs

function merke(fd, funktion, p) {
  const roh = p instanceof URL ? fileURLToPath(p) : typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : ''
  if (!roh) return
  const rel = path.relative(WURZEL, path.resolve(roh)).replace(/\\/g, '/') || '.'
  if (rel.startsWith('..') || path.isAbsolute(rel) || /^(node_modules|dist)(\/|$)/.test(rel)) return
  const zeile = `${funktion}\t${rel}`
  if (gesehen.has(zeile)) return
  gesehen.add(zeile)
  writeSync(fd, `${zeile}\n`)
}

function umhuelle(ziel, vorsatz, fd) {
  for (const name of Object.keys(ziel)) {
    const original = ziel[name]
    if (typeof original !== 'function' || /^[A-Z]/.test(name)) continue
    // Object.assign behält Anhängsel wie `realpathSync.native`, die Vite aufruft.
    ziel[name] = Object.assign(function (p, ...rest) {
      merke(fd, `${vorsatz}${name}`, p)
      return original.call(this, p, ...rest)
    }, original)
  }
}

/** Eine env (auch `{}` oder eine geleerte `process.env`) bekommt Spur-Ordner und Vorlader, damit kein Kind außerhalb der Spur liest. */
function mitSpur(env) {
  const optionen = env.NODE_OPTIONS ?? ''
  return { ...env, BAU_SPUR: ORDNER, NODE_OPTIONS: optionen.includes(VORLADER) ? optionen : `${optionen} ${VORLADER}`.trim() }
}
const istOptionen = (a) => a !== null && typeof a === 'object' && !Array.isArray(a)

/** Jede Startfunktion bekommt die Spur in eine eigene env nachgereicht, ohne eigene env erbt das Kind die wieder ergänzte `process.env`. */
function reicheWeiter() {
  const ergaenze = (args) => {
    Object.assign(process.env, mitSpur(process.env))
    return args.map((a) => (istOptionen(a) && istOptionen(a.env) ? { ...a, env: mitSpur(a.env) } : a))
  }
  for (const name of Object.keys(childProcess)) {
    const original = childProcess[name]
    if (typeof original !== 'function' || /^[A-Z]/.test(name)) continue
    childProcess[name] = function (...args) {
      return original.apply(this, ergaenze(args))
    }
  }
  const Worker = workerThreads.Worker
  workerThreads.Worker = class extends Worker {
    constructor(...args) {
      super(...ergaenze(args))
    }
  }
}

if (ORDNER) {
  const fd = openSync(path.join(ORDNER, `${process.pid}-${workerThreads.threadId}.txt`), 'a')
  umhuelle(fs, '', fd)
  umhuelle(fs.promises, 'promises.', fd)
  reicheWeiter()
  process.on('exit', () => writeSync(fd, 'ende\n'))
}
