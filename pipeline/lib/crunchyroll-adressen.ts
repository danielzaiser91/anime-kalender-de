import type { Release, Title } from '../../shared/types.ts'
import type { NeinFall } from '../../shared/nein-wiedervorlage.ts'
import { crunchyrollSeriesId } from './crunchyroll.ts'
import { ladeNeinFaelle, type EntfernterEintrag } from './nein-wiedervorlage-lesen.ts'
import { readJson } from './util.ts'

/**
 * Die Crunchyroll-Adressen, die der Dub-Abruf (`scrape-crunchyroll-dub.ts`) prüft: **alle**, nicht nur die unbeantworteten.
 *
 * Vorher stand hier `s.dub === undefined`. Das klang sparsam und war eine Einbahnstraße: Eine Adresse, die einmal ein
 * `false` erzeugt hatte, kam nie wieder vor — die Antwort verhinderte ihre eigene Überprüfung. Aussortiert wird weiter
 * unten nach dem **Alter** der letzten Prüfung, und das ist ein Kriterium, das sich von selbst wieder öffnet.
 *
 * `nurOffene` (Schalter `--offen`) lässt beantwortete weg: eine Auswahl für den gezielten Lauf, kein anderer Regelweg.
 */
export function crunchyrollAdressen(titles: Title[], nurOffene: boolean): Set<string> {
  const offen = new Set<string>()
  for (const t of titles) {
    for (const s of t.streams) {
      if (s.platform !== 'crunchyroll') continue
      /**
       * Die Plattform-Angabe allein genügt nicht — die Adresse muss auch dorthin zeigen.
       *
       * aniSearch führt unter `provider: "crunchyroll-(de)"` teils eine **Amazon-Partneradresse**
       * (`https://www.amazon.de/dp/B0C9H2BQWM?tag=anisearch.de-21` bei „Attack on Titan"). Der Build filtert solche
       * Verweise bereits aus dem Datensatz, diese Warteschlange tat es nicht — die Adresse stand deshalb seit jeher
       * unter den 86 „keine Serienkennung hinter dieser Adresse" und wurde bei jedem Lauf erneut vergeblich
       * aufgelöst (gefunden 23.08.2026).
       *
       * Geprüft wird der **Host**, nicht ein Textstück: `url.includes('crunchyroll')` ließe
       * `amazon.de/…?ref=crunchyroll` durch.
       */
      let host: string
      try {
        host = new URL(s.url).hostname
      } catch {
        continue // Keine gültige Adresse — dann gibt es nichts zu holen.
      }
      if (host !== 'crunchyroll.com' && !host.endsWith('.crunchyroll.com')) continue
      if (nurOffene && s.dub !== undefined) continue
      offen.add(s.url)
    }
  }
  return offen
}

/**
 * Was die Wiedervorlage dem Dub-Abruf zusätzlich vorlegt (Nein kommen wieder zur Prüfung, `shared/nein-wiedervorlage.ts`).
 *
 * Ein belegtes Nein nimmt den Verweis aus `titles.json`; die Adresse, aus der der Abruf seine Liste bildet, ist damit
 * verschwunden, und die Antwort verhinderte ihre eigene Überprüfung (12.10.2026: 700 entfernte Adressen, die letzte Prüfung
 * über 28 Tage her). Die Adressen kommen aus dem Gedächtnis der entfernten Verweise; ihre Frist bleibt die des Abrufs (`--alter`).
 * Eine Kachel („(Deutsch)“ im Kalender) nach dem Messdatum macht die Serie sofort fällig: `kachelSeit` hat dasselbe Format
 * wie die Neuzugänge aus `crunchyroll-neu.json` (Serienkennung → Tag).
 */
export function crunchyrollNeinAbruf(
  entfernt: EntfernterEintrag[],
  faelle: NeinFall[],
  releases: Release[],
): { adressen: Set<string>; kachelSeit: Map<string, string> } {
  const eintraege = entfernt.filter((e) => e.plattform === 'crunchyroll' && e.url)
  const adressen = crunchyrollAdressen([{ streams: eintraege.map((e) => ({ platform: 'crunchyroll', url: e.url! })) } as Title], false)
  const kachelSeit = new Map<string, string>()
  const kachel = new Map(faelle.filter((f) => f.platform === 'crunchyroll' && f.kachelAm).map((f) => [f.titleId, f.kachelAm!]))
  for (const r of releases) {
    const am = r.platform === 'crunchyroll' ? kachel.get(r.titleId) : undefined
    const serie = crunchyrollSeriesId(r.platformUrl)
    if (!am || !serie || !r.platformUrl) continue
    adressen.add(r.platformUrl)
    kachelSeit.set(serie, am)
  }
  return { adressen, kachelSeit }
}

/** Dasselbe aus den Dateien des Repos. */
export function crunchyrollNeinAbrufLaden(): ReturnType<typeof crunchyrollNeinAbruf> {
  const entfernt = readJson<{ verweise?: EntfernterEintrag[] }>('data/verweise-entfernt.json', {}).verweise ?? []
  return crunchyrollNeinAbruf(entfernt, ladeNeinFaelle(), readJson<Release[]>('public/data/releases.json', []))
}
