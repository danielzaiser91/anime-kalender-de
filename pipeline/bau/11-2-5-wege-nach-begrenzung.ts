import { type IstTot } from '../lib/adresse-tot.ts'
import { readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { ergaenzeWegeOhneWeg, type JwEintrag } from './11-2-2-wege-ohne-weg.ts'

/** Kennungen der Titel, die gerade mindestens einen Stream tragen. */
export function titelMitStream(titles: ReadonlyMap<number, Title>): Set<number> {
  return new Set([...titles.values()].filter((t) => (t.streams ?? []).length).map((t) => t.id))
}

/**
 * **Die Runde „ohne jeden Weg“ noch einmal für Titel, die ihren Stream erst nach ihr verloren haben.**
 *
 * `ergaenzeWegeOhneWeg` legt Bezugswege nur an, wo kein Stream steht, den sie ersetzen müsste. Bei Titeln nur aus aniSearch stand dort ein vom
 * Namen geratener Crunchyroll-Weg, den `begrenzeWegeAufBelege` danach entfernt: Re:Zero „Bünde aus Eis“ und Attack on Titan: The Last Attack
 * blieben ohne den Crunchyroll-Amazon-Kanal, den JustWatch mit deutschem Ton führt (11.11.2026). Der zweite Durchgang betrifft nur Titel,
 * die davor einen Stream hatten und jetzt keinen mehr.
 *
 * Nein-Handbelege gibt er nicht weiter: `entferneBezugswegeTrotzNein` läuft danach im selben Abschluss über jeden Bezugsweg und nimmt ihn wieder heraus
 * (der Test `check-kanal-nach-begrenzung.ts` hält das mit einem Fall fest).
 */
export function ergaenzeWegeNachBegrenzung({ titles, hatteStream, tmdbMehrdeutig, istTot }: {
  titles: Map<number, Title>
  hatteStream: ReadonlySet<number>
  tmdbMehrdeutig: Set<string>
  istTot: IstTot
}) {
  const verloren = new Map([...titles].filter(([id, t]) => hatteStream.has(id) && !(t.streams ?? []).length))
  ergaenzeWegeOhneWeg({
    titles: verloren,
    jw: readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {}),
    handNein: new Set<string>(),
    tmdbMehrdeutig,
    istTot,
  })
}
