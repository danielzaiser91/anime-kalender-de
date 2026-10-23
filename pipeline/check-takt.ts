/**
 * Zusicherungen zur Takt-Meldung und zu „Takt unklar“ (16.10.2026, Re:ZERO Staffel 4: Folge 14 nach fünf Wochen Pause,
 * Folge 15 einen Tag später). Erfundene Titel und Tage, kein Netz. Läuft in `check:logic`.
 * Die Rückrechnung am echten Datensatz liegt nicht hier (`check:logic` liest `public/data` nicht), sondern in der PR-Beschreibung.
 */
import type { NewsEintrag, Release, Title } from '../shared/types.ts'
import type { DatiertNews } from './lib/news-verlauf.ts'
import { taktTage, taktUnklar, PAUSE_AB_TAGEN, FOLGETAG_BIS_TAGEN } from '../shared/takt.ts'
import { taktKurz, taktSatz } from '../shared/takt-text.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { ohneDoppelteTakte, taktMeldungen } from './lib/news-takt.ts'
import { baueNews } from './lib/news.ts'
import { behalteEintrag } from './lib/news-obergrenze.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { laeuftNeben } from '../web/src/components/detail/antwort-block.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { newsKurz, newsSatz } from '../web/src/lib/news-text.ts'
import { newsSatz as mailSatz } from '../worker/src/mail-abschnitte.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const T = translate as unknown as (k: string, v?: Record<string, string | number>) => string
const A = '2026-03-04' // Start; ein Mittwoch

/** Folgen mit Abständen: `[[Folge, Tage seit A], …]`. */
const beob = (paare: [number, number][]): Record<string, string> => Object.fromEntries(paare.map(([n, d]) => [String(n), addDays(A, d)]))
const art = (paare: [number, number][], skip?: string[]) => taktTage({ observed: beob(paare), skipDates: skip }).map((t) => t.art ?? '-').join()

/* 1. Die Grenzen. Start (Folge 1) und danach im Wochentakt: keine Abweichung, auch nicht am Starttag mit mehreren Folgen. */
pruefe('Wochentakt: keine Abweichung', art([[1, 0], [2, 7], [3, 14], [4, 21]]) === '-,-,-')
pruefe('Auftaktblock am Starttag ist keine Abweichung', art([[1, 0], [2, 0], [3, 0], [4, 7]]) === '-')
pruefe('sechs und acht Tage tragen den Takt noch', art([[1, 0], [2, 6], [3, 14]]) === '-,-' && !taktUnklar({ observed: beob([[1, 0], [2, 6], [3, 14]]) }))
pruefe('neun Tage weichen ab, sind aber keine Meldung', art([[1, 0], [2, 9]]) === '-' && taktUnklar({ observed: beob([[1, 0], [2, 9]]) }))
pruefe('fünf Tage nach der vorigen Folge, an einem anderen als dem Sendetag: „folgetag“ (Grenze)', art([[1, 0], [2, 7], [3, 14], [4, 19]]) === '-,-,folgetag' && FOLGETAG_BIS_TAGEN === 5)
pruefe('sechs Tage nach der vorigen Folge: kein Folgetag mehr', art([[1, 0], [2, 7], [3, 14], [4, 20]]) === '-,-,-')
pruefe('ein Tag nach der vorigen Folge: „folgetag“', art([[1, 0], [2, 7], [3, 14], [4, 15]]) === '-,-,folgetag')
pruefe('Sendetag: nach einer späten Doppelfolge am Freitag ist der Mittwoch der gewohnte Tag, nicht „schon da“', art([[1, 0], [2, 7], [3, 14], [4, 16], [5, 21]]) === '-,-,folgetag,-')
pruefe('ohne erkennbaren Sendetag (zu wenig Tage, Gleichstand) keine Folgetag-Meldung', art([[1, 0], [2, 1]]) === '-' && art([[1, 0], [2, 3], [3, 4]]) === '-,-' && art([[1, 0], [2, 2], [3, 7], [4, 9]]) === '-,-,-')
pruefe('zwei Tage am Sendetag genügen als Mehrheit', art([[1, 0], [2, 7], [3, 8]]) === '-,folgetag')
pruefe('keine Rückschau: eine später folgende Mehrheit ändert eine frühere Einstufung nicht', art([[1, 0], [2, 7], [3, 8], [4, 15], [5, 22], [6, 29]]) === '-,folgetag,-,-,-')
pruefe('zwei Folgen an einem Tag nach dem Start: „doppelt“', art([[1, 0], [2, 7], [3, 14], [4, 14]]) === '-,doppelt')
pruefe('20 Tage Abstand sind keine Pause (Grenze 21), mit zwei Folgen „doppelt“', art([[1, 0], [2, 20]]) === '-' && art([[1, 0], [2, 20], [3, 20]]) === 'doppelt')
pruefe('21 Tage Abstand sind eine Pause', art([[1, 0], [2, 21]]) === 'pause' && PAUSE_AB_TAGEN === 21)
pruefe('Pause mit mehreren Folgen bleibt „pause“', art([[1, 0], [2, 35], [3, 35]]) === 'pause')
pruefe('Re:ZERO: Pause, Pause, Folgetag', art([[11, 0], [12, 84], [13, 84], [14, 119], [15, 120]]) === 'pause,pause,folgetag')
pruefe('eine Lücke in der Zählung (Folge 3 fehlt) sagt über den Abstand nichts', art([[1, 0], [2, 7], [4, 50]]) === '-')
pruefe('Folgen ohne Tag fallen heraus', taktTage({ observed: { '1': A, '2': '' } as Record<string, string> }).length === 0 && taktTage({ observed: { '1': '', '2': A } as Record<string, string> }).length === 0)
pruefe('Folge 0 und Unsinnsnummern fallen heraus', taktTage({ observed: { '0': A, '1': addDays(A, 1) } }).length === 0 && taktTage({ observed: { '1': A, x: addDays(A, 1), '-1': addDays(A, 2) } as Record<string, string> }).length === 0)
pruefe('ein Fünf-Tage-Abstand weicht ab, ein Sechs-Tage-Abstand nicht', taktTage({ observed: beob([[1, 0], [2, 5]]) })[0]?.abweichend === true && taktTage({ observed: beob([[1, 0], [2, 6]]) })[0]?.abweichend === false)
pruefe('zwei Folgen an einem Tag weichen auch im Sieben-Tage-Abstand ab', taktTage({ observed: beob([[1, 0], [2, 7], [3, 7]]) })[0]?.abweichend === true && taktTage({ observed: beob([[1, 0], [2, 7]]) })[0]?.abweichend === false)
const mitPause = (skip: string[]) => taktTage({ observed: beob([[1, 0], [2, 21]]), skipDates: skip })[0]?.abstand
pruefe('Sendepausen ziehen je sieben Tage ab; eine am Rand (vorige Folge, neue Folge) zählt nicht', mitPause([addDays(A, 7)]) === 14 && mitPause([addDays(A, 7), addDays(A, 14)]) === 7 && mitPause([A]) === 21 && mitPause([addDays(A, 21)]) === 21, [mitPause([addDays(A, 7)]), mitPause([A]), mitPause([addDays(A, 21)])])
pruefe('Folgen mit verdrehter Reihenfolge der Tage (Folge 3 vor Folge 2) erzeugen keine Abweichung', art([[1, 0], [2, 28], [3, 14]]) === '')
pruefe('Sendepause aus skipDates wird abgezogen: 14 Tage mit einer Pause dazwischen sind Takt', art([[1, 0], [2, 14]], [addDays(A, 7)]) === '-' && art([[1, 0], [2, 21]], [addDays(A, 7)]) === '-')
pruefe('zwei Pausen für 21 Tage → 7 Tage Takt; ohne passende skipDates bleibt es Pause', art([[1, 0], [2, 21]], [addDays(A, 7), addDays(A, 14)]) === '-' && art([[1, 0], [2, 21]], [addDays(A, -7)]) === 'pause')
const reihenfolge = taktTage({ observed: { '4': addDays(A, 15), '3': addDays(A, 14), '1': A, '2': addDays(A, 7) } })
pruefe('Reihenfolge der Eingabe ist egal', reihenfolge.map((t) => t.art ?? '-').join() === '-,-,folgetag' && reihenfolge[2]!.vorFolge === 3 && reihenfolge[2]!.abstand === 1, reihenfolge)

/* 2. „Takt unklar“: die letzten drei Folgen-Tage entscheiden; danach trägt der Takt wieder. */
const nachFolgetag = (regelTage: number): [number, number][] => [[1, 0], [2, 1], ...Array.from({ length: regelTage }, (_, i) => [3 + i, 8 + 7 * i] as [number, number])]
pruefe('Folgetag als letzter Tag: unklar', taktUnklar({ observed: beob(nachFolgetag(0)) }))
pruefe('ein regelmäßiger Tag danach: noch unklar', taktUnklar({ observed: beob(nachFolgetag(1)) }))
pruefe('zwei regelmäßige Tage danach: noch unklar', taktUnklar({ observed: beob(nachFolgetag(2)) }))
pruefe('drei regelmäßige Tage danach: der Takt trägt wieder (spätestens dann sichtbar)', !taktUnklar({ observed: beob(nachFolgetag(3)) }))
pruefe('ohne Beobachtung oder nur der Start: nicht unklar', !taktUnklar(undefined) && !taktUnklar({ observed: beob([[1, 0], [2, 0]]) }))

/* 3. Meldungen. Re:ZERO nachgebaut, relativ zu heute. */
const heute = todayIso()
const tag = (n: number) => addDays(heute, n)
const SERIE = 'GTAKT0001'
const url = `https://www.crunchyroll.com/de/series/${SERIE}/x`
const titel = (id: number): Title => ({ id, franchiseId: id, slug: `t-${id}`, titleEn: `T${id}`, keywords: [], genres: [], streams: [{ platform: 'crunchyroll', url, dub: true }] }) as unknown as Title
const release = (observed: Record<string, string>, extra: Record<string, unknown> = {}): Release =>
  ({ slug: 'r-1', titleId: 1, platform: 'crunchyroll', platformUrl: url, releaseType: 'weekly', sources: [url], schedule: { firstEpisodeDate: observed['1'], episodeCount: 20, observed }, ...extra }) as unknown as Release
/* F11 vor 121 Tagen, F12+F13 nach der Pause vor 37, F14 vor 2, F15 vor 1 Tag, F16 morgen (Wochenprogramm). */
const rezero = { '11': tag(-121), '12': tag(-37), '13': tag(-37), '14': tag(-2), '15': tag(-1), '16': tag(1) }
const rz = taktMeldungen(release({ '1': tag(-170), ...rezero }), heute)
pruefe('Re:ZERO: drei Meldungen (Pause 12–13, Pause 14, Folgetag 15), keine für den künftigen Tag', rz.map((m) => `${m.takt}${m.von}`).join() === 'pause12,pause14,folgetag15', rz.map((m) => `${m.takt}${m.von}`))
pruefe('Meldung trägt Tag, Abstand, Beleg des Kalenders an diesem Tag', rz[1]?.datum === tag(-2) && rz[1]?.abstand === 35 && rz[1]?.belege?.[0]?.gemessenAm === tag(-2) && rz[1]?.quelle?.includes(`date=${tag(-2)}`) === true, rz[1])
pruefe('Schlüssel ist release und Tag (stabil)', rz[2]?.schluessel === `takt:r-1:${tag(-1)}`, rz[2]?.schluessel)
pruefe('Meldung vom heutigen Tag zählt (Grenze), vom morgigen nicht', taktMeldungen(release({ '1': tag(-12), '2': tag(-5), '3': tag(0) }), heute).length === 1 && taktMeldungen(release({ '1': tag(-11), '2': tag(-4), '3': tag(1) }), heute).length === 0)
pruefe('Kontrolle: derselbe Release ohne Ausschluss gibt genau eine Meldung', taktMeldungen(release({ '1': tag(-16), '2': tag(-9), '3': tag(-8) }), heute).length === 1)
const basis = { '1': tag(-16), '2': tag(-9), '3': tag(-8) }
const ausgeschlossen = (x: Record<string, unknown>) => taktMeldungen(release(basis, x), heute).length === 0
pruefe('Ausschluss Fernsehen: ohne ihn gäbe es eine Meldung', taktMeldungen(release(basis), heute).length === 1 && ausgeschlossen({ platform: 'tv' }))
pruefe('Ausschluss anderer Anbieter (Paramount+, Netflix, Prime)', ['paramountplus', 'netflix', 'primevideo'].every((p) => ausgeschlossen({ platform: p })))
pruefe('Ausschluss Komplettabwurf', ausgeschlossen({ releaseType: 'available-from' }) && ausgeschlossen({ releaseType: 'disc' }))
pruefe('Ausschluss Handbeleg-Rhythmus', ausgeschlossen({ rhythmus: { stand: heute } }))
pruefe('Ausschluss widerlegter Termin', ausgeschlossen({ widerlegt: { gemeldet: true } }))
pruefe('Sätze', taktSatz(rz[2]!) === `Folge 15 ist schon da — einen Tag nach Folge 14` && taktSatz(rz[1]!) === 'Nach 5 Wochen Pause wieder neue Folgen: Folge 14' && taktSatz(rz[0]!) === 'Nach 12 Wochen Pause wieder neue Folgen: Folgen 12–13', rz.map((m) => taktSatz(m)))
pruefe('Sätze: Zwei/Drei/Vier und viele, mehrere Tage', taktSatz({ takt: 'doppelt', von: 12, bis: 13, anzahl: 2 }) === 'Zwei Folgen auf einmal: 12 und 13' && taktSatz({ takt: 'doppelt', von: 6, bis: 8, anzahl: 3 }) === 'Drei Folgen auf einmal: 6–8' && taktSatz({ takt: 'doppelt', von: 6, bis: 10, anzahl: 5 }) === '5 Folgen auf einmal: 6–10' && taktSatz({ takt: 'doppelt', von: 6, bis: 9, anzahl: 4 }) === 'Vier Folgen auf einmal: 6–9' && taktSatz({ takt: 'doppelt', von: 5, bis: 6 }) === 'Zwei Folgen auf einmal: 5 und 6' && taktSatz({ takt: 'folgetag', von: 7, bis: 7, anzahl: 1, abstand: 5 }) === 'Folge 7 ist schon da — 5 Tage nach Folge 6')
pruefe('Wochen werden gerundet (26 Tage = 4 Wochen)', taktSatz({ takt: 'pause', von: 3, bis: 3, abstand: 26 }) === 'Nach 4 Wochen Pause wieder neue Folgen: Folge 3' && taktSatz({ takt: 'pause', von: 3, bis: 3, abstand: 24 }) === 'Nach 3 Wochen Pause wieder neue Folgen: Folge 3' && taktKurz({ takt: 'pause', von: 3, bis: 3, abstand: 26 }) === 'E3 · nach 4 Wo. Pause')
pruefe('Kurzform', taktKurz(rz[2]!) === 'E15 · einen Tag nach E14' && taktKurz(rz[0]!) === 'E12–13 · nach 12 Wo. Pause' && taktKurz({ takt: 'doppelt', von: 12, bis: 13, anzahl: 2 }) === 'E12–13 · zusammen')

pruefe('Seite, Feed und Mail sagen dasselbe', rz.every((m) => newsSatz(m) === taktSatz(m) && mailSatz(m) === taktSatz(m)) && rz.every((m) => newsKurz(m) === taktKurz(m)))

/* 4. Keine Doppelung neben anderen Meldungen desselben Tages: Kandidaten, der richtige in der Mitte. */
const roh = (extra: Record<string, unknown>): DatiertNews => ({ titel: titel(1), platform: 'crunchyroll', release: 'r-1', am: tag(-37), datum: tag(-37), schluessel: 'x', ...extra }) as unknown as DatiertNews
const dop = roh({ art: 'takt', takt: 'doppelt', von: 12, bis: 13, anzahl: 2 })
const pau = roh({ art: 'takt', takt: 'pause', von: 12, bis: 13, anzahl: 2, abstand: 84 })
const folgetag = roh({ art: 'takt', takt: 'folgetag', von: 12, bis: 12, anzahl: 1, abstand: 1 })
const folgen = (extra: Record<string, unknown>) => roh({ art: 'folgen', ...extra })
const bleibt = (m: DatiertNews, andere: DatiertNews[]) => ohneDoppelteTakte([...andere, m]).includes(m)
pruefe('„doppelt“ entfällt neben einer Folgen-Meldung „12–13“ desselben Tages', !bleibt(dop, [folgen({ von: 10, bis: 11 }), folgen({ von: 12, bis: 13 }), folgen({ von: 14, bis: 15 })]))
pruefe('„doppelt“ bleibt neben Folgen-Meldungen, die es nicht abdecken', bleibt(dop, [folgen({ von: 10, bis: 11 }), folgen({ von: 12, bis: 12 }), folgen({ von: 13, bis: 14 })]))
pruefe('„doppelt“ bleibt, wenn die Folgen-Meldung ein anderer Tag, Titel oder Anbieter ist', bleibt(dop, [folgen({ von: 12, bis: 13, am: tag(-36) }), folgen({ von: 12, bis: 13, titel: titel(2) }), folgen({ von: 12, bis: 13, platform: 'netflix' })]))
pruefe('„pause“ bleibt neben der Folgen-Meldung (sie sagt nichts über die Pause)', bleibt(pau, [folgen({ von: 10, bis: 11 }), folgen({ von: 12, bis: 13 })]))
const nachger = (extra: Record<string, unknown> = {}) => roh({ art: 'nachgereicht', von: 12, bis: 13, ...extra })
pruefe('„pause“ und „doppelt“ entfallen neben „verspätet erschienen“ desselben Release und Tages', !bleibt(pau, [nachger({ release: 'r-0' }), nachger(), nachger({ datum: tag(-36) })]) && !bleibt(dop, [nachger({ release: 'r-0' }), nachger(), nachger({ datum: tag(-36) })]))
pruefe('„pause“ bleibt, wenn „verspätet erschienen“ ein anderer Release oder Tag ist', bleibt(pau, [nachger({ release: 'r-0' }), nachger({ datum: tag(-36) }), nachger({ release: 'r-2' })]))
pruefe('„folgetag“ bleibt auch neben „verspätet erschienen“ (sagt etwas anderes)', bleibt(folgetag, [nachger({ release: 'r-0' }), nachger(), nachger({ datum: tag(-36) })]))
pruefe('andere Meldungen bleiben unberührt', ohneDoppelteTakte([nachger(), folgen({ von: 1, bis: 1 })]).length === 2)

/* 5. Durch den ganzen Bau: die Verdrahtung. Eine laufende Serie mit Pause und Folgetag, plus eine Serie mit ausgefallenem Termin. */
const crFolge = (nummer: number, t: string) => ({ serieId: SERIE, serie: 'S', nummer, verfuegbarAb: `${t}T14:00:00.000Z`, gesehenAm: t })
const bau = (r: Release, folgenCr = [crFolge(12, tag(-37)), crFolge(13, tag(-37)), crFolge(14, tag(-2)), crFolge(15, tag(-1))]) =>
  baueNews([titel(1)], [r], [], folgenCr, { zuerst: {} }).flatMap((e) => e.meldungen.map((m) => ({ ...m, am: e.am })))
const alle = bau(release({ '1': tag(-170), ...rezero }))
const takte = alle.filter((m) => m.art === 'takt').sort((a, b) => a.am.localeCompare(b.am))
pruefe('Bau: Takt-Meldungen am Tag der Folge', takte.map((m) => `${m.am}:${m.takt}`).join() === `${tag(-37)}:pause,${tag(-2)}:pause,${tag(-1)}:folgetag`, takte.map((m) => `${m.am}:${m.takt}`))
pruefe('Bau: die Folgen-Meldungen bleiben daneben', alle.filter((m) => m.art === 'folgen').length === 3, alle.filter((m) => m.art === 'folgen').length)
const tagEintrag = baueNews([titel(1)], [release({ '1': tag(-170), ...rezero })], [], [crFolge(12, tag(-37)), crFolge(13, tag(-37))], { zuerst: {} }).find((e) => e.am === tag(-37))
pruefe('Bau: am selben Tag steht die Takt-Meldung vor der Folgen-Meldung', tagEintrag?.meldungen.map((m) => m.art).join() === 'takt,folgen', tagEintrag?.meldungen.map((m) => m.art))
pruefe('Bau: Wortlaut aus der Meldung', takte.some((m) => newsSatz(m) === 'Folge 15 ist schon da — einen Tag nach Folge 14') && takte.some((m) => newsSatz(m) === 'Nach 5 Wochen Pause wieder neue Folgen: Folge 14'))
const doppelt = bau(release({ '1': tag(-60), '2': tag(-53), '3': tag(-46), '4': tag(-46) }), [crFolge(3, tag(-46)), crFolge(4, tag(-46))])
pruefe('Bau: „zwei Folgen auf einmal“ entfällt neben der Folgen-Meldung 3–4', doppelt.filter((m) => m.art === 'takt').length === 0 && doppelt.some((m) => m.art === 'folgen' && m.von === 3 && m.bis === 4), doppelt.map((m) => m.art))
const ohneFolgen = bau(release({ '1': tag(-60), '2': tag(-53), '3': tag(-46), '4': tag(-46) }), [])
pruefe('Bau: ohne Folgen-Meldung bleibt „zwei Folgen auf einmal“ stehen', ohneFolgen.filter((m) => m.art === 'takt').map((m) => newsSatz(m)).join() === 'Zwei Folgen auf einmal: 3 und 4', ohneFolgen.map((m) => m.art))
const verspaetet = release({ '1': tag(-60), '2': tag(-53), '3': tag(-46), '4': tag(-46) }, {})
verspaetet.schedule.verpasst = { 3: { erwartetAm: `${tag(-39)}T14:00:00.000Z`, erschienenAm: `${tag(-46)}T14:00:00.000Z`, bemerktAm: `${tag(-39)}T20:00:00.000Z` } } as never
const mitNachreich = bau(verspaetet, [])
pruefe('Bau: neben „verspätet erschienen“ keine zweite Aussage zu denselben Folgen', mitNachreich.filter((m) => m.art === 'takt').length === 0, mitNachreich.map((m) => `${m.art}${m.takt ?? ''}`))

/* 5b. Zwei Bau-Läufe mit derselben Historie: Fällt eine Takt-Meldung weg, zeigt die abgelöste Fassung ihren eigenen Satz und ist zurückgezogen — nie „ersetzt durch“ eine andere Takt-Meldung. */
const zweiLaeufe = (erst: Release, dann: Release, folgenCr: ReturnType<typeof crFolge>[] = []) => {
  const historie = { zuerst: {} }
  baueNews([titel(1)], [erst], [], folgenCr, historie)
  return baueNews([titel(1)], [dann], [], folgenCr, historie).flatMap((e) => e.meldungen.map((m) => ({ ...m, am: e.am })))
}
const ohne15 = { '1': tag(-170), ...rezero, '16': tag(1) } as Record<string, string>
delete ohne15['15']
const rzLauf2 = zweiLaeufe(release({ '1': tag(-170), ...rezero }), release(ohne15))
const weg = rzLauf2.filter((m) => m.art === 'takt' && m.zurueckgezogen)
pruefe('Verlauf Re:ZERO: die abgelöste Folgetag-Meldung nennt ihre Angaben und ist zurückgezogen', weg.length === 1 && newsSatz(weg[0]!) === 'Folge 15 ist schon da — einen Tag nach Folge 14' && !weg[0]!.ersetzt, weg.map((m) => newsSatz(m)))
pruefe('Verlauf Re:ZERO: die beiden Pausen-Meldungen stehen weiter da, ohne „ersetzt“', rzLauf2.filter((m) => m.art === 'takt' && !m.zurueckgezogen && !m.ersetzt).length === 2 && !rzLauf2.some((m) => m.art === 'takt' && m.ersetzt))
const eintraegeRz = baueNews([titel(1)], [release({ '1': tag(-170), ...rezero })], [], [], { zuerst: {} })
const ausSeed = baueNews([titel(1)], [release(ohne15)], [], [], { zuerst: {} }, eintraegeRz).flatMap((e) => e.meldungen).filter((m) => m.art === 'takt' && m.zurueckgezogen)
pruefe('Verlauf aus dem ausgelieferten news.json (erster Lauf ohne Gedächtnis): derselbe Satz, zurückgezogen', ausSeed.length === 1 && newsSatz(ausSeed[0]!) === 'Folge 15 ist schon da — einen Tag nach Folge 14' && !ausSeed[0]!.ersetzt, ausSeed.map((m) => newsSatz(m)))
const mk = { '1': tag(-60), '2': tag(-53), '3': tag(-46), '4': tag(-46) }
const mkLauf2 = zweiLaeufe(release(mk), release({ '1': tag(-60), '2': tag(-53), '3': tag(-46) }))
const mkWeg = mkLauf2.filter((m) => m.art === 'takt')
pruefe('Verlauf Mushoku: „Zwei Folgen auf einmal“ fällt weg und zeigt ihren Satz, zurückgezogen', mkWeg.length === 1 && newsSatz(mkWeg[0]!) === 'Zwei Folgen auf einmal: 3 und 4' && Boolean(mkWeg[0]!.zurueckgezogen) && !mkWeg[0]!.ersetzt, mkWeg.map((m) => newsSatz(m)))

/* 6. Panel: „Takt unklar“ statt „Wöchentlich“, solange die nächste Folge nur fortgeschrieben ist. */
const panel = (observed: Record<string, string>, extra: Partial<Release> = {}) => {
  const r = release(observed, extra)
  r.schedule.firstEpisodeDate = observed['1']
  const a = berechneAntwort({ title: { id: 1, format: 'TV', episodes: 20 } as unknown as Title, releases: [r], today: heute, jetzt: new Date(`${heute}T12:00:00Z`) })
  return a?.art === 'laeuft' ? { neben: laeuftNeben(a, T), unklar: a.taktUnklar, estimated: a.haupt.estimated } : undefined
}
const pr = panel({ '1': tag(-170), ...rezero, '16': tag(-1) })
pruefe('Panel Re:ZERO: „Takt unklar“, nicht „Wöchentlich“', pr?.estimated === true && pr.unklar === true && pr.neben.startsWith('Takt unklar') && !pr.neben.includes('Wöchentlich'), pr)
pruefe('Panel Re:ZERO: das Finale-Datum ist „≈“', pr?.neben.includes('bis zum Finale am ≈ ') === true, pr)
/* Drei Releases eines Titels (der Kasten nimmt die nächste Folge des ersten Releases mit offenen Terminen): die beiden äußeren sind abgeschlossen, der mittlere ist unregelmäßig und hat die nächste Folge. Die Auswahl muss den Release der nächsten Folge nehmen, nicht den ersten oder letzten. */
const wochen = (slug: string, spaetestens: number, folgen = 20): Release => {
  const r = release({ '101': tag(spaetestens - 21), '102': tag(spaetestens - 14), '103': tag(spaetestens - 7), '104': tag(spaetestens) })
  r.schedule = { ...r.schedule, firstEpisodeDate: tag(spaetestens - 21), firstEpisodeNumber: 101, episodeCount: folgen }
  return { ...r, slug } as Release
}
const mitte = { ...release({ '1': tag(-170), ...rezero, '16': tag(-1) }), slug: 'r-mitte' } as Release
const dreiRel = (rs: Release[]) => {
  const a = berechneAntwort({ title: { id: 1, format: 'TV', episodes: 20 } as unknown as Title, releases: rs, today: heute, jetzt: new Date(`${heute}T12:00:00Z`) })
  return a?.art === 'laeuft' ? { slug: a.haupt.releaseSlug, unklar: a.taktUnklar } : undefined
}
const ersterUndLetzter = dreiRel([wochen('r-vorn', -2, 4), mitte, wochen('r-hinten', -2, 4)])
pruefe('Panel mit drei Releases: die nächste Folge gehört zum mittleren, dessen Takt unklar ist', ersterUndLetzter?.slug === 'r-mitte' && ersterUndLetzter.unklar === true, ersterUndLetzter)
const andersherum = dreiRel([wochen('r-b', -3), mitte, wochen('r-c', -2)])
pruefe('Panel mit drei Releases: ist der regelmäßige der nächste, kein „Takt unklar“', andersherum?.slug === 'r-b' && andersherum?.unklar === false, andersherum)
const wk = panel({ '1': tag(-23), '2': tag(-16), '3': tag(-9), '4': tag(-2) })
pruefe('Panel im Wochentakt: weiter „Wöchentlich“', wk?.unklar === false && wk.neben.startsWith('Wöchentlich'), wk)
const fest = panel({ '1': tag(-23), '2': tag(-22), '3': tag(-9), '4': tag(-2), '5': tag(5) })
pruefe('Panel: ist die nächste Folge belegt (nicht fortgeschrieben), bleibt „Wöchentlich“', fest?.estimated !== true && fest?.unklar === false, fest)
const anders = panel({ '1': tag(-23), '2': tag(-22), '3': tag(-9) }, { platform: 'tv' } as never)
pruefe('Panel: Fernsehen bekommt kein „Takt unklar“', anders?.unklar !== true, anders)
const abwurfRelease = release({ '1': tag(-23), '2': tag(-22) }, { releaseType: 'available-from', dateMeaning: 'available-from' })
abwurfRelease.schedule = { ...abwurfRelease.schedule, firstEpisodeDate: tag(3), estimated: true }
const abwurfAntwort = berechneAntwort({ title: { id: 1, format: 'TV', episodes: 20 } as unknown as Title, releases: [abwurfRelease], today: heute, jetzt: new Date(`${heute}T12:00:00Z`) })
const abwurf = abwurfAntwort?.art === 'laeuft' ? abwurfAntwort : undefined
pruefe('Panel: ein Komplettabwurf bekommt kein „Takt unklar“ (Kontrolle: Daten allein wären unklar, Termin ist fortgeschrieben)', abwurf !== undefined && abwurf.haupt.estimated === true && taktUnklar(abwurfRelease.schedule) && abwurf.taktUnklar !== true, abwurf?.haupt)
const angek = panel({ '1': tag(-23), '2': tag(-22), '3': tag(-9) }, { rhythmus: { stand: heute } } as never)
pruefe('Panel: ein angekündigter Rhythmus (Handbeleg) bekommt kein „Takt unklar“', angek?.unklar !== true, angek)

/* 7. Obergrenze: eine Takt-Meldung einer laufenden Serie bleibt 56 Tage, wie Folgen und Verspätungen. */
const eintragAm = (am: string, a: string): NewsEintrag => ({ am, titelId: 1, titel: 'X', slug: 'x', meldungen: [{ art: a }] }) as unknown as NewsEintrag
const gekappt = (am: string, a: string) => !behalteEintrag(eintragAm(am, a), 401, heute, 400)
pruefe('Takt-Meldung vor 56 Tagen bleibt, vor 57 darf fallen', !gekappt(tag(-56), 'takt') && gekappt(tag(-57), 'takt'))
pruefe('eine Ankündigung vor 40 Tagen fällt wie bisher (Gegenprobe)', gekappt(tag(-40), 'angekuendigt'))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-takt: ok')
