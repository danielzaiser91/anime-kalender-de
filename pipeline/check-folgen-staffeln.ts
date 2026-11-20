/**
 * Zusicherung (20.11.2026, Daniel: „aufteilen in einzelne Staffeln, statt alles in 1“): Führt die Detaildatei Staffelgrenzen (`s`), zeigt der
 * echte Folgenbereich Reiter je Staffel mit eigenem Deutsch-Stand; ohne `s` bleiben die Pakete zu 50. Fixture wie Pokémon Horizonte
 * (aniSearch-Liste 1–122, Staffeln 1–45, 46–89, 90–136, offen ab 137, deutsch 1–137). Läuft in `check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
import { staffelAbschnitte, staffelZeile, type StaffelZeile } from '../web/src/components/detail/folgen-staffeln.ts'
ignoriereCss()
const { FolgenBereich } = await import('../web/src/components/detail/folgen-bereich.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const F: [number, string][] = Array.from({ length: 122 }, (_, i) => [i + 1, `Folge ${i + 1}`])
const S: StaffelZeile[] = [[1, 1, 45], [2, 46, 89], [3, 90, 136], [4, 137]]
const DE: [number, number][] = [[1, 137]]
const imDe = (nr: number) => DE.some(([a, b]) => nr >= a && nr <= b)

/* Reine Funktion. */
const ab = staffelAbschnitte(S, F, DE, imDe)
pruefe('vier Abschnitte mit Folgenzahl 45/44/47/1', ab.map((a) => a.folgen.length).join() === '45,44,47,1', ab.map((a) => a.folgen.length))
pruefe('Deutsch je Staffel 45/44/47/1', ab.map((a) => a.deutsch).join() === '45,44,47,1', ab.map((a) => a.deutsch))
pruefe('Staffel 3 reicht über die Liste hinaus: Folge 123 ohne Titel, 136 am Ende', ab[2]!.folgen.find(([n]) => n === 123)?.[1] === '' && ab[2]!.folgen.at(-1)?.[0] === 136)
pruefe('Staffel 1 trägt die Titel der Liste', ab[0]!.folgen[0]?.[1] === 'Folge 1' && ab[0]!.folgen.at(-1)?.[0] === 45)
pruefe('offene Staffel bis zur höchsten deutschen Folge', ab[3]!.offen && ab[3]!.bis === 137 && !ab[0]!.offen)
pruefe('offene Staffel ohne Deutsch und ohne Liste: nur ihre erste Folge', staffelAbschnitte([[1, 1, 2], [2, 3]], [[1, ''], [2, '']], [], () => false)[1]!.bis === 3)
pruefe('offene Staffel folgt dem deutschen Bereich über Liste und Beginn hinaus', staffelAbschnitte([[1, 1, 2], [2, 3]], [[1, ''], [2, ''], [3, '']], [[1, 5]], () => true)[1]!.bis === 5)
pruefe('offene Staffel folgt der Liste, wo sie weiter reicht', staffelAbschnitte([[1, 1, 2], [2, 3]], [[1, ''], [5, '']], [], () => false)[1]!.bis === 5)
pruefe('Zeile geschlossene Staffel', staffelZeile(ab[1]!) === 'Folge 46–89 · 44 von 44 auf Deutsch', staffelZeile(ab[1]!))
pruefe('Zeile offene Staffel ohne „von N“', staffelZeile(ab[3]!) === 'ab Folge 137 · läuft · 1 auf Deutsch', staffelZeile(ab[3]!))
pruefe('Deutsch zählt nur belegte Folgen', staffelAbschnitte([[1, 1, 4]], [], [[2, 3]], (n) => n === 2 || n === 3)[0]!.deutsch === 2)
pruefe('ohne s keine Abschnitte', staffelAbschnitte(undefined, F, DE, imDe).length === 0 && staffelAbschnitte([], F, DE, imDe).length === 0)

/* Echte Komponente: Reiter, Kopfzahl, Zeile je Staffel; Gegenfall ohne `s`. */
const LISTEN: Record<string, unknown> = { 900501: { f: F, de: DE, s: S }, 900502: { f: F, de: DE } }
globalThis.fetch = (async (adresse: unknown) => {
  const url = String(adresse)
  const treffer = /folgen\/(\d+)\.json/.exec(url)
  const daten = url.includes('folgen/index.json') ? Object.keys(LISTEN).map(Number) : treffer ? LISTEN[treffer[1]!] : undefined
  return { ok: Boolean(daten), status: daten ? 200 : 404, json: async () => daten }
}) as unknown as typeof fetch

/** Rendert den Folgenbereich, klappt ihn auf, klickt optional einen Reiter und liefert Text und Reiter-Beschriftungen. */
async function bereich(id: number, reiterText?: string): Promise<{ text: string; reiter: string[] }> {
  const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(FolgenBereich, { titleId: id, wege: [] })))
  await act(async () => Promise.resolve())
  const knopf: MiniKnoten | undefined = dom.wurzel.finde((k) => k.tagName === 'BUTTON')[0]
  if (knopf) await act(async () => klicke(dom.wurzel, knopf))
  await act(async () => Promise.resolve())
  const reiterKnoepfe = () => dom.wurzel.finde((k) => k.getAttribute('role') === 'tab')
  const ziel = reiterText ? reiterKnoepfe().find((k) => (k.textContent ?? '').trim() === reiterText) : undefined
  if (ziel) await act(async () => klicke(dom.wurzel, ziel))
  const text = (dom.wurzel.textContent ?? '').replace(/\s+/g, ' ')
  const reiter = reiterKnoepfe().map((k) => (k.textContent ?? '').trim())
  await act(async () => wurzel.unmount())
  dom.entferne()
  return { text, reiter }
}

const mit = await bereich(900501)
pruefe('mit s: Reiter Staffel 1–4', mit.reiter.join() === 'Staffel 1,Staffel 2,Staffel 3,Staffel 4', mit.reiter)
pruefe('mit s: Kopf „Folgen (137)“ statt der Listenlänge 122', mit.text.includes('Folgen (137)'), mit.text.slice(0, 80))
pruefe('mit s: Staffel 1 gewählt, ihre Zeile steht da', mit.text.includes('Folge 1–45 · 45 von 45 auf Deutsch'))
pruefe('mit s: Folgen der Staffel 2 stehen nicht in Staffel 1', !/Folge 46(?!\d)/.test(mit.text) && /Folge 45(?!\d)/.test(mit.text))
const vier = await bereich(900501, 'Staffel 4')
pruefe('Reiter Staffel 4: offene Zeile und Folge 137', vier.text.includes('ab Folge 137 · läuft · 1 auf Deutsch') && vier.text.includes('137—'), vier.text.slice(-200))
const ohne = await bereich(900502)
pruefe('ohne s: Pakete zu 50 und Kopf mit Listenlänge', ohne.reiter.join() === '1–50,51–100,101–122' && ohne.text.includes('Folgen (122)'), ohne.reiter)
pruefe('ohne s: keine Staffelzeile', !ohne.text.includes('auf Deutsch'))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-folgen-staffeln: ok (Abschnitte, Reiter je Staffel, Gegenfall ohne s)')
