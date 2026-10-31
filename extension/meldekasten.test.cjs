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
vm.runInContext(lies('prime-region.js'), sperre)
vm.runInContext(lies('prime-stand.js'), sperre)

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
    document: { querySelector: () => null },
    asinAusAdresse: () => null,
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
    letzterFortschritt: Date.now() - 60_000, // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
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
    briefkastenAdressen: { has: (url) => z.angekommen && url === 'https://www.amazon.de/dp/A' },
    staffelZahl: () => NaN,
    staffelnDerSerie: () => z.staffelnDerSerie,
    gesamtDerSerie: () => z.gesamtDerSerie,
    fertig: () => z.fertig,
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
  /* Wie `nichtAngekommen()` in amazon.js: nur ein vorhandener Briefkasten ohne die Adresse zählt als nicht angekommen. */
  werte.set('nichtAngekommen', (id) => {
    const url = werte.get('liste')[id]?.url
    const adressen = werte.get('briefkastenAdressen')
    return Boolean(url && adressen && !adressen.has(url))
  })
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
    await vorher.meldeSperre.vermerken()
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
    const vorTag = seiteNeu(zustandNeu({ angekommen: true }), { akMeldeSperre: { '/dp/A|1|true': Date.now() - 23 * STUNDE } }) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    await vorTag.meldeSperre.geladen
    vorTag.takt()
    pruefe('23 Stunden nach der Meldung, angekommen: noch gesperrt', !sichtbar(vorTag.knopf), vorTag.knopf.style.display)
    const alt = { akMeldeSperre: { '/dp/A|1|true': Date.now() - 25 * STUNDE } } // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    const z4 = zustandNeu({ angekommen: true })
    const spaet = seiteNeu(z4, alt)
    await spaet.meldeSperre.geladen
    spaet.takt()
    pruefe('25 Stunden später: der gesicherte Befund ist verfallen, Knopf frei', sichtbar(spaet.knopf) && z4.marke === null,
      { marke: z4.marke })
    await spaet.meldeSperre.vermerken()
    pruefe('… und die nächste Meldung sichert ihn nicht weiter (der Speicher wächst nicht)',
      Object.keys(alt.akMeldeSperre).join() === '/dp/A|1|true' && alt.akMeldeSperre['/dp/A|1|true'] > Date.now() - 5000, alt.akMeldeSperre) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    /* Die Meldezeit bleibt die von damals: kam die Meldung nicht an, ist der Knopf nach der Frist auch nach dem Neuladen frei. */
    const z5 = zustandNeu()
    const unterwegs = seiteNeu(z5, { akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } }) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    await unterwegs.meldeSperre.geladen
    unterwegs.takt()
    pruefe('nicht angekommen, Frist um, neu geladen: Knopf frei', sichtbar(unterwegs.knopf) && !unterwegs.knopf.disabled && z5.marke === null,
      { marke: z5.marke })
    const z6 = zustandNeu({ angekommen: true })
    const angekommen = seiteNeu(z6, { akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } }) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    await angekommen.meldeSperre.geladen
    angekommen.takt()
    pruefe('angekommen, Frist um, neu geladen: gesperrt, Marke', !sichtbar(angekommen.knopf) && z6.marke === 'gemeldet ✓', { marke: z6.marke })
  }
}

const STUNDE = 3600 * 1000
/** Eine neu geladene Seite mit gemeinsamem Speicher, Sperre fertig geladen und ein Takt gezeichnet. */
async function geladenNeu(extra, speicher) {
  const z = zustandNeu(extra)
  const s = seiteNeu(z, speicher)
  await s.meldeSperre.geladen
  s.takt()
  return { z, s }
}

/* Drei gesicherte Befunde, der geprüfte in der Mitte, ein verfallener dazwischen (Prüfer, 1397: `break`, `slice(-1)`). */
async function pruefeMehrere() {
  const jetzt = Date.now() // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
  const gelesen = { akMeldeSperre: { '/dp/A|1|true': jetzt - STUNDE, '/dp/A|9|true': jetzt - 25 * STUNDE, '/dp/A|2|true': jetzt - 2 * STUNDE, '/dp/A|3|true': jetzt - 3 * STUNDE } }
  const mitte = await geladenNeu({ staffel: 2, angekommen: true }, gelesen)
  pruefe('drei Befunde im Speicher, neu geladen auf dem mittleren: gesperrt, Marke', mitte.s.meldeSperre.gesperrt() && mitte.z.marke === 'gemeldet ✓',
    { marke: mitte.z.marke })
  const speicher = {}
  const z = zustandNeu({ angekommen: true })
  const s = seiteNeu(z, speicher)
  for (const staffel of [1, 2, 3]) {
    z.staffel = staffel
    await s.meldeSperre.vermerken()
  }
  const neu = await geladenNeu({ staffel: 2, angekommen: true }, speicher)
  pruefe('S1, S2, S3 gemeldet, neu geladen auf S2: gesperrt', neu.s.meldeSperre.gesperrt(), speicher.akMeldeSperre)
  pruefe('… alle drei im Speicher', Object.keys(speicher.akMeldeSperre ?? {}).length === 3, speicher.akMeldeSperre)
}

/* Zwei offene Prime-Tabs: B sichert, ohne A die Sperre zu löschen (Prüfer, 1397). */
async function pruefeZweiTabs() {
  const speicher = {}
  const a = await geladenNeu({ pfad: '/dp/X', angekommen: true }, speicher)
  const b = await geladenNeu({ pfad: '/dp/Y', angekommen: true }, speicher)
  await a.s.meldeSperre.vermerken()
  await b.s.meldeSperre.vermerken()
  const wieder = await geladenNeu({ pfad: '/dp/X', angekommen: true }, speicher)
  pruefe('Tab A meldet, Tab B meldet, A neu geladen: weiter „gemeldet"', wieder.s.meldeSperre.gesperrt() && wieder.z.marke === 'gemeldet ✓',
    speicher.akMeldeSperre)
  /* A kennt X noch mit alter Zeit, ein anderer Tab hat X jünger gesichert und einen verfallenen Befund liegen lassen. */
  const jetzt = Date.now() // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
  const geteilt = { akMeldeSperre: { '/dp/X|1|true': jetzt - 5 * STUNDE } }
  const alt = await geladenNeu({ pfad: '/dp/X', angekommen: true }, geteilt)
  geteilt.akMeldeSperre = { '/dp/W|1|true': jetzt - 25 * STUNDE, '/dp/X|1|true': jetzt - STUNDE, '/dp/V|1|true': jetzt - 2 * STUNDE }
  alt.z.pfad = '/dp/Y'
  await alt.s.meldeSperre.vermerken()
  const k = geteilt.akMeldeSperre
  pruefe('Zusammenführen: jüngste Meldezeit je Befund, Verfallenes fällt, fremde bleiben',
    k['/dp/X|1|true'] === jetzt - STUNDE && !('/dp/W|1|true' in k) && k['/dp/V|1|true'] === jetzt - 2 * STUNDE && '/dp/Y|1|true' in k, k)
}

/* Angekommen nur, wenn der Worker die Meldung führt; sonst gilt die Frist (Prüfer, 1397). */
async function pruefeBeleg() {
  const nachFrist = () => ({ akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } }) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
  const faelle = [
    ['Briefkasten-Antwort fehlt', { briefkastenAdressen: null, briefkastenSeiten: null }, false],
    ['Seite nicht auf der Prüfliste, Briefkasten ohne sie', { liste: {}, briefkastenAdressen: new Set(), briefkastenSeiten: new Set() }, false],
    ['Worker führt die Kennung der Seite', { briefkastenAdressen: new Set(), briefkastenSeiten: new Set(['B', 'A', 'C']) }, true],
    ['Worker führt eine andere Kennung', { briefkastenAdressen: new Set(), briefkastenSeiten: new Set(['B']) }, false],
    ['Kennung nicht lesbar', { briefkastenAdressen: new Set(), briefkastenSeiten: new Set(['A']), asin: () => { throw new Error('weg') } }, false],
    ['Worker führt die Adresse der Prüfliste', { briefkastenAdressen: new Set(['https://www.amazon.de/dp/A']), briefkastenSeiten: null }, true],
  ]
  for (const [name, werte, gesperrt] of faelle) {
    const z = zustandNeu()
    const s = seiteNeu(z, nachFrist())
    for (const [k, v] of Object.entries(werte)) s.werte.set(k, v)
    await s.meldeSperre.geladen
    pruefe(`${name}, Frist um: ${gesperrt ? 'gesperrt' : 'frei'}`, s.meldeSperre.gesperrt() === gesperrt)
  }
}

/* Takt vor der Briefkasten-Antwort vergisst nichts; erst „nicht da“ (belegt) löscht (Prüfer, 1397, Auflage A). */
async function pruefeBelegSpaet() {
  const ADRESSE = 'https://www.amazon.de/dp/A'
  const alt = () => ({ akMeldeSperre: { '/dp/A|1|true': Date.now() - sperre.AK_MELDE_SPERRE.FRIST_MS - 1000 } }) // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
  const z = zustandNeu()
  const s = seiteNeu(z, alt())
  s.werte.set('briefkastenAdressen', null)
  await s.meldeSperre.geladen
  s.takt()
  s.werte.set('briefkastenAdressen', new Set(['x', ADRESSE, 'y']))
  s.takt()
  pruefe('Takt vor der Antwort (null), Frist um, dann führt der Briefkasten die Adresse: gesperrt',
    s.meldeSperre.gesperrt() && z.marke === 'gemeldet ✓', { marke: z.marke })
  const z3 = zustandNeu()
  const s3 = seiteNeu(z3, alt())
  s3.werte.set('briefkastenAdressen', null)
  s3.werte.set('asin', () => { if (new Error().stack.includes('belegt')) throw new Error('weg'); return 'A' })
  await s3.meldeSperre.geladen
  s3.takt()
  s3.werte.set('briefkastenAdressen', new Set(['x', ADRESSE, 'y']))
  s3.takt()
  pruefe('… auch wenn die Kennung beim ersten Takt nicht lesbar ist', s3.meldeSperre.gesperrt())
  const z2 = zustandNeu()
  const s2 = seiteNeu(z2, alt())
  s2.werte.set('briefkastenAdressen', new Set(['x', 'y', 'z']))
  await s2.meldeSperre.geladen
  s2.takt()
  s2.werte.set('briefkastenAdressen', new Set(['x', ADRESSE, 'y']))
  s2.takt()
  pruefe('Briefkasten antwortet „nicht da“, Frist um: vergessen, auch wenn die Adresse später auftaucht', !s2.meldeSperre.gesperrt())
  /* Auflage D: Kennung nicht lesbar, Briefkasten ohne die Adresse, Frist um — das ist „nicht da“ (false), nicht unbekannt. */
  const z4 = zustandNeu()
  const s4 = seiteNeu(z4, alt())
  s4.werte.set('briefkastenAdressen', new Set(['x', 'y']))
  s4.werte.set('asin', () => { if (new Error().stack.includes('belegt')) throw new Error('weg'); return 'A' })
  await s4.meldeSperre.geladen
  s4.takt()
  s4.werte.set('briefkastenAdressen', new Set(['x', ADRESSE, 'y']))
  s4.takt()
  pruefe('Kennung wirft, Briefkasten ohne Adresse, Frist um: vergessen, auch wenn die Adresse später auftaucht', !s4.meldeSperre.gesperrt())
}

/*
  Auflage C (Prüfer, 1397): Der Briefkasten kommt bis zu ZAEHLEN_SEKUNDEN (2 h) alt aus dem Edge-Cache und kennt die
  eigene Meldung dann noch nicht. Speicher B, A, C; A ist 121 s bzw. knapp 2 h alt; der Briefkasten führt andere
  Adressen und Kennungen vor und hinter ihr. Erwartet: gesperrt, auf derselben Seite (mehrere Takte) und nach dem Neuladen.
*/
async function pruefeVeralteterBriefkasten() {
  const leer = await geladenNeu({ angekommen: true }, {})
  pruefe('leerer Speicher, Worker führt die Adresse: frei, Knopf sichtbar', !leer.s.meldeSperre.gesperrt() && sichtbar(leer.s.knopf))
  for (const alter of [121 * 1000, 2 * STUNDE - 1000]) {
    const jetzt = Date.now() // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
    const speicher = { akMeldeSperre: { '/dp/B|1|true': jetzt - STUNDE, '/dp/A|1|true': jetzt - alter, '/dp/C|1|true': jetzt - 3 * STUNDE } }
    const veraltet = (s) => {
      s.werte.set('briefkastenAdressen', new Set(['https://www.amazon.de/dp/B', 'https://www.amazon.de/dp/C']))
      s.werte.set('briefkastenSeiten', new Set(['B', 'C']))
    }
    const z = zustandNeu()
    const s = seiteNeu(z, speicher)
    veraltet(s)
    await s.meldeSperre.geladen
    s.takt()
    s.takt()
    pruefe(`Meldung ${alter / 1000} s alt, Briefkasten aus dem Cache ohne sie: gesperrt, Marke`,
      s.meldeSperre.gesperrt() && z.marke === 'gemeldet ✓' && !sichtbar(s.knopf), { marke: z.marke })
    const z2 = zustandNeu()
    const neu = seiteNeu(z2, speicher)
    veraltet(neu)
    await neu.meldeSperre.geladen
    neu.takt()
    pruefe(`… neu geladen, Briefkasten weiter veraltet: gesperrt, Marke`,
      neu.meldeSperre.gesperrt() && z2.marke === 'gemeldet ✓' && !sichtbar(neu.knopf), { marke: z2.marke })
  }
}

/* Seite meldet X jetzt, im Speicher steht X noch mit alter Zeit: die jüngere gewinnt (Prüfer, 1397, Auflage B). */
async function pruefeJuengereGewinnt() {
  const jetzt = Date.now() // uhr-echt: Zeitstempel relativ zur echten Uhr, der Prüfling liest sie selbst
  const speicher = { akMeldeSperre: { '/dp/W|1|true': jetzt - STUNDE, '/dp/X|1|true': jetzt - 5 * STUNDE, '/dp/V|1|true': jetzt - 2 * STUNDE } }
  const x = await geladenNeu({ pfad: '/dp/X', angekommen: true }, speicher)
  await x.s.meldeSperre.vermerken()
  const k = speicher.akMeldeSperre
  pruefe('Speicher X alt, Seite meldet X jetzt: X = jetzt, W und V bleiben',
    k['/dp/X|1|true'] > jetzt - 1000 && k['/dp/W|1|true'] === jetzt - STUNDE && k['/dp/V|1|true'] === jetzt - 2 * STUNDE, k)
}

async function main() {
  pruefeVorher()
  pruefeZweige()
  await pruefeNeuladen()
  await pruefeAlter()
  await pruefeMehrere()
  await pruefeZweiTabs()
  await pruefeBeleg()
  await pruefeBelegSpaet()
  await pruefeVeralteterBriefkasten()
  await pruefeJuengereGewinnt()
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
