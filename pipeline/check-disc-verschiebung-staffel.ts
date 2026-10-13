/**
 * Disc-Verschiebungen bei abweichenden Staffelnamen (13.10.2026): Anime2You nennt „Sailor Moon – Staffel 3",
 * aniSearch und unser Bestand „Sailor Moon S". Phase 08 griff nicht, die Termine von Staffel 3 bis 5 blieben
 * auf dem Stand vor der Verschiebung (Artikel 1045437, 01.09.2026). Die Fälle unten sind der Bestand vor der
 * Handkorrektur (`fix/shop-termine`) und die Tabellenzeilen dieses Artikels.
 */
import type { Release, Title } from '../shared/types.ts'
import { verschiebungenAnwenden } from './lib/disc-verschiebungen.ts'
import { reihenIndex, staffelKette } from './lib/disc-verschiebungen-staffel.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, titleDe: string, jpYear: number, extra: Partial<Title> = {}): Title =>
  ({ id, titleDe, titleEn: titleDe, jpYear, format: 'TV', episodes: 40, franchiseId: 530, ...extra }) as unknown as Title
const reihe = (titeln: Title[]) => new Map(titeln.map((t) => [t.id, t]))
const disc = (name: string, titleId: number, datum: string) =>
  ({ slug: `${name}-${datum}`, titleId, name, platform: 'disc', releaseType: 'disc', schedule: { firstEpisodeDate: datum }, sources: ['https://www.anisearch.de/a'] }) as unknown as Release
const tag = (rs: Release[], i: number) => rs[i]!.schedule.firstEpisodeDate

const artikel = [
  {
    articleUrl: 'https://www.anime2you.de/news/1045437/',
    publishedAt: '2026-09-01',
    verschiebungen: [
      { titel: 'Sailor Moon – Staffel 2 (Limited Edition im Steelbook)', alt: '2026-10-02', neu: '2026-11-06' },
      { titel: 'Sailor Moon – Staffel 3 (Limited Edition im Steelbook)', alt: '2026-11-06', neu: '2026-12-18' },
      { titel: 'Sailor Moon – Staffel 4 (Limited Edition im Steelbook)', alt: '2026-12-04', neu: '2027-01-15' },
      { titel: 'Sailor Moon – Staffel 5 (Limited Edition im Steelbook)', alt: '2027-01-15', neu: '2027-02-19' },
    ],
  },
]

{
  const sailorMoon = reihe([
    titel(530, 'Sailor Moon: Das Mädchen mit den Zauberkräften', 1992),
    titel(740, 'Sailor Moon R', 1993),
    titel(532, 'Sailor Moon S', 1994),
    titel(1239, 'Sailor Moon Super S', 1995),
    titel(996, 'Sailor Moon Sailor Stars', 1996),
    titel(531, 'Sailor Moon R Movie: Gefährliche Blumen', 1993, { format: 'MOVIE', episodes: 1 }),
  ])
  /* Bestand vor der Handkorrektur: Staffel 3 doppelt (der zweite Eintrag trug die Adresse von Super S). */
  const rs = [
    disc('Sailor Moon S', 532, '2026-11-06'),
    disc('Sailor Moon S', 532, '2026-12-04'),
    disc('Sailor Moon Super S', 1239, '2026-12-04'),
    disc('Sailor Moon Sailor Stars', 996, '2027-01-15'),
    disc('Sailor Moon R', 740, '2026-11-06'),
  ]
  const geaendert = verschiebungenAnwenden(rs, artikel, '2026-10-13', sailorMoon)
  pruefe('Staffel 3 („Sailor Moon S") folgt der Zeile „Staffel 3": 06.11. → 18.12.', tag(rs, 0) === '2026-12-18', tag(rs, 0))
  pruefe('Staffel 4 („Super S") folgt der Zeile „Staffel 4": 04.12. → 15.01.', tag(rs, 2) === '2027-01-15', tag(rs, 2))
  pruefe('Staffel 5 („Sailor Stars") folgt der Zeile „Staffel 5": 15.01. → 19.02.', tag(rs, 3) === '2027-02-19', tag(rs, 3))
  pruefe(
    'Gegenprobe: Staffel 3 am 04.12. ist der alte Tag von Staffel 4, nicht von Staffel 3 — bleibt stehen',
    tag(rs, 1) === '2026-12-04',
    tag(rs, 1),
  )
  pruefe('Staffel 2 steht schon auf dem neuen Tag der Zeile — keine Änderung', tag(rs, 4) === '2026-11-06' && geaendert.length === 3, geaendert)
  pruefe(
    'Beleg: der Artikel der Zeile ist aktuell, die aniSearch-Adresse überholt',
    rs[0]!.quellen?.find((q) => q.url.includes('1045437'))?.stand === 'aktuell' &&
      rs[0]!.quellen?.find((q) => q.url.includes('anisearch'))?.stand === 'ueberholt',
    rs[0]!.quellen,
  )

  /* Dieselbe Reihe, andere Staffel: Der Film (Format MOVIE) und ein fremder Titel mit gleichem Anfang zählen nicht. */
  const fremd = [disc('Sailor Moon R Movie', 531, '2026-11-06'), disc('Sailor Moon Crystal', 14751, '2026-11-06')]
  verschiebungenAnwenden(fremd, artikel, '2026-10-13', reihe([...sailorMoon.values(), titel(14751, 'Sailor Moon Crystal', 2014, { franchiseId: 14751 })]))
  pruefe('Ein Film der Reihe hat keine Staffelnummer — bleibt stehen', tag(fremd, 0) === '2026-11-06', tag(fremd, 0))
  pruefe('Ein Titel einer anderen Reihe bleibt stehen', tag(fremd, 1) === '2026-11-06', tag(fremd, 1))

  const anderer = [disc('Sailor Venus Staffel 3', 532, '2026-11-06')]
  verschiebungenAnwenden(anderer, artikel, '2026-10-13', sailorMoon)
  pruefe('Ein anderer Reihenname (Sailor Venus) trifft die Zeile von Sailor Moon nicht', tag(anderer, 0) === '2026-11-06', tag(anderer, 0))
}

{
  /* Mehrdeutig: Staffel 2 hat zwei Teile als eigene Einträge — „Staffel 2" meint keinen von beiden eindeutig. */
  const geteilt = reihe([
    titel(1, 'Beispiel', 2020, { franchiseId: 1 }),
    titel(2, 'Beispiel Staffel 2', 2021, { franchiseId: 1 }),
    titel(3, 'Beispiel Staffel 2 - Teil 2', 2021, { franchiseId: 1 }),
    titel(4, 'Beispiel Staffel 3', 2023, { franchiseId: 1 }),
  ])
  const a = [{ articleUrl: 'https://a2y/9', publishedAt: '2026-09-01', verschiebungen: [{ titel: 'Beispiel – Staffel 2', alt: '2026-10-02', neu: '2026-11-06' }] }]
  const rs = [disc('Beispiel (Neu)', 2, '2026-10-02'), disc('Beispiel (Neu)', 3, '2026-10-02')]
  verschiebungenAnwenden(rs, a, '2026-10-13', geteilt)
  pruefe('Staffel mit Teilen: weder Teil 1 noch Teil 2 wird verschoben', tag(rs, 0) === '2026-10-02' && tag(rs, 1) === '2026-10-02', [tag(rs, 0), tag(rs, 1)])

  /* Positionszählung und Panelzählung weichen ab (Staffel 2 hat zwei Einträge): auch die dritte Staffel ist dann nicht sicher. */
  const a3 = [
    {
      articleUrl: 'https://a2y/9',
      publishedAt: '2026-09-01',
      verschiebungen: [
        { titel: 'Beispiel – Staffel 3', alt: '2026-10-02', neu: '2026-11-06' },
        { titel: 'Beispiel – Staffel 4', alt: '2026-10-02', neu: '2026-11-13' },
      ],
    },
  ]
  const r3 = [disc('Beispiel (Neu)', 4, '2026-10-02')]
  verschiebungenAnwenden(r3, a3, '2026-10-13', geteilt)
  pruefe('Weichen die Zählweisen ab, bleibt auch die spätere Staffel stehen', tag(r3, 0) === '2026-10-02', tag(r3, 0))

  /* Eine einzige Staffel hat keine Nummer, die etwas unterscheidet. */
  const einzel = reihe([titel(5, 'Einzelwerk', 2020, { franchiseId: 5 })])
  const a1 = [{ articleUrl: 'https://a2y/9', publishedAt: '2026-09-01', verschiebungen: [{ titel: 'Einzelwerk – Staffel 1', alt: '2026-10-02', neu: '2026-11-06' }] }]
  const r1 = [disc('Einzelwerk Komplettbox', 5, '2026-10-02')]
  verschiebungenAnwenden(r1, a1, '2026-10-13', einzel)
  pruefe('Reihe mit nur einer Staffel: keine Zuordnung über die Nummer', tag(r1, 0) === '2026-10-02', tag(r1, 0))
}

/* Passen zwei Reihennamen („sailor moon", „sailor moon s"), gilt der längste — in beiden Reihenfolgen. */
{
  const reihen = reihenIndex([
    titel(530, 'Sailor Moon: Das Mädchen mit den Zauberkräften', 1992),
    titel(740, 'Sailor Moon R', 1993),
    titel(532, 'Sailor Moon S', 1994),
  ])
  const t = reihen.get(530)!.find((x) => x.id === 532)
  const kurz = ['sailor moon staffel 3', ['kurz']] as const
  const lang = ['sailor moon s staffel 3', ['lang']] as const
  for (const [art, eintraege] of [['kurz zuerst', [kurz, lang]], ['lang zuerst', [lang, kurz]]] as const) {
    const kette = staffelKette('sailor moon s komplettbox', t, new Map<string, string[]>(eintraege.map(([k, v]) => [k, [...v]])), reihen)
    pruefe(`Längster Reihenname gewinnt (${art})`, kette?.[0] === 'lang', kette)
  }
}

if (fehler) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('\nDisc-Verschiebungen über die Staffelnummer: alle Prüfungen bestanden')
