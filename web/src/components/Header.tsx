import type { ViewId } from '../lib/router.ts'
import { bereichVon } from '../lib/bereiche.ts'
import { KopfNavigation, einfacherKlick } from './KopfNavigation.tsx'
import { useLang } from '../lib/i18n.tsx'
import { useThema } from '../lib/thema.ts'
import { InstallButton } from './InstallPrompt.tsx'
import { KopfSuchfeld, useKopfSuche } from './kopf-suche.tsx'
import { HandyNavigation } from './HandyNavigation.tsx'
import { useEinrollen } from '../lib/use-einrollen.ts'
import { useMobil } from '../lib/use-mobil.ts'
import { AboMenue } from './kalender/AboMenue.tsx'
import { LogoZeichen, MondZeichen, SonnenZeichen, SuchZeichen } from './kalender/Zeichen.tsx'

const RUND = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise'

/**
 * Die Kopfleiste der Poster-Gestaltung (26.09.2026): Logo, drei Bereiche, Suche, Abo-Knopf, Thema.
 * Sie klebt oben und rollt mit. Auf dem Handy folgen unter dem Logo die
 * Bereiche und das Zahnrad (`HandyNavigation`), die Suche klappt dazwischen auf. Der Markenname steht immer ganz da;
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
  useEinrollen(kopf, useMobil(), view)
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
      <HandyNavigation aktiv={aktiv} onView={onView} kalender={kalender ? view : 'woche'} einstellungen={einstellungen} />
    </header>
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
      <span className={dunkel ? 'text-ak-favorit' : 'text-ak-info'}>
        {dunkel ? <SonnenZeichen /> : <MondZeichen />}
      </span>
    </button>
  )
}
