import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Patchnote } from '@shared/patchnotes.ts'
import { addDays, todayIso } from '@shared/time.ts'
import { ladePatchnotes } from '../lib/patchnotes.ts'
import { PT } from '../lib/patchnotes-texte.ts'
import { PatchFilter, PatchKopf, PatchTagBlock, SCHLIESS_MS, fokusfalle, tageVon, useWischen, type Filter } from './patchnotes-teile.tsx'
import '../patchnotes.css'

/**
 * Dialog „Neu auf der Webseite“ (Richtung A „Patch-Banner“, Daniel 09.10.2026): Desktop zentriert, Handy als Bottom-Sheet.
 * Der Code und die Liste kommen erst beim Klick auf den Knopf (`PatchnotesKnopf`); im Start steht davon nichts.
 */
export default function PatchnotesDialog({ laden, beiZu }: { laden: Promise<Patchnote[]>; beiZu: () => void }) {
  const [liste, setListe] = useState<Patchnote[] | 'fehler' | undefined>()
  const [versuch, setVersuch] = useState(0)
  const [filter, setFilter] = useState<Filter>('alles')
  const [schliesst, setSchliesst] = useState<'' | 'zu' | 'wisch'>('')
  const panel = useRef<HTMLDivElement>(null)
  const titel = useRef<HTMLHeadingElement>(null)
  const listeEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let aktuell = true
    void (versuch ? ladePatchnotes() : laden).then(
      (l) => aktuell && setListe(l),
      () => aktuell && setListe('fehler'),
    )
    return () => void (aktuell = false)
  }, [laden, versuch])

  useEffect(() => titel.current?.focus({ preventScroll: true }), [])

  const schliessen = useCallback(
    (art: 'zu' | 'wisch' = 'zu') => {
      if (schliesst) return
      setSchliesst(art)
      if (art === 'wisch' && panel.current) {
        panel.current.style.transition = `transform ${SCHLIESS_MS}ms ease-in`
        panel.current.style.transform = 'translateY(100%)'
      }
      setTimeout(beiZu, SCHLIESS_MS)
    },
    [schliesst, beiZu],
  )
  const zu = useCallback(() => schliessen(), [schliessen])

  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => e.key === 'Escape' && zu()
    document.addEventListener('keydown', beiTaste)
    return () => document.removeEventListener('keydown', beiTaste)
  }, [zu])

  const wischen = useWischen(panel, () => schliessen('wisch'))
  const alle = useMemo(() => (Array.isArray(liste) ? liste : []), [liste])
  const zaehl = useMemo(() => ({ alles: alle.length, feature: alle.filter((n) => n.kategorie === 'feature').length, bugfix: alle.filter((n) => n.kategorie === 'bugfix').length }), [alle])
  const tage = useMemo(() => tageVon(alle, filter), [alle, filter])
  const heute = todayIso()

  return createPortal(
    <div className={`pn-schleier${schliesst ? ` zu ${schliesst === 'wisch' ? 'wisch' : ''}` : ''}`} onClick={(e) => e.target === e.currentTarget && zu()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="pn-titel" className="pn" onKeyDown={(e) => fokusfalle(e, panel.current)}>
        <div className="pn-wisch" {...wischen}>
          <div className="pn-griff" aria-hidden="true" />
          <PatchKopf neuester={alle[0]?.datum} titel={titel} schliessen={zu} />
        </div>
        <PatchFilter filter={filter} setze={(f) => (setFilter(f), listeEl.current?.scrollTo({ top: 0 }))} zaehl={zaehl} />
        <div ref={listeEl} className="pn-liste">
          {liste === undefined && <div className="pn-leer" role="status">{PT.laden}</div>}
          {liste === 'fehler' && (
            <div className="pn-leer" role="alert">
              {PT.fehler}{' '}
              <button type="button" className="pn-link ak-tz" onClick={() => (setListe(undefined), setVersuch((v) => v + 1))}>
                {PT.nochmal}
              </button>
            </div>
          )}
          {Array.isArray(liste) && !tage.length && <div className="pn-leer">{PT.leer}</div>}
          {tage.map((tag, i) => (
            <PatchTagBlock key={tag.datum} tag={tag} index={i} heute={heute} gestern={addDays(heute, -1)} schliessen={zu} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
