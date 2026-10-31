/**
 * Prime: die Fassungen im Kasten der Titelseite — der Lauf durch `amazon.js` (24.10.2026).
 *
 * Der Briefkasten antwortet asynchron; der Test wartet die Mikrotasks ab, damit die Weiche
 * „Auswahl schon bestätigt" und die Zugangsart der eigenen Seite (Leser-Nachricht) wirken.
 * Die Zeit ist fest (3000), nie die echte Uhr.
 */
const { lies, element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')
const FIXTURE = lies('prime-fassungen.fixture.json')
const SUCHE = 'https://www.amazon.de/s?k=Fischen+Impossible&i=instant-video'
const FEST = 32503680000000
const SELBST = '/gp/video/detail/B01MSMV5MA'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = ['box.js', 'melde-sperre.js', 'prime-stand.js', 'prime-stand-ziele.js', 'prime-region.js', 'prime-fassungen.js', 'amazon.js'].map(lies).join('\n')

/** Lädt amazon.js für `pfad`; `seite` kommt als Leser-Nachricht, `erwartungen` vom Briefkasten. */
async function lauf({ hydration, pfad = SELBST, seite = {}, erwartungen = {}, erwartet = undefined, jahr = undefined } = {}) {
  const angehaengt = []
  const handler = []
  let geschickt = false
  const auftrag = { titel: 'Fischen Impossible', id: 1, suchUrl: SUCHE, zeit: FEST, erwartet, jahr }
  const speicher = { 'ak-prime-suchauftrag': JSON.stringify(auftrag) }
  const fenster = {
    addEventListener(art, fn) { if (art === 'message') handler.push(fn) },
    location: { pathname: pfad, search: '' },
  }
  const antwort = { imBriefkasten: {}, adressen: [], gemeldet: [], gemeldeteSeiten: [], erwartungen }
  const k = sandkasten({
    speicher,
    chromeLokal: { get: () => ({ amazonErledigt: {}, amazonSuche: {} }), set: () => Promise.resolve() },
    fetch: (u) => {
      if (!geschickt && String(u).includes('stand=1')) {
        geschickt = true
        const daten = { marke: 'ak-amazon-folgen', fuerAdresse: pfad, gesamt: 1, seite }
        for (const h of handler) h({ source: fenster, data: daten })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) })
    },
  })
  const dokument = {
    documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    body: { ...element(), appendChild(e) { angehaengt.push(e); return e } },
    title: 'Amazon.de',
    createElement: () => element(),
    createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => (id === 'dv-web-page-hydration-data' ? hydration : null),
    querySelector: (sel) => (sel === '.ak-amazon-suchhinweis' ? angehaengt.find((e) => String(e.className).includes('ak-amazon-suchhinweis')) ?? null : null),
    querySelectorAll: () => [],
    addEventListener() {},
    head: element(),
  }
  Object.assign(k, {
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Fischen Impossible', id: 1 } },
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    document: dokument,
    window: fenster,
  })
  fenster.document = dokument
  const { absturz } = laufen([quelle], k)
  await durchlaufen()
  k.takt()
  await durchlaufen()
  return { absturz, angehaengt }
}

function zeilen(e, aus = []) {
  if (String(e?.className ?? '').split(/\s+/).includes('ak-such-auswahl')) aus.push(e)
  for (const k of e?.kinder ?? []) zeilen(k, aus)
  return aus
}
const zeilenText = (z) => (z.kinder ?? []).map((k) => k.textContent ?? '').join('')
/** Die Ankreuzzeilen der Fassungsauswahl (die Checkliste einer bestätigten Auswahl hat keine Ankreuzfelder). */
const auswahl = (l) => l.angehaengt.flatMap((e) => zeilen(e)).filter((z) => z.kinder[0]?.type === 'checkbox')
const texte = (l) => auswahl(l).map(zeilenText)
const alleTexte = (liste) => liste.flatMap((e) => [e.textContent, ...alleTexte(e.kinder ?? [])]).filter(Boolean)
const daten = (f) => JSON.parse(JSON.stringify(f))

async function kanalOhneAbo() {
  // Gegenprobe: Uncut ohne Abo (Unentitled), Logo und „Prime Video Channels“ ist Kanal
  const channels = JSON.parse(lies('prime-fassungen-kauf.fixture.json'))
  for (const reihe of Object.values(channels.init.preparations.body.btf.state.containers)) {
    const uncut = reihe[0].entities.find((e) => e.titleID === 'B01MSMV5MA')
    uncut.entitlementCues.entitlementType = 'Unentitled'
    uncut.entitlementCues.focusMessage = { message: 'Prime Video Channels' }
  }
  const channelsLauf = await lauf({ hydration: { textContent: JSON.stringify(channels) }, pfad: '/gp/video/detail/B01HRLV328', seite: { kaufbar: true } })
  const ct = texte(channelsLauf)
  pruefe('Unentitled + Logo + „Prime Video Channels“: die Uncut-Fassung ist Kanal, nicht Prime',
    ct.length === 3 && !ct.some((x) => /Kauf\/Abo · Prime/.test(x)) && ct.filter((x) => /Kanal-Abo · Kanal/.test(x)).length === 2, ct)
}

async function main() {
  console.log('Zusicherungen für die Fassungen im Kasten der Titelseite\n')
  const knoten = { textContent: FIXTURE }

  const basis = await lauf({ hydration: knoten })
  pruefe('Lauf ohne Absturz', !basis.absturz, basis.absturz?.message)
  const t = texte(basis)
  pruefe('drei Fassungen in der Auswahl', t.length === 3, t)
  pruefe('Kanal-Fassung mit Kanal-Abo-Beschriftung, Hinweis und Kennung',
    t.some((x) => x.includes('Kanal-Abo · Kanal · Originalversion') && x.includes('(B0GVNJRZCM)')), t)
  pruefe('Kauf-Fassung mit Hinweis und Kennung', t.some((x) => x.includes('Kauf/Abo · Kauf · Alternative Audiosprache') && x.includes('(B01HRLV328)')), t)
  pruefe('Reihenfolge: eigene Seite, Kauf, Kanal', /B01MSMV5MA/.test(t[0] ?? '') && /B01HRLV328/.test(t[1] ?? '') && /B0GVNJRZCM/.test(t[2] ?? ''), t)
  pruefe('alles vorgekreuzt: die Auswahl dient als Ausschluss', auswahl(basis).length === 3 && auswahl(basis).every((z) => z.kinder[0].checked === true))
  pruefe('ohne Seitenstand und Serientitel steht der Auftragstitel für die eigene Seite', /diese Seite · Fischen Impos/.test(t[0] ?? ''), t[0])

  const prime = await lauf({ hydration: knoten, seite: { zugaenge: ['Prime'], serie: 'Zeta' } })
  pruefe('Prime-Zugang der eigenen Seite: Prime vorn, Titel der Seite', /Prime · diese Seite · Zeta/.test(texte(prime)[0] ?? ''), texte(prime))
  const kauf = await lauf({ hydration: knoten, seite: { kaufbar: true, leihbar: true } })
  pruefe('Kaufseite: die eigene Zeile heißt Kauf', /Kauf · diese Seite/.test(texte(kauf)[0] ?? ''), texte(kauf))
  const kanal = await lauf({ hydration: knoten, seite: { zugaenge: ['crunchyrollde'] } })
  pruefe('Kanalseite: die eigene Zeile heißt Kanal und steht hinter Kauf', /Kauf · Alternative/.test(texte(kanal)[0] ?? '') && /Kanal-Abo · Kanal · diese Seite/.test(texte(kanal)[1] ?? ''), texte(kanal))
  pruefe('ohne Zugangsangabe heißt die eigene Zeile Fassung', /Fassung · diese Seite/.test(t.join('|')), t)

  // Weiche: schon bestätigte Auswahl (Briefkasten) schaltet die Fassungsauswahl ab
  const zwei = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB'] } })
  pruefe('zwei bestätigte Ausgaben: keine Fassungsauswahl', auswahl(zwei).length === 0, texte(zwei))
  const eine = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA'] } })
  pruefe('eine bestätigte Ausgabe reicht nicht: Auswahl bleibt', auswahl(eine).length === 3, texte(eine))
  pruefe('über den Kästen steht die Anleitung (Ausschluss statt Auswahl)', alleTexte(eine.angehaengt).some((x) => x === 'Alles angehakt – nimm ab, was nicht zum Titel gehört.'), alleTexte(eine.angehaengt))
  const drei = await lauf({ hydration: knoten, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB', 'B0CCCCCCCC'] } })
  pruefe('drei bestätigte Ausgaben: keine Fassungsauswahl', auswahl(drei).length === 0, texte(drei))

  // Ribbit (31.10.2026): Jahr 2020 gegen 2014 warnt, außer die Seite steht in der bestätigten Auswahl.
  const WARNUNG = /Diese Seite ist von 2020, unser Eintrag von 2014/
  const jahrOhne = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 } })
  pruefe('Jahr 6 Jahre daneben, nichts bestätigt: die Warnung steht da', alleTexte(jahrOhne.angehaengt).some((x) => WARNUNG.test(x)), alleTexte(jahrOhne.angehaengt))
  const jahrBestaetigt = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 }, erwartungen: { [SUCHE]: ['B01MSMV5MA', 'B0BBBBBBBB'] } })
  pruefe('… in der bestätigten Auswahl: keine Warnung', !alleTexte(jahrBestaetigt.angehaengt).some((x) => WARNUNG.test(x)), alleTexte(jahrBestaetigt.angehaengt))
  const jahrAndere = await lauf({ hydration: knoten, jahr: 2014, seite: { jahr: 2020 }, erwartungen: { [SUCHE]: ['B0AAAAAAAA', 'B0BBBBBBBB'] } })
  pruefe('… bestätigt ist eine andere Seite: Warnung bleibt', alleTexte(jahrAndere.angehaengt).some((x) => WARNUNG.test(x)))
  const jahrNah = await lauf({ hydration: knoten, jahr: 2016, seite: { jahr: 2020 } })
  pruefe('Abstand 4 Jahre: weiter keine Warnung', !alleTexte(jahrNah.angehaengt).some((x) => WARNUNG.test(x)))

  // A2: Block eines anderen Films nach SPA-Wechsel
  const fremd = await lauf({ hydration: knoten, pfad: '/gp/video/detail/B0ZZZZZZZZ' })
  pruefe('Block gehört zu einer anderen Adresse: keine Fassungen', !fremd.absturz && auswahl(fremd).length === 0, texte(fremd))

  // A3: GTI-Adresse
  const gti = 'amzn1.dv.gti.0a1b2c3d-4e5f-6789-abcd-ef0123456789'
  const gtiLauf = await lauf({ hydration: { textContent: FIXTURE.replace('/detail/B01MSMV5MA', '/detail/' + gti) }, pfad: '/gp/video/detail/' + gti })
  const gtiTexte = texte(gtiLauf)
  pruefe('GTI-Seite: drei Zeilen, die eigene trägt die GTI', gtiTexte.length === 3 && gtiTexte.some((x) => x.includes(`(${gti})`)), gtiTexte)

  // Kaufseite B01HRLV328: die Uncut-Fassung trägt „In Prime enthalten." und ein Prime-Logo, sie ist Prime und kein Kanal
  const kaufKnoten = { textContent: lies('prime-fassungen-kauf.fixture.json') }
  const ausKauf = await lauf({ hydration: kaufKnoten, pfad: '/gp/video/detail/B01HRLV328', seite: { kaufbar: true } })
  const kt = texte(ausKauf)
  pruefe('Kaufseite: drei Zeilen', kt.length === 3, kt)
  pruefe('Kaufseite: die Uncut-Fassung steht zuerst, als Prime', /Kauf\/Abo · Prime · /.test(kt[0] ?? '') && /B01MSMV5MA/.test(kt[0] ?? ''), kt)
  pruefe('Kaufseite: danach die eigene Seite als Kauf, zuletzt der Kanal',
    /Kauf · diese Seite/.test(kt[1] ?? '') && /Kanal-Abo · Kanal/.test(kt[2] ?? '') && /B0GVNJRZCM/.test(kt[2] ?? ''), kt)

  await kanalOhneAbo()
  // Gegenprobe: dasselbe Logo ohne Prime-Text bleibt Kanal
  const logoOhnePrime = JSON.parse(lies('prime-fassungen-kauf.fixture.json'))
  const liste = logoOhnePrime.init.preparations.body.btf.state.containers
  for (const reihe of Object.values(liste)) {
    for (const e of reihe[0].entities) {
      e.entitlementCues.entitlementType = 'Unentitled'
      e.entitlementCues.focusMessage = { message: 'Gratiszeitraum' }
    }
  }
  const nurKanal = await lauf({ hydration: { textContent: JSON.stringify(logoOhnePrime) }, pfad: '/gp/video/detail/B01HRLV328', seite: { kaufbar: true } })
  const nk = texte(nurKanal)
  pruefe('Logo ohne Prime-Text bleibt Kanal, auch bei der Uncut-Kennung',
    nk.length === 3 && /Kauf · diese Seite/.test(nk[0] ?? '') && nk.filter((x) => /Kanal-Abo · Kanal/.test(x)).length === 2, nk)

  // Gegenproben
  const ohneKnoten = await lauf({ hydration: null })
  pruefe('ohne Hydration-Knoten: keine Auswahl, kein Absturz', !ohneKnoten.absturz && auswahl(ohneKnoten).length === 0)
  const roh = daten(JSON.parse(FIXTURE))
  const behaelter = roh.init.preparations.body.btf.state.containers
  for (const k of Object.keys(behaelter)) behaelter[k] = behaelter[k].map((c) => ({ ...c, title: 'Ähnliche Titel' }))
  const ohneAbschnitt = await lauf({ hydration: { textContent: JSON.stringify(roh) } })
  pruefe('Seite ohne den Abschnitt: keine Auswahl', !ohneAbschnitt.absturz && auswahl(ohneAbschnitt).length === 0)

  if (fehler.length) {
    console.error(`${fehler.length} Zusicherung(en) rot.`)
    process.exit(1)
  }
  console.log('\nDie Fassungen im Kasten halten.')
}

main()
