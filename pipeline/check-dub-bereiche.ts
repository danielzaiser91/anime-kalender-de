/**
 * Zusicherungen zum Vereinen der Folgenbereiche (`lib/dub-bereiche.ts`) bei Cartoon-Handbelegen und zu `verschmelze`
 * (`lib/dub-confirmed.ts`): Bereiche mehrerer Staffel-Meldungen bleiben erhalten, das Häkchen (`checked`) wandert mit,
 * Anime vereint ebenso (Teilmeldungen aus der Erweiterung); bei Datumsgleichstand gilt ein Nein vor einem Ja. Läuft in `check:logic`.
 */
import { nimmJa, vereinigeBereiche, type DubBereich } from './lib/dub-bereiche.ts'
import { verschmelze, type DubCheck } from './lib/dub-confirmed.ts'
import { findeKonflikte, findeVereinte } from './lib/dub-konflikt.ts'
import { findeSchrumpf } from './lib/dub-schrumpf.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const zeig = (r: DubBereich[]): string => JSON.stringify(r)
const folgen = (von: number, bis: number): number[] => Array.from({ length: bis - von + 1 }, (_, i) => von + i)
const bereich = (from: number, to: number, dub = true, checked?: number[]): DubBereich =>
  checked ? { from, to, dub, checked } : { from, to, dub }

// Zwei Staffeln: beide bleiben, aneinanderstoßende Ja-Bereiche werden einer, das Häkchen beider Meldungen bleibt.
const zwei = vereinigeBereiche([bereich(1, 13, true, folgen(1, 13))], [bereich(14, 26, true, folgen(14, 26))])
pruefe('Staffeln addieren sich zu einem Bereich', gleich(zwei, [bereich(1, 26, true, folgen(1, 26))]), zeig(zwei))

// Lücke zwischen den Meldungen bleibt Lücke (nichts gefolgert).
const luecke = vereinigeBereiche([bereich(1, 10, true, [1, 10])], [bereich(21, 30, true, [21, 30])])
pruefe('Lücke bleibt offen', gleich(luecke, [bereich(1, 10, true, [1, 10]), bereich(21, 30, true, [21, 30])]), zeig(luecke))

// Überlagerung: das spätere Urteil gilt, samt seinem Häkchen; das ältere Häkchen in der überlagerten Folge entfällt.
const ueber = vereinigeBereiche([bereich(1, 6, true, [1, 6])], [bereich(4, 9, false, [4, 9])])
pruefe('spätere Meldung überlagert, Häkchen folgt dem Urteil', gleich(ueber, [bereich(1, 3, true, [1]), bereich(4, 9, false, [4, 9])]), zeig(ueber))

// Ohne checked bleibt es ohne checked (kein leeres Feld), und Einzelbereiche ohne Alt bleiben wie sie sind.
const ohne = vereinigeBereiche(undefined, [bereich(1, 5, true)])
pruefe('ohne Meldung kein checked', gleich(ohne, [bereich(1, 5, true)]), zeig(ohne))
const nurNeu = vereinigeBereiche(undefined, [bereich(37, 49, true, folgen(37, 49))])
pruefe('ohne Alt: Bereich unverändert', gleich(nurNeu, [bereich(37, 49, true, folgen(37, 49))]), zeig(nurNeu))

// Gleiches Urteil, aber nur ein Teil gemeldet: Bereich verschmilzt, checked nennt nur die gemeldeten Folgen.
const teil = vereinigeBereiche([bereich(1, 5, true, [1, 5])], [bereich(6, 10, true)])
pruefe('gefolgerte Folgen tragen kein Häkchen', gleich(teil, [bereich(1, 10, true, [1, 5])]), zeig(teil))

// verschmelze: Cartoon (negative Kennung) und Anime vereinen die Bereiche; ein Nein gilt nur für die Folgen, die es nennt.
const eintrag = (id: number, am: string, r: DubBereich[]): DubCheck =>
  ({ anilistId: id, platform: 'netflix', url: 'https://www.netflix.com/title/1', checkedAt: am, dub: true, dubRanges: r }) as DubCheck
const cartoon = verschmelze(eintrag(-1, '2026-10-11', [bereich(1, 13, true, folgen(1, 13))]), eintrag(-1, '2026-10-12', [bereich(14, 26, true, folgen(14, 26))]))
pruefe('Cartoon: Bereiche beider Staffeln', gleich(cartoon.dubRanges, [bereich(1, 26, true, folgen(1, 26))]), zeig(cartoon.dubRanges ?? []))
const cartoonUmgekehrt = verschmelze(eintrag(-1, '2026-10-12', [bereich(14, 26, true, folgen(14, 26))]), eintrag(-1, '2026-10-11', [bereich(1, 13, true, folgen(1, 13))]))
pruefe('Cartoon: Reihenfolge der Zeilen egal', gleich(cartoonUmgekehrt.dubRanges, cartoon.dubRanges))
const anime = verschmelze(eintrag(5, '2026-10-11', [bereich(1, 155, true)]), eintrag(5, '2026-10-12', [bereich(1, 171, true, [1, 171])]))
pruefe('Anime: Obermenge der jüngeren Meldung bleibt gleich', gleich(anime.dubRanges, [bereich(1, 171, true, [1, 171])]), zeig(anime.dubRanges ?? []))
const animeTeil = verschmelze(eintrag(7, '2026-10-11', [bereich(1, 12, true, folgen(1, 12))]), eintrag(7, '2026-10-12', [bereich(13, 13, true, [13])]))
pruefe('Anime: Teilmeldung ergänzt die ältere', gleich(animeTeil.dubRanges, [bereich(1, 13, true, folgen(1, 13))]), zeig(animeTeil.dubRanges ?? []))
const animeTeilUmgekehrt = verschmelze(eintrag(7, '2026-10-12', [bereich(13, 13, true, [13])]), eintrag(7, '2026-10-11', [bereich(1, 12, true, folgen(1, 12))]))
pruefe('Anime: Reihenfolge der Zeilen egal', gleich(animeTeilUmgekehrt.dubRanges, animeTeil.dubRanges))
const animeNein = verschmelze(eintrag(7, '2026-10-11', [bereich(1, 12, true, folgen(1, 12))]), eintrag(7, '2026-10-12', [bereich(12, 12, false, [12])]))
pruefe('Anime: neueres Nein streicht nur seine Folge', gleich(animeNein.dubRanges, [bereich(1, 11, true, folgen(1, 11)), bereich(12, 12, false, [12])]), zeig(animeNein.dubRanges ?? []))
const animeUeberholt = verschmelze(eintrag(7, '2026-10-11', [bereich(1, 2, true, [1, 2]), bereich(3, 12, false, [3, 12])]), eintrag(7, '2026-10-12', [bereich(1, 4, true, folgen(1, 4))]))
pruefe('Anime: älteres Nein wird vom neueren Ja überholt, der Rest bleibt Nein', gleich(animeUeberholt.dubRanges, [bereich(1, 4, true, folgen(1, 4)), bereich(5, 12, false, [12])]), zeig(animeUeberholt.dubRanges ?? []))
const ohneKennung = verschmelze(eintrag(undefined as unknown as number, '2026-10-11', [bereich(1, 5, true)]), eintrag(undefined as unknown as number, '2026-10-12', [bereich(6, 9, true)]))
pruefe('ohne Kennung: kein Vereinen', gleich(ohneKennung.dubRanges, [bereich(6, 9, true)]), zeig(ohneKennung.dubRanges ?? []))
const verschiedeneKennung = verschmelze(eintrag(-1, '2026-10-11', [bereich(1, 5, true)]), eintrag(-2, '2026-10-12', [bereich(6, 9, true)]))
pruefe('verschiedene Kennungen: kein Vereinen', gleich(verschiedeneKennung.dubRanges, [bereich(6, 9, true)]), zeig(verschiedeneKennung.dubRanges ?? []))

// Schrumpf: Anime verliert deutsche Folgen nur noch, wenn eine jüngere Meldung sie ausdrücklich verneint.
const schrumpfPruefe = (name: string, belege: DubCheck[], erwartet: number[] | null): void => {
  const faelle = findeSchrumpf(belege)
  const ist = faelle.length ? faelle[0]!.verloren : null
  pruefe(name, gleich(ist, erwartet), JSON.stringify(faelle))
}
const mit = (id: number, am: string, r: DubBereich[], url = 'https://www.netflix.com/title/1'): DubCheck => ({
  ...eintrag(id, am, r),
  url,
})
const frueh = '2026-10-01'
const spaet = '2026-10-02'
schrumpfPruefe('kein Schrumpf: kürzerer Bereich lässt den Rest stehen', [mit(5, frueh, [bereich(1, 155)]), mit(5, spaet, [bereich(1, 100)])], null)
schrumpfPruefe('kein Schrumpf: Teilstaffel-Meldung ergänzt die erste', [mit(5, frueh, [bereich(1, 12)]), mit(5, spaet, [bereich(13, 13)])], null)
schrumpfPruefe('Schrumpf: ältere Meldung steht hinter der jüngeren in der Datei', [mit(5, spaet, [bereich(1, 10, false)]), mit(5, frueh, [bereich(1, 10)])], folgen(1, 10))
schrumpfPruefe('Schrumpf: Ja wird Nein', [mit(5, frueh, [bereich(1, 10)]), mit(5, spaet, [bereich(1, 10, false)])], folgen(1, 10))
schrumpfPruefe('kein Schrumpf: Bereich wächst', [mit(5, frueh, [bereich(1, 155)]), mit(5, spaet, [bereich(1, 171)])], null)
schrumpfPruefe('kein Schrumpf: gleicher Bereich', [mit(5, frueh, [bereich(1, 9)]), mit(5, spaet, [bereich(1, 9)])], null)
schrumpfPruefe('kein Schrumpf: andere Adresse ist ein eigener Verweis', [mit(5, frueh, [bereich(1, 12)]), mit(5, spaet, [bereich(13, 13)], 'https://www.netflix.com/title/2')], null)
schrumpfPruefe('kein Schrumpf: Cartoon vereint die Staffeln', [mit(-1, frueh, [bereich(1, 12)]), mit(-1, spaet, [bereich(13, 13)])], null)

// Gleichstand beim Datum: bei einer Folge mit Ja und Nein gilt das Nein, in jeder Reihenfolge der Zeilen; der Rest vereint sich.
const tagA = eintrag(7, '2026-10-12', [bereich(1, 48, true), bereich(49, 49, false), bereich(50, 61, true)])
const tagB = eintrag(7, '2026-10-12', [bereich(1, 3, true), bereich(4, 24, false), bereich(25, 45, true)])
const grob = (r: DubBereich[] | undefined): string => JSON.stringify((r ?? []).map(({ from, to, dub }) => [from, to, dub]))
const gleichTag = verschmelze(tagA, tagB)
pruefe('Gleichstand: Nein gewinnt, Ja-Reste bleiben', grob(gleichTag.dubRanges) === grob([bereich(1, 3, true), bereich(4, 24, false), bereich(25, 48, true), bereich(49, 49, false), bereich(50, 61, true)]), zeig(gleichTag.dubRanges ?? []))
pruefe('Gleichstand: Reihenfolge der Zeilen egal', grob(verschmelze(tagB, tagA).dubRanges) === grob(gleichTag.dubRanges))
// Gleichstand: das Häkchen bleibt, wenn beide Meldungen dasselbe Urteil nennen – egal, welche Zeile zuerst steht.
const mitHaken = eintrag(7, '2026-10-12', [bereich(1, 5, true, [1, 5])])
const ohneHaken = eintrag(7, '2026-10-12', [bereich(1, 5, true)])
pruefe('Gleichstand: Häkchen bleibt (Zeile mit Häkchen zuerst)', gleich(verschmelze(mitHaken, ohneHaken).dubRanges, [bereich(1, 5, true, [1, 5])]), zeig(verschmelze(mitHaken, ohneHaken).dubRanges ?? []))
pruefe('Gleichstand: Häkchen bleibt (Zeile mit Häkchen zuletzt)', gleich(verschmelze(ohneHaken, mitHaken).dubRanges, [bereich(1, 5, true, [1, 5])]))
const haken = verschmelze(eintrag(7, '2026-10-12', [bereich(1, 3, true, [1, 3])]), eintrag(7, '2026-10-12', [bereich(3, 6, true, [6])]))
pruefe('Gleichstand: Häkchen beider Meldungen vereint', gleich(haken.dubRanges, [bereich(1, 6, true, [1, 3, 6])]), zeig(haken.dubRanges ?? []))
const hakenNein = verschmelze(eintrag(7, '2026-10-12', [bereich(1, 5, true, [1, 5])]), eintrag(7, '2026-10-12', [bereich(3, 4, false)]))
pruefe('Gleichstand: das Nein bringt kein Häkchen des Ja mit', gleich(hakenNein.dubRanges, [bereich(1, 2, true, [1]), bereich(3, 4, false), bereich(5, 5, true, [5])]), zeig(hakenNein.dubRanges ?? []))
// Verschiedene Tage: das spätere Urteil bringt sein Häkchen mit, das ältere entfällt.
const verschTage = verschmelze(eintrag(7, '2026-10-11', [bereich(1, 5, true, [1, 5])]), eintrag(7, '2026-10-12', [bereich(1, 5, true)]))
pruefe('verschiedene Tage: Häkchen der jüngeren Meldung', gleich(verschTage.dubRanges, [bereich(1, 5, true)]), zeig(verschTage.dubRanges ?? []))
const vereinte = findeVereinte([mit(7, frueh, [bereich(1, 12)]), mit(7, spaet, [bereich(13, 13, false)]), mit(8, frueh, [bereich(1, 2)])])
pruefe('Vereinte: nur der Verweis mit zwei Meldungen, Ergebnis als Text', vereinte.length === 1 && vereinte[0]!.ergebnis === '1–12 ja, 13–13 nein', JSON.stringify(vereinte))
const konflikte = findeKonflikte([mit(7, '2026-10-12', tagA.dubRanges!), mit(7, '2026-10-12', tagB.dubRanges!)])
pruefe('Konflikt: Folge 4–24 wird gemeldet', konflikte.length === 1 && gleich(konflikte[0]!.folgen, folgen(4, 24)), JSON.stringify(konflikte))
pruefe('Konflikt: verschiedene Tage sind keiner', findeKonflikte([mit(7, frueh, tagA.dubRanges!), mit(7, spaet, tagB.dubRanges!)]).length === 0)

// nimmJa: Teilweg mit Häkchen zuerst, Reihenfolge der übrigen stabil, Eingabe unverändert.
const wege = [{ id: 'a', dub: undefined }, { id: 'b', dub: true }, { id: 'c', dub: false }, { id: 'd', dub: true }]
pruefe('nimmJa: Häkchen zuerst', nimmJa(wege).map((w) => w.id).join() === 'b,d,a,c', nimmJa(wege).map((w) => w.id).join())
pruefe('nimmJa: Eingabe bleibt unverändert', wege.map((w) => w.id).join() === 'a,b,c,d')
pruefe('nimmJa: ohne Häkchen unverändert', nimmJa([{ dub: undefined }, { dub: false }]).length === 2)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den Folgenbereichen verletzt`)
  process.exit(1)
}
console.log('check-dub-bereiche: ok')
