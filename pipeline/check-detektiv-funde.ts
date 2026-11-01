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
import type { Bestand } from '../tools/daten-detektiv/laden.ts'
import { ohneJedenBeleg } from '../tools/daten-detektiv/regeln-titel.ts'
import { premiereGegenErstausgabe } from '../tools/daten-detektiv/regeln-quellen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBehobene Funde des Daten-Detektivs:')
{
  // DD-13: ein Kinofilm im Fernsehen ist ein Werk, die zweite Sendung eine Wiederholung
  const filmTitel = new Map([[21220, { id: 21220, titleDe: 'Boruto: Naruto the Movie', format: 'MOVIE', episodes: 1 } as Title]])
  const sendung = (start: string) => ({ titleId: 21220, titel: 'Boruto', sender: 'ProSieben MAXX', start, ende: start, gesehenAm: '2026-10-06' })
  const tv = releasesAusTvProgramm([sendung('2026-10-09T20:15:00+02:00'), sendung('2026-10-10T02:15:00+02:00')], filmTitel, [])
  pruefe('DD-13: zwei Sendungen eines Films sind eine Folge', tv.length === 1 && tv[0].schedule.episodeCount === 1 && Object.keys(tv[0].schedule.observed ?? {}).length === 1, tv[0]?.schedule)
  const serie = new Map([[5, { id: 5, titleDe: 'Serie', format: 'TV', episodes: 12 } as Title]])
  const tvSerie = releasesAusTvProgramm(['2026-10-09', '2026-10-10'].map((d) => ({ titleId: 5, titel: 'S', sender: 'X', start: `${d}T20:15:00+02:00`, ende: `${d}T20:45:00+02:00`, gesehenAm: d })), serie, [])
  pruefe('DD-13: zwei Sendetage einer Serie bleiben zwei Folgen', tvSerie[0]?.schedule.episodeCount === 2, tvSerie[0]?.schedule)

  // DD-02/DD-19: der Sammelartikel nennt 23 Folgen für 86 (Teil 1 hat 11) — die Zahl gehört nicht an diesen Titel
  pruefe('DD-02: Folgenzahl weit über dem Werk wird nicht übernommen', zeitplanAusVorschlag({ folgen: 23 }, 'batch', '2026-10-08', { episodes: 11, jpYear: 2021 }).schedule.episodeCount === undefined)
  pruefe('DD-02: Folgenzahl nahe am Werk bleibt (Sankarea 13 bei 12)', zeitplanAusVorschlag({ folgen: 13 }, 'batch', '2026-10-15', { episodes: 12, jpYear: 2012 }).schedule.episodeCount === 13)
  pruefe('DD-02: die Grenze ist die der Ergebnisprüfung', folgenzahlUeberWerk(23, 11) && !folgenzahlUeberWerk(22, 11) && !folgenzahlUeberWerk(13, 12))
  const kuratiert = loadCurated()
  const eintrag = (slug: string) => kuratiert.find((e) => e.slug === slug)
  const acht = ['adn-1423-s1-20261008-116589', 'adn-1423-s1-20261008-131586'].map(eintrag)
  pruefe('DD-02/DD-19: 86 bei ADN ist in zwei Teile zerlegt, jeder mit Weg', acht.every((e) => e?.platform === 'adn' && !!e.platformUrl) && (acht[0]?.schedule?.episodeCount ?? 0) + (acht[1]?.schedule?.episodeCount ?? 0) === 23, acht)
  pruefe('DD-02: Teil 2 von 86 zählt ab Folge 12 (ADN nummeriert durch)', acht[1]?.schedule?.firstEpisodeNumber === 12)

  // DD-11: Katalogaufnahmen älterer Titel tragen „Im Angebot seit"
  const katalog = ['yu-gi-oh-s2-disneyplus', 'yu-gi-oh-s3-disneyplus', 'naruto-s4-disneyplus', 'naruto-shippuden-s1-disneyplus', 'naruto-shippuden-s3-disneyplus', 'black-clover-s1-disneyplus',
    'bleach-diamonddust-rebellion-adn', 'bleach-fade-to-black-adn', 'bleach-hell-verse-adn', 'spy-x-family-s1-teil1-disneyplus', 'spy-x-family-s1-teil2-disneyplus', 'dororo-joyn', 'demon-slayer-s1-primevideo']
  const ohneBedeutung = katalog.filter((s) => eintrag(s)?.dateMeaning !== 'available-from')
  pruefe('DD-11: 13 Katalogaufnahmen tragen dateMeaning available-from', ohneBedeutung.length === 0, ohneBedeutung)

  // DD-11: Wiederaufführung im Kino und Wiederholung im TV sind keine Premiere-Behauptung; ein Streaming-Release ohne Hinweis bleibt Treffer
  const alt = { titleId: 1, name: 'Alt', releaseType: 'movie', schedule: { firstEpisodeDate: '2026-08-18' }, sources: [] }
  const bestand11 = {
    titles: [{ id: 1, titleEn: 'Alt', slug: 'alt', deErstausgabe: { von: '2003-06-19', synchro: true } }],
    releases: ['kino', 'tv', 'netflix', 'disneyplus'].map((platform) => ({ ...alt, platform, slug: `alt-${platform}` })),
  } as unknown as Bestand
  const premiere11 = premiereGegenErstausgabe(bestand11).treffer.map((t) => t.schluessel)
  pruefe('DD-11: Kino und TV (Wiederaufführung/Wiederholung) bleiben still, Streaming wird gemeldet', premiere11.join() === 'alt-netflix,alt-disneyplus', premiere11)

  // DD-06: ein aniSearch-Eintrag, den ein Katalog-Titel „bekannt" machte, wird trotzdem geholt
  const zuordnung = { '170206': { anisearchId: 18828 }, '100': { anisearchId: 5 }, '200': { anisearchId: 6 } }
  const bekannt = durchAnilistBekannt(zuordnung, { '18828': 'd', '5': 'd' }, new Set([100]))
  pruefe('DD-06: Deutsch bei aniSearch, AniList-Titel nicht im Hauptbestand: Eintrag offen', !bekannt.includes('18828'), bekannt)
  pruefe('DD-06: AniList-Titel im Hauptbestand oder ohne Deutsch: Eintrag bekannt', bekannt.includes('5') && bekannt.includes('6'), bekannt)

  // DD-24: vertont oder abgebrochen bei aniSearch ist ein Beleg (Bastard!!, Scott Pilgrim hebt ab); geplant (`p`) und unbekannt bleiben Treffer
  const nackt = (id: number, anisearchId?: number) => ({ id, anisearchId, titleEn: `T${id}`, streams: [{ platform: 'netflix', url: 'x', zugang: 'abo' }], slug: `t${id}` })
  const bestand24 = {
    titles: [nackt(1), nackt(2), nackt(3), nackt(4), nackt(5, 99)],
    releases: [],
    anisearchDubs: { '1': 'd', '2': 'c', '3': 'p' },
    anisearchDubIds: { '99': 'd' },
  } as unknown as Bestand
  const ohneBeleg = ohneJedenBeleg(bestand24).treffer.map((t) => t.schluessel)
  // DD-16: der Artikel verlinkt die Amazon-Ausgabe, also steht sie als Kaufweg da und nicht eine Suche
  const produktseite = ['auto-153288-disc', 'jujutsu-kaisen-hidden-inventory-premature-death-blu-ray'].filter((s) => !/amazon\.de\/dp\/B0[A-Z0-9]{8}$/.test(eintrag(s)?.buyUrl ?? ''))
  pruefe('DD-16: Kaiju No. 8 Staffel 1 und der Jujutsu-Film führen die Amazon-Produktseite', produktseite.length === 0, produktseite)
  pruefe('DD-24: d und c bei aniSearch zählen als Beleg, auch über die aniSearch-Kennung', ohneBeleg.join() === '3,4', ohneBeleg)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen zu den Detektiv-Funden halten.')
process.exit(verletzt ? 1 : 0)
