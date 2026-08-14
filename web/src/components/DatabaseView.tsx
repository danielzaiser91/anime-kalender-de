import { useMemo, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { titleStatus } from '@shared/logic.ts'
import { anzeigeName, nachAusstrahlung, reihenVertreter } from '@shared/titles.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { FavoriteStar, FskBadge, HideEye, PlatformBadge, ShareIcon, StatusBadge, Toggle } from './ui.tsx'
import { useShare } from '../lib/share.ts'

const PAGE_SIZE = 60

export interface TitleGroup {
  main: Title
  members: Title[]
}

/**
 * Bündelt Staffeln derselben Reihe.
 *
 * Vertreter ist die **erste reguläre Staffel**, nicht die neueste — warum,
 * steht bei `reihenVertreter()`. Die Mitglieder stehen in
 * Ausstrahlungsreihenfolge, damit die Reihe im Detail-Panel von vorn nach
 * hinten gelesen wird.
 */
export function groupByFranchise(titles: Title[]): TitleGroup[] {
  const byFranchise = new Map<number, Title[]>()
  for (const t of titles) {
    const key = t.franchiseId ?? t.id
    const list = byFranchise.get(key)
    if (list) list.push(t)
    else byFranchise.set(key, [t])
  }
  return [...byFranchise.values()].map((members) => {
    const sorted = members.slice().sort(nachAusstrahlung)
    return { main: reihenVertreter(sorted), members: sorted }
  })
}

export function DatabaseView({
  data,
  titles,
  grouped,
  onGroupedChange,
  ohneSynchro,
  onOhneSynchroChange,
  ohneSynchroLaedt,
  favorites,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpenTitle,
}: {
  data: Dataset
  titles: Title[]
  grouped: boolean
  onGroupedChange: (next: boolean) => void
  /** Titel ohne belegte deutsche Synchro mitzeigen. */
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  /** Die Zusatzdatei ist unterwegs — der Schalter steht, die Titel noch nicht. */
  ohneSynchroLaedt: boolean
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  onOpenTitle: (id: number) => void
}) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const today = todayIso()
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [sort, setSort] = useState<'titel' | 'jahr' | 'score'>('titel')

  const anzahlOhne = useMemo(() => titles.filter((tt) => tt.ohneSynchro).length, [titles])

  const groups = useMemo(() => {
    const base: TitleGroup[] = grouped
      ? groupByFranchise(titles)
      : titles.map((tt) => ({ main: tt, members: [tt] }))

    if (sort === 'titel') base.sort((a, b) => anzeigeName(a.main).localeCompare(anzeigeName(b.main), 'de'))
    else if (sort === 'jahr') base.sort((a, b) => (b.main.jpYear ?? 0) - (a.main.jpYear ?? 0))
    else base.sort((a, b) => (b.main.score ?? 0) - (a.main.score ?? 0))
    return base
  }, [titles, grouped, sort])

  return (
    <div className="flex flex-col gap-4">
      {/*
        Der Schalter für die Titel ohne Synchro steht **abgesetzt** über der
        Zeile mit Zählung und Sortierung, nicht darin (Daniels Vorgabe,
        13.08.2026: „filter should be in a special position"). Der Grund ist
        nicht Gestaltung, sondern Bedeutung: Er verändert nicht, welcher
        Ausschnitt des Bestands gezeigt wird — er holt einen ganz anderen
        Bestand dazu, über den die Seite ausdrücklich **nichts** weiß.
      */}
      <div
        className={[
          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 transition',
          ohneSynchro
            ? 'border-amber-400/60 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10'
            : 'border-dashed border-slate-300 dark:border-white/15',
        ].join(' ')}
      >
        <Toggle
          checked={ohneSynchro}
          onChange={onOhneSynchroChange}
          label={t('db.withoutDub')}
          hint={t('db.withoutDubHint')}
        />
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {ohneSynchroLaedt ? t('db.withoutDubLoading') : t('db.withoutDubWhy')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
        {/*
          Die Zählung muss die beiden Sorten trennen, sobald beide in der Liste
          stehen. „17.856 Anime mit belegter deutscher Synchro" wäre für 15.103
          davon schlicht falsch — und damit genau die Verwechslung, die der
          Schalter verhindern soll (aufgefallen bei der Sichtprüfung, 13.08.2026).
        */}
        <span>
          {ohneSynchro && anzahlOhne > 0
            ? t('db.countSplit', {
                mit: (titles.length - anzahlOhne).toLocaleString('de-DE'),
                ohne: anzahlOhne.toLocaleString('de-DE'),
              })
            : t('db.count', { count: titles.length.toLocaleString('de-DE') })}
        </span>
        <Toggle
          checked={grouped}
          onChange={onGroupedChange}
          label={t('db.groupSeasons')}
          hint={t('db.groupSeasonsHint')}
        />
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          {t('db.sort')}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-white/5"
          >
            <option value="titel">{t('db.sortTitle')}</option>
            <option value="jahr">{t('db.sortYear')}</option>
            <option value="score">{t('db.sortScore')}</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {groups.slice(0, visible).map(({ main, members }) => {
          const releases = members.flatMap((m) => data.releasesByTitle.get(m.id) ?? [])
          const status = titleStatus(releases, today, main)
          const favorite = members.some((m) => favorites.has(m.id))
          // Eine Reihe gilt als ausgeblendet, sobald eine ihrer Staffeln es ist —
          // sonst käme das Cover über den Umweg der Fortsetzung doch wieder.
          const isHidden = members.some((m) => hidden.has(m.id))
          const platform = releases[0]?.platform ?? main.streams[0]?.platform
          /**
           * Ein Titel ohne belegte deutsche Synchro. Er sieht bewusst anders
           * aus als der gepflegte Bestand: gestrichelter Rahmen, entsättigtes
           * Cover, eigene Kennzeichnung. Wer die Liste überfliegt, soll die
           * beiden Sorten nicht verwechseln können (Daniel, 13.08.2026:
           * „prevent confusion by making it obvious through styling").
           *
           * Der Stern bleibt trotzdem da — er ist der einzige Grund, warum
           * diese Titel überhaupt angezeigt werden.
           *
           * **`every`, nicht `main.ohneSynchro`:** Eine Reihe kann die Grenze
           * überschreiten — Serie mit Synchro, ein Special ohne. Solange
           * irgendein Teil eine deutsche Fassung hat, ist die Kachel ein
           * normaler Eintrag; die Lücke steht dann in der Staffelliste des
           * Detail-Panels, wo sie hingehört.
           */
          const keinDub = members.every((m) => m.ohneSynchro)

          if (isHidden) {
            return (
              <div
                key={main.id}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-3 text-center dark:border-white/15 dark:bg-white/[0.02]"
              >
                <span className="line-clamp-3 text-xs italic text-slate-400 dark:text-slate-500">
                  {anzeigeName(main)}
                </span>
                <HideEye hidden onToggle={() => onToggleHidden(main.id)} />
              </div>
            )
          }

          return (
            <div
              key={main.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenTitle(main.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenTitle(main.id)
                }
              }}
              className={[
                'group flex cursor-pointer flex-col overflow-hidden rounded-xl text-left transition',
                keinDub ? 'border border-dashed' : 'border',
                favorite
                  ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,.3)]'
                  : keinDub
                    ? 'border-slate-400/60 hover:border-slate-500 dark:border-white/25 dark:hover:border-white/40'
                    : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25',
                keinDub ? 'bg-slate-100/70 hover:shadow-md dark:bg-white/[0.015]' : 'bg-white hover:shadow-lg dark:bg-white/[0.03]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
              ].join(' ')}
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-slate-200 dark:bg-white/5">
                {main.coverImage && (
                  <img
                    src={main.coverImage}
                    alt=""
                    loading="lazy"
                    className={[
                      'h-full w-full object-cover transition duration-300 group-hover:scale-105',
                      // Entsättigt statt blass: Ein blasses Bild sieht nach
                      // Ladefehler aus, ein graues nach Absicht. Beim Zeigen
                      // kommt die Farbe zurück — dann schaut jemand genau hin.
                      keinDub ? 'opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0' : '',
                    ].join(' ')}
                  />
                )}
                {keinDub && (
                  <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-[1px]">
                    {t('db.noDubBadge')}
                  </span>
                )}
                <span className="absolute left-1 top-1 flex items-center gap-0.5">
                  <FavoriteStar active={favorite} onToggle={() => onToggleFavorite(main.id)} />
                  <HideEye hidden={false} onToggle={() => onToggleHidden(main.id)} />
                  {/* Geteilt wird der Release, nicht der Anime — nur zu ihm
                      gibt es eine Seite mit eigenem Vorschaubild. */}
                  {releases[0] && (
                    <ShareIcon
                      onShare={() => share(releases[0].slug, releases[0].name)}
                      copied={copiedSlug === releases[0].slug}
                    />
                  )}
                </span>
                {main.fsk !== undefined && (
                  <span className="absolute right-1 top-1">
                    <FskBadge fsk={main.fsk} small />
                  </span>
                )}
                {grouped && members.length > 1 && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {t('db.seasons', { count: members.length })}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
                  {anzeigeName(main)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {main.jpYear ?? '—'}
                  {main.episodes ? ` · ${t('db.episodes', { count: main.episodes })}` : ''}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-1">
                  {keinDub ? (
                    /*
                      Kein Status, keine Plattform — beides gibt es nicht, und
                      „Termin unbekannt" wäre die falsche Auskunft: Unbekannt
                      ist nicht der Termin, sondern ob es je eine Synchro gibt.
                      Stattdessen steht hier, wozu die Kachel da ist.
                    */
                    <span
                      className={[
                        'text-[10px] leading-snug',
                        favorite ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400',
                      ].join(' ')}
                    >
                      {favorite ? t('db.noDubWatched') : t('db.noDubWatch')}
                    </span>
                  ) : (
                    <>
                      <StatusBadge status={status} small />
                      {platform && <PlatformBadge platform={platform} small />}
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {visible < groups.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE * 2)}
          className="mx-auto cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
        >
          {t('db.more', { count: Math.min(PAGE_SIZE * 2, groups.length - visible) })}
          <span className="ml-2 text-xs opacity-60">{t('db.remaining', { count: groups.length - visible })}</span>
        </button>
      )}
    </div>
  )
}
