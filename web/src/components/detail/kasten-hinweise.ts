import { PLATFORMS, type Release, type Title } from '@shared/types.ts'
import { addDays, formatDate } from '@shared/time.ts'
import { verlagIstAnbieter } from '@shared/verlag-anbieter.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

type Antwort = ReturnType<typeof berechneAntwort>

/* Nennt die Erstausgabe denselben Anbieter früher, ist das spätere Angebot keine
   Auskunft mehr („Auf Deutsch seit 28.12.2023 · Netflix, Inc." über „Bei Netflix im
   Angebot seit 08.03.2024", Pokémon-Concierge, Stichprobe 16.09.2026). */
export function angebotSeitZeileVon(title: Title, t: Translate): string | undefined {
  return title.angebotSeit &&
    !(
      title.deErstausgabe?.von &&
      title.deErstausgabe.von <= title.angebotSeit.date &&
      verlagIstAnbieter(title.deErstausgabe.publisher, title.angebotSeit.platform)
    )
    ? t('antwort.imAngebotSeit', {
        datum: formatDate(title.angebotSeit.date),
        anbieter: PLATFORMS[title.angebotSeit.platform]?.name ?? title.angebotSeit.platform,
      })
    : undefined
}

/*
  **Kein Weg bekannt — der Kasten schweigt.** Kein Satz, wenn es Wege gibt oder während eines Kinolaufs
  (entschieden am belegten letzten Spieltag). Ein angekündigter Kinofilm bekommt statt dessen, was der Stern
  bringt. Sonst ist es `''` (13.10.2026, Daniel: Zeigen wir keine Bezugswege, ist uns keiner bekannt): kein Text,
  aber der TV-Rückblick darf trotzdem erscheinen.
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
        ? ''
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
