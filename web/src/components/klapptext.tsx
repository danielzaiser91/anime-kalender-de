import { useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { MitFachwoertern } from './fachwort.tsx'

/**
 * **Lange Texte nur aufgeklappt**.
 *
 * Anlass: „außerdem text viel zu lang, lange texte sind nur erlaubt, im ausgeklappten zustand."
 * Der Vermerk einer Meldung (und der Hinweis im Antwortkasten) trug die ganze Begründung in der
 * Zeile; das Wichtigste ging darin unter.
 *
 * Gezeigt wird deshalb der **erste Satz**; ist mehr da, steht daneben „mehr"/„weniger". Getrennt
 * wird am Satzende — nicht an einer Zeichenzahl, sonst schnitte die Kürzung mitten im Gedanken.
 */
export function Klapptext({ text, className = '' }: { text: string; className?: string }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const erster = /^[\s\S]*?[.!?](\s|$)/.exec(text.trim())?.[0].trim() ?? text.trim()
  const rest = text.trim().slice(erster.length).trim()
  if (!rest) return <span className={className}><MitFachwoertern text={text} /></span>
  return (
    <span className={className}>
      <MitFachwoertern text={erster} />
      {offen && <> <MitFachwoertern text={rest} /></>}{' '}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2"
      >
        {offen ? t('filter.showLess') : t('filter.showMore', { count: '' }).trim()}
      </button>
    </span>
  )
}

/** Kurzform für Knoten, die schon Text sind — sonst unverändert. */
export function KlapptextOderText({ text, className = '' }: { text: string | ReactNode; className?: string }) {
  return typeof text === 'string' ? <Klapptext text={text} className={className} /> : <>{text}</>
}
