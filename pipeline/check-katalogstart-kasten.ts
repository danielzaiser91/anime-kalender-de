/**
 * Zwischenform des Antwort-Kastens am Starttag eines Katalogstarts ohne Uhrzeit (Bass X Machina, Netflix, 03.11.2026) an der echten
 * Komponente `AntwortKasten`: ab 00:00 „Alle 6 Folgen heute, Uhrzeit offen" statt „6 von 6", Netflix-Pille samt „Deutsch" sichtbar,
 * keine Leiste; ab dem Folgetag „Alle 6 Folgen auf Deutsch". Die Logik der Antwort prüft `check-katalogstart-tag.ts`.
 * Aufruf: npx tsx pipeline/check-katalogstart-kasten.ts
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Release, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { AntwortKasten } = await import('../web/src/components/detail/antwort-kasten.tsx')
const { translate } = await import('../web/src/lib/i18n.tsx')

let verletzt = 0
let gezaehlt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gezaehlt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const echteAbfrage = globalThis.fetch
globalThis.fetch = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch

const titel = {
  id: 900401,
  slug: 'x900401',
  format: 'TV',
  jpYear: 2026,
  episodes: 6,
  hasVoices: true,
  watchLinks: [],
  titleDe: 'Katalogkasten',
  streams: [{ platform: 'netflix', url: 'https://x/n', dub: true, dubRanges: [{ from: 1, to: 6, dub: true }] }],
} as unknown as Title
const release = (time?: string): Release =>
  ({ slug: 'k900401-netflix', titleId: 900401, name: 'Katalogkasten', platform: 'netflix', releaseType: 'batch', year: 2026, sources: ['https://example.org/a'], schedule: { firstEpisodeDate: '2026-11-03', time, episodeCount: 6 } }) as unknown as Release

/** Rendert Kasten und liefert Text und Teilbalken-Anzeige. */
async function kasten(heute: string, jetzt: string, time?: string, art = 'batch'): Promise<{ text: string; balken: boolean }> {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const rs = [{ ...release(time), releaseType: art } as Release]
  const antwort = berechneAntwort({ title: titel, releases: rs, today: heute, jetzt: new Date(jetzt) })!
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(h(AntwortKasten, { antwort, title: titel, t: translate as never, today: heute, releases: rs, stream: [h('span', { key: 'n' }, 'PILLE-NETFLIX-DE')] }))
  })
  await act(async () => {
    await Promise.resolve()
  })
  const text = (k: MiniKnoten): string => (k.textContent ?? '').replace(/\s+/g, ' ')
  const ergebnis = { text: text(dom.wurzel), balken: dom.wurzel.finde((k) => /%$/.test(String(k.style.width))).length > 0 }
  await act(async () => wurzel.unmount())
  dom.entferne()
  return ergebnis
}

const nachts = await kasten('2026-11-03', '2026-11-02T23:30:00Z')
pruefe('00:30 ohne Uhrzeit: „Alle 6 Folgen heute, Uhrzeit offen“', nachts.text.includes('Alle 6 Folgen heute, Uhrzeit offen'), nachts.text)
pruefe('00:30 ohne Uhrzeit: kein „6 von 6“, kein „Alle 6 Folgen auf Deutsch“', !nachts.text.includes('6 von 6') && !nachts.text.includes('Alle 6 Folgen auf Deutsch'), nachts.text)
pruefe('00:30 ohne Uhrzeit: Netflix-Pille samt Sprachhinweis sichtbar', nachts.text.includes('PILLE-NETFLIX-DE'), nachts.text)
pruefe('00:30 ohne Uhrzeit: keine Fortschrittsleiste', !nachts.balken)

const abends = await kasten('2026-11-03', '2026-11-03T21:00:00Z')
pruefe('22:00 ohne Uhrzeit: weiter die Zwischenform', abends.text.includes('Uhrzeit offen'), abends.text)

const folgetag = await kasten('2026-11-04', '2026-11-04T10:00:00Z')
pruefe('Folgetag: „Alle 6 Folgen auf Deutsch“, ohne „Uhrzeit offen“', folgetag.text.includes('Alle 6 Folgen auf Deutsch') && !folgetag.text.includes('Uhrzeit offen'), folgetag.text)

const mitZeit = await kasten('2026-11-03', '2026-11-03T21:00:00Z', '09:00')
pruefe('Mit Uhrzeit 09:00, 22:00: „Alle 6 Folgen auf Deutsch“, ohne „Uhrzeit offen“', mitZeit.text.includes('Alle 6 Folgen auf Deutsch') && !mitZeit.text.includes('Uhrzeit offen'), mitZeit.text)

/* Kontrolle: Beim Wochentakt ohne Uhrzeit (laeuft, 0) bleibt die Stream-Pille verborgen — die Pille oben ist also keine Selbstverständlichkeit. */
const woche = await kasten('2026-11-03', '2026-11-02T23:30:00Z', undefined, 'weekly')
pruefe('Wochentakt ohne Uhrzeit, 00:30: Pille verborgen, keine Zwischenform', !woche.text.includes('PILLE-NETFLIX-DE') && !woche.text.includes('Uhrzeit offen'), woche.text)

globalThis.fetch = echteAbfrage
if (verletzt > 0) process.exit(1)
console.log(`✓ Katalogstart-Kasten: ${gezaehlt} Fälle (Zwischenform nachts/abends, Folgetag, mit Uhrzeit, Pille, Leiste)`)
process.exit(0)
