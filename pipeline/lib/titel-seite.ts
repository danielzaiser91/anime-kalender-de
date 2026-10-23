/**
 * Die Seite eines einzelnen Titels (`/t/<Adresse>/`): Kopf mit Vorschau-Angaben und sichtbarer Inhalt.
 * Aus `build-share-pages.ts` ausgelagert, damit die Datei unter ihrer Grenze bleibt.
 */
import { PLATFORMS, type Release, type Title } from '../../shared/types.ts'
import { GENRE_DE } from '../../shared/mappings.ts'
import { teilenPfad, titelAdresse, titelHash } from '../../shared/teilen.ts'
import { synchroBelegt } from '../../shared/titles.ts'
import { seitenTitel } from '../../shared/seiten-titel.ts'
import { andereNamen, titelJsonLd } from './titel-namen.ts'
import { standardBildAdresse } from './og-standard.ts'
import type { Umfeld } from './titel-umfeld.ts'

export { seitenTitel }

export const SITE = (process.env.SITE_URL ?? 'https://anime-kalender.de/').replace(
  /\/?$/,
  '/',
)

/** Gemeinsamer Rahmen der vorgerenderten Seiten. */
export const ARTIKEL_STIL =
  'max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;' +
  'font-family:system-ui,sans-serif;line-height:1.6;'

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function titelName(t: Title): string {
  return t.titleDe ?? t.titleEn ?? t.titleRomaji ?? t.slug
}

/** Die erste Aussage der Beschreibung. Bei Cartoons ist die deutsche Fassung nicht belegt (`dubConfidence: low`): Dort steht nur, wo sie läuft. */
function ersteAussage(t: Title): string {
  if (t.westlich) {
    const orte = [...new Set((t.streams ?? []).map((s) => PLATFORMS[s.platform].name))]
    return orte.length ? `Zu sehen bei ${orte.join(', ')}.` : 'Westliche Animationsserie.'
  }
  const wege = (t.streams ?? []).filter((s) => s.dub === true).map((s) => PLATFORMS[s.platform].name)
  return wege.length ? `Auf Deutsch bei ${[...new Set(wege)].join(', ')}.` : (synchroSatz(t) ?? '')
}

/** Der Satz zur Synchro: nur bei belegter Synchro „Mit deutscher Synchronisation“; Cartoons nennen keinen (dort ist sie nicht der Normalfall). */
export function synchroSatz(t: Title | undefined): string | null {
  if (t?.westlich) return null
  return t && synchroBelegt(t) ? 'Mit deutscher Synchronisation.' : 'Deutsche Synchro angekündigt oder wahrscheinlich, noch nicht belegt.'
}

/** Überschrift über den Terminen: „mit deutscher Synchronisation“ nur, wo die Synchro belegt ist. */
export function termineUeberschrift(t: Title | undefined): string {
  return t && synchroBelegt(t) ? 'Alle Termine mit deutscher Synchronisation' : 'Alle Termine'
}

/** Schema.org-Sprache des Werks: `de` nur bei belegter deutscher Synchro, sonst kein Feld (Sprache der Seite sagt `<html lang>`). */
export function sprachFeld(t: Title | undefined): { inLanguage?: 'de' } {
  return t && synchroBelegt(t) ? { inLanguage: 'de' } : {}
}

function titelBeschreibung(t: Title): string {
  const teile = [
    ersteAussage(t),
    t.episodes && t.format !== 'MOVIE' ? `${t.episodes} Folgen.` : null,
    t.genres?.length ? t.genres.slice(0, 3).map((g) => GENRE_DE[g] ?? g).join(', ') + '.' : null,
  ]
  return teile.filter(Boolean).join(' ')
}

/** Auch Titel ohne Termin tragen Schema.org-Daten, mit allen Schreibweisen als `alternateName`. */
function titelDaten(t: Title, name: string, url: string, description: string, bild: string | undefined): Record<string, unknown> {
  const daten: Record<string, unknown> = { '@context': 'https://schema.org', '@type': t.format === 'MOVIE' ? 'Movie' : 'TVSeries', name, url, ...sprachFeld(t), description }
  const andere = andereNamen(t, name)
  if (andere.length) daten.alternateName = andere
  if (t.genres?.length) daten.genre = t.genres.slice(0, 5).map((g) => GENRE_DE[g] ?? g)
  if (t.format !== 'MOVIE' && t.episodes) daten.numberOfEpisodes = t.episodes
  if (t.jpYear) daten.datePublished = String(t.jpYear)
  if (bild) daten.image = bild
  return daten
}

/** „Auch bekannt als": die übrigen Schreibweisen im sichtbaren Text, damit Suchen nach englischem, Romaji- oder japanischem Namen die Seite finden. */
export function namenZeile(t: Title | undefined, gezeigt: string): string {
  const andere = andereNamen(t, gezeigt)
  return andere.length ? `<p style="margin:0 0 1rem;color:#9aa5bd;">Auch bekannt als: ${andere.map(esc).join(' · ')}</p>` : ''
}

export function titelKopf(t: Title, umfeld: Umfeld, standardKennung: string, mitTermin = false): string {
  const url = `${SITE}${teilenPfad(t.slug)}`
  const name = titelName(t)
  const headline = seitenTitel(name, t, mitTermin)
  const description = titelBeschreibung(t)
  /* Ohne eigenes Bild das Standardbild der Seite (1200×630): Eine Karte ohne Bild wäre leer. */
  const eigenesBild = t.bannerImage ?? t.coverImage
  const bild = eigenesBild ?? standardBildAdresse(SITE, standardKennung)
  const gross = Boolean(t.bannerImage) || !eigenesBild
  const masse = eigenesBild ? '' : '    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n'
  return `    <title>${esc(headline)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Anime-Kalender DE" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(headline)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(bild)}" />
${masse}    <meta property="og:image:alt" content="${esc(name)}" />
    <meta name="twitter:card" content="${gross ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${esc(headline)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(bild)}" />
    <link rel="canonical" href="${url}" />
${titelJsonLd(titelDaten(t, name, url, description, eigenesBild))}
${umfeld.krumenJsonLd}
    <script>
      if (!location.hash) location.hash = ${JSON.stringify(titelHash(t.id, t.slug))};
    </script>`
}

/** Der Absatz mit der Handlung, darunter (nur bei eigenen Texten) die fertige Quellenzeile. */
export type SynopsenText = { text: string; quelle: string }

export function synopsenAbsatz(synopsis: SynopsenText | undefined): string {
  return synopsis ? `<p style="margin:0 0 1.5rem;">${esc(synopsis.text)}</p>${synopsis.quelle}` : ''
}

export function titelInhalt(t: Title, synopsis: SynopsenText | undefined, eigene: Release[], umfeld: Umfeld): string {
  const name = titelName(t)
  const wege = (t.streams ?? []).filter((s) => s.dub === true)
  const liste = (zeilen: string[]) => `<ul style="margin:0 0 1.5rem;padding-left:1.2rem;">\n        ${zeilen.join('\n        ')}\n      </ul>`
  return `<article style="max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;font-family:system-ui,sans-serif;line-height:1.6;">
      ${umfeld.krumenHtml}
      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">${esc(name)}</h1>
      <p style="margin:0 0 1rem;color:#9aa5bd;">${esc(titelBeschreibung(t))}</p>
      ${namenZeile(t, name)}
      ${synopsenAbsatz(synopsis)}
      ${
        wege.length
          ? `<h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Wo ${esc(name)} auf Deutsch läuft</h2>\n      ` +
            liste(wege.map((s) => `<li><a href="${esc(s.url)}" rel="nofollow" style="color:#7dd3fc;">${esc(PLATFORMS[s.platform].name)}</a></li>`))
          : ''
      }
      ${
        eigene.length
          ? `<h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Termine</h2>\n      ` +
            liste(eigene.map((r) => `<li>${esc(r.name)}</li>`))
          : ''
      }
      ${umfeld.aehnlichHtml}
      <p><a href="${esc(SITE + titelAdresse(t.id, t.slug))}" style="color:#7dd3fc;">Im Kalender ansehen</a></p>
    </article>`
}
