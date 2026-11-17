/**
 * Netflix-Durchgang: ein Durchgang je Browser, andere Tabs stören nicht (Issue 4071, Schnitt 2).
 *
 * Anlass (Bericht vom 16.11.2026, drei Netflix-Tabs in zwei Fenstern): Im zweiten Fenster wurden während des Durchgangs
 * Einträge der Prüfliste angeklickt; der Durchgangs-Tab nannte danach Titel als „gerade“, die er nie geöffnet hat. Zwei
 * gleichzeitige Starts gewannen beide (der Besitz war ein blindes `set`). Nach dem Neuladen der Erweiterung sprang ein Tab im toten
 * Kontext weiter und fragte weiter bei Netflix an.
 *
 * Geprüft mit den echten Funktionen aus `melder.js` (`selbstKlick`, der Listener `beiAenderung`, die Schreiber von `zuletztGeoeffnet`)
 * und `netflix-durchgang-steuerung.js` an zwei Tab-Kulissen mit einem gemeinsamen Speicher auf virtueller Uhr.
 *
 * Aufruf: `node extension/netflix-durchgang-tabs.test.cjs`
 */
const vm = require('node:vm')
const { lies, melder, funktion, virtuelleUhr, kontextBauen, durchgang, tabAufbauen } = require('./test-durchgang-welt.cjs')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

/** Ein gemeinsamer Speicher (`chrome.storage.local`): Lesen braucht 5 ms, Schreiben 80 ms auf der virtuellen Uhr (so liest ein Tab zurück, bevor das Schreiben des anderen ankommt); Schreiben benachrichtigt alle Tabs. */
function gemeinsamerSpeicher(zeit, lesenMs = 5, schreibenMs = 80) {
  const s = { daten: {}, hoerer: [], schreibungen: 0 }
  s.kontextFuer = (tab) => ({
    lebt: () => true,
    lesen: async (schluessel) => {
      await zeit.warte(lesenMs)
      const keys = Array.isArray(schluessel) ? schluessel : [schluessel]
      return Object.fromEntries(keys.filter((k) => k in s.daten).map((k) => [k, s.daten[k]]))
    },
    schreiben: async (werte) => {
      s.schreibungen++
      await zeit.warte(typeof schreibenMs === 'function' ? schreibenMs(tab) : schreibenMs)
      const aenderungen = {}
      for (const [k, w] of Object.entries(werte)) {
        aenderungen[k] = { oldValue: s.daten[k], newValue: w }
        s.daten[k] = w
      }
      for (const h of s.hoerer) h(aenderungen, 'local')
      return true
    },
    beiAenderung: (fn) => s.hoerer.push(fn),
    keinTokenText: () => 'kein Token',
  })
  return s
}

/**
 * Ein Tab mit den echten `selbstKlick` und `laufBeenden` aus `melder.js`: `laufStarten` zählt (und setzt `selbstAn`), `taktTun.schreiben` schreibt den
 * Besitz wie der Takt, `takt()` ist ein Takt des Besitzes (`akNetflixBesitz`, Urteil fremd beendet). Ein gesperrter Knopf nimmt keinen Klick an (wie im DOM).
 */
function tabKulisse({ zeit, speicher, name, k, lebt = true, schreibtNicht = false }) {
  const kontext = { ...speicher.kontextFuer(name), lebt: () => lebt }
  if (schreibtNicht) kontext.schreiben = async () => false
  const t = { name, starts: 0 }
  const taktTun = { schreiben: (b) => void kontext.schreiben({ netflixDurchgangBesitzer: b }), aufraeumen: () => {} }
  const welt = {
    akNetflixStartHinweis: k.akNetflixStartHinweis,
    akNetflixBesitzAnspruch: k.akNetflixBesitzAnspruch,
    akNetflixBesitz: k.akNetflixBesitz,
    akNetflixEnde: () => ({}),
    akNetflixBesuchtStand: () => 0,
    globalThis: { akKontext: kontext },
    meinTab: name,
    taktTun,
    selbstUebersprungen: { keinAuftrag: () => ({ text: 'kein Auftrag', title: '' }) },
    dialogSchliessen: () => {},
    setTimeout: (fn, ms) => zeit.setTimeoutV(fn, ms),
    Date: k.Date,
    console: { log() {} },
    bremse: { zuruecksetzen() {} },
    DURCHLAUF: {},
    durchlaufKnopfZeigen: () => {},
    sessionStorage: { removeItem() {} },
    LAUF_SCHLUESSEL: 'k',
    fertigeTitel: new Map(),
    offeneTitel: {},
    vorfallMelden: () => {},
    durchgangEndeZeigen: () => {},
    t,
  }
  const bauen = new Function(
    'w',
    `const { ${Object.keys(welt).join(', ')} } = w
let selbstAn = false
let durchgangBesitzer = null
let durchgangEnde = null
const laufStarten = () => { t.starts++; selbstAn = true; return true }
${funktion('laufBeenden')}
${funktion('selbstKlick')}
const takt = () => akNetflixBesitz({ selbstAn, besitzer: durchgangBesitzer, tab: meinTab, jetzt: Date.now() }, { schreiben: taktTun.schreiben, beenden: laufBeenden })
return { selbstKlick, laufBeenden, takt, laeuft: () => selbstAn, anschalten: () => { selbstAn = true }, besitzerSetzen: (b) => { durchgangBesitzer = b } }`,
  )
  const bauteil = bauen(welt)
  /* Jede Änderung des Besitzers erreicht auch das Abbild dieses Tabs (`onChanged`). */
  speicher.hoerer.push((a) => { if (a.netflixDurchgangBesitzer) bauteil.besitzerSetzen(a.netflixDurchgangBesitzer.newValue ?? null) })
  const knopf = { textContent: '▶ alle durchgehen', title: '', disabled: false }
  return { t, knopf, bauteil, klick: () => (knopf.disabled ? Promise.resolve() : Promise.resolve(bauteil.selbstKlick(knopf))), kontext }
}

async function teilStart() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const speicher = gemeinsamerSpeicher(zeit)
  const a = tabKulisse({ zeit, speicher, name: 'A', k })
  const b = tabKulisse({ zeit, speicher, name: 'B', k })
  a.klick().catch((e) => console.log('  Fehler A:', e.message))
  await zeit.vor(20) // Tab B klickt, bevor das Schreiben von Tab A angekommen ist
  b.klick().catch((e) => console.log('  Fehler B:', e.message))
  await zeit.vor(2000)
  const starts = a.t.starts + b.t.starts
  console.log(`   zwei gleichzeitige Starts: Tab A ${a.t.starts}, Tab B ${b.t.starts}`)
  pruefe('Start: zwei gleichzeitige Klicks starten genau einen Durchgang', starts === 1, { a: a.t.starts, b: b.t.starts })
  const verlierer = a.t.starts ? b : a
  pruefe('Start: der Verlierer sagt, wo der Durchgang läuft, und startet nicht', /anderen Tab/.test(verlierer.knopf.textContent) && verlierer.knopf.disabled === true, verlierer.knopf)
  const tot = tabKulisse({ zeit: virtuelleUhr(), speicher: gemeinsamerSpeicher(zeit), name: 'T', k, lebt: false })
  await tot.klick()
  pruefe('Start: bei totem Kontext (Erweiterung neu geladen) startet nichts, der Knopf sagt es', tot.t.starts === 0 && /neu geladen/.test(tot.knopf.textContent), tot.knopf)
  pruefe('Start: im Speicher steht der Gewinner als Besitzer', speicher.daten.netflixDurchgangBesitzer?.tab === (a.t.starts ? 'A' : 'B'), speicher.daten.netflixDurchgangBesitzer)
}

async function teilBesitzerFrist() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const speicher = gemeinsamerSpeicher(zeit)
  const b = tabKulisse({ zeit, speicher, name: 'B', k })
  /* Tab A hat den Durchgang und einmal gepulst (`taktTun.schreiben`), dann schließt er: kein Puls mehr. */
  void speicher.kontextFuer('A').schreiben({ netflixDurchgangBesitzer: { tab: 'A', puls: zeit.uhr.t } })
  await zeit.vor(60000)
  b.klick().catch((e) => console.log('  Fehler B:', e.message))
  await zeit.vor(2000)
  pruefe('Frist: 60 s nach dem letzten Puls startet Tab B nicht', b.t.starts === 0, b.t.starts)
  await zeit.vor(40000)
  b.knopf.disabled = false
  b.klick().catch((e) => console.log('  Fehler B:', e.message))
  await zeit.vor(2000)
  pruefe('Frist: der Besitzer-Tab ist zu — nach der Frist (90 s) startet Tab B', b.t.starts === 1, b.t.starts)
  pruefe('Frist: danach steht Tab B als Besitzer im Speicher', speicher.daten.netflixDurchgangBesitzer?.tab === 'B', speicher.daten.netflixDurchgangBesitzer)
}

/** Der Listener `beiAenderung` aus `melder.js` mit den Variablen, die er anfasst. */
function listenerBauen(k, meinTab, start, laeuft = false) {
  const von = melder.indexOf('globalThis.akKontext.beiAenderung((aenderungen, bereich) => {')
  const text = melder.slice(von, melder.indexOf('\n})\n', von) + 3)
  let hoerer = null
  let neuGezeichnet = 0
  const bauen = new Function(
    'globalThis', 'akNetflixEigenerSprung', 'akNetflixSprungUebernehmen', 'akNetflixBesitzerUebernehmen', 'meinTab', 'uebersichtZeigen', 'dialogNeuZeichnen', 'setTimeout', 'start', 'laeuft',
    `let zuletztGeoeffnet = start
let selbstAn = laeuft
let durchgangBesitzer = null
let anbieterStaffeln = {}
let erledigt = {}
${text}
return { gerade: () => zuletztGeoeffnet }`,
  )
  const lauf = bauen({ akKontext: { beiAenderung: (fn) => (hoerer = fn) } }, k.akNetflixEigenerSprung, k.akNetflixSprungUebernehmen, k.akNetflixBesitzerUebernehmen, meinTab, () => {}, () => neuGezeichnet++, (fn) => fn(), start, laeuft)
  return { gerade: lauf.gerade, hoere: (a) => hoerer(a, 'local'), neuGezeichnet: () => neuGezeichnet }
}

/** Der Eintrag, den ein Klick in der Liste schreibt: die echte Zeile aus `melder.js`, ausgeführt mit der Kennung des Tabs. */
function klickEintraege(tab, id) {
  const treffer = []
  const zeile1 = /geoeffnet: \(id\) => void speicherSchreiben\((.*)\),\n/.exec(melder)?.[1]
  const zeile2 = /void speicherSchreiben\((\{ zuletztGeoeffnet: \{ id: String\(id\)[^\n]*\} \})\)/.exec(melder)?.[1]
  for (const z of [zeile1, zeile2]) {
    if (!z) throw new Error('Schreiber von zuletztGeoeffnet nicht in melder.js')
    treffer.push(new Function('id', 'meinTab', 'Date', `return ${z}`)(id, tab, { now: () => 5000 }).zuletztGeoeffnet)
  }
  return treffer
}

function teilFremderKlick() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const eigener = { id: 'X', zeit: 4000, durchgang: true, tab: 'A' }
  /* Tab A führt den Durchgang (laeuft), Tab B klickt einen Listeneintrag: A bleibt, wie es war. */
  for (const [nr, eintrag] of klickEintraege('B', 'Y').entries()) {
    const a = listenerBauen(k, 'A', eigener, true)
    a.hoere({ zuletztGeoeffnet: { newValue: eintrag } })
    pruefe(`Fremder Klick (Schreiber ${nr + 1}): im Durchgangs-Tab A bleibt „gerade“ der eigene Sprung`, a.gerade()?.id === 'X', a.gerade())
  }
  const a = listenerBauen(k, 'A', eigener, true)
  a.hoere({ zuletztGeoeffnet: { newValue: { ...eigener, id: 'Z', zeit: 4500 } } })
  pruefe('Eigener Sprung: ein Eintrag des eigenen Tabs gilt (gerade wechselt auf Z)', a.gerade()?.id === 'Z', a.gerade())
  const alt = listenerBauen(k, 'A', eigener, true)
  alt.hoere({ zuletztGeoeffnet: { newValue: { id: 'W', zeit: 4800 } } })
  pruefe('Alter Eintrag ohne Tab-Kennung (vor dem Update): im Durchgangs-Tab fremd, kein Absturz', alt.gerade()?.id === 'X', alt.gerade())
  /* Der Link der Liste öffnet einen neuen Tab: der liest den Eintrag des öffnenden Tabs, das darf nicht brechen. */
  const neuerTab = listenerBauen(k, 'C', null)
  for (const [nr, eintrag] of klickEintraege('B', 'Y').entries()) {
    const c = listenerBauen(k, 'C', null)
    c.hoere({ zuletztGeoeffnet: { newValue: eintrag } })
    pruefe(`Neuer Tab: Schreiber ${nr + 1} trägt die Kennung des öffnenden Tabs`, c.gerade()?.tab === 'B' && c.gerade()?.id === 'Y', c.gerade())
  }
  const b = listenerBauen(k, 'B', null)
  b.hoere({ zuletztGeoeffnet: { newValue: klickEintraege('B', 'Y')[0] } })
  pruefe('Eigener Klick: der Tab, der klickt, übernimmt seinen Eintrag', b.gerade()?.id === 'Y', b.gerade())
  const frei = (z, tab, laeuft) => k.akNetflixEigenerSprung(z, tab, laeuft)
  pruefe('Durchgang eines fremden Tabs gilt nirgends, auch nicht im Tab ohne Durchgang', frei({ id: 'Y', zeit: 1, durchgang: true, tab: 'B' }, 'A', false) === null && frei({ id: 'Y', zeit: 1, durchgang: true, tab: 'B' }, 'A', true) === null)
  pruefe('Beim Laden im Durchgangs-Tab: ein fremder Klick gilt nicht, ein eigener Eintrag und nichts bleiben, wie sie sind', frei({ id: 'Y', zeit: 1, tab: 'B' }, 'A', true) === null && frei({ id: 'Y', zeit: 1 }, 'A', true) === null && frei({ id: 'X', tab: 'A' }, 'A', true)?.id === 'X' && frei(undefined, 'A', true) === null)
}

async function teilToterKontext() {
  /* Während der Post des ersten Titels läuft, wird die Erweiterung neu geladen: danach kein Sprung, keine Anfrage bei Netflix, keine Meldung. */
  const r = await durchgang({
    probeMs: () => 200,
    postMs: () => 800,
    beiPost: (id, lebendig) => { if (id === '101') lebendig.an = false },
  })
  console.log(`   toter Kontext: ${JSON.stringify({ posts: r.posts, proben: r.proben, gehe: r.gehe })}`)
  pruefe('Toter Kontext: nach dem Neuladen der Erweiterung kein Sprung (gehe)', r.gehe.length === 0, r.gehe)
  pruefe('Toter Kontext: kein weiterer Sprung vorbereitet (zuletztGeoeffnet bleibt beim ersten Titel)', r.zuletzt === '101', r.zuletzt)
  pruefe('Toter Kontext: keine weitere Anfrage bei Netflix (Probe) und kein zweiter Post', r.proben === 1 && r.posts === 1, { proben: r.proben, posts: r.posts })
}

/** Die Wächter gegen den toten Kontext in `gehe` und im Takt `vielleichtSelbstStarten`, einzeln ausgeführt. */
async function teilTotWaechter() {
  const geheBauen = new Function('verbindungLebt', 'history', 'window', 'PopStateEvent', `${funktion('gehe')}\nreturn gehe`)
  for (const lebt of [false, true]) {
    const z = { push: 0, ereignis: 0 }
    geheBauen(() => lebt, { pushState: () => z.push++ }, { dispatchEvent: () => z.ereignis++ }, class {})('/title/1')
    pruefe(`Toter Kontext: gehe ${lebt ? 'springt, solange die Verbindung lebt' : 'springt nicht'}`, z.push === (lebt ? 1 : 0) && z.ereignis === (lebt ? 1 : 0), z)
  }
  for (const lebt of [false, true]) {
    let takte = 0
    const lauf = new Function('verbindungLebt', 'akNetflixSelbstTakt', 'selbstAn', 'durchgangBesitzer', 'meinTab', 'Date', 'bremse', 'taktTun', 'spur', 'laufBeenden', `${funktion('vielleichtSelbstStarten')}\nreturn vielleichtSelbstStarten`)
    await lauf(() => lebt, () => { takte++; return false }, true, null, 'A', Date, {}, {}, () => {}, () => {})()
    pruefe(`Toter Kontext: der Takt ${lebt ? 'läuft, solange die Verbindung lebt' : 'tut nichts'}`, takte === (lebt ? 1 : 0), takte)
  }
}

function teilSperre() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const ansicht = vm.createContext({ console, document: { createElement: (tag) => ({ tag, className: '', textContent: '' }) }, globalThis: null })
  ansicht.globalThis = ansicht
  vm.runInContext(lies('netflix-liste-ansicht.js'), ansicht)
  if (typeof ansicht.akNetflixListeAnsicht.sperren !== 'function') return pruefe('Sperre: akNetflixListeAnsicht.sperren fehlt', false)
  const knopf = () => ({ disabled: false, title: '', textContent: '▶ alle durchgehen' })
  const welt = () => {
    const w = { tot: knopf(), weg: knopf(), selbst: knopf(), kinder: [] }
    w.kasten = { querySelectorAll: (sel) => (/ak-tot/.test(sel) && /ak-staffel-weg/.test(sel) ? [w.tot, w.weg] : []) }
    w.kopf = { appendChild: (e) => w.kinder.push(e) }
    return w
  }
  const w = welt()
  const fremd = k.akNetflixStartHinweis({ tab: 'A', puls: zeit.uhr.t }, 'B', zeit.uhr.t)
  ansicht.akNetflixListeAnsicht.sperren(w.kasten, w.kopf, w.selbst, fremd)
  pruefe('Sperre: in einem fremden Tab sind „nichts da?“ und „Staffel melden“ gesperrt, mit der Begründung am Knopf', w.tot.disabled && w.weg.disabled && /anderen Netflix-Tab/.test(w.tot.title), [w.tot, w.weg])
  pruefe('Sperre: auch der Durchgangs-Knopf ist gesperrt und sagt, wo der Durchgang läuft', w.selbst.disabled && /anderen Tab/.test(w.selbst.textContent), w.selbst)
  pruefe('Sperre: ein kurzer Satz im Kopf sagt, warum', w.kinder.length === 1 && /anderen Tab/.test(w.kinder[0].textContent), w.kinder)
  const frei = welt()
  ansicht.akNetflixListeAnsicht.sperren(frei.kasten, frei.kopf, frei.selbst, k.akNetflixStartHinweis(null, 'B', zeit.uhr.t))
  pruefe('Sperre: ohne fremden Durchgang bleibt alles bedienbar', !frei.tot.disabled && !frei.weg.disabled && !frei.selbst.disabled && frei.kinder.length === 0, frei)
}

/** Der offene Dialog sperrt sich, sobald ein anderer Tab den Durchgang führt, und gibt sich frei, wenn er endet — nicht bei jedem Puls. */
function teilBesitzerWechsel() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const t0 = zeit.uhr.t
  let neuGezeichnet = 0
  const bei = () => neuGezeichnet++
  const puls = (tab, ms) => ({ tab, puls: t0 + ms })
  let b = null
  b = k.akNetflixBesitzerUebernehmen(b, puls('A', 0), 'B', bei)
  pruefe('Besitzer: ein anderer Tab beginnt den Durchgang → der Dialog zeichnet sich neu (gesperrt)', neuGezeichnet === 1, neuGezeichnet)
  b = k.akNetflixBesitzerUebernehmen(b, puls('A', 5000), 'B', bei)
  b = k.akNetflixBesitzerUebernehmen(b, puls('A', 10000), 'B', bei)
  pruefe('Besitzer: die Pulse des anderen Tabs zeichnen nicht neu', neuGezeichnet === 1, neuGezeichnet)
  b = k.akNetflixBesitzerUebernehmen(b, null, 'B', bei)
  pruefe('Besitzer: der andere Tab beendet den Durchgang → der Dialog gibt sich frei', neuGezeichnet === 2 && b === null, [neuGezeichnet, b])
  b = k.akNetflixBesitzerUebernehmen(b, puls('B', 20000), 'B', bei)
  pruefe('Besitzer: der eigene Tab beginnt den Durchgang → keine Sperre, kein Neuzeichnen', neuGezeichnet === 2, neuGezeichnet)
  /* Der echte Listener aus `melder.js`: ein neuer fremder Besitzer lässt den offenen Dialog neu zeichnen, die Pulse danach nicht. */
  const l = listenerBauen(k, 'B', null)
  l.hoere({ netflixDurchgangBesitzer: { newValue: puls('A', 0) } })
  l.hoere({ netflixDurchgangBesitzer: { newValue: puls('A', 5000) } })
  pruefe('Besitzer: der Listener in melder.js zeichnet den Dialog bei einem neuen fremden Besitzer genau einmal neu', l.neuGezeichnet() === 1, l.neuGezeichnet())
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

/**
 * Der Titelfluss des Verlierers: beide Tabs haben den Anspruch gewonnen (das Schreiben von B landet erst nach dem Rücklesen von A, siehe
 * `teilAnspruchGrenzen`) und gehen dieselben elf Titel durch, B 20 ms nach A. Ab dem Landen von B (825 ms) steht B als Besitzer im Speicher;
 * der Takt (eine Sekunde) beendet A. Gezählt wird, was beim Worker ankommt (Posts je Titel). Das ist der Grenzfall, den das Fenster des Anspruchs
 * (300 ms) nicht trägt: die ersten Titel gehen doppelt hinaus, danach nur noch von B.
 */
async function teilVerlierer() {
  const zeit = virtuelleUhr()
  const neuesW = () => ({ posts: [], proben: [], gehe: [], spur: [], beendet: [] })
  const [a, b] = [neuesW(), neuesW()].map((w) => tabAufbauen({ zeit, w, probeMs: () => 200, postMs: () => 300 }))
  let besitzer = { tab: 'A', puls: zeit.uhr.t }
  zeit.setTimeoutV(() => { besitzer = { tab: 'B', puls: zeit.uhr.t } }, 825)
  let endeA = null
  const takt = (tab, name) => tab.k.akNetflixBesitz({ selbstAn: tab.bauteil.laeuft(), besitzer, tab: name, jetzt: zeit.uhr.t }, {
    schreiben() {},
    beenden: (grund) => {
      tab.w.beendet.push(grund)
      tab.bauteil.aus()
      if (name === 'A') endeA = zeit.uhr.t
    },
  })
  const tickt = () => zeit.setTimeoutV(() => { takt(a, 'A'); takt(b, 'B'); tickt() }, 1000)
  tickt()
  const t0 = zeit.uhr.t
  a.starten()
  await zeit.vor(20)
  b.starten()
  await zeit.vor(30000)
  const ids = [...a.w.posts, ...b.w.posts].map(([id]) => id)
  const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i)
  console.log(`   Verlierer: A ${a.w.posts.length} Posts (beendet nach ${endeA - t0} ms), B ${b.w.posts.length} Posts, doppelt: ${JSON.stringify(doppelt)}`)
  pruefe('Verlierer: A endet binnen zwei Takten (2 s) mit dem Grund „anderer Tab“, B läuft weiter', endeA !== null && endeA - t0 <= 2000 && /anderen Tab/.test(a.w.beendet.join()) && b.bauteil.laeuft(), [endeA - t0, a.w.beendet])
  pruefe('Verlierer: nach dem Ende meldet A nichts mehr', a.w.posts.every(([, t]) => t <= endeA), a.w.posts)
  pruefe('Verlierer: B meldet jeden der zehn Titel mit Umleitung genau einmal', b.w.posts.length === 10 && new Set(b.w.posts.map(([id]) => id)).size === 10, b.w.posts.map(([id]) => id))
  pruefe('Verlierer: A meldet nur vor dem Landen von Bs Eintrag (825 ms) und nie danach', a.w.posts.length > 0 && a.w.posts.every(([, zeit]) => zeit - t0 < 825), a.w.posts)
  pruefe('Verlierer: doppelt gemeldet werden nur Titel, die A vor dem Landen von Bs Eintrag begonnen hat (Grenzfall: Schreiben 800 ms)', doppelt.length > 0 && doppelt.every((id) => a.w.posts.some(([x, zeit]) => x === id && zeit - t0 < 825)), doppelt)
}

/** Tab A springt zu X, Tab B klickt Y (gemeinsamer Platz), Tab A lädt voll neu: das Ziel bleibt X (A7 aus PR 4109, Issue 4071). */
async function teilVollNeuladen() {
  const k = kontextBauen(virtuelleUhr())
  const sprungAnfang = melder.indexOf('  const sprung = { id: String(naechster)')
  const sprungBlock = melder.slice(sprungAnfang, melder.indexOf('\n}\n', sprungAnfang))
  const springen = (id, tab) =>
    new Function('naechster', 'meinTab', 'Date', 'titelBericht', 'speicherSchreiben', 'nichtDaTun', 'akNetflixEigenerSprungMerken', `let zuletztGeoeffnet\n${sprungBlock}\nreturn { zuletztGeoeffnet }`)(
      id, tab, k.Date, { beginn() {} }, () => {}, { sprung() {} }, k.akNetflixEigenerSprungMerken,
    )
  const a = springen('X', 'A')
  pruefe('Sprung: Tab A merkt sich seinen Sprung und legt ihn in seinen sessionStorage', a.zuletztGeoeffnet?.id === 'X' && JSON.parse(k.sessionStorage.getItem('ak-netflix-eigener-sprung') ?? 'null')?.id === 'X', a.zuletztGeoeffnet)
  const klickB = klickEintraege('B', 'Y')[0]
  const von = melder.indexOf('const erledigtGeladen = Promise.resolve(')
  const laden = melder.slice(von, melder.indexOf('\n  })\n', melder.indexOf('.catch(', von)) + 5)
  const neuladen = (tab, laeuft, gemeinsam = klickB) =>
    new AsyncFunction('globalThis', 'akNetflixSprungLaden', 'meinTab', 'selbstAn', `let erledigt, anbieterStaffeln, zuletztGeoeffnet, netflixWeiterleitungen, durchgangBesitzer\n${laden}\nawait erledigtGeladen\nreturn zuletztGeoeffnet`)(
      { akKontext: { lesen: async () => ({ zuletztGeoeffnet: gemeinsam }) } }, k.akNetflixSprungLaden, tab, laeuft,
    )
  pruefe('Voller Neuladen: Tab A (Durchgang läuft) behält Ziel X, obwohl der gemeinsame Platz Bs Klick Y trägt', (await neuladen('A', true))?.id === 'X', await neuladen('A', true))
  pruefe('Voller Neuladen: Tab B (kein Durchgang) übernimmt seinen eigenen Klick Y', (await neuladen('B', false))?.id === 'Y')
  pruefe('Voller Neuladen: ein anderer Durchgangs-Tab C hat keinen eigenen Sprung und bleibt ohne Ziel', (await neuladen('C', true)) === null, await neuladen('C', true))
  pruefe('Voller Neuladen ohne laufenden Durchgang: der gemerkte Sprung gilt nicht (nur im Durchgangs-Tab)', (await neuladen('A', false, null)) === null, await neuladen('A', false, null))
  k.akNetflixLaufVergessen()
  pruefe('Ende des Durchgangs: der gemerkte Sprung ist weg', k.sessionStorage.getItem('ak-netflix-eigener-sprung') === null)
}

/** Der Rückruf beim Laden (`erledigtGeladen`) aus `melder.js` und der Block in `merkeErledigt`, der den Klick-Eintrag liest: beide filtern mit dem Zustand des Tabs. */
async function teilEintragLesen() {
  const k = kontextBauen(virtuelleUhr())
  const von = melder.indexOf('const erledigtGeladen = Promise.resolve(')
  const laden = melder.slice(von, melder.indexOf('\n  })\n', melder.indexOf('.catch(', von)) + 5)
  const geladen = (eintrag, tab, laeuft) =>
    new AsyncFunction('globalThis', 'akNetflixSprungLaden', 'meinTab', 'selbstAn', `let erledigt, anbieterStaffeln, zuletztGeoeffnet, netflixWeiterleitungen, durchgangBesitzer\n${laden}\nawait erledigtGeladen\nreturn zuletztGeoeffnet`)(
      { akKontext: { lesen: async () => ({ zuletztGeoeffnet: eintrag }) } }, k.akNetflixSprungLaden, tab, laeuft,
    )
  const fremd = { id: 'Y', zeit: 4000, tab: 'B' }
  pruefe('Laden: im Durchgangs-Tab gilt ein fremder Klick nicht', (await geladen(fremd, 'A', true)) === null, await geladen(fremd, 'A', true))
  pruefe('Laden: im Tab ohne Durchgang gilt der Klick des öffnenden Tabs', (await geladen(fremd, 'A', false))?.id === 'Y')
  pruefe('Laden: im Durchgangs-Tab gilt der eigene Eintrag', (await geladen({ ...fremd, tab: 'A' }, 'A', true))?.id === 'Y')
  /* `merkeErledigt` ordnet eine unbekannte Kennung dem zuletzt geöffneten Titel zu (10 Minuten): ein fremder Klick darf es im Durchgangs-Tab nicht. */
  const start = melder.indexOf('  if (offeneTitel[String(id)] === undefined) {', melder.indexOf('async function merkeErledigt('))
  const block = melder.slice(start, melder.indexOf('\n  if (!staffel) {', start))
  const kennung = (eintrag, tab, laeuft) =>
    new AsyncFunction('id', 'offeneTitel', 'speicherLesen', 'akNetflixEigenerSprung', 'meinTab', 'selbstAn', 'Date', `${block}\nreturn id`)(
      'X', { Y: {} }, async () => ({ zuletztGeoeffnet: eintrag }), k.akNetflixEigenerSprung, tab, laeuft, { now: () => 5000 },
    )
  pruefe('Zuordnung: im Durchgangs-Tab ordnet ein fremder Klick die Kennung nicht zu', (await kennung(fremd, 'A', true)) === 'X', await kennung(fremd, 'A', true))
  pruefe('Zuordnung: der Tab, der geklickt hat, bekommt seinen Titel', (await kennung(fremd, 'B', false)) === 'Y')
  pruefe('Zuordnung: ein Tab ohne Durchgang folgt dem Klick des öffnenden Tabs', (await kennung(fremd, 'A', false)) === 'Y')
}

/** Der Anspruch bei langsamem Speicher: was das Fenster von 300 ms trägt und was erst der Takt auflöst. */
async function teilAnspruchGrenzen() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  /* Grenzfall: A landet nach 255 ms, B klickt bei 150 ms und landet bei 405 ms, also binnen 300 ms nach A. */
  const grenze = gemeinsamerSpeicher(zeit, 5, 250)
  const g = ['A', 'B'].map((name) => tabKulisse({ zeit, speicher: grenze, name, k }))
  void g[0].klick()
  await zeit.vor(150)
  void g[1].klick()
  await zeit.vor(2000)
  pruefe('Grenze: B landet 150 ms nach A (Schreiben 250 ms): genau ein Start', g[0].t.starts + g[1].t.starts === 1, g.map((x) => x.t.starts))
  /* Langsamer: A landet bei 455 ms, B (Schreiben 800 ms) erst bei 825 ms, nach dem Rücklesen von A (760 ms): beide starten, der Takt beendet den Verlierer. */
  const z2 = virtuelleUhr()
  const k2 = kontextBauen(z2)
  const lang = gemeinsamerSpeicher(z2, 5, (tab) => (tab === 'A' ? 450 : 800))
  const t = ['A', 'B'].map((name) => tabKulisse({ zeit: z2, speicher: lang, name, k: k2 }))
  void t[0].klick()
  await z2.vor(20)
  void t[1].klick()
  await z2.vor(1500)
  pruefe('Langsamer Speicher: landet ein Schreiben nach dem Rücklesen des anderen, starten beide (das Fenster trägt nicht)', t[0].t.starts === 1 && t[1].t.starts === 1, t.map((x) => x.t.starts))
  for (let i = 0; i < 2; i++) {
    await z2.vor(1000)
    t.forEach((x) => x.bauteil.takt())
  }
  await z2.vor(500)
  const laufen = t.filter((x) => x.bauteil.laeuft())
  pruefe('Langsamer Speicher: nach zwei Takten (2 s) läuft genau ein Durchgang, der des Besitzers im Speicher', laufen.length === 1 && laufen[0].t.name === lang.daten.netflixDurchgangBesitzer?.tab, [laufen.map((x) => x.t.name), lang.daten.netflixDurchgangBesitzer])
}

async function teilKlickWege() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const speicher = gemeinsamerSpeicher(zeit)
  const a = tabKulisse({ zeit, speicher, name: 'A', k })
  void a.klick()
  await zeit.vor(60)
  void a.klick()
  await zeit.vor(2000)
  pruefe('Doppelklick: zwei Klicks im selben Tab, 60 ms auseinander, starten einmal', a.t.starts === 1, a.t.starts)
  /* Ein Speicher, der das Schreiben stillschweigend ablehnt: „frei“ ist kein Sieg. */
  const z2 = virtuelleUhr()
  const stumm = tabKulisse({ zeit: z2, speicher: gemeinsamerSpeicher(z2), name: 'S', k: kontextBauen(z2), schreibtNicht: true })
  void stumm.klick()
  await z2.vor(2000)
  pruefe('Schreiben abgelehnt: kein Start, der Knopf sagt es', stumm.t.starts === 0 && /nicht gelungen/.test(stumm.knopf.textContent), stumm.knopf)
}

/** `laufBeenden` gibt nur den eigenen Besitz frei (A2). */
async function teilBesitzerEnde() {
  const zeit = virtuelleUhr()
  const k = kontextBauen(zeit)
  const speicher = gemeinsamerSpeicher(zeit)
  const b = tabKulisse({ zeit, speicher, name: 'B', k })
  void speicher.kontextFuer('A').schreiben({ netflixDurchgangBesitzer: { tab: 'A', puls: zeit.uhr.t } })
  await zeit.vor(200)
  b.bauteil.anschalten()
  const vorher = speicher.schreibungen
  b.bauteil.laufBeenden('Fehler: Test')
  await zeit.vor(300)
  pruefe('Ende unter fremdem Besitz: Tab B lässt den Speicher unberührt', speicher.schreibungen === vorher && speicher.daten.netflixDurchgangBesitzer?.tab === 'A', [speicher.schreibungen - vorher, speicher.daten.netflixDurchgangBesitzer])
  const z2 = virtuelleUhr()
  const s2 = gemeinsamerSpeicher(z2)
  const [a, c] = ['A', 'C'].map((name) => tabKulisse({ zeit: z2, speicher: s2, name, k: kontextBauen(z2) }))
  void a.klick()
  await z2.vor(500)
  void a.klick()
  await z2.vor(500)
  pruefe('Ende von Hand: der Besitzer gibt ihn frei', s2.daten.netflixDurchgangBesitzer === null && !a.bauteil.laeuft(), s2.daten.netflixDurchgangBesitzer)
  void c.klick()
  await z2.vor(1000)
  pruefe('Ende von Hand: ein anderer Tab startet sofort danach', c.t.starts === 1, c.t.starts)
}

/* Ein Fall, der auf eine Antwort wartet, die nie kommt, lässt den Prozess still mit Exit 0 enden: das gilt als rot. */
let durchgelaufen = false
process.on('exit', (code) => {
  if (!durchgelaufen && code === 0) {
    console.log('  ✗ der Test lief nicht bis zum Ende (ein Aufruf wartete auf eine Antwort, die nie kam)')
    process.exitCode = 1
  }
})

async function haupt() {
  console.log('Netflix: ein Durchgang je Browser, andere Tabs stören nicht (4071, Schnitt 2)')
  await teilStart()
  await teilAnspruchGrenzen()
  await teilKlickWege()
  await teilBesitzerEnde()
  await teilEintragLesen()
  await teilVollNeuladen()
  await teilVerlierer()
  await teilBesitzerFrist()
  teilFremderKlick()
  await teilToterKontext()
  await teilTotWaechter()
  teilSperre()
  teilBesitzerWechsel()
  durchgelaufen = true
  if (fehler.length) {
    console.log(`\n${fehler.length} Fall/Fälle rot`)
    process.exit(1)
  }
  console.log('\nNetflix mehrere Tabs: alle Fälle grün')
}

haupt().catch((e) => {
  console.error(e)
  process.exit(1)
})
