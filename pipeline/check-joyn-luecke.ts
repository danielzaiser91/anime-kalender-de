/**
 * Joyn-Lücke (04.11.2026): (1) Cartoons bekommen den Joyn-Weg aus JustWatch, im Bau über `schreibeCartoons`; (2) aniSearch-Titel behalten ihn
 * (`behalteNurHandbelegteWege`); (3) die reine Lückenregel des Bestandswächters samt Ratsche auf der Ausnahmeliste. Läuft auf einer
 * Kulisse im Temp-Ordner (`AK_ROOT`) mit erfundenen Titeln ab 900000.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StreamLink, Title } from '../shared/types.ts'

const wurzel = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'joyn-luecke-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })

let verletzt = 0
function erwarte(name: string, ok: boolean, info: unknown): void {
  if (!ok) verletzt++
  console.log(`  ${ok ? '✓' : '✖'} ${name}${ok ? '' : ` — ${JSON.stringify(info)}`}`)
}

const eintrag = (nr: number, o: Record<string, unknown>) => [
  String(-nr),
  { id: -nr, tmdbId: nr, titleEn: `Erfunden ${nr}`, genres: ['Animation'], anbieterDe: [], land: ['US'], studios: [], keywords: [], geholtAm: '2026-10-16', netzwerk: 'Netflix', ...o },
]
const roh = Object.fromEntries([
  eintrag(900001, {}),
  eintrag(900002, { anbieterDe: ['Joyn'] }),
  eintrag(900003, {}),
  eintrag(900004, {}),
  eintrag(900005, {}),
  eintrag(900006, { anbieterDe: ['Netflix'] }),
  eintrag(900007, {}),
])
const joyn = (url: string, art: string, anbieter = 'Joyn') => ({ anbieter, art, audio: [], url })
const jwBefund = (angebote: { anbieter?: string; art?: string; audio?: unknown[]; url?: string }[]) => ({ geprueftAm: '2026-10-26', tmdbId: 1, angebote })
const jw = {
  '-900001': jwBefund([joyn('https://www.joyn.de/serien/a-900001', 'ADS')]),
  '-900002': jwBefund([joyn('https://www.joyn.de/serien/b-900002', 'FLATRATE', 'Joyn Plus')]),
  '-900003': jwBefund([joyn('https://www.joyn.de/serien/c-900003', 'ADS')]),
  '-900004': jwBefund([{ anbieter: 'Netflix', art: 'FLATRATE', audio: [], url: 'https://www.netflix.com/title/900004' }]),
  '-900006': jwBefund([joyn('https://www.joyn.de/serien/f-900006', 'FLATRATE')]),
  '-900007': jwBefund([joyn('https://www.joyn.de/serien/g-900007', 'FREE')]),
}
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(roh))
writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(jw))
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
/* Ein Handbeleg „dort nicht abrufbar“ zur Joyn-Adresse von 900003. */
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  `- anilistId: -900003\n  title: "Erfunden 900003"\n  platform: joyn\n  url: https://www.joyn.de/serien/c-900003\n  available: false\n  checkedAt: '2026-10-12'\n`,
)

try {
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  const { joynLuecken, ordneAusnahmen } = await import('./lib/joyn-luecke.ts')
  const { behalteNurHandbelegteWege, joynAdressenVonJw } = await import('./lib/handbeleg-weg.ts')
  schreibeCartoons()
  const aus = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as { id: number; streams: StreamLink[] }[]
  const wege = (id: number) => aus.find((t) => t.id === id)?.streams ?? []
  const w1 = wege(-900001)
  erwarte('Cartoon mit JustWatch-Joyn (ADS) und ohne Weg bekommt Joyn, kostenlos', w1.length === 1 && w1[0].platform === 'joyn' && w1[0].url.endsWith('a-900001') && w1[0].zugang === 'kostenlos', w1)
  const w2 = wege(-900002)
  erwarte('Cartoon, dessen Joyn-Weg aus TMDB stammt, bekommt die Adresse und keinen zweiten Joyn-Weg', w2.length === 1 && w2[0].url.endsWith('b-900002'), w2)
  erwarte('Joyn Plus (FLATRATE) legt den Weg ohne Zugangsangabe an', wege(-900006).some((s) => s.platform === 'joyn' && s.zugang === undefined), wege(-900006))
  erwarte('FREE zählt wie ADS als kostenlos', wege(-900007).some((s) => s.platform === 'joyn' && s.zugang === 'kostenlos'), wege(-900007))
  const { ergaenzeCartoonJoyn } = await import('./bau/cartoon-joyn.ts')
  const probe = [{ id: 1, streams: [] }, { id: 2, streams: [] }, { id: 3, streams: [{ platform: 'joyn', url: '' }] }, { id: 4, streams: [] }] as unknown as Title[]
  const jwProbe = { 1: jwBefund([joyn('https://www.joyn.de/x1', 'ADS')]), 2: jwBefund([joyn('https://www.joyn.de/x2', 'ADS')]), 3: jwBefund([joyn('https://www.joyn.de/x3', 'ADS')]), 4: jwBefund([joyn('https://www.joyn.de/x4', 'ADS')]) }
  erwarte('Rückgabe zählt nur die ergänzten Wege (4 Titel, einer mit Weg)', ergaenzeCartoonJoyn(probe, jwProbe) === 3, probe)
  erwarte('Handbeleg „nicht abrufbar“ zur Adresse: kein Joyn-Weg', wege(-900003).length === 0, wege(-900003))
  erwarte('JustWatch ohne Joyn: kein Joyn-Weg', wege(-900004).length === 0, wege(-900004))
  erwarte('Ohne JustWatch-Eintrag: kein Joyn-Weg', wege(-900005).length === 0, wege(-900005))
  erwarte('Der Netflix-Weg von 900006 bleibt neben Joyn', wege(-900006).some((s) => s.platform === 'netflix'), wege(-900006))

  const titel = (id: number, streams: StreamLink[]) => ({ id, streams }) as unknown as Title
  const weg = (platform: string, url: string) => ({ platform, url }) as StreamLink
  const adressen = joynAdressenVonJw({
    1: { angebote: [{ anbieter: 'Joyn', url: 'https://www.joyn.de/filme/a' }, { anbieter: 'Netflix', url: 'https://www.netflix.com/title/1' }, { anbieter: 'Joyn' }] },
  })
  erwarte('Joyn-Adressen von JustWatch: nur Joyn, nur mit Adresse', adressen.size === 1 && adressen.has('https://www.joyn.de/filme/a'), [...adressen])
  const nurAni = titel(10_000_001, [weg('joyn', 'https://www.joyn.de/filme/a'), weg('joyn', 'https://www.joyn.de/filme/erraten'), weg('netflix', 'https://www.netflix.com/title/1')])
  behalteNurHandbelegteWege(nurAni, [], adressen)
  erwarte('aniSearch-Titel behält den Joyn-Weg, den JustWatch nennt; erratene Joyn- und andere Wege fallen', nurAni.streams.length === 1 && nurAni.streams[0].url.endsWith('/a') && nurAni.streams[0].herkunft === 'justwatch', nurAni.streams)
  const ohneJw = titel(10_000_002, [weg('joyn', 'https://www.joyn.de/filme/a')])
  behalteNurHandbelegteWege(ohneJw, [])
  erwarte('Ohne JustWatch-Adressen fällt der Joyn-Weg wie bisher', ohneJw.streams.length === 0, ohneJw.streams)
  const andere = titel(10_000_003, [weg('netflix', 'https://www.joyn.de/filme/a')])
  behalteNurHandbelegteWege(andere, [], adressen)
  erwarte('Dieselbe Adresse bei einer anderen Plattform trägt nichts', andere.streams.length === 0, andere.streams)

  const jwMix = { 1: jwBefund([joyn('https://www.joyn.de/x', 'ADS')]), 2: jwBefund([joyn('https://www.joyn.de/y', 'ADS')]), 3: jwBefund([{ anbieter: 'Joyn' }]), 4: jwBefund([]) }
  const bestand = [{ id: 1, streams: [] }, { id: 2, streams: [{ platform: 'joyn' }] }, { id: 3 }, { id: 4 }, { id: 5, streams: [{ platform: 'netflix' }] }]
  erwarte('Lückenregel: nur Joyn-Angebot mit Adresse und ohne Joyn-Weg', JSON.stringify(joynLuecken(bestand, jwMix)) === '[1]', joynLuecken(bestand, jwMix))
  erwarte('Lückenregel: negative Cartoon-Kennung zählt', JSON.stringify(joynLuecken([{ id: -7 }], { '-7': jwMix[1] })) === '[-7]', '')
  const o = ordneAusnahmen([1, 2, 3], [{ id: 2, grund: 'x' }, { id: 9, grund: 'y' }])
  erwarte('Ausnahmen: offen sind Lücken ohne Eintrag, veraltet Einträge ohne Lücke', JSON.stringify(o) === '{"offen":[1,3],"veraltet":[9]}', o)
  const liste = JSON.parse(readFileSync(join(process.cwd(), 'data', 'joyn-luecke-ausnahmen.json'), 'utf8')) as { id: number; grund: string }[]
  erwarte('Ratsche: höchstens 2 Ausnahmen (nur schrumpfen), jede mit Grund, keine Kennung doppelt', liste.length <= 2 && liste.every((a) => a.grund.length > 20) && new Set(liste.map((a) => a.id)).size === liste.length, liste)
} finally {
  if (!process.argv[2]) rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
console.log('\nOK — Joyn-Lücke: Cartoons, aniSearch-Titel, Lückenregel')
