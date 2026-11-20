/**
 * Die eigene Auswahl sofort sichtbar (Prüfer R1, A1–A3, 20.11.2026), durch das ganze `amazon.js` im Sandkasten.
 *
 * Der Briefkasten hält seine Zählantwort bis zu 2 h (live gemessen: Age 6782) und kennt die frische Wahl nicht.
 * Die Attrappe liefert deshalb immer die ALTE Antwort ohne die Wahl; gewählt wird über die echte Gruppe der Titelseite
 * („Weitere Versionen verfügbar“, Fischen Impossible). Die Zeit ist fest und wird nur von Hand vorgestellt.
 */
const { lies, element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')

const FIXTURE = lies('prime-fassungen.fixture.json')
const SUCHE = 'https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const SELBST = '/gp/video/detail/B01MSMV5MA'
const JETZT = 1_800_000_000_000
const QUELLEN = ['box.js', 'titel-bindung.js', 'melde-sperre.js', 'prime-stand.js', 'prime-stand-ziele.js', 'prime-durchgang-suche.js', 'prime-region.js', 'prime-fassungen.js', 'amazon-knopf-zeichnen.js', 'amazon.js'].map(lies)

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Alle Nachkommen eines Elements, in Baumreihenfolge. */
const nachkommen = (e) => (e?.kinder ?? []).flatMap((k) => [k, ...nachkommen(k)])
const mitKlasse = (wurzeln, klasse) => wurzeln.flatMap((w) => [w, ...nachkommen(w)]).filter((e) => String(e.className ?? '').split(/\s+/).includes(klasse))
const texte = (wurzeln) => wurzeln.flatMap((w) => [w, ...nachkommen(w)]).map((e) => e.textContent).filter(Boolean)

/**
 * Lädt `amazon.js` auf der Titelseite eines Suchauftrags. `lokal` ist der Speicher der Erweiterung (wird von der Seite
 * beschrieben und kann in einen zweiten Aufruf gereicht werden), `alt` die Antwort des Briefkastens (veränderlich).
 */
function lade({ lokal = {}, alt = {}, uhr = { jetzt: JETZT }, suche = { [SUCHE]: { titel: 'Fischen Impossible', id: 1, folgen: 1 } }, auftrag = { titel: 'Fischen Impossible', id: 1, suchUrl: SUCHE, zeit: JETZT, folgen: 1 } } = {}) {
  const angehaengt = []
  const posts = []
  const speicher = auftrag ? { 'ak-prime-suchauftrag': JSON.stringify(auftrag) } : {}
  const fenster = { addEventListener() {}, location: { pathname: SELBST, search: '' } }
  const k = sandkasten({
    speicher,
    chromeLokal: {
      /* Wie Chrome: nur die verlangten Schlüssel (sonst überlebt ein falscher Schlüssel im Code). */
      get: (verlangt) => {
        const alle = { amazonErledigt: {}, amazonSuche: {}, ...lokal }
        const namen = typeof verlangt === 'string' ? [verlangt] : Array.isArray(verlangt) ? verlangt : Object.keys(verlangt ?? alle)
        return Promise.resolve(Object.fromEntries(namen.filter((n) => n in alle).map((n) => [n, alle[n]])))
      },
      set: (werte) => {
        Object.assign(lokal, werte)
        return Promise.resolve()
      },
    },
    fetch: (u, opt) => {
      if (opt?.method === 'POST') {
        posts.push(JSON.parse(opt.body))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      const antwort = String(u).includes('prime-suche.json') || String(u).includes('stand=1') ? {} : { imBriefkasten: {}, adressen: [], gemeldet: [], gemeldeteSuchen: [], ...alt }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) })
    },
  })
  k.chrome.storage.sync = { get: () => Promise.resolve({ token: 'T' }), set: () => Promise.resolve() }
  k.Date = class extends Date {
    constructor(...a) {
      if (a.length) super(...a)
      else super(uhr.jetzt)
    }
    static now() {
      return uhr.jetzt
    }
  }
  const neu = () => {
    const e = element()
    e.classList.add = (c) => {
      e.className += ` ${c}`
    }
    e.querySelectorAll = (wahl) => (String(wahl).includes('input:checked') ? nachkommen(e).filter((x) => x.type === 'checkbox' && x.checked) : [])
    return e
  }
  const dokument = {
    documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild(e) { angehaengt.push(e); return e } },
    body: { ...neu(), appendChild(e) { angehaengt.push(e); return e } },
    title: 'Amazon.de',
    createElement: neu,
    createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: FIXTURE } : null),
    querySelector: (sel) => (sel === '.ak-amazon-suchhinweis' ? angehaengt.find((e) => String(e.className).includes('ak-amazon-suchhinweis')) ?? null : null),
    querySelectorAll: () => [],
    addEventListener() {},
    head: element(),
  }
  Object.assign(k, {
    AK_PRIME_SUCHE: suche,
    location: { pathname: SELBST, search: '', href: 'https://www.amazon.de' + SELBST },
    document: dokument,
    window: fenster,
  })
  fenster.document = dokument
  /* Die Menge der eigenen Meldungen gehört `amazon.js`; sie wird beim Start durchgereicht und hier abgegriffen. */
  const bis = QUELLEN.findIndex((q) => q.includes('globalThis.akPrimeSeitenStarten = '))
  laufen(QUELLEN.slice(0, bis + 1), k)
  let selbst = null
  const echt = k.akPrimeSeitenStarten
  k.akPrimeSeitenStarten = (...a) => {
    selbst = a[0]
    return echt(...a)
  }
  const { absturz } = laufen(QUELLEN.slice(bis + 1), k)
  const bericht = () => fenster.AK.bericht()
  const lage = () => bericht().erwartungsLage
  const knopf = () => mitKlasse(angehaengt, 'ak-amazon-uebersicht')[0]
  const oeffnen = () => knopf().hoerer.click()
  const dialogTexte = () => texte(mitKlasse(angehaengt, 'ak-dialog'))
  return { k, absturz, angehaengt, bericht, lage, lokal, posts, uhr, knopf, oeffnen, dialogTexte, selbstGemeldet: (kennung) => selbst.add(kennung) }
}

const warte = async (w) => {
  await durchlaufen()
  w.k.takt()
  await durchlaufen()
}

/** Wählt zwei Fassungen auf der Titelseite und übernimmt sie; der Briefkasten kennt sie danach noch nicht. */
async function waehle(w) {
  const gruppe = mitKlasse(w.angehaengt, 'ak-such-gruppe')[0]
  const boxen = nachkommen(gruppe).filter((x) => x.type === 'checkbox')
  for (const b of boxen) b.checked = ['B01MSMV5MA', 'B01HRLV328'].includes(b.dataset.kennung)
  const uebernehmen = nachkommen(gruppe).find((x) => x.textContent === 'Auswahl übernehmen')
  uebernehmen.hoerer.click()
  await durchlaufen()
  return { gruppe, boxen, uebernehmen }
}

async function haupt() {
  console.log('Die eigene Auswahl ist sofort sichtbar, obwohl der Briefkasten die alte Antwort hält\n')

  const a = lade()
  pruefe('Lauf ohne Absturz', !a.absturz, a.absturz?.message)
  await warte(a)
  pruefe('vor der Wahl: die Suche zählt als offen, die Gruppe steht auf der Titelseite', a.lage().suchOffen === 1 && mitKlasse(a.angehaengt, 'ak-such-gruppe').length === 1, a.lage())
  pruefe('… der Knopf nennt die offene Suche', /1 Prime-Suchen offen/.test(a.knopf().textContent), a.knopf().textContent)
  const { gruppe } = await waehle(a)
  pruefe('die Wahl ging an den Worker (Suchadresse und zwei Kennungen)', a.posts.length === 1 && a.posts[0].erwartung.suchUrl === SUCHE && a.posts[0].erwartung.kennungen.join() === 'B01MSMV5MA,B01HRLV328', a.posts)
  await warte(a)
  const zeile = a.lage().zeilen[0]
  pruefe('trotz alter Briefkasten-Antwort: die Suche kennt ihre Wahl', zeile.erwartet?.join() === 'B01MSMV5MA,B01HRLV328' && a.lage().suchOffen === 0, zeile)
  pruefe('der Knopf zählt die zwei offenen Karten, nicht „alles geprüft“', /2 gewählte Treffer offen/.test(a.knopf().textContent), a.knopf().textContent)
  pruefe('… und sein Hinweis fordert zum Öffnen der Liste auf (es ist noch Arbeit da)', /^Liste öffnen/.test(a.knopf().title), a.knopf().title)
  a.oeffnen()
  await warte(a)
  const t = a.dialogTexte()
  pruefe('die Prüfliste zeigt die Gruppe „Gewählte Treffer“ mit zwei offenen Zeilen', t.includes('Gewählte Treffer: 2 offen'), t)
  pruefe('der Listenkopf nennt die zwei Karten, nicht „Alles geprüft“', t.includes('2 gewählte Treffer zu prüfen') && !t.includes('Alles geprüft'), t.slice(0, 6))
  pruefe('der Merker mit Zeit liegt im Speicher (überlebt das Neuladen)', a.lokal.primeAuswahlKopf?.[SUCHE]?.eigen?.join() === 'B01MSMV5MA,B01HRLV328' && a.lokal.primeAuswahlKopf[SUCHE].am === JETZT, a.lokal.primeAuswahlKopf)

  console.log('\nNeuladen der Seite: nur der Speicher bleibt')
  const b = lade({ lokal: a.lokal })
  await warte(b)
  b.uhr.jetzt += 3000
  await warte(b)
  pruefe('nach dem Neuladen zählt die Wahl weiter (Briefkasten noch alt)', b.lage().zeilen[0].erwartet?.length === 2 && b.lage().suchOffen === 0, b.lage())
  const bKasten = mitKlasse(b.angehaengt, 'ak-amazon-suchhinweis').at(-1)
  const bZeilen = mitKlasse([bKasten], 'ak-such-auswahl')
  pruefe('… die Titelseite zeigt die Checkliste der Wahl (zwei Zeilen, keine Ankreuzfelder mehr)', bZeilen.length === 2 && bZeilen.every((z) => z.kinder[0].type !== 'checkbox'), bZeilen.map((z) => texte([z])))

  console.log('\nZurücknehmen (↺): der Briefkasten führt die Wahl noch')
  const zurueck = nachkommen(gruppe).find((x) => x.textContent === '↺')
  pruefe('nach der Übernahme ist ↺ sichtbar (Kontrolle)', zurueck.hidden === false)
  zurueck.hoerer.click()
  await durchlaufen()
  await warte(a)
  pruefe('nach ↺: die Zeilen sind weg und die Suche zählt wieder als offen', a.lage().zeilen[0].erwartet === null && a.lage().suchOffen === 1, a.lage())
  pruefe('… der Merker hält die Rücknahme (leere Liste)', a.lokal.primeAuswahlKopf[SUCHE].eigen.length === 0, a.lokal.primeAuswahlKopf)
  const c = lade({ lokal: a.lokal, alt: { erwartungen: { [SUCHE]: ['B01MSMV5MA', 'B01HRLV328'] } } })
  await warte(c)
  pruefe('nach dem Neuladen führt der alte Briefkasten die Wahl noch, die Rücknahme gilt trotzdem', c.lage().zeilen[0].erwartet === null && c.lage().suchOffen === 1, c.lage())

  console.log('\nFrist: nach 125 Minuten gilt wieder der Briefkasten')
  const spaet = lade({ lokal: { primeAuswahlKopf: { [SUCHE]: { titel: 'Fischen Impossible', folgen: 1, eigen: ['B01MSMV5MA'], am: JETZT - 125 * 60 * 1000 } } } })
  await warte(spaet)
  pruefe('genau 125 min alt: die Wahl ist abgelaufen, der (alte) Briefkasten entscheidet', spaet.lage().zeilen[0].erwartet === null, spaet.lage())
  const knapp = lade({ lokal: { primeAuswahlKopf: { [SUCHE]: { titel: 'Fischen Impossible', folgen: 1, eigen: ['B01MSMV5MA'], am: JETZT - 125 * 60 * 1000 + 1 } } } })
  await warte(knapp)
  pruefe('eine Millisekunde jünger: die Wahl gilt noch', knapp.lage().zeilen[0].erwartet?.join() === 'B01MSMV5MA', knapp.lage())

  console.log('\nEine Karte wird bei offenem Dialog gemeldet (Durchgang, anderer Tab)')
  const d = lade({ lokal: { primeAuswahlKopf: { [SUCHE]: { titel: 'Fischen Impossible', folgen: 1, eigen: ['B01MSMV5MA', 'B01HRLV328'], am: JETZT } } } })
  await warte(d)
  d.oeffnen()
  await warte(d)
  const karten = () => mitKlasse(d.angehaengt, 'ak-abgehakt').filter((e) => /· B01/.test(e.kinder?.[0]?.textContent ?? ''))
  pruefe('Dialog offen: zwei offene Zeilen, keine abgehakt', karten().length === 0 && d.dialogTexte().includes('Gewählte Treffer: 2 offen'), d.dialogTexte())
  const sucheZeilen = () => mitKlasse(d.angehaengt, 'ak-abgehakt').filter((e) => !/· B01/.test(e.kinder?.[0]?.textContent ?? ''))
  pruefe('die Suche mit Auswahl steht in „Suchen“ als erledigt (ausgeblendet), sie zählt nicht als offen', sucheZeilen().length === 1 && d.dialogTexte().includes('Suchen: 1 erledigt, keine offen'), d.dialogTexte())
  d.selbstGemeldet('B01MSMV5MA')
  await warte(d)
  pruefe('die gemeldete Karte ist ohne weitere Änderung abgehakt, der Dialog hat neu gezeichnet', karten().length === 1 && d.dialogTexte().includes('Gewählte Treffer: 1 offen, 1 erledigt'), d.dialogTexte())
  pruefe('Knopf und Listenkopf zählen jetzt eine offene Karte', /1 gewählte Treffer offen/.test(d.knopf().textContent) && d.dialogTexte().includes('1 gewählte Treffer zu prüfen'), [d.knopf().textContent])

  console.log('\nDer Bau hat die Suche abgeräumt: Titel und Folgenzahl kommen aus dem Merker')
  const e = lade({ suche: {}, lokal: { primeAuswahlKopf: { [SUCHE]: { titel: 'Fischen Impossible', folgen: 1, eigen: ['B01MSMV5MA', 'B01HRLV328'], am: JETZT } } } })
  await warte(e)
  e.oeffnen()
  await warte(e)
  pruefe('die Zeilen tragen den gemerkten Titel statt „Prime-Treffer“', e.dialogTexte().includes('Fischen Impossible · B01MSMV5MA') && !e.dialogTexte().some((x) => /Prime-Treffer/.test(x)), e.dialogTexte())

  console.log('\nEine gewählte Karte genügt: die Titelseite zeigt die Checkliste, nicht noch einmal die Auswahl')
  const f = lade({ lokal: { primeAuswahlKopf: { [SUCHE]: { titel: 'Fischen Impossible', folgen: 1, eigen: ['B01HRLV328'], am: JETZT } } } })
  await warte(f)
  f.uhr.jetzt += 3000
  await warte(f)
  const fKasten = mitKlasse(f.angehaengt, 'ak-amazon-suchhinweis').at(-1)
  pruefe('eine Karte gewählt: Checkliste mit einer Zeile, keine Ankreuzfelder', mitKlasse([fKasten], 'ak-such-auswahl').length === 1 && nachkommen(fKasten).every((x) => x.type !== 'checkbox'), mitKlasse([fKasten], 'ak-such-auswahl').length)

  console.log('\nAuftrag ohne Suchadresse: keine Auswahl, die nirgends hin speichern könnte')
  const h = lade({ suche: {}, auftrag: { titel: 'Fischen Impossible', id: 1, zeit: JETZT, folgen: 1 } })
  await warte(h)
  pruefe('keine Ankreuzzeilen', mitKlasse(h.angehaengt, 'ak-such-gruppe').length === 0 && mitKlasse(h.angehaengt, 'ak-such-auswahl').length === 0, mitKlasse(h.angehaengt, 'ak-such-auswahl').length)

  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) rot.`)
    process.exit(1)
  }
  console.log('\nDie eigene Auswahl ist sofort sichtbar: alle Zusicherungen erfüllt.')
}

haupt()
