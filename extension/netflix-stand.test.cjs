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

pruefe('fällig: noch nie geholt', f(null, null, T, uebernahme) === true)
pruefe('nicht fällig: Stand 3 min alt', f(T, null, T + 3 * min, uebernahme) === false)
pruefe('nicht fällig: Stand 10 min alt, vor der Übernahme (12:10)', f(T, null, T + 10 * min, uebernahme) === false)
pruefe('nicht fällig: Stand 8 min alt, Übernahme noch nicht durch (12:20 Stand 12:12)', f(T + 12 * min, null, T + 20 * min, uebernahme) === false)
pruefe('fällig: Übernahme durch (12:28), Stand von 12:10 ist älter', f(T + 10 * min, null, T + 28 * min, uebernahme) === true)
pruefe('nicht fällig: Stand nach der Übernahme geholt (12:29, Stand 12:28)', f(T + 28 * min, null, T + 29 * min, uebernahme) === false)
pruefe('fällig: 20 min alt, auch ohne Übernahme (12:30 Stand 12:10 → schon durch; 12:50 Stand 12:30)', f(T + 30 * min, null, T + 50 * min, uebernahme) === true)
pruefe('Grenze: genau 5 min seit dem Stand, Übernahme gerade durch (12:23 → 12:28): fällig', f(T + 23 * min, null, T + 28 * min, uebernahme) === true)
pruefe('Grenze: knapp unter 5 min (12:24 → 12:28): nicht fällig', f(T + 24 * min, null, T + 28 * min, uebernahme) === false)
pruefe('Grenze: genau 20 min seit dem Stand (12:00 → 12:20): fällig', f(T, null, T + 20 * min, uebernahme) === true)
pruefe('Grenze: knapp unter 20 min (12:00 → 12:19): nicht fällig', f(T, null, T + 19 * min, uebernahme) === false)
pruefe('Grenze: Stand genau zur Übernahme-Fertigzeit (12:28), jetzt 12:33: nicht fällig', f(T + 28 * min, null, T + 33 * min, uebernahme) === false)
pruefe('Versuch nach der Übernahme (12:29, gescheitert), Stand alt, jetzt 12:35: nicht fällig', f(T, T + 29 * min, T + 35 * min, uebernahme) === false)
pruefe('Versuch vor der Übernahme (12:10), Stand alt: nach der Übernahme fällig', f(T, T + 10 * min, T + 28 * min, uebernahme) === true)
pruefe('Versuch 12:20 gescheitert, Stand nie: 12:30 nicht fällig (erst 12:40 oder zur Übernahme)', f(null, T + 20 * min, T + 22 * min, uebernahme) === false)
pruefe('Text: Stand von heute nur Uhrzeit, knapp unter 24 h', /^Stand von \d\d:\d\d$/.test(k.akNetflixStand.text(T, T + 24 * 60 * min - 1)))
pruefe('Text: genau 24 h alt mit Datum', /^Stand vom \d\d\.\d\d\., \d\d:\d\d$/.test(k.akNetflixStand.text(T, T + 24 * 60 * min)))
pruefe('Vereinigung: späteres am gewinnt, früheres nicht', (() => {
  const v = k.akNetflixStand.vereinige({ 1: [{ nummer: 1, staffel: 1, folge: 'a', am: '2026-11-16T12:00' }] }, { 1: [{ nummer: 1, staffel: 1, folge: 'a', am: '2026-11-16T13:00' }] })
  const w = k.akNetflixStand.vereinige({ 1: [{ nummer: 1, staffel: 1, folge: 'a', am: '2026-11-16T13:00' }] }, { 1: [{ nummer: 1, staffel: 1, folge: 'a', am: '2026-11-16T12:00' }] })
  return v[1].length === 1 && v[1][0].am.endsWith('13:00') && w[1][0].am.endsWith('13:00')
})())
pruefe('Vereinigung: andere Staffel mit gleicher Nummer ist ein eigenes Paar', k.akNetflixStand.vereinige({ 1: [{ nummer: 1, staffel: 1 }] }, { 1: [{ nummer: 1, staffel: 2 }] })[1].length === 2)
pruefe('Vereinigung: Reihe ohne gültiges Paar fällt weg, Nicht-Liste (Text, Zahl) und kaputte Quelle ebenso', JSON.stringify(k.akNetflixStand.vereinige({ 1: [{ nummer: 'x' }], 2: 'text', 3: [{ nummer: 4 }], 4: 7 }, 5)) === '{"3":[{"nummer":4}]}')
pruefe('Vereinigung: dieselbe Nummer mit anderer Folgenkennung ist ein eigenes Paar', k.akNetflixStand.vereinige({ 1: [{ nummer: 1, staffel: 1, folge: 'a' }] }, { 1: [{ nummer: 1, staffel: 1, folge: 'b' }] })[1].length === 2)
pruefe('nicht fällig: nie öfter als alle 5 min (Stand 12:26, jetzt 12:28 nach Übernahme)', f(T + 26 * min, null, T + 28 * min, uebernahme) === false)

/** Ein gemeinsamer Speicher für mehrere „Tabs“. */
const speicherNeu = () => {
  const daten = {}
  const zaehler = { stand: 0 }
  const hoerer = []
  const lokal = (name) => ({
    lesen: async (s) => ({ [s]: daten[s] }),
    schreiben: async (w) => {
      for (const [s, v] of Object.entries(w)) {
        const alt = daten[s]
        if (s === 'netflixStand') zaehler.stand++
        if (v === null) delete daten[s]
        else daten[s] = v
        for (const h of hoerer) if (h.name !== name) h.fn({ [s]: { newValue: v, oldValue: alt } }, 'local')
      }
      return true
    },
    beiAenderung: (fn) => hoerer.push({ name, fn }),
  })
  return { daten, lokal, zaehler }
}

const adresse = (r) => `https://www.netflix.com/title/${r}`
const paarA = { nummer: 1, staffel: 1, staffelBekannt: true, folge: '100', am: '2026-11-16T12:00:00Z' }

/** Ein „Tab“: eigener Stand, eigene `fetch`-Zählung (`abrufe` gemeinsam). */
const tabNeu = (speicher, name, abrufe, antwort = null, tor = null, opt = {}) => {
  const gemerkt = new Map()
  const protokoll = { geaendert: 0 }
  const fetch = async (u) => {
    abrufe.push(String(u))
    if (tor) await tor
    if (antwort) return antwort
    const je = {}
    for (const r of opt.antwortReihen ?? ['1', '2']) je[adresse(r)] = { nummern: [1], paare: opt.paare ?? [paarA] }
    return { ok: true, status: 200, json: async () => ({ adressen: je }) }
  }
  const kontext = speicher.lokal(name)
  const o = {
    worker: 'https://w.test/pruefung',
    reihen: () => opt.reihen ?? ['1', '2'],
    merken: (r, paare) => gemerkt.set(r, paare),
    geaendert: () => protokoll.geaendert++,
    uebernahme,
    holen: fetch,
    kontext: { lesen: kontext.lesen, schreiben: kontext.schreiben, ...(opt.ohneHoeren ? {} : { beiAenderung: kontext.beiAenderung }) },
    abrufen: opt.abrufen ?? (async () => {}),
    jetzt: () => (opt.uhr ? opt.uhr.t : T + 12 * min),
    tab: name,
    takt: 0,
  }
  /* `akGemeldetSammel` nimmt `holen` als Vorgabe: hier der Zähler dieses Tabs. */
  const stand = k.akNetflixStand.neu(o)
  return { stand, gemerkt, protokoll, fetch, antworten: (a) => (antwort = a) }
}

const warten = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
}
const holen = async (t, abrufe) => {
  const r = await t.stand.auffrischen()
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
  t.stand.takt()
  await warten()
  pruefe('Takt ohne Stand: genau ein Abruf', abrufe.length === 1, abrufe)
  t.stand.takt()
  await warten()
  pruefe('Takt mit frischem Stand: kein weiterer Abruf', abrufe.length === 1, abrufe)
}

/* --- A1: ein gescheiterter Versuch zählt, der Takt holt nicht jede Minute neu --- */
const teil5 = async () => {
  const s = speicherNeu()
  const abrufe = []
  const uhr = { t: T }
  const t = tabNeu(s, 'a', abrufe, { ok: false, status: 429, json: async () => ({}) }, null, { uhr })
  for (let i = 0; i < 60; i++) {
    uhr.t = T + i * min
    t.stand.takt()
    await warten()
  }
  pruefe('A1: 429, 60 Takte in 60 Minuten: höchstens vier Versuche (nicht 60)', abrufe.length >= 1 && abrufe.length <= 4, abrufe.length)
  const abrufe2 = []
  const t2 = tabNeu(speicherNeu(), 'b', abrufe2, { ok: true, status: 200, json: async () => ({ adressen: { [adresse('1')]: { paare: [paarA] }, [adresse('2')]: { paare: [] } } }) }, null, { uhr })
  for (let i = 0; i < 60; i++) {
    uhr.t = T + 100 * min + i * min
    t2.stand.takt()
    await warten()
  }
  pruefe('A1: Erfolg, 60 Takte in 60 Minuten: höchstens vier Abrufe', abrufe2.length >= 1 && abrufe2.length <= 4, abrufe2.length)
}

/* --- A2: ein abgewiesener Tab löscht die Sperre des haltenden nicht --- */
const teil6 = async () => {
  const s = speicherNeu()
  const abrufe = []
  let freigeben
  const tor = new Promise((r) => { freigeben = r })
  const a = tabNeu(s, 'a', abrufe, null, tor)
  const b = tabNeu(s, 'b', abrufe)
  const c = tabNeu(s, 'c', abrufe)
  const ta = holen(a, abrufe)
  await warten()
  const rb = await holen(b, abrufe)
  pruefe('A2: b wird abgewiesen, die Sperre von a bleibt stehen', rb === false && s.daten.netflixStandSperre?.tab === 'a', s.daten.netflixStandSperre)
  const rc = await holen(c, abrufe)
  pruefe('A2: auch c wird abgewiesen: drei Tabs, ein Abruf', rc === false && abrufe.length === 1, abrufe.length)
  freigeben()
  await ta
  pruefe('A2: nach dem Abruf ist die Sperre frei', s.daten.netflixStandSperre === undefined, s.daten.netflixStandSperre)
}

/* --- A3: Vereinigung statt Ersetzen; Meldungen während des Abrufs gehen nicht verloren --- */
const teil7 = async () => {
  const neuesPaar = { nummer: 2, staffel: 1, staffelBekannt: true, folge: '101', am: '2026-11-16T12:30:00Z' }
  {
    const s = speicherNeu()
    const abrufe = []
    const t = tabNeu(s, 'a', abrufe)
    t.stand.eigene('1', [neuesPaar])
    await warten()
    await holen(t, abrufe)
    pruefe('A3: Meldung, dann ↻ mit Antwort ohne sie: der Speicher enthält sie weiter', s.daten.netflixStand.reihen['1'].some((x) => x.folge === '101') && s.daten.netflixStand.reihen['1'].some((x) => x.folge === '100'), s.daten.netflixStand.reihen['1'])
    pruefe('A3: und der Tab selbst führt sie', t.gemerkt.get('1').some((x) => x.folge === '101'))
  }
  {
    const s = speicherNeu()
    const abrufe = []
    let freigeben
    const tor = new Promise((r) => { freigeben = r })
    const t = tabNeu(s, 'a', abrufe, null, tor)
    const lauf = holen(t, abrufe)
    await warten()
    t.stand.eigene('2', [neuesPaar])
    await warten()
    freigeben()
    await lauf
    pruefe('A3: Meldung während des Abrufs: sie steht danach im Speicher und im Tab', s.daten.netflixStand.reihen['2'].some((x) => x.folge === '101') && t.gemerkt.get('2').some((x) => x.folge === '101'), s.daten.netflixStand.reihen['2'])
  }
}

/* --- A4: eigene Meldung ohne Stand täuscht keinen Stand vor --- */
const teil8 = async () => {
  const s = speicherNeu()
  const abrufe = []
  const t = tabNeu(s, 'a', abrufe)
  t.stand.eigene('1', [paarA])
  await warten()
  pruefe('A4: eigene Meldung ohne Abruf: im Speicher, aber „noch kein Stand“ und kein Zeitpunkt', s.daten.netflixStand.reihen['1'].length === 1 && s.daten.netflixStand.am === null && t.stand.text() === 'noch kein Stand', [s.daten.netflixStand, t.stand.text()])
}

/* --- A5: kaputter Speicher, zwei Listen, alter Stand --- */
const teil9 = async () => {
  for (const kaputt of [{ am: 'x', reihen: { 1: 'kein Array', 2: [{ nummer: 'a' }, null] } }, { reihen: 5 }, 'text', { am: T }]) {
    const s = speicherNeu()
    s.daten.netflixStand = kaputt
    const t = tabNeu(s, 'a', [])
    await warten()
    pruefe(`A5: kaputter Speicherwert ${JSON.stringify(kaputt).slice(0, 30)}: kein Absturz, kein Eintrag`, t.gemerkt.size === 0, t.gemerkt.size)
  }
  const s = speicherNeu()
  const a = tabNeu(s, 'a', [], null, null, { reihen: ['1', '2'], antwortReihen: ['1', '2'] })
  const b = tabNeu(s, 'b', [], null, null, { reihen: ['2', '3'], antwortReihen: ['2', '3'] })
  await holen(a, [])
  await holen(b, [])
  pruefe('A5: zwei Tabs mit verschiedenen Listen: der Speicher führt die Vereinigung (1, 2, 3)', ['1', '2', '3'].every((r) => s.daten.netflixStand.reihen[r]?.length === 1), Object.keys(s.daten.netflixStand.reihen))
  const alt = speicherNeu()
  alt.daten.netflixStand = { am: T - 2 * 24 * 60 * min, reihen: { 1: [paarA] } }
  const tAlt = tabNeu(alt, 'a', [], null, null, { uhr: { t: T } })
  await warten()
  pruefe('A5: ein Stand von vorgestern zeigt das Datum („Stand vom …, HH:MM“)', /^Stand vom \d\d\.\d\d\., \d\d:\d\d$/.test(tAlt.stand.text()), tAlt.stand.text())
  const frisch = speicherNeu()
  frisch.daten.netflixStand = { am: T - 60 * min, reihen: { 1: [paarA] } }
  const tFrisch = tabNeu(frisch, 'a', [], null, null, { uhr: { t: T } })
  await warten()
  pruefe('A5: ein Stand von heute zeigt nur die Uhrzeit', /^Stand von \d\d:\d\d$/.test(tFrisch.stand.text()), tFrisch.stand.text())
}

/* --- Einzelweg (Worker ohne Sammelroute): ruft je Reihe ab, schreibt dabei nichts je Reihe --- */
const teil10 = async () => {
  const s = speicherNeu()
  const abgerufen = []
  const ref = {}
  const abrufen = async (r) => {
    abgerufen.push(r)
    ref.t.stand.eigene(r, [paarA])
  }
  ref.t = tabNeu(s, 'a', [], { ok: false, status: 404, json: async () => ({}) }, null, { abrufen })
  const ok = await ref.t.stand.auffrischen()
  pruefe('Einzelweg (404): je Reihe ein Abruf, Ergebnis true', ok === true && abgerufen.join() === '1,2', abgerufen)
  pruefe('Einzelweg: die Abrufe gelten als intern, kein Schreiben je Reihe', s.zaehler.stand === 0, s.zaehler.stand)
}

/* --- Eigene Meldungen: gleiche Meldung zweimal schreibt einmal --- */
const teil11 = async () => {
  const s = speicherNeu()
  const t = tabNeu(s, 'a', [])
  t.stand.eigene('1', [paarA])
  t.stand.eigene('1', [paarA])
  t.stand.eigene('1', [{ ...paarA, nummer: 5 }])
  await warten()
  pruefe('Eigene Meldung zweimal: ein Schreiben, eine neue Folge: ein weiteres', s.zaehler.stand === 2 && s.daten.netflixStand.reihen['1'].length === 2, [s.zaehler.stand, s.daten.netflixStand.reihen['1'].length])
}

/* --- Sperre: fremde, eigene, abgelaufene; Rücklesen; laufender Abruf --- */
const teil12 = async () => {
  {
    const s = speicherNeu()
    const abrufe = []
    s.daten.netflixStandSperre = { tab: 'x', bis: T + 99 * min }
    const t = tabNeu(s, 'a', abrufe)
    pruefe('Sperre: eine fremde, gültige Sperre hält den Abruf auf', (await t.stand.auffrischen()) === false && abrufe.length === 0 && s.daten.netflixStandSperre?.tab === 'x', [abrufe.length, s.daten.netflixStandSperre])
  }
  {
    const s = speicherNeu()
    const abrufe = []
    s.daten.netflixStandSperre = { tab: 'a', bis: T + 99 * min }
    const t = tabNeu(s, 'a', abrufe)
    pruefe('Sperre: die eigene Sperre (Rest eines Laufs) hält den eigenen Tab nicht auf', (await t.stand.auffrischen()) === true && abrufe.length === 1, abrufe.length)
  }
  {
    const s = speicherNeu()
    const abrufe = []
    s.daten.netflixStandSperre = { tab: 'x', bis: T }
    const t = tabNeu(s, 'a', abrufe)
    pruefe('Sperre: eine abgelaufene fremde Sperre hält nicht auf', (await t.stand.auffrischen()) === true && abrufe.length === 1, abrufe.length)
  }
  {
    /* Rennen: zwischen Schreiben und Rücklesen hat ein anderer Tab die Sperre überschrieben. */
    const s = speicherNeu()
    const echt = s.lokal
    s.lokal = (name) => {
      const l = echt(name)
      if (name !== 'a') return l
      const schreiben = l.schreiben
      l.schreiben = async (x) => {
        const r = await schreiben(x)
        if (x.netflixStandSperre) s.daten.netflixStandSperre = { tab: 'b', bis: T + 99 * min }
        return r
      }
      return l
    }
    const abrufe = []
    const t = tabNeu(s, 'a', abrufe)
    pruefe('Sperre: überschrieben zwischen Schreiben und Rücklesen: kein Abruf', (await t.stand.auffrischen()) === false && abrufe.length === 0 && s.daten.netflixStandSperre?.tab === 'b', [abrufe.length, s.daten.netflixStandSperre])
  }
  {
    const s = speicherNeu()
    const abrufe = []
    let freigeben
    const tor = new Promise((r) => { freigeben = r })
    const t = tabNeu(s, 'a', abrufe, null, tor)
    const erster = t.stand.auffrischen()
    await warten()
    const zweiter = await t.stand.auffrischen()
    freigeben()
    await erster
    pruefe('Zwei Aufrufe im selben Tab: der zweite wartet nicht, holt nicht (ein Abruf)', zweiter === false && abrufe.length === 1, [zweiter, abrufe.length])
  }
}

/* --- Vereinigung: Speicher anderer Tabs, eigener Stand, Zeitpunkt --- */
const teil13 = async () => {
  const neuesPaar = { nummer: 9, staffel: 1, staffelBekannt: true, folge: '109', am: '2026-11-16T12:30:00Z' }
  {
    /* Eigene Meldung, deren Schreiben nicht ankam (toter Kontext): ↻ führt sie weiter. */
    const s = speicherNeu()
    const t = tabNeu(s, 'a', [])
    t.stand.eigene('1', [neuesPaar])
    await warten()
    delete s.daten.netflixStand
    await t.stand.auffrischen()
    pruefe('Vereinigung: der eigene Stand des Tabs bleibt, auch wenn der Speicher ihn nicht hat', s.daten.netflixStand.reihen['1'].some((x) => x.folge === '109'), s.daten.netflixStand.reihen['1'])
  }
  {
    /* Zwei Tabs mit verschiedenen Listen; der zweite hört nicht zu und kennt den Stand des ersten nur über den Speicher. */
    const s = speicherNeu()
    const a = tabNeu(s, 'a', [], null, null, { reihen: ['1', '2'], antwortReihen: ['1', '2'] })
    const b = tabNeu(s, 'b', [], null, null, { reihen: ['2', '3'], antwortReihen: ['2', '3'], ohneHoeren: true })
    await a.stand.auffrischen()
    await b.stand.auffrischen()
    pruefe('Vereinigung: der Speicher anderer Tabs geht nicht verloren (1, 2, 3)', ['1', '2', '3'].every((r) => s.daten.netflixStand.reihen[r]?.length === 1), Object.keys(s.daten.netflixStand.reihen))
  }
  {
    const s = speicherNeu()
    s.daten.netflixStand = { am: '1794830400000', reihen: {} }
    const t = tabNeu(s, 'a', [])
    await warten()
    pruefe('Zeitpunkt als Text gilt nicht (kein Stand)', t.stand.text() === 'noch kein Stand', t.stand.text())
    await t.stand.auffrischen()
    const vorher = t.stand.text()
    t.stand.einlesen({ am: T - 60 * min, reihen: {} })
    pruefe('Ein älterer Stand aus dem Speicher macht den eigenen nicht älter', t.stand.text() === vorher && /^Stand von/.test(vorher), [vorher, t.stand.text()])
  }
  {
    const s = speicherNeu()
    const t = tabNeu(s, 'a', [])
    t.stand.eigene('1', [neuesPaar])
    t.stand.einlesen({ am: T, reihen: { 2: [paarA] } })
    t.stand.eigene('3', [paarA])
    await warten()
    pruefe('Einlesen ersetzt den eigenen Stand nicht (Meldung zu 1 bleibt, 2 und 3 dazu)', ['1', '2', '3'].every((r) => s.daten.netflixStand.reihen[r]?.length === 1), Object.keys(s.daten.netflixStand.reihen))
  }
}

/* --- Verdrahtung: meldungenMerken in melder.js reicht eigene Meldungen an den Stand --- */
const teil14 = async () => {
  const melder = lies('melder.js')
  const von = melder.indexOf('function meldungenMerken')
  const quelle = melder.slice(von, melder.indexOf('\n}\n', von) + 2)
  const aufrufe = []
  const welt = { MELDUNGEN: new Map(), globalThis: { akNetflixStand: { aktuell: { eigene: (r, p) => aufrufe.push([r, p]) } } } }
  const merken = new Function('MELDUNGEN', 'globalThis', quelle + '\nreturn meldungenMerken')(welt.MELDUNGEN, welt.globalThis)
  merken('70000001', [paarA])
  pruefe('melder.js: meldungenMerken reicht Reihe und Paare an den Stand weiter', aufrufe.length === 1 && aufrufe[0][0] === '70000001' && aufrufe[0][1][0].nummer === 1, aufrufe)
}

const haupt = async () => {
  await teil1()
  await teil5()
  await teil6()
  await teil7()
  await teil8()
  await teil9()
  await teil10()
  await teil11()
  await teil12()
  await teil13()
  await teil14()
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
