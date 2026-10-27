/**
 * Kulissentest: die echten Erzeuger der Prüflisten (Netflix und Prime) laufen in einem Wegwerf-Ordner (`AK_ROOT`) auf
 * festen Eingaben, danach prüft der Wächter (`tools/pruefliste-asid.mjs`) das Ergebnis. Je Auswahlstelle drei Kandidaten
 * mit verschiedener aniSearch-Kennung, der richtige in der Mitte.
 * Aufruf: node tools/pruefliste-asid.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { abweichungen, pruefeAsId } from './pruefliste-asid.mjs'

const tools = import.meta.dirname

function titel(id, anisearchId, rest) {
  return { id, titleDe: `Titel ${id}`, format: 'TV', episodes: 12, jpYear: 2015, jpSeason: 'SPRING', ...(anisearchId ? { anisearchId } : {}), ...rest }
}
const stream = (platform, url) => ({ platform, url })
const netflix = (nr) => stream('netflix', `https://www.netflix.com/title/${nr}`)
const suche = (name) => stream('primevideo', `https://www.amazon.de/s?k=${name}&i=instant-video`)

/* Reihenfolge je Gruppe: der erwartete Treffer steht in der Mitte. */
const TITEL = [
  titel(11, 5011, { jpYear: 2020, streams: [netflix(111)] }),
  titel(12, 5012, { jpYear: 2015, streams: [netflix(111)] }),
  titel(13, 5013, { jpYear: 2022, streams: [netflix(111)] }),
  titel(21, 5021, { jpYear: 2018, streams: [netflix(222)] }),
  titel(22, 5022, { jpYear: 2012, streams: [netflix(222)] }),
  titel(23, 5023, { jpYear: 2020, streams: [netflix(222)] }),
  titel(31, 5031, { streams: [suche('Eins')] }),
  /* aniSearch-eigener Titel: id = 10.000.000 + Kennung, nicht in data/anisearch.json */
  titel(10000032, 32, { streams: [suche('Zwei')] }),
  titel(33, 5033, { streams: [suche('Drei')] }),
  titel(41, 5041, {}),
  titel(42, 5042, {}),
  titel(43, 5043, {}),
  titel(51, 5051, {}),
  titel(52, 5052, {}),
  titel(53, 5053, {}),
  /* Ohne aniSearch-Kennung: die Liste trägt null, nie die Titel-id (je Auswahlstelle einer). */
  titel(61, null, { streams: [netflix(444)] }),
  titel(34, null, { streams: [suche('Fuenf')] }),
  titel(44, null, {}),
  titel(54, null, {}),
]
/* Cartoons: negative Kennung, nie eine aniSearch-Kennung. */
const CARTOONS = [titel(-61, null, { streams: [netflix(333)] }), titel(-62, null, { streams: [suche('Vier')] })]
const STAFFELN = { 444: { staffeln: [1, 2].map((seq) => ({ seq, name: `S${seq}`, folgen: 20 })) }, 222: { staffeln: [1, 2, 3].map((seq) => ({ seq, name: `S${seq}`, folgen: 20 })) } }
const VORSCHLAEGE = [41, 42, 43, 44].map((id) => ({ id, titel: `Vorschlag ${id}`, anbieter: ['primevideo'] }))
const WIDERSPRUCH = { faelle: [51, 52, 53, 54].map((id) => ({ art: 'andere-ausgabe', platform: 'primevideo', titleId: id, titel: `Kanal ${id}`, anbieter: 'Kanal' })) }

function schreibe(wurzel, pfad, inhalt) {
  const ziel = join(wurzel, pfad)
  mkdirSync(join(ziel, '..'), { recursive: true })
  writeFileSync(ziel, JSON.stringify(inhalt))
}

function kulisse() {
  const wurzel = mkdtempSync(join(tmpdir(), 'asid-kulisse-'))
  schreibe(wurzel, 'public/data/titles.json', TITEL)
  schreibe(wurzel, 'public/data/cartoons.json', CARTOONS)
  schreibe(wurzel, 'public/data/releases.json', [])
  schreibe(wurzel, 'data/anbieter-staffeln.json', STAFFELN)
  schreibe(wurzel, 'data/anbieter-vorschlaege.json', VORSCHLAEGE)
  schreibe(wurzel, 'data/kanal-widerspruch.json', WIDERSPRUCH)
  schreibe(wurzel, 'data/link-check.json', {})
  schreibe(wurzel, 'data/pruefliste-regeln.json', { erweitert: true })
  mkdirSync(join(wurzel, 'extension'), { recursive: true })
  writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), '[]\n')
  return wurzel
}

function erzeuge(wurzel) {
  for (const skript of ['extension-offene-liste.mjs', 'extension-offene-amazon.mjs']) {
    const lauf = spawnSync(process.execPath, [resolve(tools, skript)], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8' })
    assert.equal(lauf.status, 0, `${skript}: ${lauf.stderr}`)
  }
}

const lies = (wurzel, datei) => readFileSync(join(wurzel, datei), 'utf8')
const netflixListe = (wurzel) => JSON.parse(lies(wurzel, 'extension/offene-netflix.js').replace(/^[^{]*=\s*/, ''))
const primeListe = (wurzel) => JSON.parse(lies(wurzel, 'public/data/prime-suche.json'))

/* Ein Eintrag, dessen Titel der Bestand nicht kennt (Cartoon), ist kein Paar; mit Kennung ist er ein Fehler. */
const bekannt = new Map([[1, { id: 1, anisearchId: 7 }]])
assert.deepEqual(abweichungen([['a', 99, null], ['b', 1, 7]], bekannt), { paare: 1, schlecht: [] })
assert.equal(abweichungen([['a', 99, 3]], bekannt).schlecht.length, 1)
assert.equal(abweichungen([['a', -99, -99]], bekannt).schlecht.length, 1)

const wurzel = kulisse()
try {
  erzeuge(wurzel)
  const nf = netflixListe(wurzel)
  assert.equal(nf['111'].asTitel, 12, 'Netflix ohne Anbieter-Zählung: ältester der drei Kandidaten')
  assert.equal(nf['111'].asId, 5012)
  assert.equal(nf['222'].asTitel, 22, 'Netflix mit Anbieter-Zählung (mehrere Kandidaten, kein staffeln[0].id): ältester')
  assert.equal(nf['222'].asId, 5022)
  assert.equal(nf['222'].laut, 'anbieter', 'Vorbedingung: Zählung des Anbieters ohne eigene Rechnung')
  assert.equal(nf['222'].staffeln[0].id, undefined, 'Vorbedingung: der Mehrkandidaten-Fall trägt keine Titel-id an der Staffel')

  assert.equal(nf['444'].asTitel, 61, 'Netflix mit Anbieter-Zählung, Titel ohne Kennung')
  assert.equal(nf['444'].asId, null)
  assert.equal(nf['333']?.asTitel, -61, 'Vorbedingung: Netflix-Cartoon steht in der Liste')
  assert.equal(nf['333'].asId, null, 'Cartoon trägt keine aniSearch-Kennung')

  const pr = primeListe(wurzel)
  const nachId = (id) => Object.values(pr).filter((e) => e.id === id)
  assert.deepEqual(nachId(10000032).map((e) => e.asId), [32], 'aniSearch-eigener Titel ohne Tabelleneintrag trägt seine Kennung')
  assert.deepEqual(nachId(31).map((e) => e.asId), [5031], 'Suchadresse im Titel')
  assert.deepEqual(nachId(42).map((e) => e.asId), [5042], 'Vorschlag')
  assert.deepEqual(nachId(52).map((e) => e.asId), [5052], 'zweite Ausgabe (Kanal-Widerspruch)')
  for (const id of [34, 44, 54]) assert.deepEqual(nachId(id).map((e) => e.asId), [null], `Titel ${id} ohne Kennung: null`)
  assert.equal(Object.keys(pr).length, 12, 'Prime: zwölf Suchen aus drei Quellen')

  assert.deepEqual(pruefeAsId(wurzel), [], 'Erzeugnis des echten Laufs besteht den Wächter')

  /* Ein Titel hinter dem Schalter „ohne Synchro“ (Beerus, 26.10.2026) steht in ohne-synchro.json und ist kein unbekannter Titel. */
  const ohneDrei = TITEL.filter((t) => t.id !== 33)
  schreibe(wurzel, 'public/data/titles.json', ohneDrei)
  assert.match(pruefeAsId(wurzel).join('\n'), /Prime-Suchtreffer: asId weicht vom Titel ab: .*Titel 33 unbekannt: Liste 5033/, 'ohne Katalog ist der Titel unbekannt')
  schreibe(wurzel, 'public/data/ohne-synchro.json', [titel(33, 5033, {})])
  assert.deepEqual(pruefeAsId(wurzel), [], 'Titel hinter dem Schalter mit passender Kennung besteht')
  schreibe(wurzel, 'public/data/ohne-synchro.json', [titel(33, 9999, {})])
  assert.match(pruefeAsId(wurzel).join('\n'), /Titel 33: Liste 5033, Titel 9999/, 'Titel hinter dem Schalter mit falscher Kennung ist rot')
  schreibe(wurzel, 'public/data/ohne-synchro.json', [titel(77, 5077, {})])
  assert.match(pruefeAsId(wurzel).join('\n'), /Titel 33 unbekannt/, 'ein anderer Titel im Katalog entlastet nicht')
  schreibe(wurzel, 'public/data/ohne-synchro.json', [titel(33, 5033, {}), titel(12, 4242, {})])
  assert.deepEqual(pruefeAsId(wurzel), [], 'steht ein Titel in beiden, gilt der Hauptbestand')
  rmSync(join(wurzel, 'public/data/ohne-synchro.json'))
  schreibe(wurzel, 'public/data/titles.json', TITEL)

  /* Der Wächter wird rot, wo die Kennung falsch ist: Netflix mit Mehrkandidaten-Eintrag, Prime. */
  const schlechtNetflix = netflixListe(wurzel)
  schlechtNetflix['222'].asId = null
  writeFileSync(join(wurzel, 'extension/offene-netflix.js'), `globalThis.AK_OFFENE_TITEL = ${JSON.stringify(schlechtNetflix)}\n`)
  const f1 = pruefeAsId(wurzel)
  assert.equal(f1.length, 1)
  assert.match(f1[0], /Netflix-Liste: asId weicht/)
  erzeuge(wurzel)

  const schlechtPrime = primeListe(wurzel)
  for (const e of Object.values(schlechtPrime)) if (e.id === 52) e.asId = null
  schreibe(wurzel, 'public/data/prime-suche.json', schlechtPrime)
  const f2 = pruefeAsId(wurzel)
  assert.equal(f2.length, 1)
  assert.match(f2[0], /Prime-Suchtreffer: asId weicht/)
  erzeuge(wurzel)

  /* Leere Liste ist kein Freispruch, jede Liste einzeln; fehlende Datei ebenso. */
  schreibe(wurzel, 'public/data/prime-suche.json', {})
  assert.match(pruefeAsId(wurzel).join('\n'), /Prime-Suchtreffer: kein einziges Paar/)
  assert.doesNotMatch(pruefeAsId(wurzel).join('\n'), /Netflix/)
  erzeuge(wurzel)
  writeFileSync(join(wurzel, 'extension/offene-netflix.js'), 'globalThis.AK_OFFENE_TITEL = {}\n')
  assert.match(pruefeAsId(wurzel).join('\n'), /Netflix-Liste: kein einziges Paar/)
  assert.doesNotMatch(pruefeAsId(wurzel).join('\n'), /Prime/)
  for (const datei of ['public/data/titles.json', 'public/data/prime-suche.json', 'extension/offene-netflix.js']) {
    erzeuge(wurzel)
    const inhalt = lies(wurzel, datei)
    rmSync(join(wurzel, datei))
    assert.deepEqual(pruefeAsId(wurzel), [`${datei} fehlt`])
    writeFileSync(join(wurzel, datei), inhalt)
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('pruefliste-asid.test: grün')
