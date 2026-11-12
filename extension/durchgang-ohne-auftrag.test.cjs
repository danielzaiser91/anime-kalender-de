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

/* Der Klick (`selbstKlick`) wertet den Rückgabewert aus und sagt es dem Benutzer — die echte Funktion läuft mit Attrappen. */
const vm = require('node:vm')
const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(readFileSync(resolve(__dirname, 'netflix-durchgang-steuerung.js'), 'utf8'), kontext)
const von = quelle.indexOf('function selbstKlick(selbst)')
const knopf = quelle.slice(von, quelle.indexOf('\n}\n', von) + 2)
pruefe('Klick-Handler hängt am Knopf', /akKlick\(selbst, \(\) => selbstKlick\(selbst\)\)/.test(quelle) && von > 0)
const jetzt = 1000000
const klick = ({ selbstAn = false, besitzer = null, start = true } = {}) => {
  const z = { gestartet: 0, beendet: [], geschlossen: 0, timer: [] }
  const selbst = { textContent: '▶ alle durchgehen', title: 'alt', disabled: false }
  new Function(
    'selbstAn', 'laufBeenden', 'dialogSchliessen', 'akNetflixStartHinweis', 'durchgangBesitzer', 'meinTab', 'Date', 'laufStarten', 'selbstUebersprungen', 'setTimeout', 'selbst',
    `${knopf}\nselbstKlick(selbst)`,
  )(
    selbstAn, (g) => z.beendet.push(g), () => z.geschlossen++, kontext.akNetflixStartHinweis, besitzer, 'tab-a', { now: () => jetzt },
    () => { z.gestartet++; return start }, { keinAuftrag: () => ({ text: 'nichts offen', title: 'Titel kein Auftrag' }) }, (f, ms) => z.timer.push([f, ms]), selbst,
  )
  return { z, selbst }
}
let r = klick({ besitzer: { tab: 'tab-b', puls: jetzt - 12000 } })
pruefe('Fremder Durchgang lebt: Hinweis „Läuft schon in einem anderen Tab", Start nicht aufgerufen, Knopf gesperrt', r.selbst.textContent === 'Läuft schon in einem anderen Tab' && /vor 12 s/.test(r.selbst.title) && r.selbst.disabled === true && r.z.gestartet === 0, r)
r.z.timer[0][0]()
pruefe('… nach 5 s steht der alte Text wieder da, Knopf frei', r.z.timer[0][1] === 5000 && r.selbst.textContent === '▶ alle durchgehen' && r.selbst.disabled === false)
r = klick({ besitzer: { tab: 'tab-a', puls: jetzt - 1000 } })
pruefe('Eigener Besitzer: Start wird versucht, bei Erfolg bleibt der Knopf unberührt', r.z.gestartet === 1 && r.selbst.textContent === '▶ alle durchgehen' && r.selbst.disabled === false && r.z.timer.length === 0, r)
r = klick({ besitzer: { tab: 'tab-b', puls: jetzt - 90000 } })
pruefe('Toter fremder Besitzer (Tab zu, 90 s): Start läuft', r.z.gestartet === 1 && r.z.timer.length === 0, r)
r = klick({ besitzer: null })
pruefe('Kein Besitzer: Start läuft', r.z.gestartet === 1 && r.z.timer.length === 0)
r = klick({ besitzer: null, start: false })
pruefe('Kein Auftrag: Hinweis „nichts offen" (wie bisher), Knopf kurz gesperrt', r.z.gestartet === 1 && r.selbst.textContent === 'nichts offen' && r.selbst.title === 'Titel kein Auftrag' && r.selbst.disabled === true, r)
r = klick({ selbstAn: true, besitzer: { tab: 'tab-b', puls: jetzt } })
pruefe('Durchgang läuft: der Klick beendet von Hand und schließt den Dialog, kein Start', JSON.stringify(r.z.beendet) === '["von Hand"]' && r.z.geschlossen === 1 && r.z.gestartet === 0, r)
pruefe('Kein Schließen des Dialogs, wenn der Start nicht gelang', klick({ start: false }).z.geschlossen === 0)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Durchgang halten.')
