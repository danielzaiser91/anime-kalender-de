/** Teile der Datenbank-Kachel: Cover mit Marken und Knöpfen, Textblock mit Status und Plattform. */

import { type Title } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { FskBadge, Tooltip, FavoriteStar, HideEye, ShareIcon } from './ui.tsx'
import { coverBild } from '../lib/cover.ts'
import { titelSynchroAngekuendigt } from '@shared/ankuendigung.ts'
import { erscheintErst } from '@shared/logic.ts'
import type { Translate } from '../lib/i18n.tsx'
import { TrefferName, FundstellenZeichen } from './Suchtreffer.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { StatusBadge, PlatformBadge } from './ui.tsx'
import { type RelevanzArt } from '../lib/db-relevanz.ts'
import type { ReleaseStatus, PlatformId } from '../../../shared/types.ts'

export function KartenText({ main, t, keinDub, favorite, statusZeigen, status, gruppe, ab, staffel, platform }: {
  main: Title
  t: Translate
  keinDub: boolean
  favorite: boolean
  statusZeigen: boolean
  status: ReleaseStatus
  gruppe: RelevanzArt | undefined
  ab: string | undefined
  staffel: string | undefined
  platform: PlatformId
}) {
  return (
    <>
      <span className="flex items-start gap-0.5">
        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
          <TrefferName text={anzeigeName(main)} schluessel={String(main.id)} />
        </span>
        <FundstellenZeichen text={anzeigeName(main)} schluessel={String(main.id)} />
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
              favorite ? 'font-medium text-ak-favorit-text' : 'text-slate-500 dark:text-slate-400',
            ].join(' ')}
          >
            {favorite ? t('db.noDubWatched') : t('db.noDubWatch')}
          </span>
        ) : (
          <>
            {statusZeigen && <StatusBadge status={status} small />}
            {gruppe === 'bald' && ab ? <AbPille ab={ab} staffel={staffel} /> : staffel && <StaffelMarke staffel={staffel} />}
            {platform && <PlatformBadge platform={platform} small />}
          </>
        )}
      </span>
    </>
  )
}

/** „ab 11.10." — Start der deutschen Fassung unter der Überschrift „Demnächst"; bei einer Reihe „Staffel 2 · ab 11.10.". */
function AbPille({ ab, staffel }: { ab: string; staffel?: string }) {
  const { t } = useLang()
  const datum = `${ab.slice(8, 10)}.${ab.slice(5, 7)}.`
  return (
    <span className="inline-flex h-4 items-center rounded bg-ak-info-grund px-1.5 text-[10px] font-semibold leading-none text-ak-info-text ring-1 ring-ak-info/40">
      {staffel ? t('db.abStaffel', { staffel, datum }) : t('db.ab', { datum })}
    </span>
  )
}

/** „Staffel 2" unter „Läuft jetzt", wo kein Startdatum danebensteht. */
function StaffelMarke({ staffel }: { staffel: string }) {
  return <span className="text-[10px] font-semibold leading-none text-ak-leise">{staffel}</span>
}

export function KartenCover({ main, keinDub, members, t, today, favorite, onToggleFavorite, onToggleHidden, teilbar, share, copiedSlug, grouped }: {
  main: Title
  keinDub: boolean
  members: Title[]
  t: Translate
  today: string
  favorite: boolean
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  teilbar: string | undefined
  share: (slug: string, title: string) => Promise<void>
  copiedSlug: string | undefined
  grouped: boolean
}) {
  return (
    <>
      {main.coverImage && (
        <img
          {...coverBild(main.coverImage, 262, '(min-width: 1280px) min(17vw, 262px), (min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw')}
          alt=""
          loading="lazy"
          className={[
            'h-full w-full object-cover transition group-hover:scale-105',
            // Entsättigt statt blass: Ein blasses Bild sieht nach
            // Ladefehler aus, ein graues nach Absicht. Beim Zeigen
            // kommt die Farbe zurück — dann schaut jemand genau hin.
            keinDub ? 'opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0' : '',
          ].join(' ')}
        />
      )}
      {/*
        **Ein Cartoon sagt, dass er einer ist.**

        Daniel wollte sie sichtbar haben, nicht versteckt — aber
        ununterscheidbar sollen sie auch nicht sein: Die Seite
        verspricht Anime, und „Avatar" ist keiner im Sinne der
        Datenbanken. Die Marke steht oben, damit sie nicht mit dem
        „ohne Synchro"-Band unten kollidiert; beides zugleich kommt
        vor.
      */}
      <LinkeMarken main={main} angekuendigt={keinDub && members.some(titelSynchroAngekuendigt)} />
      {keinDub && (
        <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-[1px]">
          {t(members.every((m) => erscheintErst(m, today)) ? 'geplant.marke' : 'db.noDubBadge')}
        </span>
      )}
      <KartenKnoepfe
        favorite={favorite}
        onToggleFavorite={() => onToggleFavorite(main.id)}
        onToggleHidden={() => onToggleHidden(main.id)}
        onShare={teilbar ? () => share(teilbar, main.titleDe ?? main.titleEn ?? main.titleRomaji ?? '') : undefined}
        copied={!!teilbar && copiedSlug === teilbar}
      />
      {grouped && members.length > 1 && (
        /*
          Über den Balken statt darauf: Der Hinweis „keine deutsche
          Synchro" läuft über die volle Breite am unteren Rand. Ohne
          das Ausweichen läge die Staffelzahl mitten darin, sobald
          eine Reihe ohne Synchro gebündelt wird — und das tut sie,
          seit der Katalog die Beziehungen mitbringt.
        */
        <span
          className={[
            'absolute right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white',
            keinDub ? 'bottom-7' : 'bottom-1',
          ].join(' ')}
        >
          {t('db.seasons', { count: members.length })}
        </span>
      )}
    </>
  )
}

/** Marken oben links auf dem Cover: die FSK (eine Angabe, steht immer), darunter ein Cartoon-Hinweis — untereinander, nie nebeneinander. */
function LinkeMarken({ main, angekuendigt }: { main: Title; angekuendigt: boolean }) {
  const { t } = useLang()
  if (main.fsk === undefined && !main.westlich && !angekuendigt) return null
  return (
    <span className="absolute left-1 top-1 flex flex-col items-start gap-1">
      {main.fsk !== undefined && (
        <span onClick={(e) => e.stopPropagation()}>
          <FskBadge fsk={main.fsk} quelle={main.fskQuelle} small />
        </span>
      )}
      {main.westlich && (
        <span className="rounded bg-slate-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-[1px]">
          <Tooltip text={t('db.westlichHinweis')} eigenerFokus>
            {t('db.westlich')}
          </Tooltip>
        </span>
      )}
      {angekuendigt && (
        <span className="rounded bg-ak-info-grund px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ak-info-text ring-1 ring-ak-info/40">
          <Tooltip text={t('antwort.synchroAngekuendigt')} eigenerFokus>
            {t('db.angekuendigt')}
          </Tooltip>
        </span>
      )}
    </span>
  )
}

/**
 * Die Bedienung steht oben rechts immer an derselben Stelle; die FSK-Marke sitzt links (`LinkeMarken`) und schiebt sie nicht mehr.
 *
 * Stern, Auge und Teilen erscheinen wie in der Wochen-Kachel erst beim
 * Zeigen oder per Tastatur — vorher lag ein dunkler Streifen auf jedem Cover, im hellen Thema am auffälligsten.
 * Ein gesetzter Stern bleibt sichtbar. Der Stern ist auf jedem Gerät ein Knopf (28 px, kein zusätzlicher
 * Treffer-Wrapper); Auge und Teilen gibt es auf dem Handy (unter `sm`) im Panel, nicht auf dem Bild.
 */
function KartenKnoepfe({ favorite, onToggleFavorite, onToggleHidden, onShare, copied }: {
  favorite: boolean
  onToggleFavorite: () => void
  onToggleHidden: () => void
  onShare?: () => void
  copied: boolean
}) {
  return (
    <span className="absolute right-1 top-1 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className={`${KNOPF_GRUND} ${favorite ? '' : ERST_BEIM_ZEIGEN}`}>
        <FavoriteStar active={favorite} onToggle={onToggleFavorite} grosseFlaeche />
      </span>
      <span className={`${KNOPF_GRUND} hidden sm:flex ${ERST_BEIM_ZEIGEN}`}>
        <HideEye hidden={false} onToggle={onToggleHidden} />
        {onShare && <ShareIcon onShare={onShare} copied={copied} />}
      </span>
    </span>
  )
}

const KNOPF_GRUND = 'flex flex-col items-center rounded-full bg-[rgba(13,15,20,.72)] p-0.5 text-[#f2f1ee]'

const ERST_BEIM_ZEIGEN = 'transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0'
