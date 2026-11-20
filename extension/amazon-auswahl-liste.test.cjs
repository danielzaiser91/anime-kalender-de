/**
 * Die gewählten Karten in der Prüfliste (20.11.2026): Zeilen, Überschriften, „Suche offen" und der Weg zum Lauf.
 *
 * Kreislauf: Daniel wählt auf der Suchseite drei Karten (beim Worker gespeichert) → die Suche zählt nicht mehr als offen
 * → drei Zeilen stehen in der Liste → „▶ alle durchgehen" besucht genau die offenen → eine Karte ist gemeldet →
 * nächster Stand: zwei offene Zeilen. Funktionen aus `amazon.js` werden wörtlich geschnitten, die Rechnung kommt aus
 * `prime-durchgang-suche.js`.
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
function schneide(name) {
  const start = quelltext.indexOf(`  function ${name}(`)
  if (start < 0) throw new Error(`${name} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n  }\n', start) + 4)
}
function zeile(anfang) {
  const start = quelltext.indexOf(anfang)
  if (start < 0) throw new Error(`${anfang} nicht gefunden`)
  return quelltext.slice(start, quelltext.indexOf('\n', start))
}

const element = () => ({
  kinder: [],
  className: '',
  style: {},
  classList: { gesetzt: [], add(k) { this.gesetzt.push(k) } },
  hoerer: {},
  appendChild(k) {
    this.kinder.push(k)
    return k
  },
  addEventListener(art, fn) {
    this.hoerer[art] = fn
  },
  click() {
    this.hoerer.click?.({ target: { closest: () => null } })
  },
})
globalThis.document = { createElement: element }
new Function(modul)()

const SUCHE = 'https://www.amazon.de/s?k=Black%20Butler&i=instant-video'
const SUCHE2 = 'https://www.amazon.de/s?k=Ohne%20Auswahl&i=instant-video'
const suchliste = { [SUCHE]: { titel: 'Black Butler', folgen: 24 }, [SUCHE2]: { titel: 'Ohne Auswahl', folgen: 12 } }

/* Die Rechnung: Zeilen aus den Erwartungen des Workers. */
{
  const erwartungen = { [SUCHE]: ['B0BUTLER001', 'B0BUTLER002', 'B0BUTLER003'] }
  const gemeldet = new Set(['B0BUTLER002'])
  const z = globalThis.akPrimeAuswahlZeilen(erwartungen, (u) => suchliste[u], (k) => gemeldet.has(k))
  pruefe('drei gewählte Karten: drei Zeilen mit Titel und Folgenzahl', z.length === 3 && z.every((x) => x.titel === 'Black Butler' && x.folgen === 24 && x.suchUrl === SUCHE), z)
  pruefe('der Stand kommt aus der Seite, nicht aus der Auswahl', z.map((x) => x.gemeldet).join() === 'false,true,false', z.map((x) => x.gemeldet))
  const e = globalThis.akPrimeAuswahlEinheiten(z)
  pruefe('der Lauf bekommt nur die offenen Karten, mit ihrer Suchadresse', e.map((x) => x.kennung).join() === 'B0BUTLER001,B0BUTLER003' && e.every((x) => x.suchUrl === SUCHE), e)
  const ohneKopf = globalThis.akPrimeAuswahlZeilen(erwartungen, () => null, () => false)
  pruefe('hat der Bau die Suche abgeräumt und fehlt der Merker: die Zeilen bleiben, mit Ersatztitel', ohneKopf.length === 3 && ohneKopf[0].titel === 'Prime-Treffer', ohneKopf)
  pruefe('eine Suche ohne gewählte Karten (leere Liste): keine Zeile', globalThis.akPrimeAuswahlZeilen({ [SUCHE2]: [] }, (u) => suchliste[u], () => false).length === 0)
}

/* Der Lauf: nach den Titeln die Karten, nie eine Suchseite; ohne Karten ist er fertig. */
{
  const lauf = {}
  let aufrufe = 0
  const neu = () => {
    aufrufe++
    return [{ kennung: 'B1', suchUrl: SUCHE }, { kennung: 'B2', suchUrl: SUCHE }]
  }
  const a = globalThis.akPrimeSucheWeiter(lauf, neu)
  pruefe('erste Karte: Art „treffer", Suchadresse als Auftrag', a?.art === 'treffer' && a.eintrag === 'B1' && a.suche === SUCHE, a)
  const b = globalThis.akPrimeSucheWeiter(lauf, neu)
  pruefe('zweite Karte, ohne die Auswahl noch einmal zu verteilen', b?.eintrag === 'B2' && aufrufe === 1, [b, aufrufe])
  pruefe('danach ist nichts mehr zu tun', globalThis.akPrimeSucheWeiter(lauf, neu) === null && aufrufe === 1)
  pruefe('ohne Karten: null, es wird keine Suchseite geöffnet', globalThis.akPrimeSucheWeiter({}, () => []) === null)
  const ziel = globalThis.akPrimeZielAuftrag({ suche: SUCHE }, 'B1?ref_=x', (u) => suchliste[u])
  pruefe('der Auftrag der Zielseite: Suchadresse, Titel und Kennung ohne Query', ziel.suchUrl === SUCHE && ziel.titel === 'Black Butler' && ziel.zielAsin === 'B1', ziel)
}

/* Überschriften: ohne Klick verständlich (Daniel, 20.11.2026: „0 von 2 offen" war es nicht). */
{
  const u = globalThis.akPrimeSuchUeberschrift
  pruefe('alles erledigt', u('Suchen', 0, 2) === 'Suchen: 2 erledigt, keine offen', u('Suchen', 0, 2))
  pruefe('alles offen: keine Erledigten erwähnt', u('Suchen', 3, 3) === 'Suchen: 3 offen', u('Suchen', 3, 3))
  pruefe('gemischt: beide Zahlen mit Wort', u('Gewählte Treffer', 2, 3) === 'Gewählte Treffer: 2 offen, 1 erledigt', u('Gewählte Treffer', 2, 3))
  pruefe('eine offene von einer', u('Suchen', 1, 1) === 'Suchen: 1 offen', u('Suchen', 1, 1))
}

/* „Suche offen": mit gewählten Karten ist sie erledigt, auch solange noch nicht alle gemeldet sind. */
{
  const bauSuchOffen = new Function('suchliste', 'erwartungZu', 'istGemeldet', `${zeile('  const suchOffen = ')}\nreturn suchOffen`)
  const offen = bauSuchOffen(suchliste, (u) => (u === SUCHE ? ['B1', 'B2'] : null), () => false)()
  pruefe('Suche mit Auswahl zählt nicht als offen, die ohne Auswahl schon', offen.join() === SUCHE2, offen)
  const gemeldetAlle = bauSuchOffen(suchliste, () => null, (u) => u === SUCHE2)()
  pruefe('ohne Auswahl und gemeldet („nicht bei Prime"): erledigt', gemeldetAlle.join() === SUCHE, gemeldetAlle)
}

/* Die Zeilen der Prüfliste. */
{
  const bau = new Function(
    'umwelt',
    [
      'const { auswahlZeilen, auswahlKopf, suchauftragMerken } = umwelt',
      schneide('auswahlZeileBauen'),
      schneide('auswahlAbschnitt'),
      'return { auswahlZeileBauen, auswahlAbschnitt }',
    ].join('\n'),
  )
  const gemerkt = []
  const zeilen = [
    { kennung: 'B0BUTLER001', suchUrl: SUCHE, titel: 'Black Butler', folgen: 24, gemeldet: true },
    { kennung: 'B0BUTLER002', suchUrl: SUCHE, titel: 'Black Butler', folgen: 24, gemeldet: false },
    { kennung: 'B0BUTLER003', suchUrl: SUCHE, titel: 'Black Butler', folgen: 24, gemeldet: false },
  ]
  const { auswahlZeileBauen, auswahlAbschnitt } = bau({
    auswahlZeilen: () => [...zeilen],
    auswahlKopf: (u) => suchliste[u],
    suchauftragMerken: (a) => gemerkt.push(a),
  })
  const inhalt = element()
  auswahlAbschnitt(inhalt)
  const [trenner, ...rest] = inhalt.kinder
  pruefe('Überschrift mit offenen und erledigten Karten', trenner?.textContent === 'Gewählte Treffer: 2 offen, 1 erledigt', trenner?.textContent)
  pruefe('je gewählte Karte eine Zeile, offene zuerst', rest.length === 3 && rest.map((r) => r.kinder[0].textContent).join() === 'Black Butler · B0BUTLER002,Black Butler · B0BUTLER003,Black Butler · B0BUTLER001', rest.map((r) => r.kinder[0].textContent))
  pruefe('die erledigte Zeile ist ausgeblendet (ak-abgehakt), die offenen nicht', rest[2].classList.gesetzt.includes('ak-abgehakt') && !rest[0].classList.gesetzt.includes('ak-abgehakt'), rest.map((r) => r.classList.gesetzt))
  pruefe('der Verweis führt auf die Titelseite der Karte', rest[0].kinder[0].href === 'https://www.amazon.de/gp/video/detail/B0BUTLER002', rest[0].kinder[0].href)
  rest[0].kinder[0].click()
  pruefe('der Klick legt den Auftrag ab: Suchadresse, Titel und Kennung der Karte', gemerkt.length === 1 && gemerkt[0].suchUrl === SUCHE && gemerkt[0].zielAsin === 'B0BUTLER002' && gemerkt[0].titel === 'Black Butler', gemerkt)
  const leer = element()
  bau({ auswahlZeilen: () => [], auswahlKopf: () => null, suchauftragMerken() {} }).auswahlAbschnitt(leer)
  pruefe('ohne gewählte Karten: kein Abschnitt', leer.kinder.length === 0)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('Gewählte Karten in der Prüfliste: alle Zusicherungen erfüllt.')
