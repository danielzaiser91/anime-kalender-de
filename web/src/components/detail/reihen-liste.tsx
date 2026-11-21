import { ReihenKarte } from './reihen-karte.tsx'
import { reihenInhalt, reihenOrdnung, type ReihenListeProps } from './reihen-inhalt.tsx'
import { ReihenUebersicht } from './reihen-uebersicht.tsx'
import { gezeigteGruppen, gezeigteZahl, istGrosseReihe } from './reihen-uebersicht-regeln.ts'

export function ReihenListe(props: ReihenListeProps) {
  const { reihenTeile, t, reihenName, title, wechselt } = props
  if (reihenTeile.length < 2) return null
  /* Große Reihen (eine Gruppe über 12 Teile) als Übersicht mit eingeklappten Gruppen, alle anderen als Spur (F148, 20.11.2026). */
  const o = reihenOrdnung(reihenTeile, reihenName, t)
  if (istGrosseReihe(o.gruppen, title.id)) return <ReihenUebersicht key={props.reihenSchluessel} {...props} o={o} />
  /* Die Zahl am Kopf ist die der gezeigten Zeilen, wie in der Übersicht: Teile hinter dem Schalter „ohne Synchro“ zählen nicht mit. */
  const suchText = props.reiheSuche.reihe === props.reihenSchluessel ? props.reiheSuche.text.trim() : ''
  const zaehler = gezeigteZahl(gezeigteGruppen(o.gruppen, title.id, props.reiheOhneOffen === props.reihenSchluessel, suchText))
  return (
    <ReihenKarte reihenTeile={reihenTeile} reihenName={reihenName} title={title} zaehler={zaehler}>
      <div data-reihe-liste className="p-0.5">
        {reihenInhalt(props)}
      </div>
      {wechselt && <span className="text-t5 text-ak-sehr-leise">{t('detail.seasonLoading')}</span>}
    </ReihenKarte>
  )
}
