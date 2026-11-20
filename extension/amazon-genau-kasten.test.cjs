/**
 * Der Suchkasten als Auswahl (20.11.2026): `genauZeigen`, `auswahlGruppe`, `auswahlSpeichern` in `amazon.js` und die
 * Gruppe aus `prime-durchgang-suche.js`.
 *
 * Anlass (Daniel, Black Butler): die Suchseite zeigte zehn Karten, der Kasten bot nur „Suchtreffer anklicken" für eine
 * an, danach stand „gemeldet ✓". Jetzt zeigt der Kasten **alle** Karten zum Ankreuzen; „Auswahl übernehmen" speichert sie
 * beim Worker, gemeldet wird auf der Suchseite nichts.
 *
 * Die Funktionen werden wörtlich aus dem Quelltext geschnitten und gegen Attrappen gespielt.
 */
const { readFileSync } = require('node:fs')

const quelltext = readFileSync(__dirname + '/amazon.js', 'utf8')
const modul = readFileSync(__dirname + '/prime-durchgang-suche.js', 'utf8')
const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
function schneide(name, art = 'function') {
  const start = quelltext.indexOf(`  ${art} ${name}(`)
  if (start < 0) throw new Error(`${name} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n  }\n', start) + 4)
}
function zeile(anfang) {
  const start = quelltext.indexOf(anfang)
  if (start < 0) throw new Error(`${anfang} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n', start))
}

/* Der Aufruf im Suchkasten: ohne ihn bliebe der Kasten bei genauem Treffer leer. */
pruefe(
  'zeichnen() ruft genauZeigen mit allen sechs Werten in dieser Reihenfolge',
  quelltext.includes("if (befund.art === 'genau') return genauZeigen(auftrag, zeichnen, befund, gefunden, begriffZeile, folgen)"),
)

/* Ein Mini-DOM: nur, was die Gruppe braucht. */
const alle = (e) => [e, ...(e.kinder ?? []).flatMap(alle)]
const element = () => ({
  kinder: [],
  className: '',
  hidden: false,
  classList: { add() {} },
  append(...k) {
    this.kinder.push(...k)
  },
  appendChild(k) {
    this.kinder.push(k)
    return k
  },
  querySelectorAll() {
    return alle(this).filter((x) => x.box && x.checked).map((x) => ({ dataset: { kennung: x.kennung } }))
  },
})
globalThis.document = { createElement: element }
new Function(modul)()

const bau = new Function(
  'umwelt',
  [
    'const { hinweisKasten, kastenKnopf, kastenZeile, kastenAuswahl, erwartungZu, istGemeldet, nichtBeiPrimeMelden, auswahlSpeichern } = umwelt',
    zeile('  const ohneParameter = '),
    schneide('karteKennung'),
    schneide('auswahlGruppe'),
    schneide('genauZeigen'),
    'return { genauZeigen }',
  ].join('\n'),
)

function lauf(treffer, { gemeldet = false, gewaehlt = null, speichernOk = true } = {}) {
  const p = { kasten: null, gespeichert: [], gemeldetMit: null }
  const umwelt = {
    hinweisKasten: (...args) => { p.kasten = args },
    kastenKnopf: (text, tun) => ({ knopf: text, tun, textContent: text, disabled: false, hidden: false, aria: {}, setAttribute(n, v) { this.aria[n] = v }, classList: { add() {} } }),
    kastenZeile: (klasse, text) => ({ zeile: text, klasse }),
    kastenAuswahl: (name, kennung, angehakt) => ({ box: true, name, kennung, checked: angehakt === true }),
    erwartungZu: () => gewaehlt,
    istGemeldet: () => gemeldet,
    nichtBeiPrimeMelden: (...args) => { p.gemeldetMit = args },
    auswahlSpeichern: (auftrag, kennungen) => {
      p.gespeichert.push({ auftrag, kennungen })
      return Promise.resolve(speichernOk)
    },
  }
  const { genauZeigen } = bau(umwelt)
  const auftrag = { titel: 'Black Butler', suchUrl: 'https://www.amazon.de/s?k=Black%20Butler' }
  const befund = { art: 'genau', treffer: treffer.slice(0, 1) }
  const gefunden = { treffer }
  genauZeigen(auftrag, () => 'zeichnen', befund, gefunden, [{ begriff: 'gesucht als: Black Butler' }], '24 Folgen')
  const [titel, folgen, ...rest] = p.kasten
  const gruppe = rest.find((x) => x?.kinder)
  return { p, auftrag, befund, titel, folgen, rest, gruppe, boxen: gruppe ? alle(gruppe).filter((x) => x.box) : [] }
}

const karte = (n, titel = `Black Butler ${n}`) => ({ titel, typ: 'TV Show', zugang: 'Entitled', url: `https://www.amazon.de/gp/video/detail/B0BUTLER${String(n).padStart(3, '0')}?ref=x` })
const ZEHN = Array.from({ length: 10 }, (_, i) => karte(i + 1))

/* Daniels Fall: zehn Karten, genau einer „genau" — alle stehen zur Auswahl, keine ist vorgekreuzt. */
{
  const { p, titel, folgen, rest, gruppe, boxen } = lauf(ZEHN)
  pruefe('der Kasten nennt Titel und Folgen', titel === 'Black Butler' && folgen === '24 Folgen', [titel, folgen])
  pruefe('die Suchzeile steht zuerst', rest[0]?.begriff === 'gesucht als: Black Butler', rest[0])
  pruefe('alle zehn Karten stehen zur Auswahl, in Seitenreihenfolge', boxen.length === 10 && boxen[0].kennung === 'B0BUTLER001' && boxen[9].kennung === 'B0BUTLER010', boxen.map((b) => b.kennung))
  pruefe('keine Karte ist vorgekreuzt', boxen.every((b) => b.checked === false), boxen.map((b) => b.checked))
  pruefe('die Anleitung steht über den Karten', gruppe?.kinder[0]?.zeile === 'Kreuze alle Karten an, die zu diesem Titel gehören, jede Staffel einzeln.', gruppe?.kinder[0])
  const alleKnoepfe = alle(gruppe).filter((x) => x.knopf).map((x) => x.knopf)
  pruefe('kein „Suchtreffer anklicken": der Kasten springt nicht mehr auf eine Karte', !alleKnoepfe.some((x) => /Suchtreffer anklicken/.test(x)) && !rest.some((x) => /Suchtreffer anklicken/.test(x?.knopf ?? '')), alleKnoepfe)
  pruefe('am Ende der Weg „nicht bei Prime"', rest.at(-1)?.knopf === 'Nicht bei Prime — melden', rest.at(-1))
  pruefe('nichts wurde gespeichert, bevor Daniel übernimmt', p.gespeichert.length === 0)
}

/* Übernehmen: genau die angekreuzten Karten gehen zum Speichern. */
{
  const { p, auftrag, gruppe, boxen } = lauf(ZEHN)
  const uebernehmen = alle(gruppe).find((x) => x.knopf === 'Auswahl übernehmen')
  uebernehmen.tun(uebernehmen)
  pruefe('nichts angekreuzt: nichts wird gespeichert', p.gespeichert.length === 0 && uebernehmen.textContent === 'Erst Karten ankreuzen', [p.gespeichert.length, uebernehmen.textContent])
  boxen[1].checked = true
  boxen[4].checked = true
  boxen[9].checked = true
  uebernehmen.tun(uebernehmen)
  pruefe('drei angekreuzt: genau diese drei, mit dem Auftrag', p.gespeichert.length === 1 && p.gespeichert[0].kennungen.join() === 'B0BUTLER002,B0BUTLER005,B0BUTLER010' && p.gespeichert[0].auftrag === auftrag, p.gespeichert)
}

/* Eine schon gespeicherte Auswahl ist angekreuzt, der Knopf zeigt sie und lässt sich zurücknehmen. */
{
  const { gruppe, boxen, p } = lauf(ZEHN, { gewaehlt: ['B0BUTLER003', 'B0BUTLER004'] })
  pruefe('gespeicherte Auswahl: genau diese sind angekreuzt', boxen.filter((b) => b.checked).map((b) => b.kennung).join() === 'B0BUTLER003,B0BUTLER004', boxen.filter((b) => b.checked).map((b) => b.kennung))
  const knoepfe = alle(gruppe).filter((x) => x.knopf)
  pruefe('der Knopf nennt die Zahl und ist gesperrt', knoepfe[0]?.textContent === '2 in der Prüfliste' && knoepfe[0]?.disabled === true, knoepfe[0])
  pruefe('das Zurücknehmen ist sichtbar', knoepfe[1]?.hidden === false, knoepfe[1])
  knoepfe[1].tun(knoepfe[1])
  pruefe('Zurücknehmen speichert eine leere Auswahl', p.gespeichert.length === 1 && p.gespeichert[0].kennungen.length === 0, p.gespeichert)
}

/* Dieselbe Kennung zweimal auf der Seite: eine Zeile. Karten ohne Adresse zählen nicht. */
{
  const { boxen } = lauf([karte(1), karte(1, 'Black Butler (Wiederholung)'), { titel: 'ohne Adresse', url: null }, karte(2)])
  pruefe('doppelte Kennung: eine Zeile, Karte ohne Adresse entfällt', boxen.map((b) => b.kennung).join() === 'B0BUTLER001,B0BUTLER002', boxen.map((b) => b.kennung))
}

/* Keine Karte: keine Gruppe, nur der Weg „nicht bei Prime". */
{
  const { rest, gruppe } = lauf([])
  pruefe('keine Karten: keine Auswahlgruppe', gruppe === undefined && rest.at(-1)?.knopf === 'Nicht bei Prime — melden', rest)
}

/* Der Weg „nicht bei Prime" meldet unter der Suchadresse; ist sie gemeldet, steht nur die Zeile. */
{
  const { p, auftrag, befund, rest } = lauf(ZEHN)
  rest.at(-1).tun('k')
  pruefe('der Meldeknopf meldet Auftrag, Befund, Knopf und Neuzeichnen', p.gemeldetMit?.[0] === auftrag && p.gemeldetMit?.[1] === befund && p.gemeldetMit?.[2] === 'k' && p.gemeldetMit?.[3]() === 'zeichnen', p.gemeldetMit)
  const fertig = lauf(ZEHN, { gemeldet: true }).rest.at(-1)
  pruefe('schon gemeldet: Zeile „gemeldet ✓"', fertig?.zeile === 'gemeldet ✓' && fertig?.klasse === 'ak-such-fertig', fertig)
}

/* Speichern: Worker zuerst, Titel und Folgenzahl für die Prüfliste merken, danach neu zeichnen. */
{
  const bauSpeichern = new Function(
    'umwelt',
    ['let auswahlMerk = {}', 'const { erwartungMelden, uebersichtZeichnen, akKontext } = umwelt', 'const globalThis = { akKontext }', schneide('auswahlSpeichern', 'async function'), 'return { auswahlSpeichern, merk: () => auswahlMerk }'].join('\n'),
  )
  const spiel = (ok) => {
    const p = { geschrieben: [], gezeichnet: 0, gemeldet: [] }
    const umwelt = {
      erwartungMelden: async (u, k) => {
        p.gemeldet.push([u, k])
        return ok
      },
      uebersichtZeichnen: () => p.gezeichnet++,
      akKontext: { schreiben: async (d) => p.geschrieben.push(d) },
    }
    const { auswahlSpeichern, merk } = bauSpeichern(umwelt)
    return { p, auswahlSpeichern, merk }
  }
  const auftrag = { titel: 'Black Butler', folgen: 24, suchUrl: 'S1' }
  const a = spiel(true)
  a.auswahlSpeichern(auftrag, ['B1', 'B2']).then(async (ok) => {
    pruefe('Auswahl angekommen: Worker bekam Suchadresse und Kennungen', ok === true && a.p.gemeldet[0]?.[0] === 'S1' && a.p.gemeldet[0]?.[1].join() === 'B1,B2', a.p.gemeldet)
    pruefe('… Titel und Folgenzahl sind für die Prüfliste gemerkt', a.p.geschrieben[0]?.primeAuswahlKopf?.S1?.titel === 'Black Butler' && a.p.geschrieben[0]?.primeAuswahlKopf?.S1?.folgen === 24, a.p.geschrieben)
    pruefe('… und die Liste wird neu gezeichnet', a.p.gezeichnet === 1, a.p.gezeichnet)
    const b = spiel(false)
    const okB = await b.auswahlSpeichern(auftrag, ['B1'])
    pruefe('Worker nicht erreicht: nichts gemerkt, nicht neu gezeichnet, Ergebnis false', okB === false && b.p.geschrieben.length === 0 && b.p.gezeichnet === 0, b.p)
    const c = spiel(true)
    await c.auswahlSpeichern(auftrag, [])
    pruefe('Zurücknehmen: der Worker bekommt die leere Liste, es wird nichts gemerkt', c.p.gemeldet[0]?.[1].length === 0 && c.p.geschrieben.length === 0, c.p)
    await klickSperren()
    if (fehler.length) {
      console.error(`\n${fehler.length} Zusicherung(en) rot.`)
      process.exit(1)
    }
    console.log('Suchkasten als Auswahl: alle Zusicherungen erfüllt.')
  })
}

/* Melde-Knopf „Auswahl übernehmen" (Prüfer, R1): ein zweiter Klick löst keine zweite Meldung aus, weder währenddessen noch danach. */
async function klickSperren() {
  const warte = () => new Promise((r) => setImmediate(r))
  const bereit = () => {
    const l = lauf(ZEHN)
    const knopf = alle(l.gruppe).find((x) => x.knopf === 'Auswahl übernehmen')
    l.boxen[0].checked = true
    return { l, knopf }
  }
  const a = bereit()
  a.knopf.tun(a.knopf)
  a.knopf.tun(a.knopf)
  pruefe('zwei Klicks vor der Antwort: eine Meldung', a.l.p.gespeichert.length === 1, a.l.p.gespeichert.length)
  pruefe('während des Sendens gesperrt, auch für Hilfstechnik (aria-disabled)', a.knopf.disabled === true && a.knopf.aria['aria-disabled'] === 'true', a.knopf)
  await warte()
  a.knopf.tun(a.knopf)
  pruefe('nach angekommener Meldung: ein weiterer Klick sendet nichts', a.l.p.gespeichert.length === 1 && a.knopf.disabled === true && a.knopf.aria['aria-disabled'] === 'true', [a.l.p.gespeichert.length, a.knopf.aria])
  const bl = lauf(ZEHN, { speichernOk: false })
  const bk = alle(bl.gruppe).find((x) => x.knopf === 'Auswahl übernehmen')
  bl.boxen[0].checked = true
  bk.tun(bk)
  await warte()
  pruefe('nicht angekommen: der Knopf wird wieder frei, mit „noch einmal"', bk.disabled === false && bk.aria['aria-disabled'] === 'false' && /noch einmal/.test(bk.textContent), bk)
  bk.tun(bk)
  pruefe('… und der nächste Klick sendet erneut', bl.p.gespeichert.length === 2, bl.p.gespeichert.length)
  const z = lauf(ZEHN, { gewaehlt: ['B0BUTLER003'] })
  const zk = alle(z.gruppe).filter((x) => x.knopf).at(1)
  zk.tun(zk)
  zk.tun(zk)
  pruefe('Zurücknehmen: zwei Klicks, eine Meldung, währenddessen gesperrt', z.p.gespeichert.length === 1 && zk.disabled === true && zk.aria['aria-disabled'] === 'true', [z.p.gespeichert.length, zk.aria])
  await warte()
  pruefe('Zurücknehmen angekommen: der Knopf ist verschwunden und wieder frei', zk.hidden === true && zk.disabled === false, zk)
  const f = lauf(ZEHN, { gewaehlt: ['B0BUTLER003'], speichernOk: false })
  const fk = alle(f.gruppe).filter((x) => x.knopf).at(1)
  const fa = alle(f.gruppe).filter((x) => x.knopf).at(0)
  fk.tun(fk)
  await warte()
  pruefe('Zurücknehmen nicht angekommen: die Auswahl gilt weiter (Knopf bleibt gesperrt, ↺ sichtbar und frei)', fk.hidden === false && fk.disabled === false && fa.disabled === true, [fk.hidden, fk.disabled, fa.disabled])
}
