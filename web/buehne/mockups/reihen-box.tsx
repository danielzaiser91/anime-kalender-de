import type { ComponentProps } from 'react'
import { hauptstaffeln, staffelStaende } from '@shared/titles.ts'
import type { FranchiseMember, Title } from '@shared/types.ts'
import { PanelBuehne } from '../../src/components/detail/buehne.tsx'
import { ReihenListe } from '../../src/components/detail/reihen-liste.tsx'
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

/** Fünf feste Teile für die Pixelmessung (Testkennungen ab 900000): der geöffnete (gewählt), ein künftiger (gestrichelt), ein gemerkter (Stern), zwei normale. */
function zustandsTeile(title: Title): { teile: FranchiseMember[]; gemerkt: number } {
  const teil = (id: number, name: string, mehr: Partial<FranchiseMember> = {}): FranchiseMember => ({ id, name, format: 'TV', jpYear: 2020, episodes: 12, ...mehr })
  const teile = [
    teil(title.id, 'Zustandsprobe gewählt', { jpYear: 2019 }),
    teil(900101, 'Zustandsprobe künftig', { jpStatus: 'NOT_YET_RELEASED', jpYear: 2099 }),
    teil(900102, 'Zustandsprobe gemerkt', { jpYear: 2021 }),
    teil(900103, 'Zustandsprobe normal', { jpYear: 2022 }),
    teil(900104, 'Zustandsprobe normal zwei', { jpYear: 2023 }),
  ]
  return { teile, gemerkt: 900102 }
}

/** Variante B: der echte Kopf, darunter eine zweite Reihenliste mit gewähltem, künftigem und gemerktem Teil (`data-zustaende`, gemessen von `tools/buehne-reihen-messen.mjs`). */
function KopfMitZustaenden(eigenschaften: ComponentProps<typeof PanelBuehne>) {
  const { teile, gemerkt } = zustandsTeile(eigenschaften.title)
  return (
    <>
      <PanelBuehne {...eigenschaften} />
      <div data-zustaende className="px-4 pb-4">
        <ReihenListe
          reihenTeile={teile}
          t={eigenschaften.t}
          reihenName={eigenschaften.reihenName}
          title={eigenschaften.title}
          favorites={new Set([gemerkt])}
          wechselt={false}
          wechsleZu={() => {}}
          reiheOhneOffen={1}
          reihenSchluessel={1}
          reiheSuche={{ reihe: 0, text: '' }}
          setReiheOhneOffen={() => {}}
          setReiheSuche={() => {}}
        />
      </div>
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
    B: {
      ersatz: { PanelBuehne: KopfMitZustaenden },
      notiz: 'Unter dem Kopf eine zweite Reihenliste mit gewähltem, künftigem (gestrichelt) und gemerktem Teil (Stern) — Messfläche für die Pixelprobe.',
    },
  },
})
