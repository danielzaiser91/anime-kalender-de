/**
 * Netflix-Prüfliste: eine Zurückstellung überlebt das volle Laden eines Titels (Daniel 18.11.2026, Erweiterung 4.32.157:
 * „4 Titel zu prüfen + 2 zurückgestellt“, nach dem Wechsel auf eine andere Titelseite „6 Titel zu prüfen“, und AnoHana,
 * Banana Fish, Pokémon, Yu-Gi-Oh! standen nach „alle durchgehen“ wieder auf der Liste).
 *
 * Ursache (Zustandsprotokoll des Berichts: je `fremd-gesetzt` ein `fremd-entfernt` 4–5 s vor dem nächsten Titel): Beim Laden
 * einer Seite gilt `fertig()` zuerst nach dem lokalen Rückfall (Tot-Vermerk, abgehakter Film), weil der Worker-Stand erst
 * später eintrifft (`standZieleNetflix`). `aktiv()` löschte die Zurückstellung deshalb als „fertig“, und der Stand führte
 * den Titel danach doch wieder offen. Jetzt löscht „fertig“ nur auf Antwort des Worker-Stands (`standDa`).
 * Kulisse: drei Seitenaufrufe über einen gemeinsamen Speicher; Kennungen und Fälle aus dem Bericht vom 18.11.2026.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')
const { speicherNeu, zurueckStart, stand } = require('./test-zurueck-speicher.cjs')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const lies = (datei) => readFileSync(resolve(__dirname, datei), 'utf8')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) vm.runInContext(lies(datei), kontext)

console.log('Netflix: Zurückstellung überlebt das Laden, bis der Worker-Stand antwortet')

const JETZT = Date.UTC(2026, 10, 18, 7, 30)
const TAG = 24 * 3600 * 1000
/* Bericht: Yu-Gi-Oh! (Tot-Vermerk, Stand führt es offen), Fan Letter (lokal als „Film“ gemeldet, Stand: erneut), Banana Fish (ab 19. November). */
const TITEL = { 70177034: {}, 81947352: {}, 81218604: {}, 12345: {} }
const LOKAL_FERTIG = new Set(['70177034', '81947352', '81218604'])

/** Ein Seitenaufruf: neue Merkliste über denselben Speicher; `fertig` = lokaler Rückfall, solange der Stand fehlt. */
const seitenaufruf = async (speicher, o = {}) => {
  const zustand = { standDa: false }
  const fertig = (k) => (zustand.standDa ? o.stand?.has(String(k)) !== true : LOKAL_FERTIG.has(String(k)))
  const roh = { speicher, jetzt: () => JETZT, datum: () => null }
  if (o.mitStandDa !== false) roh.standDa = () => zustand.standDa
  const karte = kontext.akNetflixZurueckNeu(TITEL, fertig, roh)
  await karte.geladen()
  return { karte, zustand }
}

async function lauf() {
  const bis = JETZT + 7 * TAG
  const speicher = speicherNeu(zurueckStart({
    70177034: { grund: 'Erinnern statt Folgenliste', bis, am: JETZT },
    81947352: { grund: 'Film im Player gescheitert', bis, am: JETZT },
    81218604: { grund: 'Erinnern statt Folgenliste', bis, am: JETZT },
  }))
  const offen = new Set(['70177034', '81947352', '81218604'])

  for (let i = 1; i <= 3; i++) {
    const { karte, zustand } = await seitenaufruf(speicher, { stand: offen })
    pruefe(`Seitenaufruf ${i}, Stand fehlt noch: alle drei bleiben im Speicher`, Object.keys(stand(speicher)).length === 3, Object.keys(stand(speicher)))
    pruefe(`Seitenaufruf ${i}, Stand fehlt noch: nichts davon zählt als offen`, ['70177034', '81947352', '81218604'].every((k) => karte.nichtOffen(k)))
    zustand.standDa = true
    pruefe(`Seitenaufruf ${i}, Stand da und führt sie offen: Zurückstellung gilt weiter`, karte.zurueckZahl() === 3 && Object.keys(stand(speicher)).length === 3, karte.zurueckZahl())
  }

  /* Antwortet der Stand, der Titel sei nicht mehr Ziel (fertig), geht die Zurückstellung — das bleibt so. */
  const { karte, zustand } = await seitenaufruf(speicher, { stand: new Set(['70177034', '81218604']) })
  zustand.standDa = true
  karte.zurueckgestellt('81947352')
  await karte.geladen()
  pruefe('Stand sagt „fertig“: die Zurückstellung geht', !stand(speicher)['81947352'] && Boolean(stand(speicher)['70177034']), Object.keys(stand(speicher)))

  /* Abgelaufenes geht auch ohne Stand, auch genau zum Ablaufzeitpunkt; eine Millisekunde davor gilt noch. */
  const alt = speicherNeu(zurueckStart({ 12345: { grund: 'x', bis: JETZT - 1 } }))
  await seitenaufruf(alt, { stand: new Set() })
  pruefe('abgelaufen: geht auch ohne Worker-Stand', Object.keys(stand(alt)).length === 0, stand(alt))
  const genau = speicherNeu(zurueckStart({ 12345: { grund: 'x', bis: JETZT } }))
  await seitenaufruf(genau, { stand: new Set() })
  pruefe('Ablaufzeitpunkt genau jetzt: abgelaufen', Object.keys(stand(genau)).length === 0, stand(genau))
  const knapp = speicherNeu(zurueckStart({ 12345: { grund: 'x', bis: JETZT + 1 } }))
  await seitenaufruf(knapp, { stand: new Set() })
  pruefe('eine Millisekunde vor dem Ablauf: gilt noch', Object.keys(stand(knapp)).length === 1, stand(knapp))

  /* Ohne `standDa` (Tests, Aufrufer ohne Stand) gilt wie bisher: „fertig“ löscht sofort. */
  const ohne = speicherNeu(zurueckStart({ 70177034: { grund: 'x', bis } }))
  await seitenaufruf(ohne, { mitStandDa: false, stand: offen })
  pruefe('ohne `standDa`: wie bisher — „fertig“ löscht', Object.keys(stand(ohne)).length === 0, stand(ohne))
}

/** Die Verdrahtung am echten Aufrufort: die Anweisung aus `melder.js` läuft mit Attrappen für Stand und Wartemenge. */
async function verdrahtung() {
  const treffer = /const selbstUebersprungen = (akNetflixZurueckNeu\([^\n]*\))\n/.exec(lies('melder.js'))
  pruefe('melder.js: Anweisung der Merkliste gefunden', Boolean(treffer))
  if (!treffer) return
  const speicher = speicherNeu(zurueckStart({ 70177034: { grund: 'x', bis: JETZT + TAG } }))
  const umgebung = { standZieleNetflix: null, akNetflixWartet: null }
  const bauen = new Function(
    'akNetflixZurueckNeu', 'offeneTitel', 'fertig', 'uebersichtZeigen', 'WORKER', 'umgebung', 'speicher', 'jetzt',
    `const lesen = { get standZieleNetflix() { return umgebung.standZieleNetflix }, get akNetflixWartet() { return umgebung.akNetflixWartet } }
     with (lesen) { return ${treffer[1].replace(/\{ geaendert/, '{ speicher, jetzt, geaendert')} }`,
  )
  const karte = bauen(kontext.akNetflixZurueckNeu, TITEL, () => true, () => {}, '', umgebung, speicher, () => JETZT)
  await karte.geladen()
  pruefe('melder.js: ohne Worker-Stand bleibt die Zurückstellung trotz lokalem „fertig“', Boolean(stand(speicher)['70177034']) && karte.zurueckZahl() === 1, stand(speicher))
  umgebung.standZieleNetflix = new Set(['https://www.netflix.com/title/70177034'])
  pruefe('melder.js: Stand da, aber keine Wartemenge: noch kein Löschen', karte.zurueckgestellt('70177034') === true && Boolean(stand(speicher)['70177034']))
  umgebung.akNetflixWartet = new Set()
  karte.zurueckgestellt('70177034')
  await karte.geladen()
  pruefe('melder.js: mit Stand und Wartemenge gilt „fertig“ (hier erzwungen): Zurückstellung geht', karte.zurueckgestellt('70177034') === false && !stand(speicher)['70177034'], stand(speicher))
}

lauf()
  .then(verdrahtung)
  .then(() => {
    console.log(fehler.length ? `\n${fehler.length} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
    process.exit(fehler.length ? 1 : 0)
  })
