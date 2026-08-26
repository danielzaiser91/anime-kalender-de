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

/* Die Sammelfunktion aus der Quelle holen statt sie nachzubauen. */
const von = quelle.indexOf('  function sammle(')
if (von < 0) { console.error('sammle() nicht gefunden'); process.exit(1) }
const code = quelle.slice(von, quelle.indexOf('\n  }\n', von) + 4)
const folgen = new Map()
eval(code.replace(/^ {2}/gm, ''))

const faelle = []
const pruefe = (name, ok, gefunden) => {
  faelle.push(ok)
  console.log(ok ? `  ✓ ${name}` : `  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

sammle(probe)
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
sammle({
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
sammle({ items: [{ actions: [{ resourceId: 'X'.repeat(30) }], visuals: { episodeNumber: '0' } }] })
pruefe('Folge 0 zählt nicht', folgen.size === 0, folgen.size)

folgen.clear()
sammle({ items: [{ visuals: { episodeNumber: '4' } }] })
pruefe('ohne Kennung keine Folge', folgen.size === 0, folgen.size)

/* Zweimal derselbe Abruf verdoppelt nichts — die Kennung ist der Schlüssel. */
folgen.clear()
sammle(probe)
const einmal = folgen.size
sammle(probe)
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
  pruefe('die Liste hat Einträge', schluessel.length > 0, schluessel.length)
  pruefe(
    'jeder Schlüssel wird aus seiner eigenen Adresse wiedergefunden',
    schluessel.every((k) => kennungExt(liste[k].url) === k),
    schluessel.filter((k) => kennungExt(liste[k].url) !== k).slice(0, 3),
  )
  pruefe(
    'jeder Eintrag hat mindestens eine offene Staffel',
    schluessel.every((k) => liste[k].staffeln.some((st) => st.offen)),
  )
}

const fehler = faelle.filter((x) => !x).length
console.log(fehler ? `\n${fehler} Fall/Fälle durchgefallen` : '\n✓ Der Leser findet nur echte Folgen')
process.exit(fehler ? 1 : 0)
