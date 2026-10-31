import assert from 'node:assert/strict'
import { handbelegBloecke } from './handbeleg-treffer.mjs'

const text = [
  '- id: 1\n  url: https://www.amazon.de/s?k=Bungo%20Stray%20Dogs&i=instant-video',
  '- id: 2\n  url: https://www.amazon.de/s?k=Digimon%20tri&i=instant-video',
  '- id: 3\n  url: https://www.amazon.de/gp/video/detail/B0B649YPX3',
].join('\n')

const ids = (url) => handbelegBloecke(text, url).map((b) => /id: (\d+)/.exec(b)[1])

const faelle = [
  ['Suchadresse ohne Beleg trifft nichts', 'https://www.amazon.de/s?k=Miraculous&i=instant-video', []],
  ['Suchadresse mit Beleg trifft nur ihren Block', 'https://www.amazon.de/s?k=Digimon%20tri&i=instant-video', ['2']],
  ['Detailadresse trifft per Adresse', 'https://www.amazon.de/gp/video/detail/B0B649YPX3', ['3']],
  ['Detailadresse trifft per Kennung in anderer Form', 'https://www.amazon.de/dp/B0B649YPX3?ref=x', ['3']],
  ['Detailadresse ohne Beleg', 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA', []],
]
for (const [name, url, erwartet] of faelle) assert.deepEqual(ids(url), erwartet, name)
console.log(`handbeleg-treffer: ${faelle.length} Fälle ok`)
