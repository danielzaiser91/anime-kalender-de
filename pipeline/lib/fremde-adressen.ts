import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { schluesselAdresse } from './zuordnung.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'

type MitStreams = { id: number; streams?: { url?: string; seite?: string }[] }

/**
 * Schlüssel ohne Sprach-/Ländersegment: Dieselbe Disney+-Seite kommt als `…/browse/…` und als `…/de-de/browse/…` an.
 * Die YouTube-Liste behält ihr `list=`, sonst fielen alle Playlists auf einen Schlüssel.
 */
export const ohneSprache = (url: string) =>
  schluesselAdresse(url).replace(/^(disneyplus\.com|netflix\.com|crunchyroll\.com)\/(?:[a-z]{2}(?:-[a-z0-9]{2,3})?\/)+/, '$1/') +
  (url.match(/youtube\.com\/playlist\?(?:.*&)?(list=[\w-]+)/)?.[1] ?? '')

/** Die Stream-Adressen (Schlüssel ohne Sprache) der Cartoons und Titel ohne Synchro, je mit den Einträgen `Datei:Kennung`, die sie führen. */
export function streamAdressen(wurzel: string): Map<string, string[]> {
  const adressen = new Map<string, string[]>()
  for (const datei of ['public/data/cartoons.json', 'public/data/ohne-synchro.json'])
    for (const t of JSON.parse(readFileSync(resolve(wurzel, datei), 'utf8')) as MitStreams[])
      for (const s of t.streams ?? [])
        for (const url of [s.url, s.seite]) {
          if (!url) continue
          const schluessel = ohneSprache(url)
          adressen.set(schluessel, [...(adressen.get(schluessel) ?? []), `${datei.split('/').pop()}:${t.id}`])
        }
  return adressen
}

/**
 * **Adressen, die ein Eintrag außerhalb von `titles.json` führt** (18.10.2026): Streams der Cartoons und der Titel ohne
 * Synchro, Prime-Zuordnungen und Handbelege fremder Kennungen. Eine Meldung dort gehört diesem Eintrag und darf über ihren
 * Namen keinem Anime zufallen (`titelDerMeldung`): Die Meldungen zum Cartoon „Heidi“ (2015, -62475) bei Disney+ und Prime
 * landeten so beim Anime „Heidi“ (1974, 2225). Belegt ein Handbeleg die Adresse auch für einen eigenen Titel (Sammelseite
 * „Freezing“ mit Staffel und OVAs), bleibt sie offen; eine Prime-Zuordnung zählt dafür nicht, sie kann selbst aus dem
 * Namensweg stammen (Heidi-Seite bei Disney+ → 2225). Ein falscher Handbeleg stützt die Sperre so gegen sich selbst:
 * `check-handbeleg-fremde-adresse-bestand.ts` meldet jeden Beleg an einer fremden Adresse (Ausnahmen: `SAMMELSEITEN`).
 */
export function fremdeAdressen(wurzel: string, bestand: Set<number>): (url: string) => boolean {
  const fremd = new Set<string>()
  const belegtEigen = new Set<string>()
  const dazu = (url: string | undefined) => {
    if (url) fremd.add(ohneSprache(url))
  }
  for (const schluessel of streamAdressen(wurzel).keys()) fremd.add(schluessel)
  // Meldungen liest leseZugeordnet aus ROOT; der Aufrufer übergibt ROOT (Probe: check-urteil-fremde-adresse über AK_ROOT).
  for (const [url, z] of Object.entries(leseZugeordnet<{ titleId: number }>()))
    if (z.titleId && !bestand.has(z.titleId)) dazu(url)
  const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) as { anilistId?: number; url?: string }[]
  for (const b of belege ?? []) {
    if (b.anilistId && bestand.has(b.anilistId)) belegtEigen.add(ohneSprache(b.url ?? ''))
    else if (b.anilistId) dazu(b.url)
  }
  return (url) => fremd.has(ohneSprache(url)) && !belegtEigen.has(ohneSprache(url))
}
