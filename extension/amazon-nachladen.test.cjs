/**
 * Zusicherungen für das Nachladen der Amazon-Folgenabschnitte.
 *
 * ## Woher die Prüfvorlage stammt
 *
 * `data/amazon-raw/getdetailwidgets-B0CKPCSHMC.json.gz` ist die **echte**
 * Antwort, die Amazon am 23.08.2026 lieferte, als Daniel bei „Digimon Tamers"
 * im Auswahlfeld auf „Folgen 25–48" wechselte. Kein nachgebauter Ausschnitt:
 * 268 KB mit allem, was wirklich darin steht — Besetzungslisten, Bildadressen,
 * Untertitelangaben.
 *
 * Genau das ist der Punkt. Die erste Fassung des Mitlesers suchte per Muster
 * nach einem `episodeNumber` **innerhalb von 240 Zeichen** hinter
 * `audioTracks`. Gemessen an dieser Antwort liegen dazwischen **217 Zeichen** —
 * `catalogId`, `contributors`, `duration`, `enhancedSubtitles`, `entityType`.
 * Es ging also gut, mit 23 Zeichen Luft.
 *
 * Womit die Fassung stand und fiel, war der Zufall einer **leeren**
 * Besetzungsliste: Hier ist `"contributors":{"cast":[],"directors":[],…}`. Wie
 * weit sie bei einer Serie reicht, die ihre Sprecher nennt, ist nicht gemessen
 * — und der Parser macht die Frage gegenstandslos, statt sie zu beantworten.
 * Ein Test gegen selbst geschriebene Beispieldaten hätte weder das eine noch
 * das andere gezeigt.
 *
 * Die Zugangsdaten aus Daniels Mitschnitt (`session-token`, `at-acbde`,
 * `sst-acbde`, Cookies) sind **nicht** in der Datei — gespeichert wurde allein
 * der Antwortkörper, und die letzte Zusicherung unten prüft das bei jedem Lauf
 * nach.
 */
const { readFileSync } = require('node:fs')
const { gunzipSync } = require('node:zlib')
const vm = require('node:vm')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const antwort = gunzipSync(
  readFileSync(__dirname + '/../data/amazon-raw/getdetailwidgets-B0CKPCSHMC.json.gz'),
).toString('utf8')

console.log('Zusicherungen für das Amazon-Nachladen\n')

// --- Die Sandbox ----------------------------------------------------------

/**
 * Der Mitleser läuft in der Seitenwelt und greift `fetch` und
 * `XMLHttpRequest` ab. Hier bekommt er beides nachgebildet — inklusive eines
 * `fetch`, das mitschreibt, welche Adressen er von sich aus anfordert.
 */
function starte() {
  return starteMit(seitenQuelltext)
}

function starteMit(quelltext) {
  const nachrichten = []
  const angefordert = []

  class XMLHttpRequest {}
  Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
    configurable: true,
    enumerable: false,
    get() {
      return this._text ?? ''
    },
  })

  const fensterEigenschaften = {
    postMessage(nachricht) {
      nachrichten.push(nachricht)
    },
    async fetch(adresse) {
      angefordert.push(String(adresse))
      // Zweite Runde: eine Antwort ohne weitere Folgen, damit die Prüfung
      // sieht, ob der Mitleser von selbst aufhört.
      return {
        ok: true,
        url: 'https://www.amazon.de' + adresse,
        text: async () => JSON.stringify({ widgets: { episodeList: { episodes: [] } } }),
      }
    },
  }

  const sandkasten = {
    window: fensterEigenschaften,
    XMLHttpRequest,
    // Bewusst die ASIN der **Seite** — sie ist eine andere als die `titleID`,
    // die der Abruf braucht. Wer sie aus der Adresse baut, liegt falsch.
    location: { href: 'https://www.amazon.de/gp/video/detail/B0CQ4VL364/' },
    document: { documentElement: { innerHTML: quelltext } },
    URL,
    setTimeout,
    setInterval,
    clearInterval,
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon-leser.js', 'utf8'), sandkasten)

  return { sandkasten, nachrichten, angefordert, XMLHttpRequest }
}

/**
 * Der Seitenquelltext, wie ihn Amazon beim ersten Aufbau ausliefert.
 *
 * Die Feldnamen sind gemessen (Daniel, 23.08.2026, Konsole auf der
 * Digimon-Seite) — und beide waren anders, als sie zu erraten gewesen wären:
 *
 *   - Das Token heißt `token`, nicht `widgetToken`. So heißt es nur im Aufruf.
 *   - `titleID` ist **nicht** die ASIN der Seite: Die Seite liegt unter
 *     `B0CQ4VL364`, der Abruf braucht `B0CKPCSHMC`.
 *
 * Die drei Tokens werden aus der archivierten API-Antwort gelesen, nicht
 * abgeschrieben — sie sind dieselben, die auch im Seitenquelltext stehen.
 */
const seitenQuelltext = (() => {
  const seiten = JSON.parse(antwort).widgets.episodeList.actions.episodePages
  const block = seiten
    .map((s) => `{"isSelected":${s.isSelected},"text":{"string":${JSON.stringify(s.text.string)}},"token":${JSON.stringify(s.token)}}`)
    .join(',')
  /**
   * `pagination` gehört mit in die Vorlage, denn es ist die eigentliche Falle.
   *
   * Direkt hinter `episodePages` führt Amazon dieselben Abschnitte ein zweites
   * Mal als „Vorherige Seite" / „Nächste Seite" — unter **eigenen Tokens**. Wer
   * stumpf 20.000 Zeichen absucht, findet fünf statt drei und holt einen
   * Abschnitt doppelt (gemessen 23.08.2026 an Daniels Diagnose-Ausgabe: drei
   * Abrufe statt zwei, davon einer über 267 KB umsonst).
   */
  const seitenwechsel = JSON.parse(antwort).widgets.episodeList.actions.pagination ?? []
  const zweitfassung = seitenwechsel
    .map((s) => `{"text":{"string":${JSON.stringify(s.text?.string ?? '')}},"token":${JSON.stringify(s.token)}}`)
    .join(',')

  /**
   * Der Vorspann ist kein Beiwerk: `titleID` steht im echten Quelltext
   * **220-mal** (Daniels Messung, 1,6 MB Seite), und die erste Fundstelle
   * trägt keinen Wert. Genau daran scheiterte 0.50.1 — sie probierte nur die
   * erste und gab dann auf.
   */
  const stoerung = '"titleID":null,'.repeat(3) + '{"titleIDs":[]},'

  return (
    '<html><body><div id="dv-dp-left-content">…</div>' +
    `<script type="text/template">{${stoerung}"pageTitleId":"B0CQ4VL364","titleID":"B0CKPCSHMC",` +
    `"episodeList":{"actions":{"episodePages":[${block}],"pagination":[${zweitfassung}]},"episodeCount":51}}</script>` +
    '</body></html>'
  )
})()

// --- 1. Die echte Antwort wird ausgewertet --------------------------------

{
  const { nachrichten, XMLHttpRequest } = starte()
  const x = new XMLHttpRequest()
  x._text = antwort
  x.responseURL =
    'https://www.amazon.de/gp/video/api/getDetailWidgets?titleID=B0CKPCSHMC&widgets=%5B%5D'
  x.responseText // löst das Mitlesen aus

  const gemeldet = nachrichten.filter((n) => n.marke === 'ak-amazon-folgen')
  pruefe('die echte Antwort wird gemeldet', gemeldet.length >= 1, gemeldet.length)

  const erste = gemeldet[0] ?? {}
  const nummern = (erste.funde ?? []).map((f) => f.nummer).sort((a, b) => a - b)

  pruefe('alle 24 Folgen des Abschnitts werden gefunden', nummern.length === 24, nummern.length)
  pruefe(
    'es sind die Folgen 25 bis 48',
    nummern[0] === 25 && nummern[23] === 48,
    [nummern[0], nummern[23]],
  )
  pruefe(
    'die Gesamtzahl 51 wird mitgeliefert',
    erste.gesamt === 51,
    erste.gesamt,
  )
  pruefe(
    'jede Folge trägt „Deutsch"',
    (erste.funde ?? []).every((f) => f.sprachen.includes('Deutsch')),
  )

  /**
   * Der Kern der Sache: Ein Muster über den Zeichenabstand hätte hier
   * versagt. Die Zusicherung misst den echten Abstand — bricht sie, ist der
   * Rückfall-Zweig zum Hauptweg geworden, und das muss auffallen.
   */
  const abstand = /"audioTracks"[\s\S]*?"episodeNumber"/.exec(antwort)?.[0]?.length ?? 0
  pruefe(
    `zwischen audioTracks und episodeNumber liegen ${abstand} Zeichen — geparst statt abgetastet`,
    abstand > 0,
    abstand,
  )
}

// --- 1b. Der Weg über den Seitenquelltext ---------------------------------

/**
 * Der Fall, an dem die erste Fassung scheiterte.
 *
 * Beim ersten Seitenaufbau liefert Amazon den Abschnitt **im HTML** — es
 * fliegt keine Antwort vorbei, an die sich ein Mitleser hängen könnte. Ohne
 * diesen Weg blieb der Knopf bei „24 von 51 — Abschnitte selbst öffnen"
 * stehen, obwohl die Tokens auf der Seite lagen.
 *
 * Hier wird **nichts** über XHR oder fetch eingespeist: allein aus dem
 * Quelltext muss das Nachholen anlaufen.
 */
{
  const { angefordert } = starte()
  setTimeout(() => {
    pruefe(
      'allein aus dem Seitenquelltext werden zwei Abschnitte nachgeholt',
      angefordert.length === 2,
      angefordert.length,
    )
    pruefe(
      'die titleID stammt aus dem Quelltext (B0CKPCSHMC), nicht aus der Adresse (B0CQ4VL364)',
      angefordert.every((a) => a.includes('titleID=B0CKPCSHMC')),
      angefordert[0]?.slice(0, 70),
    )
    pruefe(
      'die pagination-Tokens werden nicht mitgeholt — sonst käme ein Abschnitt doppelt',
      angefordert.length === 2,
      angefordert.length,
    )
  }, 1200)
}

// --- 1c. Derselbe Quelltext, aber maskiert --------------------------------

/**
 * Amazon legt seine Zustandsdaten mal roh in einem Skriptblock ab, mal
 * maskiert in einem HTML-Attribut (`data-config="{&quot;…\"token\":\"…"`).
 * Welche Form eine Seite wählt, hängt am Baustein, der sie erzeugt — und
 * ändert sich ohne Ankündigung.
 *
 * Der Leser darf sich an keiner von beiden festmachen.
 */
{
  const maskiert = seitenQuelltext.replace(/"/g, '\\"')
  const { angefordert } = starteMit(maskiert)
  setTimeout(() => {
    pruefe(
      'auch aus maskiertem Quelltext werden die Abschnitte nachgeholt',
      angefordert.length === 2,
      angefordert.length,
    )
  }, 1200)
}

// --- 2. Die übrigen Abschnitte werden nachgeholt --------------------------

{
  const { angefordert, XMLHttpRequest } = starte()
  const x = new XMLHttpRequest()
  x._text = antwort
  x.responseURL =
    'https://www.amazon.de/gp/video/api/getDetailWidgets?titleID=B0CKPCSHMC&widgets=%5B%5D'
  x.responseText

  // Das Nachholen läuft mit Pausen — kurz warten, dann nachsehen.
  setTimeout(() => {
    pruefe(
      'genau zwei Abschnitte werden nachgeholt (der dritte lag ja vor)',
      angefordert.length === 2,
      angefordert.length,
    )
    pruefe(
      'die Kennung stammt aus der Adresse, nicht aus einer Vermutung',
      angefordert.every((a) => a.includes('titleID=B0CKPCSHMC')),
      angefordert[0]?.slice(0, 70),
    )
    pruefe(
      'angefordert wird der Folgenlisten-Endpunkt',
      angefordert.every((a) => a.startsWith('/gp/video/api/getDetailWidgets?')),
    )
    pruefe(
      'der bereits gelieferte Abschnitt wird nicht erneut geholt',
      new Set(angefordert).size === angefordert.length,
    )

    /**
     * Der Pfadvergleich hält auch, wenn `location` unvollständig ist.
     *
     * `location.pathname + location.search` ist keine Textverkettung, sobald
     * beide Werte fehlen — es ist eine Zahlenaddition, und `undefined +
     * undefined` ergibt `NaN`. Da `NaN === NaN` falsch ist, meldete der
     * Vergleich bei **jedem** Takt einen Seitenwechsel, leerte `geholt` und
     * holte jeden Abschnitt mehrfach. Die Sandbox oben reicht `pathname` nicht
     * durch — genau deshalb fiel es auf.
     */
    pruefe(
      'kein Abschnitt wird doppelt geholt, auch ohne location.pathname',
      new Set(angefordert).size === angefordert.length,
      angefordert.length,
    )

    // --- 3. Keine Zugangsdaten in der Prüfvorlage -------------------------

    const verboten = ['session-token', 'at-acbde', 'sst-acbde', 'ubid-acbde', 'x-amz-access-token']
    const gefunden = verboten.filter((w) => antwort.includes(w))
    pruefe('die Prüfvorlage enthält keine Zugangsdaten', gefunden.length === 0, gefunden)

    console.log()
    if (fehler.length) {
      console.error(`${fehler.length} Zusicherung(en) verletzt.`)
      process.exit(1)
    }
    console.log('Alle Zusicherungen erfüllt.')
    // Der Leser hält einen Dauertakt, um Staffelwechsel zu bemerken — ohne
    // dieses Ende liefe der Testprozess weiter, obwohl er fertig ist.
    process.exit(0)
  }, 1500)
}
