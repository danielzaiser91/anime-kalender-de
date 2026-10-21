import { AntwortKasten } from './antwort-kasten.tsx'
import { FolgenMitNachlegern } from './nachleger-zeilen.tsx'
import { deutscheBereicheDerWege } from './stream-bereiche.ts'
import type { StreamLink, Release, Title, DiscAusgabe } from '@shared/types.ts'
import { alleNurUntertitel, alleOhneSprachbeleg, legendeDerZeilen, zeilenGruppen } from './legende-zeilen.ts'
import type { TvZuletzt } from '../../lib/tv-zuletzt.ts'
import { tvVorbeiGruppen } from './tv-vorbei.tsx'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import type { Dispatch, SetStateAction } from 'react'
import { type berechneAntwort } from './antwort-berechnen.ts'
import { terminPillen, streamZeilen, discZeilen } from './wege-zeilen.tsx'
import { angebotSeitZeileVon } from './kasten-hinweise.ts'
import { KinoZuletzt } from './kino-zuletzt.tsx'
import type { sortiereNachZugang } from './wege-sortieren.ts'

export function AntwortBereich({ antwort, sortiertNachZugang, streamReleases, terminReleases, title, t, today, wegeHinweis, tvVorbei, kastenNotiz, folgenLuecke, verbindung, favorites, folgenAngabeFuer, dubZeilen, releaseJePlattform, releases, discAusgaben, discOffen, setDiscOffen, discReleases, discZuerst }: {
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
              ...zeilenGruppen(sortiertNachZugang, title, releases),
              ...terminReleases.map((r) => [r.slug, r.platform === 'tv' ? 'tv' : 'abo'] as const),
              ...tvVorbeiGruppen(tvVorbei),
            ])
          }
          antwort={antwort}
          releases={releases}
          ohneSprachbeleg={alleNurUntertitel(sortiertNachZugang, title, releases) ? 'omu' : alleOhneSprachbeleg(sortiertNachZugang, title, releases)}
          legende={legendeDerZeilen({ sortiert: sortiertNachZugang, title, releases, folgenAngabeFuer, t })}
          terminPillen={terminPillen(terminReleases, title, releases, today, folgenAngabeFuer)}
          title={title}
          t={t}
          today={today}
          wegeHinweis={wegeHinweis}
          notiz={kastenNotiz?.note}
          folgen={<FolgenMitNachlegern titleId={title.id} wege={deutscheBereicheDerWege(title)} antwort={antwort} releases={releases} today={today} laufzeitImKopf={Boolean(title.runtimeMin)} />}
          schnitt={kastenNotiz?.schnitt}
          angebotSeit={angebotSeitZeileVon(title, t)}
          hinweis={
            folgenLuecke ? (
              <p className="mt-1 text-t4 text-slate-500 dark:text-slate-400">
                {t(/^\d+$/.test(folgenLuecke) ? 'detail.folgeOhneAnbieter' : 'detail.folgenOhneAnbieter', { bereich: folgenLuecke })}
              </p>
            ) : /* Beim Kinofilm sagt der Kino-Hinweis darunter dasselbe. */
            title.ohneSynchro && antwort?.art !== 'kino' ? (
              <>
                <p className="mt-2 text-t4 text-ak-warnung-text">
                  {verbindung.verbunden
                    ? t('detail.noDubWatchConnected', { mail: verbindung.mail ?? '' })
                    : t('detail.noDubWatchOpen')}
                </p>
                {favorites.has(title.id) && (
                  <p className="mt-1 text-t4 font-semibold text-ak-favorit-text">
                    {t('detail.noDubWatched')}
                  </p>
                )}
              </>
            ) : <KinoZuletzt titleId={title.id} antwort={antwort} t={t} />
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
