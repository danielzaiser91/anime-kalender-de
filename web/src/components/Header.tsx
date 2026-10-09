import type { ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'
import { InstallButton } from './InstallPrompt.tsx'
import { KopfSuchfeld, useKopfSuche } from './kopf-suche.tsx'
import { HandyNavigation } from './HandyNavigation.tsx'
import { useKopfWerkzeug } from './filter/werkzeug-slot.tsx'
import { AboMenue } from './kalender/AboMenue.tsx'
import { LogoZeichen, MondZeichen, SonnenZeichen, SuchZeichen } from './kalender/Zeichen.tsx'

/** Die drei Bereiche der Seite. Woche und Monat sind beide „Kalender". */
export const BEREICHE: { id: 'kalender' | 'datenbank' | 'news' | 'saison'; ziel: ViewId }[] = [
  { id: 'kalender', ziel: 'woche' },
  { id: 'datenbank', ziel: 'datenbank' },
  { id: 'news', ziel: 'news' },
  { id: 'saison', ziel: 'saison' },
]

export function bereichVon(view: ViewId): 'kalender' | 'datenbank' | 'news' | 'saison' | undefined {
  if (view === 'woche' || view === 'monat') return 'kalender'
  if (view === 'datenbank' || view === 'news' || view === 'saison') return view
  return undefined
}

const RUND = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise'

/**
 * Nur der schlichte Linksklick geht durch die App. Mittlere Maustaste, Strg-,
 * Shift- und Meta-Klick sollen die echte Adresse öffnen — dafür steht am
 * Element ein `href` (Daniel, 01.10.2026: Logo und Reiter per mittlerer
 * Maustaste im neuen Tab).
 */
function einfacherKlick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/**
 * Die Kopfleiste der Poster-Gestaltung (26.09.2026): Logo, drei Bereiche, Suche, Abo-Knopf, Thema.
 * Sie klebt oben und rollt mit. Auf dem Handy wandern die
 * Bereiche und das Zahnrad nach unten, die Suche klappt unter der Leiste auf. Der Markenname steht immer ganz da;
 * bei Platzmangel weicht die rechte Seite (Daniel, 09.10.2026).
 */
export function Header({
  view,
  onView,
  onStart,
  startHref,
  hrefFuer,
  suche,
  setSuche,
  zurSuche,
  favorites,
  einstellungen,
}: {
  view: ViewId
  onView: (v: ViewId) => void
  onStart: () => void
  /** Echte Adresse der Startseite — für Mittlere Maustaste/Strg-Klick. */
  startHref: string
  /** Echte Adresse je Bereich — für Mittlere Maustaste/Strg-Klick. */
  hrefFuer: (ziel: ViewId) => string
  suche: string
  setSuche: (s: string) => void
  /** Im Kalender gibt es kein Suchfeld: das Symbol führt in die Datenbank (leere Suche). */
  zurSuche: () => void
  favorites: Set<number>
  einstellungen: () => void
}) {
  const { t } = useLang()
  const aktiv = bereichVon(view)
  const kalender = aktiv === 'kalender'
  const { sucheAuf, eingabe, kopf, oeffnen } = useKopfSuche(view, kalender, suche, zurSuche)
  const { mitSlot, slotRef } = useKopfWerkzeug(kopf, view, aktiv)
  return (
    <header ref={kopf} className="sticky top-0 z-30 border-b border-ak-linie bg-ak-grund/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 sm:gap-6 sm:px-6 lg:px-10">
        <a
          href={startHref}
          onClick={(e) => {
            if (einfacherKlick(e)) {
              e.preventDefault()
              onStart()
            }
          }}
          aria-label={t('kopf.startseite')}
          className="flex shrink-0 cursor-pointer items-center gap-2 text-ak-text min-[360px]:gap-2.5"
        >
          <LogoZeichen className="size-7 min-[360px]:size-8" />
          <span className="shrink-0 whitespace-nowrap font-display text-[14px] font-bold tracking-[-0.01em] min-[360px]:text-base sm:text-xl">
            anime<span className="text-ak-akzent">·</span>kalender
          </span>
        </a>
        <KopfNavigation view={view} aktiv={aktiv} onView={onView} hrefFuer={hrefFuer} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {!kalender && <KopfSuchfeld suche={suche} setSuche={setSuche} className="hidden w-64 lg:block xl:w-72" />}
          <button type="button" onClick={oeffnen} aria-expanded={kalender ? undefined : sucheAuf} aria-label={t('kopf.sucheOeffnen')} className={`${RUND} ${kalender ? '' : 'lg:hidden'}`}>
            <SuchZeichen />
          </button>
          <InstallButton />
          <AboMenue onView={onView} favorites={favorites} />
          <ThemaKnopf />
        </div>
      </div>
      {sucheAuf && !kalender && (
        <div className="mx-auto max-w-[1600px] px-4 pb-3 lg:hidden">
          <KopfSuchfeld suche={suche} setSuche={setSuche} className="block" eingabe={eingabe} />
        </div>
      )}
      {mitSlot && <div ref={slotRef} className="relative" />}
      <HandyNavigation aktiv={aktiv} onView={onView} kalender={kalender ? view : 'woche'} einstellungen={einstellungen} />
    </header>
  )
}

/** Die drei Bereiche als Reiter (ab `md`); auf dem Handy stehen sie unten in `HandyNavigation`. */
function KopfNavigation({ view, aktiv, onView, hrefFuer }: {
  view: ViewId
  aktiv: ReturnType<typeof bereichVon>
  onView: (v: ViewId) => void
  hrefFuer: (ziel: ViewId) => string
}) {
  const { t } = useLang()
  return (
    <nav aria-label={t('nav.bereich')} className="hidden gap-6 text-[15px] font-semibold md:flex">
      {BEREICHE.map((b) => {
        const ziel = b.id === 'kalender' && aktiv === 'kalender' ? view : b.ziel
        return (
          <a
            key={b.id}
            href={hrefFuer(ziel)}
            onClick={(e) => {
              if (einfacherKlick(e)) {
                e.preventDefault()
                onView(ziel)
              }
            }}
            aria-current={aktiv === b.id ? 'page' : undefined}
            className={[
              'cursor-pointer border-b-2 py-2 transition',
              aktiv === b.id ? 'border-ak-akzent text-ak-text' : 'border-transparent text-ak-leise hover:text-ak-text',
            ].join(' ')}
          >
            {t(b.id === 'kalender' ? 'nav.kalender' : (`view.${b.id}` as TranslationKey))}
          </a>
        )
      })}
    </nav>
  )
}

/** Auf dem Handy steht der Schalter in den Einstellungen — sonst passt der Name nicht mehr in die Leiste. */
function ThemaKnopf() {
  const { t } = useLang()
  const [dunkel, umschalten] = useThema()
  const label = t(dunkel ? 'kopf.hell' : 'kopf.dunkel')
  /*
    **Das Zeichen trägt eine Farbe**. Sonne warm, Mond kühl —
    so ist auf einen Blick klar, welcher Knopf das Licht umschaltet und welcher die Einstellungen
    öffnet.
  */
  return (
    <button type="button" onClick={umschalten} aria-label={label} title={label} className={`${RUND} hidden md:flex`}>
      <span className={dunkel ? 'text-amber-400' : 'text-indigo-500'}>
        {dunkel ? <SonnenZeichen /> : <MondZeichen />}
      </span>
    </button>
  )
}
