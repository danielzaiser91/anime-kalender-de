// Vorlader für pipeline/check-quittung-sperre.ts, nach tools/kanal-messung-mock.mjs geladen: schreibt jeden Abruf
// (Methode, Pfad, Body) und jede Merker-Datei unter quittung-offen/ bzw. quittung-frei/ zeilenweise nach $AK_AUFZEICHNUNG.
// Die Attrappe davor verwirft alle Schreibungen außer dem Beleg; hier wird nur mitgeschrieben, nicht geändert.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const notiere = (zeile) => {
  const fd = fs.openSync(process.env.AK_AUFZEICHNUNG, 'a')
  fs.writeSync(fd, JSON.stringify(zeile) + '\n')
  fs.closeSync(fd)
}

const schreiben = fs.writeFileSync
fs.writeFileSync = (p, inhalt, ...rest) => {
  const pfad = String(p).replaceAll('\\', '/')
  if (/\/quittung-(offen|frei)\//.test(pfad)) notiere({ schreibt: pfad.replace(/^.*\/data\/cache\//, ''), inhalt: String(inhalt) })
  return schreiben(p, inhalt, ...rest)
}
syncBuiltinESMExports()

const holen = globalThis.fetch
globalThis.fetch = async (url, opt) => {
  notiere({ methode: opt?.method ?? 'GET', pfad: new URL(String(url)).pathname, body: opt?.body ?? null })
  return holen(url, opt)
}
