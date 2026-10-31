/**
 * Prime: „gemeldet" gehört der Seite, nicht dem Auftrag (Higurashi, 31.10.2026, Version 4.32.35).
 *
 * Punkt 1: Staffel 1 (B09JTSD79F) gemeldet; Staffel 2 (B09KX2VLPR) desselben Titels zeigte „gemeldet ✓", weil
 *   `seiteOffen()` ohne Antwort des Briefkastens „nicht offen" sagte und der Abhak-Speicher am Titel hängt.
 * Punkt 2: „nicht da" gemeldet, X, Neuladen: weder Haken noch Knopf. Zwei Ursachen, beide hier belegt:
 *   das CSS von „Weggelegt" (X) blendete die Meldezeile (Knopf und Marke) aus, und die eigene Meldung lebte nur im Speicher
 *   der Seite. Beide Fälle laufen gegen die echten Funktionen bzw. das echte `amazon.js` im Sandkasten.
 * Die Zeit ist fest (Fernzukunft), keine echte Uhr.
 *
 * Aufruf: `node extension/prime-seite-gemeldet.test.cjs`
 */
const vm = require('node:vm')
const { lies } = require('./test-kulisse-amazon.cjs')
const { element, sandkasten, durchlaufen, laufen } = require('./test-kulisse-amazon.cjs')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const S1 = 'B09JTSD79F'
const S2 = 'B09KX2VLPR'
const S3 = 'B09M19FLBJ'
const FEST = 32503680000000
const STUNDE = 3600 * 1000
const SCHLUESSEL = 'akPrimeSeitenGemeldet'

const quelle = lies('amazon.js')
const seiten = { Set, Object, Boolean, String, Promise }
seiten.globalThis = seiten
vm.runInNewContext(lies('prime-stand.js'), seiten)

/* Ein Speicher wie chrome.storage.local, der jede „Seite" überlebt. */
function speicherNeu(anfang = {}) {
  const inhalt = { ...anfang }
  return {
    inhalt,
    lesen: async () => JSON.parse(JSON.stringify(inhalt)),
    schreiben: async (teil) => Object.assign(inhalt, JSON.parse(JSON.stringify(teil))),
  }
}

/* A: die reine Entscheidung, Kennung für Kennung */
function reineEntscheidung() {
  const g = (kennung, brief, selbst) => seiten.akPrimeSeiteGemeldet(kennung, brief, selbst)
  pruefe('Briefkasten führt S1, Seite S1: gemeldet', g(S1, new Set([S1]), new Set()) === true)
  pruefe('Briefkasten führt S1, Seite S2: nicht gemeldet', g(S2, new Set([S1]), new Set()) === false)
  pruefe('Briefkasten schweigt (null), Seite S2: nicht gemeldet', g(S2, null, new Set()) === false)
  pruefe('eigene Meldung S3, Seite S3: gemeldet', g(S3, new Set([S1]), new Set([S3])) === true)
  pruefe('eigene Meldung S3, Seite S2: nicht gemeldet', g(S2, new Set([S1]), new Set([S3])) === false)
  pruefe('ohne Kennung: nicht gemeldet', g(null, new Set([S1]), new Set([S1])) === false)
  pruefe('ohne beide Mengen: nicht gemeldet', g(S1, undefined, undefined) === false)
}

/* B: Sichern und Laden über zwei „Seiten", Frist, fremde Tabs */
async function sichernUndLaden() {
  const speicher = speicherNeu()
  await seiten.akPrimeSeiteSichern(S3, speicher.lesen, speicher.schreiben, FEST)
  const nachNeuladen = new Set()
  await seiten.akPrimeSeitenLaden(nachNeuladen, speicher.lesen, FEST + 5 * 60 * 1000)
  pruefe('Neuladen 5 Minuten später: S3 ist noch gemeldet', nachNeuladen.has(S3) && nachNeuladen.size === 1, [...nachNeuladen])

  const fast = new Set()
  await seiten.akPrimeSeitenLaden(fast, speicher.lesen, FEST + 24 * STUNDE - 1)
  pruefe('eine Millisekunde vor 24 Stunden: noch gemeldet', fast.has(S3), [...fast])
  const abgelaufen = new Set()
  await seiten.akPrimeSeitenLaden(abgelaufen, speicher.lesen, FEST + 24 * STUNDE)
  pruefe('nach genau 24 Stunden: nicht mehr (der Briefkasten führt es)', !abgelaufen.has(S3), [...abgelaufen])

  await seiten.akPrimeSeiteSichern(S2, speicher.lesen, speicher.schreiben, FEST + 2 * STUNDE)
  const beide = speicher.inhalt[SCHLUESSEL]
  pruefe('zweite Meldung ergänzt die erste (zwei Läufe)', beide?.[S3] === FEST && beide?.[S2] === FEST + 2 * STUNDE, beide)
  await seiten.akPrimeSeiteSichern(S1, speicher.lesen, speicher.schreiben, FEST + 25 * STUNDE)
  pruefe('Verfallenes fällt beim nächsten Sichern heraus', speicher.inhalt[SCHLUESSEL]?.[S3] === undefined && speicher.inhalt[SCHLUESSEL]?.[S1] === FEST + 25 * STUNDE, speicher.inhalt[SCHLUESSEL])

  const genau = speicherNeu({ [SCHLUESSEL]: { [S1]: FEST, [S3]: FEST + 1 } })
  await seiten.akPrimeSeiteSichern(S2, genau.lesen, genau.schreiben, FEST + 24 * STUNDE)
  pruefe('Sichern: genau 24 Stunden alt fällt heraus, eine Millisekunde jünger bleibt', genau.inhalt[SCHLUESSEL]?.[S1] === undefined && genau.inhalt[SCHLUESSEL]?.[S3] === FEST + 1, genau.inhalt[SCHLUESSEL])

  const frist = 7800 * 1000
  const mitFrist = speicherNeu({ [SCHLUESSEL]: { [S3]: FEST } })
  const knapp = new Set()
  await seiten.akPrimeSeitenLaden(knapp, mitFrist.lesen, FEST + frist - 1, frist)
  pruefe('mit eigener Frist: eine Millisekunde davor noch gemeldet', knapp.has(S3), [...knapp])
  const vorbei = new Set()
  await seiten.akPrimeSeitenLaden(vorbei, mitFrist.lesen, FEST + frist, frist)
  pruefe('mit eigener Frist: genau an der Frist nicht mehr', !vorbei.has(S3), [...vorbei])

  const leer = new Set()
  await seiten.akPrimeSeitenLaden(leer, async () => null, FEST)
  pruefe('Speicher nicht lesbar (null): leer, kein Absturz', leer.size === 0)
  const fremd = speicherNeu({ [SCHLUESSEL]: { [S1]: FEST } })
  await seiten.akPrimeSeiteSichern(S2, fremd.lesen, fremd.schreiben, FEST + 1)
  pruefe('ein anderer Tab hat S1 gesichert: bleibt neben S2', fremd.inhalt[SCHLUESSEL]?.[S1] === FEST && fremd.inhalt[SCHLUESSEL]?.[S2] === FEST + 1, fremd.inhalt[SCHLUESSEL])
}

/* C: das echte seiteOffen() aus amazon.js */
function seiteOffenLaufen() {
  const treffer = /\n {2}function seiteOffen\(\) \{[\s\S]*?\n {2}\}\n/.exec(quelle)
  pruefe('seiteOffen() im Quelltext gefunden', Boolean(treffer))
  if (!treffer) return
  const offen = (adresse, brief, frisch = new Set(), selbst = new Set()) => {
    const k = vm.createContext({ Set, String, Boolean, briefkastenSeiten: brief, frischGemeldeteSeiten: frisch, selbstGemeldeteSeiten: selbst, asin: () => adresse })
    k.globalThis = k
    vm.runInContext(lies('prime-stand.js'), k)
    return vm.runInContext(`${treffer[0]}\nseiteOffen()`, k)
  }
  pruefe('Higurashi: Briefkasten führt S1, Seite S2: offen', offen(S2, new Set([S1])) === true)
  pruefe('Higurashi: Briefkasten führt S1, Seite S1: nicht offen', offen(S1, new Set([S1])) === false)
  pruefe('Briefkasten noch ohne Antwort (null), Seite S2: offen, nicht „gemeldet"', offen(S2, null) === true)
  pruefe('Briefkasten mit leerer Menge: offen', offen(S2, new Set()) === true)
  pruefe('Seite ohne Kennung: offen', offen(null, new Set([S1])) === true)
  const wirft = vm.createContext({ Set, String, Boolean, briefkastenSeiten: new Set([S1]), frischGemeldeteSeiten: new Set(), asin: () => { throw new Error('keine Kennung') } })
  wirft.globalThis = wirft
  vm.runInContext(lies('prime-stand.js'), wirft)
  pruefe('die Kennung lässt sich nicht lesen (wirft): offen, nicht „gemeldet"', vm.runInContext(`${treffer[0]}\nseiteOffen()`, wirft) === true)
  pruefe('frische eigene Meldung S3, Briefkasten noch alt (führt nur S1): nicht offen', offen(S3, new Set([S1]), new Set([S3])) === false)
  pruefe('frische eigene Meldung S3, Seite S2: offen (je Kennung)', offen(S2, new Set([S1]), new Set([S3])) === true)
  pruefe('nur der 24-Stunden-Merker der Anzeige kennt S3: weiter offen (Anzeige, keine Behauptung)', offen(S3, new Set([S1]), new Set(), new Set([S3])) === true)
}

/* D: Weggelegt (X) blendet die Meldezeile nicht mehr aus */
function weggelegtCss() {
  const css = lies('melder.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const regeln = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  const versteckt = []
  for (const [, wahl, inhalt] of regeln) {
    if (!/display\s*:\s*none/.test(inhalt)) continue
    for (const einzeln of wahl.split(',').map((x) => x.trim())) {
      if (/(^|\s)\.ak-weggelegt\s/.test(einzeln)) versteckt.push(einzeln)
    }
  }
  pruefe('„Weggelegt" versteckt weiter etwas (Titel, Inhalt)', versteckt.some((x) => /\.ak-z-inhalt$/.test(x)) && versteckt.some((x) => /\.ak-z-titel$/.test(x)), versteckt)
  const trifftMelden = versteckt.filter((x) => /\.(ak-z-melden|ak-amazon-knopf-innen|ak-such-fertig)(\s|$)/.test(x))
  pruefe('„Weggelegt" versteckt die Meldezeile (Knopf, Marke) nicht', trifftMelden.length === 0, trifftMelden)
}

/* E: das echte amazon.js im Sandkasten: die Checkliste liest gesicherte eigene Meldungen */
const SUCHE = 'https://www.amazon.de/s?k=Higurashi&i=instant-video'
async function checklisteNachNeuladen({ gesichert = {}, gemeldeteSeiten = [], pfad = `/gp/video/detail/${S2}` } = {}) {
  const angehaengt = []
  const handler = []
  let geschickt = false
  const auftrag = { titel: 'Higurashi', id: 1, suchUrl: SUCHE, zeit: FEST, zielAsin: S2 }
  const speicher = { 'ak-prime-suchauftrag': JSON.stringify(auftrag) }
  const fenster = {
    addEventListener(art, fn) { if (art === 'message') handler.push(fn) },
    location: { pathname: pfad, search: '' },
  }
  const antwort = { imBriefkasten: {}, adressen: [], gemeldet: [], gemeldeteSeiten, erwartungen: { [SUCHE]: [S1, S2, S3] } }
  const k = sandkasten({
    speicher,
    chromeLokal: { get: () => Promise.resolve({ amazonErledigt: {}, amazonSuche: {}, [SCHLUESSEL]: gesichert }), set: () => Promise.resolve() },
    fetch: (u) => {
      if (!geschickt && String(u).includes('stand=1')) {
        geschickt = true
        const daten = { marke: 'ak-amazon-folgen', fuerAdresse: pfad, gesamt: 1, seite: {} }
        for (const h of handler) h({ source: fenster, data: daten })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) })
    },
  })
  k.Date = class extends Date { static now() { return FEST } }
  const dokument = {
    documentElement: { innerHTML: '<html></html>', classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    body: { ...element(), appendChild(e) { angehaengt.push(e); return e } },
    title: 'Amazon.de',
    createElement: () => element(),
    createTextNode: (t) => ({ textContent: t }),
    getElementById: () => null,
    querySelector: (sel) => (sel === '.ak-amazon-suchhinweis' ? angehaengt.find((e) => String(e.className).includes('ak-amazon-suchhinweis')) ?? null : null),
    querySelectorAll: () => [],
    addEventListener() {},
    head: element(),
  }
  Object.assign(k, {
    AK_PRIME_SUCHE: { [SUCHE]: { titel: 'Higurashi', id: 1 } },
    location: { pathname: pfad, search: '', href: 'https://www.amazon.de' + pfad },
    document: dokument,
    window: fenster,
  })
  fenster.document = dokument
  const alle = ['box.js', 'melde-sperre.js', 'prime-stand.js', 'prime-stand-ziele.js', 'prime-region.js', 'prime-fassungen.js', 'amazon.js'].map(lies)
  const { absturz } = laufen([alle.join('\n')], k)
  await durchlaufen()
  k.takt()
  await durchlaufen()
  return { absturz, angehaengt }
}

function zeilen(e, aus = []) {
  if (String(e?.className ?? '').split(/\s+/).includes('ak-such-auswahl')) aus.push(e)
  for (const kind of e?.kinder ?? []) zeilen(kind, aus)
  return aus
}
/** Je Kennung der Checkliste: ✓ oder ○ (Zeile = Stand-Span, dann Text mit der Kennung). */
function haken(lauf) {
  const ergebnis = {}
  for (const z of lauf.angehaengt.flatMap((e) => zeilen(e))) {
    const stand = z.kinder?.[0]
    const text = (z.kinder ?? []).map((x) => x.textContent ?? '').join('')
    for (const kennung of [S1, S2, S3]) if (text.includes(kennung)) ergebnis[kennung] = stand?.textContent
  }
  return ergebnis
}

async function checkliste() {
  const ohne = await checklisteNachNeuladen()
  pruefe('Lauf ohne Absturz', !ohne.absturz, ohne.absturz?.message)
  const h0 = haken(ohne)
  pruefe('die Checkliste steht mit allen drei Seiten', Object.keys(h0).length === 3, h0)
  pruefe('nichts gemeldet, nichts gesichert: alle drei offen', h0[S1] === '○' && h0[S2] === '○' && h0[S3] === '○', h0)

  const gesichert = await checklisteNachNeuladen({ gesichert: { [S3]: FEST - STUNDE } })
  const h1 = haken(gesichert)
  pruefe('nach dem Neuladen: die gesicherte Meldung S3 trägt den Haken', h1[S3] === '✓', h1)
  pruefe('… die Geschwister S1 und S2 bleiben offen (je Seite, nicht je Titel)', h1[S1] === '○' && h1[S2] === '○', h1)

  const alt = await checklisteNachNeuladen({ gesichert: { [S3]: FEST - 25 * STUNDE } })
  pruefe('eine Meldung älter als 24 Stunden zählt nicht mehr', haken(alt)[S3] === '○', haken(alt))

  const brief = await checklisteNachNeuladen({ gemeldeteSeiten: [S1] })
  const h2 = haken(brief)
  pruefe('Briefkasten führt S1: S1 ✓, S2 und S3 offen', h2[S1] === '✓' && h2[S2] === '○' && h2[S3] === '○', h2)
}

async function main() {
  console.log('Prime: gemeldet gehört der Seite\n')
  reineEntscheidung()
  await sichernUndLaden()
  seiteOffenLaufen()
  weggelegtCss()
  await checkliste()
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt`)
    process.exit(1)
  }
  console.log('\nalle Zusicherungen erfüllt (Seite je Kennung, Sichern/Laden 24 h, seiteOffen, Weggelegt-CSS, Checkliste nach Neuladen)')
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
