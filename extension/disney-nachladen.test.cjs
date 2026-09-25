/**
 * Disney+: Bricht das Nachladen ab, darf der Leser nicht „vollständig" melden (25.09.2026).
 *
 * Daniels Fehler aus `chrome://extensions`: „Nachladen abgebrochen: TypeError: Failed to fetch".
 * Im Briefkasten standen danach Naruto Shippuden mit 112 von rund 500 und Yu-Gi-Oh! mit 144 von
 * rund 224 Folgen — `allesHolen()` meldete im `finally` jedes Mal `vollstaendig: true`.
 *
 * Im Sandkasten läuft der Abschnitt „Nachladen" aus `disney-leser.js` unverändert; `fetch`,
 * Uhr und `melde()` sind nachgebaut.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const quelle = readFileSync(__dirname + '/disney-leser.js', 'utf8')
const von = quelle.indexOf('  // --- Nachladen')
const bis = quelle.indexOf('  // --- Fragen')

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Disney+: Nachladen mit Abbruch\n')
pruefe('Abschnitt in disney-leser.js gefunden', von > 0 && bis > von)

/** `antworten(aufruf)` liefert je Abruf eine Antwort oder wirft. */
function lauf(antworten) {
  const gemeldet = []
  let aufrufe = 0
  const kontext = {
    EXPLORE: 'https://api/season/',
    TAKT: 0,
    kopfzeilen: { authorization: 'x' },
    staffeln: [{ id: 's1', name: 'Staffel 1', gesamt: 48 }],
    folgen: new Map(),
    holtGerade: false,
    btoa: (s) => Buffer.from(s).toString('base64'),
    encodeURIComponent,
    JSON,
    console: { log() {}, warn() {} },
    setTimeout: (f) => f(),
    altFetch: async () => antworten(aufrufe++),
    sammleFolgen(daten) {
      for (const f of daten?.data?.season?.items ?? []) kontext.folgen.set(f.n, f)
    },
    melde: (vollstaendig = false, hindernis = null) => gemeldet.push({ vollstaendig, hindernis, folgen: kontext.folgen.size }),
  }
  vm.createContext(kontext)
  vm.runInContext(quelle.slice(von, bis), kontext)
  return vm.runInContext('allesHolen()', kontext).then(() => ({ gemeldet, aufrufe: () => aufrufe }))
}

const seite = (ab, n, mehr) => ({
  ok: true,
  json: async () => ({
    data: { season: { items: Array.from({ length: n }, (_, i) => ({ n: ab + i + 1 })), pagination: { hasMore: mehr } } },
  }),
})

;(async () => {
  {
    /* Erste Seite kommt, danach bricht jeder Abruf ab — wie bei Daniel. */
    const { gemeldet } = await lauf((i) => {
      if (i === 0) return seite(0, 24, true)
      throw new TypeError('Failed to fetch')
    })
    const letzte = gemeldet.at(-1)
    pruefe('Abbruch nach 24 von 48: nicht vollständig', letzte?.vollstaendig === false, letzte)
    pruefe('… und mit Hindernis, das den Stand nennt', /abgebrochen bei 24 Folgen/.test(letzte?.hindernis ?? ''), letzte)
  }
  {
    /* Einmal „Failed to fetch", dann geht es weiter: die Wiederholung trägt. */
    const { gemeldet, aufrufe } = await lauf((i) => {
      if (i === 0) return seite(0, 24, true)
      if (i === 1) throw new TypeError('Failed to fetch')
      return seite(24, 24, false)
    })
    const letzte = gemeldet.at(-1)
    pruefe('ein vorübergehender Abbruch wird wiederholt: 48 Folgen, vollständig', letzte?.vollstaendig === true && letzte.folgen === 48, letzte)
    pruefe('… mit genau einem zusätzlichen Abruf', aufrufe() === 3, aufrufe())
  }
  {
    /* HTTP 429 stieg bisher still aus (`return`) — auch das ist ein Abbruch. */
    const { gemeldet } = await lauf((i) => (i === 0 ? seite(0, 24, true) : { ok: false, status: 429 }))
    const letzte = gemeldet.at(-1)
    pruefe('HTTP 429 nach Wiederholungen: nicht vollständig', letzte?.vollstaendig === false, letzte)
  }

  console.log('')
  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) gerissen.`)
    process.exit(1)
  }
  console.log('Alle Zusicherungen zum Disney-Nachladen halten.')
})()
