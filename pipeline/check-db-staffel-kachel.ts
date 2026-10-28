/**
 * „Läuft jetzt" / „Demnächst" zeigen bei zusammengefassten Staffeln dieselbe Kachel wie ohne Zusammenfassung
 * (Daniel, 27.10.2026: Last Boss zeigte Staffel 1, obwohl Staffel 2 lief). Aufruf: `npm run check:logic`.
 */
import { groupByFranchise } from '../web/src/lib/db-gruppen.ts'
import { ordneListe } from '../web/src/lib/db-liste.ts'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-27'
const titel = (id: number, franchiseId: number, titleDe: string, jpYear: number, extra: Partial<Title> = {}) =>
  ({ id, franchiseId, titleDe, jpYear, jpSeason: 'FALL', format: 'TV', streams: [], ...extra }) as unknown as Title
const termin = (titleId: number, von: string, folgen: number) =>
  ({ titleId, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: von, episodeCount: folgen } }) as unknown as Release
const disc = (titleId: number, am: string) => ({ titleId, releaseType: 'disc', schedule: { firstEpisodeDate: am } }) as unknown as Release

// Last Boss und Aoashi wie im Bestand vom 27.10.2026: Staffel 1 erschienen, Staffel 2 läuft bzw. kommt.
const titles: Title[] = [
  titel(180523, 180523, 'A Wild Last Boss Appeared!', 2025, { deErstausgabe: { von: '2025-10-01', bis: '2025-12-20' } as Title['deErstausgabe'] }),
  titel(204389, 180523, 'A Wild Last Boss Appeared! Staffel 2', 2026, { deErstausgabe: { von: '2026-10-05', bis: '2026-12-31' } as Title['deErstausgabe'] }),
  titel(134732, 134732, 'Aoashi', 2022, { deErstausgabe: { von: '2022-04-01', bis: '2022-09-30' } as Title['deErstausgabe'] }),
  titel(191788, 134732, 'Aoashi Staffel 2', 2026, { deErstausgabe: { von: '2026-12-01' } as Title['deErstausgabe'] }),
  titel(900001, 900001, 'Einzelner Titel', 2026, { deErstausgabe: { von: '2026-10-01', bis: '2026-12-31' } as Title['deErstausgabe'] }),
  // Staffel 1 erschienen, Staffel 2 läuft, Staffel 3 angekündigt: S2 in „Läuft jetzt“ und S3 zusätzlich in „Demnächst“.
  titel(900010, 900010, 'Dreiteilige Reihe', 2024, { deErstausgabe: { von: '2024-04-01', bis: '2024-06-30' } as Title['deErstausgabe'] }),
  titel(900011, 900010, 'Dreiteilige Reihe Staffel 2', 2026, { deErstausgabe: { von: '2026-10-05', bis: '2026-12-31' } as Title['deErstausgabe'] }),
  titel(900012, 900010, 'Dreiteilige Reihe Staffel 3', 2027, { deErstausgabe: { von: '2027-01-10' } as Title['deErstausgabe'] }),
]
const by = new Map<number, Release[]>()
for (const r of [termin(180523, '2025-10-01', 12), termin(204389, '2026-10-05', 12), termin(134732, '2022-04-01', 12), termin(191788, '2026-12-01', 12), disc(180523, '2026-03-01'), termin(900001, '2026-10-01', 12), termin(900010, '2024-04-01', 12), termin(900011, '2026-10-05', 12), termin(900012, '2027-01-10', 12)]) {
  by.set(r.titleId, [...(by.get(r.titleId) ?? []), r])
}

const liste = (zusammen: boolean, suche = '') => {
  const base = zusammen ? groupByFranchise(titles) : titles.map((t) => ({ main: t, members: [t] }))
  return ordneListe(base, 'relevanz', suche, by, HEUTE).liste
}
const inGruppe = (l: ReturnType<typeof liste>, art: string) => l.filter((e) => e.art === art).map((e) => e.main.id)

console.log('\nDatenbank-Kacheln: Staffeln zusammenfassen')
const an = liste(true)
const aus = liste(false)
pruefe('Läuft jetzt: Kachel Last Boss ist Staffel 2 (Name, Klickziel)', an.some((e) => e.art === 'laeuft' && e.main.id === 204389 && e.main.titleDe === 'A Wild Last Boss Appeared! Staffel 2' && e.members.length === 1), inGruppe(an, 'laeuft'))
pruefe('Läuft jetzt: mit und ohne Zusammenfassung dieselben Kacheln (Name und Kennung)', JSON.stringify(inGruppe(an, 'laeuft').sort()) === JSON.stringify(inGruppe(aus, 'laeuft').sort()), [inGruppe(an, 'laeuft'), inGruppe(aus, 'laeuft')])
const sortiert = (l: ReturnType<typeof liste>, art: string) => JSON.stringify(inGruppe(l, art).sort((a, b) => a - b))
pruefe('Demnächst: Aoashi Staffel 2 (nicht Staffel 1), wie ohne Zusammenfassung', inGruppe(an, 'bald').includes(191788) && !inGruppe(an, 'bald').includes(134732), inGruppe(an, 'bald'))
pruefe('Staffel 2 läuft, Staffel 3 angekündigt: S2 in „Läuft jetzt“, S3 zusätzlich in „Demnächst“', inGruppe(an, 'laeuft').includes(900011) && inGruppe(an, 'bald').includes(900012) && !inGruppe(an, 'bald').includes(900011), [inGruppe(an, 'laeuft'), inGruppe(an, 'bald')])
pruefe('Demnächst: dieselbe Menge mit und ohne Zusammenfassung', sortiert(an, 'bald') === sortiert(aus, 'bald'), [sortiert(an, 'bald'), sortiert(aus, 'bald')])
pruefe('Staffel 1 steht nicht noch einmal in „Schon erschienen"', !inGruppe(an, 'erschienen').some((id) => id === 180523 || id === 134732), inGruppe(an, 'erschienen'))
pruefe('Läuft jetzt trägt keine Kachel mit mehreren Mitgliedern („N Staffeln"-Hinweis entfällt)', an.filter((e) => e.art === 'laeuft' || e.art === 'bald').every((e) => e.members.length === 1))

console.log('\nDatenbank-Kacheln: Suche und reine Erschienen-Reihen')
const suche = liste(true, 'last boss')
pruefe('Suche: Vertreter der Reihe bleibt Staffel 1 mit beiden Mitgliedern, ohne Gruppen', suche.some((e) => e.main.id === 180523 && e.members.length === 2 && e.art === undefined) && !suche.some((e) => e.main.id === 204389), suche.map((e) => e.main.id))
const nurAlt = ordneListe(groupByFranchise(titles.slice(0, 1).concat(titles.slice(2, 3))), 'relevanz', '', by, '2028-01-01').liste
pruefe('Erschienene Reihe: Vertreter bleibt der erste Teil', nurAlt.length === 2 && nurAlt.every((e) => e.art === 'erschienen'), nurAlt.map((e) => e.main.id))
const reihe = groupByFranchise(titles).find((g) => g.main.franchiseId === 180523)
pruefe('groupByFranchise: Vertreter bleibt Staffel 1, Mitglieder vollständig', reihe?.main.id === 180523 && reihe.members.length === 2, reihe?.main.id)
const spaeter = ordneListe(groupByFranchise(titles.slice(0, 2)), 'relevanz', '', by, '2028-01-01').liste
pruefe('Reihe ganz erschienen: eine Kachel mit Staffel 1 und beiden Mitgliedern', spaeter.length === 1 && spaeter[0].main.id === 180523 && spaeter[0].members.length === 2, spaeter.map((e) => e.main.id))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nDatenbank-Kacheln: alles in Ordnung.')
