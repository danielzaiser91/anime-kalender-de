/**
 * **Stumm von Anfang an** (4.31.14, 24.10.2026): `netflix-stumm-seite.js` (Seitenwelt) stellt im Durchgang
 * `play()` und `muted = false` der Seite um, bevor ein Ton entsteht. Fake-Medium mit Prototyp, so wie
 * `HTMLMediaElement.prototype` ihn hat; Zeit fest (kein `Date.now()`).
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}`)
}

console.log('Netflix: Seitenwelt stummt vor dem Ton')

const JETZT = 1_800_000_000_000
const quelle = readFileSync(resolve(__dirname, 'netflix-stumm-seite.js'), 'utf8')
const stummQuelle = readFileSync(resolve(__dirname, 'netflix-stumm.js'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'))

const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(quelle, kontext)
vm.runInContext(stummQuelle, kontext)

pruefe('Schlüssel und Frist wie in netflix-stumm.js', quelle.includes(`'${kontext.akNetflixLauf.schluessel}'`) && quelle.includes('6 * 60 * 60 * 1000') && kontext.akNetflixLauf.hoechstensMs === 21600000)
const gruppe = manifest.content_scripts.find((g) => g.js.includes('netflix-stumm-seite.js'))
pruefe('Manifest: Seitenwelt, document_start, nur Netflix ohne /tudum/', gruppe?.world === 'MAIN' && gruppe.run_at === 'document_start' && gruppe.matches.join() === 'https://www.netflix.com/*' && gruppe.exclude_matches.includes('https://www.netflix.com/tudum/*'))

/** Baut einen Prototyp wie HTMLMediaElement und installiert den Eingriff darauf. */
function aufbau({ pfad = '/watch/81234567', lauf = JETZT - 1000 } = {}) {
  class Medium {
    constructor(muted = false) {
      this._muted = muted
      this.attribute = new Set()
      this.mutedBeiPlay = null
    }
    get muted() { return this._muted }
    set muted(w) { this._muted = Boolean(w) }
    play() { this.mutedBeiPlay = this._muted; return Promise.resolve() }
    setAttribute(n) { this.attribute.add(n) }
    hasAttribute(n) { return this.attribute.has(n) }
    removeAttribute(n) { this.attribute.delete(n) }
  }
  const speicher = new Map(lauf === null ? [] : [['ak-netflix-lauf', String(lauf)]])
  kontext.akNetflixStummSeite({
    proto: Medium.prototype,
    speicher: { getItem: (k) => speicher.get(k) ?? null },
    ort: { pathname: pfad },
    jetzt: () => JETZT,
  })
  return { Medium, speicher }
}

/* 1. Video lag vor Skriptstart schon im DOM (laut): play() der Seite -> beim Abspielen schon stumm. */
{
  const { Medium } = aufbau()
  const v = new Medium(false)
  v.play()
  pruefe('play(): Video ist beim Start schon stumm', v.mutedBeiPlay === true)
  pruefe('play(): war laut -> markiert', v.hasAttribute('data-ak-war-laut'))
}

/* 2. Nachträglich erzeugtes Video (new Medium nach Installation), Seite setzt muted = false und spielt. */
{
  const { Medium } = aufbau()
  const v = new Medium(true)
  v.muted = false
  pruefe('Seite setzt muted = false: bleibt stumm', v.muted === true)
  pruefe('Seite setzt muted = false auf stummem Video: nicht als laut markiert', !v.hasAttribute('data-ak-war-laut'))
  const w = new Medium(false)
  w.muted = false
  pruefe('muted = false auf lautem Video: wird stumm und markiert', w.muted === true && w.hasAttribute('data-ak-war-laut'))
  w.muted = true
  pruefe('muted = true bleibt erlaubt', w.muted === true)
}

/* 3. Zusammenspiel: netflix-stumm.js gibt markierten Videos den Ton nach dem Durchgang zurück, Daniels stumme bleiben stumm. */
{
  const { Medium, speicher } = aufbau()
  const hoerer = {}
  const uhren = []
  const lauf = kontext.akNetflixStummStarten({
    fenster: { location: { pathname: '/watch/1' }, addEventListener: (a, f) => { hoerer[a] = f } },
    dokument: { documentElement: {} },
    speicher: { getItem: (k) => speicher.get(k) ?? null },
    beobachter: { observe() {} },
    takt: (f) => uhren.push(f),
    taktStopp: () => {},
  })
  const laut = new Medium(false)
  laut.play()
  hoerer.play({ target: Object.assign(laut, { tagName: 'VIDEO' }) })
  const leise = new Medium(true)
  hoerer.play({ target: Object.assign(leise, { tagName: 'VIDEO' }) })
  speicher.delete('ak-netflix-lauf')
  lauf.zurueck()
  pruefe('Nach dem Durchgang: vorher lautes, von der Seitenwelt gestummtes Video hat Ton', laut.muted === false && !laut.hasAttribute('data-ak-war-laut'))
  pruefe('Nach dem Durchgang: vorher stummes Video bleibt stumm', leise.muted === true)
}

/* 4. Gegenproben: kein Durchgang, Titelseite, abgelaufen -> alles wie sonst. */
for (const [name, opt] of [
  ['ohne Durchgang', { lauf: null }],
  ['auf Titelseite', { pfad: '/title/81234567' }],
  ['abgelaufen (> 6 Stunden)', { lauf: JETZT - 6 * 60 * 60 * 1000 - 1000 }],
  ['Frist genau 6 Stunden', { lauf: JETZT - 6 * 60 * 60 * 1000 }],
]) {
  const { Medium } = aufbau(opt)
  const v = new Medium(false)
  v.play()
  v.muted = false
  pruefe(`${name}: play() und muted = false bleiben unberührt`, v.mutedBeiPlay === false && v.muted === false && !v.hasAttribute('data-ak-war-laut'))
}

/* 5. Eine Sekunde vor Fristende gilt der Durchgang noch. */
{
  const { Medium } = aufbau({ lauf: JETZT - 6 * 60 * 60 * 1000 + 1 })
  const v = new Medium(false)
  v.play()
  pruefe('Knapp vor Fristende: stumm', v.mutedBeiPlay === true)
}

/* 6. Kaputter Speicher wirft nicht, Video bleibt laut. */
{
  class M { get muted() { return false } set muted(_) {} play() { return 1 } }
  kontext.akNetflixStummSeite({ proto: M.prototype, speicher: { getItem: () => { throw new Error('x') } }, ort: { pathname: '/watch/1' }, jetzt: () => JETZT })
  pruefe('Speicher wirft: play() läuft normal', new M().play() === 1)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot`)
  process.exit(1)
}
console.log('\nalles grün')
