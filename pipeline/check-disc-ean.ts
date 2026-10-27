/**
 * Kauflink einer Disc: Handlink > EAN-Suche > Namenssuche (27.10.2026). Rechenregel (`discEan`, `discKaufUrl`), Linkart (`amazonLinkArt`)
 * und der echte Bau-Aufruf (`baueReleases` gegen einen Wegwerf-Ordner über `AK_ROOT`, Kulissen-Dateien ohne Bezug zu `public/data`).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { amazonEanUrl, amazonLinkArt } from '../shared/plattform-suche.ts'
import type { DiscIndex } from './lib/disc-ean.ts'

// `AK_ROOT` muss stehen, bevor `util.ts` geladen wird (liest ihn beim Import) — darum erst danach importieren.
const wurzel = mkdtempSync(join(tmpdir(), 'disc-ean-'))
process.env.AK_ROOT = wurzel
const { discEan, discKaufUrl } = await import('./lib/disc-ean.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TAG = '2026-12-18'
const aus = (nr: number, format: string, kurz = 'Box 01', datum = TAG) => ({ datum, format, kurz, url: `https://www.anisearch.de/article/${nr},x` })
const art = (ean: string | undefined, medium: string, publisher = 'Crunchyroll', umfang = 'Cour / Box') => ({ ean, medium, publisher, umfang })

// Conan Box 1 (30th): Artikel 216718 Blu-ray und 216719 DVD, wörtlich aus `data/anisearch-artikel.json` / `disc-ausgaben.json`.
const conan: DiscIndex = {
  ausgaben: { '900301': [aus(216719, 'DVD'), aus(216718, 'Blu-ray')] },
  artikel: { '216718': art('7630017545978', 'Blu-ray'), '216719': art('7630017546005', 'DVD') },
}
const mit = (ausgaben: DiscIndex['ausgaben'], artikel: DiscIndex['artikel']): DiscIndex => ({ ausgaben, artikel })

console.log('\nEAN der Ausgabe:')
pruefe('Blu-ray und DVD derselben Ausgabe: die Blu-ray-EAN (Conan Box 1)', discEan(conan, 900301, TAG) === '7630017545978', discEan(conan, 900301, TAG))
pruefe('Reihenfolge der Ausgaben ist gleichgültig', discEan(mit({ '900301': [...conan.ausgaben['900301']!].reverse() }, conan.artikel), 900301, TAG) === '7630017545978')
pruefe('anderer Tag → keine EAN', discEan(conan, 900301, '2026-12-19') === undefined)
pruefe('anderer Titel → keine EAN', discEan(conan, 900302, TAG) === undefined)
pruefe('ohne Titelkennung → keine EAN', discEan(conan, undefined, TAG) === undefined)
pruefe('nur DVD mit EAN: genau eine EAN genügt', discEan(mit({ '1': [aus(1, 'DVD')] }, { '1': art('4020628531904', 'DVD') }), 1, TAG) === '4020628531904')
pruefe('zwei Ausgaben am selben Tag (andere Bezeichnung) → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray', 'Box 01'), aus(2, 'Blu-ray', 'Box 02')] }, { '1': art('111111111111', 'Blu-ray'), '2': art('222222222222', 'Blu-ray') }), 1, TAG) === undefined)
pruefe('zwei Blu-rays gleicher Bezeichnung mit verschiedener EAN → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray'), aus(2, 'Blu-ray')] }, { '1': art('111111111111', 'Blu-ray'), '2': art('222222222222', 'Blu-ray') }), 1, TAG) === undefined)
pruefe('gleiche Bezeichnung, anderer Verlag → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray'), aus(2, 'DVD')] }, { '1': art('111111111111', 'Blu-ray', 'A'), '2': art('222222222222', 'DVD', 'B') }), 1, TAG) === undefined)
pruefe('gleiche Bezeichnung, anderer Umfang → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray'), aus(2, 'DVD')] }, { '1': art('111111111111', 'Blu-ray', 'A', 'Box'), '2': art('222222222222', 'DVD', 'A', 'Einzelnes Vol.') }), 1, TAG) === undefined)
pruefe('Artikel ohne EAN → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray')] }, { '1': art(undefined, 'Blu-ray') }), 1, TAG) === undefined)
pruefe('Artikel unbekannt → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray')] }, {}), 1, TAG) === undefined)
pruefe('keine Ziffern als EAN → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray')] }, { '1': art('abc', 'Blu-ray') }), 1, TAG) === undefined)
pruefe('Blu-ray der Box 01 und DVD der Box 02 (gleicher Verlag und Umfang) → keine EAN', discEan(mit({ '1': [aus(1, 'Blu-ray', 'Box 01'), aus(2, 'DVD', 'Box 02')] }, { '1': art('111111111111', 'Blu-ray'), '2': art('222222222222', 'DVD') }), 1, TAG) === undefined)
const eanLaenge = (ean: string) => discEan(mit({ '1': [aus(1, 'DVD')] }, { '1': art(ean, 'DVD') }), 1, TAG)
pruefe('EAN-Länge: 8 und 14 Ziffern gelten, 7 und 15 nicht', eanLaenge('12345678') === '12345678' && eanLaenge('12345678901234') === '12345678901234' && eanLaenge('1234567') === undefined && eanLaenge('123456789012345') === undefined, [eanLaenge('12345678'), eanLaenge('12345678901234'), eanLaenge('1234567'), eanLaenge('123456789012345')])
pruefe('Blu-ray ohne EAN, DVD mit EAN: die DVD-EAN', discEan(mit({ '1': [aus(1, 'Blu-ray'), aus(2, 'DVD')] }, { '1': art(undefined, 'Blu-ray'), '2': art('222222222222', 'DVD') }), 1, TAG) === '222222222222')

console.log('\nKauflink (reihenfolge Handlink > EAN > Name):')
const dp = 'https://www.amazon.de/dp/B0HGB36K4K'
const link = (e: { buyUrl?: string; releaseType: string }) => discKaufUrl(e, 900301, TAG, 'Detektiv Conan – Box 1', conan)
pruefe('Handlink gewinnt vor der EAN', link({ buyUrl: dp, releaseType: 'disc' }) === dp)
pruefe('Disc mit EAN: EAN-Suche', link({ releaseType: 'disc' }) === 'https://www.amazon.de/s?k=7630017545978', link({ releaseType: 'disc' }))
const ohneEan = discKaufUrl({ releaseType: 'disc' }, 900399, TAG, 'Nur Name', conan)
pruefe('Disc ohne EAN: Namenssuche', ohneEan === `https://www.amazon.de/s?k=${encodeURIComponent('Nur Name Anime Blu-ray')}`, ohneEan)
pruefe('kein Disc-Termin: nichts erfunden', link({ releaseType: 'weekly' }) === undefined)
pruefe('kein Disc-Termin: Handlink bleibt', link({ buyUrl: dp, releaseType: 'weekly' }) === dp)

console.log('\nLinkart:')
pruefe('EAN-Suche', amazonLinkArt(amazonEanUrl('7630017545978')) === 'ean')
pruefe('Namenssuche', amazonLinkArt('https://www.amazon.de/s?k=Detektiv%20Conan%20Anime%20Blu-ray') === 'name')
pruefe('Suche mit Ziffern im Namen ist keine EAN', amazonLinkArt('https://www.amazon.de/s?k=Mob%20Psycho%20100') === 'name')
pruefe('zu kurze Ziffernfolge ist keine EAN', amazonLinkArt('https://www.amazon.de/s?k=1234567') === 'name')
pruefe('EAN mit Zusatz (&i=…) bleibt EAN', amazonLinkArt('https://www.amazon.de/s?k=7630017545978&i=dvd') === 'ean')
pruefe('15 Ziffern oder Ziffern mit Buchstaben dahinter sind keine EAN', amazonLinkArt('https://www.amazon.de/s?k=123456789012345') === 'name' && amazonLinkArt('https://www.amazon.de/s?k=7630017545978abc') === 'name' && amazonLinkArt('https://www.amazon.de/s?k=abc7630017545978') === 'name')
pruefe('Produktseite', amazonLinkArt(dp) === 'produkt')
pruefe('anderer Shop und leer', amazonLinkArt('https://www.akibapassshop.de/x') === undefined && amazonLinkArt(undefined) === undefined)

console.log('\nBau (baueReleases gegen Wegwerf-Ordner):')
{
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'disc-ausgaben.json'), JSON.stringify(conan.ausgaben))
  writeFileSync(join(wurzel, 'data', 'anisearch-artikel.json'), JSON.stringify(conan.artikel))
  try {
    const { baueReleases } = await import('./bau/05-releases.ts')
    const eintrag = (slug: string, extra: object = {}) => ({ slug, platform: 'disc', releaseType: 'disc', titleDe: slug, schedule: { firstEpisodeDate: TAG }, sources: [], ...extra })
    const curated = [eintrag('mit-ean'), eintrag('mit-hand', { buyUrl: dp }), eintrag('ohne-titel-ausgabe'), eintrag('anderer-tag', { schedule: { firstEpisodeDate: '2026-12-25' } })]
    const { releases } = baueReleases({
      curated: curated as never,
      curatedIds: { 'mit-ean': 900301, 'mit-hand': 900301, 'ohne-titel-ausgabe': 900399, 'anderer-tag': 900301 },
      titles: new Map(),
      tmdb: {},
      anisearchEpisodes: () => undefined,
      findCrunchyroll: () => undefined,
      crKalenderBis: undefined,
      crunchyroll: { window: { from: '2026-01-01', to: '2027-01-01' }, entries: [] } as never,
    })
    const url = (slug: string) => releases.find((r) => r.slug === slug)?.buyUrl
    pruefe('Bau: Disc mit eindeutiger EAN → EAN-Suche', url('mit-ean') === 'https://www.amazon.de/s?k=7630017545978', url('mit-ean'))
    pruefe('Bau: Handlink bleibt', url('mit-hand') === dp, url('mit-hand'))
    pruefe('Bau: Titel ohne Ausgabe → Namenssuche', amazonLinkArt(url('ohne-titel-ausgabe')) === 'name', url('ohne-titel-ausgabe'))
    pruefe('Bau: anderer Tag → Namenssuche', amazonLinkArt(url('anderer-tag')) === 'name', url('anderer-tag'))
    pruefe('Bau: alle vier Releases entstanden', releases.length === 4, releases.length)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

console.log(`\nDisc-EAN: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
