/**
 * Zusicherung: Ergeben die aniSearch-Seiten einer MAL-Kennung zusammen genau die Folgen des einen AniList-Titels entfällt der Sammeltitel, mit oder ohne Deutsch
 * (Durarara!! Specials, Angel Beats! Tokubetsu-hen, Pokémon XY&Z-Special; 13.10.2026). Regel: `bau/mal-teilung.ts`, Bedingung: `lib/mal-teilung.ts`,
 * Messung: `tools/anisearch-mal-mehrfach.mjs`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-mal-teilung.ts`
 */
import { baueTitel } from './bau/02-titel.ts'
import { alle, ergaenzeAnisearchTitel, traegerJeSeite, vergebeneSeiten } from './bau/anisearch-titel.ts'
import { aufgegangeneSammeltitel, entferneSammeltitel, freizugebendeSeiten, katalogSammeltitel, type TeilungsQuellen } from './bau/mal-teilung.ts'
import { anisearchDublettenAbziehen } from './bau/nebendateien.ts'
import { handKennungen } from './lib/hand-kennungen.ts'
import type { AniListMedia } from './lib/anilist.ts'
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
  const traegtSammeltitel = (id: number, sammelId: number) => id !== BASIS + 6984 || sammelId === 8408
  pruefe('Seite ohne Zeile, die der Sammeltitel selbst trägt: Teilung (hatZeile bekommt seine Kennung)', findeTeilungen(anilist, eintraege, traegtSammeltitel).get(8408)?.join() === '6984,6986')
  pruefe('Gegenprobe: trägt ein anderer Titel die Seite, bleibt der Sammeltitel', !findeTeilungen(anilist, eintraege, (id, sammelId) => id !== BASIS + 6984 || sammelId === 999).has(8408))
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

console.log('\nBau: die Seite, die der Sammeltitel selbst trägt, bekommt eine Zeile:')
{
  const titles = new Map<number, Title>([[8408, { id: 8408, malId: 8408, episodes: 2 } as Title]])
  const quellen = (hand: number[] = [], eintraege: TeilungsQuellen['eintraege'] = durarara()): TeilungsQuellen => ({ hand: new Set(hand), eintraege, katalog: [] })
  const frei = (traeger: [number, number[]][], vergeben = [6984], q = quellen()) => [...freizugebendeSeiten(titles, q, new Set(vergeben), new Map(traeger))].join()
  pruefe('8408 trägt 6984: nur diese Seite wird freigegeben, 6986 hat schon eine Zeile', frei([[6984, [8408]]]) === '6984')
  pruefe('auch ein Sammeltitel nur im Katalog gibt seine Seite frei', [...freizugebendeSeiten(new Map(), { ...quellen(), katalog: [{ id: 8408, malId: 8408, episodes: 2 }] }, new Set([6984]), new Map([[6984, [8408]]]))].join() === '6984')
  pruefe('Gegenprobe: trägt ein anderer Titel die Seite, bleibt sie dessen Eintrag', frei([[6984, [777]]]) === '')
  pruefe('Gegenprobe: tragen 8408 und ein zweiter Titel die Seite, bleibt sie', frei([[6984, [8408, 777]]]) === '')
  pruefe('Gegenprobe: nennt eine Handdatei 8408, bleibt er mit der Seite', frei([[6984, [8408]]], [6984], quellen([8408])) === '')
  pruefe('Gegenprobe: hat die andere Seite keine Zeile (ein anderer Titel trägt sie), bleibt der Sammeltitel', frei([[6984, [8408]], [6986, [777]]], [6984, 6986]) === '')
  pruefe('Gegenprobe: passt die Summe nicht, wird nichts freigegeben', frei([[6984, [8408]]], [6984], quellen([], { 6984: seite(8408, 1, '-'), 6986: seite(8408, 2, '-') })) === '')
  pruefe('Gegenprobe: eine Seite mit Zeile braucht keine Freigabe', frei([[6984, [8408]]], []) === '')
}

console.log('\nAnlegen und Bau mit echten Daten: die getragene Seite steht als Zeile da, der Sammeltitel entfällt:')
{
  const eintraege = alle()
  const vergeben = vergebeneSeiten(new Map())
  const traeger = traegerJeSeite()
  /* Echte Daten: rund 40 Seiten haben mehrere Träger (14.10.2026); zählte nur der letzte, gäbe die Teilung Seiten frei, die ein anderer Titel noch trägt. */
  pruefe('traegerJeSeite: eine Seite mit mehreren Trägern führt alle', [...traeger.values()].some((t) => t.length >= 2))
  const hand = handKennungen()
  const seitenJeMal = new Map<number, number[]>()
  for (const [asId, e] of Object.entries(eintraege)) if (e.mal) seitenJeMal.set(e.mal, [...(seitenJeMal.get(e.mal) ?? []), Number(asId)])
  /* Ein echter Fall: der Sammeltitel ist der einzige Träger genau einer seiner Seiten, alle Seiten haben eine Folgenzahl. */
  const fall = [...seitenJeMal].find(([, seiten]) => {
    const getragen = seiten.filter((asId) => vergeben.has(asId))
    return seiten.length >= 2 && seiten.every((asId) => eintraege[String(asId)]!.f) && getragen.length === 1 && traeger.get(getragen[0]!)?.length === 1 && !hand.has(traeger.get(getragen[0]!)![0]!)
  })
  pruefe('die Daten enthalten einen solchen Fall', fall !== undefined)
  if (fall) {
    const [mal, seiten] = fall
    const getragen = seiten.find((asId) => vergeben.has(asId))!
    const sammelId = traeger.get(getragen)![0]!
    const folgen = seiten.reduce((summe, asId) => summe + eintraege[String(asId)]!.f!, 0)
    const zeilen = (frei: number[]) => {
      const t = new Map<number, Title>()
      ergaenzeAnisearchTitel(t, new Map(), new Map(), new Set(frei))
      return t
    }
    pruefe('ohne Freigabe fehlt die getragene Seite', !zeilen([]).has(BASIS + getragen))
    pruefe('mit Freigabe steht sie da', zeilen([getragen]).has(BASIS + getragen))
    const bau = (episodes: number) => baueTitel({ byMal: {}, confidenceRaw: {}, byAniId: { [sammelId]: { id: sammelId, idMal: mal, episodes, title: {} } as AniListMedia } }).titles
    const geteilt = bau(folgen)
    pruefe('baueTitel: der Sammeltitel entfällt, jede Seite hat eine Zeile', !geteilt.has(sammelId) && seiten.every((asId) => geteilt.has(BASIS + asId)), [sammelId, getragen])
    const zusammen = bau(folgen + 1)
    pruefe('Gegenprobe: passt die Summe nicht, bleibt der Titel und die Seite hat keine Zeile', zusammen.has(sammelId) && !zusammen.has(BASIS + getragen))
  }
}

console.log('\nKatalog: der Sammeltitel weicht vor der Kennungsregel, sonst nähme sie die Zeile der getragenen Seite:')
{
  const asId = Number(Object.keys(alle()).find((k) => alle()[k]!.dub === '-' && !(k in MAL_AUSNAHMEN)))
  const zeile = BASIS + asId
  const sammelId = 424242
  const katalog = [{ id: sammelId, format: 'OVA', jahr: 2000, folgen: 2 }] as never
  const ziehe = (sammeltitel: Parameters<typeof anisearchDublettenAbziehen>[5]) => anisearchDublettenAbziehen(new Map(), [{ id: zeile }] as Title[], new Set(), katalog, new Map([[sammelId, asId]]), sammeltitel)
  /* Die Attrappe gibt den Sammeltitel nur her, wenn die Zeile als vorhanden gemeldet wird. */
  const mit = ziehe((steht) => (steht(zeile) ? new Map([[sammelId, zeile]]) : new Map()))
  pruefe('Teilung greift: der Sammeltitel weicht, die Zeile der getragenen Seite bleibt', mit.katalogWeg.get(sammelId) === zeile && !mit.zeilenWeg.has(zeile), [...mit.zeilenWeg])
  const ohne = ziehe(() => new Map())
  pruefe('Gegenprobe: ohne Teilung weicht die Zeile dem Katalogtitel, der ihre Kennung trägt', ohne.zeilenWeg.get(zeile) === sammelId && !ohne.katalogWeg.has(sammelId))
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
