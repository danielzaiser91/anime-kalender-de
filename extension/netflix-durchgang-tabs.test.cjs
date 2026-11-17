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
const { lies, melder, funktion, virtuelleUhr, kontextBauen, durchgang } = require('./test-durchgang-welt.cjs')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

/** Ein gemeinsamer Speicher (`chrome.storage.local`): Lesen braucht 5 ms, Schreiben 80 ms auf der virtuellen Uhr (so liest ein Tab zurück, bevor das Schreiben des anderen ankommt); Schreiben benachrichtigt alle Tabs. */
function gemeinsamerSpeicher(zeit, lesenMs = 5, schreibenMs = 80) {
  const s = { daten: {}, hoerer: [] }
  s.kontextFuer = (tab) => ({
    lebt: () => true,
    lesen: async (schluessel) => {
      await zeit.warte(lesenMs)
      const keys = Array.isArray(schluessel) ? schluessel : [schluessel]
      return Object.fromEntries(keys.filter((k) => k in s.daten).map((k) => [k, s.daten[k]]))
    },
    schreiben: async (werte) => {
      await zeit.warte(schreibenMs)
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

/** Ein Tab, der nur `selbstKlick` aus `melder.js` kennt: `laufStarten` zählt (und setzt `selbstAn`), `taktTun.schreiben` schreibt den Besitz wie der Takt. */
function tabKulisse({ zeit, speicher, name, k, lebt = true }) {
  const kontext = { ...speicher.kontextFuer(name), lebt: () => lebt }
  const t = { name, starts: 0, hinweise: [] }
  const bauen = new Function(
    'akNetflixStartHinweis', 'akNetflixBesitzAnspruch', 'globalThis', 'meinTab', 'taktTun', 'selbstUebersprungen', 'dialogSchliessen', 'laufBeenden', 'setTimeout', 'Date', 't',
    `let selbstAn = false
let durchgangBesitzer = null
const laufStarten = () => { t.starts++; selbstAn = true; return true }
${funktion('selbstKlick')}
return { selbstKlick, besitzerSetzen: (b) => { durchgangBesitzer = b } }`,
  )
  const taktTun = { schreiben: (b) => void kontext.schreiben({ netflixDurchgangBesitzer: b }) }
  const bauteil = bauen(
    k.akNetflixStartHinweis, k.akNetflixBesitzAnspruch, { akKontext: kontext }, name, taktTun, { keinAuftrag: () => ({ text: 'kein Auftrag', title: '' }) },
    () => {}, () => {}, (fn, ms) => zeit.setTimeoutV(fn, ms), k.Date, t,
  )
  /* Jede Änderung des Besitzers erreicht auch das Abbild dieses Tabs (`onChanged`). */
  speicher.hoerer.push((a) => { if (a.netflixDurchgangBesitzer) bauteil.besitzerSetzen(a.netflixDurchgangBesitzer.newValue ?? null) })
  const knopf = { textContent: '▶ alle durchgehen', title: '', disabled: false }
  return { t, knopf, klick: () => Promise.resolve(bauteil.selbstKlick(knopf)), kontext }
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
  const bauen = new Function(
    'globalThis', 'akNetflixEigenerSprung', 'akNetflixSprungUebernehmen', 'akNetflixStartHinweis', 'meinTab', 'uebersichtZeigen', 'dialogNeuZeichnen', 'start', 'laeuft',
    `let zuletztGeoeffnet = start
let selbstAn = laeuft
let durchgangBesitzer = null
let anbieterStaffeln = {}
let erledigt = {}
${text}
return { gerade: () => zuletztGeoeffnet }`,
  )
  const lauf = bauen({ akKontext: { beiAenderung: (fn) => (hoerer = fn) } }, k.akNetflixEigenerSprung, k.akNetflixSprungUebernehmen, k.akNetflixStartHinweis, meinTab, () => {}, () => {}, start, laeuft)
  return { gerade: lauf.gerade, hoere: (a) => hoerer(a, 'local') }
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
  pruefe('Laden: der Durchgangs-Tab fragt beim Laden mit seinem Zustand (fremde Klicks gelten dort nicht)', /akNetflixEigenerSprung\(x\.zuletztGeoeffnet, meinTab, selbstAn\)/.test(melder))
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
  pruefe('Sperre: der Dialog in melder.js ruft sie mit dem Besitzer dieses Tabs auf', /akNetflixListeAnsicht\.sperren\(kasten, ansicht\.kopf, selbst, akNetflixStartHinweis\(durchgangBesitzer, meinTab, Date\.now\(\)\)\)/.test(melder))
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
  pruefe('Besitzer: der Listener in melder.js reicht den Besitzer durch diese Funktion', /durchgangBesitzer = akNetflixBesitzerUebernehmen\(durchgangBesitzer, aenderungen\.netflixDurchgangBesitzer\.newValue \?\? null, meinTab, \(\) => setTimeout\(dialogNeuZeichnen, 0\)\)/.test(melder))
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
