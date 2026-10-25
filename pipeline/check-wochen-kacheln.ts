/**
 * Zusicherungen zu `woche-kacheln.json` (`shared/wochen-kacheln.ts`): Die Kachel-Datei behält, was der Wochenstart liest, wirft Panel-Daten
 * ab, ändert keinen Wert und meldet jeden Verlust. Erwartete Feldnamen stehen hier fest, nicht aus dem Modul geholt.
 * Aufruf: `npm run check:logic`; der Teil am Bestand steht in `check-wochen-datei-bestand.ts`.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import type { WochenDatei } from '../shared/wochen-datei.ts'
import { baueKachelDatei, pruefeKachelDatei } from '../shared/wochen-kacheln.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, extra: object = {}): Title =>
  ({
    id,
    slug: `t${id}`,
    coverImage: `c${id}`,
    format: 'TV',
    genres: ['Action'],
    keywords: ['Magie'],
    dubConfidence: 'high',
    fsk: 12,
    land: 'CN',
    titleDe: 'Name',
    titleEn: 'Name en',
    titleRomaji: 'Namu',
    titleNative: '名前',
    bannerImage: 'b',
    studios: ['S'],
    jpYear: 2026,
    franchiseId: 7,
    ...extra,
  }) as unknown as Title
const plan = {
  firstEpisodeDate: '2026-10-05',
  observed: { 1: '2026-10-05' },
  verpasst: { 2: { erwartetAm: '2026-10-12' } },
}
const release = (slug: string, titleId: number, extra: object = {}): Release =>
  ({
    slug,
    titleId,
    name: slug,
    platform: 'tv',
    releaseType: 'weekly',
    year: 2026,
    schedule: plan,
    sources: ['https://x'],
    quellen: [{ url: 'https://x' }],
    platformUrl: 'https://p',
    buyUrl: 'https://b',
    note: 'n',
    herkunft: 'h',
    ...extra,
  }) as unknown as Release
const termin = (id: string, releaseSlug: string, titleId: number): ReleaseEvent =>
  ({
    id,
    releaseSlug,
    titleId,
    date: '2026-10-06',
    name: releaseSlug,
    platform: 'tv',
    releaseType: 'weekly',
    tvPremiere: true,
    nachLuecke: true,
  }) as unknown as ReleaseEvent

const woche: WochenDatei = {
  von: '2026-10-05',
  bis: '2026-10-11',
  titles: [
    titel(1, {
      streams: [
        { platform: 'netflix', url: 'https://n', dub: true, dubRanges: [{ from: 1, to: 2, dub: true }], zugang: 'abo', seite: 's', kanal: 'k', sharedWith: [2] },
        { platform: 'toggo', url: 'https://t', dub: true, zugang: 'kostenlos', toggo: [{ von: 1, bis: 3, ab: 'a', ende: 'e' }], kanal: 'k' },
      ],
      watchLinks: [
        { name: 'Prime', kind: 'stream', zugang: 'abo', url: 'https://p', toggo: [{ von: 1 }], dubAbgeleitet: true },
        { name: 'Frei', kind: 'stream', zugang: 'kostenlos', url: 'https://f', nurFolge: 4, toggo: [{ von: 1 }] },
      ],
    }),
    titel(2),
  ],
  releases: [release('a', 1, { sendungen: [{ start: '2026-10-06T10:00', ende: '2026-10-06T10:20', folge: 'Titel', nr: 3, url: 'https://s' }] }), release('b', 2)],
  events: [termin('a-1', 'a', 1), termin('b-1', 'b', 2)],
}
const kachel = baueKachelDatei(woche)
const t1 = kachel.titles[0]! as unknown as Record<string, unknown>
const r1 = kachel.releases[0]! as unknown as Record<string, unknown>
const schluessel = (o: object) => Object.keys(o).join()

console.log('\nKachel-Datei:')
pruefe('Titel behält die Felder der Kachel', schluessel(t1) === 'id,slug,coverImage,format,genres,keywords,dubConfidence,fsk,land,streams,watchLinks', schluessel(t1))
pruefe('Titel verliert Namen, Banner, Studios, Jahr, Franchise', !['titleDe', 'titleEn', 'titleRomaji', 'titleNative', 'bannerImage', 'studios', 'jpYear', 'franchiseId'].some((f) => f in t1))
pruefe('Release behält Plan und Namen', schluessel(r1) === 'slug,titleId,name,platform,releaseType,year,schedule,sendungen', schluessel(r1))
pruefe('Release verliert Quellen, Kaufadresse, Hinweis, Herkunft', !['sources', 'quellen', 'platformUrl', 'buyUrl', 'note', 'herkunft'].some((f) => f in r1))
pruefe('der Plan (beobachtete und verpasste Folgen) bleibt ganz', JSON.stringify(r1.schedule) === JSON.stringify(woche.releases[0]!.schedule))
pruefe('Sendungen behalten nur den Beginn', JSON.stringify(r1.sendungen) === '[{"start":"2026-10-06T10:00"}]', r1.sendungen)
pruefe('Termine bleiben unverändert', JSON.stringify(kachel.events) === JSON.stringify(woche.events))
pruefe('Woche bleibt', kachel.von === '2026-10-05' && kachel.bis === '2026-10-11')
pruefe('Reihenfolge bleibt', kachel.titles.map((t) => t.id).join() === '1,2' && kachel.releases.map((r) => r.slug).join() === 'a,b')

const streams = t1.streams as Record<string, unknown>[]
pruefe('Weg ohne Gratis-Zugang: Adresse, Seite, Kanal weg, Urteil und Bereiche bleiben', schluessel(streams[0]!) === 'platform,dub,dubRanges,zugang', schluessel(streams[0]!))
pruefe('kostenloser Stream bleibt ganz (Filter „kostenlos“ liest Adresse und Fenster)', JSON.stringify(streams[1]) === JSON.stringify(woche.titles[0]!.streams![1]))
const links = t1.watchLinks as Record<string, unknown>[]
pruefe('Link ohne Gratis-Zugang: nur Name, Art, Zugang', schluessel(links[0]!) === 'name,kind,zugang', schluessel(links[0]!))
pruefe('kostenloser Link bleibt ganz', JSON.stringify(links[1]) === JSON.stringify(woche.titles[0]!.watchLinks![1]))
pruefe('der Eingang bleibt unberührt (kein Aliasing)', 'titleDe' in woche.titles[0]! && 'sources' in woche.releases[0]!)
pruefe('ein Titel ohne Wege bekommt keine leeren Listen', !('streams' in (kachel.titles[1] as unknown as object)))
pruefe('ein sauberer Schnitt hat keinen Widerspruch', pruefeKachelDatei(kachel, woche).length === 0, pruefeKachelDatei(kachel, woche))

const meldet = (k: WochenDatei, teil: string) => pruefeKachelDatei(k, woche).some((f) => f.includes(teil))
pruefe('geänderter Wert wird gemeldet', meldet({ ...kachel, titles: [{ ...kachel.titles[0]!, slug: 'x' }, kachel.titles[1]!] }, 'Titel 1 weicht'))
pruefe('verlorenes Feld wird gemeldet', meldet({ ...kachel, titles: [{ ...kachel.titles[0]!, genres: undefined } as unknown as Title, kachel.titles[1]!].map((t) => JSON.parse(JSON.stringify(t)) as Title) }, 'verliert genres'))
pruefe('verlorenes Release-Feld wird gemeldet', meldet({ ...kachel, releases: [{ ...kachel.releases[0]!, schedule: undefined } as unknown as Release, kachel.releases[1]!].map((r) => JSON.parse(JSON.stringify(r)) as Release) }, 'verliert schedule'))
pruefe('fehlender Titel wird gemeldet', meldet({ ...kachel, titles: kachel.titles.slice(1) }, '1 Titel statt 2'))
pruefe('vertauschte Reihenfolge wird gemeldet', meldet({ ...kachel, releases: [kachel.releases[1]!, kachel.releases[0]!] }, 'Stelle 0'))
pruefe('geänderter Termin wird gemeldet', meldet({ ...kachel, events: [{ ...kachel.events[0]!, date: '2026-10-07' }, kachel.events[1]!] }, 'Termine weichen'))
pruefe('andere Woche wird gemeldet', meldet({ ...kachel, bis: '2026-10-12' }, 'andere Woche'))
pruefe('erfundenes Feld wird gemeldet', meldet({ ...kachel, releases: [{ ...kachel.releases[0]!, erfunden: 1 } as unknown as Release, kachel.releases[1]!] }, 'Release a weicht'))
pruefe('gekürzte Liste im Weg wird gemeldet', meldet({ ...kachel, titles: [{ ...kachel.titles[0]!, streams: kachel.titles[0]!.streams!.slice(1) }, kachel.titles[1]!] }, 'Titel 1 weicht'))

console.log(verletzt ? `\n${verletzt} von ${faelle} Zusicherungen zur Kachel-Datei verletzt.` : `\nKachel-Datei: ${faelle} Zusicherungen halten.`)
process.exit(verletzt ? 1 : 0)
