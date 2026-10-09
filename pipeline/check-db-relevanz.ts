/**
 * Zusicherungen zur Gruppierung der Datenbank ohne Suche (Daniel, 09.10.2026): Maßgeblich ist die deutsche Erstausgabe,
 * ein späteres Neuerscheinen bei einem weiteren Anbieter zählt nicht. Aufruf: `npm run check:logic`.
 */
import { gruppiereNachRelevanz, istGruppiert, ueberschriftSagtStatus } from '../web/src/lib/db-relevanz.ts'
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
const lauf = (gruppen: ReturnType<typeof reihe>[], releases: Release[]) => {
  const by = new Map<number, Release[]>()
  for (const r of releases) by.set(r.titleId, [...(by.get(r.titleId) ?? []), r])
  return gruppiereNachRelevanz(gruppen, by, HEUTE)
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
const g6 = lauf([reihe(titel(21220, { deErstausgabe: { von: '2016-11-10', synchro: true } })), reihe(titel(18)), reihe(titel(19, { deErstausgabe: { von: '2016-11-10' } }))], [tv(21220, 1), tv(18, 1), tv(19, 12)])
pruefe('Boruto-Film (Id 21220) und Film ohne Erstausgabe: eine TV-Sendung heute ist nicht „Läuft jetzt"', art(g6, 21220) === 'erschienen' && art(g6, 18) === 'erschienen', [art(g6, 21220), art(g6, 18)])
pruefe('eine TV-Reihe mit mehreren Folgen läuft weiter', art(g6, 19) === 'laeuft')

console.log('\nDatenbank-Relevanz: Reihen, Reihenfolge, Cartoons')
const staffel1 = titel(8, { deErstausgabe: { von: '2020-01-01', bis: '2020-03-31' } })
const staffel2 = titel(9, { deErstausgabe: { von: '2026-10-01', bis: '2026-12-20' } })
const g4 = lauf([reihe(staffel1, staffel2)], [termin(9, '2026-10-01', 12)])
pruefe('eine Reihe läuft, sobald eine Staffel läuft', art(g4, 8) === 'laeuft')
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

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nDatenbank-Relevanz: alles in Ordnung.')
