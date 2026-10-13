import { ALLE } from '../faelle.ts'
import { mockup } from '../register.ts'

/**
 * Mockups der Design-Regeln (13.10.2026, docs/wissen/design-regeln.md). Vorher = heutige Klassen, Nachher = die Regeln als
 * Stylesheet über derselben Tafel bzw. der echten App (`Variante.stil`). Die Nachher-Regeln greifen über `data-rolle`/`data-zustand`
 * (Tafel) und über ARIA-Zustände (App) — so zeigt das Mockup die Regel, ohne dass die Bauteile schon umgestellt sind.
 */
const TAFEL = `
[data-rolle='primaer'] { background: var(--ak-akzent); color: var(--ak-auf-akzent); }
[data-rolle='primaer'][data-zustand='hover'] { background: var(--ak-akzent-hover); }
[data-rolle='sekundaer'] { border-color: var(--ak-rand); background: var(--ak-flaeche); color: var(--ak-text); }
[data-rolle='sekundaer'][data-zustand='hover'] { border-color: var(--ak-leise); background: var(--ak-flaeche-2); }
[data-rolle='sekundaer'][data-zustand='gewaehlt'] { background: var(--ak-flaeche-3); }
[data-rolle='tertiaer'] { color: var(--ak-leise); background: transparent; }
[data-rolle='tertiaer'][data-zustand='hover'] { color: var(--ak-text); background: var(--ak-flaeche-2); }
[data-rolle^='reiter'] { color: var(--ak-leise); background: transparent; }
[data-rolle^='reiter'][data-zustand='hover'] { color: var(--ak-text); }
[data-rolle='reiter'][data-zustand='gewaehlt'], [data-rolle='reiter-news'][data-zustand='gewaehlt'] { background: var(--ak-gewaehlt); color: var(--ak-auf-gewaehlt); font-weight: 800; }
[data-rolle='reiter-nav'][data-zustand='gewaehlt'] { border-color: var(--ak-gewaehlt); color: var(--ak-text); }
[data-rolle^='pille'] { border-color: var(--ak-rand); color: var(--ak-text); background: transparent; box-shadow: none; }
[data-rolle='pille'][data-zustand='hover'] { border-color: var(--ak-leise); }
[data-rolle='pille'][data-zustand='gewaehlt'] { border-color: var(--ak-gut); background: var(--ak-gut-grund); box-shadow: inset 0 0 0 1px var(--ak-gut); font-weight: 800; }
[data-rolle='pille-nein'][data-zustand='gewaehlt'] { border-color: var(--ak-fehler); background: var(--ak-fehler-grund); box-shadow: inset 0 0 0 1px var(--ak-fehler); color: var(--ak-fehler-text); text-decoration: line-through; }
[data-rolle='link'] { color: var(--ak-link); text-decoration: underline; text-underline-offset: 2px; }
[data-rolle='link'][data-zustand='hover'] { color: var(--ak-text); }
[data-rolle='kachel'] { border-color: var(--ak-rand); background: var(--ak-flaeche); box-shadow: none; }
[data-rolle='kachel'][data-zustand='hover'] { border-color: var(--ak-leise); }
[data-rolle='kachel'][data-zustand='gewaehlt'] { border-color: var(--ak-akzent); box-shadow: 0 0 0 1px var(--ak-akzent); }
[data-rolle='liste'] { background: transparent; color: var(--ak-text); }
[data-rolle='liste'][data-zustand='hover'] { background: var(--ak-flaeche-2); }
[data-rolle='liste'][data-zustand='gewaehlt'] { background: var(--ak-flaeche-2); box-shadow: inset 3px 0 0 var(--ak-akzent); }
[data-zustand='fokus'] { box-shadow: none; outline: 2px solid var(--ak-fokus); outline-offset: 2px; }
[data-rolle='liste'][data-zustand='fokus'] { outline-offset: -2px; }
[data-zustand='aus'] { opacity: .45; cursor: default; }
`

/** Regeln über der echten App: Fokusring, Gewählt (eins von n), Deaktiviert, Schnellfilter-Band, Pillen-Farben. */
const APP = `
:focus-visible { outline: 2px solid var(--ak-fokus) !important; outline-offset: 2px; box-shadow: none !important; }
nav a[aria-current='page'] { border-color: var(--ak-gewaehlt); color: var(--ak-text); }
[role='group'] > button[aria-pressed='true'], .pn-pille[aria-pressed='true'] { background: var(--ak-gewaehlt); border-color: var(--ak-gewaehlt); color: var(--ak-auf-gewaehlt); }
.pn-pille[aria-pressed='true'] .z { color: var(--ak-auf-gewaehlt); }
button:disabled, [aria-disabled='true'] { opacity: .45 !important; cursor: default; }
.border-blue-600, .dark .border-blue-400 { border-color: var(--ak-info); }
.bg-blue-600\\/\\[\\.08\\], .dark .bg-blue-400\\/10 { background: var(--ak-info-grund); }
.border-emerald-600, .dark .border-emerald-400 { border-color: var(--ak-gut); }
.bg-emerald-500\\/10 { background: var(--ak-gut-grund); }
.border-rose-500, .dark .border-rose-400 { border-color: var(--ak-fehler); }
.bg-rose-500\\/10 { background: var(--ak-fehler-grund); }
.text-rose-700, .dark .text-rose-300 { color: var(--ak-fehler-text); }
.text-sky-700, .dark .text-sky-300 { color: var(--ak-link); text-decoration: underline; text-underline-offset: 2px; }
.text-amber-400 { color: var(--ak-finale-text); }
`

mockup({
  name: 'design-regeln',
  titel: 'Design-Regeln – Farbrollen und Zustände',
  ausschnitt: 'design',
  faelle: [ALLE],
  varianten: { A: { ersatz: {}, stil: TAFEL, notiz: 'Vorher: heutige Klassen je Bauteil. Nachher: die Regeln aus docs/wissen/design-regeln.md.' } },
})

mockup({
  name: 'design-app',
  titel: 'Design-Regeln – ganze App (Woche)',
  ausschnitt: 'ganz',
  faelle: [ALLE],
  varianten: { A: { ersatz: {}, stil: APP, notiz: 'Nachher: Fokusring, Gewählt, Deaktiviert und Kennfarben nach den Regeln, über die echte App gelegt.' } },
})

mockup({
  name: 'design-filter',
  titel: 'Design-Regeln – Filterfenster',
  ausschnitt: 'filter',
  faelle: [ALLE],
  varianten: { A: { ersatz: {}, stil: APP, notiz: 'Nachher: Schnellfilter-Band in Info-Blau, Pillen in gut/fehler, Fokusring.' } },
})
