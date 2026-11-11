import { type IstTot } from '../lib/adresse-tot.ts'
import { readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { staffelDesTitels, staffelFuehrt, zaehleTitelJeJwFolgen } from '../lib/jw-staffel-des-titels.ts'
import { ergaenzeWegeOhneWeg, PHYSISCHE_SHOPS, type JwAngebot, type JwEintrag } from './11-2-2-wege-ohne-weg.ts'

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
    jw: mitStaffelTreffer(readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {}), titles),
    handNein: new Set<string>(),
    tmdbMehrdeutig,
    istTot,
  })
}

/**
 * Bei einer Serie mit mehreren Staffeln gilt ein digitales Angebot nur, wenn JustWatch es unter **jeder** Staffel führt: Das gemischte Gesamtfeld
 * `angebote` nennt es auch, wenn es nur an einer anderen Staffel hängt (Goblin Slayer 101165: der Aniverse-Kanal steht nur unter Staffel 2, der Titel ist Staffel 1).
 * Welche Staffel ein Titel ist, steht meist nicht fest; „jede“ ist der sichere Wert. Ausnahme: Hat nur eine Staffel bei JustWatch genau die Folgenzahl
 * des Titels und kein Geschwistertitel dieselbe (`staffelDesTitels`), reicht das Angebot an dieser Staffel (Chaika 20462: Crunchyroll steht nur unter
 * Staffel 1, der Titel ist Staffel 1). Disc-Händler laufen über ihre eigene Regel.
 */
export function mitStaffelTreffer(jw: Record<string, JwEintrag>, titles: ReadonlyMap<number, Title>): Record<string, JwEintrag> {
  const out: Record<string, JwEintrag> = {}
  const zaehler = zaehleTitelJeJwFolgen(titles.values(), jw)
  for (const [id, e] of Object.entries(jw)) {
    const staffeln = e.staffeln ?? []
    /* Ein westlicher Titel (Cartoon) ist die ganze Serie mit allen Staffeln: jede Staffel mit dem Angebot genügt (M.A.S.K.: Aniverse nur in Staffel 1). */
    if (staffeln.length < 2 || titles.get(Number(id))?.westlich) {
      out[id] = e
      continue
    }
    const inJeder = (a: JwAngebot) => staffeln.every((s) => staffelFuehrt(s, a))
    const eigene = staffelDesTitels(e, titles.get(Number(id))?.episodes, zaehler)
    out[id] = { ...e, angebote: (e.angebote ?? []).filter((a) => PHYSISCHE_SHOPS.test(a.anbieter) || inJeder(a) || (!!eigene && staffelFuehrt(eigene, a))) }
  }
  return out
}
