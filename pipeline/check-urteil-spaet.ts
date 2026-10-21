/**
 * Zusicherungen zu `urteilSchliesstSpaeteLuecken` (`bau/urteil-schliesst-luecken.ts`, 17.10.2026): Das Urteil aus Stufe 3 erreicht
 * auch Wege, die erst nach Phase 10 entstehen (JustWatch 11-2, Termine 11-7). Läuft in `check:logic` auf einer Kulisse (`AK_ROOT`),
 * erfundene Titel, kein Netz; dazu die Verdrahtung in `13-schreiben.ts` per Syntaxbaum.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { unbedingteAufrufe } from './lib/unbedingte-aufrufe.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'urteil-spaet-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data'), { recursive: true })

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

try {
  const { urteilJaJeWeg, urteilSchliesstSpaeteLuecken } = await import('./bau/urteil-schliesst-luecken.ts')
  const { deutschNurAusSpracheTermin } = await import('./lib/pruefung.ts')
  const { kanalSchluessel } = await import('./lib/kanal-titel.ts')

  /* Trigun (6): Prime führt einige Folgen nicht („nicht verfügbar“), die übrigen sind deutsch — kein „kein deutsch“, also Ja. */
  const urteile = {
    '40|netflix|1': { urteil: 'kein deutsch' },
    '6|primevideo|2': { urteil: 'nicht verfügbar' },
    '6|primevideo|7': { urteil: 'deutsch' },
    '6|primevideo|9': { urteil: 'nicht verfügbar' },
    '41|crunchyroll|1': { urteil: 'unbekannt' },
    '42|wow|3': { urteil: 'deutsch' },
    '43|disneyplus|1': {},
  }
  writeFileSync(join(wurzel, 'data', 'urteile.json'), JSON.stringify(urteile))
  const ja = urteilJaJeWeg()
  pruefe('Ja je Weg: nur Anbieter mit einer deutschen Folge (Trigun gemischt zählt)', JSON.stringify([...ja].sort()) === JSON.stringify(['42|wow', '6|primevideo']), [...ja])

  const weg = (platform: string, extra: Partial<StreamLink> = {}) => ({ platform, url: `https://${platform}.example/x`, ...extra }) as StreamLink
  const titel = (id: number, streams: StreamLink[]) => ({ id, streams }) as unknown as Title
  const handKanal = weg('primevideo', { url: 'https://www.amazon.de/gp/video/detail/HAND' })
  const titles = [
    titel(31, [weg('netflix', { dub: false }), weg('primevideo', { kanal: 'Aniverse' }), weg('crunchyroll'), weg('netflix')]),
    titel(32, [weg('primevideo', { herkunft: 'termin', zugang: 'unbekannt', url: '' })]),
    titel(33, [handKanal]),
    titel(34, [weg('netflix'), weg('disneyplus')]),
    titel(35, [weg('wow', { herkunft: 'tmdb' })]),
    titel(36, [weg('crunchyroll'), weg('wow', { kanal: 'Aniverse' })]),
    /* 37: gti-Brücke hat die Adresse umgestellt, die Kanal-Adresse aus den Handbelegen steht in `seite` (Your Name 21519). */
    titel(37, [weg('primevideo', { url: 'https://app.primevideo.com/detail?gti=X', seite: 'https://www.amazon.de/gp/video/detail/HAND37' })]),
    /* 38: JustWatch-Flagge ohne dubHintOnly wie am echten Fall (166710 Suicide Squad Isekai). */
    titel(38, [weg('netflix', { dubQuelle: 'justwatch', dubStand: '2026-10-01' })]),
    /* 44: Gegenfälle zu 38 — Prime-Kanal mit Ja und WOW ohne Ja behalten die Flagge, nur Netflix in der Mitte verliert sie. */
    /* 45: Hinweis-Wege (dubHintOnly) — nur Disney+ in der Mitte hat ein Ja und verliert den Hinweis. */
    titel(45, [weg('netflix', { dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true }), weg('disneyplus', { dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true }), weg('wow', { dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true })]),
    titel(44, [weg('primevideo', { kanal: 'Aniverse', dubQuelle: 'justwatch', dubStand: '2026-10-01' }), weg('netflix', { dubQuelle: 'justwatch', dubStand: '2026-10-01' }), weg('wow', { dubQuelle: 'justwatch', dubStand: '2026-10-01' })]),
  ]
  const jaWege = new Set(['31|netflix', '31|primevideo', '31|crunchyroll', '32|primevideo', '33|primevideo', '34|netflix', '35|wow', '36|wow', '37|primevideo', '38|netflix', '44|primevideo', '44|netflix', '45|disneyplus'])
  const termin = (titleId: number, platform: string, sprache?: string) => ({ titleId, platform, slug: `r${titleId}`, sprache }) as unknown as Release
  /* 34: Netflix-Termine alle gekennzeichnet (kein Ja), Disney+ mit einem ungekennzeichneten Termin in der Mitte (Ja bleibt erlaubt). */
  const releases = [termin(34, 'netflix', 'offen'), termin(34, 'disneyplus', 'offen'), termin(34, 'netflix', 'omu'), termin(34, 'disneyplus'), termin(34, 'disneyplus', 'omu')]
  jaWege.add('34|disneyplus')
  const kanal = new Set([kanalSchluessel(33, handKanal.url), kanalSchluessel(37, 'https://www.amazon.de/gp/video/detail/HAND37')])
  const n = urteilSchliesstSpaeteLuecken(titles, releases, jaWege, kanal)
  const dub = (id: number, i: number) => titles.find((t) => t.id === id)!.streams![i]
  pruefe('Ein eigenes Nein bleibt (31 Netflix)', dub(31, 0)!.dub === false, dub(31, 0))
  pruefe('Prime mit Kanal bleibt offen (31)', dub(31, 1)!.dub === undefined, dub(31, 1))
  pruefe('JustWatch-Weg mit Urteil bekommt Ja (31 Crunchyroll), auch hinter übersprungenen Wegen', dub(31, 2)!.dub === true, dub(31, 2))
  pruefe('Zweiter Weg desselben Anbieters bekommt Ja (31 Netflix)', dub(31, 3)!.dub === true, dub(31, 3))
  pruefe('Termin-Weg mit Urteil: Ja, Herkunft „termin“ entfällt (32)', dub(32, 0)!.dub === true && dub(32, 0)!.herkunft === undefined, dub(32, 0))
  pruefe('Kanal-Adresse aus den Handbelegen bleibt offen (33)', dub(33, 0)!.dub === undefined, dub(33, 0))
  pruefe('Alle Termine gekennzeichnet: offen (34 Netflix)', dub(34, 0)!.dub === undefined, dub(34, 0))
  pruefe('Ein Termin ohne Kennzeichnung: Ja (34 Disney+)', dub(34, 1)!.dub === true, dub(34, 1))
  pruefe('Andere Herkunft bleibt stehen (35 tmdb)', dub(35, 0)!.dub === true && dub(35, 0)!.herkunft === 'tmdb', dub(35, 0))
  pruefe('Ohne Urteil-Ja bleibt der Weg offen (36)', dub(36, 0)!.dub === undefined, dub(36, 0))
  pruefe('Kanal-Angabe zählt nur bei Prime; Ja auch hinter einem Weg ohne Urteil (36 WOW)', dub(36, 1)!.dub === true, dub(36, 1))
  pruefe('Kanal-Adresse in `seite` (nach der gti-Brücke) bleibt offen (37)', dub(37, 0)!.dub === undefined, dub(37, 0))
  pruefe(
    'JustWatch-Kennzeichnung weicht dem Urteil-Ja (38)',
    dub(38, 0)!.dub === true && dub(38, 0)!.dubQuelle === undefined && dub(38, 0)!.dubStand === undefined && dub(38, 0)!.dubHintOnly === undefined,
    dub(38, 0),
  )
  pruefe('Prime-Kanal mit Ja behält die JustWatch-Flagge (44)', dub(44, 0)!.dub === undefined && dub(44, 0)!.dubQuelle === 'justwatch', dub(44, 0))
  pruefe('Urteil-Ja in der Mitte löscht die Flagge (44 Netflix)', dub(44, 1)!.dub === true && dub(44, 1)!.dubQuelle === undefined && dub(44, 1)!.dubStand === undefined, dub(44, 1))
  pruefe('Ohne Urteil-Ja bleibt die Flagge (44 WOW)', dub(44, 2)!.dub === undefined && dub(44, 2)!.dubQuelle === 'justwatch' && dub(44, 2)!.dubStand === '2026-10-01', dub(44, 2))
  pruefe('Hinweis-Weg ohne Ja behält den Hinweis (45 Netflix)', dub(45, 0)!.dub === undefined && dub(45, 0)!.dubHintOnly === true, dub(45, 0))
  pruefe('Hinweis-Weg mit Ja verliert Flagge und Hinweis (45 Disney+)', dub(45, 1)!.dub === true && dub(45, 1)!.dubHintOnly === undefined && dub(45, 1)!.dubQuelle === undefined, dub(45, 1))
  pruefe('Hinweis-Weg ohne Ja behält den Hinweis (45 WOW)', dub(45, 2)!.dub === undefined && dub(45, 2)!.dubHintOnly === true, dub(45, 2))
  pruefe('Zahl der belegten Wege', n === 9, n)
  const widerspruch = deutschNurAusSpracheTermin(releases, new Map(titles.map((t) => [t.id, t])))
  pruefe('Kein Widerspruch zu Terminen mit Sprachkennzeichnung', widerspruch.length === 0, widerspruch)
  pruefe('Zweiter Lauf belegt nichts mehr', urteilSchliesstSpaeteLuecken(titles, releases, jaWege, kanal) === 0)

  /* Verdrahtung: unbedingt, mit allen Wegen, nach dem Anreichern (setzt `kanal`) und vor dem Kanal-Erbe (tonDerKanalWege) und der Auslieferung. */
  const schreiben = readFileSync(new URL('./bau/13-schreiben.ts', import.meta.url), 'utf8')
  const aufrufe = unbedingteAufrufe(schreiben, 'schreibeDatensatz')
  const stelle = (name: string): number => aufrufe.find((x) => x.name === name)?.stelle ?? -1
  const spaet = aufrufe.find((x) => x.name === 'schliesseSpaeteLuecken')
  pruefe(
    '13-schreiben ruft schliesseSpaeteLuecken(allTitles, releases) unbedingt auf',
    spaet?.args.join('|') === 'allTitles|releases',
    spaet,
  )
  pruefe(
    '13-schreiben: nach dem Anreichern, vor Kanal-Wege (Erbe) und Auslieferung',
    stelle('schreibeSynopsenUndReichereAn') >= 0 &&
      stelle('schliesseSpaeteLuecken') > stelle('schreibeSynopsenUndReichereAn') &&
      stelle('schliesseSpaeteLuecken') < stelle('tonDerKanalWege') &&
      stelle('tonDerKanalWege') < stelle('baueAuslieferung'),
    aufrufe.map((x) => `${x.stelle}:${x.name}`),
  )
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-urteil-spaet: ok')
