/**
 * Ein verstrichener Crunchyroll-Wochentermin ohne Sichtung ist „fällig“, nicht „erschienen“ (15.11.2026).
 *
 * Anlass: „Reborn as a Space Mercenary“ Folge 7 war für 15.11. 15:00 angekündigt und kam um 15:19. Ab 15:00 zeigte die Seite
 * „7 von 13 erschienen“ und „Crunchyroll ≈ Fg. 1–7“, der Push ging raus. Eingefroren ist der Stand vom 15.11. 13:33 UTC
 * (`public/data/releases.json`, Commit fd6c40de3): Folgen 1–6 beobachtet, Folge 7 ohne Sichtung. Die Uhr steht fest.
 * Der Wächter von PR 3189 sah das nicht: Er rechnet zur Bauzeit und nur Folgen, die der Katalog führt.
 * Dazu ein Uhr-Lauf in 5-Minuten-Schritten über die ganze Woche 09.–15.11. (Berlin): erschienen ist nie eine Folge ohne Beobachtung.
 * Läuft in `check:logic`.
 */
import { expandEvents, istErschienen } from '../shared/logic.ts'
import { faelligWort } from '../shared/ausbleiben-plan.ts'
import { ohneSichtungVon, terminZustand } from '../shared/termin-zustand.ts'
import { berlinToUtc } from '../shared/time.ts'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { erschieneneSpanne, planGeschaetzt } from '../web/src/components/detail/folgen-spanne.ts'
import { faelligText } from '../web/src/components/detail/kasten-texte.ts'
import { antwortKopf } from '../web/src/components/detail/antwort-kopf.tsx'
import { translate, type TranslationKey } from '../web/src/lib/i18n.tsx'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const BEOBACHTET_6 = { 1: '2026-10-04', 2: '2026-10-11', 3: '2026-10-18', 4: '2026-10-25', 5: '2026-11-01', 6: '2026-11-08' }

/** Space Mercenary wörtlich aus `releases.json` (fd6c40de3), ohne Beleglisten. */
function spaceMercenary(observed: Record<number, string>): Release {
  return {
    slug: 'cr-GT00384006',
    titleId: 186541,
    name: 'Reborn as a Space Mercenary: I Woke Up Piloting the Strongest Starship! Staffel 1',
    platform: 'crunchyroll',
    platformUrl: 'https://www.crunchyroll.com/de/series/GT00384006/reborn-as-a-space-mercenary-i-woke-up-piloting-the-strongest-starship',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-10-04',
      time: '15:00',
      episodeCount: 13,
      episodeCountAssumed: false,
      estimated: false,
      observed,
      zeiten: { 1: '16:00', 2: '16:00', 3: '16:00' },
    },
    year: 2026,
  } as unknown as Release
}

/** Overgeared wörtlich aus `releases.json` (fd6c40de3): Folge 8 am 15.11. um 15:30, ohne Sichtung. */
const overgeared = {
  slug: 'cr-GT00384004',
  titleId: 212888,
  name: 'Overgeared Staffel 1',
  platform: 'crunchyroll',
  platformUrl: 'https://www.crunchyroll.com/de/series/GT00384004/overgeared',
  releaseType: 'weekly',
  schedule: {
    firstEpisodeDate: '2026-09-27',
    time: '15:30',
    episodeCount: 12,
    episodeCountAssumed: false,
    estimated: false,
    observed: { 1: '2026-09-27', 2: '2026-10-04', 3: '2026-10-11', 4: '2026-10-18', 5: '2026-10-25', 6: '2026-11-01', 7: '2026-11-08' },
    zeiten: { 1: '16:30', 2: '16:30', 3: '16:30', 4: '16:30' },
    belegtBis: { folge: 1, am: '2026-10-07' },
  },
  year: 2026,
} as unknown as Release

const titel = (bis: number): Title =>
  ({
    id: 186541,
    format: 'TV',
    episodes: 13,
    titleEn: 'Reborn as a Space Mercenary',
    streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GT00384006/x', dub: true, dubRanges: [{ from: 1, to: bis, dub: true }] }],
  }) as unknown as Title

const folge = (r: Release, nr: number): ReleaseEvent => expandEvents(r).find((e) => e.episode === nr)!
const TAG = '2026-11-15'
const UHR_15_00 = new Date('2026-11-15T13:59:59Z')
const UHR_15_05 = new Date('2026-11-15T14:05:00Z')
const UHR_15_19 = new Date('2026-11-15T14:19:00Z')
const UHR_17_00 = new Date('2026-11-15T16:00:00Z')
const UHR_NACH_15_19 = new Date('2026-11-15T14:25:00Z')

// Der eingefrorene Fall: Folge 7 ist ab 15:00 angekündigt und bleibt fällig, solange keine Sichtung sie belegt (auch um 15:19, wenn sie schon da ist).
const ohne7 = spaceMercenary(BEOBACHTET_6)
for (const [name, jetzt] of [['15:05', UHR_15_05], ['15:19', UHR_15_19]] as const) {
  const f7 = folge(ohne7, 7)
  const events = expandEvents(ohne7)
  pruefe(`${name}: Folge 7 ist nicht erschienen`, !istErschienen(f7, jetzt))
  pruefe(`${name}: Folge 7 ist fällig`, terminZustand(f7, jetzt) === 'faellig')
  pruefe(`${name}: Pille nennt Folge 1–6`, erschieneneSpanne(events, jetzt) === '1–6', String(erschieneneSpanne(events, jetzt)))
  pruefe(`${name}: Pille ohne ≈`, !planGeschaetzt(events, [{ from: 1, to: 6, dub: true }], [], jetzt))
  const antwort: any = berechneAntwort({ title: titel(6), releases: [ohne7], today: TAG, jetzt })
  pruefe(`${name}: Kasten zählt 6 von 13`, antwort?.art === 'laeuft' && antwort.raus === 6 && antwort.gesamt === 13, `${antwort?.art} ${antwort?.raus}/${antwort?.gesamt}`)
  pruefe(`${name}: Kasten stellt Folge 7 als fällig voran`, antwort?.haupt?.episode === 7 && antwort.faellig !== undefined, `${antwort?.haupt?.episode} ${antwort?.faellig}`)
}
pruefe('Folge 7 trägt das Merkmal „ohne Sichtung“', folge(ohne7, 7).ohneSichtung === true)
pruefe('Folge 6 (beobachtet) trägt es nicht', folge(ohne7, 6).ohneSichtung === undefined)
pruefe('Folge 8 (noch nicht dran) trägt es', folge(ohne7, 8).ohneSichtung === true)

// Die Hauptzeile des Kastens mit dem echten Übersetzer: Wortlaut und Farbe je Stufe (die Zeile steht über der Zählung „6 von 13“).
function kastenZeile(jetzt: Date): { text: unknown; farbe: unknown } {
  const antwort = berechneAntwort({ title: titel(6), releases: [ohne7], today: TAG, jetzt }) as any
  const kopf = antwortKopf({
    antwort,
    relativImSatz: (d) => (d === TAG ? 'heute' : d),
    T: (k, v) => translate(k as TranslationKey, v),
    betont: (t) => t,
    ohneSprachbeleg: undefined,
    releases: [ohne7],
    folgenZahl: undefined,
    deSeitNeben: '',
    title: titel(6),
  })
  const haupt = kopf.haupt as { props?: { className?: string; children?: unknown } }
  return { text: haupt?.props?.children, farbe: haupt?.props?.className }
}
const zeile0 = kastenZeile(new Date('2026-11-15T14:00:30Z'))
const zeile5 = kastenZeile(UHR_15_05)
const zeile2h = kastenZeile(UHR_17_00)
pruefe('Kasten 15:00: wird geprüft', zeile0.text === 'Folge 7 fällig seit 15:00 Uhr, wird geprüft', String(zeile0.text))
pruefe('Kasten 15:05: noch nicht gesehen', zeile5.text === 'Folge 7 fällig seit 15:00 Uhr, noch nicht gesehen', String(zeile5.text))
pruefe('Kasten 17:00: nicht erschienen wie angekündigt', zeile2h.text === 'Folge 7 nicht erschienen wie angekündigt (15:00 Uhr)', String(zeile2h.text))
pruefe('Kasten: abwartend gefärbt, nach zwei Stunden als Fehler', zeile5.farbe === 'text-ak-warnung-text' && zeile2h.farbe === 'text-ak-fehler-text', `${zeile5.farbe} ${zeile2h.farbe}`)
const nachSichtung = antwortKopf({
  antwort: berechneAntwort({ title: titel(7), releases: [spaceMercenary({ ...BEOBACHTET_6, 7: TAG })], today: TAG, jetzt: UHR_NACH_15_19 }) as any,
  relativImSatz: (d) => (d === TAG ? 'heute' : d),
  T: (k, v) => translate(k as TranslationKey, v),
  betont: (t) => t,
  ohneSprachbeleg: undefined,
  releases: [spaceMercenary({ ...BEOBACHTET_6, 7: TAG })],
  folgenZahl: undefined,
  deSeitNeben: '',
  title: titel(7),
})
pruefe('Kasten nach Sichtung: keine Fälligkeitszeile', typeof (nachSichtung.haupt as any)?.props?.children !== 'string' || !String((nachSichtung.haupt as any).props.children).includes('fällig'))

// Nach der Sichtung von Folge 7: erschienen, Spanne 1–7, kein „≈“, nichts fällig.
const mit7 = spaceMercenary({ ...BEOBACHTET_6, 7: TAG })
pruefe('nach Sichtung: Folge 7 erschienen', istErschienen(folge(mit7, 7), UHR_NACH_15_19) && folge(mit7, 7).ohneSichtung === undefined)
const antwort7: any = berechneAntwort({ title: titel(7), releases: [mit7], today: TAG, jetzt: UHR_NACH_15_19 })
pruefe('nach Sichtung: Kasten zählt 7 von 13', antwort7?.raus === 7 && antwort7?.faellig === undefined, `${antwort7?.raus} ${antwort7?.faellig}`)

// Die Bedingungen von `ohneSichtungVon` einzeln: jede allein entscheidet.
const plan = (ohne7 as any).schedule
pruefe('ohneSichtungVon: Crunchyroll, Wochenplan, unbeobachtet', ohneSichtungVon(ohne7, plan, 7))
pruefe('ohneSichtungVon: TV-Sichtung nie', !ohneSichtungVon({ ...ohne7, tvLetzteSichtung: '2026-11-14' } as Release, plan, 7))
pruefe('ohneSichtungVon: anderer Anbieter nie', !ohneSichtungVon({ ...ohne7, platform: 'netflix' } as Release, plan, 7))
pruefe('ohneSichtungVon: Katalogstart nie', !ohneSichtungVon({ ...ohne7, releaseType: 'batch' } as Release, plan, 7))
const belegt7 = { ...plan, belegtBis: { folge: 7, am: '2026-11-15' } }
pruefe('ohneSichtungVon: belegtBis deckt Folge 7', !ohneSichtungVon(ohne7, belegt7, 7))
pruefe('ohneSichtungVon: belegtBis deckt Folge 8 nicht', ohneSichtungVon(ohne7, belegt7, 8))
pruefe('ohneSichtungVon: spätere Beobachtung überholt Folge 7', !ohneSichtungVon(ohne7, { ...plan, observed: { ...BEOBACHTET_6, 8: '2026-11-22' } }, 7))
pruefe('ohneSichtungVon: ohne jede Beobachtung', ohneSichtungVon(ohne7, { ...plan, observed: undefined }, 1))

// Wortstufen nach Abstand (Folge 7, Termin 15:00 Berlin = 14:00 UTC).
const f7 = folge(ohne7, 7)
pruefe('15:00 und 15:04: wird geprüft', faelligWort(f7, new Date('2026-11-15T14:04:59Z')) === 'wird-geprueft')
pruefe('15:05: verspätet, noch nicht gesehen', faelligWort(f7, UHR_15_05) === 'verspaetet')
pruefe('16:59: noch verspätet', faelligWort(f7, new Date('2026-11-15T15:59:59Z')) === 'verspaetet')
pruefe('17:00: nicht erschienen', faelligWort(f7, UHR_17_00) === 'nicht-erschienen' || faelligWort(f7, new Date('2026-11-15T16:00:00Z')) === 'nicht-erschienen')
pruefe('vor 15:00: kein Wort', faelligWort(f7, UHR_15_00) === undefined)
const T = (k: string, v?: Record<string, string | number>): string =>
  ({ 'antwort.faelligWirdGeprueft': 'W {n} {wann}', 'antwort.faelligVerspaetet': 'V {n} {wann}', 'antwort.faelligNichtErschienen': 'N {n} {wann}' })[k]!.replace('{n}', String(v!.n)).replace('{wann}', String(v!.wann))
pruefe('Text heute: nur Uhrzeit', faelligText(f7, 'verspaetet', true, T) === 'V 7 15:00 Uhr', faelligText(f7, 'verspaetet', true, T))
pruefe('Text anderer Tag: mit Datum', faelligText(f7, 'nicht-erschienen', false, T) === 'N 7 15.11.2026, 15:00 Uhr', faelligText(f7, 'nicht-erschienen', false, T))

// Overgeared (15:30, ohne Sichtung von Folge 8): dasselbe Muster, eigener Slot.
pruefe('Overgeared Folge 8: um 15:35 fällig', terminZustand(folge(overgeared, 8), new Date('2026-11-15T14:35:00Z')) === 'faellig')
pruefe('Overgeared Folge 8: um 15:29 noch angekündigt', terminZustand(folge(overgeared, 8), new Date('2026-11-15T14:29:00Z')) === 'angekuendigt')

// Grenzen: nur Crunchyroll mit Wochenplan; alles andere bleibt Termin.
const fremd = (aenderung: Record<string, unknown>): Release => ({ ...(ohne7 as any), ...aenderung }) as Release
pruefe('Prime-Wochenplan bleibt erschienen', istErschienen(folge(fremd({ platform: 'prime', slug: 'prime-x' }), 7), UHR_15_19))
pruefe('Crunchyroll-Katalogstart bleibt erschienen', istErschienen(expandEvents(fremd({ releaseType: 'batch', slug: 'cr-batch' }))[0]!, UHR_15_19))
pruefe('Netflix-Wochenplan bleibt erschienen', istErschienen(folge(fremd({ platform: 'netflix', slug: 'nf-x' }), 7), UHR_15_19))
// Ein belegter Plan ohne Beobachtung (Altbestand, `estimated: false`) bleibt erschienen: Dort rechnet nichts fort.
const belegterPlan = { ...(ohne7 as any), schedule: { ...(ohne7 as any).schedule, observed: undefined, zeiten: undefined } } as Release
pruefe('belegter Plan ohne Beobachtung bleibt erschienen', istErschienen(folge(belegterPlan, 3), UHR_15_19))
// Eine Folge vor einer späteren Beobachtung ist sicher erschienen, auch ohne eigene Zeile.
const luecke = spaceMercenary({ 1: '2026-10-04', 2: '2026-10-11', 3: '2026-10-18', 5: '2026-11-01' })
pruefe('Lücke vor einer Beobachtung: Folge 4 erschienen', istErschienen(folge(luecke, 4), UHR_15_19) && folge(luecke, 4).ohneSichtung === undefined)
// Ein Neustart ohne jede Beobachtung: die erste Folge ist ab ihrer Zeit fällig.
const neustart = { ...(ohne7 as any), schedule: { ...(ohne7 as any).schedule, firstEpisodeDate: TAG, estimated: true, observed: undefined, zeiten: undefined } } as Release
pruefe('Neustart ohne Beobachtung: Folge 1 um 15:05 fällig', terminZustand(folge(neustart, 1), UHR_15_05) === 'faellig')
// Ein Vermerk „ausgeblieben“ geht vor „fällig“, ein nachgeholter Vermerk nimmt die Sichtungsfrage ab.
const mitVermerk = { ...(ohne7 as any), schedule: { ...(ohne7 as any).schedule, verpasst: { 7: { erwartetAm: `${TAG}T14:00:00Z`, geprueftAm: `${TAG}T14:30:00Z` } } } } as Release
pruefe('Vermerk geht vor fällig', terminZustand(folge(mitVermerk, 7), UHR_17_00) === 'ausgeblieben' && folge(mitVermerk, 7).ohneSichtung === undefined)

// Uhr-Lauf: jede 5 Minuten von Montag 00:00 bis Sonntag 24:00 (Berlin). Erschienen ist nie eine Folge, die weder beobachtet noch von einer späteren Beobachtung überholt ist.
const OBS_OHNE: Record<string, number[]> = { 'cr-GT00384006': [1, 2, 3, 4, 5, 6], 'cr-GT00384004': [1, 2, 3, 4, 5, 6, 7] }
let schritte = 0
const von = berlinToUtc('2026-11-09', '00:00').getTime()
const bis = berlinToUtc('2026-11-15', '23:59').getTime() + 60_000
for (const r of [ohne7, overgeared]) {
  const beobachtet = OBS_OHNE[r.slug]!
  const spitze = Math.max(...beobachtet)
  const termine = expandEvents(r)
  for (let t = von; t <= bis; t += 5 * 60_000) {
    schritte++
    const jetzt = new Date(t)
    for (const e of termine) {
      if (e.episode == null || !istErschienen(e, jetzt)) continue
      pruefe(`Uhr-Lauf ${r.slug} F${e.episode} ${jetzt.toISOString()}`, beobachtet.includes(e.episode) || e.episode < spitze)
    }
  }
}
pruefe('Uhr-Lauf hat die ganze Woche gespielt', schritte === 2 * 2016 + 2, String(schritte))

console.log(`check-cr-faellig: ${faelle} Fälle, ${fehler} Fehler (Uhr-Lauf ${schritte} Schritte, Space Mercenary Folge 7 und Overgeared Folge 8)`)
if (fehler) process.exit(1)
