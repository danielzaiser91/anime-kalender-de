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
    pruefe(`${reihe}: „(Cour 2)" behält den eigenen Namen`, stand.get(2)?.eigenerName === true && !be.has(2), [...stand])
    pruefe(`${reihe}: erst das echte „Staffel 2" heißt Staffel 2`, be.get(3) === 'Staffel 2' && be.get(1) === 'Staffel 1', [...be])
  }
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
  /* Gegenfall: ohne „Part 1" am Anfang bleibt „Part N" die Hälfte einer Staffel (Kengan Ashura: Staffel 2 — Part.2). */
  const kengan = [
    { id: 1, name: 'Kengan Ashura', jpStart: '2019-07-31' },
    { id: 2, name: 'Kengan Ashura: Part 2', jpStart: '2019-10-31' },
    { id: 3, name: 'Kengan Ashura: Part 3', jpStart: '2021-01-01' },
    { id: 4, name: 'Kengan Ashura: Staffel 2', jpStart: '2023-09-21' },
  ]
  const standK = staffelStaende(kengan, 'Kengan Ashura')
  pruefe('Split-Cour: ohne „Part 1" am Anfang zählt „Part 2/3" als Teil der Staffel 1', standK.get(2)?.staffel === 1 && standK.get(3)?.staffel === 1 && standK.get(4)?.staffel === 2, [...standK])
  /* Eine belegte deutsche Staffelnummer (`staffelQuelle`) schlägt die Part-Zählung. */
  const quelle = lupin.map((m) => (m.id === 134623 ? { ...m, staffelQuelle: 9 } : m))
  pruefe('staffelQuelle schlägt „Part N"', staffelStaende(quelle, 'Lupin III.').get(134623)?.staffel === 9, [...staffelStaende(quelle, 'Lupin III.')])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
