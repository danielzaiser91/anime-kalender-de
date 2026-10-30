/**
 * Pille am Weg und Anbieter-Chip der Saison-Karte fragen dieselbe Funktion (`istLautAnbieter`, `shared/saison.ts`):
 * Ein sicherer Termin (Verfügbarkeit, Zeitungsmeldung) belegt die Tonspur nicht und hebt „Deutsch laut Anbieter“ nicht auf.
 * Fälle: die drei Titel, an denen beide Seiten auseinanderliefen (AniList 101004, 101347, 128893; Wege und Termine
 * wörtlich aus `public/data/titles.json` und `releases.json`, Stand 30.10.2026). Dororo und Jigokuraku sind danach per Handbeleg
 * (Anime2You nennt deutsche Synchronisation) belegt; ihre Fälle bleiben als eingefrorener Stand vor dem Handbeleg erhalten,
 * der heutige Stand steht in "Mit Handbeleg". Aufruf: `npm run check:logic`.
 */
import { anbieterChips, istLautAnbieter } from '../shared/saison.ts'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { streamStatus } from '../web/src/components/detail/legende-zeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const weg = (platform: string, url: string, extra: object = {}): StreamLink => ({ platform, url, zugang: 'abo', dub: true, ...extra }) as StreamLink
const termin = (platform: string, firstEpisodeDate: string, extra: object = {}): Release => ({ platform, releaseType: 'batch', schedule: { firstEpisodeDate, ...extra } }) as unknown as Release
const titelMit = (id: number, streams: StreamLink[]): Title => ({ id, streams }) as unknown as Title

/** Pille jeder Zeile der Anbieterkennung gegen den Chip: beide sagen „laut“ oder beide nicht. */
function pille(t: Title, releases: Release[], platform: string): boolean[] {
  return (t.streams ?? []).filter((s) => s.platform === platform && s.dub === true).map((s) => streamStatus(t, s, releases) === 'anbieter')
}
const chip = (t: Title, releases: Release[], platform: string): boolean | undefined => anbieterChips(t, releases).find((c) => c.platform === platform)?.laut

const FAELLE: { name: string; t: Title; releases: Release[]; platform: string }[] = [
  {
    name: '101004 Isekai Maou: Prime-Kanal erbt, Termin von MOTN',
    t: titelMit(101004, [
      weg('crunchyroll', 'http://www.crunchyroll.com/de/how-not-to-summon-a-demon-lord'),
      weg('primevideo', 'https://www.amazon.de/gp/video/detail/B0DV5RJM1Q', { dubAbgeleitet: 'kanal-erbt' }),
    ]),
    releases: [termin('primevideo', '2026-09-07', { episodeCount: 12, lastEpisodeDate: '2026-09-07' })],
    platform: 'primevideo',
  },
  {
    name: '101347 Dororo: Joyn pauschal, Termin aus anime2you',
    t: titelMit(101347, [weg('primevideo', 'https://www.amazon.de/gp/video/detail/B0B5M7HJ1K'), weg('joyn', 'https://www.joyn.de/serien/dororo', { dubAbgeleitet: 'joyn-pauschal' })]),
    releases: [termin('joyn', '2026-10-02', { episodeCount: 24 }), termin('tv', '2026-10-02')],
    platform: 'joyn',
  },
  {
    name: '128893 Jigokuraku: Joyn pauschal, Termin aus anime2you',
    t: titelMit(128893, [
      weg('crunchyroll', 'https://www.crunchyroll.com/de/series/GJ0H7Q5ZJ/hells-paradise'),
      weg('netflix', 'https://www.netflix.com/title/81574246'),
      weg('joyn', 'https://www.joyn.de/serien/hells-paradise', { dubAbgeleitet: 'joyn-pauschal' }),
    ]),
    releases: [termin('joyn', '2026-10-02', { episodeCount: 13 }), termin('crunchyroll', '2026-10-02')],
    platform: 'joyn',
  },
]

console.log('Pille und Chip: dieselbe Antwort an den drei Anlassfällen')
for (const f of FAELLE) {
  pruefe(`${f.name}: Pille „laut Anbieter“`, pille(f.t, f.releases, f.platform).every(Boolean), pille(f.t, f.releases, f.platform))
  pruefe(`${f.name}: Chip „laut Anbieter“`, chip(f.t, f.releases, f.platform) === true, chip(f.t, f.releases, f.platform))
  pruefe(`${f.name}: ohne den Termin dieselbe Antwort`, chip(f.t, [], f.platform) === chip(f.t, f.releases, f.platform))
  const belegt = f.t.streams?.find((s) => !s.dubAbgeleitet)
  pruefe(`${f.name}: belegter Weg bleibt ohne Kennzeichnung`, belegt !== undefined && chip(f.t, f.releases, belegt.platform) === false && streamStatus(f.t, belegt, f.releases) === 'belegt')
}

console.log('Mit Handbeleg (Stand nach data/dub-confirmed.yaml): Joyn-Weg ohne dubAbgeleitet ist belegt, Pille und Chip ohne Kennzeichnung')
for (const f of FAELLE.filter((x) => x.platform === 'joyn')) {
  const belegt = titelMit(f.t.id, (f.t.streams ?? []).map((s) => (s.platform === 'joyn' ? weg('joyn', s.url) : s)))
  pruefe(`${f.name}: Chip ohne Kennzeichnung`, chip(belegt, f.releases, 'joyn') === false, chip(belegt, f.releases, 'joyn'))
  pruefe(`${f.name}: Pille „belegt“`, belegt.streams?.every((s) => streamStatus(belegt, s, f.releases) === 'belegt') === true)
}

console.log('istLautAnbieter direkt')
pruefe('dub true und abgeleitet: laut', istLautAnbieter({ dub: true, dubAbgeleitet: 'joyn-pauschal' }) === true)
pruefe('dub true ohne Ableitung: nicht laut', istLautAnbieter({ dub: true }) === false)
pruefe('dub false mit Ableitung: nicht laut', istLautAnbieter({ dub: false, dubAbgeleitet: 'joyn-pauschal' }) === false)
pruefe('dub fehlt mit Ableitung: nicht laut', istLautAnbieter({ dubAbgeleitet: 'kanal-erbt' }) === false)

console.log('Grenzen des Chips')
{
  const joyn = weg('joyn', 'https://www.joyn.de/serien/x', { dubAbgeleitet: 'joyn-pauschal' })
  pruefe('Anbieter nur aus Termin, ohne Tonspur-Weg: nicht „laut“', chip(titelMit(900800, []), [termin('disneyplus', '2026-10-02')], 'disneyplus') === false)
  pruefe('Ankündigung ohne Weg: nicht „laut“', chip({ id: 900801, streams: [], ankuendigung: { synchro: 'angekuendigt', platform: 'netflix' } } as unknown as Title, [], 'netflix') === false)
  pruefe('geschätzter Termin ändert nichts: „laut“', chip(titelMit(900802, [joyn]), [termin('joyn', '2026-10-02', { estimated: true })], 'joyn') === true)
  pruefe('abgeleiteter und belegter Weg beim selben Anbieter: nicht „laut“', chip(titelMit(900803, [joyn, weg('joyn', 'https://www.joyn.de/serien/y')]), [], 'joyn') === false)
  pruefe('Weg ohne Tonspur-Beleg (dub fehlt) zählt nicht als Chip', chip(titelMit(900804, [{ ...joyn, dub: undefined }]), [], 'joyn') === undefined)
}

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ Pille und Chip „laut Anbieter“: dieselbe Funktion, drei Anlassfälle, Handbeleg, Funktion direkt und fünf Grenzen ok')
