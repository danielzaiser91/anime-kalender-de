import { useEffect, useRef, useState } from 'react'
import type { FranchiseMember } from '@shared/types.ts'
import type { StaffelNummer } from '@shared/titles.ts'
import { coverBild } from '../../lib/cover.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Tooltip } from '../ui.tsx'
import { SynchroMarke } from './reihen-marke.tsx'
import { staffelKurz, zeilenZusatz } from './reihen-regeln.ts'
import { brauchtTooltip, COVER_DICHTE, coverDichte, KARTEN_BREITE } from './reihen-spur-regeln.ts'
import { ZeilenName } from './zeilen-name.tsx'

/** Der Name, wie er unter dem Cover steht (ohne Auszeichnung) — daran misst sich, ob er abgeschnitten wird. */
export function angezeigterName(nr: StaffelNummer | undefined, rest: string, voll: string, kurz: string): string {
  if (!nr) return kurz
  const zusatz = zeilenZusatz(nr, rest, voll)
  return zusatz ? `${staffelKurz(nr)} · ${zusatz}` : staffelKurz(nr)
}

/**
 * Das Bild wird erst gerendert, wenn die Karte in die Spur gerutscht ist (eine Spurbreite Vorlauf): `loading="lazy"` allein lädt bei 128 px je Karte fast jede Zeile ganz.
 * Ohne IntersectionObserver (alter Browser) steht das Bild sofort da.
 */
function useSichtbarSeit(ref: React.RefObject<HTMLElement | null>): boolean {
  const [sichtbar, setSichtbar] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const karte = ref.current
    if (sichtbar || !karte) return
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege.some((e) => e.isIntersecting)) return
        setSichtbar(true)
        beobachter.disconnect()
      },
      { root: karte.closest('[role="tablist"]'), rootMargin: '0px 100% 0px 0px' },
    )
    beobachter.observe(karte)
    return () => beobachter.disconnect()
  }, [ref, sichtbar])
  return sichtbar
}

function sparenAn(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as { connection?: { saveData?: boolean } }).connection?.saveData)
}

export type CoverProps = {
  m: FranchiseMember
  t: Translate
  /** Der Teil ist noch nicht erschienen — dort ist eine fehlende Synchro kein Befund. */
  offen: boolean
  gewaehlt: boolean
  gemerkt: boolean
  nr: StaffelNummer | undefined
  namen: { voll: string; rest: string; kurz: string }
  angaben: string
  gesperrt: boolean
  onWaehlen: (id: number) => void
}

function CoverFlaeche({ m, t, offen, gemerkt, gewaehlt, ohneDe }: Pick<CoverProps, 'm' | 't' | 'offen' | 'gemerkt' | 'gewaehlt'> & { ohneDe: boolean }) {
  const huelle = useRef<HTMLSpanElement>(null)
  const sichtbar = useSichtbarSeit(huelle)
  return (
    <span
      ref={huelle}
      className={[
        'relative block aspect-[2/3] w-[120px] overflow-hidden rounded-lg bg-ak-flaeche-2',
        ohneDe ? 'opacity-55' : '',
        offen ? 'opacity-70' : '',
        gewaehlt ? 'outline-2 outline-ak-akzent' : offen ? 'outline-1 -outline-offset-1 outline-dashed outline-ak-leise' : '',
      ].join(' ')}
    >
      {m.cover && sichtbar && (
        <img
          {...coverBild(m.cover, KARTEN_BREITE, `${KARTEN_BREITE}px`, coverDichte(sparenAn(), COVER_DICHTE))}
          width={KARTEN_BREITE}
          height={180}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
      {gemerkt && (
        <span
          className="absolute left-1.5 top-1.5 rounded-md bg-ak-grund/85 px-1.5 text-t5 font-bold text-ak-favorit-text"
          aria-label={t('card.unfavourite')}
        >
          ★
        </span>
      )}
      <span className="absolute right-1.5 top-1.5">
        <SynchroMarke t={t} m={m} ohneDe={ohneDe} />
      </span>
    </span>
  )
}

/** Ein Teil der Reihe als Karte der Spur: Cover 120 × 180, darunter Name (zwei Zeilen) und Angaben. */
export function ReihenCover(p: CoverProps) {
  const { m, nr, namen, gewaehlt } = p
  const ohneDe = Boolean(m.ohneSynchro) && !p.offen
  const name = angezeigterName(nr, namen.rest, namen.voll, namen.kurz)
  const beschriftung = (
    <span
      className={[
        'line-clamp-2 min-h-9 min-w-0 text-t4 font-medium',
        ohneDe ? 'opacity-75' : '',
        gewaehlt ? 'font-semibold text-ak-akzent-text' : 'text-ak-text',
      ].join(' ')}
    >
      <ZeilenName nr={nr} rest={namen.rest} voll={namen.voll} kurz={namen.kurz} />
    </span>
  )
  return (
    <button
      type="button"
      role="tab"
      aria-selected={gewaehlt}
      disabled={p.gesperrt}
      onClick={() => {
        if (gewaehlt) return
        p.onWaehlen(m.id)
      }}
      className={[
        'group flex w-[120px] shrink-0 snap-start flex-col gap-1 rounded-lg text-left',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ak-fokus',
        'disabled:cursor-default disabled:opacity-45',
        gewaehlt ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      <CoverFlaeche m={m} t={p.t} offen={p.offen} gemerkt={p.gemerkt} gewaehlt={gewaehlt} ohneDe={ohneDe} />
      {brauchtTooltip(name) ? (
        <Tooltip text={namen.voll} eigenerFokus className="w-full min-w-0">
          {beschriftung}
        </Tooltip>
      ) : (
        beschriftung
      )}
      <span className="truncate text-t5 text-ak-leise">{p.angaben}</span>
    </button>
  )
}
