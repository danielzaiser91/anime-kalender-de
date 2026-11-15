/**
 * Netflix-Prüfliste: Kopf in zwei Zeilen und Ansicht der zurückgestellten Titel (Daniel, 15.11.2026).
 * Geprüft: Text „nächste Übernahme“ (heute Uhrzeit, sonst Datum davor, 00:30 Berlin), Aufbau des Kopfs (Überschrift oben,
 * Suchfeld ganz links), Umschalter „N zurückgestellt“ und „N gemeldet“, Tabelle (Zellen, „—“ ohne Messung), Sortieren
 * je Spalte in beide Richtungen, Filtern über Suchfeld und Grund-Knöpfe, Klick auf einen Titel, Minutentakt.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')

const fehler = []
const pruefe = (name, bedingung, gefunden) => {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

function element(tag) {
  const klassen = new Set()
  const attribute = new Map()
  const hoerer = new Map()
  return {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    title: '',
    hidden: false,
    isConnected: true,
    value: '',
    dataset: {},
    kinder: [],
    hoerer,
    classList: {
      add: (n) => klassen.add(n),
      contains: (n) => klassen.has(n),
      toggle: (n, an) => (an ? klassen.add(n) : klassen.delete(n)),
    },
    appendChild(k) {
      this.kinder.push(k)
      return k
    },
    replaceChildren(...k) {
      this.kinder = k
    },
    setAttribute: (n, w) => attribute.set(n, String(w)),
    getAttribute: (n) => attribute.get(n) ?? null,
    addEventListener: (art, fn) => hoerer.set(art, fn),
    closest(sel) {
      return sel === 'a' && this.tagName === 'A' ? this : null
    },
  }
}

/* 15.11.2026, 12:00 Berlin (Winterzeit, UTC+1). */
const JETZT = Date.UTC(2026, 10, 15, 11, 0)
const takte = []
const beendet = []
const kontext = {
  globalThis: null,
  document: { createElement: element },
  setInterval: (fn, ms) => takte.push({ fn, ms }),
  clearInterval: (nr) => beendet.push(nr),
}
kontext.globalThis = kontext
vm.createContext(kontext)
vm.runInContext(readFileSync(resolve(__dirname, 'netflix-liste-ansicht.js'), 'utf8'), kontext)
/* Feste Uhr für den Standardwert `jetzt` (ohne Angabe liest der Kopf `Date.now`). */
vm.runInContext(`Date.now = () => ${JETZT}`, kontext)
const ansicht = kontext.akNetflixListeAnsicht

console.log('Netflix-Prüfliste: Kopf und Ansicht der Zurückgestellten')

{
  const t = ansicht.uebernahmeText
  pruefe('Übernahme heute: nur die Uhrzeit', t(Date.UTC(2026, 10, 15, 11, 23), JETZT) === 'nächste Übernahme: 12:23', t(Date.UTC(2026, 10, 15, 11, 23), JETZT))
  const spaet = Date.UTC(2026, 10, 15, 22, 40)
  pruefe('Übernahme nach Mitternacht: Datum davor', t(Date.UTC(2026, 10, 15, 23, 23), spaet) === 'nächste Übernahme: 16.11. 00:23', t(Date.UTC(2026, 10, 15, 23, 23), spaet))
  const nachts = Date.UTC(2026, 10, 15, 23, 30)
  pruefe('00:30 Berlin, Übernahme 01:23: derselbe Berliner Tag (UTC-Tag wechselt)', t(Date.UTC(2026, 10, 16, 0, 23), nachts) === 'nächste Übernahme: 01:23', t(Date.UTC(2026, 10, 16, 0, 23), nachts))
  const sommer = Date.UTC(2026, 6, 15, 10, 0)
  pruefe('Sommerzeit: 12:23 Berlin', t(Date.UTC(2026, 6, 15, 10, 23), sommer) === 'nächste Übernahme: 12:23', t(Date.UTC(2026, 6, 15, 10, 23), sommer))
}

/* Vier Zurückgestellte: anderer Tag, ohne Messung, selber Tag, unlesbarer Ablauf. */
const INFO = {
  70: { grund: 'Erinnern statt Folgenliste', bis: Date.UTC(2026, 10, 19, 23, 0), am: Date.UTC(2026, 10, 14, 17, 0) },
  71: { grund: 'nach 3 Versuchen noch offen', bis: Date.UTC(2026, 10, 16, 9, 0) },
  72: { grund: 'Netflix zeigt ihn nicht (E103)', bis: Date.UTC(2026, 10, 15, 12, 30), am: Date.UTC(2026, 10, 15, 10, 30) },
  73: { grund: 'Netflix zeigt ihn nicht (UI800)', bis: Number.MAX_SAFE_INTEGER, am: Date.UTC(2026, 10, 10, 8, 0) },
}
const EINTRAEGE = [
  ['70', { titel: 'Berserk' }],
  ['71', { titel: 'Ajin' }],
  ['72', { titel: 'Castlevania' }],
  ['73', { titel: 'Dorohedoro' }],
  ['74', { titel: 'Offen und nicht zurückgestellt' }],
  ['75', { titel: '' }],
]
const infoVon = (id) => (id === '75' ? { grund: 'x', bis: 1 } : (INFO[id] ?? null))
const ZEILEN = ansicht.zeilen(EINTRAEGE.slice(0, 5), infoVon)
const titel = (zeilen) => zeilen.map((z) => z.titel).join(',')

{
  pruefe('zeilen: nur Einträge mit Zurückstellung', titel(ZEILEN) === 'Berserk,Ajin,Castlevania,Dorohedoro', titel(ZEILEN))
  pruefe('zeilen: Kennung, Grund, Ablauf und Messung stehen an der Zeile', JSON.stringify(ZEILEN[0]) === JSON.stringify({ id: '70', titel: 'Berserk', ...INFO[70] }), ZEILEN[0])
  pruefe('zeilen: ohne Titel steht die Kennung da', ansicht.zeilen(EINTRAEGE.slice(5), infoVon)[0]?.titel === 'Titel 75')
}

{
  const s = (spalte, ab) => titel(ansicht.sortiert(ZEILEN, spalte, ab))
  pruefe('sortiert: zurück bis aufsteigend, Unlesbares am Ende', s('bis', false) === 'Castlevania,Ajin,Berserk,Dorohedoro', s('bis', false))
  pruefe('sortiert: zurück bis absteigend, Unlesbares bleibt am Ende', s('bis', true) === 'Berserk,Ajin,Castlevania,Dorohedoro', s('bis', true))
  pruefe('sortiert: letzte Messung aufsteigend, ohne Messung am Ende', s('am', false) === 'Dorohedoro,Berserk,Castlevania,Ajin', s('am', false))
  pruefe('sortiert: letzte Messung absteigend, ohne Messung bleibt am Ende', s('am', true) === 'Castlevania,Berserk,Dorohedoro,Ajin', s('am', true))
  pruefe('sortiert: Titel aufsteigend', s('titel', false) === 'Ajin,Berserk,Castlevania,Dorohedoro', s('titel', false))
  pruefe('sortiert: Titel absteigend', s('titel', true) === 'Dorohedoro,Castlevania,Berserk,Ajin', s('titel', true))
  pruefe('sortiert: Grund aufsteigend', s('grund', false) === 'Berserk,Ajin,Castlevania,Dorohedoro', s('grund', false))
  pruefe('sortiert: Grund absteigend', s('grund', true) === 'Dorohedoro,Castlevania,Ajin,Berserk', s('grund', true))
  const gleich = [
    { id: '1', titel: 'Zeta', grund: 'g', bis: 5 },
    { id: '2', titel: 'Alpha', grund: 'g', bis: 5 },
    { id: '3', titel: 'Mitte', grund: 'g' },
    { id: '4', titel: 'Beta', grund: 'g' },
  ]
  pruefe('sortiert: Gleichstand löst der Titel, auch absteigend und unter den Zeilen ohne Zeitpunkt', titel(ansicht.sortiert(gleich, 'bis', true)) === 'Alpha,Zeta,Beta,Mitte', titel(ansicht.sortiert(gleich, 'bis', true)))
  pruefe('sortiert: die Eingabe bleibt unverändert', titel(ZEILEN) === 'Berserk,Ajin,Castlevania,Dorohedoro')
}

{
  const f = (wort, art) => titel(ansicht.gefiltert(ZEILEN, wort, art))
  pruefe('gefiltert: leer zeigt alle', f('', '') === 'Berserk,Ajin,Castlevania,Dorohedoro', f('', ''))
  pruefe('gefiltert: Wort im Titel, Groß/Klein und Leerraum egal', f('  AJ ', '') === 'Ajin', f('  AJ ', ''))
  pruefe('gefiltert: Wort im Grund', f('e103', '') === 'Castlevania', f('e103', ''))
  pruefe('gefiltert: Grund-Art ohne Klammerzusatz', f('', 'Netflix zeigt ihn nicht') === 'Castlevania,Dorohedoro', f('', 'Netflix zeigt ihn nicht'))
  pruefe('gefiltert: Art und Wort zusammen', f('doro', 'Netflix zeigt ihn nicht') === 'Dorohedoro', f('doro', 'Netflix zeigt ihn nicht'))
  pruefe('gefiltert: Art passt, Wort nicht', f('ajin', 'Netflix zeigt ihn nicht') === '', f('ajin', 'Netflix zeigt ihn nicht'))
}

/** Baut den Kopf; `klicke(el)` löst den angemeldeten Klick aus. */
function baue(zusatz = {}) {
  const klicks = new Map()
  const kasten = element('div')
  const selbst = element('button')
  selbst.textContent = '▶ alle durchgehen'
  const gerufen = { zu: 0, geoeffnet: [] }
  const uhr = { jetzt: JETZT }
  const k = ansicht.kopf({
    kasten,
    titel: '135 Titel zu prüfen',
    selbst,
    zurueck: ZEILEN,
    gemeldet: 71,
    uebernahme: (d) => new Date(d.getTime() + 23 * 60000),
    zu: () => gerufen.zu++,
    klick: (el, fn) => klicks.set(el, fn),
    geoeffnet: (id) => gerufen.geoeffnet.push(id),
    jetzt: () => uhr.jetzt,
    ...zusatz,
  })
  return { ...k, kasten, selbst, gerufen, uhr, klicke: (el, ereignis) => klicks.get(el)(ereignis) }
}
const finde = (el, test, treffer = []) => {
  if (test(el)) treffer.push(el)
  for (const kind of el.kinder ?? []) finde(kind, test, treffer)
  return treffer
}
const zeilenTitel = (tabelle) => finde(tabelle, (el) => el.tagName === 'A').map((a) => a.textContent).join(',')
const knopf = (wurzel, text) => finde(wurzel, (el) => el.tagName === 'BUTTON' && el.textContent === text)[0]

{
  const b = baue()
  const [oben, unten] = b.kopf.kinder
  pruefe('Kopf: zwei Zeilen', b.kopf.className === 'ak-kopf ak-kopf-zeilen' && b.kopf.kinder.length === 2 && oben.className === 'ak-kopf-oben' && unten.className === 'ak-kopf-unten')
  pruefe('oben: Überschrift, nächste Übernahme, Schließen — in dieser Reihenfolge', oben.kinder.map((k) => k.tagName + '.' + k.className).join(' ') === 'STRONG. SPAN.ak-lauf BUTTON.ak-zu', oben.kinder.map((k) => k.tagName + '.' + k.className))
  pruefe('oben: Überschrift nennt nur die offenen Titel', oben.kinder[0].textContent === '135 Titel zu prüfen', oben.kinder[0].textContent)
  pruefe('oben: „nächste Übernahme: 12:23“', oben.kinder[1].textContent === 'nächste Übernahme: 12:23', oben.kinder[1].textContent)
  pruefe('unten: Suchfeld ganz links, dann Durchgang, zurückgestellt, gemeldet', unten.kinder[0] === b.suche && b.suche.className === 'ak-suche' && unten.kinder[1] === b.selbst && unten.kinder.slice(2).map((k) => k.textContent).join('|') === '4 zurückgestellt|71 gemeldet', unten.kinder.map((k) => k.textContent))
  b.klicke(oben.kinder[2])
  pruefe('Schließen ruft zu()', b.gerufen.zu === 1, b.gerufen.zu)
  pruefe('Schließen und Suchfeld tragen einen Namen für Vorleseprogramme', oben.kinder[2].getAttribute('aria-label') === 'Schließen' && b.suche.getAttribute('aria-label') === 'Suchen' && b.suche.tagName === 'INPUT' && b.suche.type === 'search', [oben.kinder[2].getAttribute('aria-label'), b.suche.getAttribute('aria-label')])

  const zurueck = knopf(unten, '4 zurückgestellt')
  pruefe('Umschalter zurückgestellt: anfangs aus', zurueck.getAttribute('aria-pressed') === 'false' && !b.kasten.classList.contains('ak-ansicht-zurueck'))
  b.klicke(zurueck)
  pruefe('Klick 1: Ansicht an, Knopf hervorgehoben', zurueck.getAttribute('aria-pressed') === 'true' && b.kasten.classList.contains('ak-ansicht-zurueck'))
  pruefe('… die Liste der Gemeldeten bleibt davon unberührt', !b.kasten.classList.contains('ak-mit-erledigten'))
  b.klicke(zurueck)
  pruefe('Klick 2: Ansicht aus', zurueck.getAttribute('aria-pressed') === 'false' && !b.kasten.classList.contains('ak-ansicht-zurueck'))

  const gemeldet = knopf(unten, '71 gemeldet')
  pruefe('Umschalter gemeldet: gilt nur für die Liste (ak-nur-liste)', gemeldet.classList.contains('ak-nur-liste') && !zurueck.classList.contains('ak-nur-liste'))
  b.klicke(gemeldet)
  pruefe('gemeldet Klick 1: an', gemeldet.getAttribute('aria-pressed') === 'true' && b.kasten.classList.contains('ak-mit-erledigten') && !b.kasten.classList.contains('ak-ansicht-zurueck'))
  b.klicke(gemeldet)
  pruefe('gemeldet Klick 2: aus', gemeldet.getAttribute('aria-pressed') === 'false' && !b.kasten.classList.contains('ak-mit-erledigten'))
}

{
  const b = baue()
  const t = b.tabelle
  const koepfe = finde(t, (el) => el.tagName === 'TH')
  const sortierung = () => koepfe.map((k) => k.getAttribute('aria-sort')).join(',')
  const gestalt = (el) => `${el.tagName}.${el.className}`
  pruefe('Ansicht: Grund-Leiste, Tabelle, „Kein Treffer“', gestalt(t) === 'DIV.ak-zurueck-ansicht' && t.kinder.map(gestalt).join(' ') === 'DIV.ak-zurueck-gruende TABLE.ak-zurueck-tabelle P.ak-zurueck-leer', t.kinder.map(gestalt))
  pruefe('Tabelle: Kopf mit Sortierknöpfen, dann Rumpf', t.kinder[1].kinder.map(gestalt).join(' ') === 'THEAD. TBODY.' && koepfe.every((k) => gestalt(k.kinder[0]) === 'BUTTON.ak-sortierknopf'), t.kinder[1].kinder.map(gestalt))
  pruefe('Zeile: vier Zellen mit ihren Klassen', finde(t, (el) => el.tagName === 'TR')[1].kinder.map(gestalt).join(' ') === 'TD.ak-zurueck-titel TD.ak-zurueck-bis TD.ak-zurueck-am TD.ak-zurueck-grund', finde(t, (el) => el.tagName === 'TR')[1]?.kinder.map(gestalt))
  pruefe('Tabelle: Spalten Titel, zurück bis, letzte Messung, Grund', koepfe.map((k) => k.kinder[0].textContent).join('|') === 'Titel|zurück bis|letzte Messung|Grund', koepfe.map((k) => k.kinder[0].textContent))
  pruefe('Tabelle: anfangs nach „zurück bis“ aufsteigend', zeilenTitel(t) === 'Castlevania,Ajin,Berserk,Dorohedoro' && sortierung() === 'none,ascending,none,none', [zeilenTitel(t), sortierung()])
  const zellen = finde(t, (el) => el.tagName === 'TR' && el.kinder[0]?.tagName === 'TD').map((tr) => tr.kinder.map((td) => td.textContent || td.kinder[0]?.textContent).join('|'))
  pruefe('Zeile selber Tag: Uhrzeiten', zellen[0] === 'Castlevania|13:30|11:30|Netflix zeigt ihn nicht (E103)', zellen[0])
  pruefe('Zeile ohne Messung: „—“', zellen[1] === 'Ajin|16.11.|—|nach 3 Versuchen noch offen', zellen[1])
  pruefe('Zeile anderer Tag: Datum (Mitternacht Berlin zählt zum 20.)', zellen[2] === 'Berserk|20.11.|14.11.|Erinnern statt Folgenliste', zellen[2])
  pruefe('Zeile mit unlesbarem Ablauf: „auf Weiteres“, kein Absturz', zellen[3] === 'Dorohedoro|auf Weiteres|10.11.|Netflix zeigt ihn nicht (UI800)', zellen[3])
  const link = finde(t, (el) => el.tagName === 'A')[0]
  pruefe('Titel verweist auf die Titelseite', link.href === 'https://www.netflix.com/title/72' && link.dataset.id === '72', link.href)
  const messung = finde(t, (el) => el.className === 'ak-zurueck-am')
  pruefe('Tooltip der Messung: Datum und Uhrzeit, ohne Messung ein Satz dazu', messung[2].title === '14.11. 18:00' && messung[1].title === 'Für diesen Titel ist keine Messung gespeichert.', messung.map((m) => m.title))

  b.klicke(koepfe[0].kinder[0])
  pruefe('Klick auf „Titel“: aufsteigend nach Titel', zeilenTitel(t) === 'Ajin,Berserk,Castlevania,Dorohedoro' && sortierung() === 'ascending,none,none,none', [zeilenTitel(t), sortierung()])
  b.klicke(koepfe[0].kinder[0])
  pruefe('zweiter Klick: absteigend', zeilenTitel(t) === 'Dorohedoro,Castlevania,Berserk,Ajin' && sortierung() === 'descending,none,none,none', [zeilenTitel(t), sortierung()])
  b.klicke(koepfe[2].kinder[0])
  pruefe('Wechsel der Spalte beginnt wieder aufsteigend („letzte Messung“)', zeilenTitel(t) === 'Dorohedoro,Berserk,Castlevania,Ajin' && sortierung() === 'none,none,ascending,none', [zeilenTitel(t), sortierung()])
  b.klicke(koepfe[3].kinder[0])
  pruefe('Klick auf „Grund“', zeilenTitel(t) === 'Berserk,Ajin,Castlevania,Dorohedoro' && sortierung() === 'none,none,none,ascending', [zeilenTitel(t), sortierung()])
  b.klicke(koepfe[1].kinder[0])

  const gruende = finde(t, (el) => el.className === 'ak-zurueck-grundknopf')
  pruefe('Grund-Knöpfe: Arten mit Zahl, größte zuerst, Gleichstand nach Name', gruende.map((g) => g.textContent).join('|') === 'Netflix zeigt ihn nicht · 2|Erinnern statt Folgenliste · 1|nach 3 Versuchen noch offen · 1', gruende.map((g) => g.textContent))
  pruefe('Grund-Knöpfe: anfangs keiner gewählt', gruende.every((g) => g.getAttribute('aria-pressed') === 'false'))
  b.klicke(gruende[0])
  pruefe('Grund gewählt: nur diese Titel, Knopf hervorgehoben', zeilenTitel(t) === 'Castlevania,Dorohedoro' && gruende.map((g) => g.getAttribute('aria-pressed')).join(',') === 'true,false,false', zeilenTitel(t))
  b.klicke(gruende[1])
  pruefe('anderer Grund ersetzt den ersten', zeilenTitel(t) === 'Berserk' && gruende.map((g) => g.getAttribute('aria-pressed')).join(',') === 'false,true,false', zeilenTitel(t))
  b.klicke(gruende[1])
  pruefe('derselbe Grund noch einmal: Filter aus', zeilenTitel(t) === 'Castlevania,Ajin,Berserk,Dorohedoro' && gruende.every((g) => g.getAttribute('aria-pressed') === 'false'), zeilenTitel(t))

  const leer = finde(t, (el) => el.className === 'ak-zurueck-leer')[0]
  pruefe('„Kein Treffer“ ist mit Zeilen versteckt', leer.textContent === 'Kein Treffer' && leer.hidden === true)
  b.suche.value = 'e103'
  b.suche.hoerer.get('input')()
  pruefe('Suchfeld filtert die Tabelle (Wort im Grund)', zeilenTitel(t) === 'Castlevania' && leer.hidden === true, zeilenTitel(t))
  b.suche.value = 'gibt es nicht'
  b.suche.hoerer.get('input')()
  pruefe('ohne Treffer: leere Tabelle und „Kein Treffer“', zeilenTitel(t) === '' && leer.hidden === false, zeilenTitel(t))
  b.suche.value = ''
  b.suche.hoerer.get('input')()
  pruefe('Suchfeld geleert: wieder alle', zeilenTitel(t) === 'Castlevania,Ajin,Berserk,Dorohedoro', zeilenTitel(t))

  const rumpf = finde(t, (el) => el.tagName === 'TBODY')[0]
  b.klicke(rumpf, { target: finde(t, (el) => el.tagName === 'A')[2] })
  b.klicke(rumpf, { target: finde(t, (el) => el.className === 'ak-zurueck-grund')[0] })
  pruefe('Klick auf einen Titel meldet seine Kennung, ein Klick daneben nichts', JSON.stringify(b.gerufen.geoeffnet) === '["70"]', b.gerufen.geoeffnet)
}

{
  takte.length = 0
  beendet.length = 0
  const b = baue()
  const lauf = b.kopf.kinder[0].kinder[1]
  pruefe('Minutentakt: genau einer angemeldet, alle 60 Sekunden', takte.length === 1 && takte[0].ms === 60000, takte.map((t) => t.ms))
  b.uhr.jetzt = Date.UTC(2026, 10, 15, 22, 40)
  takte[0].fn()
  pruefe('Takt: die Uhrzeit wandert mit, nach Mitternacht mit Datum', lauf.textContent === 'nächste Übernahme: 16.11. 00:03', lauf.textContent)
  pruefe('Takt: solange der Dialog steht, läuft er weiter', beendet.length === 0, beendet)
  lauf.isConnected = false
  b.uhr.jetzt = JETZT
  takte[0].fn()
  pruefe('Takt: Dialog zu — Takt beendet, Text bleibt', beendet.length === 1 && lauf.textContent === 'nächste Übernahme: 16.11. 00:03', [beendet, lauf.textContent])
}

{
  const ohne = baue({ zurueck: [], gemeldet: 0 })
  const [oben, unten] = ohne.kopf.kinder
  pruefe('nichts zurückgestellt, nichts gemeldet: nur Suchfeld und Durchgang', unten.kinder.length === 2 && unten.kinder[0] === ohne.suche && unten.kinder[1] === ohne.selbst, unten.kinder.map((k) => k.textContent))
  pruefe('… keine Tabelle, kein Filter am Suchfeld', ohne.tabelle === null && !ohne.suche.hoerer.has('input'))
  pruefe('… keine „nächste Übernahme“ ohne Gemeldetes', oben.kinder.map((k) => k.tagName).join(' ') === 'STRONG BUTTON', oben.kinder.map((k) => k.tagName))

  const eins = baue({ zurueck: ZEILEN.slice(0, 1), gemeldet: 1 })
  pruefe('genau 1 und 1: „1 zurückgestellt“ und „1 gemeldet“', eins.kopf.kinder[1].kinder.slice(2).map((k) => k.textContent).join('|') === '1 zurückgestellt|1 gemeldet', eins.kopf.kinder[1].kinder.map((k) => k.textContent))
  pruefe('genau 1 gemeldet: „nächste Übernahme“ steht da', eins.kopf.kinder[0].kinder[1]?.className === 'ak-lauf')
  pruefe('eine einzige Grund-Art: keine Grund-Knöpfe', finde(eins.tabelle, (el) => el.className === 'ak-zurueck-grundknopf').length === 0)

  const zwei = baue({ zurueck: ZEILEN.slice(0, 2) })
  pruefe('genau zwei Grund-Arten: zwei Knöpfe', finde(zwei.tabelle, (el) => el.className === 'ak-zurueck-grundknopf').map((g) => g.textContent).join('|') === 'Erinnern statt Folgenliste · 1|nach 3 Versuchen noch offen · 1')

  /* Eingabe gegen das Alphabet: die Reihenfolge der Knöpfe kommt aus der Sortierung, nicht aus der Eingabe. */
  const viele = ['d', 'c', 'b', 'a', 'e'].map((g, i) => ({ id: String(i), titel: `T${i}`, grund: g, bis: JETZT + i }))
  viele.push({ id: '9', titel: 'T9', grund: 'e', bis: JETZT })
  const voll = baue({ zurueck: viele })
  const knoepfe = finde(voll.tabelle, (el) => el.className === 'ak-zurueck-grundknopf').map((g) => g.textContent)
  pruefe('fünf Grund-Arten: nur die vier häufigsten', knoepfe.join('|') === 'e · 2|a · 1|b · 1|c · 1', knoepfe)

  const standard = baue({ jetzt: undefined })
  pruefe('ohne `jetzt` gilt die Uhr des Browsers', standard.kopf.kinder[0].kinder[1].textContent === 'nächste Übernahme: 12:23', standard.kopf.kinder[0].kinder[1].textContent)
}

console.log(fehler.length ? `\n✗ ${fehler.length} Fehler` : '\n✓ netflix-liste-ansicht: alle Zusicherungen halten')
process.exit(fehler.length ? 1 : 0)
