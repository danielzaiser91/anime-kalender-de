/**
 * Ablauftest zu `bau/11-2-2-wege-ohne-weg.ts`: Ein JustWatch-Angebot fehlt nur, wenn der Titel **denselben Anbieter** schon trägt — nicht,
 * sobald er irgendeinen Weg hat (Anlass 06.11.2026: der aniSearch-Disc-Link verdrängte Netflix und Disney+). Läuft über den Aufrufer
 * `ergaenzeWegeAusJustwatch` auf einer Kulisse im Temp-Ordner (`AK_ROOT`), damit auch die Verdrahtung (`entfernt`, Handbelege) belegt ist.
 * Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'wege-je-anbieter-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'shop-wege-falsches-ziel.yaml'), '[]\n')

const netflix = (n: number, extra = {}) => ({ anbieter: 'Netflix', art: 'FLATRATE', url: `https://www.netflix.com/title/8100${n}`, ...extra })
const disney = (n: number, extra = {}) => ({ anbieter: 'Disney Plus', art: 'FLATRATE', url: `https://www.disneyplus.com/de-de/browse/entity-${n}`, ...extra })
const apple = (n: number) => ({ anbieter: 'Apple TV Store', art: 'BUY', url: `https://tv.apple.com/de/movie/umc.cmc.${n}` })
const thalia = (n: number) => ({ anbieter: 'Thalia', art: 'BUY', url: `https://www.thalia.de/shop/home/artikeldetails/A${n}` })
const befund = (angebote: unknown[]) => ({ geprueftAm: '2999-12-31', jwId: 'tm1', altersangabe: '16', angebote })

const jw: Record<number, unknown> = {
  900201: befund([thalia(1), apple(1), netflix(1)]),
  900202: befund([netflix(2), disney(2)]),
  900203: befund([{ anbieter: 'Amazon Video', art: 'BUY', url: 'https://www.amazon.de/gp/video/detail/B0AAAAAA03' }]),
  900204: befund([
    { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/series/G9' },
    disney(4, { audio: ['ja'] }),
    { anbieter: 'Joyn', art: 'ADS', url: 'https://www.joyn.de/serien/x', audio: ['de'] },
    { anbieter: 'WOW', art: 'FLATRATE', url: 'https://www.wowtv.de/serien/x', audio: [] },
  ]),
  900205: befund([netflix(5)]),
  900206: befund([netflix(6)]),
  900207: befund([netflix(7)]),
  900208: befund([netflix(8)]),
  900209: befund([thalia(9), netflix(9), { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/series/G10' }]),
  900211: befund([netflix(11)]),
  900212: befund([netflix(12)]),
  900213: befund([netflix(13)]),
  900210: befund([apple(10), netflix(10), disney(10), { anbieter: 'Joyn', art: 'FREE', url: 'https://www.joyn.de/serien/y' }, { anbieter: 'MagentaTV', art: 'FLATRATE', url: 'https://www.telekom.de/magentatv/z' }, { anbieter: 'Videoload', art: 'RENT', url: 'https://www.videoload.de/film/y' }]),
}
writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(jw))
writeFileSync(join(wurzel, 'data', 'verweise-entfernt.json'), JSON.stringify({ verweise: [{ titleId: 900205, plattform: 'netflix', grund: 'Adresse tot' }, { titleId: 900212, plattform: 'netflix', grund: 'Adresse tot' }] }))
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  ['- anilistId: 900207', '  title: Kulisse Nein', '  platform: netflix', '  available: false', "  checkedAt: '2026-10-23'", ''].join('\n'),
)

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

try {
  const { ergaenzeWegeAusJustwatch } = await import('./bau/11-2-justwatch.ts')
  const { ergaenzeWegeOhneWeg } = await import('./bau/11-2-2-wege-ohne-weg.ts')
  const disc = { name: 'aniSearch', url: 'https://www.anisearch.de/article/1,x', kind: 'buy', zugang: 'kauf' }
  const titel = (id: number, extra: Partial<Title> = {}) => ({ id, streams: [stream('youtube')], watchLinks: [disc], keywords: [], genres: [], ...extra }) as unknown as Title
  const stream = (platform: string) => ({ platform, url: `https://example.org/${platform}` })
  const titles = new Map<number, Title>(
    [
      titel(900201),
      titel(900202, { streams: [stream('netflix')] as never }),
      titel(900203, { streams: [stream('primevideo')] as never }),
      titel(900204),
      titel(900205),
      titel(900206),
      titel(900207),
      titel(900208),
      titel(900209, { streams: [], watchLinks: [] }),
      titel(900210),
      titel(900211, { watchLinks: [disc as never, { name: 'Netflix', url: 'https://www.netflix.com/title/1', kind: 'stream', zugang: 'abo' } as never] }),
      titel(900212, { streams: [], watchLinks: [] }),
      titel(900213, { watchLinks: [{ name: 'Amazon', url: 'https://www.amazon.de/dp/B0X', kind: 'buy', zugang: 'kauf' } as never] }),
    ].map((t) => [t.id, t]),
  )
  ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig: new Set(['900208']), istTot: () => false })
  const namen = (id: number) => (titles.get(id)?.watchLinks ?? []).map((w) => w.name)
  const neue = (id: number) => namen(id).filter((n) => n !== 'aniSearch')

  pruefe('Disc-Link allein verdrängt Netflix nicht mehr (900201)', neue(900201).includes('Netflix'), namen(900201))
  pruefe('Abo steht vor Leihe/Kauf (900201)', neue(900201).indexOf('Netflix') < neue(900201).indexOf('Apple TV'), namen(900201))
  pruefe('mit Stream schließt ein anderer Kauflink den Riegel nicht, Netflix kommt dazu (900213)', namen(900213).includes('Netflix'), namen(900213))
  pruefe('Disc-Händler kommt nicht zu einem Titel mit Weg (900201)', !namen(900201).includes('Thalia'), namen(900201))
  pruefe('der Disc-Link bleibt stehen (900201)', namen(900201).includes('aniSearch'), namen(900201))
  pruefe('selber Anbieter wie der Stream: kein Doppel (900202)', !namen(900202).includes('Netflix'), namen(900202))
  pruefe('anderer Anbieter kommt dazu (900202)', namen(900202).includes('Disney Plus'), namen(900202))
  pruefe('Amazon Video bei vorhandenem Prime-Weg nicht (900203)', !namen(900203).includes('Amazon Video'), namen(900203))
  pruefe('Sub-Dienst mit eigener Sprachquelle kommt nicht dazu (900204)', !namen(900204).includes('Crunchyroll'), namen(900204))
  pruefe('Ton ohne Deutsch hält das Angebot zurück (900204)', !namen(900204).includes('Disney Plus'), namen(900204))
  pruefe('Ton mit Deutsch kommt dazu (900204)', namen(900204).includes('Joyn'), namen(900204))
  pruefe('leere Tonliste belegt nichts gegen das Angebot, es kommt dazu (900204)', namen(900204).includes('Wow'), namen(900204))
  pruefe('entfernter Verweis kommt nicht zurück (900205)', !namen(900205).includes('Netflix'), namen(900205))
  pruefe('Kontrolle: ohne Eintrag im Gedächtnis kommt Netflix (900206)', namen(900206).includes('Netflix'), namen(900206))
  pruefe('Nein-Handbeleg hält Netflix zurück (900207)', !namen(900207).includes('Netflix'), namen(900207))
  pruefe('mehrdeutige TMDB-Kennung hält alles zurück (900208)', neue(900208).length === 0, namen(900208))
  pruefe('Titel ohne jeden Weg: wie bisher Händler und Sub-Dienst (900209)', ['Thalia', 'Netflix', 'Crunchyroll'].every((n) => namen(900209).includes(n)), namen(900209))
  pruefe('ein gleichnamiger Bezugsweg wird nicht doppelt angelegt (900211)', namen(900211).filter((n) => n === 'Netflix').length === 1, namen(900211))
  pruefe('ohne jeden Weg gilt das Gedächtnis der entfernten Verweise nicht (wie bisher, 900212)', namen(900212).includes('Netflix'), namen(900212))
  /* Die Grenze von vier gilt dieser Runde; die Runde danach (Titel mit Wegen, Anbieter ohne eigene Plattform) hat ihre eigene Kette. */
  const allein = new Map<number, Title>([[900210, titel(900210)]])
  ergaenzeWegeOhneWeg({ titles: allein, jw: jw as never, handNein: new Set(), tmdbMehrdeutig: new Set(), istTot: () => false })
  pruefe('höchstens vier neue je Titel (900210)', (allein.get(900210)?.watchLinks ?? []).length === 1 + 4, allein.get(900210)?.watchLinks)
  pruefe('von den sechs Angeboten kommen zuerst die Abos (900210)', (allein.get(900210)?.watchLinks ?? []).every((w) => w.name !== 'Videoload' && w.name !== 'Apple TV'), allein.get(900210)?.watchLinks)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`Wege je Anbieter: ok (${faelle} Fälle)`)
