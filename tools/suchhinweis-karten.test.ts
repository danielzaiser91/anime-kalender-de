/**
 * Test der Zählung des Suchhinweises in der Einheit der Liste (`web/src/lib/suchhinweis-zaehlen.ts`, `suchhinweis.ts`):
 * Mit „Staffeln zusammenfassen“ zählen Karten, nicht Titel. Daniels Fall: „Attack on Titan“ — alle Treffer ohne Synchro
 * liegen in der schon gezeigten Gruppe, der Klick brächte keine neue Karte.
 */
import assert from 'node:assert/strict'
import type { Title } from '../shared/types.ts'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import { treibe } from '../web/src/lib/search.ts'
import { berechneHinweisGen } from '../web/src/lib/suchhinweis.ts'
import { hatKarte, zaehleKarten } from '../web/src/lib/suchhinweis-zaehlen.ts'

const titel = (id: number, name: string, franchiseId?: number, jpYear = 2000 + id): Title => ({ id, franchiseId, titleDe: name, titleEn: name, jpYear, format: 'TV' }) as unknown as Title
const keine = (): string[] => []

/* Reihe 100 (Attack): zwei Staffeln mit Synchro gezeigt, drei ohne. Reihe 200 (Ippo): nur ohne Synchro, ein Titel heißt wie die Suche. Reihe 300 ohne franchiseId. */
const gezeigt = [titel(1, 'Attack on Titan', 100), titel(2, 'Attack on Titan Season 2', 100), titel(11, 'Attack on Titan Season 3 Part 1', 100)]
const attackOhne = [titel(3, 'Attack on Titan Season 3', 100), titel(4, 'Attack on Titan OVA', 100), titel(5, 'Attack on Titan Junior High', 100)]
const ippoOhne = [titel(6, 'Hajime no Ippo', 200), titel(7, 'Hajime no Ippo Rising', 200)]
const einzeln = titel(8, 'Hajime no Ippo Special')

// Ungruppiert zählt jeder Titel, gruppiert nur die Gruppe ohne Karte.
assert.deepEqual(zaehleKarten(attackOhne, gezeigt, false, 'Attack on Titan', keine), { gesamt: 3, genau: 0 }, 'ungruppiert: 3 Titel')
assert.deepEqual(zaehleKarten(attackOhne, gezeigt, true, 'Attack on Titan', keine), { gesamt: 0, genau: 0 }, 'gruppiert: alle in der gezeigten Gruppe, keine neue Karte')
assert.deepEqual(zaehleKarten([...attackOhne, ...ippoOhne], gezeigt, true, 'Hajime no Ippo', keine), { gesamt: 1, genau: 1 }, 'gruppiert: genau eine neue Gruppe, mit exaktem Namen')
assert.deepEqual(zaehleKarten([...attackOhne, ...ippoOhne], gezeigt, false, 'Hajime no Ippo', keine), { gesamt: 5, genau: 1 }, 'ungruppiert: fünf Titel')
// Eine Gruppe, die erst durch die Treffer entsteht, zählt einmal (zwei Titel, ein Hinweis); ein Titel ohne franchiseId ist seine eigene Gruppe.
assert.deepEqual(zaehleKarten([...ippoOhne, einzeln], [], true, 'x', keine), { gesamt: 2, genau: 0 }, 'gruppiert: Reihe 200 und der Einzelne')
// Genau 1 neue Karte: der Hinweis bleibt (Schwelle > 0, nicht > 1).
assert.equal(zaehleKarten([einzeln], gezeigt, true, 'x', keine).gesamt, 1, 'eine neue Karte zählt')
// Der Name kann auch ein Synonym sein; „exakt“ zählt je Karte einmal.
assert.deepEqual(zaehleKarten([titel(9, 'Anderer Name', 500), titel(10, 'Noch einer', 500)], [], true, 'Alias', (id) => (id === 10 ? ['Alias'] : [])), { gesamt: 1, genau: 1 }, 'Synonym eines Mitglieds')
assert.deepEqual(zaehleKarten([], gezeigt, true, 'x', keine), { gesamt: 0, genau: 0 }, 'ohne Treffer 0')

// hatKarte: gruppiert genügt ein anderes Glied der Reihe, ungruppiert nur der Titel selbst.
assert.equal(hatKarte(attackOhne[0], gezeigt, true), true, 'gruppiert: Schwester gezeigt')
assert.equal(hatKarte(attackOhne[0], gezeigt, false), false, 'ungruppiert: Schwester zählt nicht')
assert.equal(hatKarte(ippoOhne[0], gezeigt, true), false, 'gruppiert: fremde Reihe')
assert.equal(hatKarte(gezeigt[0], gezeigt, false), true, 'ungruppiert: der Titel selbst')

// Ganzer Ablauf mit beiden Stellungen des Schalters „Staffeln zusammenfassen“.
const mit = [...gezeigt, ...attackOhne, ...ippoOhne]
const ohne = gezeigt
const hinweisFuer = (suche: string, gruppiert: boolean, filters: FilterState = EMPTY_FILTERS, weitere: Title[] = []) => {
  const f = { ...filters, search: suche }
  const trifft = (t: Title, g: FilterState) => !g.years.length || g.years.includes(t.jpYear!)
  const sichtbar = ohne.filter((t) => trifft(t, f) && t.titleDe!.includes(suche))
  return treibe(
    berechneHinweisGen({
      mit: [...mit, ...weitere],
      ohne,
      sichtbar,
      suche,
      filters: f,
      ohneSynchro: false,
      gruppiert,
      synonymeFuer: keine,
      filtere: function* (liste, g) {
        return liste.filter((t) => trifft(t, g) && t.titleDe!.includes(suche))
      },
      passtZuFiltern: trifft,
    }),
  )
}
assert.equal(hinweisFuer('Attack on Titan', false).zusatz.gesamt, 3, 'Attack ungruppiert: 3')
assert.equal(hinweisFuer('Attack on Titan', true).zusatz.gesamt, 0, 'Attack gruppiert: 0')
assert.equal(hinweisFuer('Hajime no Ippo', true).zusatz.gesamt, 1, 'Ippo gruppiert: 1 Karte')
assert.equal(hinweisFuer('Hajime no Ippo', false).zusatz.gesamt, 2, 'Ippo ungruppiert: 2 Titel')
// Der exakte Treffer in einer Reihe mit Karte: gruppiert fehlt nichts, ungruppiert fehlt er hinter dem Schalter.
assert.equal(hinweisFuer('Attack on Titan Season 3', true).blockade, undefined, 'exakt, Reihe gezeigt: kein Verstecktes')
assert.equal(hinweisFuer('Attack on Titan Season 3', false).blockade?.synchro, true, 'exakt, ungruppiert: nur der Schalter fehlt')
// Zwei Titel heißen gleich: einer in der Reihe mit Karte, einer in einer neuen Reihe — gruppiert fehlt nichts (ein sichtbarer genügt).
const zwilling = titel(12, 'Attack on Titan Season 3', 400)
assert.equal(hinweisFuer('Attack on Titan Season 3', true, EMPTY_FILTERS, [zwilling]).blockade, undefined, 'Zwilling: eine der Reihen hat eine Karte')
assert.equal(hinweisFuer('Attack on Titan Season 3', false, EMPTY_FILTERS, [zwilling]).blockade?.synchro, true, 'Zwilling ungruppiert: der Schalter fehlt')
// Der exakte Treffer einer Reihe ohne Karte bleibt auch gruppiert erklärt.
assert.equal(hinweisFuer('Hajime no Ippo', true).blockade?.synchro, true, 'exakt, neue Reihe: Schalter fehlt')

console.log('suchhinweis-karten.test: ok (Karten statt Titel bei Zusammenfassung, neue Gruppe ≥ 1, Synonym, Einzelner, hatKarte, Ablauf mit beiden Schalterstellungen)')
