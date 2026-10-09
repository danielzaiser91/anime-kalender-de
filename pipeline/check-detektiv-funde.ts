/**
 * Gegenproben zu den Funden des Daten-Detektivs vom 08.10.2026 (`docs/wissen/daten-detektiv.md`): je behobenem Fund eine Zusicherung,
 * die rot wird, wenn der Fix verloren geht. Die harten Bau-Regeln stehen in `pipeline/check-invarianten.ts`.
 */
import type { Title } from '../shared/types.ts'
import { loadCurated } from './lib/curated.ts'
import { zeitplanAusVorschlag } from './lib/meldungen.ts'
import { folgenzahlUeberWerk } from './lib/pruefung.ts'
import { releasesAusTvProgramm } from './lib/tv-termine.ts'
import { durchAnilistBekannt } from './fetch-anisearch-eintraege.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBehobene Funde des Daten-Detektivs:')
{
  // D-13: ein Kinofilm im Fernsehen ist ein Werk, die zweite Sendung eine Wiederholung
  const filmTitel = new Map([[21220, { id: 21220, titleDe: 'Boruto: Naruto the Movie', format: 'MOVIE', episodes: 1 } as Title]])
  const sendung = (start: string) => ({ titleId: 21220, titel: 'Boruto', sender: 'ProSieben MAXX', start, ende: start, gesehenAm: '2026-10-06' })
  const tv = releasesAusTvProgramm([sendung('2026-10-09T20:15:00+02:00'), sendung('2026-10-10T02:15:00+02:00')], filmTitel, [])
  pruefe('D-13: zwei Sendungen eines Films sind eine Folge', tv.length === 1 && tv[0].schedule.episodeCount === 1 && Object.keys(tv[0].schedule.observed ?? {}).length === 1, tv[0]?.schedule)
  const serie = new Map([[5, { id: 5, titleDe: 'Serie', format: 'TV', episodes: 12 } as Title]])
  const tvSerie = releasesAusTvProgramm(['2026-10-09', '2026-10-10'].map((d) => ({ titleId: 5, titel: 'S', sender: 'X', start: `${d}T20:15:00+02:00`, ende: `${d}T20:45:00+02:00`, gesehenAm: d })), serie, [])
  pruefe('D-13: zwei Sendetage einer Serie bleiben zwei Folgen', tvSerie[0]?.schedule.episodeCount === 2, tvSerie[0]?.schedule)

  // D-02/D-19: der Sammelartikel nennt 23 Folgen für 86 (Teil 1 hat 11) — die Zahl gehört nicht an diesen Titel
  pruefe('D-02: Folgenzahl weit über dem Werk wird nicht übernommen', zeitplanAusVorschlag({ folgen: 23 }, 'batch', '2026-10-08', { episodes: 11, jpYear: 2021 }).schedule.episodeCount === undefined)
  pruefe('D-02: Folgenzahl nahe am Werk bleibt (Sankarea 13 bei 12)', zeitplanAusVorschlag({ folgen: 13 }, 'batch', '2026-10-15', { episodes: 12, jpYear: 2012 }).schedule.episodeCount === 13)
  pruefe('D-02: die Grenze ist die der Ergebnisprüfung', folgenzahlUeberWerk(23, 11) && !folgenzahlUeberWerk(22, 11) && !folgenzahlUeberWerk(13, 12))
  const kuratiert = loadCurated()
  const eintrag = (slug: string) => kuratiert.find((e) => e.slug === slug)
  const acht = ['adn-1423-s1-20261008-116589', 'adn-1423-s1-20261008-131586'].map(eintrag)
  pruefe('D-02/D-19: 86 bei ADN ist in zwei Teile zerlegt, jeder mit Weg', acht.every((e) => e?.platform === 'adn' && !!e.platformUrl) && (acht[0]?.schedule?.episodeCount ?? 0) + (acht[1]?.schedule?.episodeCount ?? 0) === 23, acht)
  pruefe('D-02: Teil 2 von 86 zählt ab Folge 12 (ADN nummeriert durch)', acht[1]?.schedule?.firstEpisodeNumber === 12)

  // D-11: Katalogaufnahmen älterer Titel tragen „Im Angebot seit"
  const katalog = ['yu-gi-oh-s2-disneyplus', 'yu-gi-oh-s3-disneyplus', 'naruto-s4-disneyplus', 'naruto-shippuden-s1-disneyplus', 'naruto-shippuden-s3-disneyplus', 'black-clover-s1-disneyplus',
    'bleach-diamonddust-rebellion-adn', 'bleach-fade-to-black-adn', 'bleach-hell-verse-adn', 'spy-x-family-s1-teil1-disneyplus', 'spy-x-family-s1-teil2-disneyplus', 'dororo-joyn', 'demon-slayer-s1-primevideo']
  const ohneBedeutung = katalog.filter((s) => eintrag(s)?.dateMeaning !== 'available-from')
  pruefe('D-11: 13 Katalogaufnahmen tragen dateMeaning available-from', ohneBedeutung.length === 0, ohneBedeutung)

  // D-06: ein aniSearch-Eintrag, den ein Katalog-Titel „bekannt" machte, wird trotzdem geholt
  const zuordnung = { '170206': { anisearchId: 18828 }, '100': { anisearchId: 5 }, '200': { anisearchId: 6 } }
  const bekannt = durchAnilistBekannt(zuordnung, { '18828': 'd', '5': 'd' }, new Set([100]))
  pruefe('D-06: Deutsch bei aniSearch, AniList-Titel nicht im Hauptbestand: Eintrag offen', !bekannt.includes('18828'), bekannt)
  pruefe('D-06: AniList-Titel im Hauptbestand oder ohne Deutsch: Eintrag bekannt', bekannt.includes('5') && bekannt.includes('6'), bekannt)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen zu den Detektiv-Funden halten.')
process.exit(verletzt ? 1 : 0)
