/**
 * Zusicherungen zum Folgenblock im Antwort-Kasten (13.10.2026, „Avatar: Die sieben Häfen“: Folgen 4–6 erscheinen am 16.10.,
 * der Kasten nannte nur Folge 4): Erscheinen mehrere **belegte** Folgen am selben Berlin-Tag, steht die Überschrift im Plural
 * mit Spanne und der Satz mit „erscheinen“. Fortgeschriebene Folgen, Wochentakt und Komplettabwurf bleiben, wie sie waren.
 * Erfundene Termine relativ zu heute (die Zählung liest die Systemuhr), kein echter Titel. Läuft in `check:logic`.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { folgenblockBis } from '../shared/folgenblock.ts'
import { folgenKopf, laeuftNeben } from '../web/src/components/detail/antwort-block.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { terminSatz } from '../web/src/components/detail/antwort-regeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const T = translate as unknown as (k: string, v?: Record<string, string | number>) => string
const titel = { id: 1, format: 'TV', episodes: 13 } as unknown as Title
const HEUTE = todayIso()

function plan(observed: Record<number, string>, extra: Partial<Release['schedule']> = {}, releaseType: Release['releaseType'] = 'weekly'): Release {
  const tage = Object.values(observed).sort()
  return {
    slug: 'block-test',
    titleId: 1,
    name: 'Blocktest',
    platform: 'paramountplus',
    platformUrl: 'https://www.paramountplus.com/de/shows/test/',
    releaseType,
    schedule: { firstEpisodeDate: tage[0], lastEpisodeDate: tage[tage.length - 1], episodeCount: 13, observed, ...extra },
    sources: [],
  } as unknown as Release
}

/**
 * Blöcke zu 3, 3, 3 und 4 Folgen wie bei Avatar: Die sieben Häfen (`data/curated/streaming-herbst-2026.yaml`); die ersten
 * `vorbei` Blöcke liegen drei Tage vor, der Rest ab drei Tagen nach heute, im Wochenabstand.
 */
function bloecke(vorbei: number): Record<number, string> {
  const observed: Record<number, string> = {}
  const gruppen = [[1, 3], [4, 6], [7, 9], [10, 13]] as const
  gruppen.forEach(([von, bis], i) => {
    const datum = addDays(HEUTE, 7 * (i - vorbei) + (i < vorbei ? -3 : 3))
    for (let n = von; n <= bis; n++) observed[n] = datum
  })
  return observed
}

/** Eine Folge je Woche; die ersten `vorbei` Folgen liegen vor heute. */
function woechentlich(vorbei: number): Record<number, string> {
  const observed: Record<number, string> = {}
  for (let n = 1; n <= 13; n++) observed[n] = addDays(HEUTE, 7 * (n - 1 - vorbei) + (n <= vorbei ? -3 : 3))
  return observed
}

function kopfVon(releases: Release[], t: Title = titel): { kopf: string; satz: string; neben: string; blockBis?: number; datum: string } | undefined {
  const a = berechneAntwort({ title: t, releases, today: HEUTE, jetzt: new Date() })
  if (a?.art !== 'laeuft') return undefined
  const satz = terminSatz(a.komplett, 'in 3 Tagen', a.haupt.date, T, a.blockBis !== undefined)
  return { kopf: folgenKopf(a, T), satz, neben: laeuftNeben(a, T), blockBis: a.blockBis, datum: a.haupt.date }
}

const nach = kopfVon([plan(bloecke(1))])
pruefe('Block: nach dem Auftakt „Nächste Folgen (4–6)“', nach?.kopf === 'Nächste Folgen (4–6)', nach?.kopf)
pruefe('Block: der Satz steht im Plural', Boolean(nach?.satz.startsWith('erscheinen in 3 Tagen, am ')), nach?.satz)
const davor = kopfVon([plan(bloecke(0))])
pruefe('Block: vor dem Start „Erste Folgen (1–3)“', davor?.kopf === 'Erste Folgen (1–3)', davor?.kopf)
const letzter = kopfVon([plan(bloecke(3))])
pruefe('Block: der letzte Block ist „Finale Folgen (10–13)“', letzter?.kopf === 'Finale Folgen (10–13)', letzter?.kopf)
const mitte = kopfVon([plan(bloecke(2))])
pruefe('Block: mit Folgen danach bleibt „Nächste Folgen (7–9)“', mitte?.kopf === 'Nächste Folgen (7–9)', mitte?.kopf)

/* Die Nebenzeile: Deckt der Block alles Ausstehende, steht das Ende schon in Überschrift und Satz — „noch X bis zum Finale am …“ entfällt (Prüfer, PR 1157). */
const TAKT = T('antwort.rhythmusWoechentlichKurz')
pruefe('Neben: beim Finale-Block bleibt nur der Takt', letzter?.neben === TAKT, letzter?.neben)
pruefe('Neben: mit Folgen nach dem Block bleibt „noch 7 Folgen bis zum Finale am …“', Boolean(mitte?.neben.includes('noch 7 Folgen bis zum Finale am ')), mitte?.neben)
pruefe('Neben: nach dem Auftakt bleibt „noch 10 Folgen bis zum Finale am …“', Boolean(nach?.neben.includes('noch 10 Folgen bis zum Finale am ')), nach?.neben)
const nurBlock = kopfVon([plan({ 1: addDays(HEUTE, 3), 2: addDays(HEUTE, 3), 3: addDays(HEUTE, 3) }, { episodeCount: 3 })], { ...titel, episodes: 3 } as Title)
pruefe('Neben: ein Auftakt-Block, der die ganze Staffel ist, zeigt nur den Takt', nurBlock?.kopf === 'Erste Folgen (1–3)' && nurBlock.neben === TAKT, `${nurBlock?.kopf} | ${nurBlock?.neben}`)

const einzeln = kopfVon([plan(woechentlich(1))])
pruefe('Gegenprobe: eine Folge je Woche bleibt „Nächste Folge (Folge 2)“', einzeln?.kopf === 'Nächste Folge (Folge 2)' && einzeln.blockBis === undefined, einzeln?.kopf)
pruefe('Gegenprobe: der Satz bleibt im Singular', Boolean(einzeln?.satz.startsWith('erscheint in 3 Tagen, am ')), einzeln?.satz)
const einzelnLetzte = kopfVon([plan(woechentlich(12))])
pruefe('Gegenprobe: nur noch eine Folge ist „Finale Folge (Folge 13)“', einzelnLetzte?.kopf === 'Finale Folge (Folge 13)', einzelnLetzte?.kopf)
pruefe('Gegenprobe: bei der Einzel-Finalfolge bleibt nur der Takt', einzelnLetzte?.neben === TAKT, einzelnLetzte?.neben)

const abwurfTag = addDays(HEUTE, 3)
const abwurf = plan({}, { firstEpisodeDate: abwurfTag, lastEpisodeDate: abwurfTag, episodeCount: 12 }, 'batch')
const abwurfKopf = kopfVon([abwurf], { ...titel, episodes: 12 } as Title)
pruefe('Gegenprobe: ein Komplettabwurf bleibt „Alle 12 Folgen“', abwurfKopf?.kopf === 'Alle 12 Folgen' && abwurfKopf.blockBis === undefined, abwurfKopf?.kopf)

/* Ohne Beleg bleibt die Einzahl: fortgeschriebene (`estimated`) oder nicht lückenlose Folgen am selben Tag sind kein Block. */
const ev = (episode: number, date: string, extra: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `x@${date}#${episode}`, releaseSlug: 'x', titleId: 1, date, episode, releaseType: 'weekly', platform: 'paramountplus', name: 'T', ...extra }) as ReleaseEvent
const belegt = [ev(4, '2026-10-16'), ev(5, '2026-10-16'), ev(6, '2026-10-16')]
pruefe('Beleg: drei belegte Folgen am Tag sind ein Block bis 6', folgenblockBis(belegt, belegt[0]!) === 6)
const geschaetzt = [ev(4, '2026-10-16', { estimated: true }), ev(5, '2026-10-16', { estimated: true })]
pruefe('Beleg: fortgeschriebene Folgen bilden keinen Block', folgenblockBis(geschaetzt, geschaetzt[0]!) === undefined)
const gemischt = [ev(4, '2026-10-16'), ev(5, '2026-10-16', { estimated: true })]
pruefe('Beleg: eine geschätzte Folge beendet den Block', folgenblockBis(gemischt, gemischt[0]!) === undefined)
const luecke = [ev(4, '2026-10-16'), ev(6, '2026-10-16')]
pruefe('Beleg: eine Lücke in den Nummern beendet den Block', folgenblockBis(luecke, luecke[0]!) === undefined)
const anderer = [ev(4, '2026-10-16'), ev(5, '2026-10-17')]
pruefe('Beleg: Folgen an verschiedenen Tagen sind kein Block', folgenblockBis(anderer, anderer[0]!) === undefined)

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Folgenblock: alle Zusicherungen erfüllt.')
