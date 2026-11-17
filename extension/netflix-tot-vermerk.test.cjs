/**
 * Netflix-Durchgang: was die Liste als offen zählt, darf die Auftragswahl nicht ausschließen (17.11.2026).
 *
 * Anlass: „▶ alle“ endete nach 10 Titeln mit „fertig“, der Knopf zeigte 151 offen. 149 Titel trugen den lokalen
 * Vermerk `erledigt[id] = ['tot']` (aus dem Fehltakt vor 4.32.151), `naechsterAuftrag()` übersprang sie, Zahl und
 * Liste (`fertig()`, Worker-Stand) führten sie offen. Läuft die echte `naechsterAuftrag`/`fertig`/`offeneStaffeln`
 * aus `melder.js` mit dem Zustand aus dem Bericht (offene Staffel, Tot-Vermerk, Stand führt den Titel).
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
const lies = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')
const melder = lies('melder.js')
const funktion = (name) => {
  const von = melder.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  if (von < 0) throw new Error(`${name}() nicht in melder.js`)
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(lies('netflix-uebernahme.js'), kontext)
vm.runInContext(lies('netflix-bericht.js'), kontext)

/* Echte Datenform: `offeneTitel[id] = { titel, staffeln: [{ nr, offen }] }`, Stand = Menge der Titel-Adressen. */
const eintrag = (titel) => ({ titel, staffeln: [{ nr: 1, offen: true }] })
const OFFEN = { 81000001: eintrag('Zurückgeholt'), 81000002: eintrag('Frisch tot gemeldet'), 81000003: eintrag('Ohne Vermerk') }
const url = (id) => `https://www.netflix.com/title/${id}`

/** Die Wahl mit dem Zustand `z`: `erledigt` (Speicher), `stand` (Set oder null), `frisch`, `wartet`. */
function wahl(z) {
  const a = {
    offeneTitel: OFFEN,
    erledigt: z.erledigt,
    standZieleNetflix: z.stand,
    frischGemeldetNetflix: z.frisch ?? new Set(),
    akNetflixWartet: z.wartet ?? new Set(),
    akNetflixErledigtLautStand: kontext.akNetflixErledigtLautStand,
    anbieterStaffeln: {},
    gemeinteReihe: () => null,
    selbstUebersprungen: { has: () => false },
    bremse: { ausgeschlossen: () => false },
    nichtDaTun: { besetzt: () => false },
  }
  const namen = Object.keys(a)
  const code = `${funktion('istErledigt')}\n${funktion('staffelnVon')}\n${funktion('fertig')}\n${funktion('naechsterAuftrag')}\nreturn { naechsterAuftrag, fertig }`
  return new Function(...namen, code)(...namen.map((n) => a[n]))
}
const folge = (z) => {
  const w = wahl(z)
  const gewaehlt = []
  for (let i = 0; i < 5; i++) {
    const id = w.naechsterAuftrag()
    if (!id) break
    gewaehlt.push(id)
    z.stand?.delete(url(id)) /* besucht und übernommen */
    z.erledigt[id] = [...(z.erledigt[id] ?? []), 'x']
  }
  return gewaehlt
}

console.log('Netflix: Tot-Vermerk gegen Worker-Stand')
{
  const z = { erledigt: { 81000001: ['tot'] }, stand: new Set(Object.keys(OFFEN).map(url)) }
  const w = wahl(z)
  pruefe('Bestand führt den Titel offen: fertig() sagt offen', w.fertig('81000001', OFFEN['81000001']) === false)
  pruefe('… und die Wahl legt ihn vor, obwohl ein alter Tot-Vermerk existiert', w.naechsterAuftrag() === '81000001')
  const offene = Object.entries(OFFEN).filter(([id, e]) => !w.fertig(id, e)).map(([id]) => id)
  pruefe('Wächter: jeder als offen gezählte Titel wird irgendwann gewählt', JSON.stringify(folge({ erledigt: { 81000001: ['tot'] }, stand: new Set(offene.map(url)) }).sort()) === JSON.stringify(offene.sort()), offene)
}
{
  const z = { erledigt: { 81000002: ['tot'] }, stand: new Set(Object.keys(OFFEN).map(url)), frisch: new Set(['81000002']) }
  pruefe('eben tot gemeldet (frisch): bis zur Übernahme nicht wieder vorgelegt', !folge(z).includes('81000002'))
}
{
  const z = { erledigt: { 81000002: ['tot'] }, stand: new Set(Object.keys(OFFEN).map(url)), wartet: new Set(['81000002']) }
  pruefe('im Briefkasten gedeckt (wartet): nicht wieder vorgelegt', !folge(z).includes('81000002'))
}
{
  const z = { erledigt: { 81000001: ['tot'] }, stand: null }
  pruefe('ohne Worker-Stand bleibt der Tot-Vermerk Rückfall: nicht vorgelegt', !folge(z).includes('81000001'))
}

console.log('\nNetflix: Diagnosebericht nennt die Ausschlussgründe')
{
  const t = { ...OFFEN, 81000004: { titel: 'Ohne offene Staffel', staffeln: [{ nr: 1, offen: false }] } }
  const stand = new Set(Object.keys(t).map(url))
  const w = { erledigt: { 81000001: ['tot'], 81000002: ['tot'], 81000009: ['tot'] }, hier: '81000003', uebersprungen: { has: (id) => id === '81000004' }, bremse: { ausgeschlossen: () => false }, nichtDa: { besetzt: () => false } }
  const fertig = (id) => !stand.has(url(id)) || id === '81000002'
  const r = kontext.akNetflixBericht.ausgelassen(t, fertig, w)
  pruefe('tot zählt die Vermerke der Listentitel (2; der fremde 81000009 nicht)', r.tot === 2, r)
  pruefe('totUndOffen zählt nur die, die der Bestand offen führt (1)', r.totUndOffen === 1, r)
  pruefe('aktuell 1, zurückgestellt 1, wirdVorgelegt 1', r.gruende.aktuell === 1 && r.gruende.zurueckgestellt === 1 && r.gruende.wirdVorgelegt === 1, r.gruende)
  pruefe('Verdrahtung: der Diagnosebericht ruft ausgelassen mit dem Speicher auf', /ausgelassen: akNetflixBericht\.ausgelassen\(offeneTitel, fertig, \{ erledigt,/.test(melder))
}

console.log(fehler.length ? `\n${fehler.length} Zusicherung(en) rot` : '\nNetflix Tot-Vermerk: alle Zusicherungen grün')
process.exit(fehler.length ? 1 : 0)
