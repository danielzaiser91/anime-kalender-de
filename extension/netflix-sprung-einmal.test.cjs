/**
 * **Jeder Titel bekommt je Durchgang einen Sprung, und die Spur überlebt das Neuladen** (Daniel, 18.11.2026).
 *
 * Bericht 4.32.158, Prüfliste „alle durchgehen": „der selbe titel wird mehrmals durchgegangen". AnoHana (`80075178`) lud um 08:40:14 und
 * 08:41:20 (66 s ohne Entscheidung dazwischen), der Bericht kannte nur zwei Spur-Einträge: `DURCHGANG_SPUR` lag im Arbeitsspeicher und ging
 * mit jedem Neuladen verloren. Den Grund des ersten Besuchs belegt der Bericht nicht; die Sperre hält jeden zweiten Sprung auf, gleich warum.
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

console.log('Netflix: ein Sprung je Titel, Spur über Neuladen')

const speicherNeu = () => {
  const d = {}
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v) }, removeItem: (k) => { delete d[k] } }
}
/** Ein „Dokument": frischer Kontext mit den echten Dateien, aber geteiltem `sessionStorage`. */
const dokument = (speicher) => {
  const k = { globalThis: null, console, sessionStorage: speicher }
  k.globalThis = k
  vm.createContext(k)
  for (const d of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js']) vm.runInContext(lies(d), k)
  return k
}

const s = speicherNeu()
const d1 = dokument(s)
d1.akNetflixSpurMerken({ zeit: 't1', was: 'Erinnern: Seite wird zur Bestätigung voll geladen', reihe: '80075178' })
const d2 = dokument(s)
d2.akNetflixSpurMerken({ zeit: 't2', was: 'Erinnern-Knopf ohne Datum', reihe: '80075178' })
const spur = d2.akNetflixSpurLesen([{ was: 'nur Arbeitsspeicher' }])
pruefe('Spur: nach dem Neuladen stehen die Einträge des vorigen Dokuments noch da (2 Einträge)', spur.length === 2 && spur[0].was.startsWith('Erinnern: Seite') && spur[1].zeit === 't2', spur)
pruefe('Spur: jedes Dokument trägt seine Kennung `dok` (Neuladegrenze lesbar)', spur[0].dok && spur[1].dok && spur[0].dok !== spur[1].dok, spur.map((e) => e.dok))
pruefe('Spur: ohne Speicher der Rückfall (Arbeitsspeicher)', d2.akNetflixSpurLesen([{ was: 'nur Arbeitsspeicher' }], speicherNeu())[0].was === 'nur Arbeitsspeicher')
for (let i = 0; i < 70; i++) d2.akNetflixSpurMerken({ zeit: `n${i}` })
const voll = d2.akNetflixSpurLesen([])
pruefe('Spur: höchstens 60 Einträge, die neuesten bleiben', voll.length === 60 && voll[59].zeit === 'n69' && voll[0].zeit === 'n10', [voll.length, voll[0]?.zeit, voll[59]?.zeit])
pruefe('Spur: ein Speicher, der wirft, bricht nichts ab', (() => { try { d2.akNetflixSpurMerken({ was: 'x' }, { getItem: () => { throw new Error('kaputt') }, setItem: () => { throw new Error('kaputt') } }); return true } catch { return false } })())

/* Sprungziele: der Sprung des Durchgangs merkt sie (über `akNetflixZaehlerSetze`), Laufbeginn und Bremse-Pause leeren. */
const sp = speicherNeu()
const d = dokument(sp)
const gebucht = new Map()
const spuren = []
const wiederholt = (k) => d.akNetflixSprungWiederholt(k, gebucht, (was, dazu) => spuren.push([was, dazu]), sp)
d.akNetflixZaehlerSetze(0, 3, sp, 'AnoHana', true, '80075178')
pruefe('Laufbeginn: der Starttitel zählt nicht als Sprung (er steht schon auf der Seite)', wiederholt('80075178') === false)
d.akNetflixZaehlerSetze(1, 3, sp, 'Yu-Gi-Oh!', false, '70177034')
pruefe('erster Sprung zu einem Titel: erlaubt', wiederholt('80186475') === false && gebucht.size === 0, [...gebucht])
pruefe('zweiter Sprung zu Yu-Gi-Oh!: verweigert, mit Grund zurückgestellt und in der Spur', wiederholt('70177034') === true && gebucht.get('70177034') === 'zweiter Sprung im selben Durchgang vermieden' && spuren.length === 1 && spuren[0][1].reihe === '70177034', [[...gebucht], spuren])
pruefe('ein anderer Titel bleibt davon unberührt (Nachbarn-Fall)', wiederholt('81218604') === false && gebucht.size === 1)
d.akNetflixGesprungenLeeren(sp)
pruefe('Ende einer Bremse-Pause: der Titel darf wieder angesprungen werden', wiederholt('70177034') === false && gebucht.size === 1)
d.akNetflixZaehlerSetze(2, 3, sp, 'Pokémon', false, '80186475')
d.akNetflixZaehlerSetze(0, 3, sp, 'neuer Lauf', true, '1')
pruefe('neuer Durchgang (Zähler 0): alles vergessen', wiederholt('80186475') === false)
pruefe('ohne Kennung: kein Urteil', wiederholt(null) === false && wiederholt(undefined) === false)

/* Verdrahtung in `selbstWeiter`: der Sprung geht nicht an einen Titel, den der Durchgang schon angesprungen hat. */
const melder = lies('melder.js')
const fn = (name) => {
  const von = melder.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}
function weiterKulisse() {
  const sw = speicherNeu()
  const k = dokument(sw)
  const w = { gesprungen: [], beendet: null, spur: [] }
  Object.assign(k, {
    Date,
    Math,
    String,
    verbindungLebt: () => true,
    selbstGezaehlt: 1,
    selbstGrenze: 3,
    selbstUebersprungen: new Map(),
    bremse: { pause: () => null, offen: () => 0 },
    akNetflixBericht: { offene: () => [1, 2, 3] },
    offeneTitel: { 101: { titel: 'Eins' }, 102: { titel: 'Zwei' }, 103: { titel: 'Drei' } },
    LAUF_SCHLUESSEL: 'x',
    LAUF_HOECHSTENS_MS: 1e9,
    akDurchgangSchutz: () => null,
    laufBeenden: (g) => { w.beendet = g },
    spur: (was) => w.spur.push(was),
    titelBericht: { beginn() {} },
    speicherSchreiben: async () => {},
    zuletztGeoeffnet: null,
    meinTab: 't',
    akNetflixEigenerSprungMerken: (x) => x,
    nichtDaTun: { sprung: (id) => w.gesprungen.push(id) },
    /* Die Wahl wie in `naechsterAuftrag`: erster Titel, der nicht übersprungen ist. */
    naechsterAuftrag: () => ['101', '102', '103'].find((id) => !k.selbstUebersprungen.has(id)) ?? null,
    console: { log() {} },
  })
  vm.runInContext(fn('selbstWeiter'), k)
  return { k, w, sw }
}
{
  const { k, w } = weiterKulisse()
  k.selbstWeiter()
  pruefe('selbstWeiter: erster Sprung geht zu 101', w.gesprungen.join() === '101', w.gesprungen)
  /* 101 blieb unverbucht (kein Urteil, kein „fertig“) und die Wahl liefert ihn wieder. */
  k.selbstWeiter()
  pruefe('selbstWeiter: 101 ist unverbucht und käme wieder — der zweite Sprung geht an 102, 101 steht mit Grund da', w.gesprungen.join() === '101,102' && k.selbstUebersprungen.get('101') === 'zweiter Sprung im selben Durchgang vermieden', [w.gesprungen, [...k.selbstUebersprungen]])
  pruefe('selbstWeiter: die Sperre steht in der Spur', w.spur.includes('Titel schon angesprungen, kein zweiter Sprung'), w.spur)
}
{
  const { k, w } = weiterKulisse()
  k.selbstWeiter()
  k.selbstWeiter(2)
  pruefe('selbstWeiter mit `frei` (Bremse-Pause zu Ende): derselbe Titel darf wieder angesprungen werden', w.gesprungen.join() === '101,101', w.gesprungen)
}

/* Verdrahtung in `spur()` und im Bericht: jeder Eintrag landet im Speicher, der Bericht liest ihn von dort. */
{
  const sw = speicherNeu()
  const k = dokument(sw)
  Object.assign(k, { Date, DURCHGANG_SPUR: [] })
  vm.runInContext(fn('spur'), k)
  k.spur('Erinnern-Knopf ohne Datum', { reihe: '1' })
  const gespeichert = k.akNetflixLaufLesen(sw, 'ak-netflix-spur')
  pruefe('spur(): der Eintrag steht im sessionStorage, nicht nur im Arbeitsspeicher', gespeichert.length === 1 && gespeichert[0].was === 'Erinnern-Knopf ohne Datum' && gespeichert[0].reihe === '1', gespeichert)
  pruefe('Bericht: `durchgang.spur` liest akNetflixSpurLesen', /spur: akNetflixSpurLesen\(DURCHGANG_SPUR\)/.test(melder))
}

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zu Sprung und Spur halten.')
