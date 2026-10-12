import type { Title } from '../../shared/types.ts'

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
