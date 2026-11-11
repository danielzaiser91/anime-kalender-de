import { type IstTot } from '../lib/adresse-tot.ts'
import { readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { moeglicheStaffeln, staffelFuehrt } from '../lib/jw-staffel-des-titels.ts'
import { staffelDesTitels } from './widerlegung-staffel.ts'
import { ergaenzeWegeOhneWeg, type JwAngebot, type JwEintrag } from './11-2-2-wege-ohne-weg.ts'
import { mitFolgestaffelEintraegen } from './11-2-6-folgestaffel-eintraege.ts'

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
 * Die Folgestaffel-Einträge (`mitFolgestaffelEintraegen`) gelten hier wie in der ersten Runde: Eine Folgestaffel mit geratenem Stream verliert ihn erst in der Begrenzung.
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
    jw: mitFolgestaffelEintraegen(mitStaffelTreffer(readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {}), titles), titles),
    handNein: new Set<string>(),
    tmdbMehrdeutig,
    istTot,
  })
}

/**
 * Bei einer Serie mit mehreren Staffeln gilt ein digitales Angebot nur, wenn JustWatch es unter einer Staffel führt, die der Titel sein kann
 * (`moeglicheStaffeln`, Staffelnummer aus `staffelDesTitels`): Das gemischte Gesamtfeld `angebote` nennt es auch, wenn es nur an einer anderen Staffel hängt (Goblin Slayer 101165: der
 * Aniverse-Kanal steht nur unter Staffel 2, der Titel ist Staffel 1). Ist die Staffel nicht bestimmbar, genügt jede: leere Sonderstaffeln mit
 * 1 bis 6 Folgen und Lücken der Staffelliste widerlegen nichts (Naruto, FLCL, Cardcaptor Sakura, M.A.S.K.: Prüfer 3463). Kauf und Leihe, auch der
 * Disc-Händler, stehen bei JustWatch nie unter einer Staffel (Stand 11.11.2026: `staffeln[].angebote` kennt nur FLATRATE, ADS und FREE, 0 von 6.530
 * Einträgen BUY oder RENT): Ihr Fehlen dort ist keine Auskunft.
 */
export function mitStaffelTreffer(jw: Record<string, JwEintrag>, titles: ReadonlyMap<number, Title>): Record<string, JwEintrag> {
  const out: Record<string, JwEintrag> = {}
  for (const [id, e] of Object.entries(jw)) {
    if ((e.staffeln ?? []).length < 2) {
      out[id] = e
      continue
    }
    const titel = titles.get(Number(id))
    const moegliche = moeglicheStaffeln(e, titel?.episodes, titel && staffelDesTitels(titel, titles.values()))
    const ohneAuskunft = (a: JwAngebot) => a.art === 'BUY' || a.art === 'RENT'
    out[id] = { ...e, angebote: (e.angebote ?? []).filter((a) => ohneAuskunft(a) || moegliche.some((s) => staffelFuehrt(s, a))) }
  }
  return out
}
