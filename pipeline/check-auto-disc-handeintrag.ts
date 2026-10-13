/**
 * Ein Handeintrag ersetzt nur den Termin desselben Tags (13.10.2026, Fall Loner Life in Another World): Der Handeintrag zu
 * Volume 2 (29.01.2027) ließ den automatischen Disc-Termin zu Volume 1 (27.11.2026) wegfallen, weil `releasesAus` je Titel
 * und Anbieter nur einen Termin zuließ. Bei Discs zählt jetzt der Tag (oder die Quelle des Handeintrags); alle anderen Anbieter bleiben je Titel einer.
 */
import { releasesAus } from './lib/meldungen.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Eingabe = Parameters<typeof releasesAus>
const titel = [{ id: 173693, titleEn: 'Loner Life in Another World', format: 'TV' }] as unknown as Eingabe[1]

const meldung = (tag: string, category: string, platforms: string[]) =>
  ({
    articleTitle: 'Loner Life in Another World: Blu-ray-Termin',
    articleUrl: 'https://www.anime2you.de/news/1046376/loner-life-in-another-world-blu-ray-termin/',
    category,
    platforms,
    titleId: 173693,
    dub: 'ja',
    dates: [{ iso: tag, context: `erscheint am ${tag}` }],
  }) as unknown as Eingabe[0][number]

const hand = (slug: string, platform: string, tag: string) =>
  ({ slug, titleId: 173693, platform, releaseType: platform === 'disc' ? 'disc' : 'weekly', schedule: { firstEpisodeDate: tag }, sources: ['https://a/1'] }) as unknown as Eingabe[2][number]

const disc = (tag: string) => meldung(tag, 'disc', ['disc'])
const heute = '2026-10-13'

const vol2 = hand('loner-life-vol2', 'disc', '2027-01-29')
const mitVol2 = releasesAus([disc('2026-11-27')], titel, [vol2], heute)
pruefe('Disc: ein Handeintrag zu Volume 2 lässt den automatischen Termin zu Volume 1 stehen', mitVol2.length === 1 && mitVol2[0]?.schedule.firstEpisodeDate === '2026-11-27', mitVol2.map((r) => r.schedule.firstEpisodeDate))
pruefe('Disc: der automatische Termin behält seine Adresse (kein Tag im Slug)', mitVol2[0]?.slug === 'auto-173693-disc', mitVol2[0]?.slug)

const gleicherTag = releasesAus([disc('2027-01-29')], titel, [vol2], heute)
pruefe('Disc: derselbe Tag im Handeintrag ersetzt den automatischen Termin weiterhin', gleicherTag.length === 0, gleicherTag.map((r) => r.slug))

/* Fall A New Dawn (177132): Der Handeintrag führt den Artikel als Quelle und trägt einen anderen Tag (11.12. statt 04.12.) — der Artikel erzeugt dort keinen zweiten Termin. */
const zitiert = { ...hand('hand-zitiert', 'disc', '2027-01-29'), sources: [disc('2026-11-27').articleUrl] }
const gelesen = releasesAus([disc('2026-11-27')], titel, [zitiert], heute)
pruefe('Disc: ein Handeintrag, der den Artikel als Quelle führt, ersetzt dessen Termin auch bei anderem Tag', gelesen.length === 0, gelesen.map((r) => r.slug))

const belegterSlug = releasesAus([disc('2026-11-27')], titel, [hand('auto-173693-disc', 'disc', '2027-01-29')], heute)
pruefe('Disc: liegt der Slug schon beim Handeintrag eines anderen Tags, hängt der Tag dran (keine doppelte Adresse)', belegterSlug[0]?.slug === 'auto-173693-disc-2026-11-27', belegterSlug[0]?.slug)

const zweiMeldungen = releasesAus([disc('2026-11-27'), disc('2027-01-29')], titel, [], heute)
pruefe('Disc: zwei Meldungen zum selben Titel ergeben je Lauf weiter nur einen automatischen Termin', zweiMeldungen.length === 1, zweiMeldungen.map((r) => r.slug))

const streamingHand = hand('hand-stream', 'crunchyroll', '2026-10-20')
const streaming = releasesAus([meldung('2026-10-27', 'streaming', ['crunchyroll'])], titel, [streamingHand], heute)
pruefe('Streaming: ein Handeintrag desselben Anbieters verdrängt weiterhin jeden automatischen Termin', streaming.length === 0, streaming.map((r) => r.slug))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-auto-disc-handeintrag: alle Zusicherungen erfüllt.')
