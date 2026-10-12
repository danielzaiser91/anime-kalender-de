import { AntwortKasten } from './antwort-kasten.tsx'
import { FolgenMitNachlegern } from './nachleger-zeilen.tsx'
import { PLATFORMS, type StreamLink, type Release, type Title, type DiscAusgabe } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import { alleOhneSprachbeleg, legendeDerZeilen, zeilenGruppen } from './legende-zeilen.ts'
import type { TvZuletzt } from '../../lib/tv-zuletzt.ts'
import { tvVorbeiGruppen } from './tv-vorbei.tsx'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import type { Dispatch, SetStateAction } from 'react'
import { type berechneAntwort } from './antwort-berechnen.ts'
import { terminPillen, streamZeilen, discZeilen } from './wege-zeilen.tsx'
import type { sortiereNachZugang } from './wege-sortieren.ts'

export function AntwortBereich({ antwort, sortiertNachZugang, streamReleases, terminReleases, title, t, today, wegeHinweis, tvVorbei, kastenNotiz, kaufausgabeZeile, folgenLuecke, verbindung, favorites, folgenAngabeFuer, dubZeilen, releaseJePlattform, releases, discAusgaben, discOffen, setDiscOffen, discReleases, discZuerst }: {
  antwort: ReturnType<typeof berechneAntwort>
  sortiertNachZugang: ReturnType<typeof sortiereNachZugang>
  streamReleases: Release[]
  /** Alle Termine mit Anbieter/Sender, auch die, deren Anbieter schon als Link da ist. */
  terminReleases: Release[]
  title: Title
  t: Translate
  today: string
  wegeHinweis: string | undefined
  tvVorbei: TvZuletzt[]
  kastenNotiz: Release | undefined
  kaufausgabeZeile: string | undefined
  folgenLuecke: string | null
  verbindung: NewsletterVerbindung
  favorites: Set<number>
  folgenAngabeFuer: (s: { platform?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; dub?: boolean; fenster?: StreamLink['fenster']; } | undefined) => string
  dubZeilen: (s: { dubRanges?: StreamLink['dubRanges']; }) => string[]
  releaseJePlattform: Map<string, Release>
  releases: Release[]
  discAusgaben: DiscAusgabe[]
  discOffen: boolean
  setDiscOffen: Dispatch<SetStateAction<boolean>>
  discReleases: Release[]
  /** Über einen Disc-Termin geöffnet — der Umschalter startet auf „Disc". */
  discZuerst?: boolean
}) {
  return (
    <>
      {antwort && (
        <AntwortKasten
          pillenGruppen={
            new Map([
              ...zeilenGruppen(sortiertNachZugang, title),
              ...terminReleases.map((r) => [r.slug, r.platform === 'tv' ? 'tv' : 'abo'] as const),
              ...tvVorbeiGruppen(tvVorbei),
            ])
          }
          antwort={antwort}
          ohneSprachbeleg={alleOhneSprachbeleg(sortiertNachZugang, title)}
          legende={legendeDerZeilen({ sortiert: sortiertNachZugang, title, folgenAngabeFuer, t })}
          terminPillen={terminPillen(terminReleases, title, releases, today)}
          title={title}
          t={t}
          today={today}
          wegeHinweis={wegeHinweis}
          notiz={kastenNotiz?.note}
          folgen={<FolgenMitNachlegern titleId={title.id} antwort={antwort} releases={releases} today={today} laufzeitImKopf={Boolean(title.runtimeMin)} />}
          schnitt={kastenNotiz?.schnitt}
          angebotSeit={
            /* Nennt die Erstausgabe denselben Anbieter früher, ist das spätere Angebot keine
               Auskunft mehr („Auf Deutsch seit 28.12.2023 · Netflix, Inc." über „Bei Netflix im
               Angebot seit 08.03.2024", Pokémon-Concierge, Stichprobe 16.09.2026). */
            title.angebotSeit &&
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
          kaufausgabe={kaufausgabeZeile}
          hinweis={
            folgenLuecke ? (
              <p className="mt-1 text-t4 text-slate-500 dark:text-slate-400">
                {t(/^\d+$/.test(folgenLuecke) ? 'detail.folgeOhneAnbieter' : 'detail.folgenOhneAnbieter', { bereich: folgenLuecke })}
              </p>
            ) : /* Beim Kinofilm sagt der Kino-Hinweis darunter dasselbe. */
            title.ohneSynchro && antwort?.art !== 'kino' ? (
              <>
                <p className="mt-2 text-t4 text-amber-600 dark:text-amber-400">
                  {verbindung.verbunden
                    ? t('detail.noDubWatchConnected', { mail: verbindung.mail ?? '' })
                    : t('detail.noDubWatchOpen')}
                </p>
                {favorites.has(title.id) && (
                  <p className="mt-1 text-t4 font-semibold text-amber-600 dark:text-amber-400">
                    {t('detail.noDubWatched')}
                  </p>
                )}
              </>
            ) : undefined
          }
          stream={streamZeilen({ sortiertNachZugang, title, t, today, folgenAngabeFuer, dubZeilen, releaseJePlattform, streamReleases, releases, tvVorbei })}
          disc={discZeilen({ sortiertNachZugang, title, t, today, folgenAngabeFuer, discAusgaben, discOffen, setDiscOffen, discReleases })}
          discZuerst={discZuerst}
          key={discZuerst ? 'disc' : 'stream'}
        />
      )}
    </>
  )
}
