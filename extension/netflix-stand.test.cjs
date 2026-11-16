/**
 * Netflix: Stand des Briefkastens im Speicher der Erweiterung (#4059, 16.11.2026).
 *
 * Geprüft ohne Netz gegen einen gemeinsamen Attrappen-Speicher: wann ein Abruf fällig ist, dass zwei Tabs einmal holen, dass eine
 * eigene Meldung ohne Abruf im Stand steht, dass ein Stand aus dem Speicher ohne Abruf eingelesen wird und dass 429/5xx den
 * alten Stand lassen.
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

console.log('Netflix: Stand im Speicher')
const k = { globalThis: null, console, URL, Date, Math, setInterval: () => 0, encodeURIComponent, Map, Set, Promise }
k.globalThis = k
vm.createContext(k)
for (const datei of ['netflix-uebernahme.js', 'netflix-stand.js']) vm.runInContext(lies(datei), k)

/** Der Übernahme-Takt wie in melder.js: jede Stunde um :23. */
const uebernahme = (jetzt) => {
  const ziel = new Date(jetzt)
  ziel.setSeconds(0, 0)
  ziel.setMinutes(23)
  if (ziel <= jetzt) ziel.setTime(ziel.getTime() + 3600000)
  return ziel
}
const min = 60000
/** 12:00 Uhr (Ortszeit) des Testtags: die Übernahme dieser Stunde ist :23, fertig gegen :28. */
const T = new Date(2026, 10, 16, 12, 0, 0).getTime()
const f = k.akNetflixStand.faellig

pruefe('fällig: noch nie geholt', f(null, T, uebernahme) === true)
pruefe('nicht fällig: Stand 3 min alt', f(T, T + 3 * min, uebernahme) === false)
pruefe('nicht fällig: Stand 10 min alt, vor der Übernahme (12:10)', f(T, T + 10 * min, uebernahme) === false)
pruefe('nicht fällig: Stand 8 min alt, Übernahme noch nicht durch (12:20 Stand 12:12)', f(T + 12 * min, T + 20 * min, uebernahme) === false)
pruefe('fällig: Übernahme durch (12:28), Stand von 12:10 ist älter', f(T + 10 * min, T + 28 * min, uebernahme) === true)
pruefe('nicht fällig: Stand nach der Übernahme geholt (12:29, Stand 12:28)', f(T + 28 * min, T + 29 * min, uebernahme) === false)
pruefe('fällig: 20 min alt, auch ohne Übernahme (12:30 Stand 12:10 → schon durch; 12:50 Stand 12:30)', f(T + 30 * min, T + 50 * min, uebernahme) === true)
pruefe('nicht fällig: nie öfter als alle 5 min (Stand 12:26, jetzt 12:28 nach Übernahme)', f(T + 26 * min, T + 28 * min, uebernahme) === false)

/** Ein gemeinsamer Speicher für mehrere „Tabs“. */
const speicherNeu = () => {
  const daten = {}
  const hoerer = []
  const lokal = (name) => ({
    lesen: async (s) => ({ [s]: daten[s] }),
    schreiben: async (w) => {
      for (const [s, v] of Object.entries(w)) {
        const alt = daten[s]
        if (v === null) delete daten[s]
        else daten[s] = v
        for (const h of hoerer) if (h.name !== name) h.fn({ [s]: { newValue: v, oldValue: alt } }, 'local')
      }
      return true
    },
    beiAenderung: (fn) => hoerer.push({ name, fn }),
  })
  return { daten, lokal }
}

const adresse = (r) => `https://www.netflix.com/title/${r}`
const paarA = { nummer: 1, staffel: 1, staffelBekannt: true, folge: '100', am: '2026-11-16T12:00:00Z' }

/** Ein „Tab“: eigener Stand, eigene `fetch`-Zählung (`abrufe` gemeinsam). */
const tabNeu = (speicher, name, abrufe, antwort = null, tor = null) => {
  const gemerkt = new Map()
  const protokoll = { geaendert: 0 }
  const fetch = async (u) => {
    abrufe.push(String(u))
    if (tor) await tor
    if (antwort) return antwort
    const je = {}
    for (const r of ['1', '2']) je[adresse(r)] = { nummern: [1], paare: [paarA] }
    return { ok: true, status: 200, json: async () => ({ adressen: je }) }
  }
  const kontext = speicher.lokal(name)
  const o = {
    worker: 'https://w.test/pruefung',
    reihen: () => ['1', '2'],
    merken: (r, paare) => gemerkt.set(r, paare),
    abrufen: async () => {},
    geaendert: () => protokoll.geaendert++,
    uebernahme,
    kontext: { lesen: kontext.lesen, schreiben: kontext.schreiben, beiAenderung: kontext.beiAenderung },
    jetzt: () => T + 12 * min,
    tab: name,
    takt: 0,
  }
  /* `akGemeldetSammel` nimmt `holen` als Vorgabe: hier der Zähler dieses Tabs. */
  const sammel = k.akGemeldetSammel
  k.akGemeldetSammel = (w, a) => sammel(w, a, fetch)
  const stand = k.akNetflixStand.neu(o)
  k.akGemeldetSammel = sammel
  const ruf = (verzoegert) => stand.auffrischen.bind(stand, verzoegert)
  void ruf
  return { stand, gemerkt, protokoll, fetch, antworten: (a) => (antwort = a) }
}

const warten = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
}
const holen = async (t, abrufe) => {
  const sammel = k.akGemeldetSammel
  k.akGemeldetSammel = (w, a) => sammel(w, a, t.fetch)
  const r = await t.stand.auffrischen()
  k.akGemeldetSammel = sammel
  return r
}

/* --- ein Abruf, Ergebnis im Speicher --- */
const teil1 = async () => {
  const s = speicherNeu()
  const abrufe = []
  const t = tabNeu(s, 'a', abrufe)
  const ok = await holen(t, abrufe)
  pruefe('Auffrischen: ein Abruf, die Sammelroute mit beiden Reihen', ok === true && abrufe.length === 1 && /gemeldet-liste=1%2C2/.test(abrufe[0]), abrufe)
  pruefe('Auffrischen: der Stand liegt im Speicher (Zeitpunkt und Paare je Reihe)', s.daten.netflixStand?.am === T + 12 * min && s.daten.netflixStand.reihen['1'].length === 1, s.daten.netflixStand)
  pruefe('Auffrischen: die Sperre ist danach wieder frei', s.daten.netflixStandSperre === undefined, s.daten)
  pruefe('Auffrischen: der Stand ist zusammengeführt (merken je Reihe)', t.gemerkt.get('1')?.[0]?.nummer === 1 && t.gemerkt.has('2'))
  pruefe('Anzeige: „Stand von HH:MM“', /^Stand von \d\d:\d\d$/.test(t.stand.text()), t.stand.text())

  /* --- ein zweiter Tab liest den Stand ein, ohne Abruf --- */
  const abrufe2 = []
  const t2 = tabNeu(s, 'b', abrufe2)
  await warten()
  pruefe('Zweiter Tab: liest den Stand aus dem Speicher, 0 Abrufe', abrufe2.length === 0 && t2.gemerkt.get('1')?.[0]?.nummer === 1 && /^Stand von/.test(t2.stand.text()), [abrufe2, t2.stand.text()])

  /* --- eigene Meldung: sofort im Stand, ohne Abruf --- */
  const neuesPaar = { nummer: 2, staffel: 1, staffelBekannt: true, folge: '101', am: '2026-11-16T12:30:00Z' }
  t.stand.eigene('1', [neuesPaar])
  await warten()
  pruefe('Eigene Meldung: im Speicher, 0 Abrufe', s.daten.netflixStand.reihen['1'].length === 2 && abrufe.length === 1, s.daten.netflixStand.reihen['1'])
  pruefe('Eigene Meldung: der andere Tab sieht sie über den Speicher, ohne Abruf', t2.gemerkt.get('1')?.length === 2 && abrufe2.length === 0, t2.gemerkt.get('1'))
  t.stand.eigene('1', [neuesPaar])
  pruefe('Dieselbe Meldung noch einmal: kein neues Schreiben (Stand unverändert)', s.daten.netflixStand.reihen['1'].length === 2)
}

/* --- zwei Tabs, ein Abruf --- */
const teil2 = async () => {
  const s = speicherNeu()
  const abrufe = []
  let freigeben
  const spaet = new Promise((r) => { freigeben = r })
  const a = tabNeu(s, 'a', abrufe, null, spaet)
  const b = tabNeu(s, 'b', abrufe)
  const ta = holen(a, abrufe)
  await warten()
  const rb = await holen(b, abrufe)
  pruefe('Zwei Tabs, einer holt gerade: der zweite holt nicht (Sperre)', rb === false && abrufe.length === 1, [rb, abrufe.length])
  freigeben()
  pruefe('Zwei Tabs: der erste kommt an', (await ta) === true && abrufe.length === 1 && s.daten.netflixStandSperre === undefined, abrufe.length)
  pruefe('Zwei Tabs: der zweite hat den Stand aus dem Speicher', b.gemerkt.get('1')?.[0]?.nummer === 1)
}

/* --- 429/5xx: alter Stand bleibt, kein Einzelweg --- */
const teil3 = async () => {
for (const status of [429, 500]) {
  const s = speicherNeu()
  const abrufe = []
  const einzeln = []
  const t = tabNeu(s, 'a', abrufe, { ok: false, status, json: async () => ({}) })
  const ok = await holen(t, abrufe)
  pruefe(`${status}: kein Stand gespeichert, kein Einzelweg, Sperre frei`, ok === false && !s.daten.netflixStand && einzeln.length === 0 && abrufe.length === 1 && s.daten.netflixStandSperre === undefined, [ok, abrufe])
}
}

/* --- ohne Takt und ohne Öffnen kein Abruf; der Takt holt nur, wenn es fällig ist --- */
const teil4 = async () => {
  const s = speicherNeu()
  const abrufe = []
  const t = tabNeu(s, 'a', abrufe)
  await warten()
  pruefe('Start eines Tabs ohne Stand: kein Abruf (erst der Takt, nie beim Öffnen)', abrufe.length === 0)
  const sammel = k.akGemeldetSammel
  k.akGemeldetSammel = (w, a) => sammel(w, a, t.fetch)
  t.stand.takt()
  await warten()
  k.akGemeldetSammel = sammel
  pruefe('Takt ohne Stand: genau ein Abruf', abrufe.length === 1, abrufe)
  k.akGemeldetSammel = (w, a) => sammel(w, a, t.fetch)
  t.stand.takt()
  await warten()
  k.akGemeldetSammel = sammel
  pruefe('Takt mit frischem Stand: kein weiterer Abruf', abrufe.length === 1, abrufe)
}

const haupt = async () => {
  await teil1()
  await teil2()
  await teil3()
  await teil4()
  if (fehler.length) {
    console.log(`\n${fehler.length} Prüfung(en) fehlgeschlagen.`)
    process.exit(1)
  }
  console.log('\nAlle Prüfungen bestanden.')
}
void haupt()
