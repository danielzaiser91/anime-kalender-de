/**
 * **Erinnern-Knopf: Grund und „zurück bis" kommen aus einer Messung** (Daniel, 18.11.2026).
 *
 * Bericht 4.32.158, Prüfliste „alle durchgehen" mit sechs Titeln: Banana Fish stand mit „19.11." und „Erinnern statt Folgenliste",
 * vier andere mit „25.11." und demselben Grund, One Piece Fan Letter mit „19.11." und „keine Folgenliste in 20 s". Daniel:
 * „wenn Netflix ein Datum nennt, muss das auch der Grund sein; das ‚statt' weglassen: ‚Erinnern-Knopf ohne/mit Datum'."
 * Der Bericht sagte am Ende „NICHTS GEMESSEN", obwohl alle sechs Titel eine Auskunft hatten (Erinnern-Knopf).
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

console.log('Netflix: Erinnern-Knopf, Grund und Frist')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const d of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js', 'netflix-uebernahme.js']) vm.runInContext(lies(d), kontext)

const { speicherNeu, stand } = require('./test-zurueck-speicher.cjs')
const TAG = 24 * 3600 * 1000
/* 18.11.2026, 10:00 Berlin (Winterzeit, UTC+1). */
const JETZT = Date.UTC(2026, 10, 18, 9, 0)
const ruhe = () => new Promise((fertig) => setImmediate(fertig))

const grund = kontext.akNetflixErinnernGrund
pruefe('Grund mit Datum nennt das Datum kurz (Netflix: „19. November")', grund('19. November') === 'Erinnern-Knopf mit Datum (19.11.)', grund('19. November'))
pruefe('Grund mit Datum: „3. Dez. 2026" → 3.12.', grund('3. Dez. 2026') === 'Erinnern-Knopf mit Datum (3.12.)', grund('3. Dez. 2026'))
pruefe('Grund ohne Datum (null)', grund(null) === 'Erinnern-Knopf ohne Datum', grund(null))
pruefe('Grund ohne lesbares Datum („Bald")', grund('Bald') === 'Erinnern-Knopf ohne Datum', grund('Bald'))
pruefe('Grund ohne Wort „statt"', !/statt/.test(grund('19. November')) && !/statt/.test(grund(null)))

/* Die Wartefunktion, wie sie im Durchgang läuft: das Datum steht im Grund der Zurückstellung. */
const warte = kontext.akNetflixListeWarten
const erinnernBeschlossen = (datum) => {
  const uebersprungen = new Map()
  const tun = { spur: () => {}, uebersprungen, weiter: () => {} }
  warte({ seite: '81218604', seit: 1_000_000 }, { seite: '81218604', reihe: '81218604', erinnern: true, datum: () => datum, durchlauf: { folgen: [] }, jetzt: 1_005_000, frist: 20000 }, tun)
  return uebersprungen.get('81218604')
}
pruefe('Durchgang: Banana Fish (Datum 19. November) → Grund mit Datum', erinnernBeschlossen('19. November') === 'Erinnern-Knopf mit Datum (19.11.)', erinnernBeschlossen('19. November'))
pruefe('Durchgang: Yu-Gi-Oh! (kein Datum) → Grund ohne Datum', erinnernBeschlossen(null) === 'Erinnern-Knopf ohne Datum', erinnernBeschlossen(null))

async function frist(g, datumVonSeite) {
  const speicher = speicherNeu()
  const karte = kontext.akNetflixZurueckNeu({ 1: {} }, () => false, { speicher, jetzt: () => JETZT, datum: () => datumVonSeite })
  await ruhe()
  karte.set('1', g)
  await ruhe()
  return stand(speicher)['1']
}

async function haupt() {
  const mit = await frist('Erinnern-Knopf mit Datum (19.11.)', null)
  pruefe('mit Datum: „zurück bis" ist der 19.11. 00:00 Berlin (= 18.11. 23:00 UTC), nicht 25.11.', mit?.bis === Date.UTC(2026, 10, 18, 23, 0), mit)
  const ohne = await frist('Erinnern-Knopf ohne Datum', '19. November')
  pruefe('ohne Datum: eine Woche, auch wenn die Seite danach ein Datum zeigt (nie ein zweites Mal lesen)', ohne?.bis === JETZT + 7 * TAG, ohne)
  const alt = await frist('Erinnern statt Folgenliste', '20. November')
  pruefe('alter Grund aus dem Speicher: liest das Datum der Seite wie bisher', alt?.bis === Date.UTC(2026, 10, 19, 23, 0), alt)
  const heute = await frist('Erinnern-Knopf mit Datum (18.11.)', null)
  pruefe('Datum = heute: nur eine Stunde (F135 bleibt)', heute?.bis === JETZT + 3600 * 1000, heute)
  const vorbei = await frist('Erinnern-Knopf mit Datum (3.11.)', null)
  pruefe('vergangenes Datum ohne Jahr: unlesbar → eine Woche', vorbei?.bis === JETZT + 7 * TAG, vorbei)
  const weit = await frist('Erinnern-Knopf mit Datum (30.12.)', null)
  pruefe('weit entferntes Datum: höchstens 30 Tage', weit?.bis === JETZT + 30 * TAG, weit)

  /* Ende des Durchgangs: sechs Titel, alle mit Erinnern-Knopf. */
  const gruende = new Map([
    ['80075178', 'Erinnern-Knopf ohne Datum'],
    ['70177034', 'Erinnern-Knopf ohne Datum'],
    ['80186475', 'Erinnern-Knopf ohne Datum'],
    ['81218604', 'Erinnern-Knopf mit Datum (19.11.)'],
    ['81717895', 'Erinnern-Knopf mit Datum (25.11.)'],
    ['81947352', 'Erinnern-Knopf ohne Datum'],
  ])
  const ende = (g, besucht = 6, nichtDa = 0) => kontext.akNetflixEnde('kein offener Auftrag mehr', g, new Set(), besucht, {}, new Set(), null, { size: nichtDa })
  const e = ende(gruende)
  pruefe('sechs Erinnern-Titel, nichts gemessen: KEIN „NICHTS GEMESSEN"', !e.rot && !/NICHTS GEMESSEN/.test(e.text), e.text)
  pruefe('… die Zählung nennt sie als Auskunft', e.zaehlung.uebersprungen === 6 && /Erinnern-Knopf 6 \(zurückgestellt\)/.test(e.text), e.zaehlung)
  pruefe('… die Kopfzeile fasst die Daten zu einer Art zusammen', /4× Erinnern-Knopf ohne Datum, 2× Erinnern-Knopf mit Datum/.test(e.uebersprungenText), e.uebersprungenText)
  const stoerung = ende(new Map([['1', 'Netflix zeigt ihn nicht (E103)'], ['2', 'keine Folgenliste in 20 s'], ['3', 'Titelfenster ohne Inhalt in 8 s']]), 3)
  pruefe('Gegenprobe: Störung, Notausgang und leeres Fenster bleiben „NICHTS GEMESSEN"', stoerung.rot && /NICHTS GEMESSEN/.test(stoerung.text), stoerung.text)
  const nichts = ende(new Map(), 1)
  pruefe('Gegenprobe: besucht 1, nichts übersprungen, nichts gemessen: rot', nichts.rot)
  const nichtDa = ende(new Map([['1', 'Netflix zeigt ihn nicht (E103)']]), 1, 1)
  pruefe('Gegenprobe: ein Urteil „nicht bei Netflix" bleibt eine Auskunft', !nichtDa.rot)

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zu Erinnern-Grund und Frist halten.')
}

haupt()
