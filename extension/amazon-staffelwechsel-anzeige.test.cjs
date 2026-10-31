/**
 * Staffelwechsel ohne Neuladen (Miraculous, 31.10.2026): Kennung im Kasten, Folgenstand, Reitername, „weiter mit Staffel N".
 *
 * Punkt 1: Der Knopf bleibt zu, solange die Zeile „meldet: … · KENNUNG" eine andere Kennung nennt als die Adresse.
 * Punkt 3: „weiter mit" nimmt die Nummern der Reiter (1–24, 101, 102), nicht 1…Anzahl.
 * Punkt 4: Ein alter Folgenstand ist ein anderer Kastenstand als ein frischer mit derselben Zahl.
 * Punkt 5: Ein Reiter ohne Zahl im Namen erscheint mit seinem Namen („Tagebuch Besonders" statt „Staffel 101").
 * Die reinen Funktionen stehen in `prime-stand.js`; die Aufrufe in `amazon.js` prüft der Quelltextteil unten.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const quelle = lies('amazon.js')
const k = { Set, Number, Object, Array, String, Boolean }
k.globalThis = k
vm.runInNewContext(lies('prime-stand.js'), k)

/* Punkt 1: Daniels Kennungen wörtlich (Staffel 20 → 21) */
pruefe('Zeile nennt B0C94H534K, Adresse B0CKBMLDTL: alt', k.akPrimeKennungAlt('B0C94H534K', 'B0CKBMLDTL') === true)
pruefe('Zeile und Adresse gleich: nicht alt', k.akPrimeKennungAlt('B0CKBMLDTL', 'B0CKBMLDTL') === false)
pruefe('keine Zeile im Kasten: nicht alt', k.akPrimeKennungAlt(undefined, 'B0CKBMLDTL') === false)
pruefe('keine Kennung in der Adresse: nicht alt', k.akPrimeKennungAlt('B0C94H534K', null) === false)
pruefe('Knopf-Sperre fragt akPrimeKennungAlt', /if \(quelltextVonFruehererSeite\(\) \|\| globalThis\.akPrimeKennungAlt\([^\n]*\) \{\s+knopf\.disabled = true/.test(quelle))
pruefe('Kasten schreibt die Kennung in die Zeile', /z\.dataset\.kennung = kennungJetzt/.test(quelle))

/* Punkt 3 */
const reiter = [...Array.from({ length: 24 }, (_, i) => ({ nummer: i + 1 })), { nummer: 101 }, { nummer: 102 }]
const bis = (n) => Array.from({ length: n }, (_, i) => i + 1)
const weiter = (r, zahl, fertigListe, jetzt) =>
  k.akPrimeNaechsteStaffel(r, zahl, Object.fromEntries(fertigListe.map((n) => [String(n), true])), jetzt)
pruefe('Staffel 15 gemeldet, jetzt 15: weiter mit 16', weiter(reiter, 26, bis(14), 15) === 16)
pruefe('1–24 gemeldet: weiter mit 101', weiter(reiter, 26, bis(24), 24) === 101, weiter(reiter, 26, bis(24), 24))
pruefe('1–24 und 101 gemeldet: weiter mit 102', weiter(reiter, 26, [...bis(24), 101], 101) === 102)
pruefe('alles gemeldet: null', weiter(reiter, 26, [...bis(24), 101, 102], 102) === null)
pruefe('ohne Reiterliste: 1…Anzahl wie bisher', weiter(undefined, 3, [1], 2) === 3)
pruefe('Reiterliste mit einem Eintrag: 1…Anzahl', weiter([{ nummer: 1 }], 3, [], 1) === 2)
pruefe('Aufruf in amazon.js', /akPrimeNaechsteStaffel\(gesehen\?\.seite\?\.staffeln, zahl, fertige, jetzigeStaffel\)/.test(quelle))

/* Punkt 4 */
const ort = { pathname: '/gp/video/detail/B0CKBMLDTL', search: '?ref_=atv_dp_season_select_s21' }
const jetzt = ort.pathname + ort.search
const stand = (gesamt, adresse) => k.akPrimeFolgenStand({ gesamt, fuerAdresse: adresse }, ort)
pruefe('gleiche Zahl, alter gegen frischen Stand: verschiedene Kennung', stand(8, '/gp/video/detail/B0C94H534K') !== stand(8, jetzt))
pruefe('andere Zahl, frisch: verschiedene Kennung', stand(7, jetzt) !== stand(8, jetzt))
pruefe('ohne Stand: 0|0', k.akPrimeFolgenStand(undefined, ort) === '0|0')
pruefe('Hinweis zählt „hier" nur bei frischem Stand', /hier = globalThis\.akPrimeFolgenStandFrisch\(gesehen, location\) \? /.test(quelle))
pruefe('Kasten und Neuaufbau vergleichen denselben Stand', (quelle.match(/globalThis\.akPrimeFolgenStand\(gesehen, location\)/g) ?? []).length === 2)

/* Punkt 5: Reitername statt Sortierzahl */
const reiterListe = [
  { nummer: 21, name: 'Staffel 21', gewaehlt: false },
  { nummer: 101, name: 'Tagebuch Besonders', gewaehlt: true },
  { nummer: 102, name: 'Specials 2', gewaehlt: false },
]
const name = (n, liste, frueher = false) => k.akPrimeStaffelBezeichnung(n, liste, frueher)
pruefe('Reiter ohne Zahl: Name statt „Staffel 101"', name(101, reiterListe) === 'Tagebuch Besonders', name(101, reiterListe))
pruefe('Reiter mit Zahl im Namen: „Staffel N"', name(102, reiterListe) === 'Staffel 102')
pruefe('gewöhnlicher Reiter: „Staffel 21"', name(21, reiterListe) === 'Staffel 21')
pruefe('ohne passenden Reiter: „Staffel N"', name(7, reiterListe) === 'Staffel 7')
pruefe('ohne Reiterliste: „Staffel N"', name(101, undefined) === 'Staffel 101')
pruefe('Quelltext der vorigen Seite: Name nicht übernommen', name(101, reiterListe, true) === 'Staffel 101')
const zwei = [
  { nummer: 5, name: 'Besonders', gewaehlt: false },
  { nummer: 5, name: 'Extras', gewaehlt: true },
]
pruefe('zwei Reiter mit derselben Zahl: der gewählte zählt', name(5, zwei) === 'Extras')
pruefe('Aufruf in amazon.js', /akPrimeStaffelBezeichnung\(n, gesehen\?\.seite\?\.staffeln, quelltextVonFruehererSeite\(\)\)/.test(quelle))

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nalle Zusicherungen erfüllt')
