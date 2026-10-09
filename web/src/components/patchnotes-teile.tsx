import { useRef } from 'react'
import type { Patchnote } from '@shared/patchnotes.ts'
import { weekdayName } from '@shared/time.ts'
import { PT } from '../lib/patchnotes-texte.ts'

/** Bausteine des Dialogs „Neu auf der Webseite“ (siehe `PatchnotesDialog.tsx`). */
export type Filter = 'alles' | Patchnote['kategorie']
export interface PatchTag {
  datum: string
  hl: Patchnote[]
  zeilen: Patchnote[]
}
const WISCH_SCHWELLE = 80
export const SCHLIESS_MS = 160

export const Stern = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="M12 3c.6 4.6 3.4 7.4 9 9-5.6 1.6-8.4 4.4-9 9-.6-4.6-3.4-7.4-9-9 5.6-1.6 8.4-4.4 9-9z" />
  </svg>
)
export const Schluessel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
  </svg>
)
const symbolVon = (n: Patchnote) => ((n.symbol ?? (n.kategorie === 'feature' ? 'stern' : 'schluessel')) === 'stern' ? <Stern /> : <Schluessel />)

/** Gruppiert nach Tag; je Tag höchstens zwei Highlight-Banner, der Rest sind Zeilen. */
export function tageVon(liste: Patchnote[], filter: Filter): PatchTag[] {
  const tage: PatchTag[] = []
  for (const n of liste) {
    if (filter !== 'alles' && n.kategorie !== filter) continue
    let tag = tage.find((t) => t.datum === n.datum)
    if (!tag) tage.push((tag = { datum: n.datum, hl: [], zeilen: [] }))
    if (n.highlight && tag.hl.length < 2) tag.hl.push(n)
    else tag.zeilen.push(n)
  }
  return tage
}

export function PatchKopf({ neuester, titel, schliessen }: { neuester?: string; titel: React.Ref<HTMLHeadingElement>; schliessen: () => void }) {
  return (
    <header className="pn-kopf">
      <span className="pn-balken" aria-hidden="true" />
      <div className="pn-kopf-in">
        <div>
          <div className="pn-kicker">{PT.kicker}</div>
          <h2 ref={titel} id="pn-titel" tabIndex={-1} className="pn-titel">
            {PT.titel1}
            <br />
            {PT.titel2}
          </h2>
        </div>
        {neuester && <div className="pn-datum">{neuester.replaceAll('-', '.')}</div>}
      </div>
      <button type="button" onClick={schliessen} aria-label={PT.schliessen} className="pn-x">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>
  )
}

export function PatchFilter({ filter, setze, zaehl }: { filter: Filter; setze: (f: Filter) => void; zaehl: Record<Filter, number> }) {
  const defs: { id: Filter; icon?: React.ReactNode }[] = [{ id: 'alles' }, { id: 'feature', icon: <Stern /> }, { id: 'bugfix', icon: <Schluessel /> }]
  return (
    <div className="pn-filter" role="group" aria-label={PT.filter}>
      {defs.map((f) => (
        <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setze(f.id)} className="pn-pille">
          {f.icon}
          <span>{PT[f.id]}</span>
          <span className="z">{zaehl[f.id]}</span>
        </button>
      ))}
    </div>
  )
}

function Ansehen({ n, schliessen }: { n: Patchnote; schliessen: () => void }) {
  if (!n.link) return null
  return (
    <>
      {' '}
      <a href={n.link} onClick={schliessen} className="pn-link ak-tz">
        {PT.ansehen}
      </a>
    </>
  )
}

export function PatchTagBlock({ tag, index, heute, gestern, schliessen }: { tag: PatchTag; index: number; heute: string; gestern: string; schliessen: () => void }) {
  const relativ = tag.datum === heute ? ` · ${PT.heute}` : tag.datum === gestern ? ` · ${PT.gestern}` : ''
  const [, m, d] = tag.datum.split('-')
  const anim = index < 4
  return (
    <section className={`pn-tag${anim ? ' anim' : ''}`} style={anim ? { animationDelay: `${index * 40}ms` } : undefined}>
      <h3 className="pn-tag-kopf">
        Patch {m}.{d}
        <span className="zu-tag">
          {' '}
          · {weekdayName(tag.datum, true)}
          {relativ}
        </span>
      </h3>
      {tag.hl.map((n) => (
        <div key={n.text} className="pn-hl">
          <span className={`pn-kreis ${n.kategorie}`} title={PT[n.kategorie]}>
            {symbolVon(n)}
            <span className="sr-only">{PT[n.kategorie]}:</span>
          </span>
          <div className="pn-hl-text">
            <div className="pn-hl-titel">{n.text}</div>
            {(n.untertitel || n.link) && (
              <div className="pn-hl-hinweis">
                {n.untertitel}
                <Ansehen n={n} schliessen={schliessen} />
              </div>
            )}
          </div>
          <span className="pn-marke">{PT.highlight}</span>
        </div>
      ))}
      {tag.zeilen.map((n) => (
        <div key={n.text} className="pn-zeile">
          <span className={n.kategorie} title={PT[n.kategorie]} style={{ display: 'inline-flex' }}>
            {symbolVon(n)}
          </span>
          <span className="sr-only">{PT[n.kategorie]}:</span>
          <span className="t">
            {n.text}
            <Ansehen n={n} schliessen={schliessen} />
          </span>
          {n.untertitel && <span className="h">{n.untertitel}</span>}
        </div>
      ))}
    </section>
  )
}

/** Fokusfalle: Tab wandert nur durch den Dialog, auch rückwärts vom Titel aus. */
export function fokusfalle(e: React.KeyboardEvent, panel: HTMLElement | null): void {
  if (e.key !== 'Tab' || !panel) return
  const f = [...panel.querySelectorAll<HTMLElement>('h2[tabindex], button, a[href]')]
  const erstes = f[0]
  const letztes = f[f.length - 1]
  const aktiv = document.activeElement
  const draussen = !panel.contains(aktiv)
  if (e.shiftKey && (aktiv === erstes || draussen)) (e.preventDefault(), letztes?.focus())
  else if (!e.shiftKey && (aktiv === letztes || draussen)) (e.preventDefault(), erstes?.focus())
}

/** Wischen nach unten an Kopf und Griff (Handy): Griffe für die Berührung; ab 80 px schließt es. */
export function useWischen(panel: React.RefObject<HTMLDivElement | null>, schliessenWisch: () => void) {
  const y0 = useRef<number | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => void (y0.current = e.touches[0]!.clientY),
    onTouchMove: (e: React.TouchEvent) => {
      if (y0.current === null || !panel.current) return
      const dy = e.touches[0]!.clientY - y0.current
      if (dy > 0) panel.current.style.transform = `translateY(${dy}px)`
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (y0.current === null || !panel.current) return
      const dy = e.changedTouches[0]!.clientY - y0.current
      y0.current = null
      if (dy > WISCH_SCHWELLE) return schliessenWisch()
      panel.current.style.transition = 'transform 150ms ease-out'
      panel.current.style.transform = ''
    },
  }
}
