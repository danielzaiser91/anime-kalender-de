/**
 * Disney+: die Übersicht fragt „schon gemeldet" in einer Anfrage (`?gemeldet-liste=`), nicht je Adresse (16.11.2026, Folge von 4058).
 *
 * Geprüft wird durch Ausführen der echten `briefkastenHolen` samt `gemeldeteHolen` aus `disney.js` (aus dem Quelltext
 * geschnitten) mit den echten `disney-netz.js`, `netflix-uebernahme.js` (`akGemeldetSammel`) und `disney-sammel.js`;
 * der Worker ist eine Kulisse, die jede Anfrage zählt.
 *
 * Aufruf: `node extension/disney-sammel.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const schneide = (quelle, name) => {
  const treffer = new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`).exec(quelle)
  if (!treffer) throw new Error(`${name}() nicht im Quelltext`)
  return treffer[0]
}

const JETZT = Date.parse('2026-11-16T12:00:00Z')
const WORKER = 'https://w.example/pruefung'
const ADRESSEN = ['a', 'b', 'c', 'd', 'e'].map((x) => `https://www.disneyplus.com/de-de/browse/entity-${x}`)
const eintrag = (url, seit) => ({ url, titel: url, seit, staffeln: [{ nr: 1, offen: true }] })

/** Eine frisch geladene Seite; `route`: Verhalten der Sammelroute (`'ok'`, 404, 429 oder `'netz'`). */
function seite(route, vorab = {}, einzelStatus = 200) {
  const abrufe = { sammel: 0, einzeln: 0, adressenJeSammel: [] }
  const speicher = new Map(Object.entries(vorab))
  const k = vm.createContext({
    console,
    Date: class extends Date { static now() { return JETZT } },
    Promise,
    URL,
    URLSearchParams,
    setTimeout,
    localStorage: { getItem: (s) => speicher.get(s) ?? null, setItem: (s, v) => speicher.set(s, v) },
    briefkasten: new Map(),
    gemeldeteAdressen: new Set(),
    erneutBeantwortet: new Set(),
    wartetAufUebernahme: new Set(),
    liste: Object.fromEntries(ADRESSEN.map((u, i) => [`t${i}`, eintrag(u, i < 2 ? '2026-08-01' : undefined)])),
    WORKER,
    folgenSchluessel: (staffel, nummer) => `${staffel ?? 1}e${nummer}`,
    fetch: async (adresse) => {
      const a = String(adresse)
      if (a.includes('gemeldet-liste=')) {
        abrufe.sammel++
        const u = new URL(a)
        const enden = u.searchParams.get('gemeldet-liste').split(',')
        abrufe.adressenJeSammel.push(enden.length)
        if (route === 'netz') throw new Error('Failed to fetch')
        if (route !== 'ok') return { ok: false, status: route, json: async () => ({}) }
        const je = Object.fromEntries(enden.map((e) => [u.searchParams.get('vor') + e, { paare: [{ staffel: 1, nummer: 1, am: '2026-11-01T00:00:00Z' }] }]))
        return { ok: true, status: 200, json: async () => ({ adressen: je }) }
      }
      if (a.includes('?gemeldet=')) {
        abrufe.einzeln++
        if (einzelStatus !== 200) return { ok: false, status: einzelStatus, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ paare: [{ staffel: 1, nummer: 1, am: '2026-11-01T00:00:00Z' }] }) }
      }
      return { ok: true, status: 200, json: async () => ({ gemeldet: [], adressen: [], eintraege: [] }) }
    },
  })
  k.globalThis = k
  k.akDisneyStandEinarbeiten = async () => null
  k.AK_DISNEY_WEG = { erledigt: (u, seit, gemeldet) => gemeldet }
  for (const d of ['disney-netz.js', 'netflix-uebernahme.js', 'disney-sammel.js']) vm.runInContext(lies(d), k)
  const quelle = lies('disney.js')
  vm.runInContext(
    ['istErledigt', 'offeneEintraege', 'briefkastenHolen', 'gemeldeteHolen'].map((n) => schneide(quelle, n)).join('\n'),
    k,
  )
  return { k, abrufe, speicher }
}

async function lauf() {
  const a = seite('ok')
  await vm.runInContext('briefkastenHolen()', a.k)
  pruefe('fünf unbekannte Adressen: genau eine Sammelanfrage', a.abrufe.sammel === 1, a.abrufe)
  pruefe('… und keine Einzelanfrage', a.abrufe.einzeln === 0, a.abrufe)
  pruefe('… sie nennt alle fünf Adressen', a.abrufe.adressenJeSammel[0] === 5, a.abrufe.adressenJeSammel)
  pruefe('die Antworten gelten: Wiedervorlagen beantwortet', vm.runInContext('erneutBeantwortet.size', a.k) === 2, vm.runInContext('[...erneutBeantwortet]', a.k))
  pruefe('die Antworten gelten: die drei offenen warten auf die Übernahme', vm.runInContext('wartetAufUebernahme.size', a.k) === 3, vm.runInContext('[...wartetAufUebernahme]', a.k))

  const zweite = seite('ok', Object.fromEntries(ADRESSEN.map((u) => [`ak-gemeldet:${u}`, `b${JETZT}|2026-11-01`])))
  await vm.runInContext('briefkastenHolen()', zweite.k)
  pruefe('kennt das Gedächtnis alles, geht gar keine Anfrage hinaus', zweite.abrufe.sammel === 0 && zweite.abrufe.einzeln === 0, zweite.abrufe)

  const fehlt = seite(404)
  await vm.runInContext('briefkastenHolen()', fehlt.k)
  pruefe('fehlt die Route (404): eine Sammelanfrage, dann je Adresse einzeln', fehlt.abrufe.sammel === 1 && fehlt.abrufe.einzeln === 5, fehlt.abrufe)
  pruefe('… und die Antworten gelten trotzdem', vm.runInContext('wartetAufUebernahme.size', fehlt.k) === 3, vm.runInContext('[...wartetAufUebernahme]', fehlt.k))

  const einzelKaputt = seite(404, {}, 500)
  await vm.runInContext('briefkastenHolen()', einzelKaputt.k)
  pruefe('fehlt die Route und der Einzelabruf scheitert (500): auch „nichts“ wird nicht abgelegt', einzelKaputt.speicher.size === 0, [...einzelKaputt.speicher.keys()])

  for (const route of [429, 500, 'netz']) {
    const ohne = seite(route)
    await vm.runInContext('briefkastenHolen()', ohne.k)
    pruefe(`keine Auskunft (${route}): keine Einzelanfragen`, ohne.abrufe.einzeln === 0 && ohne.abrufe.sammel === 1, ohne.abrufe)
    pruefe(`… und nichts als „gemeldet“ gemerkt (${route})`, vm.runInContext('erneutBeantwortet.size + wartetAufUebernahme.size', ohne.k) === 0, vm.runInContext('[...wartetAufUebernahme]', ohne.k))
  }
}

lauf().then(() => {
  const rot = faelle.filter((ok) => !ok).length
  console.log(rot ? `disney-sammel: ${rot} von ${faelle.length} Fällen rot` : `disney-sammel: ${faelle.length} Fälle ok`)
  process.exit(rot ? 1 : 0)
}).catch((f) => { console.error(f); process.exit(1) })
