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
  /*
    Seit 3.82 fragt `istFilmSeite()` zuerst `filmAusSeite()` — den
    Hydration-Block. Beide Wege werden getrennt geprüft: Der Stub gibt hier
    `null` zurück, damit unten wirklich der Textweg gemessen wird; der
    Block-Weg bekommt eigene Zusicherungen dahinter.
  */
  const bauen = new Function(
    'lage',
    'ausBlock',
    `${stueck[0]}
function seitenLage(){return lage}
function filmAusSeite(){return ausBlock}
return istFilmSeite()`,
  )
  const film = (l, ausBlock = null) => bauen(l, ausBlock)

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

  /*
    **Der Block schlägt den gerenderten Text.** „5 Centimeters per Second"
    trägt `entityType: Movie` und vier Tonspuren; im gerenderten Text tauchte
    trotzdem eine Drei auf, und der Knopf kippte nach einer Sekunde von
    „1 Film melden" auf „1 von 3 — Abschnitte selbst öffnen" (Daniel,
    28.08.2026, mit Bild). Anonym gemessen nennt der Block weder episodeCount
    noch Staffeln, und im Quelltext steht nirgends „3 Folgen".
  */
  const ausBlock = { kennung: 'B0FMMXPN15', titel: '5 Centimeters per Second', sprachen: ['Deutsch', '日本語'], dauerSek: 3779 }
  pruefe(
    'sagt der Block „Movie“, zählt keine Zahl aus dem Seitentext dagegen',
    film({ hatFolgenReiter: false, folgenLautSeite: 3, hatLaufzeit: true }, ausBlock) === true,
  )
  pruefe(
    'ohne Block bleibt es beim Textweg — drei Folgen sind dann kein Film',
    film({ hatFolgenReiter: false, folgenLautSeite: 3, hatLaufzeit: true }, null) === false,
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

/*
  **Der hängende Staffelwechsel — Digimon Adventure, Staffel 2.**

  Aus Daniels Bericht vom 28.08.2026, Tagebuch mit 17 Einträgen:

      13:57:01  staffelwechsel   ?|1|B0CHHNJJW3  ->  2|1|B0CGXX7FNC
      13:57:05  stand-gekappt    gesamt 50, gelesen 72, weg: 55…78
      13:57:13  wartet-auf-staffel  wartetSeitMs 8010, gesamt 50, gelesen 48
      13:57:25  Bericht          wartetSeitMs 20262, Knopf „Staffel wechselt“

  Die Kappung hat sauber gearbeitet (die durchlaufenden Nummern 55–78 sind weg,
  48 von 50 bleiben). Danach steht `letzterFortschritt` zwanzig Sekunden still,
  und die Freigabe nach zwölf Sekunden greift trotzdem nicht.

  Der Grund steckt in zwei Regeln, die einander aufheben: `gesamtGeaendertAm`
  wurde bei jedem Takt erneuert, weil der veraltete Quelltext 54 Folgen nennt
  und der Zählstand 50 — eine **Abweichung**, die als **Änderung** gewertet
  wurde. Damit blieb `zahlenStehen` false, und weil das in der Signatur steht,
  stieg `zeichnen()` bei jedem Takt vorzeitig aus. Die Freigabe stand hinter
  diesem Ausstieg.
*/
pruefe(
  'die Ruhefrist läuft nur bei einer echten Änderung neu an',
  quelle.includes('jetzt.gesamt !== letzteQuelltextGesamt'),
)
pruefe(
  'und der zuletzt gesehene Quelltext-Wert wird dafür gemerkt',
  quelle.includes('letzteQuelltextGesamt = jetzt.gesamt'),
)
pruefe(
  'die Freigabe nach zwölf Sekunden steht in der Signatur',
  /const stand = [^\n]*freigabeReif/.test(quelle),
)
pruefe(
  'die Frist ist eine Konstante außerhalb von zeichnen()',
  quelle.indexOf('const WARTE_FRIST_MS') < quelle.indexOf('function zeichnen()'),
)

/*
  Die Regel selbst, nachgebaut: Eine gleichbleibende Abweichung darf die Frist
  nicht erneuern, eine neue Zahl schon. Ohne das kommt der Zustand nie zur Ruhe.
*/
{
  let gesamtGeaendertAm = 0
  let letzteQuelltextGesamt = null
  const takt = (zeit, quelltextGesamt, standGesamt) => {
    if (quelltextGesamt && quelltextGesamt !== standGesamt) {
      if (standGesamt && quelltextGesamt !== letzteQuelltextGesamt) gesamtGeaendertAm = zeit
      letzteQuelltextGesamt = quelltextGesamt
    }
    return zeit - gesamtGeaendertAm > 2000
  }
  /* Der reale Verlauf: Quelltext bleibt bei 54, Zaehlstand bei 50. */
  takt(1000, 54, 50)
  pruefe('gleich nach dem Wechsel ruhen die Zahlen noch nicht', takt(1500, 54, 50) === false)
  pruefe('nach der Ruhefrist stehen sie, obwohl die Abweichung bleibt', takt(4000, 54, 50) === true)
  pruefe('eine neue Zahl stößt die Frist wieder an', takt(4100, 60, 50) === false)
}

/*
  **Zugriffe vor der Deklaration — die tote Zone, statisch geprüft.**

  Am 28.08.2026 stand in Daniels Fehlerliste:

      Uncaught (in promise) ReferenceError:
      Cannot access `knopf` before initialization    amazon.js (zeigeAuftragshinweis)

  `const knopf = …` steht rund 950 Zeilen unter dem Zugriff. `const` hebt den
  Namen hoch, aber nicht den Wert; jeder Zugriff davor wirft. Weil der Fehler in
  einem await-Zweig entsteht, wird er als abgelehnte Zusage geschluckt und
  wiederholt sich bei jedem Takt — Daniel hat es als eingefrorenen Rechner
  gemerkt, nicht als Fehlermeldung.

  Genau derselbe Fehler mit `listenId` hat am 25.08.2026 schon einmal einen
  Abend gekostet. Ein zweites Mal derselbe Fehler heißt: Der Vorsatz trägt
  nicht, es braucht eine Prüfung.

  Geprüft werden die Namen, die im Modulscope mit `const`/`let` angelegt und
  anderswo als Objekt benutzt werden. Ein Zugriff davor ist erlaubt, wenn er in
  einem try steht — dann ist er bewusst abgesichert.
*/
{
  const zeilen = quelle.split(String.fromCharCode(10))
  /*
    **Alle Namen, nicht eine gepflegte Liste.**

    Bis zum dritten Fall an einem Tag stand hier eine Aufzaehlung — knopf,
    listenId, dialog, kasten. `istGemeldet` war nicht dabei und ist deshalb
    durchgerutscht (Daniel, 28.08.2026). Eine Pruefung, die man pflegen muss,
    faengt genau den Fall nicht, an den niemand gedacht hat.

    Gesammelt werden jetzt alle Namen, die im Modulscope mit const oder let
    angelegt sind und irgendwo als Objekt oder Funktion benutzt werden.
  */
  const NAMEN = [
    ...new Set(
      quelle
        .split(String.fromCharCode(10))
        .map((zeile) => /^  (?:const|let) ([a-zA-Z][a-zA-Z0-9]*)/.exec(zeile)?.[1])
        .filter(Boolean),
    ),
  ]
  for (const name of NAMEN) {
    const deklaration = zeilen.findIndex((z) =>
      new RegExp('^  (?:const|let) ' + name + '\\b').test(z),
    )
    if (deklaration < 0) continue
    const frueher = []
    let imKommentar = false
    for (let n = 0; n < deklaration; n++) {
      const zeile = zeilen[n]
      /*
        **Kommentare zaehlen nicht — und zwar ganze Bloecke.**

        Die Prosa in amazon.js nennt die Namen, um die es geht: „nach knopf und
        listenId." hat die Pruefung rot gemacht, obwohl dort kein Zugriff steht.
        Ein Filter auf Zeilenpraefixe reicht nicht — die Bloecke dort sind frei
        gesetzt, ohne fuehrenden Stern. Verfolgt wird deshalb, ob die Zeile
        gesetzt, ohne fuehrenden Stern. Verfolgt wird deshalb, ob die Zeile
        innerhalb eines Blockkommentars liegt.
      */
      if (imKommentar) {
        if (zeile.includes('*' + '/')) imKommentar = false
        continue
      }
      const getrimmt = zeile.trim()
      const zu = '*' + '/'
      /* Ein Einzeiler-Kommentar ist ganz Kommentar. */
      if (getrimmt.startsWith('/*') && getrimmt.includes(zu)) continue
      if (getrimmt.startsWith('/*')) { imKommentar = true; continue }
      if (zeile.trim().startsWith('//') || zeile.trim().startsWith('*')) continue
      if (!new RegExp('(^|[^a-zA-Z.])' + name + '\\.').test(zeile)) continue
      /* Ein Funktionsparameter gleichen Namens ist ein anderer Name. */
      let parameter = false
      for (let m = n; m >= 0 && m > n - 40; m--) {
        if (new RegExp('function [a-zA-Z]+\\([^)]*\\b' + name + '\\b').test(zeilen[m])) { parameter = true; break }
        if (/^  (?:function|const|let) /.test(zeilen[m]) && m !== n) break
      }
      if (parameter) continue
      /* In einem try ist der Zugriff bewusst abgesichert. */
      let imTry = false
      /*
        `sicher(() => …)` ist die hauseigene Form von try — das Diagnosefeld
        nutzt sie an rund dreissig Stellen, und jede davon ist abgesichert.
      */
      if (/sicher\(\s*\(\)\s*=>/.test(zeile)) continue
      for (let m = n; m >= 0 && m > n - 6; m--) if (/^\s*try \{/.test(zeilen[m])) { imTry = true; break }
      if (imTry) continue
      frueher.push(n + 1)
    }
    pruefe(
      'kein ungesicherter Zugriff auf `' + name + '` vor seiner Deklaration',
      frueher.length === 0,
      frueher,
    )
  }
}

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('\nFolgenzahl: alle Zusicherungen erfüllt.')
