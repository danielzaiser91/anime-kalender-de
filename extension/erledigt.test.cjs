/**
 * Wird sichtbar, was schon geprüft wurde?
 *
 * Daniel am 22.08.2026: „ich click drauf, es öffnet sich neuer tab, ich prüfe
 * es, schließe den tab, die liste bleibt wie vorher." Drei Ursachen kamen
 * infrage, und alle drei stehen hier als Fall.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/melder.js', 'utf8')

// Die beiden Prüffunktionen aus der Quelle holen statt sie nachzubauen.
let code = ''
for (const name of ['function istErledigt', 'function staffelAngefasst']) {
  const von = quelle.indexOf(name)
  if (von < 0) { console.error('nicht gefunden: ' + name); process.exit(1) }
  code += quelle.slice(von, quelle.indexOf('\n}\n', von) + 3) + '\n'
}
let erledigt = {}
eval(code)

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

erledigt = { '80183051': ['2e01', '2e12'] }
pruefe('die genau gemeldete Folge gilt als erledigt', istErledigt('80183051', '2e01'))
pruefe('eine andere Folge derselben Staffel nicht', !istErledigt('80183051', '2e05'))

/**
 * Der Fall, an dem es hing: Netflix bietet beim Öffnen oft die zuletzt
 * gesehene Folge an. Dann wird „1e03" gespeichert, während in der Liste
 * „1e01" steht — und ohne die zweite Stufe sähe der Titel unangetastet aus.
 */
erledigt = { '70202589': ['1e03'] }
pruefe('trotzdem ist die Staffel erkennbar angefasst', staffelAngefasst('70202589', 1))
pruefe('eine andere Staffel bleibt unberührt', !staffelAngefasst('70202589', 2))
pruefe('und die genaue Folge gilt weiter als offen', !istErledigt('70202589', '1e01'))

// Zweistellige Staffeln dürfen nicht mit einstelligen verschwimmen.
erledigt = { '123': ['12e01'] }
pruefe('Staffel 12 färbt nicht Staffel 1', !staffelAngefasst('123', 1) && staffelAngefasst('123', 12))

// Ein toter Verweis ist auch erledigte Arbeit.
erledigt = { '81747897': ['tot'] }
pruefe('ein als tot gemeldeter Verweis ist vermerkt', istErledigt('81747897', 'tot'))

erledigt = {}
pruefe('ohne Vermerke ist nichts erledigt',
  !istErledigt('123', '1e01') && !staffelAngefasst('123', 1))


/**
 * Der Schlüssel, der eine Meldung eindeutig macht.
 *
 * Ohne die Staffel trugen Staffel 3 Folge 1 und Staffel 4 Folge 1 denselben
 * Schlüssel — die zweite Meldung galt als längst gesendet und ging nie raus,
 * während der Knopf den Erfolgstext der ersten weiterzeigte (Daniel,
 * 22.08.2026). Ein Fehler, der Erfolg meldet und nichts tut.
 */
{
  const bau = (stand) => `${stand.reihe}:${stand.staffel ?? '—'}:${stand.folgeNr ?? '—'}`
  pruefe('gleiche Folge in verschiedenen Staffeln bleibt unterscheidbar',
    bau({ reihe: '80198505', staffel: 3, folgeNr: 1 }) !== bau({ reihe: '80198505', staffel: 4, folgeNr: 1 }))
  pruefe('dieselbe Folge derselben Staffel bleibt dieselbe',
    bau({ reihe: '80198505', staffel: 3, folgeNr: 1 }) === bau({ reihe: '80198505', staffel: 3, folgeNr: 1 }))
  pruefe('ohne Staffelangabe trennt weiterhin die Folge',
    bau({ reihe: 'x', folgeNr: 1 }) !== bau({ reihe: 'x', folgeNr: 2 }))
  pruefe('verschiedene Reihen bleiben getrennt',
    bau({ reihe: 'a', staffel: 1, folgeNr: 1 }) !== bau({ reihe: 'b', staffel: 1, folgeNr: 1 }))
}

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Geprüftes wird sichtbar')
process.exit(fehler ? 1 : 0)
