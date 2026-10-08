import { useMemo } from 'react'
import type { PlatformId, ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import type { Dataset } from '../../lib/data.ts'
import { useLang } from '../../lib/i18n.tsx'
import { coverBild, KACHEL_DICHTE } from '../../lib/cover.ts'
import { icsHerunterladen, meineWoche, meineWocheIcs, useMeinePlattformen } from '../../lib/meine-woche.ts'
import { useNewsletterVerbindung } from '../../lib/newsletterSync.ts'
import { pushAktivGemerkt } from '../../lib/push.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import { anbieterUndFolge } from './Marken.tsx'
import { FavoriteStar } from '../ui.tsx'

export interface MeineWocheProps {
  data: Dataset
  anchorDate: string
  favorites: Set<number>
  /** Vorschau-Variante „leer": zeigt den Einstieg ohne Favoriten, auch wenn welche da sind. */
  leer?: boolean
  onToggleFavorite: (id: number) => void
  onOpen: (slug: string, date: string) => void
}

/** Anbieter, die als „habe ich" wählbar sind — ohne Kino und Unbekannt; Disc ist eine Art, keine Plattform. */
const WAEHLBAR: PlatformId[] = ['crunchyroll', 'netflix', 'primevideo', 'disneyplus', 'adn', 'aniverse', 'wow', 'joyn', 'rtlplus', 'youtube', 'tv']

/**
 * **Meine Woche** (Prototyp, 08.10.2026): „Was kann ich diese Woche auf Deutsch sehen?" — nur gemerkte Titel,
 * nur eigene Plattformen, je Termin der Sprung zum Anbieter. Darunter, was von den Favoriten gerade ruht,
 * und die drei Wege, nichts zu verpassen. Konzept und Grenzen: `docs/wissen/meine-woche.md`.
 */
export function MeineWoche(p: MeineWocheProps) {
  const { t } = useLang()
  const [plattformen, umschalten] = useMeinePlattformen()
  const heute = todayIso()
  const favoriten = p.leer ? new Set<number>() : p.favorites
  const namen = useMemo(() => new Map([...p.data.titleById].map(([id, titel]) => [id, anzeigeName(titel)])), [p.data])
  const woche = useMemo(() => meineWoche(p.data.events, favoriten, plattformen, p.anchorDate, namen), [p.data, favoriten, plattformen, p.anchorDate, namen])
  const anzahl = woche.tage.reduce((s, d) => s + d.termine.length, 0)
  const vorhanden = useMemo(() => new Set(p.data.meta.platforms), [p.data])

  return (
    <div className="flex flex-col gap-5" data-meine-woche>
      <section className="rounded-2xl border border-ak-rand bg-ak-flaeche p-4">
        <h2 className="text-xs font-bold tracking-[0.1em] text-ak-leise uppercase">{t('mw.plattformen')}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WAEHLBAR.filter((id) => vorhanden.has(id)).map((id) => {
            const an = plattformen.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={an}
                onClick={() => umschalten(id)}
                className={[
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition',
                  an ? 'border-transparent text-white' : 'border-ak-rand bg-ak-flaeche-2 text-ak-leise hover:text-ak-text',
                ].join(' ')}
                style={an ? { background: PLATFORMS[id].color } : undefined}
              >
                {an ? '✓ ' : ''}
                {PLATFORMS[id].name}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ak-sehr-leise">{plattformen.length ? t('mw.plattformenHinweis') : t('mw.plattformenAlle')}</p>
      </section>

      {!favoriten.size ? (
        <Einstieg />
      ) : (
        <>
          <p className="text-sm text-ak-leise">
            {anzahl ? t('mw.zahl', { n: anzahl, fav: favoriten.size }) : t('mw.nichts', { fav: favoriten.size })}
          </p>
          <ol className="flex flex-col">
            {woche.tage.map((tag) => (
              <TagZeile key={tag.date} date={tag.date} termine={tag.termine} heute={heute} p={p} />
            ))}
          </ol>
          {woche.anderswo.length > 0 && (
            <p className="text-xs text-ak-leise">
              {t('mw.anderswo')}: {woche.anderswo.map((a) => `${a.name} (${PLATFORMS[a.platform].name})`).join(', ')}
            </p>
          )}
          {woche.ruhig.length > 0 && <Ruhig liste={woche.ruhig} onOpen={p.onOpen} />}
        </>
      )}

      <Erinnern data={p.data} favoriten={favoriten} plattformen={plattformen} heute={heute} />
    </div>
  )
}

function TagZeile({ date, termine, heute, p }: { date: string; termine: ReleaseEvent[]; heute: string; p: MeineWocheProps }) {
  const { t } = useLang()
  const istHeute = date === heute
  const vorbei = date < heute
  return (
    <li className={['grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 border-t border-ak-linie py-3 sm:grid-cols-[96px_minmax(0,1fr)]', vorbei && !termine.length ? 'ak-vorbei' : ''].join(' ')}>
      <div className={istHeute ? 'text-ak-akzent-text' : 'text-ak-text'}>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase">{weekdayName(date, true)}</div>
        <div className="font-display text-2xl leading-none font-bold">{Number(date.slice(8))}</div>
        {istHeute && <div className="text-[11px] font-semibold">{t('week.today')}</div>}
      </div>
      {termine.length ? (
        <ul className="flex flex-col gap-2">
          {termine.map((ev) => (
            <Termin key={ev.id} ev={ev} p={p} vorbei={vorbei} />
          ))}
        </ul>
      ) : (
        <p className="self-center text-sm text-ak-sehr-leise">{t('mw.frei')}</p>
      )}
    </li>
  )
}

/** Ein Termin als Zeile: kleines Cover, Titel, „Anbieter · Folge", Uhrzeit, Sprung zum Anbieter. */
function Termin({ ev, p, vorbei }: { ev: ReleaseEvent; p: MeineWocheProps; vorbei: boolean }) {
  const { t } = useLang()
  const titel = p.data.titleById.get(ev.titleId)
  const release = p.data.releaseBySlug.get(ev.releaseSlug)
  const bild = coverBild(titel?.coverImage, 48, '48px', KACHEL_DICHTE)
  const ziel = release?.platformUrl && !/anisearch\./i.test(release.platformUrl) ? release.platformUrl : undefined
  const anbieter = PLATFORMS[ev.platform]
  return (
    <li className="flex items-center gap-3 rounded-xl border border-ak-linie bg-ak-flaeche/60 p-2">
      <button type="button" onClick={() => p.onOpen(ev.releaseSlug, ev.date)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-label={t('card.details', { titel: ev.name })}>
        <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ak-flaeche-2">
          {bild.src && <img {...bild} alt="" loading="lazy" width={48} height={64} className="size-full object-cover" />}
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: anbieter?.color ?? '#888' }} />
        </span>
        <span className="min-w-0">
          <span className={['ak-titel line-clamp-2 text-sm font-bold leading-snug', vorbei ? 'text-ak-leise' : 'text-ak-text'].join(' ')}>{ev.name}</span>
          <span className="block text-xs text-ak-leise">
            {anbieterUndFolge(ev, t)}
            {ev.time && <> · {ev.timeEstimated || ev.estimated ? '≈ ' : ''}{ev.time}</>}
            {!ev.time && ev.estimated && ' · ≈'}
          </span>
        </span>
      </button>
      {ziel && (
        <a
          href={ziel}
          target="_blank"
          rel="noopener"
          aria-label={`${t('mw.ansehen')}: ${anbieter?.name ?? ev.platform}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
          style={{ background: anbieter?.color ?? '#888' }}
        >
          <span className="hidden sm:inline">{t('mw.ansehen')}</span> ↗
        </a>
      )}
      <FavoriteStar active={p.favorites.has(ev.titleId)} onToggle={() => p.onToggleFavorite(ev.titleId)} size="sm" />
    </li>
  )
}

/** Favoriten ohne Termin in dieser Woche — damit niemand glaubt, die Seite hätte sie vergessen. */
function Ruhig({ liste, onOpen }: { liste: { titleId: number; name: string; naechster?: ReleaseEvent }[]; onOpen: (slug: string, date: string) => void }) {
  const { t } = useLang()
  return (
    <section className="rounded-2xl border border-ak-linie bg-ak-flaeche/40 px-3.5 py-2.5">
      <h3 className="text-xs font-bold tracking-[0.1em] text-ak-leise uppercase">{t('mw.ruhig', { n: liste.length })}</h3>
      <ul className="mt-1 flex flex-col">
        {liste.map((f) => (
          <li key={f.titleId} className="flex items-center gap-2 py-1 text-[13px]">
            <span className="min-w-0 flex-1 truncate font-semibold text-ak-text">{f.name}</span>
            {f.naechster ? (
              <button type="button" onClick={() => onOpen(f.naechster!.releaseSlug, f.naechster!.date)} className="shrink-0 cursor-pointer text-xs text-ak-akzent-text underline-offset-2 hover:underline">
                {t('mw.naechste', { tag: `${weekdayName(f.naechster.date, true)} ${formatDate(f.naechster.date)}` })}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-ak-sehr-leise">{t('mw.keinTermin')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Ohne Favoriten: wie man welche bekommt — in einem Satz, mit Sprung zur Datenbank. */
function Einstieg() {
  const { t } = useLang()
  return (
    <section className="rounded-2xl border border-dashed border-ak-rand p-6 text-center">
      <p className="text-sm text-ak-text">{t('mw.einstieg')}</p>
      <a href="#/datenbank" className="mt-3 inline-block rounded-lg bg-ak-akzent px-3.5 py-2 text-sm font-semibold text-ak-auf-akzent">
        {t('mw.einstiegKnopf')}
      </a>
    </section>
  )
}

/** Die drei Wege, nichts zu verpassen: Kalenderdatei (hier gebaut), Kalender-Abo (Worker-Feed), Push (vorhanden). */
function Erinnern({ data, favoriten, plattformen, heute }: { data: Dataset; favoriten: Set<number>; plattformen: PlatformId[]; heute: string }) {
  const { t } = useLang()
  const { verbunden } = useNewsletterVerbindung()
  const push = pushAktivGemerkt()
  const laden = () => icsHerunterladen(meineWocheIcs(data.events, favoriten, plattformen, heute, window.location.origin), 'meine-woche.ics')
  return (
    <section className="rounded-2xl border border-ak-rand bg-ak-flaeche p-4">
      <h2 className="text-xs font-bold tracking-[0.1em] text-ak-leise uppercase">{t('mw.erinnern')}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={laden} disabled={!favoriten.size} className="cursor-pointer rounded-lg border border-ak-rand bg-ak-flaeche-2 px-3 py-1.5 text-xs font-semibold text-ak-text disabled:cursor-default disabled:opacity-50">
          ⬇ {t('mw.ics')}
        </button>
        <a href="#/abo" className="rounded-lg border border-ak-rand bg-ak-flaeche-2 px-3 py-1.5 text-xs font-semibold text-ak-text">
          {verbunden ? t('mw.aboAn') : t('mw.abo')}
        </a>
        <a href="#/abo" className="rounded-lg border border-ak-rand bg-ak-flaeche-2 px-3 py-1.5 text-xs font-semibold text-ak-text">
          {push ? t('mw.pushAn') : t('mw.push')}
        </a>
      </div>
      <p className="mt-2 text-xs text-ak-sehr-leise">{t('mw.erinnernHinweis')}</p>
    </section>
  )
}
