import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Translate } from '../../lib/i18n.tsx'
import { AufklappKopf } from './aufklapp-kopf.tsx'
import { PanelKarte, StapelZeichen } from './panel-karte.tsx'
import type { ReihenListeProps } from './reihen-inhalt.tsx'
import { reihenStand } from './reihen-karte.tsx'
import { OhneSynchroSchalter } from './reihen-kopf.tsx'
import { istEingeklappt } from './reihen-regeln.ts'
import { fensterUm, gezeigteGruppen, gezeigteZahl, gruppeVon, GROSSE_GRUPPE, type Gruppe } from './reihen-uebersicht-regeln.ts'
import { ReihenZeile, type Ordnung } from './reihen-zeile.tsx'

type UebersichtProps = ReihenListeProps & { o: Ordnung }

/** Suche über die ganze Breite, der Schalter darunter: nebeneinander blieb vom Suchfeld bei 390 px nur „In der“ übrig. */
function UebersichtKopf({ t, suche, onSuche, schalter }: { t: Translate; suche: string; onSuche: (text: string) => void; schalter: ReactNode }) {
  return (
    <div className="mb-1 flex flex-col gap-1">
      <input
        type="search"
        value={suche}
        onChange={(e) => onSuche(e.target.value)}
        placeholder={t('detail.reiheSuche')}
        aria-label={t('detail.reiheSuche')}
        className="h-11 w-full rounded-lg border border-ak-rand bg-transparent px-3 text-t3"
      />
      {schalter && <div className="flex">{schalter}</div>}
    </div>
  )
}

/** Die Teile einer offenen Gruppe; in der Gruppe des geöffneten Titels über 12 Teilen nur das Fenster um ihn, dazu „Alle n zeigen“. */
function Gruppenzeilen({ g, eigen, p }: { g: Gruppe; eigen: boolean; p: UebersichtProps }) {
  const [alle, setAlle] = useState(false)
  const liste = useRef<HTMLUListElement>(null)
  const fokusAuf = useRef<number | null>(null)
  const fenster = eigen && !alle && g.teile.length > GROSSE_GRUPPE
  const teile = fenster ? fensterUm(g.teile, p.title.id) : g.teile
  /* Nach „Alle zeigen“ verschwindet der Knopf; der Fokus geht auf die erste neu gezeigte Zeile statt an den Seitenanfang. */
  useEffect(() => {
    if (fokusAuf.current === null) return
    liste.current?.querySelectorAll('button')[fokusAuf.current]?.focus()
    fokusAuf.current = null
  }, [alle])
  const zeigeAlle = () => {
    fokusAuf.current = teile[0] === g.teile[0] ? teile.length : 0
    setAlle(true)
  }
  return (
    <>
      <ul ref={liste} className="flex flex-col">
        {teile.map((m) => (
          <ReihenZeile key={m.id} m={m} o={p.o} t={p.t} reihenName={p.reihenName} title={p.title} gemerkt={p.favorites.has(m.id)} wechselt={p.wechselt} wechsleZu={p.wechsleZu} />
        ))}
      </ul>
      {teile.length < g.teile.length && (
        <button
          type="button"
          data-reihe-alle
          onClick={zeigeAlle}
          className="min-h-11 w-full cursor-pointer rounded-lg px-2 text-left text-t4 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2"
        >
          {p.t('detail.reiheAlleZeigen', { n: g.teile.length })}
        </button>
      )}
    </>
  )
}

/** Welche Gruppen offen sind: anfangs die des geöffneten Titels; ein Wechsel in der Reihe öffnet die Gruppe des neuen Teils dazu. */
function useOffeneGruppen(eigene: string | undefined) {
  const [offen, setOffen] = useState<string[]>(() => (eigene ? [eigene] : []))
  useEffect(() => {
    if (eigene) setOffen((o) => (o.includes(eigene) ? o : [...o, eigene]))
  }, [eigene])
  const umschalten = (titel: string) => setOffen((o) => (o.includes(titel) ? o.filter((x) => x !== titel) : [...o, titel]))
  return { offen, umschalten }
}

/**
 * **Große Reihen als Übersicht** (Daniel, F148, 20.11.2026): Gruppen mit Zahl, offen nur die des geöffneten Titels.
 * Zahl am Kopf, Zahl je Gruppe und Liste kommen aus denselben `gezeigteGruppen` — live zählte der Kopf auch Teile hinter dem Schalter.
 */
export function ReihenUebersicht(p: UebersichtProps) {
  const { t, o, title, reihenSchluessel, reiheSuche } = p
  const basis = useId()
  const eigene = gruppeVon(o.gruppen, title.id)
  const { offen, umschalten } = useOffeneGruppen(eigene)
  const suchText = reiheSuche.reihe === reihenSchluessel ? reiheSuche.text.trim() : ''
  const ohneOffen = p.reiheOhneOffen === reihenSchluessel
  const zahlOhne = p.reihenTeile.filter((m) => istEingeklappt(m, title.id)).length
  const zeigen = gezeigteGruppen(o.gruppen, title.id, ohneOffen, suchText)
  const schalter =
    zahlOhne > 0 && !suchText ? (
      <OhneSynchroSchalter t={t} zahl={zahlOhne} ohneOffen={ohneOffen} onChange={() => p.setReiheOhneOffen(ohneOffen ? null : reihenSchluessel)} />
    ) : null
  /* Der Stand steht nur bei einer Hauptstaffel; „25 Staffeln“ neben einer Gruppe mit 12 Einträgen widerspräche der Zahl. */
  const stand = o.nummern.has(title.id) ? reihenStand(p.reihenTeile, p.reihenName, title.id, t) : ''
  return (
    <PanelKarte symbol={<StapelZeichen />} titel={t('detail.reihe')} zaehler={gezeigteZahl(zeigen)} akzent="info">
      {stand && <p className="-mt-1.5 mb-2 pl-[38px] text-t5 text-ak-text/75">{stand}</p>}
      <div data-reihe-liste data-reihe-uebersicht className="p-0.5">
        <UebersichtKopf t={t} suche={suchText ? reiheSuche.text : ''} onSuche={(text) => p.setReiheSuche({ reihe: reihenSchluessel, text })} schalter={schalter} />
        {!zeigen.length && <span className="px-1 py-2 text-t4 text-ak-leise">{t('detail.reiheKeinTreffer')}</span>}
        {zeigen.map((g, i) => {
          const auf = Boolean(suchText) || offen.includes(g.titel)
          return (
            <div key={g.titel} data-reihe-gruppe={g.titel}>
              <AufklappKopf offen={auf} onClick={() => umschalten(g.titel)} steuert={`${basis}-${i}`}>
                <span className="flex-1">{g.titel}</span>
                <span className="pr-2 tabular-nums">{g.teile.length}</span>
              </AufklappKopf>
              <div id={`${basis}-${i}`}>{auf && <Gruppenzeilen g={g} eigen={!suchText && g.titel === eigene} p={p} />}</div>
            </div>
          )
        })}
      </div>
      {p.wechselt && <span className="text-t5 text-ak-sehr-leise">{t('detail.seasonLoading')}</span>}
    </PanelKarte>
  )
}
