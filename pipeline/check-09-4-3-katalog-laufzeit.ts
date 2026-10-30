/**
 * Zusicherung: **Die Bauphase 09-4-3 (`ordneCrKatalogZu`) setzt Sprachurteile nur dort, wo der Katalog sie trägt** — als Lauf gegen
 * eine Kulisse (`AK_ROOT`), nicht als Textsuche im Quelltext. Ersetzt in `check-logic.ts` die Zusicherungen „die Katalog-Runde greift
 * nur bei genau einer Staffel", „die Serienkennung wird gegen den deutschen Katalog gehalten", „die Katalog-Runden sperren deutsche
 * Folgen hinter dem Titelende", „die Befunde aus fetch-crunchyroll-offene.ts werden im Bau auch gelesen", „ein abgelaufener Verweis
 * wird dort nicht zum Sprachurteil", „ein toter Crunchyroll-Befund entfernt den Verweis" und die Bau-Hälfte der Kennung aus dem
 * Adressgedächtnis. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import type { EntfernterVerweis } from './bau/grundlagen.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'cr-katalog-laufzeit-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const schreibe = (pfad: string, inhalt: unknown) => writeFileSync(join(kulisse, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
const adresse = (kennung: string) => `https://www.crunchyroll.com/de/series/${kennung}/serie`
const KATALOG_STAND = '2026-10-20'
const DE = ['ja-JP', 'de-DE']
const OHNE_DE = ['ja-JP']

interface Eintrag { id: string; audio: string[]; folgen?: number; staffeln: number }
interface Fall {
  id: number
  name: string
  kennung: string
  stream?: { dub?: boolean; url?: string }
  episodes?: number
  eintrag?: Partial<Eintrag>
  /** Block im Dub-Bestand (Teil von `crDub.serien`). */
  serie?: object
  /** Soll des Verweises: `dub` danach. */
  dub: boolean | undefined
}
const block = (laufend?: number) => [{ name: 'Staffel', folgen: 12, kacheln: 12, deutsch: 12, fremd: 0, deutscheFolgen: [{ nummer: 1, ...(laufend ? { laufend } : {}), guid: 'x' }] }]
const faelle: Fall[] = [
  { id: 900401, name: 'Kontrolle Kennungsrunde: de-DE im Katalog, eine Staffel', kennung: 'KRUNDE001', dub: true },
  { id: 900402, name: 'Kennungsrunde: Katalog ohne de-DE gibt ein Nein', kennung: 'KRUNDE002', eintrag: { audio: OHNE_DE }, dub: false },
  { id: 900403, name: 'Kennungsrunde: Katalogeintrag ohne Folgen gibt kein Urteil', kennung: 'KRUNDE003', eintrag: { folgen: 0, audio: OHNE_DE }, dub: undefined },
  { id: 900404, name: 'Kennungsrunde: Franchise mit zwei Staffeln gibt kein Urteil', kennung: 'KRUNDE004', eintrag: { staffeln: 2 }, dub: undefined },
  { id: 900405, name: 'Kennungsrunde: Titel beginnt erst nach dem Katalogstand', kennung: 'KRUNDE005', dub: undefined },
  { id: 900406, name: 'Kennungsrunde: deutsche Folgen liegen hinter dem Titelende', kennung: 'KRUNDE006', serie: { seriesId: 'KRUNDE006', staffeln: block(53) }, dub: undefined },
  { id: 900407, name: 'Kennungsrunde: laufende Nummer vor dem Titelende zählt nicht als Sperre', kennung: 'KRUNDE007', serie: { seriesId: 'KRUNDE007', staffeln: block(5) }, dub: true },
  { id: 900408, name: 'Kennungsrunde: ein gesetztes Urteil bleibt', kennung: 'KRUNDE008', stream: { dub: true }, eintrag: { audio: OHNE_DE }, dub: true },
  { id: 900409, name: 'Kennungsrunde: Adresse ohne Kennung im Pfad, Kennung aus dem Adressgedächtnis', kennung: 'KGEDAECHT', stream: { url: 'http://www.crunchyroll.com/de/ein-alter-slug' }, dub: true },
  { id: 900410, name: 'Kennungsrunde: Adresse ohne Kennung und ohne Gedächtnis', kennung: 'KOHNEGED0', stream: { url: 'http://www.crunchyroll.com/de/ein-anderer-slug' }, dub: undefined },
  { id: 900411, name: 'Nachrunde: jüngerer Katalog führt de-DE, altes Nein kippt', kennung: 'KNACHR001', stream: { dub: false }, serie: { seriesId: 'KNACHR001', geprueftAm: '2026-10-01', staffeln: [] }, dub: true },
  { id: 900412, name: 'Nachrunde: Katalog nicht jünger als die Prüfung, Nein bleibt', kennung: 'KNACHR002', stream: { dub: false }, serie: { seriesId: 'KNACHR002', geprueftAm: KATALOG_STAND, staffeln: [] }, dub: false },
  { id: 900413, name: 'Nachrunde: Katalog ohne de-DE, Nein bleibt', kennung: 'KNACHR003', stream: { dub: false }, eintrag: { audio: OHNE_DE }, serie: { seriesId: 'KNACHR003', geprueftAm: '2026-10-01', staffeln: [] }, dub: false },
  { id: 900414, name: 'Nachrunde: deutsche Folgen hinter dem Titelende, Nein bleibt', kennung: 'KNACHR004', stream: { dub: false }, serie: { seriesId: 'KNACHR004', geprueftAm: '2026-10-01', staffeln: block(53) }, dub: false },
  { id: 900415, name: 'Nachrunde: Prüfdatum fehlt, Stand des Dub-Bestands gilt', kennung: 'KNACHR005', stream: { dub: false }, serie: { seriesId: 'KNACHR005', staffeln: [] }, dub: false },
  { id: 900416, name: 'Nachrunde: Titel beginnt erst nach dem Katalogstand, Nein bleibt', kennung: 'KNACHR006', stream: { dub: false }, serie: { seriesId: 'KNACHR006', geprueftAm: '2026-10-01', staffeln: [] }, dub: false },
  { id: 900417, name: 'Nachrunde: Franchise mit zwei Staffeln, Nein bleibt', kennung: 'KNACHR007', stream: { dub: false }, eintrag: { staffeln: 2 }, serie: { seriesId: 'KNACHR007', geprueftAm: '2026-10-01', staffeln: [] }, dub: false },
]
/* Ein Fall mit zwei Titeln an einer Serie: der Besitzer (12 Folgen) gehört dazu, der andere (6) ist fremd. */
const BESITZER = 900420
const FREMD = 900421

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  schreibe('data/dub-confirmed.yaml', '# leer\n')
  schreibe('data/kino-ankuendigungen.yaml', '[]\n')
  schreibe(
    'data/ankuendigungen.yaml',
    [900405, 900416, 900450]
      .map((id) => `  - {anilistId: ${id}, platform: crunchyroll, omuAb: '2026-12-01', synchro: offen, stand: '2026-10-01', quellen: ['https://example.org/a']}`)
      .join('\n')
      .replace(/^/, 'eintraege:\n'),
  )
  const eintraegeKatalog: Eintrag[] = [
    ...faelle.filter((f) => f.kennung !== 'KOHNEGED0').map((f) => ({ id: f.kennung, audio: DE, folgen: 12, staffeln: 1, ...f.eintrag })),
    { id: 'KFREMD001', audio: DE, folgen: 12, staffeln: 1 },
    { id: 'KOFFEN001', audio: DE, folgen: 12, staffeln: 1 },
  ]
  schreibe('data/cr-katalog-de.json', { geholtAm: KATALOG_STAND, eintraege: eintraegeKatalog })
  schreibe('data/crunchyroll-series-ids.json', { adressen: { 'http://www.crunchyroll.com/de/ein-alter-slug': { seriesId: 'KGEDAECHT' } } })
  /* Zwei Staffeln mit Namen, die zu keinem Titel passen: die Fremd-Bereinigung greift nicht, das Urteil allein entscheidet. */
  schreibe('data/crunchyroll-dub.json', { serien: [{ seriesId: 'KFREMD001', geprueftAm: '2026-10-01', staffeln: [{ name: 'Alpha', folgen: 12 }, { name: 'Beta', folgen: 6 }] }] })
  const offene: Record<string, object> = {
    [adresse('OTOT00001')]: { herkunft: 'tot', geprueftAm: '2026-10-01', grund: 'Videokennung abgelaufen' },
    [adresse('OTOT00002')]: { herkunft: 'tot', geprueftAm: '2026-10-01' },
    [adresse('OTOT00003')]: { herkunft: 'tot', geprueftAm: '2026-10-01' },
    [adresse('OJA000001')]: { dub: true, geprueftAm: '2026-10-01' },
    [adresse('ONEIN0001')]: { dub: false, geprueftAm: '2026-10-01' },
    [adresse('OKEINBOOL')]: { dub: 'ja', geprueftAm: '2026-10-01' },
    [adresse('OSPAET001')]: { herkunft: 'tot', geprueftAm: '2026-10-01' },
    [adresse('OUEBERHOL')]: { dub: false, seriesId: 'OUEBERHOL', titel: 'Serie Staffel 2', geprueftAm: '2026-09-01' },
  }
  schreibe('data/crunchyroll-offene.json', offene)
  const { ordneCrKatalogZu } = await import('./bau/09-4-3-katalog.ts')
  const titel = (id: number, url: string, episodes: number | undefined, mehr: object = {}, dub?: boolean) =>
    [id, { id, slug: `katalog-${id}`, titleDe: `Katalog ${id}`, episodes, streams: [{ platform: 'crunchyroll', url, ...(dub === undefined ? {} : { dub }) }], ...mehr } as unknown as Title] as const
  const titles = new Map<number, Title>([
    ...faelle.map((f) => titel(f.id, f.stream?.url ?? adresse(f.kennung), f.episodes ?? 12, {}, f.stream?.dub)),
    titel(BESITZER, adresse('KFREMD001'), 12),
    titel(FREMD, adresse('KFREMD001'), 6),
    titel(900430, adresse('OTOT00001'), 12, { streams: [{ platform: 'crunchyroll', url: adresse('OTOT00001') }] }),
    titel(900431, adresse('OTOT00002'), 12),
    titel(900432, adresse('OTOT00003'), 12, {}, true),
    titel(900433, adresse('OJA000001'), 12),
    titel(900434, adresse('ONEIN0001'), 12),
    titel(900435, adresse('OKEINBOOL'), 12),
    titel(900450, adresse('OSPAET001'), 12),
    titel(900451, adresse('OUEBERHOL'), 12),
  ])
  titles.get(900431)!.streams.push({ platform: 'netflix', url: 'https://www.netflix.com/title/1' } as Title['streams'][number])
  const tot3 = titles.get(900432)!.streams[0]!
  const tot1 = titles.get(900430)!.streams[0]!
  const crDub = {
    scrapedAt: '2026-10-25T00:00:00Z',
    serien: [
      ...faelle.filter((f) => f.serie).map((f) => ({ url: adresse(f.kennung), ...f.serie })),
      { url: adresse('OUEBERHOL'), seriesId: 'OUEBERHOL', geprueftAm: '2026-10-10', staffeln: [{ name: 'Serie Staffel 2', folgen: 12, kacheln: 12, deutsch: 12, fremd: 0 }] },
    ],
  } as unknown as CrDubData
  const verweiseEntfernt: EntfernterVerweis[] = []
  ordneCrKatalogZu({ titles, crDub, verweiseEntfernt })
  const dubVon = (id: number) => titles.get(id)!.streams.find((s) => s.platform === 'crunchyroll')?.dub
  const gibtEsNoch = (id: number) => titles.get(id)!.streams.some((s) => s.platform === 'crunchyroll')
  for (const f of faelle) erwarte(f.name, dubVon(f.id), f.dub)
  erwarte('Fremder Titel an einer Serie, die dem anderen gehört: kein Urteil', dubVon(FREMD), undefined)
  erwarte('… der Besitzer (Folgenzahl des Katalogs) bekommt das Ja', dubVon(BESITZER), true)
  /* Offene Befunde: Adresse führt ins Leere. */
  erwarte('toter offener Befund: Verweis entfernt', gibtEsNoch(900430), false)
  erwarte('toter Befund bei einem Titel mit zweitem Weg: nur der Crunchyroll-Weg weg', titles.get(900431)!.streams.map((s) => s.platform), ['netflix'])
  erwarte('toter Befund, aber Urteil schon gesetzt: Verweis bleibt', gibtEsNoch(900432), true)
  erwarte('… und das Urteil bleibt', tot3.dub, true)
  erwarte('toter Befund wird nie zum Sprachurteil', tot1.dub, undefined)
  erwarte('toter Befund: Titel ohne Wege danach', titles.get(900430)!.streams.length, 0)
  erwarte('Befund vor dem Start der Ankündigung: Verweis bleibt', gibtEsNoch(900450), true)
  erwarte('offener Befund ja: Urteil gesetzt', dubVon(900433), true)
  erwarte('offener Befund nein: Urteil gesetzt', dubVon(900434), false)
  erwarte('offener Befund ohne Ja/Nein: kein Urteil', dubVon(900435), undefined)
  erwarte('offenes Nein vom Dub-Bestand überholt: kein Urteil', dubVon(900451), undefined)
  const eintrag = (id: number) => verweiseEntfernt.find((e) => e.titleId === id)
  erwarte('Protokoll: ein Eintrag je entfernter Weg', verweiseEntfernt.map((e) => e.titleId).sort(), [900430, 900431])
  erwarte('Protokoll: Grund aus dem Befund', eintrag(900430)?.grund, 'Videokennung abgelaufen')
  erwarte('Protokoll: Grund ohne Angabe', eintrag(900431)?.grund, 'Adresse führt ins Leere (fetch-crunchyroll-offene)')
  erwarte('Protokoll: Datum der Entfernung', /^\d{4}-\d{2}-\d{2}$/.test(eintrag(900430)?.entferntAm ?? ''), true)
  erwarte('Protokoll: Titel ohne Weg ist der letzte Weg', eintrag(900430)?.letzterWeg, true)
  erwarte('Protokoll: Titel mit zweitem Weg ist nicht der letzte', eintrag(900431)?.letzterWeg, false)
  erwarte('Protokoll: Adresse des Verweises', eintrag(900430)?.url, adresse('OTOT00001'))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-09-4-3-katalog-laufzeit:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-09-4-3-katalog-laufzeit: ${pruefungen} Prüfungen ok.`)
