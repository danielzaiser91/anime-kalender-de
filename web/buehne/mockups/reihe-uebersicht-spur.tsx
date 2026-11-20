import { useState } from 'react'
import type { FranchiseMember } from '@shared/types.ts'
import { ReihenCover } from '../../src/components/detail/reihen-cover.tsx'
import { ReihenKarte } from '../../src/components/detail/reihen-karte.tsx'
import type { ReihenListeProps } from '../../src/components/detail/reihen-inhalt.tsx'
import { ReihenSpur } from '../../src/components/detail/reihen-spur.tsx'
import { angabenZeile, teilNamen } from '../../src/components/detail/reihen-teil.ts'
import { GROSSE_GRUPPE, gezeigteGruppen, ordnung } from './reihe-uebersicht-ordnung.ts'
import { leiste, SuchKopf, useAnfangsleiste, type Start } from './reihe-uebersicht-teile.tsx'

/** Bis zu 12 Karten; liegt der geöffnete Teil weiter hinten, bleibt er im Fenster (die 12 reichen von ihm aus gerechnet nach vorn). */
function gekappt(teile: FranchiseMember[], gewaehltId: number): FranchiseMember[] {
  if (teile.length <= GROSSE_GRUPPE) return teile
  const pos = Math.max(0, teile.findIndex((m) => m.id === gewaehltId))
  const start = Math.max(0, Math.min(pos - Math.floor(GROSSE_GRUPPE / 2), teile.length - GROSSE_GRUPPE))
  return teile.slice(start, start + GROSSE_GRUPPE)
}

/** Die 13. Karte der Spur: gleiche Breite wie ein Cover, Tippen zeigt die ganze Spur. */
function AlleKarte({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[180px] w-[120px] shrink-0 cursor-pointer snap-start items-center justify-center rounded-lg border border-ak-rand text-t3 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2 focus-visible:outline-2 focus-visible:outline-ak-fokus"
    >
      {`Alle ${n}`}
    </button>
  )
}

/** Untergrenze U: jede Spur trägt die Zahl am Kopf und zeigt höchstens 12 Karten, dann „Alle n“. Alles andere ist die echte Reihenliste. */
export function spurMit(start: Start) {
  return function GekappteSpuren(p: ReihenListeProps) {
    const [alle, setAlle] = useState<string[]>([])
    useAnfangsleiste(p, start)
    if (p.reihenTeile.length < 2) return null
    const o = ordnung(p)
    const l = leiste(p)
    const zeigen = gezeigteGruppen(o.gruppen, p.title.id, l.ohneOffen, l.suchText)
    const karte = (m: FranchiseMember) => (
      <ReihenCover
        key={m.id}
        m={m}
        t={p.t}
        offen={o.kuenftig(m)}
        gewaehlt={m.id === p.title.id}
        gemerkt={p.favorites.has(m.id)}
        nr={o.nummern.get(m.id)}
        namen={teilNamen(m, p.reihenName, o.istHauptstaffel(m), o.staffelLabel.get(m.id))}
        angaben={angabenZeile(m, o.kuenftig(m), p.t)}
        gesperrt={p.wechselt}
        onWaehlen={p.wechsleZu}
      />
    )
    return (
      <ReihenKarte reihenTeile={p.reihenTeile} reihenName={p.reihenName} title={p.title}>
        <div data-reihe-liste className="p-0.5">
          <SuchKopf p={p} suchText={l.suchText} zahlOhne={l.zahlOhne} ohneOffen={l.ohneOffen} nurSchalter={p.reihenTeile.length < 15} />
          {!zeigen.length && <span className="px-1 py-2 text-t4 text-ak-leise">{p.t('detail.reiheKeinTreffer')}</span>}
          {zeigen.map((g, i) => {
            const teile = alle.includes(g.titel) ? g.teile : gekappt(g.teile, p.title.id)
            return (
              <ReihenSpur key={g.titel} titel={`${g.titel} ${g.teile.length}`} gewaehltId={p.title.id} erste={i === 0} t={p.t}>
                {teile.map(karte)}
                {teile.length < g.teile.length && <AlleKarte n={g.teile.length} onClick={() => setAlle((a) => [...a, g.titel])} />}
              </ReihenSpur>
            )
          })}
        </div>
      </ReihenKarte>
    )
  }
}
