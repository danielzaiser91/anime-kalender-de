import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { handbelegBloecke } from './handbeleg-treffer.mjs'

const GTI = 'amzn1.dv.gti.08b61f95-8ff0-99ca-db1c-d15b6475bf51'
const text = [
  '- id: 1\n  url: https://www.amazon.de/s?k=Bungo%20Stray%20Dogs&i=instant-video',
  '- id: 2\n  url: https://www.amazon.de/s?k=Digimon%20tri&i=instant-video',
  '- id: 3\n  url: https://www.amazon.de/gp/video/detail/B0B649YPX3',
  '- id: 4\n  url: https://www.netflix.com/title/80135674',
  `- id: 5\n  url: https://www.amazon.de/gp/video/detail/${GTI}?tag=x&token=y`,
  '- id: 6\n  url: https://www.crunchyroll.com/series/GRDV0019R/name',
  '- id: 7\n  url: https://www.youtube.com/@kanal',
].join('\n')

const ids = (url) => handbelegBloecke(text, url).map((b) => /id: (\d+)/.exec(b)[1])

const faelle = [
  ['Suchadresse ohne Beleg trifft nichts', 'https://www.amazon.de/s?k=Miraculous&i=instant-video', []],
  ['Suchadresse mit Beleg trifft nur ihren Block', 'https://www.amazon.de/s?k=Digimon%20tri&i=instant-video', ['2']],
  ['Detailadresse trifft per Adresse', 'https://www.amazon.de/gp/video/detail/B0B649YPX3', ['3']],
  ['Detailadresse trifft per Kennung in anderer Form', 'https://www.amazon.de/dp/B0B649YPX3?ref=x', ['3']],
  ['Detailadresse ohne Beleg', 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA', []],
  ['Netflix mit Zusatzquery', 'https://www.netflix.com/title/80135674?trackId=1', ['4']],
  ['Netflix watch gegen title', 'https://www.netflix.com/watch/80135674', ['4']],
  ['Netflix andere ID', 'https://www.netflix.com/title/80135675', []],
  ['Schrägstrich am Ende', 'https://www.netflix.com/title/80135674/', ['4']],
  ['Anker', 'https://www.netflix.com/title/80135674#x', ['4']],
  ['http ohne www', 'http://netflix.com/title/80135674', ['4']],
  ['gti ohne Query', `https://www.amazon.de/gp/video/detail/${GTI}`, ['5']],
  ['gti mit ref', `https://www.amazon.de/gp/video/${GTI}/ref=x`, ['5']],
  ['gti als Parameter', `https://watch.amazon.de/detail?gti=${GTI}`, ['5']],
  ['Crunchyroll mit Query', 'https://www.crunchyroll.com/de/series/GRDV0019R?x=1', ['6']],
  ['Pfad mit Zusatzquery', 'https://www.youtube.com/@kanal?si=1', ['7']],
  ['Pfad mit Anker', 'https://www.youtube.com/@kanal#x', ['7']],
  ['Pfad mit Schrägstrich', 'https://www.youtube.com/@kanal/', ['7']],
  ['Pfad http ohne www', 'http://youtube.com/@kanal', ['7']],
  ['Suche mit Anker', 'https://www.amazon.de/s?k=Digimon%20tri&i=instant-video#x', ['2']],
  ['Suche mit Schrägstrich', 'https://www.amazon.de/s?k=Digimon%20tri&i=instant-video/', ['2']],
  ['Suche http ohne www', 'http://amazon.de/s?k=Digimon%20tri&i=instant-video', ['2']],
  ['gti in Großschreibung', `https://www.amazon.de/gp/video/detail/${GTI.toUpperCase().replace('AMZN1.DV.GTI', 'amzn1.dv.gti')}`, ['5']],
  ['Suche trifft keinen Detailblock', 'https://www.amazon.de/s?k=B0B649YPX3', []],
]
for (const [name, url, erwartet] of faelle) assert.deepEqual(ids(url), erwartet, name)

// Echter Bestand: jede Nicht-Such-Adresse findet ihren Block auch mit Zusatzquery, Suchadressen nur ihre eigene.
const echt = readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')
const alle = [...new Set(echt.match(/https?:\/\/[^\s'"]+/g) ?? [])]
let geprueft = 0
for (const a of alle) {
  const suche = /\/(?:s|search)(?:[?/]|$)/.test(a.replace(/^https?:\/\/(www\.)?/, ''))
  const gesucht = suche || /#/.test(a) ? a : `${a}${a.includes('?') ? '&' : '?'}zz=1`
  const treffer = handbelegBloecke(echt, gesucht)
  assert.ok(treffer.some((b) => b.includes(a)), `Block fehlt für ${a}`)
  geprueft++
}
assert.ok(geprueft > 2000, `zu wenige Adressen: ${geprueft}`)
console.log(`handbeleg-treffer: ${faelle.length} Fälle ok, ${geprueft} Adressen im Bestand gefunden`)
