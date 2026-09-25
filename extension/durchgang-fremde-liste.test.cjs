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

/* 3. Randprobe: in Stapeln zu zehn melden (25.09.2026), danach der Reihe nach abhaken. */
const rand = schneide('randMelden')
pruefe('randMelden schickt Stapel zu MELDE_STAPEL', /i \+= MELDE_STAPEL/.test(rand) && /stapel: teil\.map\(\(m\) => m\.daten\)/.test(rand))
pruefe('ein Stapel hakt nur ab, was der Worker einzeln bestätigt', /if \(!ergebnisse\[i\]\?\.ok\) return/.test(rand))
const senden = rand.slice(rand.indexOf('const stapel = []'), rand.indexOf('for (const [staffel, nummer] of abhaken)'))
pruefe('kein Abhaken im Speicher während des Sendens', senden.length > 0 && !/merkeErledigt/.test(senden))
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
  /*
    Meine ganz besondere Hochzeit (24.09.2026): Staffel und titelId nur, was sicher ist —
    Netflix' Nummer über die Folgenkennungen, titelId nur bei genau einem Titel an der Adresse.
  */
  pruefe(
    'beide Melder nehmen Staffel und Titel aus meldeZiel',
    /staffel: meldeZiel\(/.test(schneide('durchlaufMelden')) &&
      /titelId: meldeZiel\(/.test(schneide('durchlaufMelden')) &&
      /const ziel = meldeZiel\(reihe, f\)/.test(schneide('randMelden')) &&
      /staffel: ziel\.staffel,[\s\S]*titelId: ziel\.titelId/.test(schneide('randMelden')),
  )
  const zielCode = ['netflixSeqFuerGruppe', 'meldeZiel'].map(schneide).join('\n\n')
  function ziel({ eigene, staffelnPlayer = null, gespeichert = undefined, folge }) {
    const kontext = {
      offeneTitel: { 1: { staffeln: eigene } },
      anbieterStaffeln: gespeichert ? { 1: gespeichert } : {},
      stand: { staffeln: staffelnPlayer },
      DURCHLAUF: { alleFolgen: [11, 12, 13].map((v) => ({ videoId: v, seasonId: 'S1' })).concat([21, 22].map((v) => ({ videoId: v, seasonId: 'S2' }))) },
      folge,
      ergebnis: null,
    }
    vm.createContext(kontext)
    vm.runInContext(`${zielCode}\nergebnis = meldeZiel(1, folge)`, kontext)
    return kontext.ergebnis
  }
  const HOCHZEIT = [{ nr: 1, id: 147103, folgen: 12 }, { nr: 2, id: 169441, folgen: 13 }]
  const NETFLIX = [{ seq: 1, ids: [11, 12, 13] }, { seq: 2, ids: [21, 22] }]
  const h1 = ziel({ eigene: HOCHZEIT, staffelnPlayer: NETFLIX, folge: { videoId: 12, seasonId: 'S1' } })
  pruefe('Hochzeit: Netflix-Staffel 1 bleibt 1, keine titelId', h1.staffel === 1 && h1.titelId === null, h1)
  const h2 = ziel({ eigene: HOCHZEIT, staffelnPlayer: [{ seq: 1 }, { seq: 2 }], gespeichert: NETFLIX, folge: { videoId: 21, seasonId: 'S2' } })
  pruefe('Kennungen aus der gespeicherten Liste, wenn der Player keine nennt', h2.staffel === 2, h2)
  const ohne = ziel({ eigene: HOCHZEIT, staffelnPlayer: [{ seq: 1 }, { seq: 2 }], folge: { videoId: 12, seasonId: 'S1' } })
  pruefe('ohne Kennungen: keine Staffelzahl', ohne.staffel === null, ohne)
  const eine = ziel({ eigene: [{ nr: 1, id: 20, folgen: 220 }], folge: { videoId: 12, seasonId: 'S1' } })
  pruefe('eine eigene Staffel ohne Netflix-Liste: unsere 1 und ihre titelId', eine.staffel === 1 && eine.titelId === 20, eine)
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
  pruefe('das Menü liefert ihn nicht als Staffel', /raus\.filter\(\(e\) => !istAlleFolgenEintrag\(e\.text\)\)/.test(schneide('netflixStaffelnImMenue')))
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
      gruppeOffen: (_reihe, gruppe) => kontext.offen.has(gruppe[0]?.seasonId),
      gemeinteReihe: () => '1',
      netflixStaffelnImMenue: async () => [],
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
  /*
    Offen oder nicht — über die Folgenkennungen (24.09.2026). Meine ganz besondere Hochzeit:
    Netflix-Staffel 1 hat 13 Folgen, unsere 12; die Folgenzahl hielt sie für unsere belegte
    Staffel 2. Jetzt zählt nur, ob ihre Folgen seit der Wiedervorlage gemeldet sind.
  */
  {
    const code = schneide('gruppeOffen')
    const SEIT = '2026-09-24T16:11:12.558Z'
    function offen({ meldungen = {}, staffeln = [{ nr: 1, offen: true, zustand: 'erneut', seit: SEIT }] }) {
      const kontext = {
        offeneTitel: { 1: { staffeln } },
        MELDUNGEN: new Map([['1', { jeFolge: new Map(Object.entries(meldungen).map(([id, am]) => [id, { am }])) }]]),
        DURCHLAUF: { gemeldet: new Set() },
        gruppe: [{ videoId: 11 }, { videoId: 12 }, { videoId: 13 }],
        ergebnis: null,
      }
      vm.createContext(kontext)
      vm.runInContext(`${code}\nergebnis = gruppeOffen(1, gruppe)`, kontext)
      return kontext.ergebnis
    }
    pruefe('Hochzeit: Folgen nur im August gemeldet, Wiedervorlage heute → offen', offen({ meldungen: { 11: '2026-08-22', 12: '2026-08-22', 13: '2026-08-22' } }) === true)
    pruefe('alle Folgen nach der Wiedervorlage gemeldet → fertig', offen({ meldungen: { 11: '2026-09-24T17:00:00Z', 12: '2026-09-24T17:00:00Z', 13: '2026-09-24T17:00:00Z' } }) === false)
    pruefe('eine Folge ohne Meldung → offen', offen({ meldungen: { 11: '2026-09-24T17:00:00Z', 12: '2026-09-24T17:00:00Z' } }) === true)
    pruefe('ohne offene Staffel beim Titel → nie offen', offen({ staffeln: [{ nr: 1, offen: false }] }) === false)
    pruefe('ohne Wiedervorlage: gemeldet ist gemeldet, egal wann', offen({ staffeln: [{ nr: 1, offen: true, zustand: 'melden' }], meldungen: { 11: '2026-08-22', 12: '2026-08-22', 13: '2026-08-22' } }) === false)
    /* Steel Ball Run (25.09.2026): ONA mit einer Folge → in der Liste `film: true`, sonst nichts. */
    const film = { nr: 1, offen: true, film: true, zustand: 'erneut', seit: '2026-09-25' }
    pruefe('nur ein offener Film-Eintrag → trotzdem offen', offen({ staffeln: [film] }) === true)
    pruefe('Film neben einer Serienstaffel zählt nicht mit', offen({ staffeln: [film, { nr: 2, offen: false }] }) === false)
    pruefe('der Durchgang fragt gruppeOffen, nicht die Zuordnung', /if \(!gruppeOffen\(reihe, gruppe\)\)/.test(start) && /DURCHLAUF\.erzwungen = true/.test(start))
    pruefe('ein erzwungener Lauf prüft die ganze Gruppe', /const alleOffen = erzwungen \? \[\.\.\.DURCHLAUF\.folgen\] : durchlaufOffen\(\)/.test(schneide('durchlaufStarten')))
    pruefe('der Zähler läuft je Titel über alle Staffeln', /DURCHLAUF\.mehrfach = \{ reihe: String\(reihe\), gesamt: offeneGruppen\(\)\.length \* 2/.test(start))
    const label = new Function('letztesMenue', schneide('gruppenLabel') + '\nreturn gruppenLabel')
    const menue = [{ text: 'Staffel 1  (13 Folgen)', folgen: 13 }, { text: 'Staffel 2  (12 Folgen)', folgen: 12 }]
    pruefe('Staffelname aus dem Menü über die Folgenzahl', label(menue)(Array(12).fill({})) === 'Staffel 2')
    pruefe('zwei gleich lange Staffeln → kein Name', label([...menue, { text: 'Staffel 3 (12 Folgen)', folgen: 12 }])(Array(12).fill({})) === null)
  }
  /* Ein Fehler im Durchgang endet sichtbar. */
  const huelle = schneide('vielleichtSelbstStarten')
  pruefe('ein Fehler im Durchgang landet in Spur und Kasten', /spur\('Fehler'/.test(huelle) && /laufBeenden\(`Fehler: /.test(huelle))
  schluss()
})()
