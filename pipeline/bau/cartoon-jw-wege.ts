/**
 * Bezugswege (Kauf, Leihe, Abo, gratis) für Cartoons aus JustWatch (18.11.2026). Anime bekommen sie in `11-2-justwatch.ts`; die Cartoon-Datei
 * lief nie durch diese Runden, `cartoons.json` trug 0 Bezugswege. Hier laufen dieselben Funktionen wie bei Anime, mit denselben Riegeln:
 * ein Weg, kein `dub` (die Tonspur gilt der Serie), nur Anbieter ohne eigene Plattform, keine Disc-Händler, keine Kinos, tote Adressen
 * und Nein-Handbelege bleiben draußen. Die Adresse steht bei JustWatch; die Anbieter selbst werden nie abgerufen.
 */
import { loadDubChecks, neinHandbelege } from '../lib/dub-confirmed.ts'
import { baueIstTot } from '../lib/adresse-tot.ts'
import type { Title } from '../../shared/types.ts'
import { entfernteVerweise, ergaenzeWegeOhneWeg, type JwEintrag } from './11-2-2-wege-ohne-weg.ts'
import { ergaenzeJwWeitereWege } from './11-2-7-jw-weitere-wege.ts'

const wegeZahl = (titel: Title[]): number => titel.reduce((n, t) => n + (t.watchLinks?.length ?? 0), 0)

/** Gibt die Zahl der neuen Bezugswege zurück. */
/** `jw` ist `data/justwatch-audio.json`, wie es der Bau liest (Formen von Cartoon- und Anime-Seite weichen im Typ ab, nicht in den Daten). */
export function ergaenzeCartoonJwWege(titel: Title[], jwRoh: object): number {
  const jw = jwRoh as Record<string, JwEintrag>
  const checks = loadDubChecks()
  const handNein = neinHandbelege(checks)
  const tot = new Set(checks.flatMap((c) => (c.available === false && c.url ? [c.url] : [])))
  const istTot = baueIstTot(tot, () => false)
  const vorher = wegeZahl(titel)
  const mehrdeutig = new Set<string>()
  const alsMap = new Map(titel.map((t) => [t.id, t]))
  ergaenzeWegeOhneWeg({ titles: alsMap, jw, handNein, tmdbMehrdeutig: mehrdeutig, istTot, entfernt: entfernteVerweise() })
  ergaenzeJwWeitereWege({ titles: titel, jw, tmdbMehrdeutig: mehrdeutig, istTot })
  return wegeZahl(titel) - vorher
}
