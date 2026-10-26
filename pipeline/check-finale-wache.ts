/**
 * Test der Regel „Kein Staffelfinale ohne Endbeleg“ (26.10.2026): `istStaffelfinale` (`shared/tv-signale.ts`), die Wache
 * `lib/finale-wache.ts` und der Erzeuger `rtlplusWochentermine` (`lib/rtlplus-folgen.ts`).
 *
 * Die Anlässe stehen wörtlich aus `public/data/releases.json` und `public/data/folgen/zaehlung.json`: Beyblade X Staffel 3 bei RTL+
 * (Folge 101 bis 122, ohne 102, japanisch 128 Folgen, stand als „Folge 122/122, Staffelfinale“) und The Ramparts of Ice Staffel 2 bei
 * Netflix (ohne Folgenzahl, stand als „Folge 1/1“ mit Start und Finale). Aufruf: npx tsx pipeline/check-finale-wache.ts
 */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { addDays } from '../shared/time.ts'
import { istStaffelfinale } from '../shared/tv-signale.ts'
import { finaleOhneEndbeleg } from './lib/finale-wache.ts'
import { rtlplusWochentermine } from './lib/rtlplus-folgen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Folge 101, dann 103 bis 122 (RTL+ führt Folge 102 nicht), je eine Woche nach der vorigen, ab dem 05.06.2026 — wie in `public/data/releases.json`. */
const NUMMERN = [101, ...Array.from({ length: 20 }, (_, i) => 103 + i)]
const TAGE = Object.fromEntries(NUMMERN.map((nr, i) => [nr, addDays('2026-06-05', 7 * i)]))
const bis = (letzte: number) => Object.entries(TAGE).filter(([nr]) => Number(nr) <= letzte).map(([nr, ab]) => ({ nr: Number(nr), st: Number(nr) - 100, staffel: 3, dt: `F${nr}`, ab }))
const beyblade = { id: 165159, titleDe: 'Beyblade X', streams: [{ platform: 'rtlplus', url: 'x', dub: true }] } as unknown as Title

/** Der Erzeuger, dann die Termine, dann die Finale-Frage — wie der Bau; `heute` liegt jeweils wenige Tage nach der letzten Folge. */
function lauf(letzte: number, heute: string) {
  const liste = { '165159': { programm: 'beyblade-x-p_9519', folgen: bis(letzte) } }
  const release = rtlplusWochentermine(liste, new Map([[165159, beyblade]]), [], heute)[0]!
  const daten = { releaseBySlug: new Map([[release.slug, release]]) }
  return { release, finale: expandEvents(release).filter((e) => istStaffelfinale(e, daten)), events: expandEvents(release) }
}

const a = lauf(122, '2026-10-26')
pruefe('Beyblade X Staffel 3: der Erzeuger nennt die Zahl 22 eine Annahme', a.release.schedule?.episodeCount === 22 && a.release.schedule?.episodeCountAssumed === true, a.release.schedule)
pruefe('Beyblade X Staffel 3: Folge 122 ist kein Finale', a.events.at(-1)?.episode === 122 && a.finale.length === 0, a.finale)
const b = lauf(121, '2026-10-19')
pruefe('Beyblade X Staffel 3: eine Woche früher (Folge 121) ebenso keins — das Finale wandert nicht mit', b.events.at(-1)?.episode === 121 && b.finale.length === 0, b.finale)

/* istStaffelfinale selbst, ohne den Erzeuger-Vermerk: eine Sichtung ohne Enddatum ist kein Ende. */
const ohneVermerk: Release = { ...a.release, schedule: { ...a.release.schedule!, episodeCountAssumed: undefined } }
const datenOhne = { releaseBySlug: new Map([[ohneVermerk.slug, ohneVermerk]]) }
const letzteOhne = expandEvents(ohneVermerk).at(-1)!
pruefe('Sichtung ohne Enddatum und ohne Annahme-Vermerk: trotzdem kein Finale (Folge 122/122)', letzteOhne.episode === 122 && letzteOhne.episodeCount === 122 && !istStaffelfinale(letzteOhne, datenOhne), letzteOhne)
const mitEnde: Release = { ...ohneVermerk, schedule: { ...ohneVermerk.schedule!, lastEpisodeDate: '2026-10-23' } }
pruefe('dieselbe Sichtung mit belegtem Enddatum: Finale', istStaffelfinale(letzteOhne, { releaseBySlug: new Map([[mitEnde.slug, mitEnde]]) }))

const ramparts: Release = {
  slug: 'auto-213805-netflix',
  titleId: 213805,
  name: 'The Ramparts of Ice: Staffel 2',
  platform: 'netflix',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2026-10-01', estimated: true },
  automatisch: true,
} as unknown as Release
const ersteRamparts = expandEvents(ramparts)[0]!
pruefe('Ramparts of Ice: ohne Folgenzahl zählt expandEvents „Folge 1/1“', ersteRamparts.episode === 1 && ersteRamparts.episodeCount === 1, ersteRamparts)
pruefe('Ramparts of Ice: Folge 1/1 ohne Folgenzahl am Release ist kein Finale', !istStaffelfinale(ersteRamparts, { releaseBySlug: new Map([[ramparts.slug, ramparts]]) }))
const mitZahl: Release = { ...ramparts, schedule: { ...ramparts.schedule!, episodeCount: 1 } }
pruefe('ein Release mit belegter Folgenzahl 1 hat sein Finale bei Folge 1', istStaffelfinale(ersteRamparts, { releaseBySlug: new Map([[mitZahl.slug, mitZahl]]) }))

/* Die übrigen Bedingungen von istStaffelfinale mit Folgenzahl am Release, damit keine von ihnen im Schatten einer anderen steht. */
const zwoelf: Release = {
  slug: 'zwoelf',
  titleId: 1,
  name: 'X',
  platform: 'crunchyroll',
  releaseType: 'weekly',
  schedule: { firstEpisodeDate: '2026-10-01', episodeCount: 12 },
} as unknown as Release
const geraten: Release = { ...zwoelf, schedule: { ...zwoelf.schedule!, episodeCountAssumed: true } }
const zwoelfte = (extra: object = {}) => ({ ...expandEvents(zwoelf).at(-1)!, ...extra })
const frage = (r: Release, e: ReturnType<typeof zwoelfte>) => istStaffelfinale(e, { releaseBySlug: new Map([[r.slug, r]]) })
pruefe('Folge 12/12 mit belegter Folgenzahl: Finale', frage(zwoelf, zwoelfte()))
pruefe('Folge 12/12 mit geratener Folgenzahl: kein Finale', !frage(geraten, zwoelfte()))
pruefe('Folge 12/12, die ausgeblieben ist: kein Finale', !frage(zwoelf, zwoelfte({ verpasst: { bis: '2026-12-01' } })))
pruefe('Folge 12/12, die verspätet doch erschien: Finale', frage(zwoelf, zwoelfte({ verpasst: { erschienenAm: '2026-12-02' } })))

/* Die Wache am Bestand: Anlassfälle wörtlich, dazu Gegenfälle. */
const beyEvent = { releaseSlug: 'auto-165159-rtlplus-staffel-3', staffelfinale: true } as never
const beyRelease = {
  slug: 'auto-165159-rtlplus-staffel-3',
  titleId: 165159,
  platform: 'rtlplus',
  releaseType: 'weekly',
  tvLetzteSichtung: '2026-10-23',
  folgenBelegt: true,
  schedule: { firstEpisodeDate: '2026-06-05', firstEpisodeNumber: 101, episodeCount: 22 },
} as unknown as Release
const zaehlung = { '165159': [128, 122] }
const grund = (r: Release, z: Record<string, number[]> = zaehlung, finale = true) =>
  finaleOhneEndbeleg(finale ? [beyEvent, { releaseSlug: r.slug, staffelfinale: true } as never] : [], [r], z).map((v) => v.grund)
pruefe('Wache: Beyblade X (Sichtung, japanisch 128) wird gemeldet', grund(beyRelease).length === 1 && grund(beyRelease)[0]!.includes('Sichtung'), grund(beyRelease))
pruefe('Wache: Ramparts of Ice (ohne Folgenzahl) wird gemeldet', grund(ramparts, {}).join() === 'Finale ohne Folgenzahl am Release', grund(ramparts, {}))
const japanisch = { ...beyRelease, tvLetzteSichtung: undefined } as Release
pruefe('Wache: ohne Sichtung, aber japanisch 128 gegen Ende 122: gemeldet', grund(japanisch)[0]?.includes('japanisch 128') === true, grund(japanisch))
pruefe('Wache: japanisch genau am Ende (122): sauber', grund(japanisch, { '165159': [122, 122] }).length === 0)
pruefe('Wache: japanisch eine Folge mehr (123 gegen 122): gemeldet', grund(japanisch, { '165159': [123, 122] }).length === 1)
const ersteStaffel = { ...japanisch, schedule: { firstEpisodeDate: '2026-06-05', episodeCount: 12 } } as Release
pruefe('Wache: Staffel ab Folge 1 mit 12 Folgen, japanisch 12: sauber (Ende = Folgenzahl)', grund(ersteStaffel, { '165159': [12, 12] }).length === 0)
pruefe('Wache: Staffel ab Folge 1 mit 12 Folgen, japanisch 13: gemeldet', grund(ersteStaffel, { '165159': [13, 12] }).length === 1)
pruefe('Wache: ohne Zählung: sauber', grund(japanisch, {}).length === 0)
pruefe('Wache: belegtes Enddatum macht es sauber', grund({ ...beyRelease, schedule: { ...beyRelease.schedule!, lastEpisodeDate: '2026-10-23' } } as Release).length === 0)
pruefe('Wache: Release ohne Finale-Termin wird nicht gemeldet', grund(beyRelease, zaehlung, false).length === 0)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
