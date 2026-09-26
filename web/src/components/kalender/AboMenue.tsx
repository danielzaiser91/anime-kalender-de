import { useState } from 'react'
import type { ViewId } from '../../lib/router.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useNewsletterVerbindung } from '../../lib/newsletterSync.ts'
import { pushAktivGemerkt, pushAusschalten, pushEinschalten, pushMoeglich } from '../../lib/push.ts'
import { Schwebe } from './Schwebe.tsx'
import { GlockenZeichen, KalenderZeichen, PostZeichen } from './Zeichen.tsx'
import { Schalter } from './FilterFeld.tsx'

/**
 * **Abo und Newsletter in einem Knopf** (Daniel, 26.09.2026: Beschriftung nur Kalender- und
 * Glockensymbol). Dahinter: Kalender-Abo, Newsletter und — seit der Favoriten-Reiter entfallen
 * ist — der Push-Schalter für Favoriten.
 */
export function AboMenue({ onView, favorites }: { onView: (v: ViewId) => void; favorites: Set<number> }) {
  const { t } = useLang()
  const verbindung = useNewsletterVerbindung()
  return (
    <Schwebe art="klick" breite={330} label={t('kopf.abo')} inhalt={<AboInhalt onView={onView} favorites={favorites} verbindung={verbindung} />}>
      <button
        type="button"
        aria-label={t('kopf.abo')}
        title={t('kopf.abo')}
        className="relative flex h-11 cursor-pointer items-center gap-1 rounded-full border border-ak-rand bg-ak-flaeche px-3 text-ak-text transition hover:border-ak-leise"
      >
        <KalenderZeichen groesse={18} />
        <GlockenZeichen groesse={18} />
        {verbindung.verbunden && <span className="absolute top-1 right-1.5 size-2 rounded-full bg-emerald-500" aria-hidden="true" />}
      </button>
    </Schwebe>
  )
}

function AboInhalt({
  onView,
  favorites,
  verbindung,
}: {
  onView: (v: ViewId) => void
  favorites: Set<number>
  verbindung: ReturnType<typeof useNewsletterVerbindung>
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
