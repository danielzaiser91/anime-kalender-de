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
  pruefe(
    'jeder Eintrag hat mindestens eine offene Staffel',
    schluessel.every((k) => liste[k].staffeln.some((st) => st.offen)),
  )
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

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Der Leser findet nur echte Folgen')
process.exit(fehler ? 1 : 0)
