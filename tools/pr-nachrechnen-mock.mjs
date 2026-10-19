// Vorlader für den Prozesstest von tools/pr-nachrechnen.mjs: ersetzt execFileSync, bevor das Werkzeug lädt.
// Jeder Aufruf landet als JSON-Zeile [befehl, args, optionen] in ATTRAPPE_LOG; die Antwort steht in ATTRAPPE_DATEN unter den
// mit Leerzeichen verbundenen Argumenten ({ aus } oder { fehler }). Unbekannte Aufrufe scheitern (wie gh bei falschem Pfad).
import cp from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

cp.execFileSync = (befehl, args, optionen) => {
  fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify([befehl, args, optionen]) + '\n')
  const antwort = JSON.parse(fs.readFileSync(process.env.ATTRAPPE_DATEN, 'utf8'))[args.join(' ')]
  if (antwort === undefined || antwort.fehler !== undefined) throw new Error(antwort?.fehler ?? `HTTP 404: ${args.join(' ')}`)
  return antwort.aus
}
syncBuiltinESMExports()
