import { readJson, writeText } from './util.ts'
import type { Title } from '../../shared/types.ts'
import type { KennungsZeile } from './ausgabe-kennung.ts'
import { bannerAdresse, type TmdbBanner } from './tmdb-banner.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/banner-luecken.md'

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

const zelle = (s: string): string => s.replace(/\|/g, '/').replace(/\s+/g, ' ')

/** Warum ein Titel kein TMDB-Hintergrundbild hat. */
export function grundOhneBanner(id: number, bestand: TmdbBanner, zuordnung: Zuordnung): string {
  if (!zuordnung[String(id)]?.tmdbId) return 'keine TMDB-Zuordnung'
  if (!(String(id) in bestand)) return 'noch nicht abgefragt'
  return 'TMDB führt kein Querformat ab 1280 px'
}

/** Das TMDB-Bild eines anderen Titels derselben Reihe, als Vorschlag für den Ersatz (wird nicht selbst übernommen). */
function bildDerReihe(t: Title, titel: Title[], bestand: TmdbBanner): string {
  const geschwister = titel.filter((x) => x.id !== t.id && (x.franchiseId ?? x.id) === (t.franchiseId ?? t.id))
  const pfad = geschwister.map((x) => bestand[String(x.id)]?.p).find(Boolean)
  return pfad ? `[Bild der Reihe](${bannerAdresse(pfad)})` : '–'
}

/**
 * **Die Lückenliste der Hintergrundbilder** (Daniel, 11.10.2026): jeder Titel des Hauptbestands ohne TMDB-Bild, mit Grund und der Angabe, ob
 * vorübergehend noch das AniList-Banner steht (`bau/produkt-regel.ts`). Zum Suchen eines Ersatzes von Hand; die Datei ist nicht im Repo.
 */
export function schreibeBannerLuecken(bestand: TmdbBanner, zuordnung: Zuordnung): void {
  const titel = readJson<Title[]>('public/data/titles.json', [])
  const ak = new Map(readJson<{ titel?: KennungsZeile[] }>('data/kennungen.json', {}).titel?.map((z) => [z[1], z[0]]))
  const luecken = titel.filter((t) => !bestand[String(t.id)]?.p)
  const mitAniList = luecken.filter((t) => t.bannerImage?.includes('anilist.co')).length
  const zeilen = luecken.map((t) => {
    const name = zelle(t.titleEn ?? t.titleRomaji ?? String(t.id))
    const uebergang = t.bannerImage?.includes('anilist.co') ? 'AniList-Banner (vorübergehend)' : 'keins'
    return `| ${name} | ${ak.get(t.id) ?? '–'} | ${t.jpYear || '–'} | ${grundOhneBanner(t.id, bestand, zuordnung)} | ${uebergang} | ${bildDerReihe(t, titel, bestand)} |`
  })
  writeText(
    DATEI,
    [
      '# Titel ohne TMDB-Hintergrundbild',
      '',
      `${luecken.length} von ${titel.length} Titeln des Hauptbestands haben kein TMDB-Hintergrundbild; bei ${mitAniList} steht vorübergehend noch das AniList-Banner, bei ${luecken.length - mitAniList} keins.`,
      'Erzeugt von `pipeline/fetch-tmdb-banner.ts`. Ersatz wird von Hand gesucht; ist er da, fällt der AniList-Übergang weg. „Bild der Reihe“ ist nur ein Vorschlag.',
      '',
      '| Titel | ak | Jahr | Grund | Übergang | Ersatz-Vorschlag |',
      '|---|---|---|---|---|---|',
      ...zeilen,
      '',
    ].join('\n'),
  )
}
