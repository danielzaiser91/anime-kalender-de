import type { ReactNode } from 'react'
import type { Fundstelle } from '../lib/search.ts'
import { gemeinsameBuchstaben, SUCHFELD_ARTEN } from '../lib/search.ts'
import { useFundstellen } from '../lib/such-kontext.ts'
import { translate } from '../lib/i18n.tsx'
import { Tooltip } from './ui.tsx'

/**
 * **Der Suchtreffer sichtbar machen** (Daniel, 29.09.2026: „search should highlight the part of the
 * result title that has been matched … if search matched not the title, but the alternative title
 * (not visible on the result card) then it should display a small icon … to explain which part of it
 * lead to it being part of the search result").
 *
 * Zwei Teile, beide aus **derselben** Rechnung wie die Suche (`sucheMitFundstellen`):
 *
 * - `TrefferName` hebt im sichtbaren Namen hervor, was getroffen hat.
 * - `FundstellenZeichen` erklärt den Treffer, der **nicht** im sichtbaren Namen steht (anderer
 *   Titel, Synonym, Studio, Genre, Schlagwort, Verlag, Ausgabe) — und bei unscharfen Treffern auch
 *   den Grund („pice" → „Piece") samt dem exakten Buchstabenabgleich.
 */

/** Die Stelle, die im sichtbaren Namen hervorgehoben gehört — eng oder (unscharf) das ganze Wort. */
function hervorhebung(text: string, fundstellen?: Fundstelle[]): string | undefined {
  for (const f of fundstellen ?? []) {
    if (f.art !== 'titel') continue
    const stelle = f.unscharf ? f.wort : f.teil
    if (stelle && text.includes(stelle)) return stelle
  }
  return undefined
}

/** Was im sichtbaren Namen **nicht** vorkommt — nur solche Fundstellen brauchen ein Zeichen. */
function versteckte(fundstellen: Fundstelle[], text: string): Fundstelle[] {
  return fundstellen.filter((f) => {
    const stelle = f.unscharf ? f.wort : f.teil
    return f.art !== 'titel' || !stelle || !text.includes(stelle)
  })
}

/** Ein Text mit hervorgehobener Fundstelle. */
export function TrefferName({ text, schluessel }: { text: string; schluessel: string }) {
  const fundstellen = useFundstellen(schluessel)
  const stelle = fundstellen ? hervorhebung(text, fundstellen) : undefined
  if (!stelle) return <>{text}</>
  return <>{markiere(text, stelle, 'rounded bg-sky-200/80 px-0.5 text-inherit dark:bg-sky-400/30')}</>
}

/** Denselben Text zerlegen und die Stelle markieren — einmal geschrieben, zweimal gebraucht. */
function markiere(text: string, stelle: string, klasse: string): ReactNode {
  const teile = text.split(stelle)
  return teile.map((teil, i) => (
    <span key={i}>
      {teil}
      {i < teile.length - 1 && <mark className={klasse}>{stelle}</mark>}
    </span>
  ))
}

/**
 * **Was in dem Feld steht, mit der Fundstelle darin** (Daniel, 29.09.2026: „im tooltip muss noch
 * erwähnt werden was im feld in dem das match ist drin steht, und den teil davon highlighten").
 *
 * Vorher stand nur das getroffene Wort da — „Titel …: „Kappa"" — und niemand konnte einordnen,
 * woher es kommt. Jetzt steht der **ganze Inhalt des Feldes** da (etwa der vollständige Romaji-Titel)
 * und darin hervorgehoben die Stelle, die den Treffer trägt.
 */
function FeldAuszug({ f }: { f: Fundstelle }) {
  const stelle = f.unscharf ? f.wort : (f.teil ?? f.wort)
  if (!stelle || !f.feld.includes(stelle)) return <>{f.feld}</>
  return <>{markiere(f.feld, stelle, 'rounded bg-sky-400/40 px-0.5 font-semibold text-white')}</>
}

/**
 * Derselbe Hinweis als **Text** — für `aria-label` (eine Blase mit Markup liest der Vorleser nicht
 * vor) und für die Zusicherung in `check:logic`.
 */
export function fundstelleHinweis(f: Fundstelle): string {
  const feld = SUCHFELD_ARTEN.find((s) => s.art === f.art)?.label ?? f.art
  const kopf = `${feld}: „${f.feld}"`
  if (!f.unscharf) {
    /* Den getroffenen Teil auch nennen: In der Blase ist er markiert, fürs Vorlesen nicht sichtbar. */
    return f.teil && f.teil !== f.feld ? `${kopf} — getroffen: „${f.teil}"` : kopf
  }
  /*
    **Unscharf heißt: die Buchstaben stimmen nicht** — „pice" gegen „Piece". Deshalb steht das
    tragende Wort hervorgehoben da, und dahinter die Buchstaben, die wirklich übereinstimmen.
  */
  const gemeinsam = gemeinsameBuchstaben(f.suchwort, f.wort)
  return `${kopf} — zu „${f.suchwort}" unscharf getroffen, übereinstimmende Buchstaben: „${gemeinsam}"`
}

/** Derselbe Hinweis mit hervorgehobener Fundstelle — für die Blase. */
function erklaerung(f: Fundstelle): ReactNode {
  const feld = SUCHFELD_ARTEN.find((s) => s.art === f.art)?.label ?? f.art
  const gemeinsam = f.unscharf ? ` — zu „${f.suchwort}" unscharf getroffen, übereinstimmende Buchstaben: „${gemeinsameBuchstaben(f.suchwort, f.wort)}"` : ''
  const getroffen = !f.unscharf && f.teil && f.teil !== f.feld ? ` — getroffen: „${f.teil}"` : ''
  return (
    <span className="block">
      {feld}: „<FeldAuszug f={f} />"{getroffen}
      {gemeinsam}
    </span>
  )
}

/**
 * **Das Zeichen am Treffer** — nur wenn der sichtbare Name den Treffer nicht erklärt.
 *
 * Steht hinter dem Namen statt in der Ecke: In der Datenbank-Kachel sitzt unten rechts die
 * Staffelzahl, im Kalender Stern und Teilen-Knopf — die Ecke ist besetzt, und ein Zeichen, das man
 * suchen muss, erklärt nichts.
 */
export function FundstellenZeichen({ text, schluessel }: { text: string; schluessel: string }) {
  const treffer = useFundstellen(schluessel)
  const rest = treffer ? versteckte(treffer, text) : []
  if (!rest.length) return null
  /* Fürs Vorlesen: derselbe Inhalt als Text — eine Blase mit Markup liest niemand vor. */
  const vorleseText = `${translate('suche.fundstelleTitel')} ${rest.map(fundstelleHinweis).join(' · ')}`
  return (
    <Tooltip
      text={
        <span className="block">
          <span className="block">{translate('suche.fundstelleTitel')}</span>
          {rest.map((f, i) => (
            <span key={i}>{erklaerung(f)}</span>
          ))}
          {rest.some((f) => f.unscharf) && <span className="block">{translate('suche.unscharfHinweis')}</span>}
        </span>
      }
      seite="oben"
    >
      <span
        role="img"
        aria-label={vorleseText}
        className="ml-1 inline-flex size-3.5 flex-none items-center justify-center rounded-full bg-sky-500/80 text-[9px] font-bold leading-none text-white align-middle"
      >
        ?
      </span>
    </Tooltip>
  )
}

