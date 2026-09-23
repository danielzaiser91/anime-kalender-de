/**
 * **Der Durchgang entscheidet mit der Liste der eigenen Seite — und eine einzige Staffel ist eindeutig.**
 *
 * Daniel am 23.09.2026, mit Bericht: Nach Shaman King sprang die Automatik durch Naruto,
 * Shippuden, Boruto und Beelzebub, vier Titel in drei Sekunden, ohne eine Folge zu öffnen. Die
 * Spur zeigte bei jedem „Staffel nicht eindeutig" ohne Kandidaten. Zwei Ursachen:
 *
 * 1. `DURCHLAUF.folgen` hielt noch die 52 Folgen von Shaman King.
 * 2. Alle vier führen wir mit genau einer Staffel, Netflix teilt sie anders (oder hat weniger
 *    Folgen) — der Abgleich über die Folgenzahl fand nichts.
 *
 * Und die Randprobe schickte 52 Meldungen nacheinander; Daniel sah acht Sekunden lang „2/2".
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

console.log('Durchgang: fremde Liste, eine Staffel, Randprobe')

const schneide = (name) => {
  const i = quelle.search(new RegExp(`\\n(?:async )?function ${name}\\(`))
  if (i < 0) return ''
  const j = quelle.indexOf('\n}\n', i + 1)
  return quelle.slice(i + 1, j + 3)
}

/* 1. Staffelzuordnung bei einer einzigen eigenen Staffel. */
const teile = ['anbieterAufteilung', 'folgenJeStaffel', 'staffelPerKennung', 'staffelnDerGruppe'].map(schneide)
pruefe('Funktionen der Staffelzuordnung auffindbar', teile.every(Boolean))

function kandidaten({ staffeln, nummern, angezeigt = null }) {
  const kontext = {
    MELDUNGEN: new Map(),
    anbieterStaffeln: {},
    offeneTitel: { 1: { titel: 'Test', staffeln } },
    DURCHLAUF: { alleFolgen: [] },
    stand: { staffel: null },
    imPlayer: () => false,
    angezeigteNetflixStaffel: () => angezeigt,
    gruppe: nummern.map((n) => ({ nummer: n, videoId: 5000 + n, seasonId: 's' })),
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(teile.join('\n\n') + '\nergebnis = staffelnDerGruppe(1, gruppe)', kontext)
  return kontext.ergebnis
}
const bereich = (von, bis) => Array.from({ length: bis - von + 1 }, (_, i) => von + i)
const eine = (folgen) => [{ nr: 1, folgen, film: false, offen: true }]

pruefe('Beelzebub: 48 bei Netflix, 60 bei uns → Staffel 1', String(kandidaten({ staffeln: eine(60), nummern: bereich(1, 48) })) === '1')
pruefe(
  'Naruto: Netflix-Staffel 2 zählt weiter (58–106) → Staffel 1',
  String(kandidaten({ staffeln: eine(220), nummern: bereich(58, 106), angezeigt: 2 })) === '1',
)
pruefe(
  'Netflix-Staffel 2 fängt wieder bei 1 an → keine Zuordnung',
  kandidaten({ staffeln: eine(220), nummern: bereich(1, 50), angezeigt: 2 })?.length === 0,
)
pruefe(
  'Netflix-Staffel 1 bei mehrteiliger Anzeige → Staffel 1',
  String(kandidaten({ staffeln: eine(220), nummern: bereich(1, 57), angezeigt: 1 })) === '1',
)
pruefe('mehr Folgen als unsere Staffel → keine Zuordnung', kandidaten({ staffeln: eine(40), nummern: bereich(1, 48) })?.length === 0)
pruefe(
  'zwei eigene Staffeln bleiben beim Abgleich über die Zahl',
  kandidaten({ staffeln: [...eine(12), { nr: 2, folgen: 12, erste: 13, film: false, offen: true }], nummern: bereich(1, 10) })
    ?.length === 0,
)

/* 2. Die Automatik wartet auf die Liste dieser Seite. */
const start = schneide('vielleichtSelbstStarten')
const riegel = start.indexOf("String(DURCHLAUF.listeFuer ?? '') !== seiteHier")
pruefe('vielleichtSelbstStarten prüft, wem die Liste gehört', riegel > 0)
pruefe('… bevor es über Staffeln entscheidet', riegel > 0 && riegel < start.indexOf('staffelnDerGruppe('))
pruefe('… und gibt nach einer Frist auf, statt still zu hängen', /spur\('keine Folgenliste'/.test(start))

const pfad = schneide('pfadPruefen')
pruefe('pfadPruefen leert beim Titelwechsel auch die angezeigte Liste', /DURCHLAUF\.folgen = \[\]/.test(pfad))

/* 3. Randprobe: parallel melden, danach der Reihe nach abhaken. */
const rand = schneide('randMelden')
pruefe('randMelden meldet über mehrere Arbeiter', /Promise\.all\(Array\.from\(\{ length: Math\.min\(6/.test(rand))
const arbeiter = rand.slice(rand.indexOf('const arbeiter'), rand.indexOf('await Promise.all'))
pruefe('kein Abhaken im Speicher innerhalb der Arbeiter', !/merkeErledigt/.test(arbeiter))
pruefe('Abhaken folgt nach dem Melden', rand.indexOf('await merkeErledigt') > rand.indexOf('await Promise.all'))

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Durchgang halten.')
