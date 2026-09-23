/**
 * **„Alle durchgehen" ohne Auftrag schließt den Dialog nicht.**
 *
 * Daniel am 23.09.2026 mit Bild: „alle durchgehen klick schließt die prüfliste, nichts wird
 * gemeldet." Fünf frisch aufgelegte Titel galten der Erweiterung als gemeldet, weil sie noch
 * einen älteren Prüfstand hielt. `laufStarten()` schloss den Dialog als Erstes und suchte
 * danach — fand nichts und endete mit einer Zeile in der Konsole.
 *
 * Geprüft wird am Quelltext, weil der Durchgang an Netflix, `sessionStorage` und dem
 * Worker-Stand hängt: Die Reihenfolge „erst fragen, dann schließen" muss stehen bleiben.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Durchgang ohne Auftrag')

const schneide = (name) => {
  const i = quelle.indexOf(`function ${name}(`)
  if (i < 0) return ''
  const j = quelle.indexOf('\n}\n', i)
  return j < 0 ? quelle.slice(i) : quelle.slice(i, j + 3)
}

const start = schneide('laufStarten')
pruefe('laufStarten() ist auffindbar', Boolean(start))

/* Der Riegel steht **vor** dem Setzen des Merkers — sonst bleibt ein halber Zustand stehen. */
const riegel = start.indexOf('if (!hierAuftrag && !naechsterAuftrag()) return false')
const merker = start.indexOf('selbstAn = true')
pruefe('erst fragen, dann den Lauf merken', riegel > 0 && merker > riegel, { riegel, merker })

/* Und **vor** dem Schließen des Dialogs. */
const schliessen = start.indexOf('dialogSchliessen()')
pruefe('erst fragen, dann den Dialog schließen', riegel > 0 && schliessen > riegel, { riegel, schliessen })

pruefe('ohne Auftrag kommt false zurück', /return false/.test(start))
pruefe('mit Auftrag kommt true zurück', /\n  return true\n/.test(start))

/* Der Knopf wertet den Rückgabewert aus und sagt es dem Benutzer. */
const knopf = quelle.slice(quelle.indexOf("selbst.addEventListener('click'"), quelle.indexOf("kopf.appendChild(selbst)"))
pruefe('der Knopf prüft den Rückgabewert', /if \(laufStarten\(\)\) return/.test(knopf))
pruefe('und meldet „nichts offen"', /nichts offen/.test(knopf))
/* Nur der Zweig nach dem Riegel zählt — davor steht das Schließen für „Durchgang beenden". */
const nachDemRiegel = knopf.slice(knopf.indexOf('if (laufStarten()) return'))
pruefe('der Dialog bleibt dabei offen', !/dialogSchliessen/.test(nachDemRiegel))

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Durchgang halten.')
