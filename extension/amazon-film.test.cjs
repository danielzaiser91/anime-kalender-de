/**
 * Der Film-Weg, an einem einzigen echten Fall geprüft: **Avatar Aang**
 * (`B0H6QYBZFS`, Kanal Paramount+).
 *
 * Daniel am 25.08.2026: „für filme wird kein widget request abgeschickt. für
 * filme wird das html hydrated, es kommt ein document request response für die
 * webseite und das response html object hat ein
 * `<script id="dv-web-page-hydration-data" …>`, darin steht ein json mit all den
 * infos."
 *
 * Er hat die Seite abgelegt (953.373 Zeichen), der Block darin umfasst 239.064.
 * `avatar-hydration.fixture.json` ist ein **Auszug daraus** — dieselben Felder,
 * dieselben Werte, nur ohne die 230 KB, die niemand prüft.
 *
 * Geprüft wird die Lesefunktion des Lesers, nicht ein Muster: Es gibt hier
 * nichts zu parsen, der Block ist gültiges JSON in einem `<script>`-Element.
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

console.log('Zusicherungen für den Film-Weg (Avatar Aang, B0H6QYBZFS)\n')

const fixture = readFileSync(resolve(__dirname, 'avatar-hydration.fixture.json'), 'utf8')

/*
  Der Leser wird als Ganzes geladen; gebraucht wird daraus `ausHydration()`.
  Der Sandkasten stellt genau das bereit, was die Funktion anfasst — ein
  `getElementById`, das den Block liefert, und eine Adresse.
*/
const gemeldet = []
const sandkasten = {
  globalThis: null,
  document: {
    getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: fixture } : null),
    documentElement: { innerHTML: '<html></html>' },
    body: { textContent: '' },
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  location: { pathname: '/gp/video/detail/B0H6QYBZFS', search: '', href: '' },
  window: {
    addEventListener() {},
    postMessage: (nachricht) => gemeldet.push(nachricht),
    location: { pathname: '/gp/video/detail/B0H6QYBZFS', search: '' },
  },
  fetch: () => Promise.resolve({ ok: false, text: () => Promise.resolve('') }),
  setInterval: () => 0,
  setTimeout: () => 0,
  clearInterval() {},
  console: { log() {}, warn() {}, error() {} },
  performance: { now: () => 0 },
  Date,
  JSON,
  Math,
  Set,
  Map,
  Number,
  String,
  Object,
  Array,
  Boolean,
  RegExp,
  Promise,
  Error,
  encodeURIComponent,
  decodeURIComponent,
  XMLHttpRequest: function () {},
}
sandkasten.globalThis = sandkasten
sandkasten.window.document = sandkasten.document

/*
  **Geprüft wird der Produktivcode, keine Kopie davon.**

  Der Leser läuft in einer IIFE; seine Funktionen sind von außen nicht
  erreichbar. Statt sie hier nachzubauen — zwei Fassungen derselben Regel
  laufen garantiert auseinander — werden die beiden gebrauchten Funktionen aus
  der Quelldatei geschnitten und im Sandkasten ausgewertet. Ändert sich die
  Funktion, ändert sich die Prüfung mit.
*/
const quelle = readFileSync(resolve(__dirname, 'amazon-leser.js'), 'utf8')

function schneide(name) {
  const start = quelle.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`Funktion ${name} nicht gefunden`)
  let tiefe = 0
  let i = quelle.indexOf('{', start)
  const von = i
  for (; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++
    else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(start, i + 1)
  }
  throw new Error(`Funktion ${name} endet nicht (ab ${von})`)
}

vm.runInNewContext(
  `${schneide('namenAus')}\n${schneide('ausHydration')}\n;globalThis.__ausHydration = ausHydration;`,
  sandkasten,
  { filename: 'amazon-leser.js (Auszug)' },
)

const film = sandkasten.__ausHydration()

pruefe('der Hydration-Block wird gelesen', Boolean(film), film)
pruefe('die Kennung stimmt', film?.kennung === 'B0H6QYBZFS', film?.kennung)
pruefe('als Film erkannt', film?.art === 'Movie', film?.art)
pruefe(
  'der Titel steht drin',
  film?.titel === 'Avatar Aang: Der Herr der Elemente',
  film?.titel,
)

/* Der Kern für dieses Projekt: die Tonspuren. */
pruefe(
  'Deutsch steht in den Tonspuren',
  (film?.sprachen ?? []).includes('Deutsch'),
  film?.sprachen,
)
pruefe(
  'die Untertitel sind davon getrennt',
  (film?.untertitel ?? []).includes('Deutsch') && film?.untertitel !== film?.sprachen,
  film?.untertitel,
)

/*
  **Und der Zugang ist ein Kanal, kein Prime-Inhalt.**

  „da steht auch paramount+ drin, das ist ein prime kanal abo das man benötigt
  um es zu sehen" (Daniel). Genau die Unterscheidung, an der die Sprachangabe
  hängt — bei einem Kanal-Titel ist sie ein Hinweis, kein Beleg.
*/
pruefe(
  'der Kanal Paramount+ wird erkannt',
  (film?.zugaenge ?? []).includes('paramountplusde'),
  film?.zugaenge,
)
pruefe('kein Prime-Zugang dabei', !(film?.zugaenge ?? []).includes('Prime'), film?.zugaenge)

/* Was der Kalender sonst noch brauchen kann — alles ohne zweiten Abruf. */
pruefe('Laufzeit gelesen', typeof film?.laufzeit === 'string' && film.laufzeit.length > 0, film?.laufzeit)
pruefe('Erscheinungsjahr gelesen', film?.jahr === 2026, film?.jahr)
pruefe('Genres gelesen', (film?.genres ?? []).includes('Animation'), film?.genres)
pruefe('Beschreibung gelesen', (film?.beschreibung ?? '').length > 40, (film?.beschreibung ?? '').length)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nFilm-Weg: alle Zusicherungen erfüllt.')
