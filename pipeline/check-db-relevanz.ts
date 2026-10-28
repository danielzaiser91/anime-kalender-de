/**
 * Zusicherungen zur Gruppierung der Datenbank ohne Suche (Daniel, 09.10.2026): Maßgeblich ist die deutsche Erstausgabe,
 * ein späteres Neuerscheinen bei einem weiteren Anbieter zählt nicht. Aufruf: `npm run check:logic`.
 */
import { gruppiereNachRelevanz, istGruppiert, stufeReiheEin, ueberschriftSagtStatus } from '../web/src/lib/db-relevanz.ts'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-09'
const titel = (id: number, extra: Partial<Title> = {}) => ({ id, jpYear: 2020, streams: [], ...extra }) as unknown as Title
const termin = (titleId: number, von: string, folgen: number) => ({ titleId, releaseType: 'weekly', schedule: { firstEpisodeDate: von, episodeCount: folgen } }) as unknown as Release
const reihe = (...members: Title[]) => ({ main: members[0], members })
const lauf = (gruppen: ReturnType<typeof reihe>[], releases: Release[], heute = HEUTE) => {
  const by = new Map<number, Release[]>()
  for (const r of releases) by.set(r.titleId, [...(by.get(r.titleId) ?? []), r])
  return gruppiereNachRelevanz(gruppen, by, heute)
}
const art = (g: ReturnType<typeof lauf>, id: number) => g.find((x) => x.eintraege.some((e) => e.gruppe.main.id === id))?.art

console.log('\nDatenbank-Relevanz: Gruppen')
// Rooster Fighter: Erstausgabe Disney+ bis 31.05., später ein weiterer Anbieter mit laufenden Folgen.
const rooster = titel(1, { deErstausgabe: { von: '2026-03-01', bis: '2026-05-31', synchro: true } })
const g1 = lauf([reihe(rooster)], [termin(1, '2026-03-01', 13), termin(1, '2026-09-20', 13)])
pruefe('Rooster-Fighter-Fall: Erstausgabe vorbei, späteres Neuerscheinen läuft → „Schon erschienen"', art(g1, 1) === 'erschienen', art(g1, 1))

const laufend = titel(2, { deErstausgabe: { von: '2026-09-01', bis: '2026-11-30' } })
const baldT = titel(3, { deErstausgabe: { von: '2026-10-20' } })
const ohneEnde = titel(4, { deErstausgabe: { von: '2026-10-01' } })
const g2 = lauf([reihe(laufend), reihe(baldT), reihe(ohneEnde)], [termin(2, '2026-09-01', 13), termin(3, '2026-10-20', 12), termin(4, '2026-10-01', 12)])
pruefe('Erstausgabe läuft bis in die Zukunft → „Läuft jetzt"', art(g2, 2) === 'laeuft')
pruefe('Erstausgabe beginnt später → „Demnächst" mit Startdatum', art(g2, 3) === 'bald' && g2.find((x) => x.art === 'bald')?.eintraege[0].ab === '2026-10-20')
pruefe('Erstausgabe ohne Ende, frühester Termin läuft → „Läuft jetzt"', art(g2, 4) === 'laeuft')

console.log('\nDatenbank-Relevanz: ohne Erstausgabe gilt der Status aus logic.ts')
const g3 = lauf([reihe(titel(5)), reihe(titel(6)), reihe(titel(7))], [termin(5, '2026-09-01', 13), termin(6, '2026-12-01', 12), termin(7, '2024-01-01', 12)])
pruefe('laufender Termin → „Läuft jetzt"', art(g3, 5) === 'laeuft')
pruefe('Termin in der Zukunft → „Demnächst"', art(g3, 6) === 'bald')
pruefe('abgeschlossener Termin → „Schon erschienen"', art(g3, 7) === 'erschienen')

console.log('\nDatenbank-Relevanz: Disc-Termine')
const disc = (titleId: number, am: string) => ({ titleId, releaseType: 'disc', schedule: { firstEpisodeDate: am } }) as unknown as Release
const g5 = lauf([reihe(titel(14, { deErstausgabe: { von: HEUTE } })), reihe(titel(15)), reihe(titel(16))], [disc(14, HEUTE), disc(15, HEUTE), disc(16, '2026-11-01')])
pruefe('Boruto-Fall: Disc heute (mit und ohne Erstausgabe) → „Schon erschienen"', art(g5, 14) === 'erschienen' && art(g5, 15) === 'erschienen', [art(g5, 14), art(g5, 15)])
pruefe('Disc in der Zukunft → „Demnächst"', art(g5, 16) === 'bald')
const tv = (titleId: number, folgen: number) => ({ titleId, platform: 'tv', releaseType: 'weekly', schedule: { firstEpisodeDate: HEUTE, episodeCount: folgen } }) as unknown as Release
const g6 = lauf([reihe(titel(21220, { deErstausgabe: { von: '2016-11-10', synchro: true } })), reihe(titel(18)), reihe(titel(19, { deErstausgabe: { von: '2026-10-05' } }))], [tv(21220, 1), tv(18, 1), tv(19, 12)])
pruefe('Boruto-Film (Id 21220) und Film ohne Erstausgabe: eine TV-Sendung heute ist nicht „Läuft jetzt"', art(g6, 21220) === 'erschienen' && art(g6, 18) === 'erschienen', [art(g6, 21220), art(g6, 18)])
pruefe('eine TV-Reihe mit mehreren Folgen läuft weiter', art(g6, 19) === 'laeuft')

console.log('\nDatenbank-Relevanz: Prüfer-Funde (echter Bestand vom 09.10.2026)')
const plat = (titleId: number, platform: string, von: string, folgen: number, typ = 'weekly') =>
  ({ titleId, platform, releaseType: typ, schedule: { firstEpisodeDate: von, episodeCount: folgen } }) as unknown as Release
const g7 = lauf(
  [
    reihe(titel(179, { deErstausgabe: { von: '2023-02-23' } })), // Yashahime: deutsch seit 2023, TV ab 07.10.2026
    reihe(titel(180)), // Gachiakuta: Crunchyroll 2025 bis 2026, jetzt Disney+ und TV
    reihe(titel(181, { deErstausgabe: { von: '2024-01-10' } })), // deutsch längst da, nur ein späterer Termin steht an
    reihe(titel(182)), // Vinland-Saga-Fall: früheres Streaming, dann Disc
    reihe(titel(183)), // nur künftige Disc, kein Hinweis auf frühere Synchro
    reihe(titel(184, { streams: [{ platform: 'primevideo', dub: true }] as unknown as Title['streams'] })), // Disc, aber Stream mit Synchro
    reihe(titel(185, { jpYear: 2026 })), // Black-Clover-Fall: kein Termin, nichts belegt
    reihe(titel(186, { jpYear: 2026 }), titel(187)), // Reihe mit einem Teil „erschienen"
  ],
  [
    plat(179, 'tv', '2026-10-07', 12),
    plat(180, 'crunchyroll', '2025-07-06', 24), plat(180, 'disneyplus', '2026-09-01', 24), plat(180, 'tv', '2026-10-05', 24),
    plat(181, 'tv', '2026-10-20', 12),
    plat(182, 'crunchyroll', '2024-01-01', 12), disc(182, '2026-11-01'),
    disc(183, '2026-11-01'), disc(184, '2026-11-01'),
  ],
)
pruefe('Yashahime: deutsche Fassung seit 2023, TV-Termin später → „Schon erschienen"', art(g7, 179) === 'erschienen', art(g7, 179))
pruefe('Gachiakuta: erste Fassung (Crunchyroll) vorbei, späterer Lauf zählt nicht → „Schon erschienen"', art(g7, 180) === 'erschienen', art(g7, 180))
pruefe('Erstausgabe vor einem künftigen Termin → „Schon erschienen", nicht „Demnächst"', art(g7, 181) === 'erschienen', art(g7, 181))
pruefe('Vinland-Saga-Fall: früherer Streaming-Termin, Disc folgt → „Schon erschienen"', art(g7, 182) === 'erschienen', art(g7, 182))
pruefe('nur künftige Disc, kein Hinweis auf Synchro → „Demnächst"', art(g7, 183) === 'bald', art(g7, 183))
pruefe('künftige Disc, aber Stream mit Synchro → „Schon erschienen"', art(g7, 184) === 'erschienen', art(g7, 184))
pruefe('kein belegter Termin → „Ohne bekannten Termin"', art(g7, 185) === 'unbekannt', art(g7, 185))
pruefe('eine Reihe mit einem erschienenen Teil ist erschienen', art(g7, 186) === 'erschienen', art(g7, 186))
pruefe('„Ohne bekannten Termin" steht als letzte Gruppe', g7.at(-1)?.art === 'unbekannt', g7.map((x) => x.art))

console.log('\nDatenbank-Relevanz: Reihen, Reihenfolge, Cartoons')
const staffel1 = titel(8, { deErstausgabe: { von: '2020-01-01', bis: '2020-03-31' } })
const staffel2 = titel(9, { deErstausgabe: { von: '2026-10-01', bis: '2026-12-20' } })
const g4 = lauf([reihe(staffel1, staffel2)], [termin(9, '2026-10-01', 12)])
pruefe('eine Reihe läuft, sobald eine Staffel läuft (Kachel ist die laufende Staffel 9)', art(g4, 9) === 'laeuft' && art(g4, 8) === undefined, [art(g4, 8), art(g4, 9)])
const cartoon = titel(10, { westlich: true, deErstausgabe: { von: '2026-10-08', bis: '2026-12-31' } })
const anime = titel(11, { deErstausgabe: { von: '2026-09-01', bis: '2026-12-31' } })
const juengerer = titel(12, { deErstausgabe: { von: '2026-10-05', bis: '2026-12-31' } })
const ids = lauf([reihe(cartoon), reihe(anime), reihe(juengerer)], []).flatMap((x) => x.eintraege.map((e) => e.gruppe.main.id)).join()
pruefe('in der Gruppe: jüngster Start zuerst, Cartoons zuletzt', ids === '12,11,10', ids)
pruefe('leere Gruppen fallen weg', lauf([reihe(titel(13))], []).map((x) => x.art).join() === 'erschienen')

console.log('\nDatenbank-Relevanz: Suche und Statuspille')
pruefe('Relevanz ohne Suche gruppiert', istGruppiert('relevanz', ''))
pruefe('mit Suche gilt die Treffergüte, keine Gruppen', !istGruppiert('relevanz', ' wolf '))
pruefe('A–Z, Jahr, Bewertung gruppieren nie', !istGruppiert('titel', '') && !istGruppiert('jahr', '') && !istGruppiert('score', ''))
pruefe('die Überschrift „Läuft jetzt" ersetzt die Pille „Läuft", nicht aber „Abgeschlossen"', ueberschriftSagtStatus('laeuft', 'airing') && !ueberschriftSagtStatus('laeuft', 'abgeschlossen'))

console.log('\nDatenbank-Relevanz: Cartoons haben keine Termine, aber ein Startdatum')
const cartoonTitel = [
  titel(30, { westlich: true, jpYear: 2019, jpStart: '2019-05-01' }),
  titel(31, { westlich: true, jpYear: 2026 }),
  titel(32, { westlich: true, jpYear: 2030, jpStart: '2030-01-01' }),
  titel(33, { westlich: true, jpYear: undefined }),
  titel(34, { jpYear: undefined, jpStart: "2019-05-01" }),
]
const gCartoon = lauf(cartoonTitel.map((c) => reihe(c)), [])
pruefe('Cartoon mit Startdatum in der Vergangenheit → „Schon erschienen"', art(gCartoon, 30) === 'erschienen', art(gCartoon, 30))
pruefe('Cartoon nur mit laufendem Jahr (Jahresende noch nicht erreicht) → „Ohne bekannten Termin"', art(gCartoon, 31) === 'unbekannt', art(gCartoon, 31))
pruefe('Platzhalter in der Zukunft (2030-01-01) ist kein Datum → „Ohne bekannten Termin"', art(gCartoon, 32) === 'unbekannt', art(gCartoon, 32))
pruefe('Cartoon ohne jedes Datum → „Ohne bekannten Termin"', art(gCartoon, 33) === 'unbekannt', art(gCartoon, 33))
pruefe('Anime ohne Termin und mit nur einem japanischen Startdatum bleibt „Ohne bekannten Termin" (das ist keine deutsche Ausgabe)', art(gCartoon, 34) === 'unbekannt', art(gCartoon, 34))
pruefe('Kein stiller Verlust: Summe der Gruppen = Gesamtzahl', gCartoon.reduce((n, g) => n + g.eintraege.length, 0) === cartoonTitel.length)

console.log('\nDatenbank-Relevanz: „Demnächst" nur, solange die Staffel nirgends erschienen ist (Daniel, 26.10.2026; Daten: public/data vom 28.10.2026)')
const H2 = '2026-10-28'
const crDub = [{ platform: 'crunchyroll', dub: true, dubRanges: [{ from: 1, to: 12, dub: true }] }] as unknown as Title['streams']
const lastBoss1 = titel(180523, { franchiseId: 180523, titleDe: 'A Wild Last Boss Appeared!', jpYear: 2025, format: 'ONA', deErstausgabe: { von: '2026-11-06', synchro: true }, streams: crDub })
const lastBoss2 = titel(204389, { franchiseId: 180523, titleDe: 'A Wild Last Boss Appeared! Staffel 2', jpYear: 2026, format: 'ONA', streams: crDub })
const bananaFish = titel(100388, { titleDe: 'Banana Fish', jpYear: 2018 })
const cafe1 = titel(154412, { titleDe: 'The Café Terrace and Its Goddesses', deErstausgabe: { von: '2026-11-20', synchro: true }, streams: crDub })
const g8 = lauf(
  [reihe(lastBoss1), reihe(bananaFish), reihe(cafe1), reihe(titel(940001, { deErstausgabe: { von: '2026-11-20' } })), reihe(titel(940002)), reihe(titel(940003)), reihe(titel(940004)), reihe(titel(940005, { deErstausgabe: { von: '2026-11-20' } }))],
  [
    disc(180523, '2026-11-06'),
    disc(100388, '2026-08-21'), disc(100388, '2026-11-06'),
    disc(154412, '2026-11-20'),
    plat(940001, 'tv', '2026-10-20', 12), // Fernsehen zählt nicht: die deutsche Erstausgabe steht noch aus
    plat(940002, 'primevideo', '2026-10-01', 1, 'kauf'), disc(940002, '2026-12-01'), // digitaler Kauf zählt
    { ...plat(940003, 'crunchyroll', '2026-10-01', 12), widerlegt: true } as unknown as Release, disc(940003, '2026-12-01'), // widerlegter Termin zählt nicht
    plat(940004, 'crunchyroll', '2026-10-29', 12), // erst morgen: noch nicht erschienen
    disc(940005, H2), // Disc heute: erschienen (Grenze)
  ],
  H2,
)
pruefe('Last Boss S1 (Crunchyroll-Synchro, Disc erst 06.11.) → „Schon erschienen"', art(g8, 180523) === 'erschienen', art(g8, 180523))
pruefe('Banana Fish (Disc 21.08. vorbei, zweite Disc 06.11.) → „Schon erschienen"', art(g8, 100388) === 'erschienen', art(g8, 100388))
pruefe('Café Terrace (Erstausgabe 20.11., aber Crunchyroll-Synchro) → „Schon erschienen"', art(g8, 154412) === 'erschienen', art(g8, 154412))
pruefe('TV-Termin in der Vergangenheit macht nicht „erschienen": Erstausgabe 20.11. bleibt „Demnächst"', art(g8, 940001) === 'bald', art(g8, 940001))
pruefe('digitaler Kauf in der Vergangenheit → „Schon erschienen"', art(g8, 940002) === 'erschienen', art(g8, 940002))
pruefe('widerlegter Termin zählt nicht: künftige Disc → „Demnächst"', art(g8, 940003) === 'bald', art(g8, 940003))
pruefe('Termin erst morgen → „Demnächst"', art(g8, 940004) === 'bald', art(g8, 940004))
pruefe('Disc heute (Erstausgabe erst 20.11.) → „Schon erschienen"', art(g8, 940005) === 'erschienen', art(g8, 940005))

console.log('\nDatenbank-Relevanz: Kachel nennt die Staffel (titelId, Beschriftung)')
const lb = stufeReiheEin([lastBoss1, lastBoss2], new Map([[180523, [disc(180523, '2026-11-06')]], [204389, [plat(204389, 'crunchyroll', '2026-10-24', 12)]]]), H2)
pruefe('Last Boss: Reihe läuft, titelId ist Staffel 2 (nicht der Vertreter 180523)', lb.art === 'laeuft' && lb.titelId === 204389, lb)
const seduction1 = titel(158559, { franchiseId: 158559, titleDe: '2.5 Dimensional Seduction', jpYear: 2024, jpSeason: 'SUMMER', format: 'TV', deErstausgabe: { von: '2025-08-29', synchro: true } })
const seduction2 = titel(185515, { franchiseId: 158559, titleDe: '2.5 Dimensional Seduction', jpYear: undefined, jpSeason: undefined, format: 'TV' })
const g9 = lauf([reihe(seduction1, seduction2), reihe(lastBoss1, lastBoss2), reihe(titel(940010))], [disc(158559, '2026-09-07'), disc(185515, '2026-10-30'), disc(180523, '2026-11-06'), plat(204389, 'crunchyroll', '2026-10-24', 12), disc(940010, '2026-12-01')], H2)
const kacheln = g9.filter((x) => x.art === 'bald' || x.art === 'laeuft').flatMap((x) => x.eintraege.map((e) => ({ art: x.art, id: e.gruppe.main.id, titelId: e.titelId, staffel: e.staffel, mitglieder: e.gruppe.members.length })))
const zwei = (a: [number, string, string], b: [number, string, string], kind: string) => {
  const by2 = new Map<number, Release[]>([[a[0], [plat(a[0], 'crunchyroll', a[1], 12)]], [b[0], [plat(b[0], 'crunchyroll', b[1], 12)]]])
  return stufeReiheEin([titel(a[0], { deErstausgabe: { von: a[1], bis: a[2] } }), titel(b[0], { deErstausgabe: { von: b[1], bis: b[2] } })], by2, kind)
}
const zweiLaeuft = zwei([940021, '2026-09-01', '2026-12-31'], [940022, '2026-10-01', '2026-12-31'], H2)
pruefe('zwei laufende Staffeln: die jüngere liefert Datum und titelId', zweiLaeuft.titelId === 940022 && zweiLaeuft.ab === '2026-10-01', zweiLaeuft)
const zweiLaeuftUmgekehrt = zwei([940023, '2026-10-01', '2026-12-31'], [940024, '2026-09-01', '2026-12-31'], H2)
pruefe('zwei laufende Staffeln, Reihenfolge vertauscht: wieder die jüngere', zweiLaeuftUmgekehrt.titelId === 940023, zweiLaeuftUmgekehrt)
const zweiBald = zwei([940025, '2026-12-01', '2027-02-28'], [940026, '2026-11-15', '2027-02-28'], H2)
pruefe('zwei kommende Staffeln: die nähere liefert Datum und titelId', zweiBald.art === 'bald' && zweiBald.titelId === 940026 && zweiBald.ab === '2026-11-15', zweiBald)
const zweiBaldUmgekehrt = zwei([940027, '2026-11-15', '2027-02-28'], [940028, '2026-12-01', '2027-02-28'], H2)
pruefe('zwei kommende Staffeln, Reihenfolge vertauscht: wieder die nähere', zweiBaldUmgekehrt.titelId === 940027, zweiBaldUmgekehrt)
const nurErschienen = stufeReiheEin([titel(940031, { deErstausgabe: { von: '2020-01-01', bis: '2020-03-31' } }), titel(940032, { deErstausgabe: { von: '2021-01-01', bis: '2021-03-31' } })], new Map(), H2)
pruefe('Reihe nur aus erschienenen Staffeln: „erschienen", titelId = erstes Mitglied', nurErschienen.art === 'erschienen' && nurErschienen.titelId === 940031, nurErschienen)
pruefe('jede Kachel in „Läuft jetzt"/„Demnächst" trägt titelId, und es ist ihr Titel', kacheln.length === 3 && kacheln.every((k) => k.titelId === k.id), kacheln)
pruefe('Reihe mit zwei Staffeln: „Staffel 2" auf der Kachel von 2.5 Dimensional Seduction (Demnächst) und Last Boss (Läuft jetzt)', kacheln.find((k) => k.id === 185515)?.staffel === 'Staffel 2' && kacheln.find((k) => k.id === 204389)?.staffel === 'Staffel 2', kacheln)
pruefe('Titel mit einer Staffel: keine Beschriftung', kacheln.find((k) => k.id === 940010)?.staffel === undefined, kacheln)
pruefe('Reihe mit mehreren Staffeln: keine Kachel ohne Staffelzahl', kacheln.filter((k) => [185515, 204389].includes(k.id)).every((k) => /Staffel \d/.test(k.staffel ?? '')), kacheln)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nDatenbank-Relevanz: alles in Ordnung.')
