/**
 * Netflix-Prüfliste: zurückgestellte Titel sichtbar machen (Daniel 15.11.2026: „0 auf prüfung, 160 zurückgestellt,
 * aber man sieht es visuell nicht“). Geprüft: Text „bis …“ (anderer Tag / selber Berliner Tag / Sommer- und Winterzeit /
 * unlesbarer Wert), Marke samt Tooltip, Filterknopf mit Umschaltung, und `zurueckInfo` (aktiv, abgelaufen, fertig, unbekannt).
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const macheElement = (tag) => ({
  tag,
  className: '',
  textContent: '',
  title: '',
  kinder: [],
  _klassen: new Set(),
  classList: {
    add(...n) { n.forEach((x) => this._.add(x)) },
    toggle(n) { if (this._.has(n)) this._.delete(n); else this._.add(n) },
    contains(n) { return this._.has(n) },
  },
  get children() { return this.kinder },
  insertBefore(k, vor) {
    const i = vor ? this.kinder.indexOf(vor) : -1
    if (i < 0) this.kinder.push(k)
    else this.kinder.splice(i, 0, k)
    return k
  },
})
const element = (tag) => {
  const e = macheElement(tag)
  e.classList._ = e._klassen
  return e
}

const kontext = { globalThis: null, document: { createElement: element } }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) {
  vm.runInContext(readFileSync(resolve(__dirname, datei), 'utf8'), kontext)
}
const liste = kontext.akNetflixZurueckListe

console.log('Netflix: zurückgestellte Titel in der Prüfliste')

/* 15.11.2026, 12:00 Berlin (Winterzeit, UTC+1). */
const JETZT = Date.UTC(2026, 10, 15, 11, 0)
const zeileMit = () => {
  const z = element('div')
  z.kinder.push(element('a'), element('div'))
  return z
}
const marke = (z) => z.kinder.find((k) => k.className === 'ak-zurueck-marke')

{
  const z = zeileMit()
  liste.markieren(z, { grund: 'Erinnern 20. November', bis: Date.UTC(2026, 10, 19, 23, 0) }, JETZT)
  pruefe('anderer Tag: „zurückgestellt bis 20.11.“ (Mitternacht Berlin zählt zum 20.)', marke(z)?.textContent === 'zurückgestellt bis 20.11.', marke(z)?.textContent)
  pruefe('Zeile bekommt ak-zurueck', z.classList.contains('ak-zurueck'))
  pruefe('Tooltip nennt Datum und Grund', z.title === 'Zurückgestellt bis 20.11. — Erinnern 20. November', z.title)
  pruefe('Marke steht an Stelle 2, hinter dem Titel-Link', z.kinder[1]?.className === 'ak-zurueck-marke' && z.kinder.length === 3, z.kinder.map((k) => k.className))
}
{
  const z = zeileMit()
  liste.markieren(z, { grund: 'Erinnern 15. November', bis: Date.UTC(2026, 10, 15, 12, 30) }, JETZT)
  pruefe('selber Berliner Tag: Uhrzeit statt Datum („bis 13:30“)', marke(z)?.textContent === 'zurückgestellt bis 13:30', marke(z)?.textContent)
}
{
  const z = zeileMit()
  liste.markieren(z, { grund: 'x', bis: Date.UTC(2026, 6, 15, 12, 0) }, Date.UTC(2026, 6, 1, 12, 0))
  pruefe('Sommerzeit: „bis 15.7.“', marke(z)?.textContent === 'zurückgestellt bis 15.7.', marke(z)?.textContent)
}
{
  const z = zeileMit()
  liste.markieren(z, { grund: 'x', bis: Number.MAX_SAFE_INTEGER }, JETZT)
  pruefe('unlesbarer Ablauf: „bis auf Weiteres“, kein Absturz', marke(z)?.textContent === 'zurückgestellt bis auf Weiteres', marke(z)?.textContent)
}
{
  const z = zeileMit()
  liste.markieren(z, null, JETZT)
  pruefe('ohne Eintrag bleibt die Zeile unberührt', !z.classList.contains('ak-zurueck') && z.title === '' && z.kinder.length === 2)
}
{
  const kasten = element('div')
  let klick = null
  const knopf = liste.filterKnopf(kasten, 160, (_, f) => (klick = f))
  pruefe('Filterknopf nennt die Zahl: „160 zurückgestellt zeigen“', knopf.textContent === '160 zurückgestellt zeigen', knopf.textContent)
  pruefe('Knopf ist ein ak-umschalter wie „gemeldet zeigen“', knopf.className === 'ak-umschalter')
  pruefe('ohne Klick ist der Filter aus', !kasten.classList.contains('ak-mit-zurueck'))
  klick()
  pruefe('Klick 1: Filter an, Beschriftung „ausblenden“', kasten.classList.contains('ak-mit-zurueck') && knopf.textContent === '160 zurückgestellt ausblenden', knopf.textContent)
  klick()
  pruefe('Klick 2: wieder aus, Beschriftung „zeigen“', !kasten.classList.contains('ak-mit-zurueck') && knopf.textContent === '160 zurückgestellt zeigen', knopf.textContent)
}

const speicherNeu = (start) => {
  const daten = { ...start }
  return { get: async (k) => (k in daten ? { [k]: daten[k] } : {}), set: async (o) => void Object.assign(daten, o) }
}
async function pruefeInfo() {
  const bis = Date.UTC(2026, 10, 20)
  const speicher = speicherNeu({
    netflixZurueckgestellt: {
      1: { grund: 'Erinnern 20. November', bis },
      2: { grund: 'alt', bis: JETZT - 1 },
      3: { grund: 'fertig-Fall', bis },
      9: { grund: 'nicht gelistet', bis },
    },
  })
  const titel = { 1: {}, 2: {}, 3: {} }
  const karte = kontext.akNetflixZurueckNeu(titel, (k) => k === '3', { speicher, jetzt: () => JETZT, datum: () => null })
  await karte.geladen()
  pruefe('zurueckInfo: aktiver Eintrag liefert Grund und Ablauf', JSON.stringify(karte.zurueckInfo('1')) === JSON.stringify({ grund: 'Erinnern 20. November', bis }), karte.zurueckInfo('1'))
  pruefe('zurueckInfo: Zahl als Kennung zählt wie Text', karte.zurueckInfo(1)?.bis === bis)
  pruefe('zurueckInfo: abgelaufen → null', karte.zurueckInfo('2') === null)
  pruefe('zurueckInfo: nach Worker-Stand fertig → null', karte.zurueckInfo('3') === null)
  pruefe('zurueckInfo: nicht in der Liste → null', karte.zurueckInfo('9') === null)
  pruefe('zurueckInfo: unbekannt → null', karte.zurueckInfo('77') === null)
  pruefe('Zahl und Info stimmen überein (1 zurückgestellt)', karte.zurueckZahl() === 1, karte.zurueckZahl())
}

pruefeInfo().then(() => {
  console.log(fehler.length ? `\n${fehler.length} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(fehler.length ? 1 : 0)
})
