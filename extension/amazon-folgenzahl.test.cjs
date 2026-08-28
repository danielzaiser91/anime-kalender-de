/**
 * Was die Folgenzahl der Seite über den Titel aussagt — und was nicht.
 *
 * **Alle drei Fälle hier hat Daniel an einem Nachmittag gemeldet** (28.08.2026),
 * und alle drei liefen durch 236 grüne Zusicherungen hindurch, weil keine davon
 * die Folgenzahl gegen die Erwartung prüfte:
 *
 * | Titel | Seite | erwartet | was die Erweiterung sagte |
 * |---|---|---|---|
 * | Captain Tsubasa (2018) | 91 | 52 | „andere Staffel wählen" |
 * | Chibi Maruko-chan | 52 | 142 | „andere Staffel wählen" |
 * | Blood-C: The Last Dark | Film | 1 | „keine Folgen für diese Staffel" |
 *
 * Die ersten beiden zeigen dieselbe Regel von beiden Seiten: Prime schneidet
 * Reihen anders zu als AniList — mal zusammen, mal auseinander. Der dritte ist
 * ein eigener Fehler, aber mit derselben Wurzel: eine Zahl wurde als Urteil
 * gelesen, wo sie nur eine Beschreibung war.
 *
 * `istFilmSeite()` wird hier **wirklich ausgeführt**, mit gestubbtem
 * `seitenLage()` — das ist die Funktion, die im Bericht `false` sagte, wo sie
 * `true` hätte sagen müssen. Die übrigen Zusicherungen lesen den Quelltext, weil
 * die Regel dort in einer 200-Zeilen-Funktion steckt.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zur Folgenzahl (Tsubasa, Chibi Maruko-chan, Blood-C)\n')

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')

/*
  `istFilmSeite()` wird aus dem Quelltext geschnitten und mit einem eigenen
  `seitenLage()` ausgeführt. Sie fasst nichts anderes an — die Funktion besteht
  aus einem Aufruf und einem Rückgabewert.
*/
const stueck = quelle.match(/function istFilmSeite\(\) \{[\s\S]*?\n  \}/)
pruefe('istFilmSeite() ist im Quelltext auffindbar', Boolean(stueck))

if (stueck) {
  const bauen = new Function('lage', `${stueck[0]}\nfunction seitenLage(){return lage}\nreturn istFilmSeite()`)
  const film = (l) => bauen(l)

  /* Der reale Fall aus Daniels Bericht vom 28.08.2026, Werte wörtlich daraus. */
  pruefe(
    'Blood-C: The Last Dark gilt als Film (1 Folge laut Seite, Laufzeit, kein Reiter)',
    film({ hatFolgenReiter: false, folgenLautSeite: 1, hatLaufzeit: true }) === true,
    film({ hatFolgenReiter: false, folgenLautSeite: 1, hatLaufzeit: true }),
  )
  /* Der Fall, für den die Erkennung ursprünglich gebaut wurde — er muss halten. */
  pruefe(
    'ein Film ohne jede Folgenzahl gilt weiterhin als Film',
    film({ hatFolgenReiter: false, folgenLautSeite: 0, hatLaufzeit: true }) === true,
  )
  /* Gegenproben: keine der beiden darf zum Film werden. */
  pruefe(
    'eine Serie mit Folgen-Reiter ist kein Film',
    film({ hatFolgenReiter: true, folgenLautSeite: 12, hatLaufzeit: true }) === false,
  )
  pruefe(
    'zwei Folgen ohne Reiter sind kein Film',
    film({ hatFolgenReiter: false, folgenLautSeite: 2, hatLaufzeit: true }) === false,
  )
  pruefe(
    'ohne Laufzeit kein Film — sonst wäre jede leere Seite einer',
    film({ hatFolgenReiter: false, folgenLautSeite: 1, hatLaufzeit: false }) === false,
  )
}

/*
  Der Zahlen-Riegel ist gefallen. Beide Sperrmerkmale werden einzeln geprüft,
  damit eine Rückkehr in einer der beiden Formen auffällt.
*/
pruefe(
  'kein Math.abs-Vergleich gegen die erwartete Folgenzahl mehr',
  !/Math\.abs\([^)]*auftragJetzt\.folgen/.test(quelle),
)
pruefe(
  'keine Sperre „andere Staffel wählen" wegen einer Zahl',
  !quelle.includes('erwartet — andere Staffel wählen'),
)
pruefe(
  'die Abweichung wird notiert statt gesperrt',
  quelle.includes("notiere('andere-folgenzahl'"),
)

/*
  Bündelung: beide Fenster. Bei Captain Tsubasa sind die gesuchten 52 die
  ersten, beim Junior-Youth-Auftrag die letzten — dieselbe Seite, zwei richtige
  Antworten, also zwei Knöpfe.
*/
pruefe(
  'das vordere Fenster wird angeboten',
  /\{ von: 1, bis: auftrag\.folgen \}/.test(quelle),
)
pruefe(
  'das hintere Fenster ebenfalls',
  /\{ von: hier - auftrag\.folgen \+ 1, bis: hier \}/.test(quelle),
)
pruefe(
  'und beide werden als Knopf gezeichnet',
  /for \(const b of buendel\)/.test(quelle),
)
pruefe(
  'der Teilungsfall bekommt eine eigene Zeile',
  quelle.includes('die Reihe ist aufgeteilt, melden ist richtig'),
)

/*
  **Der Film-Zweig, mit den gemessenen Werten der beiden Fehlerfilme.**

  Am 28.08.2026 anonym von amazon.de geholt — die Seiten sind ohne Anmeldung
  lesbar. Der Aufbau unten ist der echte, gekürzt auf die Felder, die
  `filmAusSeite()` anfasst:

  | Titel | Adresse | pageTitleId | audioTracks |
  |---|---|---|---|
  | Blood-C: The Last Dark | B0GQJFL1XG | B0GQJ8WYJD | Deutsch, 日本語 |
  | Have A Nice Day | B0FYSH898T | B0FWK8XMDJ | Deutsch |

  Die abweichende `pageTitleId` ist weder Fehler noch Titelwechsel — Prime führt
  den Film unter einer anderen Kennung als die Adresse, wie schon bei Digimon
  Tamers (siehe CLAUDE.md). `filmAusSeite()` nimmt deshalb den einzigen Eintrag,
  statt auf Gleichheit zu bestehen.
*/
const block = (kennung, kopfKennung, kopf) =>
  JSON.stringify({
    init: {
      preparations: {
        body: { atf: { state: { pageTitleId: kennung, detail: { headerDetail: { [kopfKennung]: kopf } } } } },
      },
    },
  })

const stueckFilm = quelle.match(/function filmAusSeite\(\) \{[\s\S]*?\n  \}/)
pruefe('filmAusSeite() ist im Quelltext auffindbar', Boolean(stueckFilm))

if (stueckFilm) {
  const lies = (inhalt, pfad) => {
    const bau = new Function(
      'document',
      'location',
      `let filmStand = { fuerAdresse: null, daten: null }
${stueckFilm[0]}
return filmAusSeite()`,
    )
    return bau(
      { getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: inhalt } : null) },
      { pathname: pfad, search: '' },
    )
  }

  const bloodC = lies(
    block('B0GQJ8WYJD', 'B0GQJ8WYJD', {
      entityType: 'Movie',
      title: 'Blood-C: The Last Dark',
      audioTracks: ['Deutsch', '日本語'],
      duration: 6106,
    }),
    '/gp/video/detail/B0GQJFL1XG',
  )
  pruefe('Blood-C liefert seine Tonspuren', bloodC?.sprachen?.join() === 'Deutsch,日本語', bloodC?.sprachen)
  pruefe('und die Laufzeit in Sekunden', bloodC?.dauerSek === 6106, bloodC?.dauerSek)
  pruefe('und die Kennung aus dem Block, nicht aus der Adresse', bloodC?.kennung === 'B0GQJ8WYJD', bloodC?.kennung)

  const niceDay = lies(
    block('B0FWK8XMDJ', 'B0FWK8XMDJ', {
      entityType: 'Movie',
      title: 'Have A Nice Day',
      audioTracks: ['Deutsch'],
      duration: 4472,
    }),
    '/gp/video/detail/B0FYSH898T',
  )
  pruefe('Have A Nice Day ebenso', niceDay?.sprachen?.join() === 'Deutsch', niceDay?.sprachen)

  /*
    Gegenproben. Eine Serie darf hier nichts liefern — für sie ist der Mitleser
    zuständig, der die Folgen einzeln kennt; eine Sprachliste für die ganze
    Staffel wäre die schlechtere Auskunft.
  */
  const serie = lies(
    block('B0GV8N71SL', 'B0GV8N71SL', { entityType: 'TV Show', title: 'Yu-Gi-Oh! ZEXAL', audioTracks: ['Deutsch'] }),
    '/gp/video/detail/B0GV8N71SL',
  )
  pruefe('eine Serie liefert hier nichts', serie === null, serie)

  const ohneSpuren = lies(
    block('B0X', 'B0X', { entityType: 'Movie', title: 'Film ohne Tonspuren', audioTracks: [] }),
    '/gp/video/detail/B0X',
  )
  pruefe('ein Film ohne Tonspuren liefert nichts', ohneSpuren === null, ohneSpuren)
}

/*
  Der Zweig selbst muss **vor** dem für veralteten Quelltext stehen. Bis 3.78
  gab es für einen Film mit frischem Quelltext gar keinen — der Ablauf fiel bis
  zum Warte-Zweig durch und blieb dort stehen.
*/
pruefe(
  'ein Film mit frischem Quelltext hat einen eigenen Zweig',
  quelle.includes('if (istFilmSeite() && !quelltextVeraltet() && !gesehen.jeFolge.size)'),
)
pruefe(
  'und er steht vor dem Zweig für veralteten Quelltext',
  quelle.indexOf('!quelltextVeraltet() && !gesehen.jeFolge.size') <
    quelle.indexOf('if (istFilmSeite() && quelltextVeraltet())'),
)
pruefe(
  'der Knopf schreibt „Film“ auch, wenn die Seite eine Eins nennt',
  quelle.includes('const istFilm = (istFilmSeite() || !gesehen.gesamt) && geladen === 1'),
)

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nFolgenzahl: alle Zusicherungen erfüllt.')
