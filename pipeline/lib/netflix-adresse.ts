/**
 * Netflix-Verweise auf die eine Form bringen, die eine Titelseite ist.
 *
 * Netflix verteilt dieselbe Video-Kennung über mehrere Adressformen, und im
 * Bestand liegen alle davon nebeneinander — sie stammen aus Fremdquellen und
 * aus Jahren, in denen Netflix anders adressierte:
 *
 * - `netflix.com/watch/80180071?source=35` — die Abspieladresse
 * - `movies.netflix.com/WiMovie/Samurai_Champloo/70213065` — die Form bis 2015
 * - `netflix.com/search?q=berserk&jbv=80243876` — Suche mit Vorschaufenster
 *
 * Alle drei tragen dieselbe Kennung wie `netflix.com/title/<id>` und meinen
 * dieselbe Seite. Nur erkennt sie niemand als Titelseite: Die Erweiterung
 * findet sie nicht, der Prüfstand zählt sie als „ohne Titelseite", und die
 * Pille in der Status-App führte auf eine leere Liste (Daniel, 27.08.2026:
 * „in status app steht 15 offen für netflix … liste leer").
 *
 * Was hier **nicht** umgeschrieben wird, sind Netflix' Wunschadressen —
 * `netflix.com/pokemonconcierge`, `netflix.com/RecordofRagnarok`. Sie tragen
 * gar keine Kennung; die kennt nur Netflix. Sie bleiben, wie sie sind.
 */
export function netflixTitelAdresse(url: string): string {
  if (!/netflix\.com/i.test(url)) return url
  const kennung =
    /\/(?:title|watch)\/(\d{6,})/.exec(url)?.[1] ??
    /[?&]jbv=(\d{6,})/.exec(url)?.[1] ??
    /\/WiMovie\/(?:[^/]+\/)?(\d{6,})/.exec(url)?.[1]
  return kennung ? `https://www.netflix.com/title/${kennung}` : url
}
