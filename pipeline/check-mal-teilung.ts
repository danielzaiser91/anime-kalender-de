/**
 * Zusicherung: Ergeben die aniSearch-Seiten einer MAL-Kennung zusammen genau die Folgen des einen AniList-Titels entfällt der Sammeltitel, mit oder ohne Deutsch
 * (Durarara!! Specials, Angel Beats! Tokubetsu-hen, Pokémon XY&Z-Special; 13.10.2026). Regel: `bau/mal-teilung.ts`, Bedingung: `lib/mal-teilung.ts`,
 * Messung: `tools/anisearch-mal-mehrfach.mjs`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-mal-teilung.ts`
 */
import { aufgegangeneSammeltitel, entferneSammeltitel, katalogSammeltitel, type TeilungsQuellen } from './bau/mal-teilung.ts'
import { MAL_AUSNAHMEN, MAL_UEBERGANG, malDubletten } from './lib/mal-dubletten.ts'
import { ergebenSichZusammen, findeTeilungen } from './lib/mal-teilung.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const BASIS = 10_000_000
/** Eine aniSearch-Seite zu einer MAL-Kennung; `dub: '-'` heißt kein Deutsch. */
const seite = (mal: number, f: number, dub = 'd') => ({ mal, f, dub })
/** Durarara-Muster: zwei Seiten zu je einer Folge unter der MAL 8408. */
const durarara = () => ({ 6984: seite(8408, 1), 6986: seite(8408, 1) })

console.log('\nBedingung der vollständigen Teilung:')
{
  pruefe('1 + 1 gegen 2 Folgen: Teilung', ergebenSichZusammen([1, 1], [2]))
  pruefe('1 + 1 gegen 3 Folgen: keine Teilung', !ergebenSichZusammen([1, 1], [3]))
  pruefe('zwei AniList-Titel mit der MAL: keine Teilung, auch wenn die Summe einem passt', !ergebenSichZusammen([1, 1], [2, 2]) && !ergebenSichZusammen([1, 1], []))
  pruefe('einer Seite fehlt die Folgenzahl: keine Teilung', !ergebenSichZusammen([2, undefined], [2]))
  pruefe('eine einzelne Seite ist keine Teilung', !ergebenSichZusammen([2], [2]))
  pruefe('Folgenzahl des Titels unbekannt: keine Teilung', !ergebenSichZusammen([1, 1], [null]))
}

console.log('\nWelche Titel teilt aniSearch:')
{
  const eintraege = {
    ...durarara(),
    20: seite(5, 1),
    21: seite(5, 1),
    30: seite(6, 2),
    31: seite(6, 2),
    40: seite(7, 1, '-'),
    41: seite(7, 1, '-'),
    42: seite(7, 1, 'p'),
  }
  const anilist = [
    { id: 8408, malId: 8408, episodes: 2 },
    { id: 5, malId: 5, episodes: 2 },
    { id: 6, malId: 6, episodes: 4 },
    { id: 7, malId: 7, episodes: 3 },
  ]
  const alleZeilen = () => true
  const t = findeTeilungen(anilist, eintraege, alleZeilen)
  pruefe('Durarara-Muster (1 + 1 = 2): 8408 wird von 6984 und 6986 geteilt', t.get(8408)?.join() === '6984,6986', [...t])
  pruefe('MAL 5: 1 + 1 = 2 teilt ebenfalls, MAL 6: 2 + 2 = 4 auch', t.get(5)?.join() === '20,21' && t.get(6)?.join() === '30,31')
  pruefe('Gegenprobe: ein Titel mit 3 Folgen wird nicht geteilt', !findeTeilungen([{ id: 5, malId: 5, episodes: 3 }], eintraege, alleZeilen).has(5))
  pruefe('Gegenprobe: eine Seite ohne Zeile (ein AniList-Titel trägt sie) verhindert die Teilung', !findeTeilungen(anilist, eintraege, (id) => id !== BASIS + 6984).has(8408))
  pruefe('Gegenprobe: ein zweiter AniList-Titel im Katalog mit derselben MAL verhindert die Teilung', !findeTeilungen([...anilist, { id: 999, malId: 8408, episodes: 2 }], eintraege, alleZeilen).has(8408))
  pruefe('Teilung ganz ohne Deutsch (Katalog hinter dem Schalter): wird ebenfalls geteilt', findeTeilungen(anilist.slice(3), { 40: seite(7, 1, '-'), 41: seite(7, 2, '-') }, alleZeilen).get(7)?.join() === '40,41')
  pruefe('Deutsch ändert nichts: eine Seite mit geplantem Deutsch (p) teilt genauso', findeTeilungen(anilist.slice(3), { 40: seite(7, 1, '-'), 42: seite(7, 2, 'p') }, alleZeilen).get(7)?.join() === '40,42')
  pruefe('Gegenprobe ohne Deutsch: passt die Summe nicht (1 + 1 gegen 3 Folgen), bleibt der Sammeltitel', !findeTeilungen(anilist.slice(3), { 40: seite(7, 1, '-'), 41: seite(7, 1, '-') }, alleZeilen).has(7))
  pruefe('Gegenprobe ohne Deutsch: fehlt einer Seite die Zeile, bleibt der Sammeltitel', !findeTeilungen(anilist.slice(3), { 40: seite(7, 1, '-'), 41: seite(7, 2, '-') }, (id) => id !== BASIS + 41).has(7))
}

console.log('\nBau: der Sammeltitel entfällt, mit Handbeleg bleibt er:')
{
  const titel = (id: number, malId: number | undefined, episodes: number) => ({ id, malId, episodes }) as Title
  const bauen = (hand: number[], katalog: TeilungsQuellen['katalog'] = [], eintraege: TeilungsQuellen['eintraege'] = durarara()) => {
    const titles = new Map<number, Title>([
      [8408, titel(8408, 8408, 2)],
      [BASIS + 6984, titel(BASIS + 6984, undefined, 1)],
      [BASIS + 6986, titel(BASIS + 6986, undefined, 1)],
      [6746, titel(6746, 6746, 2)],
    ])
    const jpStart = new Map([[8408, '2010-08-25']])
    const entfallen = entferneSammeltitel(titles, jpStart, new Map(jpStart), { hand: new Set(hand), eintraege, katalog })
    return { titles, jpStart, entfallen }
  }
  const ohneBeleg = bauen([])
  pruefe('ohne Handbeleg entfällt 8408, die beiden Seiten und eine fremde Serie bleiben', ohneBeleg.entfallen === 1 && !ohneBeleg.titles.has(8408) && ohneBeleg.titles.has(BASIS + 6984) && ohneBeleg.titles.has(BASIS + 6986) && ohneBeleg.titles.has(6746))
  pruefe('sein Startdatum geht mit', !ohneBeleg.jpStart.has(8408))
  const mitBeleg = bauen([8408])
  pruefe('Gegenprobe: nennt eine Handdatei 8408, bleibt er stehen', mitBeleg.entfallen === 0 && mitBeleg.titles.has(8408))
  const mitKatalog = bauen([], [{ id: 77, malId: 8408, episodes: 2 }])
  pruefe('Gegenprobe: ein zweiter Titel mit der MAL im Katalog (nicht im Hauptbestand): nichts entfällt', mitKatalog.entfallen === 0)
  const ohneDeutsch = bauen([], [], { 6984: seite(8408, 1, '-'), 6986: seite(8408, 1, '-') })
  pruefe('auch ohne jedes Deutsch entfällt 8408 im Hauptbestand', ohneDeutsch.entfallen === 1 && !ohneDeutsch.titles.has(8408) && ohneDeutsch.titles.has(BASIS + 6984))
  const imKatalog = bauen([], [{ id: 8408, malId: 8408, episodes: 2 }])
  pruefe('derselbe Titel im Katalog und im Hauptbestand zählt einmal', imKatalog.entfallen === 1)
}

console.log('\nKatalog hinter dem Schalter: der entfernte Sammeltitel kommt dort nicht wieder an:')
{
  const quellen = (hand: number[] = [], eintraege: TeilungsQuellen['eintraege'] = durarara()): TeilungsQuellen => ({ hand: new Set(hand), eintraege, katalog: [{ id: 8408, malId: 8408, episodes: 2 }] })
  const seiten = new Set([BASIS + 6984, BASIS + 6986])
  pruefe('8408 entfällt im Katalog, solange beide Seiten Zeilen haben', katalogSammeltitel((id) => seiten.has(id), quellen()).get(8408) === BASIS + 6984)
  pruefe('auch ohne jedes Deutsch entfällt er im Katalog', katalogSammeltitel((id) => seiten.has(id), quellen([], { 6984: seite(8408, 1, '-'), 6986: seite(8408, 1, '-') })).get(8408) === BASIS + 6984)
  pruefe('Gegenprobe: ohne Seitenzeilen bleibt er', katalogSammeltitel(() => false, quellen()).size === 0)
  pruefe('Gegenprobe: eine Handdatei hält ihn', katalogSammeltitel((id) => seiten.has(id), quellen([8408])).size === 0)
}

console.log('\nVerlust-Riegel: ein aufgegangener Sammeltitel ist kein Verlust:')
{
  const vorher = [{ id: 8408, malId: 8408, episodes: 2 }, { id: 6746, malId: 6746, episodes: 24 }]
  const quellen = (hand: number[] = []): TeilungsQuellen => ({ hand: new Set(hand), eintraege: durarara(), katalog: [] })
  const seiten = new Set([BASIS + 6984, BASIS + 6986, 6746])
  pruefe('8408 fehlt, beide Seiten stehen in der Ausgabe: aufgegangen', aufgegangeneSammeltitel(seiten, new Set(), vorher, quellen()).join() === '8408')
  pruefe('eine Seite steht hinter dem Schalter: ebenfalls aufgegangen', aufgegangeneSammeltitel(new Set([BASIS + 6984, 6746]), new Set([BASIS + 6986]), vorher, quellen()).join() === '8408')
  pruefe('Gegenprobe: fehlt eine Seite ganz, zählt 8408 als verloren', aufgegangeneSammeltitel(new Set([BASIS + 6984, 6746]), new Set(), vorher, quellen()).length === 0)
  pruefe('Gegenprobe: nennt eine Handdatei 8408, zählt er als verloren', aufgegangeneSammeltitel(seiten, new Set(), vorher, quellen([8408])).length === 0)
  pruefe('Gegenprobe: steht 8408 noch in der Ausgabe, ist nichts aufgegangen', aufgegangeneSammeltitel(new Set([...seiten, 8408]), new Set(), vorher, quellen()).length === 0)
}

console.log('\nMAL_AUSNAHMEN und Übergang:')
{
  pruefe('die vier Seiten aus der Teilung stehen nicht mehr in MAL_AUSNAHMEN, die übrigen begründeten Teile schon', [6864, 6984, 6986, 11938].every((id) => !(id in MAL_AUSNAHMEN)) && 3873 in MAL_AUSNAHMEN)
  const eintraege = { 6984: { mal: 8408 } }
  const nochDa = [{ id: 8408, malId: 8408 }, { id: BASIS + 6984 }]
  pruefe('Frist: bis 16.10.2026 darf der Sammeltitel neben der Seite stehen, danach meldet die Prüfung ihn', MAL_UEBERGANG[6984] === '2026-10-16' && malDubletten(nochDa, eintraege, '2026-10-16').length === 0 && malDubletten(nochDa, eintraege, '2026-10-17').length === 1)
  pruefe('ist der Sammeltitel weg, meldet die Prüfung nichts mehr', malDubletten([{ id: BASIS + 6984 }], eintraege, '2026-10-17').length === 0)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
