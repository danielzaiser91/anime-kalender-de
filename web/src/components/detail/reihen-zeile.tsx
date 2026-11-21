import type { FranchiseMember, Title } from '@shared/types.ts'
import { coverBild } from '../../lib/cover.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { SynchroMarke } from './reihen-marke.tsx'
import { angabenZeile, teilNamen } from './reihen-teil.ts'
import { ZeilenName } from './zeilen-name.tsx'
import type { reihenOrdnung } from './reihen-inhalt.tsx'

export type Ordnung = ReturnType<typeof reihenOrdnung>

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

export type ZeileProps = {
  m: FranchiseMember
  o: Ordnung
  t: Translate
  reihenName: string
  title: Pick<Title, 'id'>
  gemerkt: boolean
  wechselt: boolean
  wechsleZu: (id: number) => void
}

/** Ein Teil der Reihe als Zeile der Übersicht: Cover 36 × 54, Name (höchstens zwei Zeilen), Angaben, rechts die Marke; mindestens 56 px hoch. */
export function ReihenZeile({ m, o, t, reihenName, title, gemerkt, wechselt, wechsleZu }: ZeileProps) {
  const gewaehlt = m.id === title.id
  const offen = o.kuenftig(m)
  const ohneDe = Boolean(m.ohneSynchro) && !offen
  const namen = teilNamen(m, reihenName, o.istHauptstaffel(m), o.staffelLabel.get(m.id))
  return (
    <li data-reihe-teil={m.id}>
      <button
        type="button"
        aria-current={gewaehlt ? 'true' : undefined}
        disabled={wechselt}
        onClick={() => {
          if (!gewaehlt) wechsleZu(m.id)
        }}
        className={[
          'relative flex min-h-14 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left hover:bg-ak-flaeche-2 disabled:cursor-default disabled:opacity-45',
          'focus-visible:outline-2 focus-visible:outline-ak-fokus',
          gewaehlt ? 'cursor-default bg-ak-flaeche-2' : 'cursor-pointer',
        ].join(' ')}
      >
        {gewaehlt && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-ak-akzent" />}
        <ZeilenCover m={m} offen={offen} gemerkt={gemerkt} ohneDe={ohneDe} t={t} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={['line-clamp-2 text-t3', ohneDe ? 'opacity-75' : '', gewaehlt ? 'font-semibold text-ak-akzent-text' : 'font-medium text-ak-text'].join(' ')}>
            <ZeilenName nr={o.nummern.get(m.id)} rest={namen.rest} voll={namen.voll} kurz={namen.kurz} folgen={o.folgen.get(m.id)} />
          </span>
          <span className="truncate text-t5 text-ak-leise">{angabenZeile(m, offen, t)}</span>
        </span>
        <SynchroMarke t={t} m={m} ohneDe={ohneDe} />
      </button>
    </li>
  )
}
