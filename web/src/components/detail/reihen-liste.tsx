import { ReihenKarte } from './reihen-karte.tsx'
import { reihenInhalt, type ReihenListeProps } from './reihen-inhalt.tsx'

export function ReihenListe(props: ReihenListeProps) {
  const { reihenTeile, t, reihenName, title, wechselt } = props
  return (
    <>
      {reihenTeile.length > 1 && (
        <ReihenKarte reihenTeile={reihenTeile} reihenName={reihenName} title={title}>
          <div data-reihe-liste className="p-0.5">
            {reihenInhalt(props)}
          </div>
          {wechselt && <span className="text-t5 text-ak-sehr-leise">{t('detail.seasonLoading')}</span>}
        </ReihenKarte>
      )}
    </>
  )
}
