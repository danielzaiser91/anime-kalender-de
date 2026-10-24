/**
 * Prime-Meldung: Knopf und Klick treffen dieselbe Entscheidung, und jeder Ausstieg nennt seinen Grund
 * (24.10.2026, Dragon Quest: Dai: der Knopf bot nach 15 s Stillstand „melden" an, der Klick stieg still aus,
 * der Durchgang meldete nach 15 s „keine Rückmeldung").
 *
 * Gespielt wird der Quelltext der beiden Stellen aus `amazon.js` (Schnitt, keine Nachbildung) mit denselben Eingaben.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const quelle = readFileSync(resolve(__dirname, 'amazon.js'), 'utf8')
const kasten = {}
kasten.globalThis = kasten
vm.runInNewContext(readFileSync(resolve(__dirname, 'prime-region.js'), 'utf8'), kasten)
const karte = (n) => new Map(Array.from({ length: n }, (_, i) => [i + 1, {}]))

function schnitt(von, bis, ab = 0) {
  const a = quelle.indexOf(von, ab)
  const b = quelle.indexOf(bis, a)
  if (a < 0 || b < 0) throw new Error(`Marke fehlt: ${von} / ${bis}`)
  return { code: quelle.slice(a, b), ende: b }
}

/* Knopf: ab der gemeinsamen Entscheidung bis zur nächsten Sperre. */
const knopfStart = quelle.indexOf('    const keinDeutschDaten = {\n      sollFolgen')
const knopfCode = schnitt('    const keinDeutschDaten = {\n      sollFolgen', '    if (!vollstaendig && !(regionWeg && deutsch)) {').code
/* Klick: der ganze Handler bis vor „Jeder Schritt". */
const KLICK_KOPF = "knopf.addEventListener('click', meldeSperre.mitSperre(async (befundBeimKlick) => {\n"
const klickAb = quelle.indexOf(KLICK_KOPF) + KLICK_KOPF.length
const klickCode = quelle.slice(klickAb, quelle.indexOf('    /**\n     * Jeder Schritt sagt', klickAb))
/* Dazu der Token-Teil bis vor das Senden, für die Ausstiege „Speicher“ und „kein Token“. */
const klickCodeMitToken = quelle.slice(klickAb, quelle.indexOf('    sendetGerade = true', klickAb))

function knopfBietet(e) {
  const knopf = { dataset: { tot: String(e.tot ?? false) }, textContent: '', title: '', disabled: false }
  const f = new Function(
    'knopf', 'gesehen', 'lageJetzt', 'geladen', 'wegInRegion', 'vollstaendig', 'nichtAbrufbar', 'deutsch', 'ueberKanal', 'globalThis',
    `${knopfCode}\nreturn 'melden'`,
  )
  const r = f(
    knopf, { gesamt: e.gesamt, abschnitte: e.abschnitte }, { folgenLautSeite: e.lautSeite ?? 0 }, e.geladen, e.gesperrt ?? 0,
    e.vollstaendig, e.lageTot ?? e.tot ?? false, e.deutsch ?? false, () => e.kanal ?? false, kasten,
  )
  return { bietet: r === 'melden' && !knopf.disabled, knopf }
}

async function klick(e, umgebung = {}) {
  const knopf = { dataset: { tot: String(e.tot ?? false), ...(umgebung.dataset ?? {}) }, textContent: '', title: '' }
  const abgewiesen = []
  const f = new Function(
    'knopf', 'verbindungLebt', 'standGeladen', 'standFertig', 'erledigt', 'listenId', 'staffelSchluessel', 'letzterStand', 'zeichnen',
    'location', 'htmlNeuLesen', 'sprachenAusFolgen', 'geladeneFolgen', 'deutschInFolgen', 'gesehen', 'seitenLage', 'ueberKanal',
    'setTimeout', 'abweisen', 'chrome', 'globalThis',
    `return (async () => {\n${klickCodeMitToken}\nreturn 'sendet'\n})()`,
  )
  const ergebnis = await f(
    knopf, () => umgebung.verbindung ?? true, umgebung.standGeladen ?? true, Promise.resolve(), umgebung.erledigt ?? {}, 'L',
    () => 'S', '', () => {}, { reload() {} }, () => {}, () => [], () => e.geladen, () => e.deutsch ?? false,
    { gesamt: e.gesamt, abschnitte: e.abschnitte, gesperrt: e.gesperrt ? karte(e.gesperrt) : undefined },
    () => ({ folgenLautSeite: e.lautSeite ?? 0, regionFolgen: [] }), () => e.kanal ?? false, () => {},
    (grund, ok = false) => abgewiesen.push({ grund, ok }),
    { storage: { sync: { get: umgebung.tokenGet ?? (() => Promise.resolve({ token: 'T' })) } } }, kasten,
  )
  return { sendet: ergebnis === 'sendet', abgewiesen, knopf }
}

console.log('Prime-Meldung: Knopf und Klick eine Regel\n')
pruefe('Schnitt Knopf gefunden', knopfStart > 0 && knopfCode.includes('akPrimeMeldungErlaubt'))
pruefe('Schnitt Klick gefunden', klickCode.length > 500 && klickCode.includes('akPrimeMeldungErlaubt'))

/* Tabelle: dieselben Eingaben — Knopf „melden" genau dann, wenn der Klick sendet (Knopf nur geprüft, wo er vollständig meldet). */
const TABELLE = [
  { name: 'Dai: Stillstand vor voller Zahl (75 von 99), kein Deutsch', geladen: 75, gesamt: 99, vollstaendig: true, erwartet: false },
  { name: 'Dai als Kanal-Titel', geladen: 75, gesamt: 99, vollstaendig: true, kanal: true, erwartet: false },
  { name: 'genau 1 fehlt (98 von 99)', geladen: 98, gesamt: 99, vollstaendig: true, erwartet: false },
  { name: 'Stillstand, Seitenzahl größer als Nachlade-Zahl', geladen: 24, gesamt: 24, lautSeite: 51, vollstaendig: true, erwartet: false },
  { name: 'gesperrte Folgen füllen auf (27 + 24 von 51)', geladen: 27, gesperrt: 24, gesamt: 51, vollstaendig: true, erwartet: true },
  { name: 'eine gesperrte zu wenig (27 + 23 von 51)', geladen: 27, gesperrt: 23, gesamt: 51, vollstaendig: true, erwartet: false },
  { name: 'alle gelesen (99 von 99)', geladen: 99, gesamt: 99, vollstaendig: true, erwartet: true },
  { name: 'Deutsch gefunden trotz Stillstand bei 75 von 99', geladen: 75, gesamt: 99, vollstaendig: true, deutsch: true, erwartet: true },
  { name: 'nicht abrufbar (tot) ohne Folgenzahl', geladen: 3, gesamt: 24, vollstaendig: true, tot: true, erwartet: true },
  { name: 'Lage sagt nicht abrufbar, Knopf-Zustand nicht (auseinanderlaufend)', geladen: 75, gesamt: 99, vollstaendig: true, lageTot: true, tot: false, erwartet: false },
  { name: 'Lage sagt abrufbar, Knopf-Zustand tot (auseinanderlaufend)', geladen: 3, gesamt: 24, vollstaendig: true, lageTot: false, tot: true, erwartet: true },
  { name: 'Band-Staffel: alle zwei Abschnitte gelesen (48 von 96 genannt)', geladen: 48, gesamt: 96, lautSeite: 96, abschnitte: { gesamt: 2, offen: 0 }, vollstaendig: true, erwartet: true },
  { name: 'Dai: fünf Abschnitte, einer offen (75 von 99)', geladen: 75, gesamt: 99, abschnitte: { gesamt: 5, offen: 1 }, vollstaendig: true, erwartet: false },
  { name: 'ohne Folgenzahl, eine Folge', geladen: 1, gesamt: 0, vollstaendig: true, erwartet: true },
]
async function tabelle() {
  for (const z of TABELLE) {
    const k = knopfBietet(z)
    const c = await klick(z)
    pruefe(`${z.name}: Knopf bietet „melden" = ${z.erwartet}`, k.bietet === z.erwartet, k.knopf)
    pruefe(`${z.name}: Knopf gesperrt = ${!z.erwartet}`, k.knopf.disabled === !z.erwartet, k.knopf)
    pruefe(`${z.name}: Klick sendet = ${z.erwartet}`, c.sendet === z.erwartet, c)
    pruefe(`${z.name}: Knopf und Klick gleich`, k.bietet === c.sendet)
    if (!z.erwartet) {
      pruefe(`${z.name}: Abweisung mit Grund`, c.abgewiesen.length === 1 && c.abgewiesen[0].grund === 'Staffel nicht vollständig gelesen', c.abgewiesen)
      pruefe(`${z.name}: Knopf und Klick nennen denselben Text`, k.knopf.textContent === c.knopf.textContent && k.knopf.title === c.knopf.title, [k.knopf.textContent, c.knopf.textContent])
    } else {
      pruefe(`${z.name}: kein Ausstieg gemeldet`, c.abgewiesen.length === 0, c.abgewiesen)
    }
  }
  const kanal = await klick({ geladen: 75, gesamt: 99, kanal: true })
  const laeuft = knopfBietet({ geladen: 75, gesamt: 99, vollstaendig: false })
  pruefe('Liste noch nicht vollständig: die Entscheidung greift am Knopf nicht (andere Sperre zuständig)', laeuft.knopf.textContent === '' && laeuft.bietet === true, laeuft.knopf)
  const mehr = kasten.akPrimeKeinDeutschSperre({ sollFolgen: 5, geladen: 7, gesperrt: 0, kanal: false })
  pruefe('Sperrtext: nie eine negative Zahl', /fehlen 0$/.test(mehr.text), mehr.text)
  pruefe('Kanal-Titel: Hinweis nennt das Kanal-Abo',/Kanal-Abo/.test(kanal.knopf.title), kanal.knopf.title)
  const normal = await klick({ geladen: 75, gesamt: 99 })
  pruefe('ohne Kanal: Hinweis nennt keinen Kanal', !/Kanal/.test(normal.knopf.title), normal.knopf.title)
  pruefe('Text nennt „fehlen 24"', /75 von 99 Folgen gelesen — für „kein Deutsch" fehlen 24/.test(normal.knopf.textContent), normal.knopf.textContent)
}

/* Jeder bewusste Ausstieg ohne Senden setzt einen Grund. */
async function ausstiege() {
  const voll = { geladen: 99, gesamt: 99 }
  const faelle = [
    ['Verbindung weg', voll, { verbindung: false }, 'Erweiterung neu geladen', false],
    ['schon gemeldet (nach dem Laden des Stands)', voll, { standGeladen: false, erledigt: { L: { staffeln: { S: true } } } }, 'schon gemeldet', true],
    ['Staffelwechsel läuft', voll, { dataset: { wechselt: 'true' } }, 'Staffelwechsel läuft', false],
    ['Neuladen-Knopf', voll, { dataset: { neuLaden: 'true' } }, 'Seite lädt neu', false],
    ['keine Folge gelesen', { geladen: 0, gesamt: 24 }, {}, 'keine Folge gelesen', false],
    ['Staffel unvollständig, kein Deutsch', { geladen: 75, gesamt: 99 }, {}, 'Staffel nicht vollständig gelesen', false],
    ['Speicher wirft', voll, { tokenGet: () => Promise.reject(new Error('Der Speicher antwortet nicht')) }, 'Der Speicher antwortet nicht', false],
    ['Token fehlt', voll, { tokenGet: () => Promise.resolve({}) }, 'kein Token', false],
  ]
  for (const [name, e, umgebung, grund, ok] of faelle) {
    const r = await klick(e, umgebung)
    pruefe(`Ausstieg „${name}": nicht gesendet`, !r.sendet, r)
    pruefe(`Ausstieg „${name}": Grund „${grund}", ok=${ok}`, r.abgewiesen.length === 1 && r.abgewiesen[0].grund === grund && r.abgewiesen[0].ok === ok, r.abgewiesen)
  }
  const sendet = await klick(voll)
  pruefe('Kontrolle: vollständige Staffel sendet und weist nichts ab', sendet.sendet && sendet.abgewiesen.length === 0, sendet)
}

/* Ausstiege, die der Schnitt nicht abdeckt: Token holen und Token fehlt (Quelltext hinter „Jeder Schritt"). */
function abweisenVerdrahtung() {
  const a = quelle.indexOf('  function abweisen(grund, ok = false) {')
  const code = quelle.slice(a, quelle.indexOf('\n  }\n', a) + 4)
  const k = { location: { pathname: '/gp/video/detail/B0X' }, Date: { now: () => 424242 } }
  new Function('k', 'globalThis', 'location', 'Date', `let letzteMeldung = null\n${code}\nabweisen('Grund A')\nk.m1 = letzteMeldung\nabweisen('Grund B', true)\nk.m2 = letzteMeldung`)(k, kasten, k.location, k.Date)
  pruefe('abweisen: Standard ist ok=false, Pfad und Zeit stehen drin', JSON.stringify(k.m1) === JSON.stringify({ pfad: '/gp/video/detail/B0X', ok: false, am: 424242, abgewiesen: 'Grund A' }), k.m1)
  pruefe('abweisen: ok=true wird durchgereicht', k.m2.ok === true && k.m2.abgewiesen === 'Grund B', k.m2)
}

async function haupt() {
  await tabelle()
  await ausstiege()
  abweisenVerdrahtung()
  const teil = await klick({ geladen: 27, gesperrt: 10, gesamt: 51 })
  pruefe('Text zieht gesperrte Folgen ab (27 + 10 von 51 → „fehlen 14")', /fehlen 14$/.test(teil.knopf.textContent), teil.knopf.textContent)
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nAlle Zusicherungen halten.')
}
haupt()
