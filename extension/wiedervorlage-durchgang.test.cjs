/**
 * **Eine Wiedervorlage ist offen, auch wenn jede Folge schon einmal gemeldet wurde.**
 *
 * Daniel am 23.09.2026, nach dem ersten Durchgang über die fünfzehn neu aufgelegten Titel:
 * „ich hab nur gesehen wie es von titel zu titel gesprungen ist, der player wurde nie
 * geöffnet … ich glaub die extension hat nix gemeldet." Der Briefkasten bestätigte es: keine
 * einzige Netflix-Meldung.
 *
 * Der Bericht zeigt die Lage: Shaman King (2021), 52 Folgen, eine Staffel, Auftrag
 * `zustand: "erneut"` mit `seit: 2026-09-23T18:45:58Z`, und alle Folgen längst gemeldet. Die
 * Frage, an der der Durchgang hängt, lautet: Gilt eine Folge dann als offen?
 *
 * Geprüft wird mit denselben Funktionen aus `melder.js`, die die Erweiterung benutzt.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

console.log('Wiedervorlage im Durchgang')

const schneide = (name) => new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(quelle)?.[0] ?? null
const namen = [
  'staffelnGruppiert',
  'staffelnVon',
  'meldungenMerken',
  'anbieterAufteilung',
  'zaehltDurch',
  'meldungAm',
  'listenZustand',
  'folgeZustand',
  'folgenJeStaffel',
  'staffelPerKennung',
  'staffelnDerGruppe',
  'zustandDerFolge',
  'geladeneZustaende',
  'staffelnBereinigen',
  'titelIdFuer',
]
const teile = namen.map((n) => [n, schneide(n)])
const fehlend = teile.filter(([, c]) => !c).map(([n]) => n)
pruefe('alle benötigten Funktionen sind auffindbar', !fehlend.length, fehlend)
const strenge = /const STRENGE = \{[^}]*\}/.exec(quelle)?.[0]
if (fehlend.length || !strenge) {
  console.error('\nOhne die Funktionen prüft der Rest nichts.')
  process.exit(1)
}
const CODE = ['const MELDUNGEN = new Map()', strenge, ...teile.map(([, code]) => code)].join('\n\n')

/** Shaman King, wie der Bericht ihn zeigt. */
const SHAMAN = {
  titel: 'Shaman King (2021)',
  asId: 15320,
  staffeln: [
    { nr: 1, name: '', folgen: 52, erste: 1, film: false, id: 119675, offen: true, zustand: 'erneut', seit: '2026-09-23T18:45:58.809Z' },
  ],
}

function zustaende({ meldungen = [], eintrag = SHAMAN, anzahl = 52 } = {}) {
  const roh = Array.from({ length: anzahl }, (_, i) => ({ nummer: i + 1, staffel: 1, seasonId: 's1', videoId: 1000 + i + 1 }))
  const kontext = {
    anbieterStaffeln: {},
    offeneTitel: { '81239555': eintrag },
    stand: { staffel: null },
    DURCHLAUF: { folgen: [], gemeldet: new Set() },
    gemeinteReihe: () => '81239555',
    imPlayer: () => false,
    roh,
    meldungen,
    Number,
    Set,
    Map,
    Math,
    Boolean,
    String,
    Array,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(
    CODE + "\nDURCHLAUF.folgen = staffelnBereinigen(roh)\nmeldungenMerken('81239555', meldungen)\nergebnis = geladeneZustaende()",
    kontext,
  )
  return kontext.ergebnis
}

const meldung = (nummer, am) => ({ nummer, staffel: 1, staffelBekannt: true, folge: String(1000 + nummer), am })

/* 1. Ohne Meldungen ist alles offen — die Grundlage. */
const ohne = zustaende()
pruefe('ohne Meldungen sind alle 52 Folgen offen', ohne?.length === 52 && ohne.every((z) => z.zustand === 'erneut'), ohne?.[0])

/* 2. Der Fall von heute: jede Folge gemeldet, aber vor der Wiedervorlage. */
const alt = zustaende({ meldungen: Array.from({ length: 52 }, (_, i) => meldung(i + 1, '2026-09-20T12:00:00.000Z')) })
pruefe(
  'Meldungen von vor der Wiedervorlage machen sie nicht zu „gemeldet"',
  alt?.every((z) => z.zustand === 'erneut'),
  alt?.filter((z) => z.zustand !== 'erneut').slice(0, 3),
)

/* 3. Und nach der Wiedervorlage gilt sie als erledigt — sonst liefe der Durchgang endlos. */
const neu = zustaende({ meldungen: Array.from({ length: 52 }, (_, i) => meldung(i + 1, '2026-09-23T20:00:00.000Z')) })
pruefe('Meldungen nach der Wiedervorlage zählen', neu?.every((z) => z.zustand === 'gemeldet'), neu?.filter((z) => z.zustand !== 'gemeldet').slice(0, 3))

/* 4. Ein Datum ohne Uhrzeit darf die Wiedervorlage nicht aushebeln. */
const nurTag = zustaende({ meldungen: Array.from({ length: 52 }, (_, i) => meldung(i + 1, '2026-09-23')) })
pruefe(
  'ein Beleg mit „2026-09-23" gilt nicht als jünger als 18:45 desselben Tages',
  nurTag?.every((z) => z.zustand === 'erneut'),
  nurTag?.filter((z) => z.zustand !== 'erneut').slice(0, 3),
)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Wiedervorlage halten.')
