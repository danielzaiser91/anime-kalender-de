/**
 * Sammelartikel-Zeile → Titel im Bestand (`lib/sammel-titel.ts`): Die Zeilen sind die wörtlichen aus `nicht-zugeordnet.json`
 * (Bau 04.11.2026), die Titelnamen die wörtlichen aus `public/data/titles.json`, nur die Kennungen sind erfunden (ab 900000).
 * Gegenfälle: ähnliche, aber verschiedene Titel bleiben getrennt (M.A.S.K./Mask Danshi, Zorro-Film/Zorro-Serie, Steel Ball Run).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { Vorschlag } from './lib/meldungen.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'sammel-titel-'))
process.env.AK_ROOT = wurzel

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, titleDe: string | undefined, titleEn: string | undefined, format: string, jpYear: number): Title =>
  ({ id, franchiseId: id, titleDe, titleEn, titleRomaji: titleEn, format, jpYear }) as unknown as Title

const KATALOG: Title[] = [
  titel(900001, undefined, 'K: Seven Stories Movie 1 - R:B - Blaze', 'MOVIE', 2018),
  titel(900002, undefined, 'K: Seven Stories Movie 2 - Side:Blue - Like Sirius', 'MOVIE', 2018),
  titel(900003, undefined, 'Eureka Seven: The Movie', 'MOVIE', 2009),
  titel(900004, undefined, 'Trinity Seven Movie - Yuukyuu Toshokan to Renkinjutsu Shoujo', 'MOVIE', 2017),
  titel(900010, 'Girls & Panzer: This Is the Real Anzio Battle!', 'Girls und Panzer: This is the Real Anzio Battle!', 'OVA', 2014),
  titel(900011, 'Cyberpunk: Edgerunners', 'Cyberpunk: Edgerunners', 'ONA', 2022),
  titel(900012, 'Cyberpunk: Edgerunners 2', 'Cyberpunk: Edgerunners 2', 'ONA', 2026),
  titel(900020, 'Love and Lies', 'LOVE and LIES', 'TV', 2017),
  titel(900030, 'Mask Danshi: This Shouldn’t Lead to Love', undefined, 'OVA', 2023),
  titel(900040, 'Z wie Zorro', 'The Legend of Zorro', 'TV', 1996),
  titel(900050, undefined, 'Steel Ball Run: Jojo’s Bizarre Adventure - Phase 1', 'ONA', 2026),
  titel(900051, undefined, 'Steel Ball Run: Jojo’s Bizarre Adventure - Phase 2-3', 'ONA', 2026),
  titel(900060, undefined, 'Yandere Dark Elf: She Chased Me All the Way from Another World!', 'TV_SHORT', 2025),
  titel(900070, 'Clannad: Der Film', 'Clannad: The Motion Picture', 'MOVIE', 2007),
  titel(900071, 'Clannad', 'Clannad', 'TV', 2007),
  titel(900080, 'Beispiel Serie: Season Zero', undefined, 'TV', 2026),
  titel(900081, 'Zwillingsserie: Der Anfang', undefined, 'TV', 2026),
  titel(900082, 'Zwillingsserie: Der Rest', undefined, 'TV', 2026),
  titel(900083, 'Kinoserie Special: Der Film', undefined, 'MOVIE', 2026),
  titel(900084, 'Doppel Werk: Der Beginn', undefined, 'TV', 2026),
  titel(900085, 'Doppel Werk: Part 2', undefined, 'TV', 2026),
  titel(900086, 'Mondschein: Das Abenteuer', undefined, 'TV', 2026),
  titel(900088, 'Hero’s Journey', undefined, 'TV', 2026),
  titel(900089, 'Pokémon Horizons', undefined, 'TV', 2023),
  titel(900090, 'Air', undefined, 'TV', 2005),
  titel(900091, 'Gate', undefined, 'TV', 2015),
  titel(900092, 'Gleicher Name', undefined, 'TV', 2020),
  titel(900093, 'Gleicher Name', undefined, 'TV', 2024),
  titel(900095, 'Gleicher Name: Sonderfolge', undefined, 'OVA', 2025),
  titel(900096, 'Ox A', undefined, 'TV', 2012),
  titel(900097, 'Wizard’s Tale: Der Beginn', undefined, 'TV', 2026),
  { ...titel(900098, undefined, undefined, 'TV', 2026), titleRomaji: 'Kimi no Namae' },
  titel(900094, 'Dein Name', undefined, 'MOVIE', 2016),
]
/** Wörtlich aus `public/data/synonyme.json`. */
const SYNONYME = new Map<number, string[]>([
  [900010, ['Girls und Panzer OVA', 'Girls und Panzer OVA: This Is the Real Anzio Battle!']],
  [900012, ['Cyberpunk: Edgerunners II']],
  [900040, ['The Magnificent Zorro', 'Zorro']],
])

const zeile = (name: string, zusatz?: string, anbieter = 'joyn'): Vorschlag => ({
  articleTitle: `»${name}«${zusatz ? ` – ${zusatz}` : ''}`,
  articleUrl: 'https://www.anime2you.de/news/1066831/joyn-25-anime-neuzugaenge/',
  publishedAt: '2026-11-03',
  category: 'streaming',
  platforms: [anbieter],
  dates: [{ iso: '2026-11-03', context: 'Sammelartikel' }],
  dub: 'zugesagt',
  woechentlich: false,
})

async function main(): Promise<void> {
  await pruefeNamen()
  await pruefeGleicherName()
  await pruefeTermine()
  await pruefeBau()
}

async function pruefeNamen(): Promise<void> {
  const { sammelTitel } = await import('./lib/sammel-titel.ts')
  const id = (name: string, zusatz?: string) => sammelTitel(zeile(name, zusatz).articleTitle, KATALOG, SYNONYME)?.id

  // Klasse 1: anderer Name desselben Titels (Synonym, „&“ gegen „und“).
  pruefe('Synonym: „Cyberpunk: Edgerunners II“ → „… 2“', id('Cyberpunk: Edgerunners II') === 900012, id('Cyberpunk: Edgerunners II'))
  pruefe('Synonym: „Girls und Panzer OVA – This is the Real Anzio Battle!“', id('Girls und Panzer OVA – This is the Real Anzio Battle!') === 900010)
  pruefe('„&“ gegen „and“: „Love & Lies“ → „Love and Lies“', id('Love & Lies') === 900020, id('Love & Lies'))
  pruefe('ohne Synonymliste findet „Edgerunners II“ nichts', sammelTitel(zeile('Cyberpunk: Edgerunners II').articleTitle, KATALOG, new Map()) === undefined)
  // Klasse 2: Beititel hinter dem Namen.
  pruefe('Namensanfang: „K: Seven Stories – Movie 1“ → Movie 1', id('K: Seven Stories – Movie 1') === 900001, id('K: Seven Stories – Movie 1'))
  pruefe('Namensanfang: „K: Seven Stories – Movie 2“ → Movie 2', id('K: Seven Stories – Movie 2') === 900002)
  pruefe('Namensanfang: „Yandere Dark Elf“', id('Yandere Dark Elf') === 900060)
  pruefe('Staffel 1 als Zusatz erlaubt den Namensanfang', id('Yandere Dark Elf', 'Staffel 1') === 900060)
  // Gegenfälle: ähnlich, aber verschieden.
  pruefe('M.A.S.K. hängt nicht an Mask Danshi', id('M.A.S.K.') === undefined, id('M.A.S.K.'))
  pruefe('Zorro-Film hängt nicht an der Zorro-Serie', id('Z wie Zorro – Der Film') === undefined, id('Z wie Zorro – Der Film'))
  pruefe('Zorros Geheimnis findet nichts', id('Zorros Geheimnis') === undefined)
  pruefe('Steel Ball Run „2nd-3rd STAGE“ nicht an Phase 1', id('STEEL BALL RUN: JoJo’s Bizarre Adventure', '2nd-3rd STAGE') === undefined)
  pruefe('Steel Ball Run ohne Zusatz: zwei Anfänge, keiner', id('STEEL BALL RUN: JoJo’s Bizarre Adventure') === undefined)
  pruefe('Zusatz „Staffel 2“ schließt den Namensanfang aus', id('Yandere Dark Elf', 'Staffel 2') === undefined)
  pruefe('Teilwort dahinter („Season …“) ist kein Beititel', id('Beispiel Serie') === undefined)
  pruefe('Ein Wort allein genügt für den Anfang nicht', id('Zwillingsserie') === undefined && id('Mondschein') === undefined)
  pruefe('zwei Anfänge → keiner', id('Zwillingsserie: Der') === undefined)
  pruefe('ein Anfang mit „Part 2“ daneben ist nicht eindeutig', id('Doppel Werk') === undefined)
  pruefe('Anfang gilt nur am Namensbeginn, nicht mitten im Namen', id('Dark Elf') === undefined)
  pruefe('Film-Wort verlangt einen Film (Eureka Seven/Trinity Seven nicht)', id('Seven Stories Movie 1') === undefined && id('K: Seven Stories Movie 1') === 900001)
  pruefe('ohne Film-Wort kein Film im Namensanfang', id('Kinoserie Special') === undefined)
}

/** Gleicher Name: alle Schreibweisen, die der Bestand führt, und die Grenzen des genauen Wegs. */
async function pruefeGleicherName(): Promise<void> {
  const { sammelTitel, istSammelMeldung } = await import('./lib/sammel-titel.ts')
  const id = (name: string) => sammelTitel(zeile(name).articleTitle, KATALOG, SYNONYME)?.id
  pruefe('Apostroph: „Heros Journey“ → „Hero’s Journey“', id('Heros Journey') === 900088, id('Heros Journey'))
  pruefe('Apostroph im Namensanfang: „Wizards Tale“ → „Wizard’s Tale: Der Beginn“', id('Wizards Tale') === 900097, id('Wizards Tale'))
  pruefe('Romaji-Name genügt', id('Kimi no Namae') === 900098, id('Kimi no Namae'))
  pruefe('Akzent:„Pokemon Horizons“ → „Pokémon Horizons“', id('Pokemon Horizons') === 900089, id('Pokemon Horizons'))
  pruefe('vier Zeichen genügen für den gleichen Namen', id('Gate') === 900091, id('Gate'))
  pruefe('drei Zeichen genügen nicht', id('Air') === undefined, id('Air'))
  pruefe('zwei Titel gleichen Namens → keiner, auch nicht der mit Beititel', id('Gleicher Name') === undefined, id('Gleicher Name'))
  pruefe('zu kurzer Name gleicht auch als Namensanfang nicht', id('Ox A') === undefined, id('Ox A'))
  pruefe('ein Film ohne Film-Wort im Namen ist erreichbar', id('Dein Name') === 900094, id('Dein Name'))
  const sammel = { context: 'Sammelartikel' }
  pruefe('Sammelzeile: alle Daten aus dem Sammelartikel', istSammelMeldung({ dates: [sammel, sammel] }))
  pruefe('keine Sammelzeile: ein Datum aus anderem Zusammenhang', !istSammelMeldung({ dates: [sammel, { context: 'Start' }] }))
  pruefe('keine Sammelzeile: ohne Daten', !istSammelMeldung({ dates: [] }) && !istSammelMeldung({}))
}

async function pruefeTermine(): Promise<void> {
  const { synonymeJeTitel } = await import('./lib/sammel-titel.ts')
  const { releasesAus } = await import('./lib/meldungen.ts')
  // Durch `releasesAus`: das Film-Wort im Namen darf die Teil-Erkennung nicht treffen (Clannad, Mononoke III).
  const neu = (v: Vorschlag, syn = SYNONYME) => releasesAus([v], KATALOG, [], '2026-11-04', undefined, undefined, syn)
  const clannad = neu(zeile('Clannad: Der Film'))
  pruefe('Termin: „Clannad: Der Film“ am Film', clannad.length === 1 && clannad[0]!.titleId === 900070, clannad.map((r) => r.titleId))
  const k1 = neu(zeile('K: Seven Stories – Movie 1'))
  pruefe('Termin: „K: Seven Stories – Movie 1“ an Movie 1, nicht Movie 2', k1.length === 1 && k1[0]!.titleId === 900001, k1.map((r) => r.titleId))
  const edge = neu(zeile('Cyberpunk: Edgerunners II', undefined, 'netflix'))
  pruefe('Termin: Edgerunners II über das Synonym', edge.length === 1 && edge[0]!.titleId === 900012, edge.map((r) => r.titleId))
  pruefe('Termin: ohne Synonymliste keiner', neu(zeile('Cyberpunk: Edgerunners II', undefined, 'netflix'), new Map()).length === 0)
  pruefe('Termin: M.A.S.K., Zorro-Film, Steel Ball Run bleiben ohne Termin',
    [zeile('M.A.S.K.'), zeile('Z wie Zorro – Der Film'), zeile('STEEL BALL RUN: JoJo’s Bizarre Adventure', '2nd-3rd STAGE')].every((v) => neu(v).length === 0))
  // Eine Meldung, die keine Sammelzeile ist, nutzt den neuen Weg nicht: „Love & Lies“ in einer Überschrift bleibt ohne Treffer.
  const ueberschrift: Vorschlag = { ...zeile('Love & Lies'), dates: [{ iso: '2026-11-03', context: 'Start am 3. November' }] }
  pruefe('Überschrift (kein Sammelartikel) nutzt den Namensabgleich nicht', neu(ueberschrift).length === 0)
  const filmUeberschrift: Vorschlag = { ...zeile('Clannad: Der Film'), dates: [{ iso: '2026-11-03', context: 'Start am 3. November' }] }
  pruefe('Überschrift mit Film-Wort im Namen bleibt wie bisher ohne Termin', neu(filmUeberschrift).length === 0)
  // Teil-Wörter außerhalb des Namens zählen weiter: „Staffel 4“ ohne Staffel 4 im Bestand bleibt ohne Termin.
  pruefe('Zusatz „Staffel 4“ ohne vierte Staffel: kein Termin', neu(zeile('Clannad', 'Staffel 4')).length === 0)

  // `synonymeJeTitel` liest nur die gefragten Kennungen und nur `info.synonyms`.
  const roh: Record<string, unknown> = { '900012': { info: { synonyms: ['Cyberpunk: Edgerunners II'] } }, '900099': { info: { synonyms: ['Fremd'] } }, '900011': {} }
  const lies = ((p: string, vorgabe: unknown) => (p === 'data/anisearch.json' ? roh : vorgabe)) as never
  const syn = synonymeJeTitel([900011, 900012], lies)
  pruefe('Synonyme: nur gefragte Kennungen mit Liste', syn.size === 1 && syn.get(900012)?.[0] === 'Cyberpunk: Edgerunners II', [...syn])
}

async function pruefeBau(): Promise<void> {
  // Verdrahtung im Bau: `ergaenzeTermineAusNewsUndTv` liest die Synonyme aus `data/anisearch.json` und übergibt sie.
  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]')
  writeFileSync(join(wurzel, 'data', 'anisearch.json'), JSON.stringify({ 900012: { info: { synonyms: ['Cyberpunk: Edgerunners II'] } } }))
  const artikel = {
    ...zeile('x'),
    articleTitle: 'Netflix: Alle Anime-Neuzugänge im Oktober 2026',
    sammel: [
      { titel: 'Cyberpunk: Edgerunners II', datum: '2026-10-20', deutsch: true, woechentlich: false, stream: ['Netflix'], folgen: 10 },
      { titel: 'Love & Lies', datum: '2026-10-21', deutsch: true, woechentlich: false, stream: ['Netflix'] },
      { titel: 'M.A.S.K.', datum: '2026-11-01', deutsch: true, woechentlich: false, stream: ['Netflix'] },
    ],
    platforms: ['netflix'],
    dates: [],
    dub: 'unklar',
  }
  writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [artikel] }))
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const releases: unknown[] = []
  const stumm = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles: new Map(KATALOG.map((t) => [t.id, t])), releases } as never)
  } finally {
    console.log = stumm
  }
  const ids = (releases as { titleId: number }[]).map((r) => r.titleId).sort()
  pruefe('Bau: Termine für Edgerunners 2 (Synonym) und Love and Lies (&), keiner für M.A.S.K.', ids.join() === '900012,900020', ids)
  const liste = JSON.parse(readFileSync(join(wurzel, 'data', 'proposals', 'nicht-zugeordnet.json'), 'utf8')) as { eintraege: { titel: string }[] }
  pruefe('Bau: auf der Liste „nicht zugeordnet“ steht nur M.A.S.K.', liste.eintraege.length === 1 && liste.eintraege[0]!.titel === 'M.A.S.K.', liste.eintraege)
}

try {
  await main()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`Sammel-Titel: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
