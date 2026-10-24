/**
 * Lokale Vermerke zählen nur nach dem Prüfstand (24.10.2026, Daniel: „nur auf diesem Rechner“ bei fast jeder
 * Prime-Zeile; Disney+: Laufstatus 7, Knopf 1).
 *
 * Ursache: `?zaehlen=1` liefert `gemeldet` nur seit dem Datenlauf — nach jedem Lauf ist es leer. Die
 * Erweiterung las das als „nichts angekommen“, markierte jede lokal abgehakte Zeile und räumte die
 * Vermerke aus. Disney+ rechnete die eigene „nichts da“-Antwort ab `seit` (26.08.), der Worker ab Prüfstand.
 *
 * Geprüft wird mit den echten Funktionen (`amazon.js`: `nichtAngekommen`, `briefkastenHolen`; `disney-weg.js`).
 * Aufruf: `node extension/meldestand.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const schneide = (quelle, kopf) => {
  const von = quelle.indexOf(`\n  ${kopf}`)
  if (von < 0) throw new Error(`${kopf} nicht im Quelltext`)
  return quelle.slice(von, quelle.indexOf('\n  }\n', von) + 5)
}

const STAND = '2026-10-24T01:36:00.000Z'
const VOR = '2026-10-21T09:00:00.000Z'
const NACH = '2026-10-24T09:00:00.000Z'
const URL = 'https://www.amazon.de/gp/video/detail/B0GXC6GGH6'

/** Eine Seite mit echtem `pruefstand-zeit.js` und `prime-such-bruecke.js`; der Worker antwortet aus `antworten`. */
function seite({ pruefstandAm = STAND, gemeldet = [], vermerk, listeVom = '2026-10-24' }) {
  const gespeichert = []
  const k = vm.createContext({
    Date,
    Set,
    Boolean,
    Array,
    Object,
    String,
    Promise,
    WORKER: 'https://w.example/pruefung',
    liste: { A1: { url: URL } },
    erledigt: vermerk === undefined ? {} : { A1: vermerk },
    briefkastenAdressen: null,
    briefkastenSuchen: null,
    briefkastenSeiten: null,
    briefkastenErwartungen: null,
    briefkastenGeholtAm: 0,
    BRIEFKASTEN_FRIST_MS: 60000,
    standZiele: null,
    frischGemeldet: new Set(),
    uebersichtZeichnen: () => {},
    speicherSchreiben: async (s) => gespeichert.push(s),
    fetch: async (adresse) => ({
      ok: true,
      json: async () =>
        String(adresse).includes('stand=1')
          ? { pruefstandAm, anbieter: [] }
          : { adressen: [], gemeldet, gemeldeteSuchen: [], gemeldeteSeiten: [], erwartungen: {} },
    }),
  })
  k.globalThis = k
  k.AK_OFFENE_AMAZON_ERZEUGT = listeVom
  vm.runInContext(lies('pruefstand-zeit.js'), k)
  vm.runInContext(lies('prime-such-bruecke.js'), k)
  const q = lies('amazon.js')
  vm.runInContext(
    [schneide(q, 'function nichtAngekommen('), schneide(q, 'async function briefkastenHolen(')].join('\n') +
      '\nthis.holen = briefkastenHolen; this.nicht = nichtAngekommen',
    k,
  )
  return {
    gespeichert,
    holen: () => k.holen(true),
    nicht: () => k.nicht('A1'),
    vermerke: () => Object.keys(vm.runInContext('erledigt', k)),
    k,
  }
}

async function prime() {
  console.log('Prime: leeres `gemeldet` nach dem Datenlauf (echte briefkastenHolen / nichtAngekommen)')
  const alt = seite({ vermerk: { zeit: VOR } })
  await alt.holen()
  pruefe('Vermerk vor dem Prüfstand, gemeldet leer: keine Marke', alt.nicht() === false, alt.nicht())
  pruefe('… und nichts wird aufgeräumt', alt.vermerke().join() === 'A1' && alt.gespeichert.length === 0, alt.gespeichert)

  const neu = seite({ vermerk: { zeit: NACH } })
  await neu.holen()
  pruefe('Vermerk nach dem Prüfstand ohne Meldung (Tag der Liste): Marke', neu.nicht() === true, neu.nicht())
  const weg = seite({ vermerk: { zeit: NACH }, listeVom: '2026-10-25' })
  await weg.holen()
  pruefe('Vermerk nach dem Prüfstand, nicht frisch, ohne Meldung: aufgeräumt', weg.vermerke().length === 0 && weg.gespeichert.length === 1, weg.gespeichert)

  const da = seite({ vermerk: { zeit: NACH }, gemeldet: [URL], listeVom: '2026-10-25' })
  await da.holen()
  pruefe('Vermerk nach dem Prüfstand mit Meldung: keine Marke, bleibt', da.nicht() === false && da.vermerke().join() === 'A1', da.nicht())

  const genau = seite({ vermerk: { zeit: STAND } })
  await genau.holen()
  pruefe('Vermerk genau zur Prüfstandzeit zählt als nachher: Marke', genau.nicht() === true, genau.nicht())

  const ohne = seite({ vermerk: {} })
  await ohne.holen()
  pruefe('Vermerk ohne Zeit: keine Marke, bleibt', ohne.nicht() === false && ohne.vermerke().join() === 'A1', ohne.nicht())

  const nurTag = seite({ vermerk: { datum: '2026-10-21' } })
  await nurTag.holen()
  pruefe('alter Vermerk nur mit Tag (`datum`): keine Marke', nurTag.nicht() === false, nurTag.nicht())

  const tagGleich = seite({ vermerk: { datum: '2026-10-24' } })
  await tagGleich.holen()
  pruefe('Vermerk nur mit Tag, am Tag des Prüfstands: Marke (Tagesvergleich)', tagGleich.nicht() === true, tagGleich.nicht())

  const tagVorStand = seite({ vermerk: { zeit: '2026-10-22T10:00:00.000Z' }, listeVom: '2026-10-21' })
  await tagVorStand.holen()
  pruefe('der Prüfstand schlägt den Tag der Liste: Vermerk dazwischen ohne Marke', tagVorStand.nicht() === false, tagVorStand.nicht())

  const ohneUrl = seite({ vermerk: { zeit: NACH }, listeVom: '2026-10-25' })
  ohneUrl.k.liste = {}
  await ohneUrl.holen()
  pruefe('Vermerk ohne Adresse in der Liste bleibt', ohneUrl.vermerke().join() === 'A1', ohneUrl.vermerke())

  const ohneStand = seite({ pruefstandAm: null, vermerk: { zeit: VOR }, listeVom: '2026-10-22' })
  await ohneStand.holen()
  pruefe('ohne Prüfstand-Zeit gilt der Tag der Prüfliste: Vermerk davor ohne Marke', ohneStand.nicht() === false, ohneStand.nicht())
  const ohneStand2 = seite({ pruefstandAm: null, vermerk: { zeit: VOR }, listeVom: '2026-10-21' })
  await ohneStand2.holen()
  pruefe('… am Tag der Prüfliste: Marke', ohneStand2.nicht() === true, ohneStand2.nicht())
}

function disneyWeg(pruefstandAm) {
  const ram = new Map()
  const k = vm.createContext({ Date })
  k.globalThis = k
  vm.runInContext(lies('pruefstand-zeit.js'), k)
  vm.runInContext(lies('disney-weg.js'), k)
  k.akPruefstandAm = pruefstandAm
  const w = k.akDisneyWeg({
    dauer: { getItem: (x) => ram.get(x) ?? null, setItem: (x, v) => ram.set(x, v) },
    jetzt: () => Date.parse('2026-10-24T12:00:00Z'),
  })
  return { w, ram }
}

function disney() {
  console.log('\nDisney+: dieselbe Regel wie der Worker (Prüfstand, nicht `seit`)')
  const SEIT = '2026-08-26'
  const { w, ram } = disneyWeg(STAND)
  ram.set('ak-disney-weg', JSON.stringify({ alt: VOR, neu: NACH }))
  pruefe('Antwort nach `seit`, vor dem Prüfstand: offen (Knopf = Laufstatus)', w.gilt('alt', SEIT) === false, w.gilt('alt', SEIT))
  pruefe('Antwort nach dem Prüfstand: beantwortet', w.gilt('neu', SEIT) === true, w.gilt('neu', SEIT))
  const ohne = disneyWeg(null)
  ohne.ram.set('ak-disney-weg', JSON.stringify({ alt: VOR }))
  pruefe('ohne Prüfstand-Zeit rechnet `seit`', ohne.w.gilt('alt', SEIT) === true && ohne.w.gilt('alt', '2026-12-01') === false, 0)
  pruefe('ohne `seit` und ohne Prüfstand gilt jede Antwort', ohne.w.gilt('alt', null) === true, 0)
  const unbekannt = disneyWeg(STAND)
  pruefe('keine Antwort gespeichert: offen', unbekannt.w.gilt('x', SEIT) === false, 0)
}

async function maßstab() {
  console.log('\nakGemeldetSeit: Prüfstand vor dem Eintragsdatum')
  const k = vm.createContext({
    Date,
    fetch: async () => ({ ok: true, json: async () => ({ pruefstandAm: STAND }) }),
  })
  k.globalThis = k
  vm.runInContext(lies('pruefstand-zeit.js'), k)
  const gelesen = await k.akGemeldetSeit('2026-08-26')
  pruefe('mit Prüfstand-Zeit gilt sie, nicht das Eintragsdatum', gelesen === STAND, gelesen)
  pruefe('und sie ist danach ohne await lesbar', k.akPruefstandAm === STAND, k.akPruefstandAm)
  pruefe('Vermerk nur als Tag, am Tag des Prüfstands: gilt (>=)', k.akVermerkGilt('2026-10-24', null) === true, 0)
  pruefe('Vermerk nur als Tag, einen Tag davor: gilt nicht', k.akVermerkGilt('2026-10-23', null) === false, 0)
  pruefe('Vermerk als ISO knapp vor dem Prüfstand: gilt nicht', k.akVermerkGilt('2026-10-24T01:35:59.000Z', null) === false, 0)
  const kein = vm.createContext({ fetch: async () => ({ ok: false }) })
  kein.globalThis = kein
  vm.runInContext(lies('pruefstand-zeit.js'), kein)
  pruefe('ohne Antwort gilt das Eintragsdatum', (await kein.akGemeldetSeit('2026-08-26')) === '2026-08-26', 0)
}

async function haupt() {
  await maßstab()
  await prime()
  disney()
  const js = JSON.parse(lies('manifest.json')).content_scripts.find((c) => c.js.includes('amazon.js')).js
  pruefe(
    'Manifest: pruefstand-zeit.js lädt auf Amazon vor prime-such-bruecke.js und amazon.js',
    js.includes('pruefstand-zeit.js') && js.indexOf('pruefstand-zeit.js') < js.indexOf('amazon.js'),
    js,
  )
  const schlecht = faelle.filter((x) => !x).length
  console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen.` : `\nAlle ${faelle.length} Prüfungen bestanden.`)
  process.exit(schlecht ? 1 : 0)
}

haupt()
