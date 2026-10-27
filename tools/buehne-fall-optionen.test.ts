/**
 * Test der Fall-Optionen der Bühne (`web/buehne/fall-optionen.ts`): `tonspur: 'ohne-beleg'` löscht jedes Tonspur-Feld
 * (festes Feldverzeichnis, nicht aus dem Modul), und der echte Fall 86 kippt damit in „alle Zeilen ohne Beleg“.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Release, Title } from '../shared/types.ts'
import { alleOhneSprachbeleg } from '../web/src/components/detail/legende-zeilen.ts'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { ergaenzeOptionsFaelle, mitOptionen, startAufDisc } from '../web/buehne/fall-optionen.ts'
import { baueFaelle, type FaelleDatei, type Fall } from '../web/buehne/faelle-bau.ts'

const FELDER = ['dub', 'dubRanges', 'dubQuelle', 'dubStand', 'dubHintOnly', 'dubAbgeleitet']
const weg = (url: string) => ({
  url,
  zugang: 'abo',
  dub: true,
  dubRanges: [{ from: 1, to: 2, dub: true }],
  dubQuelle: 'justwatch',
  dubStand: '2999-12-31',
  dubHintOnly: true,
  dubAbgeleitet: 'telekom-annahme',
})
const titel = () => ({ id: 1, titleDe: 'T', streams: [weg('a'), weg('b')], watchLinks: [weg('c')] })
const fall = (): Fall => ({ name: 'F', titleId: 1, synopsen: {}, disc: {}, sprecher: {}, folgen: {}, 'titles.json': [titel()], 'titles-core.json': [titel()] })

// Jedes Feld einzeln: nach der Option fehlt es an jedem Weg beider Titeldateien, Übriges bleibt.
const roh = fall()
const neu = mitOptionen(roh, { tonspur: 'ohne-beleg' }, 'N')
assert.equal(neu.name, 'N')
for (const datei of ['titles.json', 'titles-core.json']) {
  const t = (neu[datei] as { streams: object[]; watchLinks: object[] }[])[0]!
  for (const w of [...t.streams, ...t.watchLinks]) {
    for (const feld of FELDER) assert.equal(feld in w, false, `${datei}: ${feld} steht noch`)
    assert.equal((w as { zugang: string }).zugang, 'abo')
  }
  assert.equal(t.streams.length, 2)
  assert.equal(t.watchLinks.length, 1)
}
// Ausgangsfall unverändert; ohne Option gleiche Daten.
assert.equal((roh['titles.json'] as { streams: { dub: boolean }[] }[])[0]!.streams[0]!.dub, true)
assert.deepEqual(mitOptionen(roh, {}, 'N')['titles.json'], roh['titles.json'])

// Fehlende Titeldatei und fehlender Ausgangsfall brechen nicht.
const ohneDatei: Fall = { ...fall() }
delete ohneDatei['titles-core.json']
assert.equal('titles-core.json' in mitOptionen(ohneDatei, { tonspur: 'ohne-beleg' }, 'N'), false)
const faelle = { a: fall() }
ergaenzeOptionsFaelle(faelle, { 'a-x': { von: 'a', name: 'AX', optionen: { tonspur: 'ohne-beleg' } }, 'b-x': { von: 'fehlt', name: 'BX', optionen: {} } })
assert.deepEqual(Object.keys(faelle), ['a', 'a-x'])

// Der echte Fall 86: vorher ein belegter Weg, mit Option alle Zeilen ohne Beleg (Kopf ohne Marke).
const datei = JSON.parse(readFileSync(new URL('../web/buehne/faelle.json', import.meta.url), 'utf8')) as FaelleDatei
const alle = baueFaelle(datei).faelle
const ohneBeleg = (f: Fall): boolean => {
  const t = (f['titles.json'] as Title[]).find((x) => x.id === f.titleId)!
  const releases = (f['releases.json'] as Release[]).filter((r) => r.titleId === f.titleId)
  return alleOhneSprachbeleg(sortiereNachZugang({ title: t }), t, releases)
}
assert.equal(ohneBeleg(alle['86']!), false)
assert.equal(ohneBeleg(alle['86-ohne-beleg']!), true)
assert.equal(alle['86-ohne-beleg']!.name, '86 – alle Zeilen ohne Sprachbeleg')
assert.equal(alle['86-ohne-beleg']!.titleId, alle['86']!.titleId)
// Die übrigen Fälle bleiben, wie sie waren.
assert.equal(ohneBeleg(alle['tokyo-revengers']!), false)

// `start: 'disc'` ändert keine Daten; nur der abgeleitete Fall startet auf „Disc“, der Ausgangsfall und Unbekanntes nicht.
assert.deepEqual(mitOptionen(roh, { start: 'disc' }, 'N')['titles.json'], roh['titles.json'])
assert.deepEqual(alle['sakamoto-days-disc']!.disc, alle['sakamoto-days']!.disc)
assert.equal(alle['sakamoto-days-disc']!.titleId, alle['sakamoto-days']!.titleId)
assert.equal(startAufDisc('sakamoto-days-disc'), true)
assert.equal(startAufDisc('sakamoto-days'), false)
assert.equal(startAufDisc('86-ohne-beleg'), false)
assert.equal(startAufDisc(undefined), false)
assert.equal(startAufDisc('x', { x: { von: 'a', name: 'X', optionen: { tonspur: 'ohne-beleg' } } }), false)
assert.equal(startAufDisc('x', { x: { von: 'a', name: 'X', optionen: { start: 'disc' } } }), true)
console.log('buehne-fall-optionen: ok (Felder, Ausgangsfall, Fehlfälle, Fall 86 mit/ohne Beleg, Start auf Disc)')
