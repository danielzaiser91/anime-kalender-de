/**
 * Die echte `OhneWegHinweis` (Mini-DOM, Attrappe-fetch): Die Datei `ohne-weg.json` wird erst für einen Titel ohne Streaming-Weg geladen
 * (Erstaufruf-Budget ±0), einmal für alle Titel, und die Zeile gehört immer dem offenen Titel. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
ignoriereCss()
const { OhneWegHinweis } = await import('../web/src/components/detail/ohne-weg.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const DATEI = {
  900001: { reason: 'kein-dub', checkedAt: '2026-10-26', source: 'handbeleg' },
  900002: { reason: 'nur-kauf', checkedAt: '2026-11-17', source: 'justwatch' },
  900003: { reason: 'offen' },
  900004: { reason: 'angekuendigt', ab: '2999-01-01', source: 'termin' },
}
const titel = (id: number, extra: Record<string, unknown> = {}) => ({ id, streams: [], ...extra }) as unknown as Title

const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const abrufe: string[] = []
const antwort = {
  ok: true,
  status: 200,
  json: async () => DATEI,
  text: async () => JSON.stringify(DATEI),
}
const g = globalThis as unknown as Record<string, unknown>
g.fetch = async (a: string) => {
  abrufe.push(a)
  return antwort
}
const wurzel = createRoot(dom.wurzel as unknown as Element)
const zeige = async (title: Title) => {
  await act(async () => {
    wurzel.render(h(OhneWegHinweis, { title }))
  })
  const zeile = dom.wurzel.finde((k) => k.getAttribute('data-ohne-weg') !== null)[0]
  return zeile ? { grund: zeile.getAttribute('data-ohne-weg'), text: zeile.textContent } : undefined
}

console.log('\nOhneWegHinweis')
pruefe('Titel mit Stream: keine Zeile, kein Abruf', (await zeige(titel(900001, { streams: [{ platform: 'netflix' }] }))) === undefined && abrufe.length === 0, abrufe)
pruefe('Titel mit Kauf-Weg zählt als ohne Streaming: Zeile da', (await zeige(titel(900001, { watchLinks: [{ kind: 'buy' }] })))?.grund === 'kein-dub')
pruefe('Ein Abruf von ohne-weg.json', abrufe.length === 1 && abrufe[0]!.includes('data/ohne-weg.json'), abrufe)
const zwei = await zeige(titel(900002))
pruefe('Zweiter Titel: eigener Satz, kein zweiter Abruf', zwei?.grund === 'nur-kauf' && zwei.text === 'Laut JustWatch nur zum Kaufen oder Leihen, geprüft am 17.11.2026.' && abrufe.length === 1, { zwei, abrufe })
pruefe('Grund offen: Satz ohne Datum', (await zeige(titel(900003)))?.text === 'Ein Streaming-Angebot ist noch nicht belegt.')
pruefe('Grund angekuendigt: keine Zeile (Starttag steht schon im Kasten)', (await zeige(titel(900004))) === undefined)
pruefe('Titel ohne Eintrag: keine Zeile', (await zeige(titel(900009))) === undefined)
pruefe('Zurück auf einen Titel mit Stream: Zeile weg', (await zeige(titel(900001, { streams: [{ platform: 'netflix' }] }))) === undefined)

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-panel: Datei nur für Titel ohne Weg, einmal geladen, Zeile gehört dem offenen Titel')
