/**
 * Der Prime-Durchgang (25.09.2026) im Sandkasten: derselbe Code wie in `amazon.js`, die Seite
 * nachgebaut — Meldeknopf, Staffelliste aus dem Quelltext, Prüfliste, Tab-Speicher.
 *
 * Gespielt wird Naruto, wie Daniel es vorgelegt hat: Die Prüfliste führt Staffel 9
 * (B07VP6VPVR), die Seite nennt neun Staffeln mit eigener ASIN (gemessen am 25.09.2026).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync(__dirname + '/amazon.js', 'utf8')
const von = quelle.indexOf('  // --- Durchgang über die Prüfliste')
const bis = quelle.indexOf('  function primeTakt()')
const block = quelle.slice(von, bis)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Prime-Durchgang im Sandkasten\n')
pruefe('Block in amazon.js gefunden', von > 0 && bis > von)

const NARUTO = ['B0CWDYLZ1S', 'B0F3SHHVC2', 'B0DX7JQY9R', 'B0FBJWV6MJ', 'B0DX1XQ1W1', 'B0F5J96BX2', 'B0F9Z35RH6', 'B0FBKHYWCF', 'B07VP6VPVR']

/** Eine Sandkasten-Welt; `seite(asin)` simuliert das Neuladen einer Seite im selben Tab. */
function welt() {
  const speicher = new Map()
  const w = {
    uhr: 1_000_000,
    geklickt: 0,
    neugeladen: 0,
    kontext: null,
  }
  const kontext = {
    Date: class extends Date { static now() { return w.uhr } },
    JSON,
    String,
    Boolean,
    sessionStorage: {
      getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
      setItem: (k, v) => speicher.set(k, String(v)),
      removeItem: (k) => speicher.delete(k),
    },
    liste: {
      B07VP6VPVR: { titel: 'Naruto', url: 'https://www.amazon.de/gp/video/detail/B07VP6VPVR' },
      B07FB4D9KM: { titel: 'Yu-Gi-Oh!', url: 'https://www.amazon.de/gp/video/detail/B07FB4D9KM' },
      SUCHE: { titel: 'Anonymous Noise', url: 'https://www.amazon.de/s?k=Anonymous+Noise&i=instant-video' },
    },
    fertig: () => false,
    listenId: 'B07VP6VPVR',
    gesehen: { seite: { staffeln: NARUTO.map((kennung, i) => ({ kennung, nummer: i + 1 })) } },
    knopf: { textContent: '', style: { display: '' }, disabled: false, isConnected: true, click: () => w.geklickt++ },
    sendetGerade: false,
    imPlayer: () => false,
    verbindungLebt: () => true,
    aktuell: 'B07VP6VPVR',
    asin: () => kontext.aktuell,
    location: {
      pathname: '/gp/video/detail/B07VP6VPVR',
      href: 'https://www.amazon.de/gp/video/detail/B07VP6VPVR',
      reload: () => w.neugeladen++,
    },
    notiere: () => {},
    suchOffen: () => ['s'],
    dialog: null,
    dialogUmschalten: () => {},
    uebersichtZeichnen: () => {},
    dialogFuellen: () => {},
    letzteSignatur: null,
    seitenTitel: () => 'Naruto',
  }
  vm.createContext(kontext)
  vm.runInContext(block, kontext)
  w.kontext = kontext
  /** Seitenwechsel: neuer Skriptlauf, gleicher Tab-Speicher. */
  w.seite = (asin) => {
    kontext.aktuell = asin
    kontext.location.pathname = `/gp/video/detail/${asin}`
    vm.runInContext('primeSeite = null; primeVerlassen = false', kontext)
  }
  /** Knopf zeigt `text` für `ms`, der Takt läuft jede Sekunde. */
  w.zeige = (text, ms, sichtbar = true) => {
    kontext.knopf.textContent = text
    kontext.knopf.style.display = sichtbar ? '' : 'none'
    for (let t = 0; t <= ms; t += 1000) {
      vm.runInContext('primeSchritt()', kontext)
      w.uhr += 1000
    }
  }
  w.lauf = () => vm.runInContext('primeLaufLesen()', kontext)
  w.ende = () => vm.runInContext('primeLaufEndeLesen()', kontext)
  return w
}

{
  const w = welt()
  const k = w.kontext
  pruefe('Start auf Naruto S9: der Lauf gehört diesem Titel', vm.runInContext('primeLaufStarten()', k) === true && w.lauf().titel === 'B07VP6VPVR')

  w.zeige('Folgen werden geladen …', 1000)
  w.zeige('Staffel wechselt — einen Moment', 1000)
  pruefe('wechselnde Ladezustände: kein Klick', w.geklickt === 0)

  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 1000)
  pruefe('„melden" erst seit einer Sekunde: noch kein Klick', w.geklickt === 0)
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 3000)
  pruefe('„melden" steht still: genau ein Klick', w.geklickt === 1)

  k.sendetGerade = true
  w.zeige('sende 12 Folgen …', 2000)
  k.sendetGerade = false
  w.zeige('gemeldet ✓', 3000)
  pruefe('nach der Bestätigung: weiter zu Staffel 1', k.location.href === 'https://www.amazon.de/gp/video/detail/B0CWDYLZ1S', k.location.href)
  pruefe('der Plan enthält die übrigen sieben Staffeln', w.lauf().plan.length === 7, w.lauf().plan)

  w.seite('B0CWDYLZ1S')
  w.zeige('✓ Staffel 1 gemeldet · weiter mit Staffel 2', 8000)
  pruefe('schon gemeldete Staffel: kein Klick, weiter zu Staffel 2', w.geklickt === 1 && k.location.href.endsWith('B0F3SHHVC2'), k.location.href)

  w.seite('B0F3SHHVC2')
  w.zeige('↻ Seite neu laden', 3000)
  pruefe('„↻" lädt die Seite einmal neu', w.neugeladen === 1)
  w.seite('B0F3SHHVC2')
  w.zeige('↻ Seite neu laden', 3000)
  pruefe('… und nicht ein zweites Mal', w.neugeladen === 1)

  w.seite('B0F3SHHVC2')
  w.zeige('Staffel wechselt — einen Moment', 61_000)
  pruefe('hängt der Knopf eine Minute: Staffel übersprungen, weiter mit Staffel 3', k.location.href.endsWith('B0DX7JQY9R') && w.lauf().uebersprungen.length === 1, w.lauf().uebersprungen)

  /* Staffeln 3–8: jeweils ohne Knopf (nichts anzubieten). */
  for (const asin of NARUTO.slice(2, 8)) {
    w.seite(asin)
    w.zeige('', 7000, false)
  }
  pruefe('nach der letzten Staffel: nächster Titel mit eigener Titelseite', k.location.href === 'https://www.amazon.de/gp/video/detail/B07FB4D9KM', k.location.href)
  pruefe('Naruto gilt im Lauf als fertig', w.lauf().fertig.includes('B07VP6VPVR'))

  k.gesehen = { seite: { staffeln: [] } }
  w.seite('B07FB4D9KM')
  w.zeige('🇩🇪 Deutsch · 26 Folgen · Staffel 1 · melden', 3000)
  w.zeige('gemeldet ✓', 3000)
  pruefe('Titel ohne Staffelliste: eine Seite, dann Ende', w.lauf() === null)
  const ende = w.ende()
  pruefe('Suchaufträge werden nicht angesteuert — der Lauf endet mit „nichts mehr offen"', ende?.grund === 'nichts mehr offen', ende)
  pruefe('das Ende nennt die übersprungene Staffel und die Suchaufträge', ende?.uebersprungen?.length === 1 && ende?.suchen === 1, ende)
}

{
  /* Daniels Bericht vom 25.09.2026: Nach dem Melden ist der Knopf versteckt und trägt weiter „trage ein …". */
  const w = welt()
  const k = w.kontext
  vm.runInContext('primeLaufStarten()', k)
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 3000)
  w.zeige('trage ein …', 4000, false)
  pruefe('versteckter Knopf mit „trage ein …": gemeldet, weiter zu Staffel 1', k.location.href.endsWith('B0CWDYLZ1S'), k.location.href)
}

{
  const w = welt()
  const k = w.kontext
  vm.runInContext('primeLaufStarten()', k)
  w.zeige('🇩🇪 Deutsch · 12 Folgen · Staffel 9 · melden', 3000)
  w.zeige('Fehler: 500 — nochmal', 1000)
  pruefe('Fehler beim Melden: Seite fertig, der Lauf geht weiter', k.location.href.endsWith('B0CWDYLZ1S'), k.location.href)
}

{
  const w = welt()
  const k = w.kontext
  vm.runInContext('primeLaufStarten()', k)
  w.zeige('Kein Token — Rechtsklick aufs Symbol, dann Optionen', 1000)
  pruefe('ohne Token endet der Lauf sofort', w.lauf() === null && w.ende()?.grund === 'kein Token in den Optionen', w.ende())
}

{
  const w = welt()
  const k = w.kontext
  k.listenId = 'irgendwas'
  k.location.pathname = '/s'
  vm.runInContext('primeLaufStarten()', k)
  pruefe('Start außerhalb einer Titelseite: Sprung zum ersten Titel mit Titelseite, nicht zur Suche', k.location.href === 'https://www.amazon.de/gp/video/detail/B07VP6VPVR', k.location.href)
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zum Prime-Durchgang halten.')
