/**
 * **Beim Fernsehen ist die Erweiterung unsichtbar — auch im Player.**
 *
 * Daniel am 10.09.2026, mit Bild: Über „Heroes", Staffel 3, Folge 17 stand der
 * Kasten „Folge 17: kein Deutsch gefunden". Kein Anime, nicht auf der
 * Prüfliste, er wollte einfach fernsehen: „wieso ist die extension hier???
 * fail... das ist das was ich gucken will."
 *
 * Es ist derselbe Titel wie am 30.08.2026 („i am just watching something,
 * there should be no elements from the extension on screen") — dieselbe Regel,
 * eine zweite Anzeigestelle, die es damals noch nicht gab.
 *
 * **Die Ursache war ein Test, der nie nein sagen kann.** `playerAuftragOffen()`
 * fragte `Boolean(gemeinteReihe())`. Aber `gemeinteReihe()` **löst auf**,
 * welche Reihe gemeint ist, und fällt am Ende auf `stand.reihe` zurück — die
 * Reihe, die gerade läuft. Auf jeder Player-Seite ist das etwas.
 *
 * Deshalb wird hier **ausgeführt**, nicht gelesen: Eine Quelltextprüfung hätte
 * `Boolean(gemeinteReihe())` für richtig gehalten, so wie sie am selben Tag
 * einen doppelt vergebenen Feldnamen für richtig hielt (`grenzKnopf`, sechs
 * grüne Zusicherungen an einem Knopf, den es nie gab).
 *
 * Aufruf: `node extension/player-nur-mit-auftrag.test.cjs`
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

console.log('Zusicherungen: der Player zeigt nur mit Auftrag etwas (Heroes, 10.09.2026)\n')

const quelle = readFileSync(resolve(__dirname, 'melder.js'), 'utf8')

/** Die drei Funktionen, um die es geht — wörtlich aus dem Quelltext. */
function schneide(name) {
  const treffer = new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(quelle)
  return treffer?.[0] ?? null
}

const teile = ['gemeinteReihe', 'istGesucht', 'playerAuftragOffen'].map((n) => [n, schneide(n)])
for (const [name, code] of teile) pruefe(`${name}() ist im Quelltext auffindbar`, Boolean(code))
if (teile.some(([, code]) => !code)) {
  console.error('\nOhne die Funktionen prüft der Rest nichts.')
  process.exit(1)
}

/**
 * Der Sandkasten stellt genau das, was die drei Funktionen anfassen.
 *
 * `offeneTitel` ist die Prüfliste: Was dort steht, ist ein Auftrag. Bei
 * „Heroes" steht dort nichts — genau das ist der Fall, um den es geht.
 */
function lauf({ reihe, offene = {}, adresse = '/watch/70111777', gemerkt = {}, zuletzt = null }) {
  const kontext = {
    stand: { reihe },
    offeneTitel: offene,
    netflixWeiterleitungen: gemerkt,
    zuletztGeoeffnet: zuletzt,
    location: { search: adresse.includes('?') ? adresse.slice(adresse.indexOf('?')) : '' },
    URLSearchParams,
    Date,
    Boolean,
    nameStimmt: () => true,
    ausWeiterleitung: () => true,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(teile.map(([, code]) => code).join('\n\n') + '\nergebnis = playerAuftragOffen()', kontext)
  return kontext.ergebnis
}

/* Der gemeldete Fall: Heroes läuft, steht auf keiner Liste. */
pruefe('eine Reihe ohne Auftrag zeigt nichts', lauf({ reihe: '70111777' }) === false, lauf({ reihe: '70111777' }))

/* Die Gegenprobe — ohne sie sagt die Zusicherung nur, dass immer nein kommt. */
pruefe(
  'eine Reihe auf der Prüfliste zeigt etwas',
  lauf({ reihe: '80090673', offene: { 80090673: { folgen: [] } } }) === true,
)

/*
  Der Direktlink aus der Prüfliste trägt `?ak=1`. Er gilt, bevor der Player
  seine Metadaten herausgerückt hat — sonst bliebe es beim Klick auf einen
  Auftrag sekundenlang still, und das war der Anlass, ihn einzuführen.
*/
pruefe(
  'der Auftragsparameter gilt auch ohne bekannte Reihe',
  lauf({ reihe: '70111777', adresse: '/watch/70111777?ak=1' }) === true,
)

/*
  **Der Riegel selbst.** Ein `Boolean()` über einer Funktion, die einen
  Rückfall hat, ist immer wahr — wer das zurückbaut, hat den Fehler wieder.
*/
pruefe(
  'der Test fragt istGesucht(), nicht die Auflösefunktion',
  /return istGesucht\(\)/.test(schneide('playerAuftragOffen') ?? '') &&
    !/Boolean\(gemeinteReihe\(\)\)/.test(quelle),
)

/*
  Und die Auflösefunktion behält ihren Rückfall — sie soll ihn haben. Genau
  deshalb taugt sie nicht als Test.
*/
pruefe(
  'gemeinteReihe() fällt weiterhin auf die laufende Reihe zurück',
  lauf({ reihe: '70111777' }) === false && /return stand\.reihe\s*\n\}/.test(schneide('gemeinteReihe') ?? ''),
)

/*
  **Der ganze Kasten, nicht nur der Player** (Daniel, 11.09.2026, im Player von
  „Heroes": „wenn ich von overview zur serie wechsele die nicht in prüfliste der
  extension ist -> extension verstecken"). Übrig war der Rahmen mit der
  Debug-Zeile — jede Anzeigestelle hatte ihre Regel, der Kasten keine.
*/
const regel = schneide('seiteGehtUnsAn')
pruefe('seiteGehtUnsAn() ist im Quelltext auffindbar', Boolean(regel))
function seite(adresse, { reihe = null, offene = {}, zuletzt = null } = {}) {
  const [pfad, suche = ''] = adresse.split('?')
  const kontext = {
    stand: { reihe },
    offeneTitel: offene,
    netflixWeiterleitungen: {},
    zuletztGeoeffnet: zuletzt,
    location: { pathname: pfad, search: suche ? `?${suche}` : '' },
    imPlayer: () => pfad.startsWith('/watch/'),
    URLSearchParams,
    Date,
    Boolean,
    String,
    nameStimmt: () => false,
    ausWeiterleitung: () => false,
    ergebnis: null,
  }
  vm.createContext(kontext)
  vm.runInContext(
    [...teile.map(([, code]) => code), regel].join('\n\n') + '\nergebnis = seiteGehtUnsAn()',
    kontext,
  )
  return kontext.ergebnis
}
const LISTE = { 80090673: { staffeln: [] } }
pruefe('auf der Stöberseite bleibt der Kasten — dort sitzt der Weg zur Prüfliste', seite('/browse', { offene: LISTE }) === true)
pruefe('im Player einer fremden Serie verschwindet er', seite('/watch/70111779', { reihe: '70136130', offene: LISTE }) === false)
pruefe('auf der Titelseite einer fremden Serie verschwindet er', seite('/title/70136130', { offene: LISTE }) === false)
pruefe(
  'auch wenn der Stand noch die Reihe der vorigen Seite trägt',
  seite('/title/70136130', { reihe: '80090673', offene: LISTE }) === false,
)
pruefe('auf der Titelseite einer Serie der Liste bleibt er', seite('/title/80090673', { offene: LISTE }) === true)
pruefe('ein geöffnetes Overlay zählt wie die Titelseite', seite('/browse?jbv=70136130', { offene: LISTE }) === false)

console.log('')
if (fehler.length) {
  console.error(`${fehler.length} Zusicherung(en) gerissen.`)
  process.exit(1)
}
console.log('Alle Zusicherungen zur Player-Anzeige halten.')
