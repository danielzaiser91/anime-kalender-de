// Zusicherung: kleine Cover der News-Liste tragen den Hover-Zeiger, laden aber vor dem Überfahren nur das eigene Bild.
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NewsEintrag } from '../shared/types.ts'
import type { Title } from '../shared/types.ts'
import type { Vorschlag } from '../shared/aehnlich.ts'
import type { SaisonZeile } from '../web/src/lib/saison.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { NewsCover } from '../web/src/components/news-kachel.tsx'
import { SaisonKarte } from '../web/src/components/SaisonKarte.tsx'
import { AehnlicheKachel } from '../web/src/components/detail/weitere.tsx'

const mit = renderToStaticMarkup(<NewsCover e={{ cover: 'https://x.test/c.jpg' } as NewsEintrag} />)
assert.match(mit, /data-hover-zeile/, 'Cover trägt den Zeiger der Vorschau')
assert.equal((mit.match(/<img/g) ?? []).length, 1, 'vor dem Überfahren nur das kleine Bild, keine Vorschau-Karte')
assert.doesNotMatch(mit, /data-hover-cover/, 'Karte erscheint erst nach Frist')
assert.match(mit, /class="h-14 w-10 shrink-0 rounded"/, 'Maße der Kachel unverändert (kein Layout-Sprung)')

const ohne = renderToStaticMarkup(<NewsCover e={{} as NewsEintrag} />)
assert.doesNotMatch(ohne, /data-hover-zeile/, 'ohne Cover kein Zeiger')
assert.doesNotMatch(ohne, /<img/, 'ohne Cover kein Bild')

/* Saison-Karte: Zeiger am Button, genau das kleine Bild (60×85) vor dem Überfahren. */
const titel = { id: 900001, titleDe: 'Testtitel', coverImage: 'https://x.test/s.jpg' } as unknown as Title
const zeile = { titel, id: 900001, deutsch: true, stufe: 'auf-deutsch', erschienen: true } as SaisonZeile
const karte = renderToStaticMarkup(<SaisonKarte z={zeile} data={{ releasesByTitle: new Map() } as unknown as Dataset} favorit={false} oeffne={() => {}} />)
assert.match(karte, /<button[^>]*data-hover-zeile/, 'Saison-Button trägt den Zeiger')
assert.equal((karte.match(/<img/g) ?? []).length, 1, 'Saison: nur das kleine Bild')
assert.doesNotMatch(karte, /data-hover-cover/, 'Saison: Karte erst nach Frist')
assert.match(karte, /h-\[85px\] w-\[60px\] shrink-0/, 'Saison: Maße unverändert')
const karteOhne = renderToStaticMarkup(<SaisonKarte z={{ ...zeile, titel: { ...titel, coverImage: undefined } as unknown as Title }} data={{ releasesByTitle: new Map() } as unknown as Dataset} favorit={false} oeffne={() => {}} />)
assert.doesNotMatch(karteOhne, /data-hover-zeile/, 'Saison ohne Cover: kein Zeiger')

/* Ähnliche Titel: Zeiger am Button, ein Bild mit 88 px Breite. */
const v = { title: titel, gemeinsam: ['g:Action'] } as unknown as Vorschlag
const kachel = renderToStaticMarkup(<AehnlicheKachel v={v} onOpenTitle={() => {}} merkmalName={(m) => m} />)
assert.match(kachel, /<button[^>]*data-hover-zeile/, 'Kachel-Button trägt den Zeiger')
assert.equal((kachel.match(/<img/g) ?? []).length, 1, 'Kachel: nur das kleine Bild')
assert.doesNotMatch(kachel, /data-hover-cover/, 'Kachel: Karte erst nach Frist')
assert.match(kachel, /w-\[88px\]/, 'Kachel: Maße unverändert')
const kachelOhne = renderToStaticMarkup(<AehnlicheKachel v={{ ...v, title: { ...titel, coverImage: undefined } as unknown as Title }} onOpenTitle={() => {}} merkmalName={(m) => m} />)
assert.doesNotMatch(kachelOhne, /data-hover-zeile/, 'Kachel ohne Cover: kein Zeiger')

console.log('hover-cover-weitere: ok')
