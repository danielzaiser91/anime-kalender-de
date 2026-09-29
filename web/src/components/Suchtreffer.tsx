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
export function TrefferName({ text, schluessel }: { text: string; schluessel: string }) {  const fundstellen = useFundstellen(schluessel)
  const stelle = fundstellen ? hervorhebung(text, fundstellen) : undefined
  if (!stelle) return <>{text}</>
  const teile = text.split(stelle)
  return (
    <>
      {teile.map((teil, i) => (
        <span key={i}>
          {teil}
          {i < teile.length - 1 && (
            <mark className="rounded bg-sky-200/80 px-0.5 text-inherit dark:bg-sky-400/30">{stelle}</mark>
          )}
        </span>
      ))}
    </>
  )
}

/** Ein Satz je Fundstelle für den Hinweis. */
function erklaerung(f: Fundstelle): string {
  const feld = SUCHFELD_ARTEN.find((s) => s.art === f.art)?.label ?? f.art
  if (!f.unscharf) return `${feld}: „${f.teil ?? f.wort}"`
  /*
    **Unscharf heißt: die Buchstaben stimmen nicht** — „pice" gegen „Piece". Deshalb steht das
    tragende Wort hervorgehoben da, und dahinter die Buchstaben, die wirklich übereinstimmen.
  */
  const gemeinsam = gemeinsameBuchstaben(f.suchwort, f.wort)
  return `${feld}: „${f.wort}" — zu „${f.suchwort}" unscharf getroffen, übereinstimmende Buchstaben: „${gemeinsam}"`
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
  const hinweis = [
    ...rest.map((f) => erklaerung(f)),
    rest.some((f) => f.unscharf) ? translate('suche.unscharfHinweis') : '',
  ]
    .filter(Boolean)
    .join(' · ')
  /* Der Kopf braucht kein Trennzeichen vor dem ersten Eintrag — „gefunden über: · Titel" las sich
     wie ein fehlender Eintrag (am 29.09.2026 auf der Seite gesehen). */
  const ganzerText = `${translate('suche.fundstelleTitel')} ${hinweis}`
  return (
    <Tooltip text={ganzerText} seite="oben">
      <span
        role="img"
        aria-label={ganzerText}
        className="ml-1 inline-flex size-3.5 flex-none items-center justify-center rounded-full bg-sky-500/80 text-[9px] font-bold leading-none text-white align-middle"
      >
        ?
      </span>
    </Tooltip>
  )
}

