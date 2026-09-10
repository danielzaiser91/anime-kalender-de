/**
 * **Der Knopf muss die Folge nennen, die die Prüfliste will.**
 *
 * Daniel am 10.09.2026 an Haikyu!!, Staffel 1: Erwartet war „▶ Episode 26
 * prüfen", auf dem Knopf stand „▶ nur E2 + E25" — der Rückfall für den Fall,
 * dass die Prüfliste nichts Genaues weiß.
 *
 * **Sie wusste es.** Der Eintrag „Haikyu!! Lev ist hier!" steht dort als
 * `nr: 1, erste: 26, folgen: 1, offen: true`. Verloren ging er in
 * `staffelnVon()`: Die Funktion ersetzte unsere neun Einträge durch Netflix'
 * vier Staffeln und zog den Offen-Status über den **Index** nach
 * (`eintrag.staffeln[i]`). Neun auf vier abzubilden geht nicht auf — Netflix'
 * Staffel 1 erbte den Status des zweiten Eintrags, und die vier offenen
 * Nebenausgaben verschwanden ganz.
 *
 * Das Feld, das es entscheidet, lag seit dem 09.09.2026 in der Datei und wurde
 * nie gelesen: `laut: 'anbieter-gerechnet'` heißt, die Liste **ist** schon in
 * der Anbieterzählung ausgedrückt.
 *
 * Geprüft wird durch **Ausführen** an einer Kulisse mit Haikyus Struktur — neun
 * Einträge, vier Anbieterstaffeln. Eine Quelltextprüfung hätte den Indexzugriff
 * für richtig gehalten; er ist ja syntaktisch einwandfrei.
 *
 * Aufruf: `node extension/netflix-auftrag.test.cjs`
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen: der Auftrag kommt aus der Prüfliste (Haikyu!!, 10.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')

function schneide(name) {
  const treffer = new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(quelle)
  return treffer?.[0] ?? null
}

const teile = ['staffelnVon', 'durchlaufAuftrag'].map((n) => [n, schneide(n)])
for (const [name, code] of teile) pruefe(`${name}() ist im Quelltext auffindbar`, Boolean(code))
if (teile.some(([, code]) => !code)) {
  console.error('\nOhne die Funktionen prüft der Rest nichts.')
  process.exit(1)
}

/** Haikyu!! wie es wirklich dasteht: neun Einträge, in Netflix' vier Staffeln gerechnet. */
const HAIKYU = {
  titel: 'Haikyu!!',
  laut: 'anbieter-gerechnet',
  staffeln: [
    { nr: 1, name: 'Haikyu!!', folgen: 25, erste: 1, film: false, offen: false },
    { nr: 1, name: 'Haikyu!! Lev ist hier!', folgen: 1, erste: 26, film: false, offen: true },
    { nr: 2, name: 'Zweite Staffel', folgen: 25, erste: 1, film: false, offen: false },
    { nr: 2, name: 'Kampf gegen ungenügende Noten', folgen: 1, erste: 26, film: false, offen: true },
    { nr: 3, name: 'Karasuno vs. Shiratorizawa', folgen: 10, erste: 1, film: false, offen: false },
    { nr: 3, name: 'Sonderbeitrag', folgen: 1, erste: 11, film: false, offen: true },
    { nr: 4, name: 'To the Top', folgen: 13, erste: 1, film: false, offen: false },
    { nr: 4, name: 'An Land vs. In der Luft', folgen: 2, erste: 14, film: false, offen: true },
    { nr: 4, name: 'To the Top Cour 2', folgen: 12, erste: 16, film: false, offen: false },
  ],
}

/** Was Netflix selbst gemeldet hat — vier Staffeln, gröber als unsere Liste. */
const NETFLIX = [
  { seq: 1, name: 'Haikyu!!', folgen: 26, erste: 1 },
  { seq: 2, name: 'Staffel 2', folgen: 26, erste: 1 },
  { seq: 3, name: 'Staffel 3', folgen: 11, erste: 1 },
  { seq: 4, name: 'Staffel 4', folgen: 27, erste: 1 },
]

/**
 * Führt `durchlaufAuftrag()` für eine gewählte Staffel aus.
 *
 * `gemeldet` sind die videoIds, die schon abgehakt sind — bei Daniel waren das
 * Folge 1 und 26, weshalb der Rückfall „nur E2 + E25" anbot.
 */
function auftragFuer(staffelNr, anzahlFolgen, { gemeldet = [], anbieter = NETFLIX, eintrag = HAIKYU } = {}) {
  const folgen = Array.from({ length: anzahlFolgen }, (_, i) => ({
    nummer: i + 1,
    staffel: staffelNr,
    videoId: `v${i + 1}`,
  }))
  const kontext = {
    anbieterStaffeln: { '80090673': anbieter },
    offeneTitel: { '80090673': eintrag },
    stand: { staffel: null },
    DURCHLAUF: { folgen, gemeldet: new Set(gemeldet) },
    gemeinteReihe: () => '80090673',
    Number,
    Set,
    Boolean,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(teile.map(([, code]) => code).join('\n\n') + '\nergebnis = durchlaufAuftrag()', kontext)
  return kontext.ergebnis?.map((f) => f.nummer) ?? null
}

/* Daniels Fall, wörtlich: Staffel 1 gewählt, 1 und 26 schon abgehakt. */
const s1 = auftragFuer(1, 26, { gemeldet: ['v1', 'v26'] })
pruefe('Staffel 1 verlangt genau Folge 26', JSON.stringify(s1) === '[26]', s1)

/* Und die übrigen drei Nebenausgaben derselben Adresse. */
pruefe('Staffel 2 verlangt Folge 26', JSON.stringify(auftragFuer(2, 26)) === '[26]', auftragFuer(2, 26))
pruefe('Staffel 3 verlangt Folge 11', JSON.stringify(auftragFuer(3, 11)) === '[11]', auftragFuer(3, 11))
pruefe('Staffel 4 verlangt 14 und 15', JSON.stringify(auftragFuer(4, 27)) === '[14,15]', auftragFuer(4, 27))

/*
  **Die Gegenprobe zur Regel selbst.** Ohne `laut: 'anbieter-gerechnet'` gilt
  weiterhin der alte Weg — die Anbieterzählung ersetzt die Liste. Das ist für
  Titel richtig, deren Einträge *nicht* umgerechnet wurden, und die Zusicherung
  hält fest, dass die Unterscheidung wirklich am Feld hängt.
*/
const ohneFeld = auftragFuer(1, 26, { gemeldet: ['v1', 'v26'], eintrag: { ...HAIKYU, laut: 'anbieter' } })
pruefe('ohne das Feld greift der alte Weg — und findet nichts', ohneFeld === null, ohneFeld)

/*
  **Ein Eintrag, der die ganze Staffel abdeckt, ist kein Auftrag.** Dann sagt
  die Aufzählung nichts, was die Gesamtzahl nicht auch sagt.
*/
const ganz = auftragFuer(
  1,
  12,
  {
    eintrag: {
      titel: 'Ganze Staffel',
      laut: 'anbieter-gerechnet',
      staffeln: [{ nr: 1, name: 'Alles', folgen: 12, erste: 1, film: false, offen: true }],
    },
    anbieter: [{ seq: 1, name: 'S1', folgen: 12, erste: 1 }],
  },
)
pruefe('eine vollständig offene Staffel ergibt keinen Ausschnitt', ganz === null, ganz)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Netflix-Auftrag halten.')
