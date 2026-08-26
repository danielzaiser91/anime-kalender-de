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
    data: { videos: { episodes: { edges: [{ node: { number: 62, videoId: 80107105, title: 'Laboon' } }] } } },
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

process.exit(ok && !rot.length ? 0 : 1)
