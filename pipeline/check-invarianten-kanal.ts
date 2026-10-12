/** Gegenproben zu D-25 (`lib/invarianten-kanal.ts`): Hell Mode, ein Kanal-Titel, dessen Prime-Seite Amazons Sprachangabe trägt. */
import type { StreamLink, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import { kanalTitelOhneBeleg, kanalWegEntfernt } from './lib/invarianten-kanal.ts'
import { kanalAdressenOhneAussage, kanalAdressenOhneBeleg, ohneKanalSprache, belegOhneGenaueAdresse, rohDeutsch, traegtAussage } from './lib/kanal-titel.ts'
import { hatWegOderErsetztSuche } from './lib/weg-aus-beleg.ts'

type Pruefe = (name: string, ok: boolean, gefunden?: unknown) => void

export function kanalProben(pruefe: Pruefe): void {
  const hellUrl = 'https://www.amazon.de/gp/video/detail/B0FTW7GP47'
  const hellBeleg = { anilistId: 185262, platform: 'primevideo', url: hellUrl, dub: true, checkedAt: '2026-08-30', note: 'Abos: animedigitalde, aniversede — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg' } as DubCheck
  const hellKanal = kanalAdressenOhneBeleg([ohneKanalSprache(hellBeleg)])
  const hell = (dub?: boolean, extra: Record<string, unknown> = {}) =>
    [{ id: 185262, titleRomaji: 'Hell Mode', streams: [{ platform: 'primevideo', url: hellUrl.replace('/gp/video/detail/', '/dp/'), dub }], ...extra } as unknown as Title]
  const keine = () => false
  pruefe('D-25: Kanal-Titel verliert Amazons Sprachangabe beim Lesen', ohneKanalSprache(hellBeleg).dub === undefined && hellKanal.size === 1)
  pruefe('D-25: Kanal-Titel mit zweiter Quelle behält das Ja', ohneKanalSprache({ ...hellBeleg, zweiteQuelle: 'JustWatch: audio de' }).dub === true)
  pruefe('D-25: ohne Kanal-Warnung bleibt das Ja', ohneKanalSprache({ ...hellBeleg, note: 'Abos: Prime' }).dub === true)
  pruefe('D-25: Prime-Verweis ✓ Deutsch auf einer Kanal-Adresse wird gemeldet', kanalTitelOhneBeleg(hell(true), hellKanal, keine).length === 1)
  pruefe('D-25: Verweis ohne Urteil geht durch', kanalTitelOhneBeleg(hell(undefined), hellKanal, keine).length === 0)
  pruefe('D-25: fremde Adresse geht durch', kanalTitelOhneBeleg(hell(true), new Set(['185262|amazon:b0xxxxxxxx']), keine).length === 0)
  pruefe('D-25: dieselbe Seite bei einem anderen Titel geht durch', kanalTitelOhneBeleg(hell(true), new Set(['999|amazon:b0ftw7gp47']), keine).length === 0)
  pruefe('D-25: eine andere Quelle des Titels (Termin, aniSearch) geht durch', kanalTitelOhneBeleg(hell(true), hellKanal, () => true).length === 0)
  pruefe('D-25: eine deutsche Erstausgabe geht durch', kanalTitelOhneBeleg(hell(true, { deErstausgabe: { von: '2026-01-10' } }), hellKanal, keine).length === 0)
  const deutsch = [{ sprachen: ['Deutsch', 'Japanisch'] }]
  const lader = [ohneKanalSprache(hellBeleg)]
  pruefe('D-25: gemeldete Folgen auf einer Kanal-Seite belegen kein Deutsch', rohDeutsch(deutsch, 185262, hellUrl, lader) === false)
  pruefe('D-25: gemeldete Folgen auf einer anderen Seite belegen Deutsch', rohDeutsch(deutsch, 185262, 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA', lader) === true)
  pruefe('D-25: gemeldete Folgen ohne Deutsch belegen nichts', rohDeutsch([{ sprachen: ['Japanisch'] }], 185262, null, []) === undefined)
  const andere = 'https://www.amazon.de/gp/video/detail/B0AAAAAAAA'
  const fremdesNein = { anilistId: 185262, platform: 'primevideo', url: 'https://www.amazon.de/gp/video/detail/B0CFL5Y7XN', dub: false, checkedAt: '2026-09-01' } as DubCheck
  pruefe('belegFuer: ein Nein zu einer anderen Adresse gilt für die Kanal-Zeile nicht', belegOhneGenaueAdresse([fremdesNein], 1, lader, 185262, hellUrl) === undefined)
  pruefe('belegFuer: ohne Kanal-Zeile bleibt der Rückfall bei einem Weg', belegOhneGenaueAdresse([fremdesNein], 1, lader, 185262, andere) === fremdesNein)
  pruefe('belegFuer: ab zwei Wegen gibt der Rückfall nichts', belegOhneGenaueAdresse([fremdesNein], 2, lader, 185262, andere) === undefined)
  const stumm = kanalAdressenOhneAussage([ohneKanalSprache(hellBeleg)])
  const entfernt = (url: string, plattform = 'primevideo') => [{ titleId: 185262, plattform, url, grund: 'belegtes Nein' }]
  pruefe('D-26: Kanal-Weg ohne eigene Aussage in verweise-entfernt wird gemeldet', kanalWegEntfernt(entfernt(hellUrl), stumm).length === 1)
  pruefe('D-26: andere Adresse des Titels geht durch', kanalWegEntfernt(entfernt('https://www.amazon.de/gp/video/detail/B0AAAAAAAA'), stumm).length === 0)
  pruefe('D-26: anderer Anbieter geht durch', kanalWegEntfernt(entfernt(hellUrl, 'netflix'), stumm).length === 0)
  pruefe('D-26: Kanal-Zeile mit eigenem Nein ist nicht stumm', kanalAdressenOhneAussage([{ ...ohneKanalSprache(hellBeleg), dub: false }]).size === 0)
}

/** Die Fälle vom 12.10.2026 (die ersten beiden, dann 16 mit Amazon-Suche aus AniList): Der Prime-Weg bleibt mit „🇩🇪 ?“ stehen, ein Nein zu einer anderen Adresse nimmt ihn nicht mit. */
export function kanalWegeVorhanden(titles: Map<number, Title>): string[] {
  const faelle: [number, string][] = [
    [129188, 'B0D98PQ1FW'],
    [21450, 'B0GXK7RJFW'],
    [4155, 'B0DQM5BCFD'],
    [18153, 'B0DNRB35F3'],
    [20613, 'B0CVZYJVGK'],
    [20629, 'B0H4R4DFWJ'],
    [21256, 'B0CGXXZXLS'],
    [21855, 'B0DNGCWNTR'],
    [100010, '0L9N0LDY9E1X7N2OPZNAUBQLWP'],
    [103871, '0JGAZGWGB8P5U7ATA79IKTYIF8'],
    [107961, 'B0B6VQDB6D'],
    [126791, '0FJOQHOAFIXXM8S33J6VVL4AHQ'],
    [140439, 'B0CJRZY5ND'],
    [178680, 'B0DZCJFGCL'],
    [101316, 'B0CNPLLDZF'],
    [1559, 'B0CBNSDCWH'],
    [21676, 'B0FVF14Z73'],
    [21851, 'B0CJPZFQ9H'],
  ]
  return faelle
    .filter(([id, asin]) => !titles.get(id)?.streams?.some((s) => s.platform === 'primevideo' && s.url.includes(asin)))
    .map(([id, asin]) => `Titel ${id}: der Prime-Weg ${asin} (Kanal) fehlt im Bestand`)
}

/** Mob Psycho 100 III (140439): Kanal-Beleg mit Ja- und Nein-Bereichen je Folge, gekürzt aus `data/dub-confirmed.yaml`. */
const mobPsycho = {
  anilistId: 140439,
  platform: 'primevideo',
  url: 'https://www.amazon.de/gp/video/detail/B0CJRZY5ND',
  dub: true,
  checkedAt: '2026-09-28',
  note: 'Abos: crunchyrollde — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg',
  dubRanges: [
    { from: 1, to: 1, dub: false },
    { from: 2, to: 5, dub: true },
    { from: 6, to: 6, dub: false },
    { from: 7, to: 12, dub: true },
  ],
} as DubCheck

/** Die beiden Wege der Kanal-Titel nach PR 863: Nein-Bereiche bleiben am Weg, eine Amazon-Suche bekommt die Adresse des Belegs (One Piece Film: Strong World, 4155). */
export function kanalWegProben(pruefe: Pruefe): void {
  const gelesen = ohneKanalSprache(mobPsycho)
  const neins = gelesen.dubRanges ?? []
  pruefe('Kanal-Titel: das Ja fällt, die Folge-Neins bleiben', gelesen.dub === undefined && neins.length === 2 && neins.every((r) => !r.dub), gelesen)
  pruefe('Kanal-Titel: Nein-Bereiche sind eine Aussage über den Weg', traegtAussage(gelesen) && !traegtAussage({ ...gelesen, dubRanges: undefined }))
  pruefe('Kanal-Titel: ein Weg mit Nein-Bereichen ist nicht stumm', kanalAdressenOhneAussage([gelesen]).size === 0 && kanalAdressenOhneBeleg([gelesen]).size === 1)
  const strongWorld = { anilistId: 4155, platform: 'primevideo', url: 'https://www.amazon.de/dp/B0DQM5BCFD', checkedAt: '2026-08-31', kanalOhneBeleg: true } as DubCheck
  const suche = 'https://www.amazon.de/s?k=One%20Piece%20Film%3A%20Strong%20World&i=instant-video'
  const wege = [{ platform: 'primevideo', url: suche }, { platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/948', dub: true }] as StreamLink[]
  pruefe('Amazon-Suche: der einzige Prime-Weg bekommt die Adresse des Belegs ohne Urteil', hatWegOderErsetztSuche(wege, strongWorld) && wege[0]!.url === strongWorld.url && wege[0]!.dub === undefined, wege)
  const echt = [{ platform: 'primevideo', url: 'https://www.amazon.de/dp/B0AAAAAAAA' }] as StreamLink[]
  pruefe('Amazon-Suche: ein echter Prime-Weg bleibt', hatWegOderErsetztSuche(echt, strongWorld) && echt[0]!.url.endsWith('B0AAAAAAAA'))
  pruefe('Amazon-Suche: ohne Prime-Weg legt der Aufruf nichts an', !hatWegOderErsetztSuche([{ platform: 'adn', url: 'x' }] as StreamLink[], strongWorld))
}
