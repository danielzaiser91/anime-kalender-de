/**
 * Zusicherung: „Teil N" erscheint in der Reihen-Box nur, wenn dieselbe Staffel mehrere Teile hat (Daniel, 11.10.2026: „Staffel 2 Teil 2 liest sich, als gäbe es Staffel 2 Teil 1").
 * Regel: `zaehleStaffeln()` in `shared/titles.ts`. Läuft in `check:logic`.
 */
import { staffelBeschriftungen, staffelStaende } from '../shared/titles.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const REIHE = 'Ascendance of a Bookworm'
const bookworm = [
  { id: 1, name: REIHE, jpStart: '2019-10-03' },
  { id: 2, name: `${REIHE} (Teil 2)`, jpStart: '2020-04-05' },
  { id: 3, name: `${REIHE} (Teil 3)`, jpStart: '2022-04-12' },
  { id: 4, name: `${REIHE}: Adopted Daughter of an Archduke`, jpStart: '2026-04-04' },
]

console.log('\nTeil nur bei mehreren Teilen derselben Staffel:')
{
  const stand = staffelStaende(bookworm, REIHE)
  const nr = (id: number) => stand.get(id)
  pruefe('Bookworm: „(Teil 2)" und „(Teil 3)" sind Staffel 2 und 3, ohne Teil und ohne Namenszusatz', [2, 3].every((id) => nr(id)?.staffel === id && nr(id)?.teil === undefined && nr(id)?.eigenerName === false), [...stand])
  pruefe('Bookworm: ein benannter Eintrag behält seinen Namen', nr(4)?.staffel === 4 && nr(4)?.eigenerName === true, nr(4))
  const be = staffelBeschriftungen(bookworm, REIHE)
  pruefe('Bookworm: Beschriftungen „Staffel 1" bis „Staffel 3"', be.get(1) === 'Staffel 1' && be.get(2) === 'Staffel 2' && be.get(3) === 'Staffel 3', [...be])
}
{
  const mushoku = [
    { id: 1, name: 'Mushoku Tensei', jpStart: '2021-01-11' },
    { id: 2, name: 'Mushoku Tensei Staffel 2', jpStart: '2023-07-03' },
    { id: 3, name: 'Mushoku Tensei Staffel 2 - Teil 2', jpStart: '2023-10-09' },
  ]
  const be = staffelBeschriftungen(mushoku, 'Mushoku Tensei')
  pruefe('Echter Mehrteiler: Staffel 2 hat Teil 1 und Teil 2', be.get(2) === 'Staffel 2 - Teil 1' && be.get(3) === 'Staffel 2 - Teil 2', [...be])
  pruefe('Staffel ohne Teile bleibt ohne Teil', be.get(1) === 'Staffel 1', [...be])
}

{
  const hanako = [
    { id: 1, name: 'Toilet-Bound Hanako-kun', jpStart: '2020-01-09' },
    { id: 2, name: 'Mein Schulgeist Hanako: Staffel 2', jpStart: '2023-07-09' },
    { id: 3, name: 'Mein Schulgeist Hanako: Staffel 2 (Teil 2)', jpStart: '2024-01-07' },
  ]
  const be = staffelBeschriftungen(hanako, 'Toilet-Bound Hanako-kun')
  pruefe('Hanako: „Staffel 2 (Teil 2)" ist Teil 2 von Staffel 2, nicht Staffel 3', be.get(2) === 'Staffel 2 - Teil 1' && be.get(3) === 'Staffel 2 - Teil 2', [...be])
  pruefe('Hanako: Staffel 1 bleibt ohne Teil', be.get(1) === 'Staffel 1', [...be])
}

{
  /* „(Cour 2)" wird beim Eindeutschen zu „(Teil 2)", ist aber die zweite Hälfte einer Staffel — keine neue Staffel (Prüfer PR 903). */
  const faelle: [string, string, string, string][] = [
    ['Spy × Family', '2022-04-09', '2022-10-01', '2023-10-07'],
    ['NieR:Automata Ver1.1a', '2024-01-06', '2024-07-05', '2026-01-10'],
    ['Dead Mount Death Play', '2023-07-10', '2023-10-10', '2026-04-04'],
  ]
  for (const [reihe, start1, start2, start3] of faelle) {
    const teile = [
      { id: 1, name: reihe, jpStart: start1 },
      { id: 2, name: `${reihe} (Cour 2)`, jpStart: start2 },
      { id: 3, name: `${reihe} Staffel 2`, jpStart: start3 },
    ]
    const stand = staffelStaende(teile, reihe)
    const be = staffelBeschriftungen(teile, reihe)
    pruefe(`${reihe}: „(Cour 2)" ist Teil 2 der Staffel 1`, stand.get(2)?.staffel === 1 && stand.get(2)?.teil === 2 && stand.get(1)?.teil === 1, [...stand])
    pruefe(`${reihe}: erst das echte „Staffel 2" heißt Staffel 2`, be.get(3) === 'Staffel 2' && be.get(1) === 'Staffel 1 - Teil 1' && be.get(2) === 'Staffel 1 - Teil 2', [...be])
  }
}

{
  /* Split-Cour mit eigenem Namen: „Part 2" / „Teil 2" / „Cour 2" gehört zur Staffel davor, auch wenn der Reihenname nicht am Namensanfang steht. Namen wörtlich aus `franchises.json`. */
  const aot = [
    { id: 16498, name: 'Attack on Titan', jpStart: '2013-04-07' },
    { id: 20958, name: 'Attack on Titan: Staffel 2', jpStart: '2017-04-01' },
    { id: 99147, name: 'Attack on Titan: Staffel 3', jpStart: '2018-07-23' },
    { id: 104578, name: 'Attack on Titan: Staffel 3 – Teil 2', jpStart: '2019-04-29' },
    { id: 110277, name: 'Attack on Titan: Final Season', jpStart: '2020-12-07' },
    { id: 131681, name: 'Attack on Titan: Final Season Part 2', jpStart: '2022-01-10' },
  ]
  const standA = staffelStaende(aot, 'Attack on Titan')
  pruefe('Attack on Titan: „Final Season Part 2" ist Teil 2 der Staffel 4, es gibt vier Staffeln', standA.get(131681)?.staffel === 4 && standA.get(131681)?.teil === 2 && standA.get(110277)?.teil === 1 && standA.get(131681)?.von === 4, [...standA])
  pruefe('Attack on Titan: der Teil 2 behält wie sein Teil 1 den eigenen Namen (Final Season)', standA.get(131681)?.eigenerName === true && standA.get(110277)?.eigenerName === true, [...standA])
  /* Beastars: Teil 1 und Teil 2 tragen beide die Marke; römisch (Swordgai „Teil II"); gleichnamiger Eintrag zweimal in der Reihe — der jüngste zählt. */
  const beast = [
    { id: 1, name: 'Beastars', jpStart: '2019-10-10' },
    { id: 2, name: 'Beastars Staffel 2', jpStart: '2021-01-07' },
    { id: 3, name: 'Beastars Letzte Staffel – Teil 1', jpStart: '2024-12-05' },
    { id: 4, name: 'Beastars Letzte Staffel – Teil 2', jpStart: '2026-03-07' },
    { id: 5, name: 'Swordgai The Animation', jpStart: '2027-01-01' },
    { id: 6, name: 'Swordgai The Animation: Teil II', jpStart: '2027-02-01' },
  ]
  const standB = staffelStaende(beast, 'Beastars')
  pruefe('Beastars: „Letzte Staffel – Teil 2" hängt an „… – Teil 1" (Staffel 3)', standB.get(4)?.staffel === 3 && standB.get(4)?.teil === 2 && standB.get(3)?.teil === 1, [...standB])
  pruefe('Swordgai: „Teil II" (römisch) ist Teil 2', standB.get(6)?.staffel === standB.get(5)?.staffel && standB.get(6)?.teil === 2, [...standB])
  const zweimal = [
    { id: 1, name: 'Foo: Bar', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Baz', jpStart: '2021-01-01' },
    { id: 3, name: 'Foo: Bar', jpStart: '2022-01-01' },
    { id: 4, name: 'Foo: Bar Part 2', jpStart: '2023-01-01' },
  ]
  const standZ = staffelStaende(zweimal, 'Foo')
  pruefe('Foo: „Bar Part 2" hängt an dem jüngeren „Bar" (Staffel 3)', standZ.get(4)?.staffel === 3 && standZ.get(4)?.teil === 2, [...standZ])
  const dr = [
    { id: 105333, name: 'Dr. Stone', jpStart: '2019-07-05' },
    { id: 113936, name: 'Dr. Stone: Stone Wars', jpStart: '2021-01-14' },
    { id: 131518, name: 'Dr. Stone: New World', jpStart: '2023-04-06' },
    { id: 162670, name: 'Dr. Stone: New World (Cour 2)', jpStart: '2023-10-12' },
    { id: 172019, name: 'Dr. Stone: Science Future', jpStart: '2025-01-09' },
    { id: 189117, name: 'Dr. Stone: Science Future - Cour 2', jpStart: '2025-07-10' },
    { id: 199221, name: 'Dr. Stone: Science Future - Cour 3', jpStart: '2026-04-02' },
  ]
  const standD = staffelStaende(dr, 'Dr. Stone')
  const sDr = dr.map((m) => `${standD.get(m.id)?.staffel}/${standD.get(m.id)?.teil}`).join(' ')
  pruefe('Dr. Stone: Cour 2 und Cour 3 hängen an ihrer Staffel, vier Staffeln', sDr === '1/undefined 2/undefined 3/1 3/2 4/1 4/2 4/3', sDr)
  const dan = [
    { id: 129196, name: 'Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth IV', jpStart: '2022-07-21' },
    { id: 155211, name: 'Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth IV – Teil 2', jpStart: '2023-01-05' },
    { id: 170732, name: 'Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth V', jpStart: '2024-10-03' },
  ]
  const standDan = staffelStaende(dan, 'Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth')
  pruefe('Danmachi IV: „Teil 2" gehört zu IV, die nächste Staffel ist V', standDan.get(155211)?.teil === 2 && standDan.get(155211)?.staffel === standDan.get(129196)?.staffel && standDan.get(170732)?.staffel === 2, [...standDan])
  /* Wörter statt Reihenfolge: Saint Seiya und Hokuto no Ken nennen denselben Titel in anderer Wortfolge; Boruto steht hinter einem fremden Eintrag (Naruto 20th Anniversary ohne Datum). */
  const seiya = [
    { id: 1254, name: 'Saint Seiya: Knights of the Zodiac', jpStart: '1986-10-11' },
    { id: 151659, name: 'Knights of the Zodiac: Saint Seiya - Battle for Sanctuary', jpStart: '2022-07-31' },
    { id: 158988, name: 'Saint Seiya: Knights of the Zodiac - Battle for Sanctuary Part 2', jpStart: '2024-04-01' },
  ]
  const standS = staffelStaende(seiya, 'Saint Seiya: Knights of the Zodiac')
  pruefe('Saint Seiya: „Battle for Sanctuary Part 2" ist Teil 2 trotz anderer Wortfolge', standS.get(158988)?.staffel === 2 && standS.get(158988)?.teil === 2, [...standS])
  const naruto = [
    { id: 97938, name: 'Boruto: Naruto Next Generations', jpStart: '2017-04-05' },
    { id: 162561, name: 'Naruto 20th Anniversary Anime' },
    { id: 165523, name: 'BORUTO: NARUTO NEXT GENERATIONS Part 2' },
  ]
  const standN = staffelStaende(naruto, 'Naruto')
  pruefe('Boruto: Part 2 gehört zu Boruto, nicht zum Eintrag davor', standN.get(165523)?.staffel === 1 && standN.get(165523)?.teil === 2 && standN.get(162561)?.staffel === 2, [...standN])
  /* Gegenfälle: ohne gleichnamigen früheren Eintrag bleibt „Part 2" eine neue Staffel (Pucca 3 Part 2); „Staffel N" im Namen schlägt die Regel; „Part 2" mit gleichem Namen wie ein fremder Eintrag der Reihe ist Teil 2 dieses Eintrags, nicht der letzten Staffel. */
  const pucca = [
    { id: 6609, name: 'Pucca', jpStart: '2006-09-08' },
    { id: 135535, name: 'Pucca: Przepis na miłość', jpStart: '2018-12-10' },
    { id: 135536, name: 'Pucca 3 Part 2', jpStart: '2019-08-01' },
  ]
  const standP = staffelStaende(pucca, 'Pucca')
  pruefe('Pucca 3 Part 2: kein gleichnamiger früherer Eintrag, bleibt eigene Staffel 3', standP.get(135536)?.staffel === 3 && standP.get(135536)?.teil === undefined, [...standP])
  const fremd = [
    { id: 1, name: 'Foo', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Bar', jpStart: '2021-01-01' },
    { id: 3, name: 'Foo: Baz', jpStart: '2022-01-01' },
    { id: 4, name: 'Foo: Bar Part 2', jpStart: '2023-01-01' },
  ]
  const standF = staffelStaende(fremd, 'Foo')
  pruefe('Foo: „Bar Part 2" hängt an „Bar" (Staffel 2), nicht an „Baz" (Staffel 3)', standF.get(4)?.staffel === 2 && standF.get(4)?.teil === 2 && standF.get(3)?.staffel === 3, [...standF])
  /* Eine Staffelangabe gehört zum Basisnamen: „Staffel 2 Part 2" hängt an „Staffel 2" (ohne Bindestrich, das fängt die Staffelregel nicht). */
  const mitStaffel = [
    { id: 1, name: 'Foo: Bar', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Bar Staffel 2', jpStart: '2021-01-01' },
    { id: 3, name: 'Foo: Bar Staffel 2 Part 2', jpStart: '2022-01-01' },
  ]
  const standM = staffelStaende(mitStaffel, 'Foo')
  pruefe('Foo: „Bar Staffel 2 Part 2" ist Teil 2 der Staffel 2', standM.get(3)?.staffel === 2 && standM.get(3)?.teil === 2, [...standM])
  /* „Part 1" ist nie ein zweiter Teil, auch nicht bei gleichem Namen wie ein früherer Eintrag. */
  const eins = [
    { id: 1, name: 'Foo: Bar', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Bar Part 1', jpStart: '2021-01-01' },
  ]
  const standE = staffelStaende(eins, 'Foo')
  pruefe('Foo: „Bar Part 1" ist keine zweite Hälfte von „Bar" (eigene Staffel 2)', standE.get(2)?.staffel === 2 && standE.get(2)?.teil === undefined, [...standE])
}

{
  /* Lupin III.: „Part N" ist die N-te Serie, nie Teil 2 der ersten — auch wenn der Reihenname („Lupin III.") jeden Part-Namen als Anfang trägt. Namen wörtlich aus `franchises.json`. */
  const lupin = [
    { id: 1412, name: 'Lupin III.: Part 1', jpStart: '1971-10-24' },
    { id: 1425, name: 'Lupin the 3rd Part 2', jpStart: '1977-10-03' },
    { id: 1426, name: 'Lupin the Third Part 3', jpStart: '1984-03-03' },
    { id: 20906, name: 'Lupin III. Part 4', jpStart: '2015-08-29' },
    { id: 100957, name: 'Lupin the 3rd Part V', jpStart: '2018-04-04' },
    { id: 134623, name: 'Lupin III. Part 6', jpStart: '2021-10-10' },
  ]
  for (const reihe of ['Lupin III.', 'Lupin III', 'Lupin the 3rd', 'Lupin III.: Teil 1']) {
    const stand = staffelStaende(lupin, reihe)
    const gezaehlt = lupin.map((m) => `${stand.get(m.id)?.staffel}/${stand.get(m.id)?.teil}`).join(' ')
    pruefe(`Lupin (Reihenname „${reihe}"): Part 1–6 sind Staffel 1–6 ohne Teil`, gezaehlt === '1/undefined 2/undefined 3/undefined 4/undefined 5/undefined 6/undefined', gezaehlt)
  }
  const be = staffelBeschriftungen(lupin, 'Lupin III.')
  pruefe('Lupin: die Part-Namen bleiben sichtbar, keine „Staffel N"-Beschriftung', be.size === 0, [...be])
  /* Part 1 am Anfang genügt nicht: zwei Part-Namen sind eine geteilte Staffel (Grenze: mindestens drei). */
  const zwei = [
    { id: 1, name: 'Foo: Part 1', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Part 2', jpStart: '2020-07-01' },
    { id: 3, name: 'Foo: Staffel 2', jpStart: '2022-01-01' },
  ]
  const standZwei = staffelStaende(zwei, 'Foo')
  pruefe('Zwei Part-Namen sind kein Part-Reihe: Part 2 bleibt Teil 2 der Staffel 1', standZwei.get(2)?.staffel === 1 && standZwei.get(2)?.teil === 2, [...standZwei])
  /* Genau drei Part-Namen reichen; römische Zahl, Zusatz nach der Zahl und Staffelangabe zählen je für sich. */
  const drei = [
    { id: 1, name: 'Foo: Part 1', jpStart: '2020-01-01' },
    { id: 2, name: 'Foo: Part 2', jpStart: '2021-01-01' },
    { id: 3, name: 'Foo: Part 3', jpStart: '2022-01-01' },
    { id: 4, name: 'Foo: Part V', jpStart: '2022-06-01' },
    { id: 5, name: 'Foo: Part 2 Recap', jpStart: '2023-01-01' },
    { id: 6, name: 'Foo: Staffel 8 - Part 2', jpStart: '2024-01-01' },
    { id: 7, name: 'Foo: Der Neubeginn', jpStart: '2025-01-01' },
  ]
  const standD = staffelStaende(drei, 'Foo')
  const gezaehltD = drei.map((m) => `${standD.get(m.id)?.staffel}/${standD.get(m.id)?.teil}`).join(' ')
  pruefe('Foo: Part 1–3 = Staffel 1–3, „Part V" = 5, „Part 2 Recap" die nächste (6), „Staffel 8 - Part 2" = Staffel 8 wie bisher, danach 9', gezaehltD === '1/undefined 2/undefined 3/undefined 5/undefined 6/undefined 8/1 9/undefined', gezaehltD)
  /* Genau drei Part-Namen genügen (Grenze der Schwelle). */
  const genau = ['Foo: Part 1', 'Foo: Part 2', 'Foo: Part 3'].map((name, i) => ({ id: i + 1, name, jpStart: `202${i}-01-01` }))
  pruefe('Genau drei Part-Namen: Staffel 1–3', [1, 2, 3].every((id) => staffelStaende(genau, 'Foo').get(id)?.staffel === id), [...staffelStaende(genau, 'Foo')])
  /* Gegenfall: ohne „Part 1" am Anfang bleibt „Part N" die Hälfte einer Staffel (Kengan Ashura: Staffel 2 — Part.2), auch bei drei Part-Namen. */
  const kengan = [
    { id: 1, name: 'Kengan Ashura', jpStart: '2019-07-31' },
    { id: 2, name: 'Kengan Ashura: Part 2', jpStart: '2019-10-31' },
    { id: 3, name: 'Kengan Ashura: Part 3', jpStart: '2021-01-01' },
    { id: 4, name: 'Kengan Ashura: Part 4', jpStart: '2022-01-01' },
    { id: 5, name: 'Kengan Ashura: Staffel 2', jpStart: '2023-09-21' },
  ]
  const standK = staffelStaende(kengan, 'Kengan Ashura')
  pruefe('Split-Cour: ohne „Part 1" am Anfang zählt „Part 2–4" als Teil der Staffel 1', [2, 3, 4].every((id) => standK.get(id)?.staffel === 1) && standK.get(5)?.staffel === 2, [...standK])
  /* Eine belegte deutsche Staffelnummer (`staffelQuelle`) schlägt die Part-Zählung. */
  const quelle = lupin.map((m) => (m.id === 134623 ? { ...m, staffelQuelle: 9 } : m))
  pruefe('staffelQuelle schlägt „Part N"', staffelStaende(quelle, 'Lupin III.').get(134623)?.staffel === 9, [...staffelStaende(quelle, 'Lupin III.')])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
