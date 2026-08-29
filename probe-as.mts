import { ausSeite, alsIso } from './pipeline/fetch-anisearch-folgen.ts'
const r = await fetch('https://www.anisearch.de/anime/11301/episodes', {
  headers: { 'User-Agent': 'anime-kalender.de/1.0 (+https://anime-kalender.de)' },
})
const f = ausSeite(await r.text())
console.log(f.length, 'Folgen gelesen')
for (const x of f.slice(0, 3)) console.log(' ', x.nr, '|', x.datum, '|', x.minuten, 'min |', x.de)
console.log('mit deutschem Titel:', f.filter((x) => x.de).length, '| mit Datum:', f.filter((x) => x.datum).length)
console.log('Datumsprobe:', alsIso('14. Jul 2016'), '|', alsIso('Jul 2016'))
