import { PLATFORMS, type Release, type Title } from '@shared/types.ts'
import { addDays, formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

type Antwort = ReturnType<typeof berechneAntwort>

/*
  **Der Disc-Termin, den der Kopf nicht mehr trägt.**

  Nur wenn die Antwort oben aus den Streams kommt (also kein Disc-Zustand
  ist) und es wirklich eine künftige Kaufausgabe gibt. Sonst stünde die Zeile
  neben einer Überschrift, die dasselbe Datum schon nennt.
*/
export function kaufausgabeZeileVon({ title, releases, today, antwort, t }: {
  title: Title | undefined
  releases: Release[]
  today: string
  antwort: Antwort
  t: Translate
}): string | undefined {
  if (!title || antwort?.art === 'disc') return undefined
  const naechste = releases
    .filter((r) => r.releaseType === 'disc' && (r.schedule?.firstEpisodeDate ?? '') > today)
    .sort((a, b) => (a.schedule?.firstEpisodeDate ?? '').localeCompare(b.schedule?.firstEpisodeDate ?? ''))[0]
  if (!naechste?.schedule?.firstEpisodeDate) return undefined
  const label = naechste.publisher ?? naechste.edition
  const datum = formatDate(naechste.schedule.firstEpisodeDate)
  return label
    ? t('antwort.kaufausgabeAm', { datum, label })
    : t('antwort.kaufausgabeAmOhne', { datum })
}

/* Nennt die Erstausgabe denselben Anbieter früher, ist das spätere Angebot keine
   Auskunft mehr („Auf Deutsch seit 28.12.2023 · Netflix, Inc." über „Bei Netflix im
   Angebot seit 08.03.2024", Pokémon-Concierge, Stichprobe 16.09.2026). */
export function angebotSeitZeileVon(title: Title, t: Translate): string | undefined {
  return title.angebotSeit &&
    !(
      title.deErstausgabe?.von &&
      title.deErstausgabe.von <= title.angebotSeit.date &&
      (title.deErstausgabe.publisher ?? '').toLowerCase().includes((PLATFORMS[title.angebotSeit.platform]?.name ?? '§').toLowerCase())
    )
    ? t('antwort.imAngebotSeit', {
        datum: formatDate(title.angebotSeit.date),
        anbieter: PLATFORMS[title.angebotSeit.platform]?.name ?? title.angebotSeit.platform,
      })
    : undefined
}

/*
  **Kein Weg bekannt — der Satz steht im Kasten.** Kein Satz, wenn es Wege gibt oder während eines Kinolaufs
  (entschieden am belegten letzten Spieltag). Ein angekündigter Kinofilm bekommt statt dessen, was der Stern
  bringt. Mit belegten Sprechern ist es `''`: kein Text (fehlende Wege sagen das schon, die Überschrift
  „Auf Deutsch verfügbar“ nennt die Fassung), aber der TV-Rückblick darf trotzdem erscheinen.
*/
export function wegeHinweisVon({ title, antwort, favorites, verbindung, releases, today, t }: {
  title: Title | undefined
  antwort: Antwort
  favorites: Set<number>
  verbindung: NewsletterVerbindung
  releases: Release[]
  today: string
  t: Translate
}): string | undefined {
  return (
      title && antwort?.art === 'kino'
        ? /*
            Steht der deutsche Kinostart schon fest (dann ohne Synchro, sonst wäre
            es ein Release), wartet der Stern auf die deutsche Fassung.
          */
          antwort.deTermin
          ? favorites.has(title.id)
            ? t('antwort.kinoGemerktFassung')
            : verbindung.verbunden
              ? t('antwort.kinoMerkenFassungMail', { mail: verbindung.mail ?? '' })
              : t('antwort.kinoMerkenFassung')
          : favorites.has(title.id)
            ? t('antwort.kinoGemerkt')
            : verbindung.verbunden
              ? t('antwort.kinoMerkenMail', { mail: verbindung.mail ?? '' })
              : t('antwort.kinoMerken')
        : title &&
      title.streams.length === 0 &&
      (title.watchLinks?.length ?? 0) === 0 &&
      (title.hasVoices || antwort?.art !== 'ohne') &&
      /* Ein Film ohne Synchro sagt „Kein deutscher Anbieter führt ihn bisher" schon im Kasten (Stichprobe 17.09.2026). */
      !(antwort?.art === 'film' && !antwort.hatSynchro && !title.hasVoices) &&
      !releases.some(
        (r) =>
          r.platform === 'kino' &&
          (r.cinemaUntil
            ? r.cinemaUntil >= today
            : (r.schedule?.firstEpisodeDate ?? '') >= today),
      )
        ? antwort?.art === 'film' && antwort.hatSynchro && antwort.ohneWeg
          ? t('detail.whereFilmOhneWeg')
          : title.hasVoices
            ? ''
            : t('detail.whereUnknown')
        : undefined
  )
}

/*
  **Welche Notiz gilt?** Die des Releases, dessen Termin oben steht.

  Bei mehreren Releases je Titel ist das der nächste künftige, sonst der
  zuletzt erschienene — dieselbe Wahl, die der Kasten für sein Datum trifft.
*/
export function kastenNotizVon(releases: Release[], today: string): Release | undefined {
  const mitNotiz = releases.filter(
    (r) =>
      r.note &&
      /* Die Notiz des Kinostarts steht im Banner darüber. */
      !(r.platform === 'kino' && (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60))),
  )
  if (!mitNotiz.length) return undefined
  const kuenftig = mitNotiz
    .filter((r) => (r.schedule?.firstEpisodeDate ?? '') >= today)
    .sort((a, b) => (a.schedule?.firstEpisodeDate ?? '').localeCompare(b.schedule?.firstEpisodeDate ?? ''))
  const vergangen = mitNotiz
    .filter((r) => (r.schedule?.firstEpisodeDate ?? '') < today)
    .sort((a, b) => (b.schedule?.firstEpisodeDate ?? '').localeCompare(a.schedule?.firstEpisodeDate ?? ''))
  return kuenftig[0] ?? vergangen[0]
}
