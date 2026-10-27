import { useState } from 'react'
import type { ViewId } from '../../lib/router.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useNewsletterVerbindung } from '../../lib/newsletterSync.ts'
import { useInstall } from '../../lib/pwa.ts'
import { InstallZeile } from '../InstallPrompt.tsx'
import { pushAktivGemerkt, pushAusschalten, pushEinschalten, pushMoeglich } from '../../lib/push.ts'
import { Schwebe } from './Schwebe.tsx'
import { BurgerZeichen, GlockenZeichen, KalenderZeichen, PostZeichen, ZahnradZeichen } from './Zeichen.tsx'
import { Schalter } from './FilterFeld.tsx'

/**
 * **Burger-Menü oben rechts** (seit 27.10.2026, vorher Glocken-Knopf): Kalender-Abo, Newsletter,
 * Push-Schalter für Favoriten, App-Installation und der Weg in die Einstellungen.
 */
export function AboMenue({ onView, favorites, einstellungen }: { onView: (v: ViewId) => void; favorites: Set<number>; einstellungen: () => void }) {
  const { t } = useLang()
  const verbindung = useNewsletterVerbindung()
  // Hier, nicht im Inhalt: Der entsteht erst beim Öffnen und hätte `beforeinstallprompt` verpasst.
  const installation = useInstall()
  return (
    <Schwebe art="klick" breite={330} label={t('kopf.abo')} inhalt={<AboInhalt onView={onView} favorites={favorites} verbindung={verbindung} installation={installation} einstellungen={einstellungen} />}>
      <button
        type="button"
        aria-label={t('kopf.abo')}
        aria-haspopup="dialog"
        className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise"
      >
        <BurgerZeichen groesse={18} />
        {verbindung.verbunden && <span className="absolute top-1 right-1.5 size-2 rounded-full bg-ak-gut" aria-hidden="true" />}
      </button>
    </Schwebe>
  )
}

export function AboInhalt({
  onView,
  favorites,
  verbindung,
  installation,
  einstellungen,
}: {
  onView: (v: ViewId) => void
  favorites: Set<number>
  verbindung: ReturnType<typeof useNewsletterVerbindung>
  installation: ReturnType<typeof useInstall>
  einstellungen: () => void
}) {
  const { t } = useLang()
  const zeile = 'flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left text-ak-text transition hover:bg-ak-flaeche-2'
  const newsletterHinweis = !verbindung.verbunden
    ? t('kopf.aboNewsletterHinweis')
    : verbindung.mail
      ? t('news.connectedAs', { mail: verbindung.mail })
      : t('news.connectedNoMail')
  return (
    <div className="flex flex-col">
      <button type="button" data-schliesst onClick={() => onView('abo')} className={zeile}>
        <span className="text-ak-leise"><KalenderZeichen groesse={20} /></span>
        <Text titel={t('sub.title')} hinweis={t('kopf.aboKalenderHinweis')} />
      </button>
      <button type="button" data-schliesst onClick={() => onView('newsletter')} className={zeile}>
        <span className="text-ak-leise"><PostZeichen groesse={20} /></span>
        <Text titel={`${t('view.newsletter')}${verbindung.verbunden ? ' ✓' : ''}`} hinweis={newsletterHinweis} />
      </button>
      <PushZeile favorites={favorites} />
      <InstallZeile {...installation} />
      <button type="button" data-schliesst onClick={einstellungen} className={zeile}>
        <span className="text-ak-leise"><ZahnradZeichen groesse={20} /></span>
        <span className="text-sm font-bold">{t('einstellungen.titel')}</span>
      </button>
    </div>
  )
}

function Text({ titel, hinweis }: { titel: string; hinweis: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm font-bold">{titel}</span>
      <span className="text-xs text-ak-leise">{hinweis}</span>
    </span>
  )
}

/** Push nur, wo der Browser es kann; Zustellung am selben Tag in Edge belegt (18.09.2026). */
function PushZeile({ favorites }: { favorites: Set<number> }) {
  const { t } = useLang()
  const [aktiv, setAktiv] = useState(pushAktivGemerkt)
  const [lage, setLage] = useState('')
  if (!pushMoeglich()) return null
  const umschalten = async () => {
    setLage('')
    try {
      if (aktiv) await pushAusschalten()
      else await pushEinschalten([...favorites])
      setAktiv(!aktiv)
    } catch (e) {
      setLage(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="flex items-center gap-3 rounded-xl p-3">
      <span className="text-ak-leise"><GlockenZeichen groesse={20} /></span>
      <span className="flex-1"><Text titel={t('kopf.aboPush')} hinweis={lage || t('kopf.aboPushHinweis')} /></span>
      <Schalter an={aktiv} setzen={() => void umschalten()} label="" ariaLabel={t('kopf.aboPush')} />
    </div>
  )
}
