/**
 * Einklappbarer Kasten (box.js, 4.24.17, Daniel 09.10.2026): Badge-Text, Standardzustand
 * und dass jeder Melder die Zahl seiner eigenen Prüfliste meldet (keine zweite Zählung).
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = (n) => readFileSync(resolve(__dirname, n), 'utf8')

console.log('Zusicherungen zum einklappbaren Kasten (09.10.2026)\n')

const kontext = {
  location: { hostname: 'www.netflix.com', pathname: '/title/1' },
  document: { documentElement: { classList: { toggle() {} } } },
  window: { addEventListener() {}, navigation: { addEventListener() {} } },
}
vm.createContext(kontext)
vm.runInContext(lies('box.js') + '\nthis.t = { akBadgeText, akZuAusSpeicher }', kontext)
const { akBadgeText, akZuAusSpeicher } = kontext.t

pruefe('Badge: keine Auskunft -> leer', akBadgeText(null) === '' && akBadgeText(undefined) === '')
pruefe('Badge: 0 -> Häkchen', akBadgeText(0) === '✓')
pruefe('Badge: 7 -> 7', akBadgeText(7) === '7')
pruefe('Badge: 99 -> 99, 100 und 123 -> 99+', akBadgeText(99) === '99' && akBadgeText(100) === '99+' && akBadgeText(123) === '99+')
pruefe('Standard (nichts gespeichert) ist eingeklappt', akZuAusSpeicher(undefined) === true)
pruefe('Nur gespeichertes false klappt aus', akZuAusSpeicher(false) === false && akZuAusSpeicher(true) === true)

/* Klick im Pflichtfall (Durchgang): kein Kippen, kein Schreiben. */
{
  const geschrieben = []
  const fenster = []
  /* Netflix-Profilauswahl: die Seite stoppt click vor dem Knopf (Messung 03.11.2026) — nur der
     Capture-Listener am Fenster, der vor allen Seiten-Listenern läuft, erreicht den Klick. */
  const klicke = (ziel) => {
    for (const f of fenster) f({ target: ziel })
  }
  const el = () => ({
    appendChild() {}, contains(x) { return x === this }, classList: { toggle() {}, contains: () => false }, querySelectorAll: () => [],
  })
  const k = {
    location: { hostname: 'www.disneyplus.com', pathname: '/' },
    document: { documentElement: { classList: { toggle() {}, contains: () => false }, appendChild() {} }, body: el(), createElement: el, querySelectorAll: () => [] },
    window: { addEventListener(a, f, capture) { if (a === 'click' && capture) fenster.push(f) }, navigation: { addEventListener() {} } },
    chrome: { storage: { local: { get: () => ({ then() {} }), set: (o) => geschrieben.push(o) }, onChanged: { addListener() {} } } },
    MutationObserver: class { observe() {} },
    requestAnimationFrame: () => 0,
  }
  vm.createContext(k)
  vm.runInContext(lies('box.js') + '\nakIconStarten(); this.t = { akZaehler, icon: akIcon, zu: () => akZu }', k)
  k.t.akZaehler(null, 3, true)
  klicke(k.t.icon)
  pruefe('Pflichtfall: Klick kippt nichts und schreibt nichts', k.t.zu() === true && geschrieben.length === 0, geschrieben)
  pruefe('Pflichtfall: Icon ist aria-disabled', k.t.icon.ariaDisabled === 'true')
  k.t.akZaehler(null, 3, false)
  klicke(k.t.icon)
  pruefe('ohne Pflicht kippt der Klick und schreibt', k.t.zu() === false && geschrieben.length === 1, geschrieben)
  klicke({})
  pruefe('Klick woanders kippt nichts', geschrieben.length === 1, geschrieben)
  pruefe('Ein Klick, eine Aktion: genau ein Fenster-Listener', fenster.length === 1, fenster.length)
}

const melder = lies('melder.js')
const disney = lies('disney.js')
const amazon = lies('amazon.js')
pruefe('Netflix meldet offeneAdressen (Quelle des Knopfes „Anime-Kalender N“)', /akZaehler\(uebersichtKnopf, offeneAdressen\)/.test(melder))
pruefe('Disney+ meldet nochOffen (Quelle des Knopfes „N offen“)', /nochOffen = akZaehler\(null, /.test(disney))
pruefe('Prime meldet gesamt (Quelle des Knopfes „N Prime-Titel offen“)', /akZaehler\(uebersichtKnopf, gesamt, /.test(amazon))
pruefe('Kein Melder zählt selbst für das Badge', !/akBadgeText|akZahl\s*=/.test(melder + disney + amazon))
pruefe('Kein neuer Berechtigungsbedarf: nur storage', JSON.parse(lies('manifest.json')).permissions.join() === 'storage')

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlles grün.')
