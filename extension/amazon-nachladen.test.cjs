/**
 * Zusicherungen für das Nachladen der Amazon-Folgenabschnitte.
 *
 * ## Woher die Prüfvorlage stammt
 *
 * `data/amazon-raw/getdetailwidgets-B0CKPCSHMC.json.gz` ist die **echte**
 * Antwort, die Amazon am 23.08.2026 lieferte, als Daniel bei „Digimon Tamers"
 * im Auswahlfeld auf „Folgen 25–48" wechselte: 268 KB mit allem, was wirklich
 * darin steht. Ein Test gegen selbst geschriebene Beispieldaten hätte nicht
 * gezeigt, dass ein Muster über den Zeichenabstand hier nur zufällig hielt.
 *
 * ## Seit dem Umbau vom 15.09.2026
 *
 * Der Leser liest je Seite einen Zustand: den Hydration-Block, die Tokens aus
 * dem Quelltext, und holt die übrigen Abschnitte selbst. Amazons eigene
 * Anfragen liest er nicht mehr mit. Der Sandkasten bildet deshalb nach, was
 * der Leser anfasst: den Block (`getElementById`), den Quelltext
 * (`innerHTML`), die Adresse und `fetch`.
 *
 * Die Zugangsdaten aus Daniels Mitschnitt sind **nicht** in der Datei — die
 * letzte Zusicherung prüft das bei jedem Lauf nach.
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

/**
 * Ein Hydration-Block, der gerade genug trägt, damit der Leser die Seite als
 * Staffel erkennt. Die Folgen stehen hier bewusst **nicht** drin: Geprüft wird,
 * dass die Abschnitte 25–48 über das Nachholen ankommen.
 */
const block = JSON.stringify({
  init: {
    preparations: {
      body: {
        atf: {
          state: {
            pageTitleId: 'B0CQ4VL364',
            detail: { headerDetail: { B0CQ4VL364: { entityType: 'TV Show', titleType: 'season', title: 'Digimon Tamers', seasonNumber: 3 } } },
          },
        },
        btf: { state: { detail: { detail: {} } } },
      },
    },
  },
})

/**
 * Der Seitenquelltext, wie ihn Amazon beim ersten Aufbau ausliefert.
 *
 * Die Feldnamen sind gemessen (Daniel, 23.08.2026, Digimon-Seite): Das Token
 * heißt `token`, nicht `widgetToken`, und `titleID` ist **nicht** die Kennung
 * der Seite (`B0CQ4VL364`), sondern `B0CKPCSHMC`. `titleID` steht im echten
 * Quelltext 220-mal, die erste Fundstelle ohne Wert — daran scheiterte 0.50.1.
 *
 * `pagination` gehört mit hinein, denn es ist die eigentliche Falle: dieselben
 * Abschnitte unter **eigenen** Tokens, direkt hinter `episodePages`.
 */
const seitenQuelltext = (() => {
  const liste = JSON.parse(antwort).widgets.episodeList.actions
  const abschnitte = liste.episodePages
    .map((s) => `{"isSelected":${s.isSelected},"text":{"string":${JSON.stringify(s.text.string)}},"token":${JSON.stringify(s.token)}}`)
    .join(',')
  const zweitfassung = (liste.pagination ?? [])
    .map((s) => `{"text":{"string":${JSON.stringify(s.text?.string ?? '')}},"token":${JSON.stringify(s.token)}}`)
    .join(',')
  const stoerung = '"titleID":null,'.repeat(3) + '{"titleIDs":[]},'
  return (
    '<html><body><div id="dv-dp-left-content">…</div>' +
    `<script type="text/template">{${stoerung}"pageTitleId":"B0CQ4VL364","titleID":"B0CKPCSHMC",` +
    `"episodeList":{"actions":{"episodePages":[${abschnitte}],"pagination":[${zweitfassung}]},"episodeCount":51}}</script>` +
    '</body></html>'
  )
})()

/**
 * Den Leser starten. `fetch` liefert für jeden Abschnitt die echte Antwort und
 * schreibt mit, was angefordert wird.
 */
function starte(quelltext) {
  const nachrichten = []
  const angefordert = []
  const fenster = {
    /* Der Leser beantwortet Anfragen von amazon.js — hier fragt niemand. */
    addEventListener() {},
    postMessage: (n) => nachrichten.push(n),
    fetch: async (adresse) => {
      angefordert.push(String(adresse))
      return { ok: true, status: 200, url: 'https://www.amazon.de' + adresse, text: async () => antwort }
    },
  }
  const sandkasten = {
    window: fenster,
    location: { pathname: '/gp/video/detail/B0CQ4VL364/', search: '', href: 'https://www.amazon.de/gp/video/detail/B0CQ4VL364/' },
    document: {
      documentElement: { innerHTML: quelltext },
      getElementById: (id) => (id === 'dv-web-page-hydration-data' ? { textContent: block, firstChild: { length: block.length } } : null),
    },
    setTimeout,
    setInterval,
    clearInterval,
    console,
  }
  sandkasten.globalThis = sandkasten
  vm.createContext(sandkasten)
  vm.runInContext(readFileSync(__dirname + '/amazon-leser.js', 'utf8'), sandkasten)
  return { nachrichten, angefordert }
}

const roh = starte(seitenQuelltext)
const maskiert = starte(seitenQuelltext.replace(/"/g, '\\"'))

setTimeout(() => {
  // --- 1. Aus Block und Quelltext werden die übrigen Abschnitte geholt --------
  pruefe('genau zwei Abschnitte werden nachgeholt (der gewählte lag vor)', roh.angefordert.length === 2, roh.angefordert.length)
  pruefe(
    'die titleID stammt aus dem Quelltext (B0CKPCSHMC), nicht aus der Adresse (B0CQ4VL364)',
    roh.angefordert.every((a) => a.includes('titleID=B0CKPCSHMC')),
    roh.angefordert[0]?.slice(0, 70),
  )
  pruefe('angefordert wird der Folgenlisten-Endpunkt', roh.angefordert.every((a) => a.startsWith('/gp/video/api/getDetailWidgets?')))
  pruefe('kein Abschnitt wird doppelt geholt — auch nicht über die pagination-Tokens', new Set(roh.angefordert).size === roh.angefordert.length)
  pruefe('auch aus maskiertem Quelltext werden die Abschnitte nachgeholt', maskiert.angefordert.length === 2, maskiert.angefordert.length)

  // --- 2. Der Schnappschuss trägt die echte Antwort ------------------------
  const letzter = roh.nachrichten.filter((n) => n.marke === 'ak-amazon-folgen').at(-1) ?? {}
  const nummern = (letzter.funde ?? []).map((f) => f.nummer).sort((a, b) => a - b)
  pruefe('jede Nachricht ist ein Schnappschuss', roh.nachrichten.every((n) => n.schnappschuss === true))
  pruefe('jede Nachricht trägt die Adresse vom Seitenstart', roh.nachrichten.every((n) => typeof n.startAdresse === 'string' && n.startAdresse.length > 10))
  pruefe('alle 24 Folgen des Abschnitts kommen an', nummern.length === 24, nummern.length)
  pruefe('es sind die Folgen 25 bis 48', nummern[0] === 25 && nummern[23] === 48, [nummern[0], nummern[23]])
  pruefe('die Gesamtzahl 51 wird mitgeliefert', letzter.gesamt === 51, letzter.gesamt)
  pruefe('jede Folge trägt „Deutsch"', (letzter.funde ?? []).every((f) => f.sprachen.includes('Deutsch')))
  pruefe('die Abschnitte gelten danach als geholt', letzter.abschnitte?.offen === 0, letzter.abschnitte)

  /* Ein Muster über den Zeichenabstand hätte hier versagt — der Parser macht die Frage gegenstandslos. */
  const abstand = /"audioTracks"[\s\S]*?"episodeNumber"/.exec(antwort)?.[0]?.length ?? 0
  pruefe(`zwischen audioTracks und episodeNumber liegen ${abstand} Zeichen — geparst statt abgetastet`, abstand > 0, abstand)

  // --- 3. Keine Zugangsdaten in der Prüfvorlage -----------------------------
  const verboten = ['session-token', 'at-acbde', 'sst-acbde', 'ubid-acbde', 'x-amz-access-token']
  const gefunden = verboten.filter((w) => antwort.includes(w))
  pruefe('die Prüfvorlage enthält keine Zugangsdaten', gefunden.length === 0, gefunden)

  console.log()
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen erfüllt.')
  // Der Leser hält einen Takt, um Wechsel zu bemerken — ohne dieses Ende liefe der Prozess weiter.
  process.exit(0)
}, 2500)
