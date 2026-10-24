/**
 * „nichts da" nimmt den Titel sofort aus „zu prüfen" (4.31.9, 21.10.2026).
 *
 * Daniel am 21.10.2026: Netflix-Titel (AnoHana, Bakugan, Banana Fish) leiten auf /browse um; die Meldung
 * ging durch („als nicht bei Netflix gemeldet"), die Zeile blieb. Bei Disney+ blieb sie nach „nichts da?"
 * ebenfalls. Ursachen: `fertig()` liest bei vorhandenem Stand nur den Stand (nicht `erledigt.tot`), und
 * `?gemeldet=` kennt nur Meldungen mit Folgennummer — ein „nein" hat keine.
 *
 * Geprüft wird durch Ausführen der echten Funktionen aus `melder.js` und `disney.js` (aus dem Quelltext
 * geschnitten) gegen eine Kulisse; die Uhr kommt von außen.
 *
 * Aufruf: `node extension/nichts-da-sofort.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const FEST = Date.parse('2026-10-21T03:00:00Z')
const TAG = 24 * 60 * 60 * 1000

function schneide(quelle, name, einzug = '') {
  const muster = new RegExp(`\\n${einzug}(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n${einzug}\\}`)
  const treffer = muster.exec(quelle)
  if (!treffer) throw new Error(`${name}() nicht im Quelltext`)
  return treffer[0]
}
const speicherKulisse = () => {
  const daten = new Map()
  return { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => daten.set(k, v) }
}
const antwort = (status) => async () => ({ ok: status < 400, status, json: async () => ({}) })

/* ---- Netflix: totMelden → fertig ------------------------------------------------------------ */
async function netflix() {
  const melder = lies('melder.js')
  const kontext = vm.createContext({ console })
  kontext.globalThis = kontext
  vm.runInContext(lies('netflix-uebernahme.js'), kontext)
  const code = ['istErledigt', 'merkeTot', 'fertig', 'totMelden'].map((n) => schneide(melder, n)).join('\n')
  const url = (id) => `https://www.netflix.com/title/${id}`
  const lauf = async (id, fetchAntwort, token = 't') => {
    const eigen = vm.createContext({
      console,
      erledigt: {},
      frischGemeldetNetflix: new Set(),
      standZieleNetflix: new Set([url('81659233'), url('70243420')]),
      WORKER: 'https://w.example/pruefung',
      chrome: { storage: { sync: { get: async () => ({ token }) } } },
      fetch: fetchAntwort,
      titelIdFuer: () => null,
      beobachtung: () => ({}),
      speicherSchreiben: async () => {},
    })
    eigen.globalThis = eigen
    eigen.akNetflixWartet = new Set()
    eigen.akNetflixTotGemeldet = kontext.akNetflixTotGemeldet
    eigen.akNetflixErledigtLautStand = kontext.akNetflixErledigtLautStand
    vm.runInContext(code, eigen)
    const vorher = vm.runInContext(`fertig('${id}', { titel: 'x' })`, eigen)
    const r = await vm.runInContext(`totMelden('${id}', 'Bakugan')`, eigen)
    const nachher = vm.runInContext(`fertig('${id}', { titel: 'x' })`, eigen)
    const anderer = vm.runInContext(`fertig('70243420', { titel: 'y' })`, eigen)
    const vermerkt = vm.runInContext(`JSON.stringify(erledigt['${id}'] ?? [])`, eigen)
    return { vorher, r, nachher, anderer, vermerkt }
  }
  const gut = await lauf('81659233', antwort(200))
  pruefe('Netflix: vor der Meldung ist der Titel offen (Stand führt ihn)', gut.vorher === false, gut)
  pruefe('Netflix: „nichts da" angekommen → Titel nicht mehr offen', gut.r.ok === true && gut.nachher === true, gut)
  pruefe('Netflix: ein anderer Titel bleibt offen', gut.anderer === false, gut)
  pruefe('Netflix: der Vermerk "tot" wird weiter gespeichert', gut.vermerkt === '["tot"]', gut)
  const fehl = await lauf('81659233', antwort(503))
  pruefe('Netflix: Antwort 503 → Meldung nicht ok, Titel bleibt offen', fehl.r.ok === false && fehl.nachher === false, fehl)
  const wirft = await lauf('81659233', async () => {
    throw new Error('offline')
  })
  pruefe('Netflix: Netz fällt aus → Titel bleibt offen', wirft.r.ok === false && wirft.nachher === false, wirft)
  const ohneToken = await lauf('81659233', antwort(200), '')
  pruefe('Netflix: ohne Token → Titel bleibt offen', ohneToken.r.ok === false && ohneToken.nachher === false, ohneToken)
}

/* ---- Disney+: meldeWeg → istErledigt -------------------------------------------------------- */
function weg() {
  const kontext = vm.createContext({ localStorage: speicherKulisse() })
  kontext.globalThis = kontext
  vm.runInContext(lies('pruefstand-zeit.js'), kontext)
  vm.runInContext(lies('disney-weg.js'), kontext)
  return kontext.akDisneyWeg
}
async function disney() {
  const fabrik = weg()
  const dauer = speicherKulisse()
  let jetzt = FEST
  const w = fabrik({ dauer, jetzt: () => jetzt })
  pruefe('Disney: ohne Antwort ist nichts erledigt', w.gilt('u1') === false)
  pruefe('Disney: merke(ok=false) gibt false zurück und speichert nichts', w.merke('u1', false) === false && w.gilt('u1') === false)
  pruefe('Disney: merke(ok=true) gibt true zurück', w.merke('u1', true) === true)
  pruefe('Disney: danach gilt die Adresse', w.gilt('u1') === true)
  pruefe('Disney: eine andere Adresse nicht', w.gilt('u2') === false)
  w.merke('u2', true)
  pruefe('Disney: zweite Antwort löscht die erste nicht', w.gilt('u1') === true && w.gilt('u2') === true)
  pruefe('Disney: Wiedervorlage vor der Antwort → beantwortet', w.gilt('u1', '2026-08-26') === true)
  pruefe('Disney: Wiedervorlage nach der Antwort → wieder offen', w.gilt('u1', '2026-12-01') === false)
  pruefe('Disney: Wiedervorlage am selben Tag → beantwortet', w.gilt('u1', '2026-10-21') === true)
  jetzt = FEST + 29 * TAG
  pruefe('Disney: nach 29 Tagen gilt die Antwort noch', w.gilt('u1') === true)
  jetzt = FEST + 30 * TAG
  pruefe('Disney: nach 30 Tagen fragt die Liste wieder', w.gilt('u1') === false)
  pruefe('Disney: erledigt() nimmt die Antwort des Briefkastens', w.erledigt('u9', null, true) === true)
  pruefe('Disney: erledigt() ohne beides ist offen', w.erledigt('u9', null, false) === false)
  jetzt = FEST
  dauer.setItem('ak-disney-weg', '{kaputt')
  pruefe('Disney: kaputter Speicher → offen, kein Absturz', w.gilt('u1') === false)
  const leer = fabrik({ dauer: speicherKulisse(), jetzt: () => FEST })
  pruefe('Disney: leerer Speicher → offen', leer.gilt('u1', '2026-08-26') === false)
  const voll = fabrik({
    dauer: {
      getItem: () => null,
      setItem: () => {
        throw new Error('voll')
      },
    },
    jetzt: () => FEST,
  })
  pruefe('Disney: Speicher voll → Ergebnis wird trotzdem durchgereicht', voll.merke('u1', true) === true)
  await disneyDrinnen(fabrik)
}

async function disneyDrinnen(fabrik) {
  const quelle = lies('disney.js')
  const code = [schneide(quelle, 'istErledigt', '  '), schneide(quelle, 'meldeWeg', '  ')].join('\n')
  const lauf = async (fetchAntwort, eintrag, bekannt = {}) => {
    const k = vm.createContext({
      console,
      erneutBeantwortet: new Set(bekannt.erneut ?? []),
      briefkasten: new Map((bekannt.briefkasten ?? []).map((u) => [u, []])),
      gemeldeteAdressen: new Set(bekannt.gemeldet ?? []),
      wartetAufUebernahme: new Set(bekannt.wartet ?? []),
      anbieterStaffeln: [],
      WORKER: 'https://w.example/pruefung',
      chrome: { storage: { sync: { get: async () => ({ token: 't' }) } } },
      fetch: fetchAntwort,
    })
    k.globalThis = k
    vm.runInContext(lies('pruefstand-zeit.js'), k)
    vm.runInContext(lies('disney-weg.js'), k)
    k.AK_DISNEY_WEG = fabrik({ dauer: speicherKulisse(), jetzt: () => FEST })
    k.AK_DISNEY_STAFFELN = { titelIdFuer: () => null }
    vm.runInContext(code, k)
    k.e = eintrag
    const vorher = vm.runInContext('istErledigt(e)', k)
    const ok = await vm.runInContext('meldeWeg(e)', k)
    return { vorher, ok, nachher: vm.runInContext('istErledigt(e)', k) }
  }
  const wiedervorlage = { url: 'https://www.disneyplus.com/de-de/browse/entity-fire', titel: 'Fire Force', seit: '2026-08-26', staffeln: [{ nr: 1, offen: false }, { nr: 3, offen: true }] }
  const einfach = { url: 'https://www.disneyplus.com/de-de/browse/entity-aoashi', titel: 'Aoashi', staffeln: [{ nr: 1, offen: true }] }
  const a = await lauf(antwort(200), wiedervorlage)
  pruefe('Disney: Wiedervorlage (Mehrstaffel) vorher offen', a.vorher === false, a)
  pruefe('Disney: Wiedervorlage nach „nichts da?" erledigt', a.ok === true && a.nachher === true, a)
  const b = await lauf(antwort(200), einfach)
  pruefe('Disney: ohne Wiedervorlage nach „nichts da?" erledigt', b.vorher === false && b.nachher === true, b)
  const c = await lauf(antwort(503), wiedervorlage)
  pruefe('Disney: Antwort 503 → bleibt offen', c.ok === false && c.nachher === false, c)
  const d = await lauf(async () => {
    throw new Error('offline')
  }, einfach)
  pruefe('Disney: Netz fällt aus → bleibt offen', d.ok === false && d.nachher === false, d)
  const spaet = await lauf(antwort(200), { ...wiedervorlage, seit: '2026-12-01' })
  pruefe('Disney: Wiedervorlage nach der Antwort → wieder offen', spaet.ok === true && spaet.nachher === false, spaet)
  const antwortete = await lauf(antwort(503), wiedervorlage, { erneut: [wiedervorlage.url] })
  pruefe('Disney: Wiedervorlage vom Briefkasten beantwortet → erledigt', antwortete.vorher === true, antwortete)
  const nurBriefkasten = await lauf(antwort(503), einfach, { briefkasten: [einfach.url] })
  pruefe('Disney: nur im Briefkasten → erledigt', nurBriefkasten.vorher === true, nurBriefkasten)
  const nurGemeldet = await lauf(antwort(503), einfach, { gemeldet: [einfach.url] })
  pruefe('Disney: nur in den gemeldeten Adressen → erledigt', nurGemeldet.vorher === true, nurGemeldet)
  const nurWartet = await lauf(antwort(503), einfach, { wartet: [einfach.url] })
  pruefe('Disney: nur wartend auf Übernahme → erledigt', nurWartet.vorher === true, nurWartet)
}

/* ---- Der Gebiets-Dialog von Disney+ als Erkennungsmerkmal ------------------------------------ */
function dialog() {
  const k = vm.createContext({})
  k.globalThis = k
  vm.runInContext(lies('disney-durchgang.js'), k)
  const text = 'Dieser Inhalt ist zurzeit nicht in deinem Gebiet verfügbar.\nOK'
  pruefe('Disney: Gebiets-Dialog (/de-de/home) wird erkannt', k.akDisneyGebietGesperrt(text) === true)
  pruefe('Disney: eine normale Startseite nicht', k.akDisneyGebietGesperrt('Anime Neu im Angebot') === false)
}

/* Die Seite reicht dem Durchgang den Gebiets-Weg: gemeldet wird der Eintrag der Liste, sonst nur die Adresse. */
function gebietWeg() {
  const zeile = /^ +meldeGebiet: .*$/m.exec(lies('disney.js'))?.[0]
  const gemeldet = []
  const k = vm.createContext({
    offeneEintraege: () => [
      { url: 'u1', titel: 'Aoashi' },
      { url: 'u2', titel: 'Chainsaw Man' },
      { url: 'u3', titel: 'Fire Force' },
    ],
    meldeWeg: (e) => (gemeldet.push(e), true),
  })
  const weg = vm.runInContext(`({${zeile}}).meldeGebiet`, k)
  weg('u2')
  weg('unbekannt')
  pruefe('Disney: der Gebiets-Weg meldet den Eintrag der Liste', gemeldet[0]?.titel === 'Chainsaw Man', gemeldet)
  pruefe('Disney: eine unbekannte Adresse wird mit der Adresse allein gemeldet', gemeldet[1]?.url === 'unbekannt' && gemeldet.length === 2, gemeldet)
}

async function main() {
  console.log('Zusicherungen: „nichts da" nimmt den Titel sofort aus der Liste (21.10.2026)\n')
  await netflix()
  await disney()
  dialog()
  gebietWeg()
  const schlecht = faelle.filter((x) => !x).length
  console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen.` : `\nAlle ${faelle.length} Prüfungen bestanden.`)
  process.exit(schlecht ? 1 : 0)
}

main()
