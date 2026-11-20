import { Fragment, useEffect, useState } from 'react'
import type { FranchiseMember } from '@shared/types.ts'
import { coverBild } from '../../src/lib/cover.ts'
import type { Translate } from '../../src/lib/i18n.tsx'
import { AufklappKopf } from '../../src/components/detail/aufklapp-kopf.tsx'
import { PanelKarte, StapelZeichen } from '../../src/components/detail/panel-karte.tsx'
import { OhneSynchroSchalter, ReihenKopf } from '../../src/components/detail/reihen-kopf.tsx'
import { ReihenListe } from '../../src/components/detail/reihen-liste.tsx'
import type { ReihenListeProps } from '../../src/components/detail/reihen-inhalt.tsx'
import { SynchroMarke } from '../../src/components/detail/reihen-marke.tsx'
import { istEingeklappt, istNichtssagend } from '../../src/components/detail/reihen-regeln.ts'
import { angabenZeile, teilNamen } from '../../src/components/detail/reihen-teil.ts'
import { ZeilenName } from '../../src/components/detail/zeilen-name.tsx'
import { SAMMELTITEL_ID, SAMMELTITEL_STAFFELN, SPANNEN, STAFFELN_GESAMT } from './reihe-uebersicht-daten.ts'
import { andereGruppe, fensterUm, gezeigteGruppen, gruppeVon, istGrosseReihe, ordnung, type Gruppe } from './reihe-uebersicht-ordnung.ts'

/** Anfangszustand einer Variante; die Bühne hat keine eigenen Schalter, jeder Zustand ist deshalb eine Variante. */
export type Start = { ohne?: boolean; suche?: string; zweite?: boolean; alle?: boolean }
type Ordnung = ReturnType<typeof ordnung>

const FILME = 'Filme'

/** Suche, Schalter „Teile ohne Synchro zeigen“ und die gemeinsame Kopfzeile (gleich in der Spur und in der Übersicht). */
export function SuchKopf({ p, suchText, zahlOhne, ohneOffen, nurSchalter }: { p: ReihenListeProps; suchText: string; zahlOhne: number; ohneOffen: boolean; nurSchalter?: boolean }) {
  const schalter =
    zahlOhne > 0 && !suchText ? (
      <OhneSynchroSchalter t={p.t} zahl={zahlOhne} ohneOffen={ohneOffen} onChange={() => p.setReiheOhneOffen(ohneOffen ? null : p.reihenSchluessel)} />
    ) : null
  if (nurSchalter) return schalter && <div className="mb-1 flex">{schalter}</div>
  return <ReihenKopf t={p.t} suche={suchText ? p.reiheSuche.text : ''} onSuche={(text) => p.setReiheSuche({ reihe: p.reihenSchluessel, text })} schalter={schalter} />
}

/** Was die Leiste der Reihe gerade sagt: Suchtext, Schalterstand und Zahl der Teile hinter dem Schalter. */
export function leiste(p: ReihenListeProps) {
  return {
    suchText: p.reiheSuche.reihe === p.reihenSchluessel ? p.reiheSuche.text.trim() : '',
    ohneOffen: p.reiheOhneOffen === p.reihenSchluessel,
    zahlOhne: p.reihenTeile.filter((m) => istEingeklappt(m, p.title.id)).length,
  }
}

/** Setzt Schalter und Suche der Variante einmal je Reihe — der Zustand liegt im Panel, die Variante schaltet ihn nur an. */
export function useAnfangsleiste(p: ReihenListeProps, start: Start): void {
  const { setReiheOhneOffen, setReiheSuche, reihenSchluessel } = p
  useEffect(() => {
    if (start.ohne) setReiheOhneOffen(reihenSchluessel)
    if (start.suche) setReiheSuche({ reihe: reihenSchluessel, text: start.suche })
  }, [reihenSchluessel, start.ohne, start.suche, setReiheOhneOffen, setReiheSuche])
}

/** Zeile „Staffel 1–5 von 25“ im Kopf der Karte; nur, wo der geöffnete Titel eine belegte Spanne hat. */
function Stand({ titelId }: { titelId: number }) {
  const spanne = SPANNEN[titelId]
  return spanne ? <p className="-mt-1.5 mb-2 pl-[38px] text-t5 text-ak-text/75">{`${spanne} von ${STAFFELN_GESAMT}`}</p> : null
}

/** Name der Zeile: belegte Spanne mit Zusatz, in Reihen mit belegten Spannen sonst nur der Name, überall sonst die Nummer der Seite. */
function ZeilenText({ m, o, p }: { m: FranchiseMember; o: Ordnung; p: ReihenListeProps }) {
  const namen = teilNamen(m, p.reihenName, o.istHauptstaffel(m), o.staffelLabel.get(m.id))
  const spanne = SPANNEN[m.id]
  if (spanne) {
    const zusatz = namen.rest && !istNichtssagend(namen.rest) ? ` · ${namen.rest}` : ''
    return (
      <>
        <b className="font-semibold">{spanne}</b>
        {zusatz}
      </>
    )
  }
  const belegt = p.reihenTeile.some((x) => x.id in SPANNEN)
  return <ZeilenName nr={belegt ? undefined : o.nummern.get(m.id)} rest={namen.rest} voll={namen.voll} kurz={namen.kurz} />
}

function ZeilenCover({ m, offen, gemerkt, ohneDe, t }: { m: FranchiseMember; offen: boolean; gemerkt: boolean; ohneDe: boolean; t: Translate }) {
  return (
    <span
      className={[
        'relative block aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md bg-ak-flaeche-2',
        ohneDe ? 'opacity-55' : '',
        offen ? 'opacity-70 outline-1 -outline-offset-1 outline-dashed outline-ak-leise' : '',
      ].join(' ')}
    >
      {m.cover && <img {...coverBild(m.cover, 36, '36px', 2)} width={36} height={54} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
      {gemerkt && (
        <span className="absolute left-0.5 top-0.5 rounded bg-ak-grund/85 px-1 text-t5 font-bold text-ak-favorit-text" aria-label={t('card.unfavourite')}>
          ★
        </span>
      )}
    </span>
  )
}

/** Ein Teil der Reihe als Zeile: Cover 36 × 54, Name (höchstens zwei Zeilen), Angaben, rechts die Marke; mindestens 56 px hoch. */
function Zeile({ m, o, p }: { m: FranchiseMember; o: Ordnung; p: ReihenListeProps }) {
  const gewaehlt = m.id === p.title.id
  const offen = o.kuenftig(m)
  const ohneDe = Boolean(m.ohneSynchro) && !offen
  return (
    <li>
      <button
        type="button"
        aria-current={gewaehlt ? 'true' : undefined}
        disabled={p.wechselt}
        onClick={() => {
          if (!gewaehlt) p.wechsleZu(m.id)
        }}
        className={[
          'relative flex min-h-14 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-ak-flaeche-2 disabled:cursor-default disabled:opacity-45',
          'focus-visible:outline-2 focus-visible:outline-ak-fokus',
          gewaehlt ? 'cursor-default bg-ak-flaeche-2' : 'cursor-pointer',
        ].join(' ')}
      >
        {gewaehlt && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-ak-akzent" />}
        <ZeilenCover m={m} offen={offen} gemerkt={p.favorites.has(m.id)} ohneDe={ohneDe} t={p.t} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={['line-clamp-2 text-t3', ohneDe ? 'opacity-75' : '', gewaehlt ? 'font-semibold text-ak-akzent-text' : 'font-medium text-ak-text'].join(' ')}>
            <ZeilenText m={m} o={o} p={p} />
          </span>
          <span className="truncate text-t5 text-ak-leise">{angabenZeile(m, offen, p.t)}</span>
        </span>
        <SynchroMarke t={p.t} m={m} ohneDe={ohneDe} />
      </button>
    </li>
  )
}

/** Die einzelnen Staffeln des geöffneten Sammeltitels, eingerückt als Text (erste Fassung, kein Sprung). */
function Staffelzeilen() {
  return (
    <li>
      <ul className="mb-1 ml-[54px] flex flex-col">
        {SAMMELTITEL_STAFFELN.map((s) => (
          <li key={s.nr} className="py-1 text-t4 text-ak-leise">{`Staffel ${s.nr} · ${s.folgen} Fg.`}</li>
        ))}
      </ul>
    </li>
  )
}

function Gruppenzeilen({ g, o, p, fenster, alleZeigen }: { g: Gruppe; o: Ordnung; p: ReihenListeProps; fenster: boolean; alleZeigen: () => void }) {
  const teile = fenster ? fensterUm(g.teile, p.title.id) : g.teile
  return (
    <>
      <ul className="flex flex-col">
        {teile.map((m) => (
          <Fragment key={m.id}>
            <Zeile m={m} o={o} p={p} />
            {m.id === p.title.id && m.id === SAMMELTITEL_ID && <Staffelzeilen />}
          </Fragment>
        ))}
      </ul>
      {fenster && teile.length < g.teile.length && (
        <button type="button" onClick={alleZeigen} className="min-h-11 w-full cursor-pointer rounded-lg text-left text-t4 font-semibold text-ak-akzent-text hover:bg-ak-flaeche-2">
          <span className="px-2">{`Alle ${g.teile.length} zeigen`}</span>
        </button>
      )}
    </>
  )
}

type Zustand = { offen: string[]; alle: string[] }

/** Offen ist die Gruppe des geöffneten Titels, je nach Zustand der Variante dazu eine zweite; „Alle zeigen“ hebt das Fenster auf. */
function anfangsZustand(o: Ordnung, p: ReihenListeProps, start: Start): Zustand {
  const eigene = gruppeVon(o.gruppen, p.title.id)
  const zweite = start.zweite ? andereGruppe(o.gruppen, p.title.id, FILME) : undefined
  return { offen: [eigene, zweite].filter((x): x is string => Boolean(x)), alle: start.alle && eigene ? [eigene] : [] }
}

function UebersichtKarte({ p, o, start }: { p: ReihenListeProps; o: Ordnung; start: Start }) {
  const [zustand, setZustand] = useState(() => anfangsZustand(o, p, start))
  const eigene = gruppeVon(o.gruppen, p.title.id)
  /* Wechsel innerhalb der Reihe: Geöffnetes bleibt offen, die Gruppe des neuen Teils kommt dazu. */
  useEffect(() => {
    if (eigene) setZustand((z) => (z.offen.includes(eigene) ? z : { ...z, offen: [...z.offen, eigene] }))
  }, [eigene])
  const l = leiste(p)
  const zeigen = gezeigteGruppen(o.gruppen, p.title.id, l.ohneOffen, l.suchText)
  const umschalten = (titel: string) => setZustand((z) => ({ ...z, offen: z.offen.includes(titel) ? z.offen.filter((x) => x !== titel) : [...z.offen, titel] }))
  return (
    <PanelKarte symbol={<StapelZeichen />} titel={p.t('detail.reihe')} zaehler={p.reihenTeile.length} akzent="info">
      <Stand titelId={p.title.id} />
      <div data-reihe-liste className="p-0.5">
        <SuchKopf p={p} suchText={l.suchText} zahlOhne={l.zahlOhne} ohneOffen={l.ohneOffen} />
        {!zeigen.length && <span className="px-1 py-2 text-t4 text-ak-leise">{p.t('detail.reiheKeinTreffer')}</span>}
        {zeigen.map((g) => {
          const offen = Boolean(l.suchText) || zustand.offen.includes(g.titel)
          const fenster = !l.suchText && g.titel === eigene && g.teile.length > 12 && !zustand.alle.includes(g.titel)
          return (
            <div key={g.titel}>
              <AufklappKopf offen={offen} onClick={() => umschalten(g.titel)}>
                <span className="flex-1">{g.titel}</span>
                <span className="pr-2 tabular-nums">{g.teile.length}</span>
              </AufklappKopf>
              {offen && <Gruppenzeilen g={g} o={o} p={p} fenster={fenster} alleZeigen={() => setZustand((z) => ({ ...z, alle: [...z.alle, g.titel] }))} />}
            </div>
          )
        })}
      </div>
    </PanelKarte>
  )
}

/** Variante A: große Reihen als Übersicht, alle anderen bleiben die echte Spur. */
export function uebersichtMit(start: Start) {
  return function Uebersicht(p: ReihenListeProps) {
    useAnfangsleiste(p, start)
    const o = ordnung(p)
    if (p.reihenTeile.length < 2 || !istGrosseReihe(o.gruppen, p.title.id)) return <ReihenListe {...p} />
    return <UebersichtKarte key={p.reihenSchluessel} p={p} o={o} start={start} />
  }
}
