import { restText, type Kopfzeile, type Zeilenzustand } from './relative-uhrzeit-zeit.ts'

/** Farben von „jetzt": Akzent wie der Tageskopf „heute" (A, B) oder Smaragd wie „Läuft" im Panel (C); D ist die Seite selbst. */
export type Stil = 'A' | 'B' | 'C'

export interface Farben {
  linie: string
  punkt: string
  text: string
}

const AKZENT: Farben = { linie: 'bg-ak-akzent-text dark:bg-ak-akzent', punkt: 'text-ak-akzent', text: 'text-ak-akzent-text' }
const SMARAGD: Farben = { linie: 'bg-emerald-700 dark:bg-emerald-500', punkt: 'text-emerald-700 dark:text-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' }

export const farbenVon = (stil: Stil): Farben => (stil === 'C' ? SMARAGD : AKZENT)

/** Die Jetzt-Linie (Variante A, C): ein Listeneintrag mit sichtbarem Text, die Linie selbst ist nur Schmuck. */
export function JetztLinie({ jetzt, farben }: { jetzt: string; farben: Farben }) {
  return (
    <li className="flex items-center gap-2 py-0.5">
      <span aria-hidden="true" className={`h-px flex-1 ${farben.linie}`} />
      <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${farben.text}`}>jetzt {jetzt}</span>
    </li>
  )
}

/** Vierte Spalte der Zeile: „● Läuft · bis 18:50" oder „in 12 Min"; sonst nichts. */
export function Zustandsspalte({ zustand, farben }: { zustand: Zeilenzustand; farben: Farben }) {
  if (zustand.art === 'naechste') {
    return <span className="shrink-0 text-right text-[11px] font-semibold whitespace-nowrap text-ak-tv">{restText(zustand.minuten)}</span>
  }
  if (zustand.art !== 'laeuft') return null
  return (
    <span className="shrink-0 text-right text-[11px] font-semibold whitespace-nowrap">
      <span aria-hidden="true" className={farben.punkt}>● </span>
      <span className={farben.text}>Läuft{zustand.folge ? ` Folge ${zustand.folge}` : ''} · </span>
      <span className="text-ak-tv">bis {zustand.bis}</span>
    </span>
  )
}

/** Variante B: die eine Zeile unter „Im Fernsehen". */
export function KopfzeileText({ zeile, farben }: { zeile: Kopfzeile; farben: Farben }) {
  if (zeile.art === 'laeuft') {
    return (
      <p className="mt-1 text-xs font-semibold">
        <span aria-hidden="true" className={farben.punkt}>● </span>
        <span className={farben.text}>Läuft: </span>
        <span className="text-ak-text">{zeile.name}</span>
        <span className="text-ak-tv"> · bis {zeile.bis}</span>
      </p>
    )
  }
  const text = zeile.art === 'naechste' ? `Nächste ${restText(zeile.minuten)}` : 'Heute nichts mehr'
  return <p className={`mt-1 text-xs font-semibold ${zeile.art === 'naechste' ? 'text-ak-tv' : 'text-ak-sehr-leise'}`}>{text}</p>
}
