/**
 * Archivserien, die `--laufend` neu fragen muss, weil die ADN-Liste jetzt `vde` nennt (30.10.2026).
 *
 * Anlass: Dreamland (ADN 887) und neun weitere Archivserien blieben bis zum Wochenlauf außerhalb von Katalog und Kalender. `laufendeSerien()` kennt
 * nur frische Termine und halbe Vertonung; eine Serie, deren Archivstand gar keine deutsche Folge hat, fällt durch beide Netze, obwohl die Liste
 * (die `--laufend` ohnehin abruft) die Freischaltung schon meldet.
 */
import type { AdnListenEintrag } from './adn-folgen.ts'

/** Die Liste nennt `vde`, der Archivstand der Serie (`folgenMitVde` Folgen) kennt noch keine deutsche Fassung. */
export function listeNenntNeuesVde(eintrag: AdnListenEintrag | undefined, folgenMitVde: number): boolean {
  return folgenMitVde === 0 && eintrag?.languages?.includes('vde') === true
}
