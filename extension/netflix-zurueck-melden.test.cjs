/**
 * Netflix-Prüfliste: die Zurückstellungen gehen an den Worker (Daniel 15.11.2026: Laufstatus „160“, Erweiterung „0 zu prüfen“).
 * Geprüft mit festen Uhren und einem gemeinsamen Speicher über mehrere Seitenaufrufe (jeder Titel lädt die Seite neu):
 * Rumpf der Meldung, Abstand von 10 Minuten (Grenze genau, auch nach einem Fehlschlag), Meldung nur bei geänderter Menge,
 * leere Menge nur nach einer früheren Meldung, fehlender Token, Nachhol-Timer (genau einer) und die Verdrahtung über
 * `akNetflixZurueckNeu` (ohne `worker` nie ein Abruf).
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

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
for (const datei of ['netflix-erinnern.js', 'netflix-durchgang-steuerung.js', 'netflix-zurueckgestellt.js']) vm.runInContext(lies(datei), kontext)
const neu = kontext.akNetflixZurueckNeu

console.log('Netflix: Zurückstellungen an den Worker melden')

const MINUTE = 60 * 1000
const TAG = 24 * 60 * MINUTE
const T0 = Date.UTC(2026, 10, 15, 0, 30)
const WORKER = 'https://worker.test/pruefung'
const GEMELDET = 'netflixZurueckGemeldet'

const speicherNeu = (start = {}) => {
  const daten = { ...start }
  const kopie = (x) => JSON.parse(JSON.stringify(x))
  return {
    daten,
    get: async (k) => (k in daten ? { [k]: kopie(daten[k]) } : {}),
    set: async (o) => void Object.assign(daten, kopie(o)),
  }
}
const ruhe = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r))
}

/** Eine Seite: neue Merkliste über dem Speicher; `antwort` = was der Worker sagt (ok, abgelehnt, Netzfehler). */
async function seite(speicher, jetzt, o = {}) {
  const abrufe = []
  const timer = []
  const titel = new Proxy({}, { get: () => ({}) })
  const holen = async (adresse, init) => {
    abrufe.push({ adresse, init, rumpf: JSON.parse(init.body) })
    if (o.netzfehler) throw new Error('offline')
    return { ok: o.ok ?? true }
  }
  const karte = neu(titel, () => false, {
    speicher,
    jetzt: () => jetzt.t,
    datum: () => null,
    worker: o.ohneWorker ? undefined : WORKER,
    token: async () => ('token' in o ? o.token : 'geheim'),
    holen,
    warten: (fn, ms) => timer.push({ fn, ms }),
    geaendert: () => {},
  })
  await karte.geladen()
  await ruhe()
  return { karte, abrufe, timer }
}

const eintrag = (grund, bis) => ({ grund, bis })

async function ersteMeldung() {
  {
    const speicher = speicherNeu({ netflixZurueckgestellt: { 20: eintrag('Erinnern', T0 + 5 * TAG), 3: eintrag('keine Folgenliste', T0 + TAG) } })
    const jetzt = { t: T0 }
    const s = await seite(speicher, jetzt)
    pruefe('erste Seite mit Zurückstellungen: genau eine Meldung', s.abrufe.length === 1, s.abrufe.length)
    const a = s.abrufe[0]
    pruefe('Adresse: Worker mit ?zurueck=1, Methode POST', a?.adresse === `${WORKER}?zurueck=1` && a.init.method === 'POST', a?.adresse)
    pruefe('Kopf: X-Lauf-Token und JSON', a?.init.headers['X-Lauf-Token'] === 'geheim' && a.init.headers['Content-Type'] === 'application/json')
    pruefe('Rumpf: Anbieter netflix, beide Einträge (Reihenfolge der Schlüssel macht JS bei Zahlen selbst)', a?.rumpf.plattform === 'netflix' && Object.keys(a.rumpf.eintraege).join() === '3,20', a?.rumpf)
    pruefe('Rumpf: Grund und Ablauf je Eintrag unverändert', a?.rumpf.eintraege['3'].grund === 'keine Folgenliste' && a.rumpf.eintraege['3'].bis === T0 + TAG)
    pruefe('Speicher merkt Inhalt und Versuchszeit der Meldung', speicher.daten[GEMELDET]?.versuch === T0 && typeof speicher.daten[GEMELDET]?.inhalt === 'string', speicher.daten[GEMELDET])

    jetzt.t = T0 + 20 * MINUTE
    const zweite = await seite(speicher, jetzt)
    pruefe('nächste Seite, gleiche Menge: keine Meldung (Zustand über Seitenaufrufe im Speicher)', zweite.abrufe.length === 0 && zweite.timer.length === 0, zweite.abrufe.length)
  }
}

async function abstand() {
  console.log('Abstand: genau 10 Minuten, auch über Seitenaufrufe')
  {
    const speicher = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } })
    const jetzt = { t: T0 }
    await seite(speicher, jetzt)
    speicher.daten.netflixZurueckgestellt = { 1: eintrag('x', T0 + TAG), 2: eintrag('y', T0 + TAG) }
    jetzt.t = T0 + 10 * MINUTE - 1
    const knapp = await seite(speicher, jetzt)
    pruefe('Menge geändert, 1 ms vor Ablauf des Abstands: keine Meldung', knapp.abrufe.length === 0, knapp.abrufe.length)
    pruefe('… dafür ein Nachhol-Timer mit der Restzeit von genau 1 ms', knapp.timer.length === 1 && knapp.timer[0].ms === 1, knapp.timer.map((t) => t.ms))
    jetzt.t = T0 + 10 * MINUTE
    const genau = await seite(speicher, jetzt)
    pruefe('genau nach 10 Minuten: gemeldet, mit beiden Einträgen', genau.abrufe.length === 1 && Object.keys(genau.abrufe[0].rumpf.eintraege).join() === '1,2', genau.abrufe.length)
  }
}

async function nachholTimer() {
  console.log('Nachhol-Timer: genau einer, danach die Meldung')
  {
    const speicher = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } })
    const jetzt = { t: T0 }
    await seite(speicher, jetzt)
    speicher.daten.netflixZurueckgestellt = { 1: eintrag('x', T0 + TAG), 2: eintrag('y', T0 + TAG) }
    jetzt.t = T0 + 4 * MINUTE
    const s = await seite(speicher, jetzt)
    /* Zwei Änderungen auf derselben Seite: nur ein Timer. */
    s.karte.set('3', 'keine Folgenliste')
    await ruhe()
    pruefe('mehrere Änderungen im Abstand: ein einziger Timer mit 6 Minuten Rest', s.timer.length === 1 && s.timer[0].ms === 6 * MINUTE, s.timer.map((t) => t.ms))
    jetzt.t = T0 + 10 * MINUTE
    s.timer[0].fn()
    await ruhe()
    pruefe('Timer läuft: die Meldung geht mit allen drei Einträgen raus', s.abrufe.length === 1 && Object.keys(s.abrufe[0].rumpf.eintraege).length === 3, s.abrufe.length)
    pruefe('… und der Speicher kennt den neuen Stand (kein Neuversuch auf der nächsten Seite)', (await seite(speicher, { t: T0 + 40 * MINUTE })).abrufe.length === 0)
  }
}

async function fehlschlag() {
  console.log('Fehlschlag: Abstand gilt trotzdem, Inhalt gilt erst nach Erfolg')
  {
    for (const [name, o] of [['Worker lehnt ab (429/503)', { ok: false }], ['Netz weg', { netzfehler: true }]]) {
      const speicher = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } })
      const jetzt = { t: T0 }
      const fehl = await seite(speicher, jetzt, o)
      pruefe(`${name}: ein Versuch`, fehl.abrufe.length === 1)
      pruefe(`${name}: der Inhalt gilt nicht als gemeldet`, speicher.daten[GEMELDET]?.inhalt === undefined && speicher.daten[GEMELDET]?.versuch === T0, speicher.daten[GEMELDET])
      jetzt.t = T0 + MINUTE
      const bald = await seite(speicher, jetzt)
      pruefe(`${name}: eine Minute später kein zweiter Versuch (kein Dauerfeuer bei jedem Seitenaufruf)`, bald.abrufe.length === 0)
      jetzt.t = T0 + 10 * MINUTE
      const spaeter = await seite(speicher, jetzt)
      pruefe(`${name}: nach 10 Minuten der nächste Versuch`, spaeter.abrufe.length === 1)
    }
  }
}

async function leereMenge() {
  console.log('Leere Menge und Abgelaufenes')
  {
    const leer = speicherNeu()
    const a = await seite(leer, { t: T0 })
    pruefe('nie etwas zurückgestellt, nie gemeldet: nichts zu sagen', a.abrufe.length === 0 && leer.daten[GEMELDET] === undefined)
    const jetzt = { t: T0 }
    const speicher = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } })
    await seite(speicher, jetzt)
    speicher.daten.netflixZurueckgestellt = {}
    jetzt.t = T0 + 15 * MINUTE
    const frei = await seite(speicher, jetzt)
    pruefe('alles wieder offen nach einer früheren Meldung: die leere Menge geht raus', frei.abrufe.length === 1 && Object.keys(frei.abrufe[0].rumpf.eintraege).length === 0, frei.abrufe.length)
    const abgelaufen = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0), 2: eintrag('y', T0 - 1), 3: eintrag('z', T0 + 1) } })
    const b = await seite(abgelaufen, { t: T0 })
    pruefe('Abgelaufenes (bis ≤ jetzt) steht nicht im Rumpf, nur Kennung 3', b.abrufe.length === 1 && Object.keys(b.abrufe[0].rumpf.eintraege).join() === '3', b.abrufe[0]?.rumpf)
  }
}

async function ohneTokenUndVerdrahtung() {
  console.log('Ohne Token, ohne Worker, Verdrahtung')
  {
    const speicher = speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } })
    const ohneToken = await seite(speicher, { t: T0 }, { token: undefined })
    pruefe('ohne Token: kein Abruf, kein Fehler, Speicher unberührt', ohneToken.abrufe.length === 0 && speicher.daten[GEMELDET] === undefined)
    const ohneWorker = await seite(speicherNeu({ netflixZurueckgestellt: { 1: eintrag('x', T0 + TAG) } }), { t: T0 }, { ohneWorker: true })
    pruefe('ohne worker-Angabe (Tests, andere Aufrufer): nie ein Abruf', ohneWorker.abrufe.length === 0)
    const s = await seite(speicherNeu(), { t: T0 })
    s.karte.set('7', 'Erinnern 20. November')
    await ruhe()
    pruefe('ein Titel wird im Lauf zurückgestellt (set): die Meldung geht ohne weiteres Neuladen raus', s.abrufe.length === 1 && Object.keys(s.abrufe[0].rumpf.eintraege).join() === '7', s.abrufe.length)
  }

}

async function alleFaelle() {
  await ersteMeldung()
  await abstand()
  await nachholTimer()
  await fehlschlag()
  await leereMenge()
  await ohneTokenUndVerdrahtung()
}

alleFaelle().then(() => {
  console.log(fehler.length ? `\n${fehler.length} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(fehler.length ? 1 : 0)
})
