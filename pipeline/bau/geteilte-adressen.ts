import { type Title } from '../../shared/types.ts'

/**
 * Adressen vermerken, die mehrere unserer Einträge bedienen (`sharedWith` = Anzahl der Einträge).
 *
 * Anlass: Bei „The Café Terrace and Its Goddesses" zeigten unsere Staffel 1 und Staffel 2 auf **dieselbe** Crunchyroll-Seite — und dort
 * steht das Ganze als *eine* Staffel mit 24 Folgen. Wer bei uns „Staffel 2" anklickt und dort 24 Folgen vorfindet, hält eine der beiden
 * Angaben für falsch; tatsächlich zählen bloß beide anders. Belegt wird nur, wie viele unserer Einträge dieselbe Adresse teilen; wie die
 * Plattform in Staffeln einteilt, wissen wir nicht, der Hinweis in der Oberfläche sagt deshalb „kann abweichen". Gibt die Zahl der geteilten Wege zurück.
 * Läuft nach 09-7 und noch einmal am Ende von Phase 11: Wege, die erst dort entstehen (JustWatch, Termin), tragen sonst nie `sharedWith`
 * (Iruma-kun 107693/184492, Disney+, 16.11.2026). Ein Weg ohne Adresse teilt nichts.
 */
export function vermerkeGeteilteAdressen(titles: Iterable<Title>): number {
  const liste = [...titles]
  const proAdresse = new Map<string, number>()
  for (const title of liste) {
    for (const stream of title.streams.filter((s) => s.url)) proAdresse.set(`${stream.platform}|${stream.url}`, (proAdresse.get(`${stream.platform}|${stream.url}`) ?? 0) + 1)
  }
  let geteilt = 0
  for (const title of liste) {
    for (const stream of title.streams.filter((s) => s.url)) {
      const anzahl = proAdresse.get(`${stream.platform}|${stream.url}`) ?? 1
      if (anzahl > 1) {
        stream.sharedWith = anzahl
        geteilt++
      } else delete stream.sharedWith // der zweite Lauf rechnet neu: ein Rest nach entfernten Wegen bleibt nicht stehen
    }
  }
  return geteilt
}
