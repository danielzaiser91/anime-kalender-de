/**
 * Zusicherungen zum Vereinen der Folgenbereiche (`lib/dub-bereiche.ts`) bei Cartoon-Handbelegen und zu `verschmelze`
 * (`lib/dub-confirmed.ts`): Bereiche mehrerer Staffel-Meldungen bleiben erhalten, das Häkchen (`checked`) wandert mit,
 * Anime ersetzt weiter wortgleich. Läuft in `check:logic`.
 */
import { nimmJa, vereinigeBereiche, type DubBereich } from './lib/dub-bereiche.ts'
import { verschmelze, type DubCheck } from './lib/dub-confirmed.ts'

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

// verschmelze: Cartoon (negative Kennung) vereint die Bereiche, Anime ersetzt sie wie bisher.
const eintrag = (id: number, am: string, r: DubBereich[]): DubCheck =>
  ({ anilistId: id, platform: 'netflix', url: 'https://www.netflix.com/title/1', checkedAt: am, dub: true, dubRanges: r }) as DubCheck
const cartoon = verschmelze(eintrag(-1, '2026-10-11', [bereich(1, 13, true, folgen(1, 13))]), eintrag(-1, '2026-10-12', [bereich(14, 26, true, folgen(14, 26))]))
pruefe('Cartoon: Bereiche beider Staffeln', gleich(cartoon.dubRanges, [bereich(1, 26, true, folgen(1, 26))]), zeig(cartoon.dubRanges ?? []))
const cartoonUmgekehrt = verschmelze(eintrag(-1, '2026-10-12', [bereich(14, 26, true, folgen(14, 26))]), eintrag(-1, '2026-10-11', [bereich(1, 13, true, folgen(1, 13))]))
pruefe('Cartoon: Reihenfolge der Zeilen egal', gleich(cartoonUmgekehrt.dubRanges, cartoon.dubRanges))
const anime = verschmelze(eintrag(5, '2026-10-11', [bereich(1, 155, true)]), eintrag(5, '2026-10-12', [bereich(1, 171, true, [1, 171])]))
pruefe('Anime: jüngste Meldung ersetzt wortgleich', gleich(anime.dubRanges, [bereich(1, 171, true, [1, 171])]), zeig(anime.dubRanges ?? []))
const ohneKennung = verschmelze(eintrag(undefined as unknown as number, '2026-10-11', [bereich(1, 5, true)]), eintrag(undefined as unknown as number, '2026-10-12', [bereich(6, 9, true)]))
pruefe('ohne Kennung: kein Vereinen', gleich(ohneKennung.dubRanges, [bereich(6, 9, true)]), zeig(ohneKennung.dubRanges ?? []))
const verschiedeneKennung = verschmelze(eintrag(-1, '2026-10-11', [bereich(1, 5, true)]), eintrag(-2, '2026-10-12', [bereich(6, 9, true)]))
pruefe('verschiedene Kennungen: kein Vereinen', gleich(verschiedeneKennung.dubRanges, [bereich(6, 9, true)]), zeig(verschiedeneKennung.dubRanges ?? []))

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
