// Vorlader für den Prozesstest von tools/pr-nachrechnen.mjs: ersetzt execFileSync, bevor das Werkzeug lädt.
// Jeder Aufruf landet als JSON-Zeile [befehl, args, optionen] in ATTRAPPE_LOG; die Antwort steht in ATTRAPPE_DATEN unter den
// mit Leerzeichen verbundenen Argumenten ({ aus } oder { fehler }); ist `aus` eine Liste, bekommt der n-te Aufruf das n-te Element
// (das letzte bleibt). Unbekannte Aufrufe scheitern (wie gh bei falschem Pfad).
import cp from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const gezaehlt = {}
cp.execFileSync = (befehl, args, optionen) => {
  fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify([befehl, args, optionen]) + '\n')
  const schluessel = args.join(' ')
  const antwort = JSON.parse(fs.readFileSync(process.env.ATTRAPPE_DATEN, 'utf8'))[schluessel]
  if (antwort === undefined || antwort.fehler !== undefined) throw new Error(antwort?.fehler ?? `HTTP 404: ${schluessel}`)
  const n = (gezaehlt[schluessel] = (gezaehlt[schluessel] ?? 0) + 1)
  return Array.isArray(antwort.aus) ? antwort.aus[Math.min(n, antwort.aus.length) - 1] : antwort.aus
}
syncBuiltinESMExports()
