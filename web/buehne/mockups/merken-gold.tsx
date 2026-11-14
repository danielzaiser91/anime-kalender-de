import { useState, type ComponentProps } from 'react'
import { PanelBuehne } from '../../src/components/detail/buehne.tsx'
import { mockup } from '../register.ts'

/**
 * Merken-Knopf im Zustand „gemerkt“ als ganzer Knopf in Gold (Daniel, 13.11.2026): vier Vorschläge über dem echten Kopf.
 * Die Bühne führt keine Favoriten; der Kopf merkt sich den Titel deshalb selbst (Start: gemerkt, Tippen schaltet um).
 * Die Farben kommen nur aus den Favoriten-Tokens (`--ak-favorit`, `-text`, `-rand`), damit beide Themen stimmen.
 */
function KopfGemerkt(eigenschaften: ComponentProps<typeof PanelBuehne>) {
  const [gemerkt, setGemerkt] = useState(true)
  const favoriten = new Set(gemerkt ? [eigenschaften.title.id] : [])
  return (
    <div data-merken-gold className="contents">
      <PanelBuehne {...eigenschaften} favorites={favoriten} onToggleFavorite={() => setGemerkt(!gemerkt)} />
    </div>
  )
}

const KNOPF = `[data-merken-gold] button[aria-pressed='true']`
const mische = (anteil: number, grund = 'var(--ak-flaeche)') => `color-mix(in srgb, var(--ak-favorit) ${anteil}%, ${grund})`

/** A: zarter Goldton, Goldrand, Stern in Gold; die Schrift bleibt Textfarbe. */
const ZART = `
${KNOPF} { background: ${mische(14)}; border-color: var(--ak-favorit-rand); color: var(--ak-text); }
${KNOPF} svg { color: var(--ak-favorit-text); }
${KNOPF}:hover { background: ${mische(28)}; }
`

/** B: ganz in Gold gefüllt, Schrift und Stern dunkel (in beiden Themen, wie Text auf der Akzentfläche). */
const GEFUELLT = `
${KNOPF} { background: var(--ak-favorit); border-color: var(--ak-favorit-rand); color: var(--ak-auf-akzent); }
${KNOPF}:hover { background: ${mische(72, 'white')}; }
`

/**
 * C: Goldverlauf von links oben, Goldrand, Stern in Gold; beim Überfahren wird der Verlauf satter.
 * Höchstens 46 % Gold: an der hellsten Ecke hält die helle Schrift im dunklen Thema so 4,8:1 (bei 58 % waren es 3,5:1; gerechnet 13.11.2026).
 */
const VERLAUF = `
${KNOPF} { background: linear-gradient(135deg, ${mische(38)}, ${mische(8)} 55%, ${mische(24)}); border-color: var(--ak-favorit-rand); color: var(--ak-text); }
${KNOPF} svg { color: var(--ak-favorit-text); }
${KNOPF}:hover { background: linear-gradient(135deg, ${mische(46)}, ${mische(18)} 55%, ${mische(34)}); }
`

/** D: ohne Füllung, Schrift und Stern in Gold, doppelter Goldrand mit Leuchten; beim Überfahren leuchtet er stärker. */
const LEUCHTEN = `
${KNOPF} { border-color: var(--ak-favorit-rand); color: var(--ak-favorit-text); box-shadow: 0 0 0 1px var(--ak-favorit-rand), 0 0 14px ${mische(45, 'transparent')}; }
${KNOPF}:hover { background: ${mische(12)}; box-shadow: 0 0 0 1px var(--ak-favorit-rand), 0 0 22px 2px ${mische(75, 'transparent')}; }
`

const ersatz = { PanelBuehne: KopfGemerkt }

mockup({
  name: 'merken-gold',
  titel: 'Merken-Knopf in Gold – 4 Vorschläge',
  ausschnitt: 'detailpanel',
  faelle: ['tokyo-revengers'],
  varianten: {
    A: { ersatz, stil: ZART, notiz: 'Zarter Goldton mit Goldrand, Stern in Gold. Tippen auf den Knopf schaltet zwischen gemerkt und nicht gemerkt.' },
    B: { ersatz, stil: GEFUELLT, notiz: 'Kräftig in Gold gefüllt, Schrift und Stern dunkel.' },
    C: { ersatz, stil: VERLAUF, notiz: 'Goldverlauf mit Goldrand, Stern in Gold.' },
    D: { ersatz, stil: LEUCHTEN, notiz: 'Goldrand mit Leuchten, Schrift und Stern in Gold, keine Füllung.' },
  },
})
