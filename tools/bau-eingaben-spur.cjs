/**
 * Spur des Seitenbaus (17.10.2026): `tools/bau-eingaben.mjs` lädt diese Datei per `NODE_OPTIONS=--require` in jeden Node-Prozess und Thread
 * des Baus. Sie hängt jeden neuen Pfad, den eine fs-Funktion bekommt, sofort an `$BAU_SPUR/<pid>-<thread>.txt` an (Zeile:
 * `<funktion>\t<Pfad ab Wurzel>`, Wurzel als `.`; Aliase wie Junction, `\\?\` oder `/proc/self/cwd` aufgelöst), dazu jeden Programmstart
 * (`start\t<JSON>`) und jeden `process.binding`-Aufruf. Der Haupt-Thread beginnt mit `beginn` und endet mit `ende`; Threads brauchen kein
 * `ende` (tsx-Ladethreads enden per `terminate()`), weil jeder Pfad vor dem Zugriff geschrieben wird. Ausgewertet wird in bau-eingaben.mjs.
 */
const fs = require('node:fs')
const path = require('node:path')
const { promisify } = require('node:util')
const { fileURLToPath } = require('node:url')
const childProcess = require('node:child_process')
const workerThreads = require('node:worker_threads')

const ORDNER = process.env.BAU_SPUR
const VORLADER = `--require ${__filename.replace(/\\/g, '/')}`
const { openSync, writeSync } = fs
const echt = fs.realpathSync.native
const WURZEL = echt(path.resolve(__dirname, '..'))
const gesehen = new Set()

const relativ = (p) => path.relative(WURZEL, p).replace(/\\/g, '/') || '.'
const innen = (rel) => !rel.startsWith('..') && !path.isAbsolute(rel) && !/^(node_modules|dist)(\/|$)/.test(rel)

/** Wirklicher Pfad (Alias aufgelöst); gibt es ihn nicht, der des nächsten vorhandenen Vorfahren samt Rest. */
function aufgeloest(p) {
  try {
    return echt(p)
  } catch {
    const oben = path.dirname(p)
    return oben === p ? p : path.join(aufgeloest(oben), path.basename(p))
  }
}

function schreibe(fd, zeile) {
  if (gesehen.has(zeile)) return
  gesehen.add(zeile)
  writeSync(fd, `${zeile}\n`)
}

function merke(fd, funktion, p) {
  const roh = p instanceof URL ? fileURLToPath(p) : typeof p === 'string' ? p : Buffer.isBuffer(p) ? p.toString() : ''
  if (!roh) return
  const voll = path.resolve(roh)
  for (const rel of new Set([relativ(voll), relativ(aufgeloest(voll))])) if (innen(rel)) schreibe(fd, `${funktion}\t${rel}`)
}

let tiefe = 0
/** Ruft `f` auf und zählt die Tiefe mit: Ein `ChildProcess`-Start innerhalb einer Hülle ist schon geschrieben. */
function gezaehlt(f) {
  tiefe++
  try {
    return f()
  } finally {
    tiefe--
  }
}

/** Hülle um `original`, die vor jedem Aufruf `vorher(args)` ausführt; behält alle Eigenschaften samt `promisify.custom` (auch umhüllt). */
function huelle(original, vorher) {
  const neu = function (...args) {
    return gezaehlt(() => original.apply(this, vorher(args)))
  }
  const eigenschaften = Object.getOwnPropertyDescriptors(original)
  delete eigenschaften[promisify.custom]
  Object.defineProperties(neu, eigenschaften)
  const eigen = original[promisify.custom]
  if (typeof eigen === 'function') {
    const eigenNeu = (...args) => gezaehlt(() => eigen.apply(undefined, vorher(args)))
    Object.defineProperty(neu, promisify.custom, { value: eigenNeu, configurable: true })
  }
  return neu
}

function umhuelle(ziel, vorsatz, fd) {
  for (const name of Object.keys(ziel)) {
    if (typeof ziel[name] !== 'function' || /^[A-Z]/.test(name)) continue
    ziel[name] = huelle(ziel[name], (args) => {
      merke(fd, `${vorsatz}${name}`, args[0])
      return args
    })
  }
}

/** Eine env (auch `{}` oder eine geleerte `process.env`) bekommt Spur-Ordner und Vorlader, damit kein Kind außerhalb der Spur liest. */
function mitSpur(env) {
  const optionen = env.NODE_OPTIONS ?? ''
  return { ...env, BAU_SPUR: ORDNER, NODE_OPTIONS: optionen.includes(VORLADER) ? optionen : `${optionen} ${VORLADER}`.trim() }
}
const istOptionen = (a) => a !== null && typeof a === 'object' && !Array.isArray(a)

/** Was gestartet wird: Shell-Befehl, Programm samt argv und Arbeitsordner (ab Wurzel), oder Node (`fork` ohne eigenes `execPath`). */
function startVon(name, args) {
  const argv = Array.isArray(args[1]) ? args[1].map(String) : []
  const optionen = args.slice(1, 3).find(istOptionen) ?? {}
  if (name === 'exec' || name === 'execSync' || optionen.shell) return { shell: [args[0], ...argv].map(String).join(' ') }
  const datei = name === 'fork' ? (optionen.execPath ?? process.execPath) : args[0]
  const cwd = relativ(aufgeloest(path.resolve(String(optionen.cwd ?? '.'))))
  return { datei: String(datei), argv, cwd }
}

/** Jede Startfunktion schreibt den Start in die Spur und reicht die Spur weiter (eigene env oder wieder ergänzte `process.env`). */
function reicheWeiter(fd) {
  const ergaenze = (args) => {
    Object.assign(process.env, mitSpur(process.env))
    return args.map((a) => (istOptionen(a) && istOptionen(a.env) ? { ...a, env: mitSpur(a.env) } : a))
  }
  for (const name of Object.keys(childProcess)) {
    if (typeof childProcess[name] !== 'function' || /^[A-Z]/.test(name)) continue
    childProcess[name] = huelle(childProcess[name], (args) => {
      schreibe(fd, `start\t${JSON.stringify(startVon(name, args))}`)
      return ergaenze(args)
    })
  }
  // Wer `ChildProcess` direkt startet, umgeht die Funktionen oben: das zählt als unerklärter Start.
  const roh = childProcess.ChildProcess.prototype.spawn
  childProcess.ChildProcess.prototype.spawn = function (optionen) {
    if (tiefe === 0) schreibe(fd, `start\t${JSON.stringify({ roh: String(optionen?.file) })}`)
    return roh.call(this, optionen)
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
  writeSync(fd, 'beginn\n')
  umhuelle(fs, '', fd)
  umhuelle(fs.promises, 'promises.', fd)
  reicheWeiter(fd)
  const binding = process.binding
  process.binding = function (name) {
    schreibe(fd, `binding\t${name}`)
    return binding.call(this, name)
  }
  process.on('exit', () => writeSync(fd, 'ende\n'))
}
