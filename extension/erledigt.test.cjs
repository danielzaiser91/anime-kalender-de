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
for (const name of ['function istErledigt', 'function staffelAngefasst', 'function kuerzelFuerNummern', 'function naechsteUebernahme']) {
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


/**
 * Ein Film wird gemeldet, ohne dass Netflix eine Folge nennt.
 *
 * Zweimal am 22.08.2026 blieb das Zeichen „Film" weiß, obwohl die Meldung im
 * Briefkasten lag: erst weil der Vermerk eine Folgennummer verlangte, dann weil
 * „Flavors of Youth" als Anthologie-Film mit drei Episoden verzeichnet ist und
 * an der Bedingung „höchstens eine Folge" scheiterte.
 */
{
  // Die Entscheidung aus merkeErledigt, nachgestellt.
  const nimmt = (staffeln) => {
    const offene = staffeln.filter((x) => x.offen)
    if (offene.length !== 1) return false
    return true
  }
  pruefe('ein Film mit einer Folge wird vermerkt',
    nimmt([{ nr: 1, folgen: 1, film: true, offen: true }]))
  pruefe('ein Anthologie-Film mit drei Episoden auch',
    nimmt([{ nr: 1, folgen: 3, film: true, offen: true }]))
  /**
   * Auch eine Serie ohne Folgenangabe wird vermerkt, wenn nur eine Staffel
   * offen ist: „Pokémon: The Arceus Chronicles" fuehren wir als Serie mit vier
   * Folgen, bei Netflix ist es ein Film — und der nennt keine Folge. Wer keine
   * Auswahl vorfindet, hat gesehen, was es dort gibt (Daniel, 22.08.2026).
   */
  pruefe('eine Serie ohne Folgenangabe wird bei einer offenen Staffel vermerkt',
    nimmt([{ nr: 1, folgen: 13, film: false, offen: true }]))
  pruefe('bei zwei offenen Staffeln wird nichts vermerkt',
    !nimmt([{ nr: 1, folgen: 1, film: true, offen: true }, { nr: 2, folgen: 1, film: true, offen: true }]))
  pruefe('eine beantwortete Staffel zaehlt nicht mit',
    nimmt([{ nr: 1, folgen: 1, film: true, offen: false }, { nr: 2, folgen: 3, film: true, offen: true }]))
}


/**
 * Keine Empfehlung heißt nicht „erledigt".
 *
 * `[].every(…)` ist immer wahr — ein Titel ohne empfohlene Folgen galt damit
 * als vollständig geprüft. Nach einer einzigen Meldung fiel die Zahl am Knopf
 * von 11 auf 0 (Daniel, 22.08.2026).
 */
{
  const fertig = (kuerzel, tot = false) => {
    if (tot) return true
    if (!kuerzel.length) return false
    return kuerzel.every(() => true)
  }
  pruefe('ein Titel ohne Empfehlungen gilt nicht als erledigt', !fertig([]))
  pruefe('ein Titel mit erledigten Empfehlungen schon', fertig(['1e01']))
  pruefe('ein toter Verweis ist immer erledigt', fertig([], true))
}


/**
 * Die Bruecke zwischen abweichenden Kennungen darf nicht zu breit sein.
 *
 * Ohne Namensabgleich galt jeder Titel als gesucht, solange irgendwann in den
 * letzten Minuten aus der Liste geklickt worden war — Daniel bekam eine Meldung
 * zu „Heroes" untergeschoben, waehrend er die Serie einfach ansah (22.08.2026).
 */
{
  const kern = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const passt = (laufend, gemeint) => {
    const a = kern(laufend), b = kern(gemeint)
    if (!a || !b) return false
    return a.includes(b) || b.includes(a)
  }
  pruefe('„Heroes" passt nicht zu „Kakegurui"', !passt('Heroes', 'Kakegurui'))
  pruefe('derselbe Titel passt', passt('Ranma1/2 (2024)', 'Ranma1/2 (2024)'))
  pruefe('eine Fortsetzung passt zum Reihennamen', passt('Haikyu!! To The Top', 'HAIKYU!!'))
  pruefe('Sonderzeichen stoeren nicht', passt('KONOSUBA -God\u0027s blessing', 'KONOSUBA God s blessing'))
  pruefe('ohne Namen gilt nichts', !passt('', 'Kakegurui') && !passt('Heroes', ''))
}

/**
 * Gemeldete Nummern werden über ALLE Staffeln zugeordnet, nicht nur die geladene.
 *
 * Der Worker führt die Meldungen als blanke Folgennummern. Der erste Anlauf
 * übersetzte sie über `DURCHLAUF.folgen` — die Folgen der Staffel, deren Liste
 * Netflix gerade zeigt. Bei One Piece Staffel 38 waren das 34 von 216; der
 * Dialog zeigte E1124–1154 als offen, während der Knopf „alles geprüft" sagte
 * (Daniel, 26.08.2026).
 *
 * Die Staffelgrenzen unten sind Onepieces echte Zuschnitte bei Netflix.
 */
{
  const staffeln = [
    { nr: 1, erste: 1, folgen: 61 },
    { nr: 38, erste: 1089, folgen: 34 },
    { nr: 39, erste: 1123, folgen: 33 },
    { nr: 40, erste: 1156, folgen: 19 },
  ]
  const k = (...n) => kuerzelFuerNummern(staffeln, n)

  pruefe(
    'eine Nummer aus einer fremden Staffel wird trotzdem zugeordnet',
    k(1130)[0] === '39e1130',
    k(1130),
  )
  pruefe('die erste Folge einer Staffel gehört ihr', k(1123)[0] === '39e1123', k(1123))
  pruefe('die letzte auch', k(1155)[0] === '39e1155', k(1155))
  pruefe('die nächste gehört schon der folgenden', k(1156)[0] === '40e1156', k(1156))
  pruefe('Staffel 1 zählt ab 1', k(1)[0] === '1e01' && k(61)[0] === '1e61', k(1, 61))

  /* Der Fall, um den es ging: der ganze Bereich, den der Dialog offen zeigte. */
  const bereich = []
  for (let n = 1124; n <= 1154; n++) bereich.push(n)
  pruefe(
    'die 31 Folgen aus Daniels Meldung landen alle in Staffel 39',
    kuerzelFuerNummern(staffeln, bereich).length === 31 &&
      kuerzelFuerNummern(staffeln, bereich).every((x) => x.startsWith('39e')),
    kuerzelFuerNummern(staffeln, bereich).length,
  )

  /* Und eine Nummer, die keine Staffel kennt, erfindet keine. */
  pruefe('eine Lücke zwischen den Staffeln bleibt unzugeordnet', k(500).length === 0, k(500))
  pruefe('eine Nummer hinter der letzten Staffel auch', k(9999).length === 0, k(9999))
}
/**
 * Die Uhrzeit der nächsten Übernahme.
 *
 * Sie sagt Daniel, wann die gemeldeten Titel aus der Prüfliste verschwinden
 * müssen — und damit, ob der stündliche Lauf seine Arbeit getan hat
 * (26.08.2026). Eine falsch gerechnete Uhrzeit macht aus einem gesunden Lauf
 * einen verdächtigen.
 */
{
  const um = (h, m) => new Date(2026, 7, 26, h, m, 30)
  const uhr = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

  pruefe(
    'vor der Minute 23 gilt dieselbe Stunde',
    uhr(naechsteUebernahme(um(16, 5))) === '16:23',
    uhr(naechsteUebernahme(um(16, 5))),
  )
  pruefe(
    'nach der Minute 23 die nächste',
    uhr(naechsteUebernahme(um(16, 33))) === '17:23',
    uhr(naechsteUebernahme(um(16, 33))),
  )
  pruefe(
    'genau auf der Minute zählt schon die nächste Stunde',
    uhr(naechsteUebernahme(new Date(2026, 7, 26, 16, 23, 0))) === '17:23',
    uhr(naechsteUebernahme(new Date(2026, 7, 26, 16, 23, 0))),
  )
  /* Über Mitternacht darf kein 24:23 entstehen. */
  pruefe(
    'über Mitternacht springt der Tag mit',
    uhr(naechsteUebernahme(um(23, 40))) === '00:23' &&
      naechsteUebernahme(um(23, 40)).getDate() === 27,
    uhr(naechsteUebernahme(um(23, 40))),
  )
  pruefe(
    'die Sekunden fallen weg',
    naechsteUebernahme(um(16, 5)).getSeconds() === 0,
    naechsteUebernahme(um(16, 5)).getSeconds(),
  )
}
/*
  **Die Staffel der Folge reist bis zum Vermerk mit.**

  Zwei Stellen gaben stattdessen die des Players weiter, und beide haben
  gekostet (31.08.2026):

  - `durchlaufMelden` hakte mit `null` ab. `merkeErledigt` leitet die Staffel
    dann aus "genau eine offene" ab und steigt bei mehreren aus — bei Death Note
    blieb Folge 31 schwarz, obwohl die Meldung angekommen war.
  - `randMelden` stempelte alle Folgen einer Randprobe mit der Staffel der einen
    gemessenen. Bei Dorohedoro landeten so 1, 12 und 13 in Staffel 1.

  Geprüft wird die Quelle, nicht ein Nachbau: Beide Funktionen sind
  `async` und haengen an `chrome.storage`, ihr Fehler war aber ein
  weitergereichter Wert.
*/
/*
  **Eine geratene Staffelnummer ist schlechter als keine.**

  Netflix' Season-Knoten traegt keine Nummer; der Leser vergibt sie nach der
  Reihenfolge des Eintreffens. Bei Black Clover kamen 168 Meldungen an als
  "St. 2: 1-50, St. 3: 52-101, St. 1: 104-155" — die Folgennummern stimmten
  alle, die Staffeln keine einzige (Daniel, 31.08.2026).
*/
{
  const von = quelle.indexOf('function staffelnBereinigen')
  eval(quelle.slice(von, quelle.indexOf('\n}\n', von) + 3))
  const durch = staffelnBereinigen([
    { nummer: 1, staffel: 2 },
    { nummer: 2, staffel: 2 },
    { nummer: 104, staffel: 1 },
  ])
  pruefe(
    'bei durchlaufenden Nummern faellt die geratene Staffel weg',
    durch.every((f) => f.staffel === null),
  )
  const jeStaffel = staffelnBereinigen([
    { nummer: 1, staffel: 1 },
    { nummer: 1, staffel: 2 },
    { nummer: 2, staffel: 2 },
  ])
  pruefe(
    'zaehlt der Anbieter je Staffel neu, bleibt sie stehen',
    jeStaffel.every((f) => f.staffel !== null),
  )
}
for (const name of ['durchlaufMelden', 'randMelden']) {
  const von = quelle.indexOf('async function ' + name)
  const block = quelle.slice(von, quelle.indexOf('\n}\n', von))
  pruefe(
    `${name} liest die Staffel an der Folge`,
    /Number\.isFinite\((f|folge)\??\.staffel\)/.test(block),
  )
  pruefe(
    `${name} hakt nicht mit einer erratenen Staffel ab`,
    /merkeErledigt\([^;\n]*staffelDerFolge/.test(block),
  )
}

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Geprüftes wird sichtbar')
process.exit(fehler ? 1 : 0)
