/**
 * **Der Netflix-Durchgang spielt stumm** (4.30.7, 13.10.2026).
 *
 * Daniel: „netflix durchgang öffnet den player um die infos zu bekommen, dabei ertönt kurz sound".
 * Geprüft wird `netflix-stumm.js` gegen ein Ersatz-Fenster: im Durchgang wird ein eingefügtes
 * Video sofort stumm, ohne Durchgang bleibt es laut, nach dem Durchgang kommt der Ton zurück.
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

console.log('Netflix: Durchgang spielt stumm')

const quelle = readFileSync(resolve(__dirname, 'netflix-stumm.js'), 'utf8')
const melder = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'))

/* Schlüssel und Frist sind in `melder.js` und hier getrennt festgehalten — sie müssen übereinstimmen. */
const kontext = { globalThis: null }
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(quelle, kontext)
pruefe('Schlüssel wie in melder.js', melder.includes(`const LAUF_SCHLUESSEL = '${kontext.akNetflixLauf.schluessel}'`))
pruefe('Frist wie in melder.js (6 Stunden)', melder.includes('const LAUF_HOECHSTENS_MS = 6 * 60 * 60 * 1000') && kontext.akNetflixLauf.hoechstensMs === 21600000)

const gruppe = manifest.content_scripts.find((g) => g.js.includes('netflix-stumm.js'))
pruefe('Manifest: bei document_start', gruppe?.run_at === 'document_start')
pruefe('Manifest: nur Netflix, ohne /tudum/', gruppe?.matches.join() === 'https://www.netflix.com/*' && gruppe.exclude_matches.includes('https://www.netflix.com/tudum/*'))
pruefe('Manifest: Isolated World (kein MAIN nötig, Player-API bleibt unberührt)', gruppe?.world === undefined)

/** Ein Video, das nur `muted`, `volume` und `tagName` kennt; `volume` darf nie angefasst werden. */
function macheVideo(muted = false) {
  const v = { tagName: 'VIDEO', nodeType: 1, muted, volumeGesetzt: false }
  let lautstaerke = 0.8
  Object.defineProperty(v, 'volume', { get: () => lautstaerke, set: (x) => { lautstaerke = x; v.volumeGesetzt = true } })
  return v
}

/** Ersatz-Fenster: Hörer, Ort, Speicher, Zeitgeber. */
function umgebung({ pfad = '/watch/81234567', lauf = null } = {}) {
  const speicher = {
    werte: new Map(lauf ? [['ak-netflix-lauf', String(lauf)]] : []),
    getItem(k) { return this.werte.get(k) ?? null },
  }
  const hoerer = {}
  const fenster = {
    location: { pathname: pfad },
    addEventListener: (art, f, capture) => { hoerer[art] = { f, capture } },
  }
  const uhren = new Map()
  let nummer = 0
  const beobachter = { beobachtet: false, observe() { this.beobachtet = true } }
  const umg = {
    fenster,
    dokument: { documentElement: {}, addEventListener() {} },
    speicher,
    beobachter,
    takt: (f, ms) => { uhren.set(++nummer, { f, ms }); return nummer },
    taktStopp: (id) => uhren.delete(id),
  }
  return { umg, speicher, hoerer, uhren, beobachter }
}

const jetzt = () => Date.now()

/* 1. Im Durchgang wird ein eingefügtes Video stumm — ohne dass `volume` angefasst wird. */
{
  const u = umgebung({ lauf: jetzt() })
  const lauf = kontext.akNetflixStummStarten(u.umg)
  pruefe('Beobachter hängt am Dokument', u.beobachter.beobachtet)
  pruefe('play- und volumechange-Hörer in der Capture-Phase', u.hoerer.play?.capture === true && u.hoerer.volumechange?.capture === true)
  const video = macheVideo(false)
  lauf.alleStumm(video)
  pruefe('Durchgang: eingefügtes Video wird stumm', video.muted === true)
  pruefe('Lautstärke (volume) bleibt unberührt', video.volumeGesetzt === false && video.volume === 0.8)

  const verschachtelt = macheVideo(false)
  lauf.alleStumm({ tagName: 'DIV', nodeType: 1, querySelectorAll: () => [verschachtelt] })
  pruefe('Durchgang: Video in eingefügtem Container wird stumm', verschachtelt.muted === true)

  /* Netflix schaltet den Ton nach dem Einfügen selbst wieder an: volumechange fängt es. */
  const spaet = macheVideo(false)
  lauf.alleStumm(spaet)
  spaet.muted = false
  let weitergereicht = true
  u.hoerer.volumechange.f({ target: spaet, stopImmediatePropagation: () => { weitergereicht = false } })
  pruefe('Durchgang: schaltet Netflix den Ton wieder an, ist er sofort weg', spaet.muted === true)
  pruefe('Durchgang: Netflix sieht die Lautstärkeänderung nicht (kein Speichern als Nutzerwunsch)', weitergereicht === false)

  const spielt = macheVideo(false)
  u.hoerer.play.f({ target: spielt })
  pruefe('Durchgang: ein Video, das ohne Einfügen zu spielen beginnt (play), wird stumm', spielt.muted === true)

  /* 2. Zurücksetzen: spätestens nach einem Takt, nachdem der Durchgang endete. */
  const warStumm = macheVideo(true)
  lauf.alleStumm(warStumm)
  const takt = [...u.uhren.values()][0]
  pruefe('Prüftakt läuft, solange ein Video stumm gestellt ist', Boolean(takt) && takt.ms === kontext.akNetflixStummPruefTaktMs && takt.ms <= 1000, takt?.ms)
  takt.f()
  pruefe('Durchgang läuft noch: Takt lässt die Stummschaltung stehen', video.muted === true && u.uhren.size === 1)
  u.speicher.werte.delete('ak-netflix-lauf')
  takt.f()
  pruefe('Nach dem Durchgang (Schlüssel weg) ist der Ton beim nächsten Takt (≤ 1 s) zurück', video.muted === false && verschachtelt.muted === false && spaet.muted === false)
  pruefe('Wer schon vorher stumm war (Daniel), bleibt stumm', warStumm.muted === true)
  pruefe('Danach läuft kein Takt mehr', u.uhren.size === 0)
}

/* 2b. Dasselbe Video wird zweimal stumm gestellt (play, dann volumechange): „vorher" darf nicht mit dem schon stummen Zustand überschrieben werden. */
{
  const u = umgebung({ lauf: jetzt() })
  const lauf = kontext.akNetflixStummStarten(u.umg)
  const video = macheVideo(false)
  u.hoerer.play.f({ target: video })
  u.hoerer.volumechange.f({ target: video, stopImmediatePropagation: () => {} })
  pruefe('Zweimal stumm gestellt: Video ist stumm', video.muted === true)
  u.speicher.werte.delete('ak-netflix-lauf')
  const taktDoppelt = [...u.uhren.values()][0]
  taktDoppelt.f()
  pruefe('Zweimal stumm gestellt, Durchgang vorbei: Video ist wieder laut', video.muted === false)
  lauf.zurueck()
}

/* 3. Gegenprobe: ohne Durchgang bleibt ein Video laut. */
{
  const u = umgebung({ lauf: null })
  const lauf = kontext.akNetflixStummStarten(u.umg)
  const video = macheVideo(false)
  lauf.alleStumm(video)
  u.hoerer.play.f({ target: video })
  let weitergereicht = true
  u.hoerer.volumechange.f({ target: video, stopImmediatePropagation: () => { weitergereicht = false } })
  pruefe('Ohne Durchgang bleibt das Video laut', video.muted === false)
  pruefe('Ohne Durchgang sieht Netflix jede Lautstärkeänderung', weitergereicht === true)
  pruefe('Ohne Durchgang läuft kein Takt', u.uhren.size === 0)
}

/* 3b. Die Seitenwelt hat ein Video stumm gestellt, das hier nie ankam (play() abgelehnt); spielt es nach dem Durchgang, ist der Ton zurück. */
{
  const u = umgebung({ lauf: null })
  kontext.akNetflixStummStarten(u.umg)
  const marken = new Set(['data-ak-war-laut'])
  const video = Object.assign(macheVideo(true), { hasAttribute: (n) => marken.has(n), removeAttribute: (n) => marken.delete(n) })
  u.hoerer.play.f({ target: video })
  pruefe('Nach dem Durchgang: von der Seitenwelt stumm gestelltes Video spielt wieder laut', video.muted === false && !marken.size)
  const daniel = Object.assign(macheVideo(true), { hasAttribute: () => false, removeAttribute() {} })
  u.hoerer.play.f({ target: daniel })
  pruefe('Ohne Marke (Daniel hat stumm gestellt) bleibt es stumm', daniel.muted === true)
}

/* 4. Gegenprobe: Durchgang läuft, aber die Seite ist keine Abspielseite. */
{
  const u = umgebung({ pfad: '/title/81234567', lauf: jetzt() })
  const lauf = kontext.akNetflixStummStarten(u.umg)
  const video = macheVideo(false)
  lauf.alleStumm(video)
  pruefe('Durchgang auf einer Titelseite: Video unberührt (nur /watch/)', video.muted === false)
}

/* 5. Gegenprobe: abgelaufener Durchgang (älter als 6 Stunden) gilt nicht mehr. */
{
  const u = umgebung({ lauf: jetzt() - 6 * 60 * 60 * 1000 - 1000 })
  const lauf = kontext.akNetflixStummStarten(u.umg)
  const video = macheVideo(false)
  lauf.alleStumm(video)
  pruefe('Abgelaufener Durchgang (> 6 Stunden): Video bleibt laut', video.muted === false)
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot`)
  process.exit(1)
}
console.log('\nalles grün')
