/**
 * Netflix-Durchgang: zurückgestellte Titel zählen nicht als offen (F135 C, Daniel 14.11.2026).
 *
 * Geprüft: Zähler und Auswahl auf einem nachgestellten Bestand (3 offen, 2 mit Termin morgen, 1 mit Erinnern-Datum heute),
 * die Stundenregel am Erinnern-Tag (Grenze genau 1 h, Wiederholung, Tageswechsel Berlin, Gegenfall morgen) und die
 * Verdrahtung in `melder.js` (echte `offeneTitelZahl`, `nichtOffen`, `laufStarten`).
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

console.log('Netflix: zurückgestellt und offen getrennt')

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js', 'netflix-uebernahme.js', 'netflix-bericht.js']) vm.runInContext(lies(datei), kontext)

const SCHLUESSEL = 'netflixZurueckgestellt'
const MINUTE = 60 * 1000
const STUNDE = 60 * MINUTE
const TAG = 24 * STUNDE
/* 15.10.2026, 10:00 Berlin (Sommerzeit). */
const ZEHN = Date.UTC(2026, 9, 15, 8, 0)

const speicherNeu = (start = {}) => {
  const daten = { ...start }
  const kopie = (x) => JSON.parse(JSON.stringify(x))
  return {
    daten,
    get: async (k) => (k in daten ? { [k]: kopie(daten[k]) } : {}),
    set: async (o) => void Object.assign(daten, kopie(o)),
  }
}
const stand = (speicher) => speicher.daten[SCHLUESSEL] ?? {}

/** Ein Seitenaufruf zur Uhrzeit `jetzt`: neue Merkliste über demselben Speicher, `datum` = was die Seite zeigt. */
const seite = async (speicher, jetzt, o = {}) => {
  const titel = {}
  for (const k of o.titel ?? ['1', '2', '3', '4', '5', '6']) titel[k] = {}
  const karte = kontext.akNetflixZurueckNeu(titel, o.fertig ?? (() => false), { speicher, jetzt: () => jetzt, datum: () => o.datum ?? null })
  await karte.geladen()
  return { karte, titel }
}

/** Offene Titel der Prüfliste wie in `melder.js`: weder fertig noch zurückgestellt. */
const offene = (s) => kontext.akNetflixBericht.offene(s.titel, (id) => s.karte.zurueckgestellt(id)).map((x) => x.reihe)

/** Der Bestand aus dem Auftrag: 1–3 offen, 4–5 mit Termin morgen (16. Oktober), 6 mit Erinnern-Datum heute (15. Oktober). */
async function bestand() {
  const s = speicherNeu()
  const a = await seite(s, ZEHN, { datum: '16. Oktober' })
  a.karte.set('4', 'Erinnern statt Folgenliste')
  a.karte.set('5', 'Erinnern statt Folgenliste')
  await a.karte.geladen()
  const b = await seite(s, ZEHN, { datum: '15. Oktober' })
  b.karte.set('6', 'Erinnern statt Folgenliste')
  await b.karte.geladen()
  return s
}

async function zaehlerUndAuswahl() {
  const s = await bestand()
  const um10 = await seite(s, ZEHN)
  pruefe('10:00: offen sind 1, 2, 3 (Zähler 3)', offene(um10).join() === '1,2,3', offene(um10))
  pruefe('10:00: zurückgestellt sind 4, 5, 6 (Zahl 3)', um10.karte.zurueckZahl() === 3, um10.karte.zurueckZahl())
  pruefe('10:00: „alle durchgehen“ (has) überspringt 4, 5, 6 und nimmt 1, 2, 3', ['1', '2', '3', '4', '5', '6'].filter((k) => !um10.karte.has(k)).join() === '1,2,3')
  const um1105 = await seite(s, ZEHN + 65 * MINUTE)
  pruefe('11:05: Titel 6 (Erinnern-Datum heute, 1 h um) ist wieder offen, 4 und 5 bleiben zurück', offene(um1105).join() === '1,2,3,6' && um1105.karte.zurueckZahl() === 2, offene(um1105))
  pruefe('11:05: „alle durchgehen“ nimmt jetzt 1, 2, 3, 6', ['1', '2', '3', '4', '5', '6'].filter((k) => !um1105.karte.has(k)).join() === '1,2,3,6')
  const uebermorgen = await seite(s, ZEHN + 2 * TAG)
  pruefe('Termin erreicht (übermorgen): alle sechs offen, nichts zurückgestellt', offene(uebermorgen).length === 6 && uebermorgen.karte.zurueckZahl() === 0)
  const fertig = await seite(await bestand(), ZEHN, { fertig: (k) => k === '4' })
  pruefe('ein gemeldeter Titel (4) zählt weder offen noch zurückgestellt', !fertig.karte.zurueckgestellt('4') && fertig.karte.zurueckZahl() === 2, fertig.karte.zurueckZahl())
  const ungelistet = await seite(await bestand(), ZEHN, { titel: ['1', '2', '3', '4'] })
  pruefe('Einträge außerhalb der Prüfliste (5, 6) zählen nicht mit: nur Titel 4', ungelistet.karte.zurueckZahl() === 1, ungelistet.karte.zurueckZahl())
}

async function stundenregel() {
  const s = speicherNeu()
  const a = await seite(s, ZEHN, { datum: '15. Oktober' })
  a.karte.set('1', 'Erinnern statt Folgenliste')
  await a.karte.geladen()
  pruefe('Erinnern-Datum heute: genau 1 Stunde zurückgestellt', stand(s)['1']?.bis === ZEHN + STUNDE, stand(s))
  pruefe('… 1 Minute vor Ablauf noch zurückgestellt', (await seite(s, ZEHN + STUNDE - MINUTE)).karte.zurueckgestellt('1') === true)
  pruefe('… genau nach 1 Stunde wieder offen', (await seite(s, ZEHN + STUNDE)).karte.zurueckgestellt('1') === false)
  await new Promise((fertig) => setImmediate(fertig))
  pruefe('… und der abgelaufene Eintrag ist aus dem Speicher', !stand(s)['1'], stand(s))

  /* Kreislauf: Erinnern steht weiter → nach jeder Stunde wieder offen, wieder 1 Stunde, so oft nötig. */
  const k = speicherNeu()
  let jetzt = ZEHN
  for (let runde = 1; runde <= 3; runde++) {
    const lauf = await seite(k, jetzt, { datum: '15. Oktober' })
    pruefe(`Runde ${runde}: Titel ist offen`, lauf.karte.zurueckgestellt('1') === false)
    lauf.karte.set('1', 'Erinnern statt Folgenliste')
    await lauf.karte.geladen()
    pruefe(`Runde ${runde}: bis eine Stunde später`, stand(k)['1']?.bis === jetzt + STUNDE, stand(k))
    pruefe(`Runde ${runde}: im selben Lauf zählt er schon als zurückgestellt (Zahl 1)`, lauf.karte.zurueckZahl() === 1, lauf.karte.zurueckZahl())
    jetzt += STUNDE + 5 * MINUTE
  }

  /* Gegenfall: Erinnern-Datum morgen → keine Stundenregel, bis zum Beginn von morgen. */
  const m = speicherNeu()
  const morgen = await seite(m, ZEHN, { datum: '16. Oktober' })
  morgen.karte.set('1', 'Erinnern statt Folgenliste')
  await morgen.karte.geladen()
  pruefe('Erinnern-Datum morgen: bis morgen 00:00 Berlin (15.10. 22:00 UTC), nicht 1 Stunde', stand(m)['1']?.bis === Date.UTC(2026, 9, 15, 22), stand(m))
  const spaet = await seite(m, ZEHN + 5 * STUNDE)
  pruefe('… um 15:00 weiter zurückgestellt', spaet.karte.zurueckgestellt('1') === true)

  /* Andere Gründe behalten ihre Frist: kein Erinnern-Datum heute → keine Stundenregel. */
  const g = speicherNeu()
  const andere = await seite(g, ZEHN, { datum: '15. Oktober' })
  andere.karte.set('1', 'keine Folgenliste in 20 s')
  await andere.karte.geladen()
  pruefe('anderer Grund, Datum heute: weiter 1 Tag', stand(g)['1']?.bis === ZEHN + TAG, stand(g))
}

async function tageswechsel() {
  /* 23:30 Berlin am 15.10. (21:30 UTC): „15. Oktober“ ist heute → 1 Stunde, endet nach Mitternacht. */
  const abends = Date.UTC(2026, 9, 15, 21, 30)
  const s = speicherNeu()
  const a = await seite(s, abends, { datum: '15. Oktober' })
  a.karte.set('1', 'Erinnern statt Folgenliste')
  await a.karte.geladen()
  pruefe('23:30 Berlin, Datum heute: 1 Stunde', stand(s)['1']?.bis === abends + STUNDE, stand(s))
  const nachts = abends + STUNDE
  const b = await seite(s, nachts, { datum: '15. Oktober' })
  pruefe('00:30 am 16.10.: offen', b.karte.zurueckgestellt('1') === false)
  b.karte.set('1', 'Erinnern statt Folgenliste')
  await b.karte.geladen()
  pruefe('00:30 am 16.10., Seite nennt noch „15. Oktober“: gestern, unlesbar, 7 Tage', stand(s)['1']?.bis === nachts + 7 * TAG, stand(s))
}

function kopfText() {
  const t = kontext.akNetflixKopfText
  pruefe('Kopf: 3 offen', t(3) === '3 Titel zu prüfen', t(3))
  pruefe('Kopf: 1 offen', t(1) === '1 Titel zu prüfen', t(1))
  pruefe('Kopf: 0 offen', t(0) === 'Alles geprüft', t(0))
}

/** Der Text einer Funktion aus melder.js (von „function name“ bis zur schließenden Klammer am Zeilenanfang). */
const funktionText = (kopf) => {
  const melder = lies('melder.js')
  const von = melder.indexOf(kopf)
  if (von < 0) throw new Error(`nicht gefunden: ${kopf}`)
  return melder.slice(von, melder.indexOf('\n}\n', von) + 2)
}

async function verdrahtung() {
  const s = await bestand()
  const lauf = await seite(s, ZEHN)
  const offeneTitel = lauf.titel
  const zahl = async (fertig) => {
    const karte = (await seite(await bestand(), ZEHN, { fertig })).karte
    return new Function('offeneTitel', 'selbstUebersprungen', `${funktionText('function offeneTitelZahl()')}\nreturn offeneTitelZahl()`)(offeneTitel, karte)
  }
  pruefe('melder.js: offeneTitelZahl zählt 3 (6 Titel, 3 zurückgestellt)', (await zahl(() => false)) === 3, await zahl(() => false))
  pruefe('… ein gemeldeter offener Titel zählt auch nicht: 2', (await zahl((id) => id === '1')) === 2)

  /* „alle durchgehen“ auf der Seite eines zurückgestellten Titels beginnt nicht dort, sondern beim nächsten offenen Auftrag. */
  const start = (reihe) => {
    const gestartet = []
    const ok = new Function(
      'titelDerAdresse', 'gemeinteReihe', 'offeneTitel', 'naechsterAuftrag', 'bremse', 'selbstUebersprungen', 'selbstStaffelnGeprueft', 'selbstGesammelt', 'selbstVersuche', 'fertigeTitel', 'durchgangEndeZeigen', 'sessionStorage', 'LAUF_SCHLUESSEL', 'Date', 'dialogSchliessen', 'vielleichtSelbstStarten', 'selbstWeiter', 'akNetflixZaehlerSetze', 'akNetflixBericht',
      `let selbstAn = false, selbstGezaehlt = 9, selbstGrenze = null, selbstVersucht = 'x', selbstSammelStand = 1, durchgangEnde = 1\n${funktionText('function laufStarten()')}\nreturn laufStarten()`,
    )(
      () => '/title/' + reihe, () => reihe, offeneTitel, () => '1', { zuruecksetzen() {} }, Object.assign(lauf.karte, { clear() {} }), { clear() {} }, { clear() {} }, { clear() {} }, { clear() {} }, () => {}, { setItem() {} }, 'k', Date,
      () => {}, () => gestartet.push('hier'), () => gestartet.push('weiter'), (g, n) => gestartet.push(`${g}/${n}`), kontext.akNetflixBericht,
    )
    return { ok, gestartet }
  }
  let r = start('2')
  pruefe('Seite eines offenen Titels: Durchgang beginnt dort, Nenner 3', r.ok === true && r.gestartet.join() === '0/3,hier', r)
  r = start('4')
  pruefe('Seite eines zurückgestellten Titels: Durchgang springt zum nächsten offenen, Nenner 3', r.ok === true && r.gestartet.join() === '0/3,weiter', r)
}

async function geaendertMeldung() {
  /* `geaendert()` ist der Draht zu den Zählern der Prüfliste (melder.js übergibt `uebersichtZeigen`): nach dem Laden und nach jedem Schreiben. */
  let n = 0
  const karte = kontext.akNetflixZurueckNeu({ 1: {} }, () => false, { speicher: speicherNeu(), jetzt: () => ZEHN, datum: () => null, geaendert: () => n++ })
  await karte.geladen()
  pruefe('geaendert: nach dem Laden einmal', n === 1, n)
  karte.set('1', 'keine Folgenliste in 20 s')
  await karte.geladen()
  pruefe('geaendert: nach dem Schreiben noch einmal (2)', n === 2, n)
}

/** Jede Änderung der Merkliste steht im Zustandsprotokoll (4071, Schnitt 3): Art, Titel, bei „gesetzt“ Grund und Ablauf. */
async function protokoll() {
  const eintraege = []
  kontext.akProtokoll = (art, daten) => eintraege.push({ art, ...daten })
  const s = speicherNeu()
  const a = await seite(s, ZEHN, { datum: '16. Oktober' })
  a.karte.set('4', 'Erinnern statt Folgenliste')
  a.karte.set('5', 'keine Folgenliste')
  await a.karte.geladen()
  a.karte.set('5', 'fertig')
  await a.karte.geladen()
  const kurz = (e) => e.filter((x) => x.art === 'merkliste').map((x) => `${x.aenderung}:${x.kennung}`)
  pruefe('Protokoll: zwei Zurückstellungen und ein Entfernen stehen als „merkliste“-Ereignisse da', kurz(eintraege).join() === 'gesetzt:4,gesetzt:5,entfernt:5', kurz(eintraege))
  pruefe('Protokoll: „gesetzt“ trägt Grund und Ablauf', eintraege[0]?.grund === 'Erinnern statt Folgenliste' && eintraege[0]?.bis > ZEHN, eintraege[0])
  eintraege.length = 0
  const spaeter = await seite(s, ZEHN + 2 * TAG)
  await spaeter.karte.geladen()
  pruefe('Protokoll: ein abgelaufener Eintrag steht als „abgelaufen“ da', kurz(eintraege).join() === 'abgelaufen:4', kurz(eintraege))
  delete kontext.akProtokoll
}

async function haupt() {
  await zaehlerUndAuswahl()
  await stundenregel()
  await tageswechsel()
  kopfText()
  await geaendertMeldung()
  await verdrahtung()
  await protokoll()
  console.log('')
  if (fehler.length) {
    console.log(`${fehler.length} Prüfung(en) fehlgeschlagen`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zu zurückgestellt und offen halten.')
}

haupt().catch((e) => {
  console.error(e)
  process.exit(1)
})
