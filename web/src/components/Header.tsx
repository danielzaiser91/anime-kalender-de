import { useEffect, useRef, useState } from 'react'
import type { ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'
import { InstallButton } from './InstallPrompt.tsx'
import { Suchfeld } from './Suchfeld.tsx'
import { HandyNavigation } from './HandyNavigation.tsx'
import { AboMenue } from './kalender/AboMenue.tsx'
import { LogoZeichen, MondZeichen, SonnenZeichen, SuchZeichen, ZahnradZeichen } from './kalender/Zeichen.tsx'

/** Die drei Bereiche der Seite. Woche und Monat sind beide „Kalender". */
export const BEREICHE: { id: 'kalender' | 'datenbank' | 'news'; ziel: ViewId }[] = [
  { id: 'kalender', ziel: 'woche' },
  { id: 'datenbank', ziel: 'datenbank' },
  { id: 'news', ziel: 'news' },
]

export function bereichVon(view: ViewId): 'kalender' | 'datenbank' | 'news' | undefined {
  if (view === 'woche' || view === 'monat') return 'kalender'
  if (view === 'datenbank' || view === 'news') return view
  return undefined
}

const RUND = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise'

/**
 * Die Kopfleiste der Poster-Gestaltung (26.09.2026): Logo, drei Bereiche, Suche, Abo-Knopf, Thema
 * und Einstellungen. Sie klebt oben und rollt mit (Daniel, 26.09.2026). Auf dem Handy wandern die
 * Bereiche und das Zahnrad nach unten, die Suche klappt unter der Leiste auf.
 */
export function Header({
  view,
  onView,
  onStart,
  suche,
  setSuche,
  favorites,
  einstellungen,
}: {
  view: ViewId
  onView: (v: ViewId) => void
  onStart: () => void
  suche: string
  setSuche: (s: string) => void
  favorites: Set<number>
  einstellungen: () => void
}) {
  const { t } = useLang()
  const [sucheAuf, setSucheAuf] = useState(false)
  const eingabe = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (sucheAuf) eingabe.current?.focus()
  }, [sucheAuf])
  const aktiv = bereichVon(view)
  const feld = 'h-11 w-full rounded-full border border-ak-rand bg-ak-flaeche pr-4 pl-10 text-sm text-ak-text placeholder:text-ak-sehr-leise focus:border-ak-akzent focus:outline-none'
  return (
    <header className="sticky top-0 z-30 border-b border-ak-linie bg-ak-grund/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 sm:gap-6 sm:px-6 lg:px-10">
        <button type="button" onClick={onStart} aria-label={t('kopf.startseite')} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-ak-text">
          <LogoZeichen groesse={32} />
          <span className="truncate font-display text-base font-bold tracking-[-0.01em] sm:text-xl">
            anime<span className="text-ak-akzent">·</span>kalender
          </span>
        </button>
        <nav aria-label={t('nav.bereich')} className="hidden gap-6 text-[15px] font-semibold md:flex">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onView(b.id === 'kalender' && aktiv === 'kalender' ? view : b.ziel)}
              aria-current={aktiv === b.id ? 'page' : undefined}
              className={[
                'cursor-pointer border-b-2 py-2 transition',
                aktiv === b.id ? 'border-ak-akzent text-ak-text' : 'border-transparent text-ak-leise hover:text-ak-text',
              ].join(' ')}
            >
              {t(b.id === 'kalender' ? 'nav.kalender' : (`view.${b.id}` as TranslationKey))}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <label className="relative hidden w-64 lg:block xl:w-72">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ak-leise"><SuchZeichen /></span>
            <Suchfeld wert={suche} setzen={setSuche} platzhalter={t('kopf.suche')} className={feld} />
          </label>
          <button type="button" onClick={() => setSucheAuf(!sucheAuf)} aria-expanded={sucheAuf} aria-label={t('kopf.sucheOeffnen')} className={`${RUND} lg:hidden`}>
            <SuchZeichen />
          </button>
          <InstallButton />
          <AboMenue onView={onView} favorites={favorites} />
          <ThemaKnopf />
          <button type="button" onClick={einstellungen} aria-label={t('einstellungen.titel')} title={t('einstellungen.titel')} className={`${RUND} hidden md:flex`}>
            <ZahnradZeichen />
          </button>
        </div>
      </div>
      {sucheAuf && (
        <div className="mx-auto max-w-[1600px] px-4 pb-3 lg:hidden">
          <label className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ak-leise"><SuchZeichen /></span>
            <Suchfeld wert={suche} setzen={setSuche} platzhalter={t('kopf.suche')} className={feld} eingabe={eingabe} />
          </label>
        </div>
      )}
      <HandyNavigation aktiv={aktiv} onView={onView} kalender={aktiv === 'kalender' ? view : 'woche'} einstellungen={einstellungen} />
    </header>
  )
}

/** Auf dem Handy steht der Schalter in den Einstellungen — sonst passt der Name nicht mehr in die Leiste. */
function ThemaKnopf() {
  const { t } = useLang()
  const [dunkel, umschalten] = useThema()
  const label = t(dunkel ? 'kopf.hell' : 'kopf.dunkel')
  return (
    <button type="button" onClick={umschalten} aria-label={label} title={label} className={`${RUND} hidden md:flex`}>
      {dunkel ? <SonnenZeichen /> : <MondZeichen />}
    </button>
  )
}
