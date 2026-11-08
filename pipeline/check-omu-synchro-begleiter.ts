/**
 * OmU-Begleiter (`bau/omu-synchro-begleiter.ts`): Black Clover Staffel 2 am 07.11.2026. Serie, Blöcke, Folge 171 und der OmU-Termin
 * stehen wörtlich so in `data/crunchyroll-dub.json` und `data/curated/streaming-herbst-2026.yaml` (Stand Commit 8c569d3fd, Folge 171
 * um 16:00 UTC), die Titel mit den Feldern, die die Staffelzählung braucht. Die Fälle 1 bis 9 stehen im Auftrag; „Bau“ heißt hier
 * die echte Phase 09-4 (`werteCrunchyrollDubAus`) in einem leeren Wegwerf-Ordner (`AK_ROOT`).
 * Aufruf: npx tsx pipeline/check-omu-synchro-begleiter.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'omu-begleiter-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
process.env.AK_ROOT = wurzel
const { werteCrunchyrollDubAus } = await import('./bau/09-4-crunchyroll-dub.ts')
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
const { legeOmuBegleiterAn, legeOmuBegleiterAnUndMelde } = await import('./bau/omu-synchro-begleiter.ts')
const { sammleWiderlegungen, deutscheFolgenTage } = await import('./bau/widerlegung-woche.ts')
const { deutschNurAusSpracheTermin } = await import('./lib/pruefung.ts')
type Release = import('../shared/types.ts').Release
type Title = import('../shared/types.ts').Title

const URL_DE = 'https://www.crunchyroll.com/de/series/GRE50KV36/black-clover'
const OMU_SLUG = 'black-clover-s2-crunchyroll'
const folge = (nummer: number, laufend: number, verfuegbarAb: string) => ({ nummer, laufend, guid: `g${nummer}`, verfuegbarAb })
const block = (name: string, deutscheFolgen: ReturnType<typeof folge>[]) => ({ name, folgen: deutscheFolgen.length, kacheln: deutscheFolgen.length, deutsch: deutscheFolgen.length, fremd: 0, deutscheFolgen })
const S1_BLOECKE = [
  block('Season 1 Part 1', [folge(50, 50, '2018-09-18T15:00:00Z'), folge(51, 51, '2018-09-25T15:00:00Z')]),
  block('Season 1 Part 2', [folge(101, 50, '2019-09-17T22:00:00Z'), folge(102, 51, '2019-09-24T22:00:00Z')]),
  block('Season 1 Part 3', [folge(153, 51, '2023-10-31T15:00:00Z'), folge(154, 52, '2024-08-14T15:00:00Z')]),
  block('Season 1 Part 4', [folge(169, 15, '2024-08-14T15:00:00Z'), folge(170, 16, '2024-08-14T15:00:00Z')]),
]
const S2_ERSTE = folge(171, 1, '2026-11-07T16:00:00Z')

const titel = (id: number, jpYear: number, episodes: number | undefined, extra: object = {}) =>
  ({ id, franchiseId: 97940, titleEn: id === 97940 ? 'Black Clover' : 'Black Clover Season 2', format: 'TV', jpYear, jpStart: `${jpYear}-01-01`, episodes, streams: [], ...extra }) as unknown as Title
const bcTitel = () => new Map<number, Title>([[97940, titel(97940, 2017, 170)], [195604, titel(195604, 2026, undefined, { fsk: 12 })]])

const omuRelease = (extra: object = {}): Release =>
  ({ slug: OMU_SLUG, titleId: 195604, name: 'Black Clover – Staffel 2', platform: 'crunchyroll', platformUrl: URL_DE, releaseType: 'weekly', sprache: 'omu', schedule: { firstEpisodeDate: '2026-10-03', estimated: true, episodeCount: 12 }, year: 2026, sources: [], ...extra }) as unknown as Release
const handRelease = (): Release =>
  ({ slug: `${OMU_SLUG}-synchro`, titleId: 195604, name: 'Black Clover – Staffel 2', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-11-07', observed: { 1: '2026-11-07' } }, year: 2026, sources: [] }) as unknown as Release
const crDub = (s2: ReturnType<typeof block>[] = [block('Staffel 2', [S2_ERSTE])], zusatz: ReturnType<typeof block>[] = []) =>
  ({ scrapedAt: '', serien: [{ url: URL_DE, seriesId: 'GRE50KV36', katalog: 'de', staffeln: [...S1_BLOECKE, ...zusatz, ...s2] }] }) as never

function stumm<T>(f: () => T): T {
  const log = console.log
  console.log = () => undefined
  try {
    return f()
  } finally {
    console.log = log
  }
}
const mitSprache = (rs: Release[]) => rs.filter((r) => r.platform === 'crunchyroll' && r.sprache)
const ohneSprache = (rs: Release[]) => rs.filter((r) => r.platform === 'crunchyroll' && !r.sprache)

/** Die Phase 09-4 wie im Bau (Ableitung 09-4-4 vor dem Begleiter); `jetzt` ist die Uhr der Ableitung. */
function bau(releases: Release[], dub: never, titles = bcTitel(), jetzt = Date.parse('2026-11-08T05:00:00Z')): Release[] {
  stumm(() => werteCrunchyrollDubAus({ crDub: dub, titles, usNeinWiderlegt: () => false, verweiseEntfernt: [], katalogEintraege: [], anisearch: {}, releases, jetzt }))
  return releases
}
/** Nur die Ableitung 09-4-4 und der Begleiter, mit eigener Zuordnung Adresse → Titel (Tests ohne die Zuordnungsphasen). */
function ableitungUndBegleiter(releases: Release[], dub: never, titles: Map<number, Title>, nachUrl: Map<string, Title[]>, jetzt: number) {
  stumm(() => legeCrVerweiseUndTermineAn({ titles, anisearch: {}, belegt: 0, crDub: dub, verschwunden: 0, usNeinOffen: 0, nachUrl, releases, jetzt }))
  return legeOmuBegleiterAn(releases, titles, dub)
}
const Z0 = { erzeugt: 0, ohneBlock: 0, vorOmuStart: 0, handVorhanden: 0 }

try {
  /* 1. Geteilte Serie, neue Staffel bekommt die Synchro — im Bau, ohne den Eintrag aus 3116. Die Uhr steht weit hinter dem Frischefenster:
        der Termin kommt vom Begleiter, nicht von der Ableitung. */
  const fern = Date.parse('2026-12-31T05:00:00Z')
  const rs1 = bau([omuRelease()], crDub(), bcTitel(), fern)
  const s1 = ohneSprache(rs1)[0]
  pruefe('1: Black Clover S2: genau ein deutscher Termin neben dem OmU-Termin', rs1.length === 2 && mitSprache(rs1).length === 1 && ohneSprache(rs1).length === 1, rs1.map((r) => r.slug))
  pruefe('1: der Termin heißt <slug>-synchro, 07.11.2026 um 17:00, Folge 1 an diesem Tag', s1?.slug === `${OMU_SLUG}-synchro` && s1.schedule.firstEpisodeDate === '2026-11-07' && s1.schedule.time === '17:00' && JSON.stringify(s1.schedule.observed) === '{"1":"2026-11-07"}', s1?.schedule)
  pruefe('1: keine Folgenzahl, kein Ende, Serienadresse als Beleg, Herkunft nennt den Block', s1?.schedule.episodeCount === undefined && s1?.schedule.lastEpisodeDate === undefined && s1?.sources.join() === URL_DE && /1 Folgen mit belegtem Termin \(Block „Staffel 2“\)/.test(s1?.herkunft ?? ''), s1)
  pruefe('1: Name, Seite, Wochentakt, Jahr und FSK stammen vom OmU-Termin und Titel', s1?.name === 'Black Clover – Staffel 2' && s1.platformUrl === URL_DE && s1.platform === 'crunchyroll' && s1.releaseType === 'weekly' && s1.year === 2026 && s1.fsk === 12, s1)
  pruefe('1: der OmU-Termin bleibt unverändert', JSON.stringify(rs1[0]) === JSON.stringify(omuRelease()), rs1[0])

  /* 2. Tag 22 mit vier Wochenfolgen: der Termin ist noch da (die Ableitung allein verlöre ihn nach 21 Tagen). */
  const wochen = [folge(171, 1, '2026-11-07T16:00:00Z'), folge(172, 2, '2026-11-14T16:00:00Z'), folge(173, 3, '2026-11-21T16:00:00Z'), folge(174, 4, '2026-11-28T16:00:00Z')]
  const tag22 = bau([omuRelease()], crDub([block('Staffel 2', wochen)]), bcTitel(), Date.parse('2026-11-29T05:00:00Z'))
  const t22 = ohneSprache(tag22)
  pruefe('2: Tag 22, vier Wochenfolgen: weiter genau ein deutscher Termin, ab 07.11. mit den vier Folgen', t22.length === 1 && t22[0]?.schedule.firstEpisodeDate === '2026-11-07' && Object.keys(t22[0]?.schedule.observed ?? {}).join() === '1,2,3,4', t22.map((r) => r.schedule))
  pruefe('2: Tag 22: es ist der Begleiter (die Ableitung hat nach 21 Tagen verworfen), die Herkunft nennt 4 Folgen', t22[0]?.slug === `${OMU_SLUG}-synchro` && /4 Folgen mit belegtem Termin/.test(t22[0]?.herkunft ?? ''), t22[0])
  const tag13 = bau([omuRelease()], crDub([block('Staffel 2', wochen.slice(0, 2))]), bcTitel(), Date.parse('2026-11-20T05:00:00Z'))
  pruefe('2: Tag 13 (im Fenster): ebenfalls genau ein deutscher Termin, kein Doppel aus Ableitung und Begleiter', ohneSprache(tag13).length === 1, ohneSprache(tag13).map((r) => r.slug))

  /* 3. Hand-Eintrag ohne sprache (Stand nach 3116): nichts erzeugt. */
  const mitHand = [omuRelease(), handRelease()]
  const z3 = legeOmuBegleiterAn(mitHand, bcTitel(), crDub())
  pruefe('3: Hand-Eintrag vorhanden: kein weiterer Termin, als Hand-Vorrang gezählt', mitHand.length === 2 && JSON.stringify(z3) === JSON.stringify({ ...Z0, handVorhanden: 1 }), z3)
  const s3 = bau([omuRelease(), handRelease()], crDub(), bcTitel(), fern)
  pruefe('3: auch im Bau bleibt der Hand-Eintrag der einzige deutsche Termin', ohneSprache(s3).length === 1 && ohneSprache(s3)[0]?.sources.length === 0, ohneSprache(s3).map((r) => r.slug))

  /* 4. Die deutsche Folge gehört einer anderen Staffelnummer: nichts. */
  const andere = [block('Staffel 3', [folge(180, 1, '2026-11-07T16:00:00Z')])]
  const rs4 = [omuRelease()]
  const z4 = legeOmuBegleiterAn(rs4, bcTitel(), crDub([], andere))
  pruefe('4: deutsche Folgen nur in Staffel 3, OmU gilt Staffel 2: nichts, als „ohne Block“ gezählt', rs4.length === 1 && JSON.stringify(z4) === JSON.stringify({ ...Z0, ohneBlock: 1 }), z4)
  const rs4b = [omuRelease()]
  const z4b = legeOmuBegleiterAn(rs4b, bcTitel(), crDub([block('Staffel 2', [S2_ERSTE])], [block('Staffel 3', [folge(180, 1, '2026-11-07T16:00:00Z')])]))
  pruefe('4: Staffel 2 und 3 mit Folgen: nur Staffel 2 zählt (Folge 171, Staffel 3 wird nicht gemischt)', z4b.erzeugt === 1 && rs4b[1]?.schedule.observed?.[1] === '2026-11-07' && Object.keys(rs4b[1]?.schedule.observed ?? {}).length === 1, rs4b[1]?.schedule)

  /* 5. Deutsche Folgen vor dem OmU-Start: nichts; am Starttag selbst gilt die Folge. */
  const rs5 = [omuRelease()]
  const z5 = legeOmuBegleiterAn(rs5, bcTitel(), crDub([block('Staffel 2', [folge(171, 1, '2026-10-02T15:00:00Z')])]))
  pruefe('5: deutsche Folge einen Tag vor dem OmU-Start: nichts, als „vor OmU-Start“ gezählt', rs5.length === 1 && JSON.stringify(z5) === JSON.stringify({ ...Z0, vorOmuStart: 1 }), z5)
  const rs5b = [omuRelease()]
  const z5b = legeOmuBegleiterAn(rs5b, bcTitel(), crDub([block('Staffel 2', [folge(171, 1, '2026-10-03T16:00:00Z')])]))
  pruefe('5: deutsche Folge am OmU-Starttag selbst: Termin (Grenze gilt einschließlich)', z5b.erzeugt === 1 && rs5b[1]?.schedule.firstEpisodeDate === '2026-10-03', z5b)
  const rs5c = [omuRelease()]
  const z5c = legeOmuBegleiterAn(rs5c, bcTitel(), crDub([block('Staffel 2', [folge(170, 2, '2026-10-02T15:00:00Z'), folge(171, 3, '2026-10-10T15:00:00Z')])]))
  pruefe('5: Folgen vor und nach dem Start: nur die ab OmU-Start zählen', z5c.erzeugt === 1 && rs5c[1]?.schedule.firstEpisodeDate === '2026-10-10' && Object.keys(rs5c[1]?.schedule.observed ?? {}).join() === '3', rs5c[1]?.schedule)

  /* 6. sprache offen und andere Plattform: nichts, Release unverändert. */
  const offen = omuRelease({ sprache: 'offen' })
  const rs6 = [offen]
  const z6 = legeOmuBegleiterAn(rs6, bcTitel(), crDub())
  pruefe('6: sprache offen: nichts erzeugt, nichts gezählt, Release unverändert', rs6.length === 1 && JSON.stringify(z6) === JSON.stringify(Z0) && JSON.stringify(rs6[0]) === JSON.stringify(omuRelease({ sprache: 'offen' })), z6)
  const netflix = [omuRelease({ platform: 'netflix', slug: 'bc-netflix' })]
  pruefe('6: OmU auf Netflix: nichts', JSON.stringify(legeOmuBegleiterAn(netflix, bcTitel(), crDub())) === JSON.stringify(Z0) && netflix.length === 1)

  /* 7. Eigene Serie (Rayearth-artig): Katalog „Staffel 1“, die Ableitung liefert den Termin, der Begleiter erzeugt kein Doppel. */
  const RAY_URL = 'https://www.crunchyroll.com/de/series/GRRAYEARTH/magic-knight-rayearth-2026'
  const ray = (id: number, jpYear: number, extra: object = {}) => ({ id, franchiseId: 5, titleEn: `Rayearth ${id}`, format: 'TV', jpYear, jpStart: `${jpYear}-04-01`, episodes: 2, streams: [], ...extra }) as unknown as Title
  const rayNeu = ray(300, 2026, { streams: [{ platform: 'crunchyroll', url: RAY_URL, dub: true }] })
  const rayTitel = new Map<number, Title>([[100, ray(100, 1994)], [200, ray(200, 1998)], [300, rayNeu]])
  const rayDub = { scrapedAt: '', serien: [{ url: RAY_URL, seriesId: 'GRRAYEARTH', katalog: 'de', staffeln: [block('Staffel 1', [folge(1, 1, '2026-10-25T09:00:00Z'), folge(2, 2, '2026-11-01T09:00:00Z')])] }] } as never
  const rayOmu = { ...omuRelease({ slug: 'rayearth-crunchyroll', titleId: 300, platformUrl: RAY_URL }), schedule: { firstEpisodeDate: '2026-10-25', estimated: true } } as Release
  const rs7 = [rayOmu]
  const z7 = ableitungUndBegleiter(rs7, rayDub, rayTitel, new Map([[RAY_URL, [rayNeu]]]), Date.parse('2026-11-02T05:00:00Z'))
  pruefe('7: eigene Serie: genau ein deutscher Termin, und zwar die Ableitung (Block „Staffel 1“, zwei Folgen), kein Begleiter-Doppel', ohneSprache(rs7).length === 1 && !/-synchro$/.test(ohneSprache(rs7)[0]?.slug ?? '') && /2 Folgen mit belegtem Termin/.test(ohneSprache(rs7)[0]?.herkunft ?? '') && z7.erzeugt === 0 && z7.handVorhanden === 1, { z7, slugs: rs7.map((r) => r.slug) })
  const rs7b = [rayOmu]
  const z7b = legeOmuBegleiterAn(rs7b, rayTitel, rayDub)
  pruefe('7: ohne Ableitung erzeugt der Begleiter für die eigene Serie den Termin aus „Staffel 1“', z7b.erzeugt === 1 && rs7b[1]?.slug === 'rayearth-crunchyroll-synchro' && rs7b[1]?.schedule.firstEpisodeDate === '2026-10-25', { z7b, s: rs7b[1]?.schedule })

  /* 8. Uneinheitliche Uhrzeiten: der Termin trägt keine Uhrzeit. */
  const rs8 = [omuRelease()]
  legeOmuBegleiterAn(rs8, bcTitel(), crDub([block('Staffel 2', [folge(172, 2, '2026-11-14T17:00:00Z'), folge(171, 1, '2026-11-07T16:00:00Z')])]))
  pruefe('8: 17:00 und 18:00 Berlin, Folgen in umgekehrter Reihenfolge: Termin ohne Uhrzeit, Start am frühesten Tag', rs8.length === 2 && !('time' in (rs8[1]?.schedule ?? {})) && rs8[1]?.schedule.firstEpisodeDate === '2026-11-07', rs8[1]?.schedule)
  const rs8b = [omuRelease()]
  legeOmuBegleiterAn(rs8b, bcTitel(), crDub([block('Staffel 2', [{ nummer: 171, guid: 'x', verfuegbarAb: '2026-11-07T16:00:00Z' } as never])]))
  pruefe('8: Folge ohne laufende Nummer: Termin ohne Beobachtung statt einer Nummer 171', rs8b.length === 2 && rs8b[1]?.schedule.observed === undefined, rs8b[1]?.schedule)

  const rs8c = [omuRelease()]
  legeOmuBegleiterAn(rs8c, bcTitel(), crDub([block('Staffel 2', [folge(171, 0, '2026-11-07T16:00:00Z')])]))
  pruefe('8: laufende Nummer 0 ist keine Beobachtung', rs8c.length === 2 && rs8c[1]?.schedule.observed === undefined, rs8c[1]?.schedule)

  /* Verwerfungspfade: unbekannter Titel, Katalog nicht deutsch, fremde Serie, undatierter Block, Gegenstück auf anderer Plattform. */
  const rsU = [omuRelease({ titleId: 424242 })]
  pruefe('unbekannter Titel: nichts, als „ohne Block“ gezählt', JSON.stringify(legeOmuBegleiterAn(rsU, bcTitel(), crDub())) === JSON.stringify({ ...Z0, ohneBlock: 1 }) && rsU.length === 1)
  const us = { scrapedAt: '', serien: [{ url: URL_DE, seriesId: 'GRE50KV36', katalog: 'us', staffeln: [block('Staffel 2', [S2_ERSTE])] }] } as never
  const rsUs = [omuRelease()]
  pruefe('US-Katalog: nichts (nur der deutsche Katalog belegt Deutsch)', JSON.stringify(legeOmuBegleiterAn(rsUs, bcTitel(), us)) === JSON.stringify({ ...Z0, ohneBlock: 1 }) && rsUs.length === 1)
  const fremd = { scrapedAt: '', serien: [{ url: 'https://www.crunchyroll.com/de/series/GRANDERE/x', seriesId: 'GRANDERE', katalog: 'de', staffeln: [block('Staffel 2', [folge(5, 1, '2026-11-09T16:00:00Z')])] }, ...(crDub() as { serien: object[] }).serien] } as never
  const rsF = [omuRelease()]
  legeOmuBegleiterAn(rsF, bcTitel(), fremd)
  pruefe('Block einer anderen Serie steht davor: der Termin kommt aus der Serie des OmU-Termins (07.11., nicht 09.11.)', rsF.length === 2 && rsF[1]?.schedule.firstEpisodeDate === '2026-11-07' && rsF[1]?.sources.join() === URL_DE, rsF[1])
  const undatiert = { scrapedAt: '', serien: [{ url: URL_DE, seriesId: 'GRE50KV36', katalog: 'de', staffeln: [{ ...block('Staffel 2', []), deutscheFolgen: [{ nummer: 171, guid: 'u' }] }] }] } as never
  const rsN = [omuRelease()]
  pruefe('Block ohne datierte Folge: nichts, als „ohne Block“ gezählt', JSON.stringify(legeOmuBegleiterAn(rsN, bcTitel(), undatiert)) === JSON.stringify({ ...Z0, ohneBlock: 1 }) && rsN.length === 1)
  const netflixNormal = { ...handRelease(), slug: 'bc-netflix', platform: 'netflix' } as Release
  const rsNf = [omuRelease(), netflixNormal]
  pruefe('Termin ohne sprache auf einer anderen Plattform ist kein Gegenstück', legeOmuBegleiterAn(rsNf, bcTitel(), crDub()).erzeugt === 1 && rsNf.length === 3)
  const rsAnderer = [omuRelease(), { ...handRelease(), titleId: 97940 } as Release]
  pruefe('Termin ohne sprache an einem anderen Titel ist kein Gegenstück', legeOmuBegleiterAn(rsAnderer, bcTitel(), crDub()).erzeugt === 1 && rsAnderer.length === 3)

  /* 9. Verdrahtung und Prüfung: kein Widerspruch, und das Wochenprogramm widerlegt den Begleiter nicht. */
  const titel9 = bcTitel()
  titel9.get(195604)!.streams = [{ platform: 'crunchyroll', url: URL_DE, dub: true } as never]
  pruefe('9: ohne Begleiter (nur der OmU-Termin) meldet die Prüfung den Widerspruch', deutschNurAusSpracheTermin([omuRelease()], titel9).length === 1)
  pruefe('9: mit dem Begleiter aus dem Bau: kein Widerspruch', deutschNurAusSpracheTermin(rs1, titel9).length === 0)
  const woche = { wocheAb: '2026-11-02', eintraege: [{ seriesId: 'GRE50KV36', datum: '2026-11-07', sprache: 'ja' }] }
  const tage = deutscheFolgenTage({ folgen: [{ serieId: 'GRE50KV36', serie: 'Black Clover', staffel: 'Staffel 2', verfuegbarAb: '2026-11-07T16:00:00Z' }] })
  const ohneKatalog = sammleWiderlegungen(rs1, titel9, woche, {})
  const mitKatalog = sammleWiderlegungen(rs1, titel9, woche, {}, tage)
  pruefe('9: Kontrolle: nur mit dem Wochenprogramm (ohne Katalogfolge) wäre der Begleiter widerlegt', Object.keys(ohneKatalog.gedaechtnis).includes(`${OMU_SLUG}-synchro`), ohneKatalog.gedaechtnis)
  pruefe('9: mit der deutschen Katalogfolge (2327) widerlegt das Wochenprogramm den Begleiter nicht', !Object.keys(mitKatalog.gedaechtnis).includes(`${OMU_SLUG}-synchro`), mitKatalog.gedaechtnis)

  /* Zählzeile im Bau-Log. */
  const zeilenVon = (releases: Release[], dub: never): string[] => {
    const zeilen: string[] = []
    const altLog = console.log
    console.log = (...a: unknown[]) => void zeilen.push(a.join(' ').replace('[pipeline] ', ''))
    try {
      legeOmuBegleiterAnUndMelde(releases, bcTitel(), dub)
    } finally {
      console.log = altLog
    }
    return zeilen
  }
  const zeile = (e: number, o: number, v: number, h: number) => `OmU-Begleiter: ${e} erzeugt, ${o} ohne Block, ${v} mit Folgen nur vor dem OmU-Start, ${h} mit Gegenstück am Titel`
  pruefe('Zählzeile: 1 erzeugt', zeilenVon([omuRelease()], crDub()).join('|') === zeile(1, 0, 0, 0))
  pruefe('Zählzeile: nur „ohne Block“ (US-Katalog) steht im Log', zeilenVon([omuRelease()], us).join('|') === zeile(0, 1, 0, 0))
  pruefe('Zählzeile: nur „vor dem OmU-Start“ steht im Log', zeilenVon([omuRelease()], crDub([block('Staffel 2', [folge(171, 1, '2026-10-02T15:00:00Z')])])).join('|') === zeile(0, 0, 1, 0))
  pruefe('Zählzeile: nur „Gegenstück am Titel“ steht im Log', zeilenVon([omuRelease(), handRelease()], crDub()).join('|') === zeile(0, 0, 0, 1))
  pruefe('Zählzeile: ohne OmU-Termin keine Zeile', zeilenVon([handRelease()], crDub()).length === 0)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nOmU-Begleiter: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
