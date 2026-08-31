/**
 * Der Test, den die beiden Abstürze verlangt haben.
 *
 * Er prüft drei Dinge, und das dritte ist das, was zweimal gefehlt hat:
 *
 * 1. Wir sehen die Metadaten-Antwort.
 * 2. Der native Wert kommt unverändert beim Leser an.
 * 3. **Die Seite bleibt heil**, auch wenn sie selbst wrappt — kein
 *    Stapelüberlauf, egal in welcher Reihenfolge.
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/leser.js', 'utf8')
const von = quelle.indexOf('  const METADATEN_ADRESSE')
const bis = quelle.lastIndexOf('  function melden()')
if (von < 0 || bis < 0) { console.error('Block nicht gefunden'); process.exit(1) }

const gelesen = []
function lesMetadaten(text) { gelesen.push(text.length) }

// Ein XMLHttpRequest, wie ihn der Browser mitbringt: responseText ist ein
// Getter auf dem Prototyp.
class XMLHttpRequest {}
Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
  configurable: true,
  enumerable: false,
  get() { return this._text ?? '' },
})
/*
  Ein window, das die Ereignisverwaltung kennt.

  Seit dem 26.08.2026 hängt der Leser dort einen Empfänger für die
  Steuerbefehle des Durchlaufs ein. Ein leeres Objekt brachte den Test mit
  „window.addEventListener is not a function" zu Fall — und das war ein
  richtiger Befund über den Sandkasten, nicht über den Code: Ein echtes
  window hat die Funktion immer.
*/
/*
  Die Marken stehen im Leser weiter oben als der ausgeschnittene Block.
  Sie werden deshalb aus der Quelle gelesen, nicht hier noch einmal
  hingeschrieben — zwei Fassungen derselben Zeichenkette laufen auseinander.
*/
const MARKE_FOLGEN = /MARKE_FOLGEN = '([^']+)'/.exec(quelle)?.[1]
const MARKE_STEUER = /MARKE_STEUER = '([^']+)'/.exec(quelle)?.[1]

/*
  Eine Adresse, wie sie eine Titelseite hat.

  Seit dem 26.08.2026 bindet der Leser die Folgenliste an die Reihe in der
  Adresse — ohne das sammelte sie die Folgendaten der Startseite mit ein und
  meldete "61 Folgen" auf einer Seite mit zwölf.
*/
const location = { pathname: '/title/80175351', search: '' }
/* Die Diagnose legt eine Datei an — im Sandkasten genügt eine Attrappe. */
const document = { createElement: () => ({ click() {} }) }
const Blob = function () {}
const URL = { createObjectURL: () => '' }

const gesendet = []

/*
  Eine Zusicherung, die zählt statt sofort abzubrechen.

  Diese Datei prüfte bis zum 26.08.2026 über ein Ergebnis-Objekt am Ende. Für
  die Folgenliste sind es mehrere Einzelaussagen, und die sollen einzeln beim
  Namen genannt werden, wenn eine rot wird.
*/
const rot = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  rot.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const empfaenger = []
const window = {
  addEventListener: (art, fn) => empfaenger.push({ art, fn }),
  postMessage: (nachricht) => gesendet.push(nachricht),
}

eval(quelle.slice(von, bis))

const ergebnis = {}

// 1. Eine Metadaten-Antwort.
const a = new XMLHttpRequest()
a._text = JSON.stringify({ video: { id: 1, seasons: [] } }).padEnd(200, ' ')
a.responseURL = 'https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=1'
ergebnis.text = a.responseText.length > 0
ergebnis.gesehen = gelesen.length

// 2. Eine fremde Antwort bleibt unbeachtet.
const b = new XMLHttpRequest()
b._text = 'x'.repeat(500)
b.responseURL = 'https://www.netflix.com/irgendwas'
b.responseText
ergebnis.fremdeIgnoriert = gelesen.length === 1

// 3. Die Seite wrappt selbst — wie Netflix es tut.
let seiteRief = 0
const unsererGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText').get
Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
  configurable: true,
  get() { seiteRief++; return unsererGetter.call(this) },
})
const c = new XMLHttpRequest()
c._text = JSON.stringify({ video: { id: 2, seasons: [] } }).padEnd(200, ' ')
c.responseURL = 'https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=2'
let absturz = null
try { c.responseText } catch (err) { absturz = err.message }
ergebnis.nachWrappenGesehen = gelesen.length === 2
ergebnis.seiteRief = seiteRief
ergebnis.absturz = absturz

console.log(ergebnis)
const ok =
  ergebnis.text && ergebnis.gesehen === 1 && ergebnis.fremdeIgnoriert &&
  ergebnis.nachWrappenGesehen && ergebnis.seiteRief === 1 && ergebnis.absturz === null
console.log(ok ? '\n✓ Gesehen, unverändert durchgereicht, kein Stapelüberlauf' : '\n✗ durchgefallen')

/**
 * **Die Folgenliste wird gelesen — Nummer und Kennung je Folge.**
 *
 * Daniel hat am 26.08.2026 den Aufruf mitgeschnitten, mit dem Netflix sie holt.
 * Sie kommt **einmal** je Staffel; ein Skript aus der Konsole kam deshalb
 * zweimal zu spät. Der Leser läuft bei `document_start` und ist rechtzeitig da.
 *
 * Der Auszug ist echt: dieselben Feldnamen, dieselbe Verschachtelung, gekürzt
 * auf zwei Folgen.
 */
{
  gesendet.length = 0
  const antwort = {
    data: {
      videos: {
        __typename: 'Season',
        videoId: 82756676,
        episodes: {
          edges: [
            { node: { __typename: 'Episode', number: 1156, videoId: 82756678, title: 'Folge 1156' } },
            { node: { __typename: 'Episode', number: 1157, videoId: 82756679, title: 'Folge 1157' } },
          ],
        },
      },
    },
  }
  lesFolgenliste(antwort)
  const meldung = gesendet.find((m) => m.marke === 'ak-folgenliste')
  pruefe('die Folgenliste wird weitergereicht', Boolean(meldung), gesendet.map((m) => m.marke))
  pruefe('beide Folgen sind dabei', meldung?.folgen?.length === 2, meldung?.folgen?.length)
  pruefe(
    'Nummer und Kennung stehen beieinander',
    meldung?.folgen?.[0]?.nummer === 1156 && meldung?.folgen?.[0]?.videoId === 82756678,
    meldung?.folgen?.[0],
  )

  /* Ein zweiter Aufruf mit denselben Folgen meldet nichts Neues. */
  gesendet.length = 0
  lesFolgenliste(antwort)
  pruefe('dieselbe Liste löst keine zweite Meldung aus', gesendet.length === 0, gesendet.length)

  /* Eine andere Staffel kommt dazu, statt die erste zu ersetzen. */
  lesFolgenliste({
    data: { videos: { episodes: { edges: [{ node: { __typename: 'Episode', number: 62, videoId: 80107105, title: 'Laboon' } }] } } },
  })
  const zweite = gesendet.find((m) => m.marke === 'ak-folgenliste')
  pruefe('eine zweite Staffel kommt dazu', zweite?.folgen?.length === 3, zweite?.folgen?.length)
  pruefe(
    'und die Liste ist nach Folgennummer sortiert',
    zweite?.folgen?.[0]?.nummer === 62,
    zweite?.folgen?.map((f) => f.nummer),
  )

  /* Eine Antwort ohne Folgen darf nichts anrichten. */
  gesendet.length = 0
  lesFolgenliste({ data: { videos: {} } })
  lesFolgenliste(null)
  pruefe('eine Antwort ohne Folgen wird übergangen', gesendet.length === 0, gesendet.length)
}


/**
 * **Was keine Folge ist, wird nicht mitgenommen.**
 *
 * Am 26.08.2026 nahm die Suche jeden Knoten mit Nummer und großer Kennung.
 * Damit fielen die Empfehlungsleisten und „Weiter ansehen" mit hinein: Daniel
 * sah Heroes, Lucifer und Ozark im Player, mitten in einem Durchlauf über One
 * Piece — und 42 falsche Meldungen gingen an den Worker.
 *
 * Eine Kennung über einer Million hat jeder Netflix-Titel. Der Typ entscheidet.
 */
{
  gesendet.length = 0
  lesFolgenliste({
    data: {
      /* So sieht eine Empfehlungsleiste aus: Nummer und Kennung, aber keine Folge. */
      lolomo: {
        rows: [
          { __typename: 'LolomoRow', number: 1, videoId: 81649836, title: 'Heroes' },
          { __typename: 'Video', number: 2, videoId: 70136120, title: 'Lucifer' },
        ],
      },
    },
  })
  pruefe('Empfehlungsleisten liefern keine Folgen', gesendet.length === 0, gesendet.map((m) => m.folgen))
}


/**
 * **Die Liste gehört zu einer Reihe — beim Wechsel wird geleert.**
 *
 * Daniel am 26.08.2026 auf der Kakegurui-Seite (12 Folgen): „61 Folgen
 * prüfen … zahl sieht falsch aus." 61 ist die Folgenzahl von One Piece
 * Staffel 1. Hinter dem Titel-Dialog liegt die Startseite, und Netflix lädt
 * dort Folgendaten für „Weiter ansehen" mit.
 *
 * Derselbe Fehler wie bei Amazon einen Tag zuvor, und dieselbe Lösung: Der
 * Stand hängt an der Adresse.
 */
{
  gesendet.length = 0
  location.pathname = '/title/80107103'
  lesFolgenliste({
    data: {
      videos: {
        episodes: {
          edges: [
            { node: { __typename: 'Episode', number: 1, videoId: 70202716, title: 'One Piece 1' } },
            { node: { __typename: 'Episode', number: 2, videoId: 70202717, title: 'One Piece 2' } },
          ],
        },
      },
    },
  })
  const opListe = gesendet.find((m) => m.marke === 'ak-folgenliste')
  pruefe('One Piece liefert zwei Folgen', opListe?.folgen?.length === 2, opListe?.folgen?.length)
  pruefe('und die Liste nennt ihre Reihe', opListe?.fuerReihe === '80107103', opListe?.fuerReihe)

  /* Jetzt die andere Reihe — die alten Folgen dürfen nicht überleben. */
  gesendet.length = 0
  location.pathname = '/title/80175351'
  lesFolgenliste({
    data: {
      videos: {
        episodes: {
          edges: [{ node: { __typename: 'Episode', number: 1, videoId: 80179815, title: 'Kakegurui 1' } }],
        },
      },
    },
  })
  const kakeguruiListe = gesendet.find((m) => m.marke === 'ak-folgenliste')
  pruefe(
    'nach dem Reihenwechsel ist nur die neue Folge da',
    kakeguruiListe?.folgen?.length === 1,
    kakeguruiListe?.folgen?.map((f) => f.titel),
  )
  pruefe('und die Reihe ist die neue', kakeguruiListe?.fuerReihe === '80175351', kakeguruiListe?.fuerReihe)

  /* Ohne Titelseite — Startseite, Player — wird gar nichts gesammelt. */
  gesendet.length = 0
  location.pathname = '/browse'
  lesFolgenliste({
    data: {
      videos: {
        episodes: { edges: [{ node: { __typename: 'Episode', number: 9, videoId: 81649836, title: 'Heroes' } }] },
      },
    },
  })
  pruefe('auf der Startseite wird nichts gesammelt', gesendet.length === 0, gesendet.length)
}


/**
 * **Die Empfehlungsleisten der Startseite liefern keine Folgen.**
 *
 * Sie kommen als `data.unifiedEntities` und tragen ebenfalls
 * `__typename: "Episode"` — es sind echte Folgen, nur von fremden Serien.
 * Auf der Kakegurui-Seite (12 Folgen) standen dadurch 61 am Knopf.
 *
 * Der Auszug ist echt: dieselben Nummern wie in der Diagnose vom 26.08.2026.
 */
{
  gesendet.length = 0
  location.pathname = '/title/80175351'
  lesFolgenliste({
    data: {
      unifiedEntities: [
        { __typename: 'Episode', number: 1, videoId: 70177057, title: 'Red John' },
        { __typename: 'Episode', number: 13, videoId: 81649836, title: 'Redstream Explosion!' },
        { __typename: 'Episode', number: 37, videoId: 70136120, title: 'Ein Teil der Familie' },
      ],
    },
  })
  pruefe(
    'unifiedEntities liefert keine Folgen',
    gesendet.length === 0,
    gesendet.map((m) => m.folgen?.map((f) => f.titel)),
  )

  /* Und die echte Staffelliste kommt weiterhin an. */
  lesFolgenliste({
    data: {
      videos: {
        episodes: {
          edges: [
            { node: { __typename: 'Episode', number: 1, videoId: 80179815, title: 'Neuauflage' } },
            { node: { __typename: 'Episode', number: 2, videoId: 80179816, title: 'Momobami' } },
          ],
        },
      },
    },
  })
  const echt = gesendet.find((m) => m.marke === 'ak-folgenliste')
  pruefe('data.videos liefert die Staffel', echt?.folgen?.length === 2, echt?.folgen?.length)
}


/*
  **Netflix zählt jede Staffel neu — die Zuordnung darf nicht aus dem Player kommen.**

  „7 Seeds" hat zweimal die Folgen 1 bis 12, „Beastars" dreimal eine Folge 1.
  Der Durchlauf las die Staffel bis zum 31.08.2026 aus dem Player, während er
  lief; der hinkt hinterher, und das Ergebnis war Zufall: Von 24 geprüften
  Folgen landeten 22 unter Staffel 1 und zwei unter Staffel 2. Bei „Beastars"
  begann Staffel 3 dadurch bei Folge 1 statt bei 25.

  Seit 4.8.0 führt der Leser die Staffel beim Sammeln mit — sie hängt am
  umgebenden Knoten, nicht an der Folge. Findet sich keine, bleibt das Feld
  leer: Eine geratene Staffel ist schlimmer als keine.
*/
{
  const leserQuelle = readFileSync(__dirname + '/leser.js', 'utf8')
  const melderQuelle = readFileSync(__dirname + '/melder.js', 'utf8')
  pruefe(
    'der Leser reicht die Staffel nach unten durch',
    /sammleFolgen\(v, raus, tiefe \+ 1, hier,/.test(leserQuelle),
  )
  pruefe('… und hängt Kennung und Nummer an die Folge', /seasonId: hier/.test(leserQuelle))
  /*
    **Die Staffel kommt aus dem `Season`-Knoten — gemessen, nicht geraten.**

    Der erste Anlauf suchte nach `seasonSeq`, `seasonNumber` und
    `seasonSequenceNumber`. Keiner dieser Namen existiert; der Knoten nennt nur
    seinen Typ und eine `videoId`. Belegt im Diagnosebericht vom 31.08.2026 zu
    „Dorohedoro":

        data.videos[0] = { __typename: "Season", videoId: 81054852, episodes: … }
  */
  pruefe(
    'erkannt wird der Season-Knoten, nicht ein geratenes Feld',
    leserQuelle.includes("/^season$/i.test(String(o?.__typename"),
  )
  pruefe(
    'die Nummer entsteht aus der Reihenfolge der Kennungen',
    /staffelNummern\.set\(kennung, staffelNummern\.size \+ 1\)/.test(leserQuelle),
  )
  pruefe(
    'ohne Fund bleibt sie leer',
    /return null/.test(leserQuelle.slice(leserQuelle.indexOf('function staffelAus'))),
  )
  pruefe(
    'der Melder nimmt sie vor der Player-Angabe',
    /Number\.isFinite\(f\.staffel\)/.test(melderQuelle),
  )
}

process.exit(ok && !rot.length ? 0 : 1)
