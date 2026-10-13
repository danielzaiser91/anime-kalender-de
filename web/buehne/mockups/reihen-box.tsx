import type { ComponentProps } from 'react'
import { hauptstaffeln, staffelStaende } from '@shared/titles.ts'
import { PanelBuehne } from '../../src/components/detail/buehne.tsx'
import { mockup } from '../register.ts'
import './reihen-box.css'

/** Sprung zur Reihen-Karte; sie blitzt kurz auf, damit man sieht, wo man gelandet ist. */
function springZurReihe(): void {
  const karte = document.querySelector('[data-reihe-liste]')?.closest('section')
  if (!karte) return
  karte.scrollIntoView({ block: 'center', behavior: 'smooth' })
  karte.classList.remove('buehne-blitz')
  void karte.offsetWidth
  karte.classList.add('buehne-blitz')
}

/** „Staffel 4 von 4 · 6 Teile ↓" — bei einer einzigen Staffel nur die Zahl der Teile. */
function staffelZeile({ reihenTeile, reihenName, title }: ComponentProps<typeof PanelBuehne>): string {
  const stand = staffelStaende(hauptstaffeln(reihenTeile), reihenName).get(title.id)
  const teile = `${reihenTeile.length} Teile`
  return stand ? `Staffel ${stand.staffel} von ${stand.von} · ${teile}` : teile
}

/** Variante A: der echte Kopf (Bild, Name, Knöpfe), darunter die Staffelzeile mit Sprung zur Reihe. */
function KopfMitStaffelzeile(eigenschaften: ComponentProps<typeof PanelBuehne>) {
  return (
    <>
      <PanelBuehne {...eigenschaften} />
      {eigenschaften.reihenTeile.length > 1 && (
        <div className="relative px-4 pb-2">
          <button
            type="button"
            onClick={springZurReihe}
            className="rounded-full border border-ak-rand px-3 py-1 text-xs font-semibold text-ak-akzent-text"
          >
            {staffelZeile(eigenschaften)} <span aria-hidden="true">↓</span>
          </button>
        </div>
      )}
    </>
  )
}

mockup({
  name: 'reihen-box',
  titel: 'Reihen-Box – A: Staffelzeile mit Sprung',
  ausschnitt: 'detailpanel',
  faelle: ['tokyo-revengers', 'attack-on-titan', 'one-piece', '86', 'hajime-no-ippo', 'cyberpunk-edgerunners', 'chihiro', 'golden-kamuy'],
  varianten: {
    A: {
      ersatz: { PanelBuehne: KopfMitStaffelzeile },
      notiz: 'Unter dem Titel steht „Staffel 4 von 4 · 6 Teile ↓“; Tippen scrollt zur Reihe und lässt sie kurz aufblitzen.',
    },
  },
})
