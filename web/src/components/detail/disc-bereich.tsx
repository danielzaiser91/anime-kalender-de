import { useMemo, useState, type ReactNode } from 'react'
import type { DiscAusgabe, Release, Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { useLang, type TranslationKey } from '../../lib/i18n.tsx'
import { discAusgabenVon } from './disc-ausgaben.ts'
import { Matrix, type MatrixProps } from './disc-matrix.tsx'
import { gruppenVon, jahre, startOffen, variantenVon, type Art, type Variante } from './disc-varianten.ts'

/*
  **Der Disc-Bereich im Detail-Panel** (Daniel, F96 „B3“, 27.10.2026): die Varianten als Matrix nach Art gruppiert. Gesamtausgaben und
  Boxen stehen offen, Volumes und Filme zugeklappt (Zahl und Jahre am Kopf); Händler und Kalender klappen unter der angetippten Zeile auf.
*/

type Wahl = Pick<MatrixProps, 'wahl' | 'onWahl' | 'today'>

function Gruppe({ art, liste, offen: start, w }: { art: Art; liste: Variante[]; offen: boolean; w: Wahl }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(start)
  const spanne = jahre(liste)
  return (
    <section className="flex flex-col border-t border-ak-linie first:border-t-0">
      <button type="button" aria-expanded={offen} onClick={() => setOffen((o) => !o)} className="flex min-h-11 items-center justify-between gap-2 px-1 text-left">
        <span className="text-t4 font-bold">
          {t(`disc.art.${art}` as TranslationKey)}{' '}
          <span className="font-normal text-ak-leise">
            · {liste.length}
            {spanne && ` · ${spanne}`}
          </span>
        </span>
        <span aria-hidden="true" className="text-ak-akzent-text">
          {offen ? '▴' : '▾'}
        </span>
      </button>
      {offen && <Matrix liste={liste} {...w} />}
    </section>
  )
}

/** Kopfzeile: Zahl der Varianten, Verlag leise. */
function Zaehler({ anzahl, verlag }: { anzahl: number; verlag?: string }) {
  const { t } = useLang()
  return (
    <div className="flex items-baseline gap-2 text-t5 text-ak-leise">
      <span className="font-bold uppercase tracking-[.08em]">{anzahl === 1 ? t('disc.variante') : t('disc.varianten', { n: anzahl })}</span>
      {verlag && <span className="truncate">· {verlag}</span>}
    </div>
  )
}

export interface DiscBereichProps {
  title: Title
  today: string
  discAusgaben: DiscAusgabe[]
  discReleases: Release[]
  /** Die übrigen Kaufwege der Seite (Apple TV, Google Play …) als fertige Pillen. */
  kaufwege: ReactNode[]
}

export function DiscBereich({ title, today, discAusgaben, discReleases, kaufwege }: DiscBereichProps) {
  const [wahl, setWahl] = useState<string | null>(null)
  const alle = useMemo(() => variantenVon(discAusgabenVon(discAusgaben, discReleases, title), anzeigeName(title)), [discAusgaben, discReleases, title])
  const verlag = discReleases.map((r) => r.publisher).find(Boolean)
  return (
    <div className="flex w-full flex-col gap-2">
      <Zaehler anzahl={alle.length} verlag={verlag} />
      {gruppenVon(alle).map((g) => (
        /* Die aniSearch-Ausgaben kommen nach den Terminen; mit dem Schlüssel greift der Startzustand auch dann. */
        <Gruppe key={`${g.art}-${startOffen(alle, g.art)}`} art={g.art} liste={g.liste} offen={startOffen(alle, g.art)} w={{ wahl, onWahl: setWahl, today }} />
      ))}
      {kaufwege.length > 0 && <div className="flex flex-wrap items-start gap-x-2 gap-y-4 pt-1">{kaufwege}</div>}
    </div>
  )
}
