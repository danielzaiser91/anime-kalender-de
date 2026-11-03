/**
 * Regel „Gesamtzahl unbelegt → nirgends „von M““ (Daniel, 02.11.2026) an der echten Komponente `AntwortKasten`: der Hook
 * `useFolgenZaehlung` holt `[alle, deutsch]` aus einer Attrappe-Abfrage, die Überschrift des „fertig“-Kastens muss das „von M“
 * nur zeigen, wenn ein Release die Zahl belegt. Fälle: Beyblade X (nur gesichtet), Aristocrat/PSYREN (nur angenommen), Ramparts
 * of Ice (Netflix ohne Zahl), Gegenfall mit belegter Zahl, belegt bei einem Anbieter und gesichtet beim anderen.
 * Aufruf: npx tsx pipeline/check-folgenzahl-kasten.ts
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

const HEUTE = '2026-10-21'
const JETZT = new Date('2026-10-21T12:00:00Z')
/* Eine Zählung je Probetitel (ab 900300): [alle Folgen laut Liste, Folgen mit deutscher Synchro]. */
const ZAEHLUNG: Record<string, [number, number]> = { 900303: [12, 3] }
const echteAbfrage = globalThis.fetch
globalThis.fetch = (async (adresse: unknown) => {
  const ok = String(adresse).includes('folgen/zaehlung.json')
  return { ok, status: ok ? 200 : 404, json: async () => ZAEHLUNG }
}) as unknown as typeof fetch

const titel = (id: number): Title =>
  ({ id, slug: `x${id}`, format: 'TV', jpYear: 2025, hasVoices: true, watchLinks: [], titleDe: `Probe ${id}`, streams: [{ platform: 'netflix', url: 'https://x/n', dub: true }] }) as unknown as Title
const release = (id: number, platform: string, schedule: object): Release =>
  ({ slug: `p${id}-${platform}`, titleId: id, name: 'Probe', platform, releaseType: 'weekly', year: 2026, sources: ['https://example.org/a'], schedule: { firstEpisodeDate: '2026-01-01', ...schedule } }) as unknown as Release

/** Ob der Fortschrittsbalken des letzten Renders einen Teilstand (nicht 100 %) zeigt. */
let teilBalken = false

/** Rendert die Komponente samt Hook und liefert den Text des Kastens. */
async function kastenText(id: number, rs: Release[], tt?: Title): Promise<string> {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const t = tt ?? titel(id)
  const antwort = berechneAntwort({ title: t, releases: rs, today: HEUTE, jetzt: JETZT })!
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(h(AntwortKasten, { antwort, title: t, t: translate as never, today: HEUTE, releases: rs }))
  })
  await act(async () => {
    await Promise.resolve()
  })
  const text = (k: MiniKnoten): string => (k.textContent ?? '').replace(/\s+/g, ' ')
  const ergebnis = text(dom.wurzel)
  teilBalken = dom.wurzel.finde((k) => /%$/.test(String(k.style.width)) && k.style.width !== '100%').length > 0
  await act(async () => wurzel.unmount())
  dom.entferne()
  return ergebnis
}

const mitBereich = (id: number): Title =>
  ({ ...titel(id), streams: [], watchLinks: [{ name: 'Crunchyroll', url: 'https://x/c', kind: 'stream', zugang: 'abo', dub: true, dubRanges: [{ from: 1, to: 3, dub: true }] }] }) as unknown as Title
const gesichtetSchedule = { episodeCount: 20, episodeCountAssumed: true, episodeCountNurGesichtet: true }
const hat = (text: string, teil: string) => text.includes(teil)

/* Pfad „teilweise“: der Kasten nennt „N von M“ nur mit belegtem M. */
const angenommen = await kastenText(900302, [release(900302, 'crunchyroll', { episodeCount: 12, episodeCountAssumed: true })], mitBereich(900302))
pruefe('Aristocrat/PSYREN (12 nur angenommen): „3 Folgen auf Deutsch“ ohne „von 12“', hat(angenommen, '3 Folgen auf Deutsch') && !hat(angenommen, 'von 12'), angenommen)

const balkenAngenommen = teilBalken
pruefe('12 nur angenommen: kein Teilbalken (Anteil an unbelegtem M)', !balkenAngenommen, balkenAngenommen)

const belegt = await kastenText(900304, [release(900304, 'crunchyroll', { episodeCount: 12 })], mitBereich(900304))
pruefe('Gegenfall, Zahl belegt: „3 von 12 Folgen auf Deutsch“ bleibt, der Balken zeigt den Teilstand', hat(belegt, '3 von 12 Folgen auf Deutsch') && teilBalken, { belegt, teilBalken })

const nurGesichtet = await kastenText(900306, [release(900306, 'crunchyroll', { episodeCount: 20, episodeCountNurGesichtet: true })], mitBereich(900306))
pruefe('nur gesichtet, ohne Annahme-Vermerk: „3 Folgen auf Deutsch“ ohne „von 20“', hat(nurGesichtet, '3 Folgen auf Deutsch') && !hat(nurGesichtet, 'von 20'), nurGesichtet)

const anilist = await kastenText(900307, [release(900307, 'crunchyroll', { episodeCount: 12, episodeCountAssumed: true })], { ...mitBereich(900307), episodes: 12 } as Title)
pruefe('AniList kennt 12 Folgen: „3 von 12 Folgen auf Deutsch“ bleibt', hat(anilist, '3 von 12 Folgen auf Deutsch'), anilist)

const sichtung = await kastenText(900301, [release(900301, 'crunchyroll', gesichtetSchedule)], mitBereich(900301))
pruefe('Beyblade-Art (nur gesichtet): „3 Folgen auf Deutsch“ ohne „von 20“', hat(sichtung, '3 Folgen auf Deutsch') && !hat(sichtung, 'von 20'), sichtung)

const gemischt = await kastenText(900305, [release(900305, 'crunchyroll', gesichtetSchedule), release(900305, 'netflix', { episodeCount: 20 })], mitBereich(900305))
pruefe('belegt bei einem Anbieter, gesichtet beim anderen: „3 von M“ steht', /3 von \d+ Folgen auf Deutsch/.test(gemischt), gemischt)

/* Pfad „fertig“ über die Folgenliste: M aus der Listenlänge ist keine Gesamtzahl. */
const netflixOhneZahl = await kastenText(900303, [release(900303, 'netflix', { firstEpisodeDate: '2026-01-01' })])
pruefe('Ramparts of Ice S2 (Netflix ohne Zahl, M nur aus der Liste): „3 Folgen auf Deutsch“ ohne „von 12“', hat(netflixOhneZahl, '3 Folgen auf Deutsch') && !hat(netflixOhneZahl, 'von 12'), netflixOhneZahl)

globalThis.fetch = echteAbfrage
if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-folgenzahl-kasten: ${gezaehlt} Zusicherungen erfüllt (Kasten: angenommen, gesichtet, belegt, gemischt, Netflix ohne Zahl)`)
