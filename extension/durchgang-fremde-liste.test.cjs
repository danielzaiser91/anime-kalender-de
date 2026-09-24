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
const teile = ['anbieterAufteilung', 'rechnetInNetflixStaffeln', 'folgenJeStaffel', 'staffelPerKennung', 'staffelnDerGruppe'].map(schneide)
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
const start = schneide('selbstStartenSchritt')
const riegel = start.indexOf("String(DURCHLAUF.listeFuer ?? '') !== seiteHier")
pruefe('vielleichtSelbstStarten prüft, wem die Liste gehört', riegel > 0)
pruefe('… bevor es über Staffeln entscheidet', riegel > 0 && riegel < start.indexOf('staffelnDerGruppe('))
pruefe('… und gibt nach einer Frist auf, statt still zu hängen', /spur\('keine Folgenliste'/.test(start))

/*
  Seit 24.09.2026 (Daniel: „man kann die extension einfach alle staffeln durchgehen und melden
  lassen"): kein Überspringen wegen unklarer Staffel mehr, stattdessen jede Menü-Staffel einmal.
*/
pruefe('kein Überspringen wegen unklarer Staffel', !/Staffel nicht eindeutig/.test(start))
/* Seit 4.22.0 (Daniel: „alle folgen … dann alle 1. und letzte jeder staffel direkt hintereinander prüfen"). */
pruefe('erst sammeln, dann je Staffel prüfen', /await selbstSammeln\(reihe\)/.test(start) && /for \(const \[seasonId, gruppe\] of folgenJeStaffel\(DURCHLAUF\.alleFolgen/.test(start))
pruefe('ein Lauf ohne neue Meldung macht die Staffel fertig', /=== vorher\) selbstStaffelnGeprueft\.add\(schluessel\)/.test(start))
const wahlCode = schneide('netflixStaffelWaehlen')
pruefe('die Staffelwahl nimmt auch einen Menütext', /typeof ziel === 'string'/.test(wahlCode))

/*
  JoJo (24.09.2026): Die Wahl selbst ausführen, mit den Menüeinträgen aus Daniels Bild. In 4.21.8
  verdeckte eine Konstante `ziel` den Parameter — jeder Wechsel warf, und niemand sah es.
*/
async function waehleIm(menue, ziel) {
  const geklickt = []
  const lis = menue.map((text) => ({ textContent: text, click: () => geklickt.push(text) }))
  const knopf = { getAttribute: () => 'false', click: () => geklickt.push('knopf') }
  const kontext = {
    document: {
      querySelector: () => knopf,
      querySelectorAll: () => lis,
    },
    setTimeout,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(`${wahlCode}\nergebnis = netflixStaffelWaehlen(${JSON.stringify(ziel)})`, kontext)
  return { ok: await kontext.ergebnis, geklickt }
}
const JOJO_MENUE = [
  'Phantom Blood/Battle Tendency(26 Folgen)',
  'Stardust Crusaders(48 Folgen)',
  'Diamond Is Unbreakable(39 Folgen)',
  'Golden Wind(39 Folgen)',
  'Stone Ocean(38 Folgen)',
]
const nachTextOk = waehleIm(JOJO_MENUE, 'Diamond Is Unbreakable(39 Folgen)')
const nachNummerOk = waehleIm(['Staffel 1 (12 Folgen)', 'Staffel 2 (27 Folgen)'], 2)
const nichtDa = waehleIm(JOJO_MENUE, 'Gibt es nicht')

/*
  Sammeln (4.22.0): fertig erst, wenn so viele Staffeln da sind wie im Menü, der Leser nichts
  nachlädt und die Liste drei Sekunden ruht — oder nach 40 Sekunden mit dem, was da ist.
*/
const sammelCode = schneide('selbstSammeln')
async function sammle({ menue = 5, gruppen = 5, nachladen = 0, ruhe = 5000, alter = 1000, alleGewaehlt = true }) {
  const kontext = {
    DURCHLAUF: {
      alleFolgen: Array.from({ length: gruppen }, (_, g) => ({ nummer: 1, videoId: g + 1, seasonId: `s${g}` })),
      listeGeaendertAm: Date.now() - ruhe,
    },
    leserLaedtNach: nachladen,
    selbstSammelStand: { reihe: '1', seit: Date.now() - alter, menue: Array.from({ length: menue }, (_, i) => ({ text: `Staffel ${i + 1}`, folgen: 10 })), alleGewaehlt },
    selbstGesammelt: new Set(),
    gescrollt: 0,
    window: { scrollTo: () => kontext.gescrollt++ },
    document: { documentElement: { scrollHeight: 5000 } },
    spur: () => {},
    istAlleFolgenEintrag: () => false,
    angezeigterNetflixName: () => 'Alle Folgen anzeigen',
    netflixStaffelWaehlen: async () => true,
    netflixStaffelnImMenue: async () => [],
    folgenJeStaffel: new Function(schneide('folgenJeStaffel') + '\nreturn folgenJeStaffel')(),
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(`${sammelCode}\nergebnis = selbstSammeln('1')`, kontext)
  return { fertig: await kontext.ergebnis, gescrollt: kontext.gescrollt }
}
const sammelFaelle = [
  ['alle fünf Staffeln da, Leser ruhig → fertig', sammle({}), (e) => e.fertig === true],
  ['drei von fünf Staffeln → weiter scrollen', sammle({ gruppen: 3 }), (e) => e.fertig === false && e.gescrollt === 1],
  ['Leser lädt noch nach → warten', sammle({ nachladen: 1 }), (e) => e.fertig === false],
  ['Liste eben geändert → warten', sammle({ ruhe: 500 }), (e) => e.fertig === false],
  ['nach 40 s mit dem, was da ist', sammle({ gruppen: 3, alter: 41000 }), (e) => e.fertig === true],
  ['eine Staffel ohne Menü: ruhig → fertig', sammle({ menue: 0, gruppen: 1 }), (e) => e.fertig === true],
]

/*
  JoJo (24.09.2026): „Golden Wind" ist Netflix-Staffel 4, bei uns Staffel 5. Die Zahl des Players
  darf in unserer Zählung nicht gelten — sonst ginge die Meldung an „Diamond Is Unbreakable".
*/
const fuerFolge = ['anbieterAufteilung', 'rechnetInNetflixStaffeln', 'folgenJeStaffel', 'staffelPerKennung', 'staffelnDerGruppe', 'staffelFuerFolge'].map(schneide)
function staffelVomPlayer({ netflixZaehlung = false }) {
  const f = { nummer: 1, videoId: 9001, seasonId: 'gw' }
  const kontext = {
    MELDUNGEN: new Map(),
    /* Gespeicherte Anbieter-Staffeln heißen: unsere Zählung ist Netflix'. */
    anbieterStaffeln: netflixZaehlung ? { 1: [{ seq: 3, folgen: 39 }, { seq: 4, folgen: 39 }] } : {},
    offeneTitel: {
      1: {
        titel: 'JoJo',
        staffeln: [
          { nr: 4, folgen: 39, film: false, offen: true },
          { nr: 5, folgen: 39, film: false, offen: true },
        ],
      },
    },
    DURCHLAUF: { alleFolgen: Array.from({ length: 39 }, (_, i) => ({ nummer: i + 1, videoId: 9001 + i, seasonId: 'gw' })) },
    stand: { staffel: 4, folge: 9001 },
    imPlayer: () => true,
    angezeigteNetflixStaffel: () => null,
    f,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(fuerFolge.join('\n\n') + '\nergebnis = staffelFuerFolge(1, f)', kontext)
  return kontext.ergebnis
}
pruefe('JoJo in unserer Zählung: die Player-Staffel 4 gilt nicht → ohne Staffel', staffelVomPlayer({}) === null)
pruefe('in Netflix-Zählung gilt sie weiter', staffelVomPlayer({ netflixZaehlung: true }) === 4)

const pfad = schneide('pfadPruefen')
pruefe('pfadPruefen leert beim Titelwechsel auch die angezeigte Liste', /DURCHLAUF\.folgen = \[\]/.test(pfad))

/* 3. Randprobe: parallel melden, danach der Reihe nach abhaken. */
const rand = schneide('randMelden')
pruefe('randMelden meldet über mehrere Arbeiter', /Promise\.all\(Array\.from\(\{ length: Math\.min\(6/.test(rand))
const arbeiter = rand.slice(rand.indexOf('const arbeiter'), rand.indexOf('await Promise.all'))
pruefe('kein Abhaken im Speicher innerhalb der Arbeiter', !/merkeErledigt/.test(arbeiter))
pruefe('Abhaken folgt nach dem Melden', rand.indexOf('await merkeErledigt') > rand.indexOf('await Promise.all'))

/* Der Schluss wartet auf die asynchronen Fälle der Menüwahl. */
function schluss() {
  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Durchgang halten.')
}

;(async () => {
  const text = await nachTextOk
  pruefe('JoJo: Wahl über den Menütext klickt „Diamond Is Unbreakable"', text.ok === true && text.geklickt.includes('Diamond Is Unbreakable(39 Folgen)'), text)
  const nummer = await nachNummerOk
  pruefe('Baki Hanma: Wahl über die Nummer klickt „Staffel 2"', nummer.ok === true && nummer.geklickt.includes('Staffel 2 (27 Folgen)'), nummer)
  const fehlt = await nichtDa
  pruefe('ohne passenden Eintrag: false und das Menü wieder zu', fehlt.ok === false && fehlt.geklickt.filter((x) => x === 'knopf').length === 2, fehlt)
  /* Staffelname und Netflix-Staffelzahl gehen mit (24.09.2026). */
  const melden = schneide('durchlaufMelden') + schneide('randMelden')
  pruefe('beide Melder hängen den Staffelnamen an die Notiz', (melden.match(/` — Netflix: \$\{DURCHLAUF\.staffelLabel\}`/g) ?? []).length === 2)
  pruefe('die Einzelmeldung schreibt „Folge N: Titel", die Form, die der Anker liest', /`Durchlauf: Folge \$\{folge\.nummer\}\$\{folge\.titel \? `: \$\{folge\.titel\}`/.test(melden))
  pruefe('unklare Staffel: Netflix-Zahl nur mit Netflix-Liste', (melden.match(/staffel: staffelDerFolge \?\? netflixStaffelFuerZuordner\(\)/g) ?? []).length === 2)
  const zuordnerZahl = new Function('stand', schneide('netflixStaffelFuerZuordner') + '\nreturn netflixStaffelFuerZuordner()')
  pruefe('mit Liste: Netflix-Staffel 4', zuordnerZahl({ staffel: 4, staffeln: [{ seq: 4 }] }) === 4)
  pruefe('ohne Liste: keine Zahl', zuordnerZahl({ staffel: 4, staffeln: null }) === null)
  /*
    Stardust (24.09.2026): Netflix-Staffel 2 darf nicht unsere Staffel 2 treffen, sobald Netflix'
    Liste gespeichert ist und die Prüfliste in unserer Zählung rechnet.
  */
  const titelIdCode = schneide('titelIdFuer')
  function titelId({ gespeichert, laut }) {
    const kontext = {
      anbieterStaffeln: gespeichert ? { 1: [{ seq: 1, folgen: 26 }, { seq: 2, folgen: 48 }] } : {},
      offeneTitel: {
        1: {
          laut,
          staffeln: [
            { nr: 1, id: 14719, folgen: 26 },
            { nr: 2, id: 20474, folgen: 24 },
            { nr: 3, id: 20799, folgen: 24 },
          ],
        },
      },
      ergebnis: null,
    }
    vm.createContext(kontext)
    vm.runInContext(`${titelIdCode}\nergebnis = titelIdFuer(1, 2)`, kontext)
    return kontext.ergebnis
  }
  pruefe('JoJo: Netflix-Staffel 2 bei gespeicherter Netflix-Liste → keine titelId', titelId({ gespeichert: true }) === null)
  pruefe('ohne gespeicherte Netflix-Liste gilt unsere Zählung → 20474', titelId({ gespeichert: false }) === 20474)
  pruefe('Prüfliste in Netflix-Zählung → Staffel 2 bleibt zuordenbar', titelId({ gespeichert: true, laut: 'anbieter-gerechnet' }) === 20474)
  /* „Alle Folgen anzeigen" ist keine Staffel (24.09.2026). */
  const alle = new Function(schneide('istAlleFolgenEintrag') + '\nreturn istAlleFolgenEintrag')()
  pruefe('„Alle Folgen anzeigen" wird erkannt', alle('Alle Folgen anzeigen') && alle(' All episodes'))
  pruefe('echte Staffeln nicht', !alle('Golden Wind(39 Folgen)') && !alle('Staffel 2 (27 Folgen)'))
  pruefe('das Menü liefert ihn nicht als Staffel', /return raus\.filter\(\(e\) => !istAlleFolgenEintrag\(e\.text\)\)/.test(schneide('netflixStaffelnImMenue')))
  pruefe('das Sammeln wählt ihn gezielt', /await netflixStaffelWaehlen\(istAlleFolgenEintrag\)/.test(schneide('selbstSammeln')))
  for (const [name, laeuft, ok] of sammelFaelle) {
    const e = await laeuft
    pruefe(`Sammeln: ${name}`, ok(e), e)
  }
  /* Leser: je Staffel nachladen, nicht über alle gezählt. */
  const leser = readFileSync(resolve(__dirname, 'leser.js'), 'utf8')
  pruefe('der Leser zählt je Staffel nach', /const jetzt = folgenDerStaffel\(seasonId\)/.test(leser) && !/folgenNachladen\(Number\(seasonId\), folgenliste\.size\)/.test(leser))
  pruefe('der Leser übergeht keine zweite Staffel', !/if \(laedtNach \|\|/.test(leser) && /nachladeKette = nachladeKette/.test(leser))
  /*
    „Alle Folgen anzeigen" von Hand (24.09.2026): der Knopf prüft alle offenen Staffeln
    nacheinander und zählt 2 je offene Staffel.
  */
  {
    const code = ['folgenJeStaffel', 'offeneGruppen', 'alleStaffelnPruefen'].map(schneide).join('\n\n')
    const kontext = {
      DURCHLAUF: {
        laeuft: false,
        folgen: [],
        alleFolgen: ['a', 'b', 'c'].flatMap((s) => [1, 2, 3].map((n) => ({ nummer: n, videoId: `${s}${n}`, seasonId: s }))),
      },
      offen: new Set(['a', 'c']),
      gelaufen: [],
      stand: [],
      RAND: -1,
      angezeigteStaffelHatOffenes: () => kontext.offen.has(kontext.DURCHLAUF.folgen[0]?.seasonId),
      durchlaufStarten: async () => {
        kontext.stand.push(kontext.DURCHLAUF.mehrfach?.gesamt)
        kontext.gelaufen.push(kontext.DURCHLAUF.folgen[0].seasonId)
        kontext.DURCHLAUF.fertig = 2
        kontext.DURCHLAUF.gesamt = 2
      },
      durchlaufKnopfZeigen: () => {},
      ergebnis: null,
    }
    vm.createContext(kontext)
    vm.runInContext(`${code}\nergebnis = alleStaffelnPruefen()`, kontext)
    await kontext.ergebnis
    pruefe('„Alle Staffeln": nur die offenen Staffeln laufen, nacheinander', kontext.gelaufen.join() === 'a,c', kontext.gelaufen)
    pruefe('… gezählt 2 je offene Staffel', kontext.stand[0] === 4, kontext.stand)
    pruefe('… und danach ist der Mehrfachlauf wieder aus', kontext.DURCHLAUF.mehrfach === null)
    const knopf = schneide('durchlaufKnopfZeigen')
    pruefe('der Knopf beschriftet „Alle Staffeln" mit 2 × offene Staffeln', /Alle Staffeln · ▶ \$\{offen \* 2\} Folgen prüfen/.test(knopf))
    pruefe('der Klick startet in dieser Ansicht alle Staffeln', /if \(alleStaffelnAnsicht\(\)\) \{\s*void alleStaffelnPruefen\(\)/.test(quelle))
  }
  /* Ein Fehler im Durchgang endet sichtbar. */
  const huelle = schneide('vielleichtSelbstStarten')
  pruefe('ein Fehler im Durchgang landet in Spur und Kasten', /spur\('Fehler'/.test(huelle) && /laufBeenden\(`Fehler: /.test(huelle))
  schluss()
})()
