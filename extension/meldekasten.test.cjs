/**
 * Der Prime-Meldekasten nach einer angekommenen Meldung (4.31.8): nie leer, nie doppelt, übersteht das Neuladen.
 *
 * Anlass (Daniel, 16.10.2026, „Vom Landei zum Schwertheiligen" Staffel 2): 4.31.7 nahm den Merker
 * `gemeldetFuerPfad` heraus; Zweige von `zeichnenRoh()` blenden den Knopf aus, die Marke fehlte —
 * der Kasten zeigte weder Knopf noch Ergebnis. Hier laufen die echte Sperre (`melde-sperre.js`), ihre
 * Verdrahtung und das echte `zeichnenRoh()` aus `amazon.js` gegen eine Kulisse; jeder Zweig, der den
 * Knopf ausblendet, wird nach der Meldung einzeln angesteuert.
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const lies = (datei) => readFileSync(__dirname + '/' + datei, 'utf8')
const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = lies('amazon.js')
const von = quelle.indexOf('  // Sperre nach angekommener Meldung')
const roh = quelle.indexOf('  function zeichnenRoh() {', von)
const bis = quelle.indexOf('\n  }\n', roh)
const code = von < 0 || roh < 0 || bis < 0 ? '' : quelle.slice(von, bis + 4)
pruefe('Sperre, zeichnen() und zeichnenRoh() im Quelltext gefunden', code.length > 20000, code.length)

const sperre = vm.createContext({ Date, String, Number, Boolean, Object, JSON, Promise })
sperre.globalThis = sperre
vm.runInContext(lies('melde-sperre.js'), sperre)

function knopfNeu() {
  const attribute = new Map()
  return {
    dataset: {},
    style: { display: '' },
    disabled: false,
    textContent: '',
    title: '',
    setAttribute: (k, v) => attribute.set(k, String(v)),
    removeAttribute: (k) => attribute.delete(k),
    getAttribute: (k) => attribute.get(k) ?? null,
  }
}

const NATIV = new Set(['Date', 'Math', 'JSON', 'Object', 'String', 'Number', 'Boolean', 'Array', 'Map', 'Set', 'Promise',
  'undefined', 'console', 'Symbol', 'NaN', 'Infinity', 'isNaN', 'parseInt', 'RegExp', 'Error'])

/** Die Seite nach dem Laden: Deutsch-Titel der Prüfliste, alle zwölf Folgen gelesen, Knopf „… · melden". */
function grundwerte(z, knopf, speicher) {
  const folgen = [...Array(12)].map((_, i) => i + 1)
  return {
    globalThis: sperre,
    knopf,
    sendetGerade: false,
    jetztAufSuchseite: () => false,
    location: { get pathname() { return z.pfad }, search: '' },
    durchFuerPfad: null,
    weiterTextPfad: null,
    weiterText: null,
    gemeldetMarke: (an, text = 'gemeldet ✓') => { z.marke = an ? text : null },
    staffelAusAdresse: () => null,
    staffelAusSeite: () => null,
    quelltextPasst: () => true,
    quelltextVeraltet: () => false,
    quelltextVonFruehererSeite: () => false,
    gesehen: { gesamt: 12, nummern: new Set(folgen), jeFolge: new Map(folgen.map((n) => [n, ['Deutsch']])), get fuerAdresse() { return z.pfad } },
    notiere: () => {},
    setzData: () => {},
    sprachenAusFolgen: () => ['Deutsch'],
    kennungImQuelltextBekannt: () => true,
    frischeStaffel: null,
    asinAusSeite: () => 'A',
    asinAusAdresse: () => 'A',
    seitenHtml: () => '',
    eintrag: { titel: 'Titel', url: 'https://www.amazon.de/dp/A' },
    suchauftrag: () => null,
    seitenLage: () => ({ folgenLautSeite: 12, hatFolgenReiter: true, regionFolgen: [], regionWeg: false }),
    letzteQuelltextGesamt: 12,
    gesamtGeaendertAm: 0,
    deutschInFolgen: () => z.deutsch,
    geladeneFolgen: () => z.geladen,
    letzteZahl: 12,
    letzterFortschritt: Date.now() - 60_000,
    GEDULD_MS: 8000,
    RUHE_MS: 2000,
    WARTE_FRIST_MS: 12_000,
    WIDERSPRUCH_MS: 5000,
    letzterStand: '',
    zustandAlsText: () => '',
    liste: z.aufListe ? { L: { url: 'https://www.amazon.de/dp/A' } } : {},
    listenId: 'L',
    serieBekannt: () => false,
    erledigt: z.erledigt,
    seiteOffen: () => false,
    staffelSchluessel: () => z.staffel,
    staffelText: (n) => String(n),
    gemeldeteStaffel: z.gemeldeteStaffel,
    istFilmSeite: () => false,
    istVollstaendig: () => true,
    ueberKanal: () => false,
    zugangsart: () => 'abo',
    ausgabenDieserStaffel: () => 1,
    standGeladen: true,
    standZiele: new Set(),
    briefkastenSeiten: new Set(),
    staffelZahl: () => NaN,
    staffelnDerSerie: () => z.staffelnDerSerie,
    gesamtDerSerie: () => z.gesamtDerSerie,
    fertig: () => z.fertig,
    nichtAngekommen: () => !z.angekommen,
    wiedervorlage: () => false,
    widerspruchSeit: 0,
    asin: () => 'A',
    id: 'A',
    staffelNummer: () => z.staffel,
    speicherLesen: async (k) => ({ [k]: speicher[k] }),
    speicherSchreiben: async (werte) => Object.assign(speicher, werte),
  }
}

/** Eine geladene Seite mit der echten Verdrahtung; `speicher` ist `chrome.storage.local` und übersteht das Neuladen. */
function seiteNeu(z, speicher) {
  const knopf = knopfNeu()
  const werte = new Map(Object.entries(grundwerte(z, knopf, speicher)))
  const kulisse = new Proxy({}, {
    has: (_, name) => typeof name === 'string' && !NATIV.has(name),
    get: (_, name) => {
      if (werte.has(name)) return werte.get(name)
      if (name === Symbol.unscopables) return undefined
      throw new Error(`Kulisse kennt ${String(name)} nicht`)
    },
    set: (_, name, wert) => {
      werte.set(name, wert)
      return true
    },
  })
  const s = new Function('kulisse', `with (kulisse) { ${code}\n return { meldeSperre, zeichnen } }`)(kulisse)
  return { ...s, knopf, werte, takt: () => { werte.set('letzterStand', ''); s.zeichnen() } }
}

/** Stand vor der Meldung: Staffel 1 offen, Knopf „melden". */
function zustandNeu(extra = {}) {
  return {
    pfad: '/dp/A',
    staffel: 1,
    deutsch: true,
    geladen: 12,
    aufListe: true,
    erledigt: {},
    gemeldeteStaffel: null,
    staffelnDerSerie: {},
    gesamtDerSerie: 1,
    fertig: false,
    angekommen: false,
    marke: null,
    ...extra,
  }
}

const sichtbar = (knopf) => knopf.style.display !== 'none'
/* Was der Zweig ohne Sperre an Marke setzt — legt fest, dass jeder Fall seinen eigenen Zweig trifft. */
const markeOhneSperre = {
  'nicht mehr': null,
  'alles durch': 'gemeldet ✓',
  'Staffel gemeldet, keine': null,
  'Staffel gemeldet, eine': '✓ Staffel 1 gemeldet',
  'tote Seite': 'gemeldet ✓',
  'Worker kennt': null,
}
const gemeldet = { L: { staffeln: { 1: true } } }

/*
  Je Zweig, der den Knopf nach der Meldung ausblendet (oder zeigt): wie die Seite danach aussieht.
  „nach" verändert die Kulisse so, wie es die Meldung und der Worker tun; die Reihenfolge stellt
  den Fall aus Daniels Bild (offen 0, Zeile 8432 vor 4.31.8) in die Mitte.
*/
const zweige = [
  ['nicht mehr auf der Prüfliste (Knopf weg, Z. „Weg statt grau")', (s) => s.werte.set('liste', {})],
  ['alles durch (Knopf weg, Marke „gemeldet ✓")', (s, z) => {
    s.werte.set('erledigt', gemeldet)
    z.angekommen = true
    s.werte.set('fertig', () => true)
  }],
  ['Staffel gemeldet, keine offen (Daniels Bild: Knopf weg)', (s, z) => {
    s.werte.set('erledigt', gemeldet)
    z.angekommen = true
    s.werte.set('staffelnDerSerie', () => ({ 1: true, 2: true }))
    s.werte.set('gesamtDerSerie', () => 2)
  }],
  ['Staffel gemeldet, eine offen (Knopf weg, Wegweisung)', (s, z) => {
    s.werte.set('erledigt', gemeldet)
    z.angekommen = true
    s.werte.set('staffelnDerSerie', () => ({ 1: true }))
    s.werte.set('gesamtDerSerie', () => 2)
  }],
  ['tote Seite gemeldet (Knopf weg, Marke)', (s, z) => {
    z.geladen = 0
    s.werte.set('gemeldeteStaffel', 1)
  }],
  ['Worker kennt die Meldung noch nicht (Nukitashi: Knopf bliebe „… · melden")', () => {}],
]

console.log('Prime-Meldekasten nach der Meldung (echtes zeichnenRoh aus amazon.js)\n')

function pruefeVorher() {
  {
    const z = zustandNeu()
    const s = seiteNeu(z, {})
    s.takt()
    pruefe('vor der Meldung: Knopf sichtbar, „melden", keine Marke',
      sichtbar(s.knopf) && s.knopf.textContent.endsWith('melden') && !s.knopf.disabled && z.marke === null,
      { text: s.knopf.textContent, marke: z.marke })
  }
}

function pruefeZweige() {
  for (const [name, nach] of zweige) {
    /* Gegenprobe ohne Sperre: der Zweig selbst blendet den Knopf aus (nur der letzte zeigt ihn). */
    const zRoh = zustandNeu()
    const ohne = seiteNeu(zRoh, {})
    ohne.takt()
    nach(ohne, zRoh)
    ohne.takt()
    const zeigtKnopf = name.startsWith('Worker kennt')
    const marke = Object.entries(markeOhneSperre).find(([anfang]) => name.startsWith(anfang))?.[1]
    pruefe(`${name}: ohne Sperre ${zeigtKnopf ? 'zeigt' : 'blendet'} der Zweig den Knopf, Marke ${marke}`,
      sichtbar(ohne.knopf) === zeigtKnopf && zRoh.marke === marke, { display: ohne.knopf.style.display, marke: zRoh.marke })
    const z = zustandNeu()
    const s = seiteNeu(z, {})
    s.takt()
    s.meldeSperre.vermerken()
    nach(s, z)
    s.takt()
    pruefe(`${name}: Kasten nicht leer (Knopf sichtbar oder Marke)`, sichtbar(s.knopf) || z.marke !== null,
      { display: s.knopf.style.display, marke: z.marke })
    pruefe(`${name}: Marke steht, Knopf nicht zusätzlich`, z.marke !== null && !sichtbar(s.knopf),
      { display: s.knopf.style.display, text: s.knopf.textContent, marke: z.marke })
    pruefe(`${name}: ein Klick meldet nicht`, s.meldeSperre.mitSperre(() => 'meldet')() === undefined)
  }
  {
    const z = zustandNeu()
    const s = seiteNeu(z, {})
    s.takt()
    s.meldeSperre.vermerken()
    s.takt()
    z.staffel = 2
    s.takt()
    pruefe('Wechsel auf ungemeldete Staffel: Knopf „melden" wieder sichtbar und frei, keine Marke',
      sichtbar(s.knopf) && s.knopf.textContent.endsWith('melden') && !s.knopf.disabled && z.marke === null,
      { display: s.knopf.style.display, text: s.knopf.textContent, marke: z.marke })
    pruefe('… und ein Klick meldet', s.meldeSperre.mitSperre(() => 'meldet')() === 'meldet')
  }
}

async function pruefeNeuladen() {
  {
    /* Melden → neu laden (Daniel, 16.10.2026, Nukitashi): die Sperre kommt aus dem Speicher. */
    const speicher = {}
    const z = zustandNeu()
    const vorher = seiteNeu(z, speicher)
    vorher.takt()
    vorher.meldeSperre.vermerken()
    await Promise.resolve()
    const z2 = zustandNeu()
    const neu = seiteNeu(z2, speicher)
    await neu.meldeSperre.geladen
    neu.takt()
    pruefe('nach dem Neuladen: Marke steht, Knopf weg', z2.marke === 'gemeldet ✓' && !sichtbar(neu.knopf),
      { marke: z2.marke, display: neu.knopf.style.display })
    pruefe('nach dem Neuladen: ein Klick meldet nicht', neu.meldeSperre.mitSperre(() => 'meldet')() === undefined)
    const z3 = zustandNeu({ deutsch: false })
    const anders = seiteNeu(z3, speicher)
    await anders.meldeSperre.geladen
    anders.takt()
    pruefe('nach dem Neuladen, anderer Befund (Ton): Knopf frei, keine Marke',
      sichtbar(anders.knopf) && !anders.knopf.disabled && z3.marke === null, { marke: z3.marke })
  }
}

/* Der gesicherte Befund verfällt nach 24 h und trägt seine Meldezeit, nicht die des Neuladens. */
async function pruefeAlter() {
  {
    const STUNDE = 3600 * 1000
    const vorTag = seiteNeu(zustandNeu({ angekommen: true }), { akMeldeSperre: { '/dp/A|1|true': Date.now() - 23 * STUNDE } })
    await vorTag.meldeSperre.geladen
    vorTag.takt()
    pruefe('23 Stunden nach der Meldung, angekommen: noch gesperrt', !sichtbar(vorTag.knopf), vorTag.knopf.style.display)
    const alt = { akMeldeSperre: { '/dp/A|1|true': Date.now() - 25 * STUNDE } }
    const z4 = zustandNeu({ angekommen: true })
    const spaet = seiteNeu(z4, alt)
    await spaet.meldeSperre.geladen
    spaet.takt()
    pruefe('25 Stunden später: der gesicherte Befund ist verfallen, Knopf frei', sichtbar(spaet.knopf) && z4.marke === null,
      { marke: z4.marke })
    spaet.meldeSperre.vermerken()
    await Promise.resolve()
    pruefe('… und die nächste Meldung sichert ihn nicht weiter (der Speicher wächst nicht)',
      Object.keys(alt.akMeldeSperre).join() === '/dp/A|1|true' && alt.akMeldeSperre['/dp/A|1|true'] > Date.now() - 5000, alt.akMeldeSperre)
    /* Die Meldezeit bleibt die von damals: kam die Meldung nicht an, ist der Knopf nach der Frist auch nach dem Neuladen frei. */
    const z5 = zustandNeu()
    const unterwegs = seiteNeu(z5, { akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } })
    await unterwegs.meldeSperre.geladen
    unterwegs.takt()
    pruefe('nicht angekommen, Frist um, neu geladen: Knopf frei', sichtbar(unterwegs.knopf) && !unterwegs.knopf.disabled && z5.marke === null,
      { marke: z5.marke })
    const z6 = zustandNeu({ angekommen: true })
    const angekommen = seiteNeu(z6, { akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } })
    await angekommen.meldeSperre.geladen
    angekommen.takt()
    pruefe('angekommen, Frist um, neu geladen: gesperrt, Marke', !sichtbar(angekommen.knopf) && z6.marke === 'gemeldet ✓', { marke: z6.marke })
  }
}

async function main() {
  pruefeVorher()
  pruefeZweige()
  await pruefeNeuladen()
  await pruefeAlter()
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
    process.exit(1)
  }
  console.log('\nalle Zusicherungen erfüllt')
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
