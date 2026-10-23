/**
 * `?gemeldet=` je Durchgang: einmal je Adresse, nicht einmal je Seite (4.29.0, 11.10.2026).
 *
 * Der Durchgang lädt je Titel eine neue Seite; der Modulzustand ist dann leer. Gemessen am 11.10.2026
 * (nachgestellter Durchgang, echter Code): Disney+ 172 Titel = 30.272 Abrufe, Netflix 100 von 244
 * offenen Titeln = 24.400. Die Ablage in `localStorage` hält das Ergebnis über die Seiten.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (datei) => readFileSync(__dirname + '/' + datei, 'utf8')
const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const speicherNeu = () => {
  const m = new Map()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
  }
}
const uhrNeu = () => ({ t: 1_700_000_000_000 })

/* Eine Seite = ein frischer Kontext; die Uhr und die Ablage überleben sie. */
const seite = (speicher, uhr, zusatz = {}) => {
  class Uhr extends Date {
    static now() {
      return uhr.t
    }
  }
  const k = {
    Date: Uhr,
    setTimeout,
    Set,
    Map,
    Promise,
    Array,
    Object,
    Number,
    String,
    JSON,
    Infinity,
    localStorage: speicher,
    ...zusatz,
  }
  k.globalThis = k
  vm.runInNewContext(lies('disney-netz.js'), k)
  vm.runInNewContext(lies('disney-weg.js'), k)
  return k
}

/* Disney+: dieselben Funktionen aus disney.js wie in der Erweiterung, Seite für Seite. */
async function disneyDurchgang(titel, sekundenJeTitel, speicher) {
  const q = lies('disney.js')
  const schnitt = (anfang) => q.slice(q.indexOf(anfang), q.indexOf('\n  }\n', q.indexOf(anfang)) + 5)
  const code = schnitt('function istErledigt(') + schnitt('function offeneEintraege(') + schnitt('async function briefkastenHolen(')
  const liste = { w: { titel: 'W', url: 'https://x/w', seit: 'x', staffeln: [{ offen: true }] } }
  for (let i = 0; i < titel; i++) liste['t' + i] = { titel: 'T' + i, url: 'https://x/t' + i, staffeln: [{ offen: true }] }
  const uhr = uhrNeu()
  const gemeldet = new Set()
  let abrufe = 0
  for (let i = 0; i < titel; i++) {
    const k = seite(speicher, uhr, {
      briefkasten: new Map(),
      gemeldeteAdressen: new Set(),
      erneutBeantwortet: new Set(),
      liste,
      WORKER: 'w',
      fetch: async () => ({ ok: true, json: async () => ({ gemeldet: [], adressen: [], eintraege: [] }) }),
      gemeldeteHolen: async (u) => (abrufe++, gemeldet.has(u) ? new Set(['1:1']) : new Set()),
    })
    k.wartetAufUebernahme = k.AK_DISNEY_NETZ.gemerktesSet()
    vm.runInNewContext(code + '\nthis.b = briefkastenHolen', k)
    await k.b() // Seitenaufbau
    await k.gemeldeteHolen('https://x/t' + i) // Titelseite: vorab
    await k.gemeldeteHolen('https://x/t' + i) // Titelseite: vor dem Prüfen
    uhr.t += sekundenJeTitel * 500
    gemeldet.add('https://x/t' + i)
    k.wartetAufUebernahme.add('https://x/t' + i) // nach der Meldung
    await k.b()
    uhr.t += sekundenJeTitel * 500
  }
  return abrufe
}

/* Netflix: `akNetflixUebernahme` je Seite, eigene Meldungen über `akNetflixFrischSet`. */
async function netflixDurchgang(speicher) {
  const uhr = uhrNeu()
  const offene = {}
  const ziele = new Set()
  for (let i = 0; i < 50; i++) {
    offene['n' + i] = { staffeln: [{ offen: true }] }
    ziele.add('https://www.netflix.com/title/n' + i)
  }
  const gemeldet = new Set()
  let abrufe = 0
  const fetch = async (adresse) => {
    abrufe++
    const u = decodeURIComponent(String(adresse).split('?gemeldet=')[1])
    const paare = gemeldet.has(u) ? [{ nummer: 1, staffel: 1, am: '2026-10-11' }] : []
    return { ok: true, json: async () => ({ paare }) }
  }
  for (let i = 0; i < 50; i++) {
    const k = seite(speicher, uhr, { fetch, encodeURIComponent, decodeURIComponent })
    new Function('globalThis', 'fetch', lies('netflix-uebernahme.js'))(k, fetch)
    await k.akNetflixUebernahme(ziele, offene, 'w')
    uhr.t += 12000
    gemeldet.add('https://www.netflix.com/title/n' + i)
    k.akNetflixFrischSet().add('n' + i)
    await k.akNetflixUebernahme(ziele, offene, 'w')
    uhr.t += 12000
  }
  return abrufe
}

async function pruefeDurchgaenge() {
  const mit = await disneyDurchgang(40, 25, speicherNeu())
  pruefe('Disney+: 40 Titel mit Ablage = einmal alle Adressen + Wiedervorlage + 2 je Titelseite', mit === 41 + 80, mit)
  const ohne = await disneyDurchgang(40, 25, undefined)
  pruefe('Disney+: ohne Ablage wäre es quadratisch (Gegenprobe)', ohne > 40 * 40, ohne)
  const gross = await disneyDurchgang(172, 25, speicherNeu())
  const grossOhne = await disneyDurchgang(172, 25, undefined)
  console.log(`  Messung Disney+, 172 Titel, 25 s je Titel: ohne Ablage ${grossOhne} Abrufe, mit Ablage ${gross}`)
  pruefe('Disney+: 172 Titel, Rundgänge sinken um mehr als 90 %', gross < grossOhne / 10, [gross, grossOhne])
  const nMit = await netflixDurchgang(speicherNeu())
  pruefe('Netflix: 50 Titel mit Ablage = je Adresse einmal', nMit === 50, nMit)
  const nOhne = await netflixDurchgang(undefined)
  pruefe('Netflix: ohne Ablage quadratisch (Gegenprobe)', nOhne > 50 * 50 * 0.9, nOhne)
}

/* „nichts" gilt 30 Minuten, „gemeldet" eine Stunde. */
async function pruefeFristen() {
  const speicher = speicherNeu()
  const uhr = uhrNeu()
  let fragen = 0
  const hole = async (u) => (fragen++, u.endsWith('/ja') ? new Set(['1:1']) : new Set())
  const adressen = ['https://x/ja', 'https://x/nein']
  const frage = () => seite(speicher, uhr).AK_DISNEY_NETZ.frischGemeldet(adressen, hole)
  await frage()
  uhr.t += 29 * 60000
  await frage()
  pruefe('nach 29 Minuten keine neue Frage', fragen === 2, fragen)
  uhr.t += 2 * 60000
  await frage()
  pruefe('„nichts" wird nach 30 Minuten neu erfragt, „gemeldet" nicht', fragen === 3, fragen)
  uhr.t += 61 * 60000
  await frage()
  pruefe('„gemeldet" wird nach einer Stunde neu erfragt', fragen === 5, fragen)
}

/* Eine eigene Meldung gilt auf der nächsten Seite sofort, auch gegen ein gemerktes „nichts". */
async function pruefeEigeneMeldung() {
  const speicher = speicherNeu()
  const uhr = uhrNeu()
  const erste = seite(speicher, uhr).AK_DISNEY_NETZ
  await erste.frischGemeldet(['https://x/neu'], async () => new Set())
  erste.gemerktesSet().add('https://x/neu')
  let gefragt = 0
  const zweite = seite(speicher, uhr).AK_DISNEY_NETZ
  const erledigt = await zweite.frischGemeldet(['https://x/neu'], async () => (gefragt++, new Set()))
  pruefe('eigene Meldung: nächste Seite kennt sie ohne Abruf', erledigt.has('https://x/neu') && gefragt === 0, [gefragt, [...erledigt]])
}

/* Nichtauskunft (500, 429, Netzfehler) ist kein „nichts": nichts wird abgelegt, die nächste Seite fragt wieder. */
async function pruefeNichtauskunft() {
  const speicher = speicherNeu()
  const uhr = uhrNeu()
  let fragen = 0
  const kaputt = async () => (fragen++, Promise.reject(new Error('HTTP 429')))
  const frage = (holen) => seite(speicher, uhr).AK_DISNEY_NETZ.frischGemeldet(['https://x/a'], holen)
  await frage(kaputt)
  await frage(kaputt)
  pruefe('Fehler: nichts abgelegt, jede Seite fragt wieder', fragen === 2 && speicher.getItem('ak-gemeldet:https://x/a') === null, fragen)
  const erledigt = await frage(async () => new Set(['1:1']))
  pruefe('danach gilt die Auskunft', erledigt.has('https://x/a'))

  /* Die Holer selbst werfen bei !ok, statt ein leeres Set zu liefern. */
  const q = lies('disney.js')
  const von = q.indexOf('async function gemeldeteHolen(')
  const holen = q.slice(von, q.indexOf('\n  }\n', von) + 5)
  const k = { WORKER: 'w', encodeURIComponent, Set, Number, fetch: async () => ({ ok: false, status: 500 }) }
  vm.runInNewContext(holen + '\nthis.g = gemeldeteHolen', k)
  const still = await k.g('u')
  const wirft = await k.g('u', null, true).then(() => false, () => true)
  pruefe('Disney+ gemeldeteHolen: ohne `wirf` leeres Set, mit `wirf` ein Fehler', still.size === 0 && wirft)

  let netflixFragen = 0
  const fetchKaputt = async () => (netflixFragen++, { ok: false, status: 1101 })
  const ziele = new Set(['https://www.netflix.com/title/1'])
  const offene = { 1: { staffeln: [{ offen: true }] } }
  for (let i = 0; i < 2; i++) {
    const g = seite(speicher, uhr, { fetch: fetchKaputt, encodeURIComponent })
    new Function('globalThis', 'fetch', lies('netflix-uebernahme.js'))(g, fetchKaputt)
    await g.akNetflixUebernahme(ziele, offene, 'w')
  }
  pruefe('Netflix: nach HTTP 1101 wird beim nächsten Mal wieder gefragt', netflixFragen === 2, netflixFragen)
}

/* `seit` (Wiedervorlage) gehört zum abgelegten Ergebnis. */
async function pruefeSeit() {
  const speicher = speicherNeu()
  const uhr = uhrNeu()
  let fragen = 0
  const ja = async () => (fragen++, new Set(['1:1']))
  const nein = async () => (fragen++, new Set())
  const netz = () => seite(speicher, uhr).AK_DISNEY_NETZ
  await netz().frischGemeldet(['https://x/a'], ja)
  const mitSeit = await netz().frischGemeldet(['https://x/a'], ja, { seit: () => '2026-10-12' })
  pruefe('„gemeldet" ohne seit beantwortet keine Wiedervorlage', fragen === 2 && mitSeit.has('https://x/a'), fragen)
  const wieder = await netz().frischGemeldet(['https://x/a'], nein, { seit: () => '2026-10-12' })
  pruefe('„gemeldet" ab seit gilt für dasselbe und ein früheres seit', fragen === 2 && wieder.has('https://x/a'), fragen)
  await netz().frischGemeldet(['https://x/b'], nein, { seit: () => '2026-10-12' })
  await netz().frischGemeldet(['https://x/b'], nein, { seit: () => '2026-10-01' })
  pruefe('„nichts" ab seit gilt nicht für ein früheres seit', fragen === 4, fragen)
  netz().gemerktesSet().add('https://x/b')
  const danach = await netz().frischGemeldet(['https://x/b'], nein, { seit: () => '2023-01-01' })
  pruefe('eigene Meldung überschreibt ein „nichts" und gilt für ein seit vor jetzt', fragen === 4 && danach.has('https://x/b'), [fragen, [...danach]])
}

/* Dialog: zweimal öffnen innerhalb von zwei Minuten fragt nicht zweimal. */
function pruefeDialog() {
  const g = {}
  new Function('globalThis', 'fetch', lies('netflix-uebernahme.js'))(g, async () => ({}))
  const a = g.akMeldungenNeuLaden('1', 1000)
  const b = g.akMeldungenNeuLaden('1', 60000)
  const c = g.akMeldungenNeuLaden('1', 130000)
  pruefe('Dialog: Reihe wird innerhalb von zwei Minuten nicht neu geladen', a && !b && c, [a, b, c])
}

async function main() {
  await pruefeDurchgaenge()
  await pruefeFristen()
  await pruefeEigeneMeldung()
  await pruefeNichtauskunft()
  await pruefeSeit()
  pruefeDialog()
  const fehler = faelle.filter((f) => !f).length
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen zu `?gemeldet=` halten.')
  process.exit(fehler ? 1 : 0)
}

main()
