/**
 * Test für `tools/anisearch-mal-mehrfach.mjs`: die Art jeder Gruppe folgt aus den Zahlen (Summe der Seiten-Folgen gegen die Folgen
 * des AniList-Titels), und die Liste rechnet die Summe nach. Jede Art hat eine Gegenprobe, die ohne die Rechnung kippt.
 */
import assert from 'node:assert/strict'
import { BASIS, MARKE_ANFANG, MARKE_ENDE, abschnittEinsetzen, findeMalMehrfach, listeAlsMarkdown } from './anisearch-mal-mehrfach.mjs'

const seite = (mal, folgen, dub = 'd') => ({ t: `Seite ${mal}/${folgen}`, ty: 'Bonus', f: folgen, dub, mal })
const zeile = (as) => ({ id: BASIS + as, titleDe: 'Titel' })
const anilist = (id, malId, episodes, anisearchId) => ({ id, malId, episodes, anisearchId })

const art = (gruppen, mal) => gruppen.find((g) => g.mal === mal)?.art

// Durarara-Muster: ein AniList-Titel mit 2 Folgen, zwei aniSearch-Seiten zu je 1 Folge, beide mit Zeile im Hauptbestand.
const eintraege = { 10: seite(1, 1), 11: seite(1, 1), 20: seite(2, 1), 21: seite(2, 1), 30: seite(3, 1, '-'), 31: seite(3, 1, '-'), 40: seite(4, 12), 41: seite(4, 12), 50: seite(5, 1) }
const titles = [anilist(100, 1, 2, 5), zeile(10), zeile(11), anilist(300, 3, 2, undefined), zeile(30)]
const ohne = [anilist(200, 2, 3, undefined), zeile(20), zeile(21), zeile(31), anilist(400, 9, 12, 40), anilist(401, 9, 12, 41)]
const gruppen = findeMalMehrfach(eintraege, titles, ohne, new Set([100]))

assert.equal(gruppen.length, 4, 'MAL 5 hat nur eine Seite und steht nicht in der Liste')
assert.equal(art(gruppen, 1), 'teilung-voll', '1 + 1 = 2 Folgen des AniList-Titels')
assert.equal(art(gruppen, 2), 'teilung-teil', 'Gegenprobe: 1 + 1 gegen 3 Folgen ist keine vollständige Teilung')
assert.equal(art(gruppen, 3), 'teilung-voll', 'Seite 30/31: Folgen 1 + 1 = 2, auch ohne Deutsch')
assert.equal(art(gruppen, 4), 'getrennt', 'jede Seite hat ihren eigenen AniList-Titel')
assert.equal(gruppen.find((g) => g.mal === 1).imHaupt, true)
assert.equal(gruppen.find((g) => g.mal === 2).imHaupt, false, 'Gegenprobe: nur Katalog')
assert.equal(gruppen.find((g) => g.mal === 1).anilist[0].beleg, true, 'Beleg für 100 erkannt')

// Ohne AniList-Titel mit dieser MAL steht jede Seite für sich.
const allein = findeMalMehrfach({ 1: seite(7, 2), 2: seite(7, 3) }, [zeile(1), zeile(2)], [])
assert.equal(art(allein, 7), 'ohne-anilist')

// Fehlt einer Seite die Folgenzahl, gilt die Summe nicht als belegt.
const luecke = findeMalMehrfach({ 1: seite(8, 1), 2: { ...seite(8, 1), f: undefined } }, [anilist(1, 8, 1)], [])
assert.equal(art(luecke, 8), 'teilung-teil')

// Regel „genau ein AniList-Titel": tragen zwei Titel die MAL, passt die Summe beider nicht als Teilung (Gegenprobe: mit einem Titel wäre sie voll).
const zwei = findeMalMehrfach({ 1: seite(9, 1), 2: seite(9, 1) }, [anilist(1, 9, 1), anilist(2, 9, 1)], [])
assert.equal(art(zwei, 9), 'teilung-teil')
assert.equal(art(findeMalMehrfach({ 1: seite(9, 1), 2: seite(9, 1) }, [anilist(1, 9, 2)], []), 9), 'teilung-voll')

// Die Liste nennt die Summe, die der Test nachrechnet.
const md = listeAlsMarkdown(gruppen, '2026-10-13')
assert.match(md, /\| 1 \| Seite 1\/1 \| 100 \(2 F\., Hauptbestand, Beleg\) \| 10: 1 dt\. \[Hauptbestand\]; 11: 1 dt\. \[Hauptbestand\] \| 2 \|/)
assert.match(md, /\*\*4 MAL-Kennungen\*\* tragen zwei oder mehr aniSearch-Seiten \(8 Seiten\)/)

// Abschnitt ersetzen statt anhängen, zweimal gelaufen ändert nichts.
const alt = 'Kopf\n\nvorher\n'
const einmal = abschnittEinsetzen(alt, 'A')
assert.ok(einmal.startsWith('Kopf') && einmal.includes(`${MARKE_ANFANG}\nA\n${MARKE_ENDE}`))
assert.equal(abschnittEinsetzen(einmal, 'A'), einmal)
assert.ok(abschnittEinsetzen(einmal, 'B').includes(`${MARKE_ANFANG}\nB\n${MARKE_ENDE}`))
assert.equal(abschnittEinsetzen(einmal, 'B').split(MARKE_ANFANG).length, 2)

console.log('anisearch-mal-mehrfach.test: ok')
