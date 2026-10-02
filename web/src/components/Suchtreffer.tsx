import type { ReactNode } from 'react'
import type { Fundstelle } from '../lib/search.ts'
import { gemeinsameBuchstaben, SUCHFELD_ARTEN } from '../lib/search.ts'
import { useFundstellen } from '../lib/such-kontext.ts'
import { translate } from '../lib/i18n.tsx'
import { Tooltip } from './ui.tsx'

/**
 * **Der Suchtreffer sichtbar machen**.
 *
 * Zwei Teile, beide aus **derselben** Rechnung wie die Suche (`sucheMitFundstellen`):
 *
 * - `TrefferName` hebt im sichtbaren Namen hervor, was getroffen hat.
 * - `FundstellenZeichen` erklärt den Treffer, der **nicht** im sichtbaren Namen steht (anderer
 *   Titel, Synonym, Studio, Genre, Schlagwort, Verlag, Ausgabe) — und bei unscharfen Treffern auch
 *   den Grund („pice" → „Piece") samt dem exakten Buchstabenabgleich.
 */

/** Eine Stelle zum Hervorheben — mit der Angabe, ob sie nur **als ganzes Wort** zählen darf. */
export interface Stelle {
  text: string
  ganzesWort: boolean
}

/**
 * **Alle Stellen, die im sichtbaren Namen hervorgehoben gehören** — eng oder (unscharf) das Wort.
 *
 * Daniel am 29.09.2026 mit Bild: „exiled knight wird hervorgehoben, knight nicht, fix das. es sollen
 * alle teile hervorgehoben werden." Bis dahin wurde die **erste** passende Fundstelle genommen — bei
 * zwei Suchwörtern blieb das zweite blass.
 *
 * `ganzesWort` ist für Füllwörter wie „a" wichtig: Sie sollen **nur** als Wort markiert werden, sonst
 * leuchtet in „M**a**chiv**a**llism" jeder Buchstabe (am 29.09.2026 genau so auf der Seite gesehen).
 */
export function hervorhebungen(text: string, fundstellen?: Fundstelle[]): Stelle[] {
  const stellen = new Map<string, boolean>()
  for (const f of fundstellen ?? []) {
    if (f.art !== 'titel') continue
    const stelle = f.unscharf ? f.wort : f.teil
    if (!stelle || !text.includes(stelle)) continue
    const ganzesWort = stelle === f.wort
    stellen.set(stelle, (stellen.get(stelle) ?? true) && ganzesWort)
  }
  /* Längste zuerst: Stehen „Exile" und „Exiled" in der Liste, soll der längere Teil gewinnen. */
  return [...stellen.entries()]
    .map(([text, ganzesWort]) => ({ text, ganzesWort }))
    .sort((a, b) => b.text.length - a.text.length)
}

/** Was im sichtbaren Namen **nicht** vorkommt — nur solche Fundstellen brauchen ein Zeichen. */
function versteckte(fundstellen: Fundstelle[], text: string): Fundstelle[] {
  return fundstellen.filter((f) => {
    const stelle = f.unscharf ? f.wort : f.teil
    return f.art !== 'titel' || !stelle || !text.includes(stelle)
  })
}

/** Ein Text mit hervorgehobenen Fundstellen. */
export function TrefferName({ text, schluessel }: { text: string; schluessel: string }) {
  const fundstellen = useFundstellen(schluessel)
  const stellen = fundstellen ? hervorhebungen(text, fundstellen) : []
  if (!stellen.length) return <>{text}</>
  return <>{markiere(text, stellen, 'rounded bg-sky-200/80 text-inherit dark:bg-sky-400/30')}</>
}

/**
 * Einen Text zerlegen und **alle** Stellen markieren.
 *
 * **Ohne Innenabstand**. Ein `px-0.5` schob das Wort
 * auseinander und ließ den Text an der Stelle anders aussehen als ohne Hervorhebung; die Farbe
 * allein reicht.
 */
function markiere(text: string, stellen: Stelle[], klasse: string): ReactNode {
  if (!stellen.length) return text
  /* Klammern: `split` behält die Treffer, die Markierung sitzt dann an jedem zweiten Stück.
     `ganzesWort` bekommt Wortgrenzen — sonst leuchtet bei „a" jeder Buchstabe im Namen. */
  const teile = stellen.map((s) => (s.ganzesWort ? `\\b${musterFest(s.text)}\\b` : musterFest(s.text)))
  const muster = new RegExp(`(${teile.join('|')})`)
  return text
    .split(muster)
    .map((teil, i) => (i % 2 ? <mark key={i} className={klasse}>{teil}</mark> : <span key={i}>{teil}</span>))
}

/** Ein Suchwort kann Zeichen tragen, die im Muster sonst etwas bedeuten (Punkt, Klammer, `+` …). */
function musterFest(teil: string): string {
  return teil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * **Was in dem Feld steht, mit der Fundstelle darin**.
 *
 * Vorher stand nur das getroffene Wort da — „Titel …: „Kappa"" — und niemand konnte einordnen,
 * woher es kommt. Jetzt steht der **ganze Inhalt des Feldes** da (etwa der vollständige Romaji-Titel)
 * und darin hervorgehoben die Stelle, die den Treffer trägt.
 */
function FeldAuszug({ f }: { f: Fundstelle }) {
  const stelle = f.unscharf ? f.wort : (f.teil ?? f.wort)
  if (!stelle || !f.feld.includes(stelle)) return <>{f.feld}</>
  return <>{markiere(f.feld, [{ text: stelle, ganzesWort: stelle === f.wort }], 'rounded bg-sky-400/40 text-white')}</>
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

