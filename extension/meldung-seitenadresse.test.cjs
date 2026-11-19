/**
 * Jede Meldung der Erweiterung trägt die Adresse der Seite, auf der sie entstand (19.11.2026, Migration 066).
 *
 * Anlass: Meldung 27504 meldete „weg“ für Landei II, weil das Panel noch den Titel der vorigen Seite trug; ~70 „weg“-Meldungen
 * ohne Sprachen waren nicht prüfbar, weil sie nicht sagten, wo sie entstanden. Geprüft: die Regel in `kontext.js` (ohne Suchteil
 * und Anker) und die Netflix-Wege mit der echten `melder.js` im Sandkasten: Handmeldung (`melden`), „nicht bei Netflix“
 * (`totMelden`), Staffel weg (`staffelWegMelden`). Prime, Disney+ und ADN prüfen `titel-verlassen.test.cjs` und `adn.test.cjs`
 * an ihren Sendestellen. Gegenstück im Worker: `tools/worker-meldung-seitenadresse.test.ts`.
 */
const vm = require('node:vm')
const { readFileSync } = require('node:fs')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const { baueUmgebung } = require('./test-melder-sandkasten.cjs')
const { kontextNeu, lies, ausschnitt } = require('./melde-geruest.cjs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}
const tick = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r))
}
const ID = '80000001'
const LISTE = { [ID]: { titel: 'Eins', staffeln: [{ nr: 1, folgen: 1, film: false, offen: true }] } }

async function szene(pfad, suche) {
  const { umgebung, body } = baueUmgebung(pfad, suche, {})
  umgebung.AbortController = AbortController
  umgebung.setTimeout = (fn) => { if (typeof fn === 'function') setImmediate(fn); return 0 }
  umgebung.history = { pushState() {}, replaceState() {} }
  umgebung.PopStateEvent = class { constructor(t) { this.type = t } }
  const kontext = vm.createContext(umgebung)
  ladeSkripte(kontext, skripteBis('melder.js').slice(0, -1))
  umgebung.AK_OFFENE_TITEL = LISTE
  ladeSkripte(kontext, ['melder.js', 'netflix-bericht.js'])
  const posts = []
  umgebung.fetch = async (adresse, init) => {
    if (init?.method === 'POST') posts.push(JSON.parse(init.body))
    if (String(adresse).includes('stand=1')) return { ok: true, json: async () => ({ anbieter: [] }) }
    return { ok: true, json: async () => ({ paare: [] }), text: async () => '' }
  }
  await tick()
  const im = (code) => vm.runInContext(code, kontext)
  im(`stand.reihe = '${ID}'`)
  im('zeigeErgebnis = () => {}')
  return { im, posts, body }
}

async function netflix() {
  console.log('Netflix: Seite im Rumpf (Player-Adresse mit Suchteil und Anker)')
  const s = await szene('/watch/81234567', '?trackId=14170286#s2')
  const wege = {}
  const weg = async (name, code) => {
    const von = s.posts.length
    await s.im(code)
    await tick()
    wege[name] = s.posts.slice(von)
  }
  s.body.innerText = 'Erinnern Ab 19. November'
  await weg('melden', 'melden()')
  await weg('tot', `totMelden('${ID}', 'Eins', 'Umleitung auf Startseite')`)
  await weg('staffelWeg', `staffelWegMelden('${ID}', { nr: 1 }, 501, 'Eins')`)
  const seite = 'https://www.netflix.com/watch/81234567'
  for (const name of ['melden', 'tot', 'staffelWeg']) {
    const p = wege[name]
    pruefe(`${name}: genau eine Meldung, Seite ohne Suchteil und Anker`, p.length === 1 && p[0].plattform === 'netflix' && p[0].seitenAdresse === seite, p)
  }
}

function kontextRegel() {
  console.log('kontext.js: seitenAdresse()')
  const adresse = (href) => {
    const welt = vm.createContext({ location: { href } })
    vm.runInContext(readFileSync(__dirname + '/kontext.js', 'utf8'), welt)
    return welt.akKontext.seitenAdresse()
  }
  pruefe('Suchteil weg', adresse('https://www.amazon.de/dp/B0ABC12345?ref_=x&k=y') === 'https://www.amazon.de/dp/B0ABC12345')
  pruefe('Anker weg', adresse('https://www.netflix.com/title/81000001#s2') === 'https://www.netflix.com/title/81000001')
  pruefe('Suchteil und Anker weg', adresse('https://x.test/a?b=1#c') === 'https://x.test/a')
  pruefe('ohne beides unverändert', adresse('https://x.test/a/b') === 'https://x.test/a/b')
}

/** Prime „führt diesen Titel nicht“ (`nichtBeiPrimeMelden`): die einzige Prime-Meldung, die nicht im Klick-Handler steht. */
async function primeNichtDa() {
  console.log('Prime: „nicht bei Prime“ von der Suchseite')
  const text = lies('amazon.js')
  const kopf = 'async function nichtBeiPrimeMelden(auftrag, befund, knopf, nachher) {'
  const funktion = ausschnitt(text, kopf, '\n  }\n')
  pruefe('Funktion im Quelltext gefunden', funktion !== '', kopf)
  const gesendet = []
  const kontext = kontextNeu(() => ({}))
  kontext.lesen = async () => ({ token: 'tok' })
  const welt = {
    globalThis: { akKontext: kontext },
    WORKER: 'https://worker.test/pruefung',
    fetch: async (url, init) => (gesendet.push(JSON.parse(init.body)), { ok: true }),
    suchAbhaken: async () => {},
    uebersichtZeichnen: () => {},
  }
  const knopf = { classList: { add() {} } }
  const lauf = new Function(...Object.keys(welt), `return async function nichtBeiPrimeMelden(auftrag, befund, knopf, nachher) {${funktion}`)(...Object.values(welt))
  await lauf({ suchUrl: 'https://www.amazon.de/s?k=Landei', titel: 'Landei II' }, { art: 'liste' }, knopf, null)
  pruefe('eine Meldung, mit Seite (Kulisse: …/dp/B0KULISSE1, ohne Suchteil und Anker)', gesendet.length === 1 && gesendet[0].seitenAdresse === 'https://www.amazon.de/dp/B0KULISSE1', [gesendet, knopf.textContent])
}

async function lauf() {
  kontextRegel()
  await netflix()
  await primeNichtDa()
  const fehlt = faelle.filter((ok) => !ok).length
  console.log(`meldung-seitenadresse.test.cjs — ${faelle.length} Zusicherungen`)
  process.exit(fehlt ? 1 : 0)
}
lauf()
