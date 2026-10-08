/**
 * Findet der Leser die richtigen Folgen — und nur die?
 *
 * Bei Netflix hat genau diese Stelle 42 Falschmeldungen gekostet: Die Suche nahm
 * jeden Knoten mit Nummer und Kennung, und die haben auch die Empfehlungsleisten
 * fremder Serien. Hier steht derselbe Riegel vor demselben Fehler, geprüft an
 * einem echten Abruf (Jujutsu Kaisen, 26.08.2026).
 */
const { readFileSync } = require('node:fs')
const quelle = readFileSync(__dirname + '/disney-leser.js', 'utf8')
const probe = JSON.parse(readFileSync(__dirname + '/disney-probe.json', 'utf8'))

/*
  Die Sammelfunktionen aus der Quelle holen statt sie nachzubauen.

  `sammle` stuetzt sich auf `merkeFolge` und die Staffelliste; beide gehoeren
  mit in den Sandkasten. Der erste Anlauf nahm nur `sammle` und starb an
  "merkeFolge is not defined" — ein Test, der die Quelle nur zur Haelfte laedt,
  prueft eine Funktion, die es so nicht gibt.
*/
const holeFunktion = (name) => {
  const von = quelle.indexOf('  function ' + name + '(')
  if (von < 0) { console.error(name + '() nicht gefunden'); process.exit(1) }
  return quelle.slice(von, quelle.indexOf('\n  }\n', von) + 4).replace(/^ {2}/gm, '')
}
const folgen = new Map()
let staffeln = []
eval(
  holeFunktion('merkeFolge') +
    '\n' +
    holeFunktion('sammleFolgen') +
    '\n' +
    holeFunktion('sammleStaffeln'),
)

const faelle = []
const warten = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

sammleFolgen(probe)
const liste = [...folgen.values()].sort((a, b) => a.nummer - b.nummer)

pruefe('alle neun Folgen des Abrufs gefunden', liste.length === 9, liste.length)
pruefe('jede trägt eine Kennung', liste.every((f) => typeof f.playbackId === 'string' && f.playbackId.length > 20))
pruefe('jede trägt eine Folgennummer über null', liste.every((f) => f.nummer > 0))
pruefe('die Staffel steht dabei', liste.every((f) => f.staffel === 1), [...new Set(liste.map((f) => f.staffel))])
pruefe('die Nummern sind lückenlos', liste.every((f, i) => f.nummer === liste[0].nummer + i), liste.map((f) => f.nummer))

/**
 * Der Netflix-Fall, nachgestellt: Eine Empfehlungsleiste einer fremden Serie
 * neben der Folgenliste. Sie trägt Kennungen, aber keine `episodeNumber` —
 * daran, und nur daran, wird sie erkannt.
 */
folgen.clear()
sammleFolgen({
  data: {
    season: { items: probe.data.season.items.slice(0, 2) },
    empfehlungen: [
      { actions: [{ resourceId: 'FREMDE-KENNUNG-AAAAAAAAAAAAAAAAAAAA' }], visuals: { title: 'Lucifer' } },
      { actions: [{ resourceId: 'FREMDE-KENNUNG-BBBBBBBBBBBBBBBBBBBB' }], visuals: { seasonNumber: '3' } },
    ],
  },
})
pruefe('eine Empfehlungsleiste ohne Folgennummer fällt raus', folgen.size === 2, folgen.size)

/* Und was gar keine Nummer hat, wird nicht zu Folge null. */
folgen.clear()
sammleFolgen({ items: [{ actions: [{ resourceId: 'X'.repeat(30) }], visuals: { episodeNumber: '0' } }] })
pruefe('Folge 0 zählt nicht', folgen.size === 0, folgen.size)

folgen.clear()
sammleFolgen({ items: [{ visuals: { episodeNumber: '4' } }] })
pruefe('ohne Kennung keine Folge', folgen.size === 0, folgen.size)

/* Zweimal derselbe Abruf verdoppelt nichts — die Kennung ist der Schlüssel. */
folgen.clear()
sammleFolgen(probe)
const einmal = folgen.size
sammleFolgen(probe)
pruefe('ein zweiter Abruf derselben Staffel verdoppelt nichts', folgen.size === einmal, folgen.size)

/**
 * Lesen Erzeuger und Erweiterung dieselbe Kennung aus einer Adresse?
 *
 * Die Regel steht zweimal — in `tools/extension-offene-disney.mjs`, das die
 * Liste baut, und in `disney.js`, das darin nachschlägt. Zwei Fassungen
 * derselben Regel laufen auseinander (real passiert mit der Footer-Regel), und
 * dann findet die Erweiterung eine Seite nicht mehr, die auf der Liste steht.
 * Hier stehen sie gegeneinander.
 */
{
  /* Je Quelle ihr eigenes Ende: in disney.js steht die Funktion eingerueckt. */
  const holen = (quelle, name, einrueckung = '') => {
    const von = quelle.indexOf(name)
    if (von < 0) throw new Error('nicht gefunden: ' + name)
    const ende = quelle.indexOf('\n' + einrueckung + '}\n', von)
    if (ende < 0) throw new Error('kein Ende gefunden: ' + name)
    return quelle.slice(von, ende + einrueckung.length + 3).replace(new RegExp('^' + einrueckung, 'gm'), '')
  }
  let kennungExt, kennungTool
  eval(
    holen(readFileSync(__dirname + '/disney.js', 'utf8'), 'function kennung(url)', '  ')
      .replace('function kennung', 'kennungExt = function'),
  )
  eval(
    holen(readFileSync(__dirname + '/../tools/extension-offene-disney.mjs', 'utf8'), 'export function kennung(url)')
      .replace('export function kennung', 'kennungTool = function'),
  )

  const proben = [
    ['https://www.disneyplus.com/de-de/browse/entity-8019edc8-5f73-4c70-88eb-02ea35f724d4', '8019edc8-5f73-4c70-88eb-02ea35f724d4'],
    ['https://www.disneyplus.com/browse/entity-3dd9925f-0eb8-46f4-93d0-30ba887fc8d3', '3dd9925f-0eb8-46f4-93d0-30ba887fc8d3'],
    ['https://www.disneyplus.com/de-de/series/medalist/4LgC0zEd5JEx', '4LgC0zEd5JEx'],
    ['https://www.disneyplus.com/de-de/home', null],
  ]
  for (const [url, erwartet] of proben) {
    const a = kennungExt(url)
    const b = kennungTool(url)
    pruefe(`beide lesen ${erwartet ?? 'nichts'} aus der Adresse`, a === erwartet && b === erwartet, {
      erweiterung: a,
      werkzeug: b,
    })
  }

  /* Und die erzeugte Liste passt zu dem, was die Erweiterung sucht. */
  const liste = JSON.parse(
    readFileSync(__dirname + '/offene-disney.js', 'utf8').replace('globalThis.AK_OFFENE_DISNEY = ', ''),
  )
  const schluessel = Object.keys(liste)
  /*
    **Leer ist der Normalfall am Ende, kein Fehler.**

    „die Liste hat Einträge" wurde am 01.09.2026 rot, als Daniel den letzten
    Disney-Auftrag gemeldet hatte — dieselbe Falle wie am 25.08. bei den
    Prime-Zusicherungen und am selben Tag bei `liste.test.cjs` (CLAUDE.md,
    „Eine Prüfung, die rot wird, weil die Arbeit erledigt ist, misst das
    Falsche"). Zugesichert wird deshalb die **Form** der Einträge, nicht ihre
    Zahl: Was drinsteht, muss stimmen; dass etwas drinsteht, ist Datenstand.
  */
  pruefe(`die Liste lädt (${schluessel.length} Einträge)`, liste && typeof liste === 'object')
  pruefe(
    'jeder Schlüssel wird aus seiner eigenen Adresse wiedergefunden',
    schluessel.every((k) => kennungExt(liste[k].url) === k),
    schluessel.filter((k) => kennungExt(liste[k].url) !== k).slice(0, 3),
  )
  /*
    Beantwortete Seiten stehen mit lauter `offen: false` drin (08.10.2026): Auf der Seite von
    Naruto Shippuden entstand sonst gar kein Melder, und eine Berichtigung war unmöglich. Prüfliste
    und Durchgang zählen nur Einträge mit offener Staffel (`offeneEintraege`).
  */
  pruefe(
    'jeder Eintrag hat Staffeln mit einem Wahrheitswert für „offen"',
    schluessel.every((k) => liste[k].staffeln.length > 0 && liste[k].staffeln.every((st) => typeof st.offen === 'boolean')),
  )
  {
    const roh = JSON.parse(readFileSync(__dirname + '/../public/data/titles.json', 'utf8'))
    const alle = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
    const adressen = new Set(
      alle.flatMap((t) => (t.streams ?? []).filter((s) => s.platform === 'disneyplus').map((s) => kennungExt(s.url)).filter(Boolean)),
    )
    const fehlend = [...adressen].filter((k) => !liste[k])
    pruefe(`jede Disney+-Adresse des Bestands steht in der Liste (${adressen.size})`, adressen.size > 0 && !fehlend.length, fehlend.slice(0, 3))
  }
  /* Naruto Shippuden: eine Adresse, drei Disney-Staffeln (53/59/54), im Bestand beantwortet. */
  {
    const naruto = Object.values(liste).find((e) => e.titel === 'Naruto Shippuden')
    pruefe('Naruto Shippuden steht in der Liste, ohne offene Staffel', naruto && naruto.staffeln.every((st) => st.offen === false), naruto)
    const staffelnQuelle = readFileSync(__dirname + '/disney-staffeln.js', 'utf8')
    const ktx = { globalThis: {} }
    ktx.globalThis = ktx
    require('node:vm').runInNewContext(staffelnQuelle, ktx)
    const seite = [53, 59, 54].map((gesamt, i) => ({ name: `Staffel ${i + 1}`, gesamt }))
    const ids = [1, 2, 3].map((nr) => ktx.AK_DISNEY_STAFFELN.titelIdFuer(naruto?.staffeln ?? [], nr, seite))
    pruefe('Die drei Disney-Staffeln ordnen nichts falsch zu (Kennung oder leer)', ids.every((x) => x === null || x === naruto.staffeln[0].id), ids)
    pruefe('Die Seite findet ihren Eintrag (Melder erscheint)', liste[kennungExt('https://www.disneyplus.com/de-de/browse/entity-ef04e263-4751-486c-9001-616f2adf09ba')] === naruto)
  }

  /* „Gemeldet" hält einen übernommenen Titel erledigt: Worker-Feld `gemeldet` neben dem Briefkasten. */
  {
    const q = readFileSync(__dirname + '/disney.js', 'utf8')
    const schnitt = (anfang) => {
      const von = q.indexOf(anfang)
      return q.slice(von, q.indexOf('\n  }\n', von) + 5)
    }
    const antwort = { gemeldet: ['https://x/übernommen'], adressen: ['https://x/im-briefkasten'], eintraege: [] }
    const kontext = {
      briefkasten: new Map(),
      gemeldeteAdressen: new Set(),
      erneutBeantwortet: new Set(),
      wartetAufUebernahme: new Set(),
      offeneEintraege: () => [],
      globalThis: { AK_DISNEY_NETZ: { frischGemeldet: async () => new Set() } },
      liste: {},
      WORKER: 'w',
      fetch: async () => ({ ok: true, json: async () => antwort }),
      gemeldeteHolen: async () => new Set(),
    }
    require('node:vm').runInNewContext(
      schnitt('function istErledigt(') + schnitt('async function briefkastenHolen(') + '\nthis.a = istErledigt; this.b = briefkastenHolen; this.s = () => ({ g: gemeldeteAdressen })',
      kontext,
    )
    pruefe('vor dem Abruf ist nichts erledigt', kontext.a({ url: 'https://x/übernommen' }) === false)
    warten.push(kontext.b().then(() => {
      pruefe('Briefkasten-Adresse gilt als erledigt', kontext.a({ url: 'https://x/im-briefkasten' }) === true)
      pruefe('Übernommene Adresse (nur in `gemeldet`) bleibt erledigt', kontext.a({ url: 'https://x/übernommen' }) === true)
      pruefe('Unbekannte Adresse bleibt offen', kontext.a({ url: 'https://x/neu' }) === false)
      pruefe('Wiedervorlage zählt nur mit neuer Meldung', kontext.a({ url: 'https://x/übernommen', seit: 'x' }) === false)
    }))
  }

  /*
    Frisch gemeldet (08.10.2026): Die Liste `?zaehlen=1` ist bis zu 30 Minuten alt; die Anzeige
    fragt je offene Adresse `?gemeldet=` und führt sie als „wartet auf Übernahme", nicht als offen.
  */
  {
    const q = readFileSync(__dirname + '/disney.js', 'utf8')
    const schnitt = (anfang) => {
      const von = q.indexOf(anfang)
      return q.slice(von, q.indexOf('\n  }\n', von) + 5)
    }
    const eintrag = (url, extra = {}) => ({ titel: url, url, staffeln: [{ offen: true }], ...extra })
    let anfragen = []
    const kontext = {
      briefkasten: new Map(),
      gemeldeteAdressen: new Set(),
      erneutBeantwortet: new Set(),
      wartetAufUebernahme: new Set(),
      liste: { a: eintrag('https://x/frisch'), b: eintrag('https://x/leer'), c: eintrag('https://x/netz') },
      WORKER: 'w',
      fetch: async () => ({ ok: true, json: async () => ({ gemeldet: [], adressen: [], eintraege: [] }) }),
      gemeldeteHolen: async (u) => {
        anfragen.push(u)
        if (u.endsWith('/netz')) return new Set() // Netzfehler: gemeldeteHolen antwortet leer
        return u.endsWith('/frisch') ? new Set(['1:1', '1:2']) : new Set()
      },
      setTimeout,
      Date,
      Set,
      Map,
      Promise,
    }
    kontext.globalThis = kontext
    const vm = require('node:vm')
    vm.runInNewContext(readFileSync(__dirname + '/disney-netz.js', 'utf8'), kontext)
    vm.runInNewContext(
      schnitt('function istErledigt(') +
        schnitt('function offeneEintraege(') +
        schnitt('async function briefkastenHolen(') +
        '\nthis.a = istErledigt; this.b = briefkastenHolen; this.o = offeneEintraege',
      kontext,
    )
    warten.push(kontext.b().then(async () => {
      const offen = kontext.o().filter((e) => !kontext.a(e))
      pruefe('Frisch gemeldeter Titel (nicht in der Liste) zählt nicht mehr als offen', kontext.a(kontext.liste.a) === true && !offen.some((e) => e.url.endsWith('/frisch')), offen.map((e) => e.url))
      pruefe('Ungemeldeter Titel bleibt offen', offen.some((e) => e.url.endsWith('/leer')))
      pruefe('Zähler „N offen" ohne den frisch gemeldeten', offen.length === 2, offen.length)
      anfragen = []
      await kontext.b()
      pruefe('Zweiter Abruf fragt Gemeldetes nicht erneut und Offenes nicht sofort wieder', anfragen.length === 0, anfragen)
    }))
  }

  /* Senden mit Wiederholung: „Failed to fetch" ist ein weiterer Versuch wert, ein 400 nicht. */
  {
    const kontext = { setTimeout, Promise, String }
    kontext.globalThis = kontext
    require('node:vm').runInNewContext(readFileSync(__dirname + '/disney-netz.js', 'utf8'), kontext)
    const netz = kontext.AK_DISNEY_NETZ
    const warte = async () => {}
    const skript = (antworten) => {
      const aufrufe = []
      const holen = async (url, init) => {
        aufrufe.push(init)
        const a = antworten[Math.min(aufrufe.length - 1, antworten.length - 1)]
        if (a === 'netz') throw new TypeError('Failed to fetch')
        return { ok: a === 200, status: a }
      }
      return { aufrufe, holen }
    }
    warten.push((async () => {
      let s = skript(['netz', 'netz', 200])
      let r = await netz.sende('u', { method: 'POST', body: '{}' }, { holen: s.holen, warte })
      pruefe('Sendefehler wird wiederholt und kommt an', r.ok === true && s.aufrufe.length === 3, [r, s.aufrufe.length])
      pruefe('Anfrage trägt keepalive (überlebt einen Seitenwechsel)', s.aufrufe.every((i) => i.keepalive === true))
      s = skript([429, 200])
      r = await netz.sende('u', { method: 'POST', body: '{}' }, { holen: s.holen, warte })
      pruefe('429 wird wiederholt', r.ok === true && s.aufrufe.length === 2, [r, s.aufrufe.length])
      s = skript([400])
      r = await netz.sende('u', { method: 'POST', body: '{}' }, { holen: s.holen, warte })
      pruefe('400 ist endgültig, kein zweiter Versuch', r.ok === false && s.aufrufe.length === 1 && r.fehler === 'HTTP 400', [r, s.aufrufe.length])
      s = skript(['netz'])
      r = await netz.sende('u', { method: 'POST', body: '{}' }, { holen: s.holen, warte })
      pruefe('Bleibt es beim Fehler, wird er benannt statt verschluckt', r.ok === false && /Failed to fetch/.test(r.fehler) && s.aufrufe.length === 3, r)
      let gleichzeitig = 0
      let hoechstens = 0
      await netz.inBahnen(Array.from({ length: 9 }, (_, i) => i), async () => {
        hoechstens = Math.max(hoechstens, ++gleichzeitig)
        await new Promise((f) => setTimeout(f, 2))
        gleichzeitig--
      }, null, 3)
      pruefe('Höchstens drei Sendungen gleichzeitig', hoechstens === 3, hoechstens)
    })())
  }

  /* Nach einem Sendefehler fragt `melden` die Ferne, bevor es „kamen nicht an" zeigt (Naruto Shippuden 166/166 da, 14 „Failed to fetch"). */
  {
    const q = readFileSync(__dirname + '/disney.js', 'utf8')
    const m = q.slice(q.indexOf('async function melden('))
    const pruefung = m.indexOf('await gemeldeteHolen(')
    pruefe(
      'Fehlgeschlagene Folgen werden vor der Anzeige gegen ?gemeldet= geprüft',
      pruefung > 0 && pruefung < m.indexOf('kamen nicht an'),
    )
  }

  /* Ein Titel, der beim Besuch schon gemeldet war, steht am Ende als „schon gemeldet", nicht als übersprungen. */
  {
    const ktx = { globalThis: {}, JSON, Date }
    ktx.globalThis = ktx
    require('node:vm').runInNewContext(readFileSync(__dirname + '/disney-durchgang.js', 'utf8'), ktx)
    const werte = new Map()
    const speicher = { getItem: (k) => werte.get(k) ?? null, setItem: (k, v) => werte.set(k, v), removeItem: (k) => werte.delete(k) }
    const offen = [{ url: 'u1', id: 'a' }]
    let ende = null
    const lauf = ktx.akDisneyDurchgang({ speicher, jetzt: () => 1000, offene: () => offen, oeffne: () => {}, melde: () => {}, ende: (i) => (ende = i) })
    lauf.starten()
    lauf.geprueft({ url: 'u1', zuMelden: 0, schon: 25 })
    const text = ktx.akDisneyEndeText(ende, () => 'Shield Hero')
    pruefe('Durchgang führt „schon gemeldet" statt „übersprungen"', ende?.uebersprungen.length === 0 && /1 schon gemeldet: Shield Hero/.test(text) && !/übersprungen/.test(text), text)
  }

  /* Die Endanzeige des Durchgangs nennt je Titel den Grund. */
  {
    const ktx = { globalThis: {} }
    ktx.globalThis = ktx
    require('node:vm').runInNewContext(readFileSync(__dirname + '/disney-durchgang.js', 'utf8'), ktx)
    const text = ktx.akDisneyEndeText(
      {
        grund: 'nichts mehr offen',
        erledigt: 3,
        uebersprungen: [
          { url: 'u1', grund: 'nicht verfügbar (Startseite)' },
          { url: 'u2', grund: 'kein Ergebnis nach 3 Minuten' },
        ],
      },
      (u) => ({ u1: 'Titel Eins', u2: 'Titel Zwei' })[u],
    )
    pruefe('Endanzeige nennt Titel und Grund je Eintrag', /Titel Eins: nicht verfügbar \(Startseite\)/.test(text) && /Titel Zwei: kein Ergebnis nach 3 Minuten/.test(text), text)
    pruefe('Ohne Übersprungenes keine Zusatzzeile', !ktx.akDisneyEndeText({ grund: 'von Hand', erledigt: 1, uebersprungen: [] }, String).includes('übersprungen'))
  }
  /* Die Form selbst — an einer Kulisse, damit sie auch bei leerer Liste geprüft wird. */
  {
    const kulisse = {
      '2VX5fKgeiVEl': {
        url: 'https://www.disneyplus.com/de-de/series/go-go-loser-ranger/2VX5fKgeiVEl',
        staffeln: [{ nr: 2, name: 'St. 2', folgen: 12, erste: 13, offen: true }],
      },
    }
    const k = Object.keys(kulisse)
    pruefe(
      'die Formprüfung greift an einem erfundenen Eintrag',
      k.every((x) => kennungExt(kulisse[x].url) === x) &&
        k.every((x) => kulisse[x].staffeln.some((st) => st.offen)),
    )
  }
}

/**
 * Findet der Leser die Staffeln samt ihrer wahren Folgenzahl?
 *
 * Der Seitenaufruf bringt nur 15 Folgen mit, die Staffel hat 51 — wer nur
 * mithoert, prueft ein Drittel und nennt es die Staffel (Daniel, 26.08.2026:
 * „staffel 1 hat uebrigens 51 folgen, also sind die 15 dort auch falsch").
 * `pagination.totalCount` sagt, wie viele es wirklich sind.
 */
{
  staffeln = []
  folgen.clear()
  sammleStaffeln({
    data: {
      page: {
        containers: [
          {
            seasons: [
              { id: 'bd87ec00', visuals: { name: 'Staffel 1' }, items: [], pagination: { totalCount: 24, hasMore: true } },
              { id: 'fdc881e9', visuals: { name: 'Staffel 2' }, items: [], pagination: { totalCount: 23, hasMore: true } },
              { id: '3b47ae38', visuals: { name: 'Staffel 3' }, items: [], pagination: { totalCount: 12, hasMore: true } },
            ],
          },
        ],
      },
    },
  })
  pruefe('alle drei Staffeln gefunden', staffeln.length === 3, staffeln.length)
  pruefe(
    'jede kennt ihre wahre Folgenzahl',
    staffeln.map((s) => s.gesamt).join() === '24,23,12',
    staffeln.map((s) => s.gesamt),
  )
  pruefe('die Namen stehen dabei', staffeln.every((s) => /Staffel \d/.test(s.name)), staffeln.map((s) => s.name))

  /* Ein zweiter Abruf derselben Seite verdoppelt die Staffeln nicht. */
  sammleStaffeln({ data: { page: { containers: [{ seasons: [{ id: 'bd87ec00', visuals: { name: 'Staffel 1' }, pagination: { totalCount: 24 } }] }] } } })
  pruefe('ein zweiter Abruf verdoppelt keine Staffel', staffeln.length === 3, staffeln.length)

  /* Und was keinen Seitenzaehler hat, ist keine Staffel. */
  staffeln = []
  sammleStaffeln({ data: { page: { containers: [{ seasons: [{ id: 'abc', visuals: { name: 'Empfehlungen' } }] }] } } })
  pruefe('ohne Seitenzaehler keine Staffel', staffeln.length === 0, staffeln.length)
}

/**
 * Eine Empfehlungsleiste ist keine Staffel — auch wenn sie so aussieht.
 *
 * Der erste Anlauf suchte nach jedem Knoten mit Kennung und
 * `pagination.totalCount`. Genau das trägt auch der Container "EMPFEHLUNGEN":
 * Bei Beyblade X hat er acht Einträge, und aus 51 + 35 wurden 94 (Daniel,
 * 26.08.2026: „51 + 35 = 86, woher kommen die 94?").
 *
 * Staffeln stehen an genau einer Stelle. Wer dort nachsieht statt zu suchen,
 * findet keine Nachbarn.
 */
{
  staffeln = []
  sammleStaffeln({
    data: {
      page: {
        containers: [
          {
            type: 'episodes',
            seasons: [
              { id: 's1', visuals: { name: 'Staffel 1' }, pagination: { totalCount: 51 } },
              { id: 's2', visuals: { name: 'Staffel 2' }, pagination: { totalCount: 35 } },
            ],
          },
          {
            type: 'recommendations',
            visuals: { name: 'EMPFEHLUNGEN' },
            id: 'empf',
            pagination: { totalCount: 8 },
            items: [],
          },
        ],
      },
    },
  })
  pruefe('nur die zwei echten Staffeln', staffeln.length === 2, staffeln.map((s) => s.name))
  pruefe(
    'die Summe ist 86, nicht 94',
    staffeln.reduce((n, s) => n + s.gesamt, 0) === 86,
    staffeln.reduce((n, s) => n + s.gesamt, 0),
  )
}

/**
 * Beantwortet laut Prüfstand → kein „melden" (08.10.2026, Naruto Shippuden und Shield Hero).
 *
 * Der Prüfstand führt in anbieter[].ziele die offenen Adressen; wer dort fehlt, ist erledigt.
 * Bleach (offen, Meldungen mit Folgentiteln) bleibt auf dem alten Weg.
 */
{
  const vm = require('node:vm')
  const quelleDisney = readFileSync(__dirname + '/disney.js', 'utf8')
  const von = quelleDisney.indexOf('  function kennung(url)')
  const kennungDisney = quelleDisney.slice(von, quelleDisney.indexOf('\n  }\n', von) + 4).replace(/^ {2}/gm, '')
  const kennungVon = vm.runInNewContext('(' + kennungDisney.replace('function kennung', 'function') + ')')

  const NARUTO = 'https://www.disneyplus.com/de-de/browse/entity-ef04e263-4751-486c-9001-616f2adf09ba'
  const SHIELD = 'https://www.disneyplus.com/de-de/browse/entity-1b84d641-1bb3-422d-be4c-8e24c7b547cc'
  const BLEACH = 'https://www.disneyplus.com/de-de/series/bleach/6g48QKlgQdWK'
  const stand = {
    pruefstandAm: '2026-10-08T07:30:28Z',
    anbieter: [
      { plattform: 'netflix', ziele: [{ url: NARUTO, titel: 'falscher Anbieter' }] },
      { plattform: 'disneyplus', ziele: [{ url: 'https://www.disneyplus.com/browse/entity-x', titel: 'x' }, { url: 'https://www.disneyplus.com/series/bleach/6g48QKlgQdWK', titel: 'Bleach' }] },
    ],
  }

  /** Eine frische Seite: Skripte aus dem Manifest, ein Prüfstand-Abruf, eine Kulisse für den Zweitknopf. */
  const seite = (holen) => {
    const knoepfe = []
    const ktx = {
      globalThis: null,
      fetch: holen,
      setTimeout: (f) => f && 0,
      document: {
        createElement: () => ({ remove() { this.weg = true } }),
      },
    }
    ktx.globalThis = ktx
    for (const datei of ['pruefstand-zeit.js', 'disney-beantwortet.js']) vm.runInNewContext(readFileSync(__dirname + '/' + datei, 'utf8'), ktx)
    return { ktx, knoepfe, modul: ktx.AK_DISNEY_BEANTWORTET }
  }
  const ok = (j) => async () => ({ ok: true, json: async () => j })

  const lauf = async (holen, url) => {
    const s = seite(holen)
    const log = { anfragen: 0, zeigt: [], setze: [], signale: [], zweit: null }
    const knopf = { parentNode: { appendChild: (k) => (log.zweit = k) } }
    await s.modul.klaere({
      url,
      kennungVon,
      aktuell: () => true,
      zeige: (t, o) => log.zeigt.push([t, o]),
      knopf: () => knopf,
      setze: (b) => log.setze.push(b),
      signal: (d) => log.signale.push(d),
      anfrage: () => log.anfragen++,
    })
    return log
  }

  warten.push(
    (async () => {
      let l = await lauf(ok(stand), NARUTO)
      pruefe('Adresse nicht in ziele → passiver Zustand, nichts gesammelt', l.anfragen === 0 && l.setze[0] === true && /im Datensatz beantwortet/.test(l.zeigt[0][0]) && l.zeigt[0][1].klasse === 'gut', l)
      pruefe('Passiv meldet dem Durchgang „schon gemeldet", keine Meldung', l.signale[0]?.zuMelden === 0 && l.signale[0]?.schon === 1, l.signale)
      pruefe('Passiv bietet „trotzdem erneut melden" an', l.zweit?.textContent === 'trotzdem erneut melden' && typeof l.zweit?.onclick === 'function', l.zweit)
      const anfragenVorKlick = l.anfragen
      l.zweit.onclick()
      pruefe('„trotzdem erneut melden" startet den bisherigen Weg', anfragenVorKlick === 0 && l.anfragen === 1 && l.setze.at(-1) === false && /sammle Folgen/.test(l.zeigt.at(-1)[0]), l)

      l = await lauf(ok(stand), SHIELD)
      pruefe('Auch Shield Hero (nicht in ziele) ist passiv', l.anfragen === 0 && l.setze[0] === true, l)

      l = await lauf(ok(stand), BLEACH)
      pruefe('Adresse in ziele (Bleach, andere Schreibweise) → alter Weg, kein Hinweis', l.anfragen === 1 && l.setze[0] === false && !l.zweit && !l.signale.length, l)

      l = await lauf(async () => { throw new Error('Failed to fetch') }, NARUTO)
      pruefe('Prüfstand nicht erreichbar → alter Weg', l.anfragen === 1 && l.setze[0] === false && !l.zweit, l)
      l = await lauf(async () => ({ ok: false, json: async () => ({}) }), NARUTO)
      pruefe('Prüfstand antwortet mit Fehler → alter Weg', l.anfragen === 1 && l.setze[0] === false, l)
      l = await lauf(ok({ anbieter: [{ plattform: 'netflix', ziele: [] }] }), NARUTO)
      pruefe('Prüfstand ohne Disney+-Liste → alter Weg', l.anfragen === 1 && l.setze[0] === false, l)
      l = await lauf(ok({ anbieter: [{ plattform: 'disneyplus' }] }), NARUTO)
      pruefe('Disney+ ohne ziele-Feld → alter Weg', l.anfragen === 1 && l.setze[0] === false, l)

      /* Einmal je Seite geholt. */
      let abrufe = 0
      const s = seite(async () => (abrufe++, { ok: true, json: async () => stand }))
      await s.modul.istBeantwortet(NARUTO, kennungVon)
      await s.modul.istBeantwortet(SHIELD, kennungVon)
      await s.ktx.akGemeldetSeit(null)
      pruefe('Prüfstand wird einmal je Seite geholt (auch für den Zeitmaßstab)', abrufe === 1, abrufe)
    })(),
  )

  /* Verdrahtung: der Hörer in disney.js wartet, bis geklärt ist, dass geprüft werden soll. */
  pruefe('disney.js sammelt erst, wenn die Klärung „nicht beantwortet" ergab', /!eintrag \|\| beantwortet !== false\) return/.test(quelleDisney))
  pruefe('disney.js ruft die Klärung nach dem Seitenwechsel auf', quelleDisney.includes('AK_DISNEY_BEANTWORTET.klaere('))
  pruefe('Manifest lädt disney-beantwortet.js vor disney.js', (() => {
    const js = JSON.parse(readFileSync(__dirname + '/manifest.json', 'utf8')).content_scripts.find((g) => g.js.includes('disney.js')).js
    return js.indexOf('disney-beantwortet.js') >= 0 && js.indexOf('disney-beantwortet.js') < js.indexOf('disney.js') && js.indexOf('pruefstand-zeit.js') < js.indexOf('disney-beantwortet.js')
  })())
}

Promise.all(warten).then(() => {
  const fehler = faelle.filter((x) => !x).length
  console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Der Leser findet nur echte Folgen')
  process.exit(fehler ? 1 : 0)
})
