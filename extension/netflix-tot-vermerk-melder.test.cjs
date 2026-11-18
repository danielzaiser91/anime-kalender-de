/**
 * Netflix-Prüfliste mit der echten `melder.js` im Sandkasten: Tot-Vermerk gegen Worker-Stand (17.11.2026, PR 4155).
 *
 * Geprüft wird am Aufruf, nicht an der Funktion allein: Tooltip des Knopfes (`uebersichtZeigen`), Meldeknopf
 * (`beschriftung`), „nichts da“ in der Liste (`dialogOeffnen`), Start des Durchgangs (`laufStarten`), Fenster zwischen
 * Stand und Übernahme (`akNetflixWartet`) und der Diagnosebericht (`nfBericht`).
 * Titel 1 trägt den alten Tot-Vermerk, Titel 2 ist offen, Titel 3 steht (je nach Fall) nicht im Stand.
 */
const vm = require('node:vm')
const { ladeSkripte, skripteBis } = require('./test-lader.cjs')
const { baueUmgebung, suche, alleElemente } = require('./test-melder-sandkasten.cjs')

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — ${JSON.stringify(gefunden)}`)
}
const tick = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r))
}
/** Netflix-Kennung des n-ten Probetitels. */
const K = (n) => String(80000000 + n)
const url = (id) => `https://www.netflix.com/title/${id}`
const titel = (name, offen = true) => ({ titel: name, staffeln: [{ nr: 1, folgen: 1, film: false, offen }] })
const LISTE = { [K(1)]: titel('Eins'), [K(2)]: titel('Zwei'), [K(3)]: titel('Drei') }
const TOT = { [K(1)]: ['tot'] }
const ZIELE = [K(1), K(2), K(3)]

/**
 * Eine Seite mit der echten Skriptreihe aus `manifest.json`; `stand`: Kennungen, die der Worker offen führt (`null` = kein Stand),
 * `haengt`: die Übernahme (`?gemeldet=`) antwortet erst nach `freigeben()`.
 */
async function szene({ pfad = '/title/99999999', start = {}, liste = LISTE, stand = null, haengt = false }) {
  const { umgebung, body } = baueUmgebung(pfad, '', start)
  umgebung.AbortController = AbortController
  /* Eine Wartezeit gibt der Ereignisschleife den Zug zurück (die Vorgabe des Sandkastens ruft sofort auf und lässt einen laufenden Durchgang die Schleife blockieren). */
  umgebung.setTimeout = (fn) => { if (typeof fn === 'function') setImmediate(fn); return 0 }
  umgebung.history = { pushState() {}, replaceState() {} }
  umgebung.PopStateEvent = class { constructor(t) { this.type = t } }
  const kontext = vm.createContext(umgebung)
  ladeSkripte(kontext, skripteBis('melder.js').slice(0, -1))
  umgebung.AK_OFFENE_TITEL = liste
  ladeSkripte(kontext, ['melder.js', 'netflix-bericht.js'])
  let freigeben
  const frei = new Promise((r) => { freigeben = r })
  const posts = []
  umgebung.fetch = async (adresse, init) => {
    const a = String(adresse)
    if (init?.method === 'POST') posts.push(JSON.parse(init.body))
    if (a.includes('stand=1')) {
      const ziele = (stand ?? []).map((id) => ({ url: url(id) }))
      return { ok: true, json: async () => ({ anbieter: stand ? [{ plattform: 'netflix', offen: ziele.length, ziele }] : [] }) }
    }
    if (a.includes('gemeldet')) {
      if (haengt) await frei
      return { ok: true, json: async () => ({ paare: [] }) }
    }
    return { ok: true, json: async () => ({}), text: async () => '' }
  }
  await tick()
  await vm.runInContext('standHolen()', kontext)
  await tick()
  const im = (code) => vm.runInContext(code, kontext)
  return { body, im, posts, freigeben: async () => { freigeben(); await tick() }, tooltip: () => suche(body, 'ak-uebersicht')?.title }
}
const totKnoepfe = (s) => alleElemente(s.body).filter((el) => String(el.className).split(/\s+/).includes('ak-tot'))

async function tooltipFaelle() {
  console.log('Tooltip: Staffelzählung nach fertig() (Aufruf in uebersichtZeigen)')
  {
    /* Titel 2 hat beim Anbieter 3 Folgen (Kürzel 1e01 und 1e03), 1e01 ist lokal abgehakt; Titel 1 und 3 tragen den Tot-Vermerk. */
    const start = { erledigt: { [K(1)]: ['tot'], [K(2)]: ['1e01'], [K(3)]: ['tot'] }, anbieterStaffeln: { [K(2)]: [{ seq: 1, folgen: 3 }] } }
    const s = await szene({ start, stand: [K(1), K(2)] })
    pruefe('mit Stand: Titel 1 zählt trotz Vermerk, 2 mit einer Folge, 3 ist fertig (2 von 4)', /^2 von 4 Staffeln zu prüfen/.test(s.tooltip()), s.tooltip())
  }
  {
    const s = await szene({ start: { erledigt: { [K(1)]: ['tot'], [K(3)]: ['tot'] } }, stand: null })
    pruefe('ohne Stand: der Tot-Vermerk nimmt 1 und 3 heraus (1 von 3)', /^1 von 3 Staffeln zu prüfen/.test(s.tooltip()), s.tooltip())
  }
}

async function wartenFaelle() {
  console.log('\nFenster zwischen Stand und Übernahme (akNetflixWartet)')
  {
    const s = await szene({ start: { erledigt: TOT }, stand: ZIELE, haengt: true })
    pruefe('Stand da, Übernahme offen: Tot-Vermerk gilt als Rückfall, Titel 1 nicht gezählt (2 von 3)', /^2 von 3 Staffeln zu prüfen/.test(s.tooltip()), s.tooltip())
    pruefe('… und die Wahl legt Titel 1 nicht vor', s.im('naechsterAuftrag()') === K(2), s.im('naechsterAuftrag()'))
    await s.freigeben()
    pruefe('Übernahme fertig, Briefkasten ohne Meldung: der Stand führt Titel 1 offen (3 Staffeln)', /^3 Staffeln zu prüfen/.test(s.tooltip()), s.tooltip())
    pruefe('… und die Wahl legt Titel 1 wieder vor', s.im('naechsterAuftrag()') === K(1), s.im('naechsterAuftrag()'))
  }
}

async function knoepfeFaelle() {
  console.log('\nKnöpfe lesen den Tot-Vermerk wie die Zählung')
  {
    const s = await szene({ pfad: `/title/${K(1)}`, start: { erledigt: TOT }, stand: [K(1), K(2)] })
    s.im(`stand.reihe = '${K(1)}'`)
    s.body.innerText = 'Erinnern Ab 19. November'
    const b = s.im('beschriftung()')
    pruefe('Meldeknopf mit Termin, Stand führt den Titel offen: aktiv, bietet „ab <Termin>“ an', b.aktiv === true && b.text === 'Noch nicht da — „ab 19. November" melden', b)
    s.body.innerText = 'Erinnern'
    const ohne = s.im('beschriftung()')
    pruefe('Meldeknopf ohne Termin: „angekündigt“, kein Knopf, nie „nicht abrufbar“', ohne.aktiv === false && ohne.text === 'Angekündigt — Netflix nennt keinen Termin' && !/nicht abrufbar/.test(ohne.text), ohne)
    const k0 = s.posts.length
    await s.im('melden()')
    pruefe('Klick ohne Termin meldet nichts (kein POST an den Worker)', s.posts.length === k0, s.posts)
    await s.im('dialogOeffnen()')
    const k = totKnoepfe(s)
    pruefe('Liste, Stand führt den Titel offen: alle drei „nichts da?“ sind aktiv (Titel 3 steht nicht im Stand, trägt aber keinen Vermerk)', k.length === 3 && k.every((x) => x.disabled === false && x.textContent === 'nichts da?'), k.map((x) => [x.disabled, x.textContent]))
  }
  {
    const s = await szene({ pfad: `/title/${K(2)}`, stand: [K(1), K(2)] })
    s.im(`stand.reihe = '${K(2)}'`)
    s.body.innerText = 'Erinnern Ab 19. November'
    await s.im('melden()')
    pruefe('Klick mit Termin meldet den Termin (ein POST, erscheint + Notiz)', s.posts.length === 1 && s.posts[0].erscheint === '19. November' && /19\. November/.test(s.posts[0].notiz), s.posts)
  }
  {
    const s = await szene({ pfad: `/title/${K(1)}`, start: { erledigt: TOT }, stand: null })
    s.im(`stand.reihe = '${K(1)}'`)
    s.body.innerText = 'Erinnern'
    const b = s.im('beschriftung()')
    pruefe('Meldeknopf ohne Stand: der Vermerk sperrt (Rückfall)', b.aktiv === false && /nicht abrufbar gemeldet ✓/.test(b.text), b)
    await s.im('dialogOeffnen()')
    const k = totKnoepfe(s)
    const gesperrt = k.filter((x) => x.disabled === true && x.textContent === 'nichts da ✓')
    pruefe('Liste ohne Stand: genau ein „nichts da ✓“ ist gesperrt, die anderen beiden nicht', k.length === 3 && gesperrt.length === 1, k.map((x) => [x.disabled, x.textContent]))
  }
}

async function startFaelle() {
  console.log('\nStart des Durchgangs: Laufzustand des vorigen Laufs sperrt die Vorabprüfung nicht')
  {
    const s = await szene({ stand: null })
    for (const id of ZIELE) s.im(`akNetflixNichtDa().set('${id}', 'nicht bei Netflix')`)
    pruefe('Ausgangslage: die Wahl findet wegen der alten nichtDa-Urteile nichts', s.im('naechsterAuftrag()') === null, s.im('naechsterAuftrag()'))
    pruefe('Ausgangslage: der Knopf zählt die Titel trotzdem', /3/.test(String(suche(s.body, 'ak-uebersicht')?.textContent)), suche(s.body, 'ak-uebersicht')?.textContent)
    const gestartet = s.im('laufStarten()')
    s.im("laufBeenden('Test')")
    pruefe('laufStarten() startet (kein „kein Auftrag“ trotz Zahl am Knopf)', gestartet === true, gestartet)
  }
  {
    const s = await szene({ stand: null })
    for (const id of ZIELE) s.im(`selbstUebersprungen.set('${id}', 'Folgenliste leer')`)
    pruefe('Ausgangslage: übersprungene Titel des vorigen Laufs, die Wahl findet nichts', s.im('naechsterAuftrag()') === null, s.im('naechsterAuftrag()'))
    const gestartet = s.im('laufStarten()')
    s.im("laufBeenden('Test')")
    pruefe('laufStarten() verwirft sie und startet', gestartet === true)
  }
  {
    const s = await szene({ stand: null, liste: { [K(1)]: titel('Eins') } })
    s.im(`bremse.stoerung('${K(1)}', 'Störung', 1)`)
    pruefe('Ausgangslage: Titel der Bremse, die Wahl findet nichts', s.im('naechsterAuftrag()') === null, s.im('naechsterAuftrag()'))
    const gestartet = s.im('laufStarten()')
    s.im("laufBeenden('Test')")
    pruefe('laufStarten() setzt die Bremse zurück und startet', gestartet === true)
  }
}

async function berichtFaelle() {
  console.log('\nDiagnosebericht: Verdrahtung von ausgelassen()')
  {
    const liste = { ...LISTE, [K(4)]: titel('Vier'), [K(5)]: titel('Fünf'), [K(6)]: titel('Sechs', false), [K(7)]: titel('Sieben') }
    const s = await szene({ pfad: `/title/${K(1)}`, start: { erledigt: TOT }, liste, stand: [...ZIELE, K(4), K(5), K(6), K(7)] })
    s.im(`akNetflixNichtDa().set('${K(3)}', 'nicht bei Netflix')`)
    s.im(`selbstUebersprungen.set('${K(2)}', 'Folgenliste leer')`)
    s.im(`bremse.stoerung('${K(7)}', 'Störung', 1)`)
    const r = s.im('nfBericht()').durchgang.ausgelassen
    pruefe('hier: Titel 1 ist „aktuell“ (gemeinteReihe)', r?.gruende?.aktuell === 1, r)
    pruefe('uebersprungen: Titel 2 ist „zurueckgestellt“', r?.gruende?.zurueckgestellt === 1, r)
    pruefe('nichtDa: Titel 3 ist „nichtDaImLauf“', r?.gruende?.nichtDaImLauf === 1, r)
    pruefe('bremse: Titel 7 ist „bremse“', r?.gruende?.bremse === 1, r)
    pruefe('erledigt: der Vermerk von Titel 1 zählt (tot 1, totUndOffen 1)', r?.tot === 1 && r?.totUndOffen === 1, r)
    pruefe('Titel 4 und 5 werden vorgelegt, Titel 6 (keine offene Staffel) steht dort', r?.gruende?.wirdVorgelegt === 2 && r?.gruende?.ohneOffeneStaffel === 1, r)
  }
}

async function lauf() {
  await tooltipFaelle()
  await wartenFaelle()
  await knoepfeFaelle()
  await startFaelle()
  await berichtFaelle()
  const fehlt = faelle.filter((ok) => !ok).length
  console.log(`netflix-tot-vermerk-melder.test.cjs — ${faelle.length} Zusicherungen`)
  process.exit(fehlt ? 1 : 0)
}
lauf()
