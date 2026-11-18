/**
 * Jede Netflix-Meldung an den Worker trägt die Erweiterungsversion (18.11.2026).
 *
 * Anlass: Am 18.11. kamen 152 falsche Umleitungsmeldungen; welche Version sie erzeugt hatte, war nicht feststellbar. Geprüft wird mit der
 * echten `melder.js` im Sandkasten an den Stellen, die den Rumpf bauen: Handmeldung (`melden`), „nicht bei Netflix“ (`totMelden`),
 * Staffel weg (`staffelWegMelden`) und die gebündelten Zurückstellungen (`?zurueck=1`). Ohne Version (toter Kontext, alte Erweiterung)
 * fehlt das Feld, die Meldung geht trotzdem raus. Gegenstück im Worker: `tools/worker-meldung-version.test.ts`.
 */
const vm = require('node:vm')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const { baueUmgebung } = require('./test-melder-sandkasten.cjs')

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

/** Eine Netflix-Seite; `version`: was `chrome.runtime.getManifest()` liefert (`undefined` = die Funktion fehlt wie in alten Sandkästen). */
async function szene(version) {
  const { umgebung, body } = baueUmgebung(`/title/${ID}`, '', {})
  if (version !== undefined) umgebung.chrome.runtime.getManifest = () => ({ version })
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

/** Die vier Wege, die eine Meldung bauen; gibt je Weg die gesendeten Rümpfe zurück. */
async function sendeAlle(version) {
  const s = await szene(version)
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
  s.body.innerText = 'Erinnern'
  await weg('zurueck', 'melden()')
  return wege
}

async function lauf() {
  console.log('Mit Version (Manifest 4.32.0)')
  const mit = await sendeAlle('4.32.0')
  for (const name of ['melden', 'tot', 'staffelWeg']) {
    const p = mit[name]
    pruefe(`${name}: genau eine Meldung, Version 4.32.0`, p.length === 1 && p[0].plattform === 'netflix' && p[0].version === '4.32.0', p)
  }
  pruefe('Zurückstellungen (?zurueck=1): Version neben den Einträgen, nicht darin', mit.zurueck.length >= 1 && mit.zurueck.every((p) => p.eintraege && p.version === '4.32.0' && !Object.values(p.eintraege).some((e) => 'version' in e)), mit.zurueck)

  console.log('\nOhne Version (toter Kontext oder Manifest ohne Angabe)')
  const ohne = await sendeAlle(undefined)
  for (const name of ['melden', 'tot', 'staffelWeg']) {
    const p = ohne[name]
    pruefe(`${name}: Meldung geht raus, ohne Versionsfeld`, p.length === 1 && p[0].plattform === 'netflix' && !('version' in p[0]), p)
  }
  pruefe('Zurückstellungen: gehen raus, Version leer', ohne.zurueck.length >= 1 && ohne.zurueck.every((p) => p.eintraege && (p.version ?? null) === null), ohne.zurueck)

  const fehlt = faelle.filter((ok) => !ok).length
  console.log(`netflix-meldung-version.test.cjs — ${faelle.length} Zusicherungen`)
  process.exit(fehlt ? 1 : 0)
}
lauf()
