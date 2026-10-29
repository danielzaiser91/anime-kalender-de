/**
 * Prime: eine eben gemeldete Suche taucht in der Lücke vor dem Stand nicht wieder auf (24.10.2026, „Es war einmal …").
 *
 * Ursache: `briefkastenHolen` setzte `briefkastenSuchen` aus der bis zu zwei Stunden alten Zählung, bevor `?stand=1`
 * geholt war. Fragte `istGemeldet` in dieser Lücke, galt die frische Suche als „nicht geführt", und
 * `vermerkVerwerfen` löschte den lokalen Vermerk für immer.
 *
 * Gespielt werden die echten Funktionen aus `amazon.js` auf einer frisch geladenen Seite (`standZiele` leer,
 * `frischGemeldet` leer, Zählung ohne die Suche) mit einer Attrappe für `fetch`, deren Stand-Antwort der Test freigibt.
 *
 * Aufruf: `node extension/prime-such-vermerk-luecke.test.cjs`
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, ok, gefunden) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const FEST = Date.parse('2026-10-24T18:00:00Z')
const MIN = 60 * 1000
const SUCHE = 'https://www.amazon.de/s?k=Es%20war%20einmal&i=instant-video'
const ANDERE = 'https://www.amazon.de/s?k=Anderes&i=instant-video'

function schneide(quelle, kopf) {
  const a = quelle.indexOf(`\n  ${kopf}`)
  if (a < 0) throw new Error(`${kopf} nicht im Quelltext`)
  const b = quelle.indexOf('\n  }\n', a)
  return quelle.slice(a, b + 4)
}

/** Frische Seite: Vermerk gesetzt, Zählung ohne die Suche; `stand` ist ein Versprechen, das der Test einlöst. */
function seite({ vermerk, zaehlungOhneSuche = true, standMitSuche = true, pruefstandVor = 60 }) {
  class FestDate extends Date {
    static now() {
      return FEST
    }
  }
  const stand = {}
  stand.versprechen = new Promise((ok, nein) => {
    stand.loese = () => ok({ ok: true, json: async () => ({ anbieter: [{ plattform: 'primevideo', ziele: standMitSuche ? [{ url: SUCHE }] : [] }] }) })
    stand.scheitere = () => nein(new Error('Netz'))
  })
  const geschrieben = []
  const k = vm.createContext({
    Date: FestDate,
    Set,
    Array,
    Object,
    String,
    Math,
    Number,
    Promise,
    JSON,
    WORKER: 'https://w.example/pruefung',
    BRIEFKASTEN_FRIST_MS: 60_000,
    briefkastenGeholtAm: 0,
    standZiele: null,
    frischGemeldet: new Set(),
    suchliste: { [SUCHE]: { titel: 'Es war einmal' }, [ANDERE]: { titel: 'Anderes' } },
    suchErledigt: vermerk === undefined ? {} : { [SUCHE]: vermerk },
    liste: {},
    erledigt: {},
    erwartungZu: () => null,
    briefkastenSeiten: null,
    briefkastenAdressen: null,
    briefkastenSuchen: null,
    briefkastenErwartungen: null,
    speicherSchreiben: async (x) => geschrieben.push(x),
    uebersichtZeichnen: () => {},
    fetch: async (adresse) => {
      if (String(adresse).includes('zaehlen=1')) {
        return { ok: true, json: async () => ({ adressen: [], gemeldet: [], gemeldeteSuchen: zaehlungOhneSuche ? [ANDERE] : [SUCHE, ANDERE], gemeldeteSeiten: ['S1'], erwartungen: { [SUCHE]: ['S1'] } }) }
      }
      return stand.versprechen
    },
  })
  k.globalThis = k
  vm.runInContext(lies('pruefstand-zeit.js'), k)
  k.akGemeldetSeit = async () => {}
  k.akPruefstandAm = new Date(FEST - pruefstandVor * MIN).toISOString()
  k.akPrimeAufraeumen = () => ({ bereinigt: {}, entfernt: 0 })
  vm.runInContext(lies('prime-such-bruecke.js'), k)
  const q = lies('amazon.js')
  const code = [
    schneide(q, 'async function briefkastenHolen('),
    schneide(q, 'function suchErledigtFrisch('),
    schneide(q, 'function vermerkVerwerfen('),
    schneide(q, 'function istGemeldet('),
  ].join('\n')
  vm.runInContext(code, k)
  return {
    k,
    stand,
    geschrieben,
    holen: () => vm.runInContext('briefkastenHolen(true)', k),
    gemeldet: () => vm.runInContext(`istGemeldet(${JSON.stringify(SUCHE)})`, k),
    vermerk: () => vm.runInContext('suchErledigt', k)[SUCHE],
  }
}
const vor = (minuten) => new Date(FEST - minuten * MIN).toISOString()
/** Lässt die Mikroaufgaben laufen, bis `briefkastenHolen` an der Stand-Antwort wartet. */
const warte = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}


/** Spielt einen Seitenaufruf: `briefkastenHolen` läuft, der Stand kommt (`loese`) oder scheitert (`scheitere`). */
async function spiele(optionen, wie) {
  const s = seite(optionen)
  const lauf = s.holen()
  await warte()
  s.stand[wie]()
  await lauf
  return s
}

async function inDerLuecke() {
  const s = seite({ vermerk: vor(3) })
  const lauf = s.holen()
  await warte()
  pruefe('Lücke: der Stand ist noch nicht da', vm.runInContext('standZiele', s.k) === null)
  pruefe('Lücke: die 2-h-Zählung ist noch nicht sichtbar (Mengen kommen gemeinsam)', vm.runInContext('briefkastenSuchen', s.k) === null)
  pruefe('Lücke: auch Seiten und Erwartungen sind noch nicht sichtbar', vm.runInContext('briefkastenSeiten', s.k) === null && vm.runInContext('briefkastenErwartungen', s.k) === null)
  pruefe('Lücke: frisch gemeldete Suche gilt als erledigt', s.gemeldet() === true)
  pruefe('Lücke: der Vermerk bleibt im Speicher', s.vermerk() === vor(3) && s.geschrieben.length === 0, s.vermerk())
  s.stand.loese()
  await lauf
  pruefe('nach dem Stand (führt die Suche noch): Vermerk überbrückt', s.gemeldet() === true)
  pruefe('nach dem Stand: Vermerk weiter da', s.vermerk() === vor(3))
  pruefe('nach dem Stand: Seiten und Erwartungen gesetzt', vm.runInContext('briefkastenSeiten', s.k)?.has('S1') === true && vm.runInContext('briefkastenErwartungen', s.k)?.[SUCHE]?.[0] === 'S1')
}

async function standScheitert() {
  const frisch = await spiele({ vermerk: vor(3) }, 'scheitere')
  pruefe('Stand scheitert, Zählung ohne die Suche, Vermerk frisch: weiter erledigt', frisch.gemeldet() === true)
  pruefe('Stand scheitert: Vermerk bleibt', frisch.vermerk() === vor(3))
  pruefe('Stand scheitert: die Zählung ist trotzdem gesetzt', vm.runInContext('briefkastenSuchen', frisch.k)?.has(ANDERE) === true)
  const alt = await spiele({ vermerk: vor(90) }, 'scheitere')
  pruefe('Vermerk älter als der Prüfstand, Zählung kennt die Suche nicht: offen (Briefkasten gewinnt)', alt.gemeldet() === false)
  pruefe('… und der alte Vermerk wird aufgeräumt', alt.vermerk() === undefined, alt.vermerk())
  const mittel = await spiele({ vermerk: vor(30) }, 'scheitere')
  pruefe('Vermerk 30 Minuten alt, jünger als der Prüfstand, Zählung (2 h alt) kennt die Suche nicht: erledigt', mittel.gemeldet() === true)
  pruefe('… und der Vermerk bleibt im Speicher', mittel.vermerk() === vor(30) && mittel.geschrieben.length === 0)
}

/* 29.10.2026: Der Worker-Stand führt die Suchadresse weiter (er rechnet mit der Titeladresse der Meldung); nach den
   zehn Minuten der Brücke stand die Suche bei der nächsten Meldung wieder in der Liste. */
async function standFuehrtDieSuche() {
  for (const minuten of [11, 30, 59]) {
    const s = await spiele({ vermerk: vor(minuten) }, 'loese')
    pruefe(`Stand führt die Suche, Vermerk ${minuten} Minuten alt (jünger als der Prüfstand): erledigt`, s.gemeldet() === true)
    pruefe(`… Vermerk ${minuten} Minuten: bleibt im Speicher`, s.vermerk() === vor(minuten))
  }
  const alt = await spiele({ vermerk: vor(90) }, 'loese')
  pruefe('Stand führt die Suche, Vermerk älter als der Prüfstand: offen (der Prüfstand hat ihn überholt)', alt.gemeldet() === false)
}

async function ohneVermerkUndMitZaehlung() {
  const s = seite({ vermerk: undefined })
  const lauf = s.holen()
  await warte()
  pruefe('Lücke: ohne Vermerk bleibt die Suche offen', s.gemeldet() === false)
  s.stand.loese()
  await lauf
  const z = await spiele({ vermerk: vor(30), zaehlungOhneSuche: false, standMitSuche: false }, 'loese')
  pruefe('Zählung führt die Suche, Vermerk alt: erledigt, Vermerk bleibt unberührt', z.gemeldet() === true && z.geschrieben.length === 0)
}

async function haupt() {
  console.log('Prime: gemeldete Suche in der Lücke vor dem Stand\n')
  await inDerLuecke()
  await standScheitert()
  await standFuehrtDieSuche()
  await ohneVermerkUndMitZaehlung()
  if (fehler.length) {
    console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nAlle Zusicherungen halten.')
}
haupt()
