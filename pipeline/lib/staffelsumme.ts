/**
 * Beginnt die Staffelliste eines Anbieters nicht bei Staffel 1 (Netflix führt von Beyblade X nur Staffel 2), fehlt uns der Versatz zu
 * unserer durchgezählten Folgennummer. Er ergibt sich aus der Summe der früheren Staffeln laut JustWatch und gilt erst, wenn
 * mindestens ein unabhängiges Merkmal ihn bestätigt (Folgentitel gegen unsere Liste; F100, Daniel 01.11.2026).
 * Die Summe allein trägt nicht: bei Alvinnn!!! und EarthSpark weicht sie vom Titelversatz ab (Messung im Bericht f100-plan.md).
 */
import { folgenZuTitel, type UnsereFolge } from './episodentitel-block.ts'

export const SUMME_VERMERK = 'Staffelsumme'
export const BESTAETIGT_VERMERK = 'bestätigt durch:'

/** Netflix-Adressen mit Liste ab Staffel > 1, deren Meldungen weder Summe noch Titel zuordnen (Stand 02.11.2026): Louds, Rainbow High. Darf nur sinken. */
export const OFFEN_OHNE_ZUORDNUNG: readonly string[] = ['81186971', '81397437']

export interface JwStaffel {
  nr: number
  folgen?: number | null
}

export interface TitelMeldung {
  /** Stelle in der Anbieter-Staffel (ab 1). */
  pos: number
  titel: string | null | undefined
}

/** Wie viele Titel mindestens am selben Versatz liegen müssen (ein einzelner Treffer entscheidet nie, wie `ordneBlockZu`). */
const MIN_TREFFER = 2
/** Anteil der Titel mit eindeutigem Treffer, der am Versatz liegen muss (Messung: Kleine Prinzessin 30 von 34, die übrigen 100 %). */
const MIN_ANTEIL = 0.8
/** Specials, die unsere Liste mehr führt als der Anbieter zählt. */
const SPIELRAUM = 3

export type Versatz = { ok: true; versatz: number } | { ok: false; grund: string }

/** Die Folgen der Staffeln vor `erste` laut JustWatch; ohne lückenlose Zahlen kein Versatz. */
export function versatzAusJustWatch(erste: number, jw: JwStaffel[], blockFolgen: number, laenge: number): Versatz {
  const fruehere = jw.filter((s) => s.nr < erste)
  for (let nr = 1; nr < erste; nr++) {
    const s = fruehere.find((x) => x.nr === nr)
    if (!s || typeof s.folgen !== 'number' || s.folgen < 1) return { ok: false, grund: `JustWatch nennt für Staffel ${nr} keine Folgenzahl` }
  }
  const versatz = fruehere.reduce((n, s) => n + (s.folgen ?? 0), 0)
  if (versatz + blockFolgen > laenge + SPIELRAUM) return { ok: false, grund: `Versatz ${versatz} plus ${blockFolgen} Folgen passt nicht in unsere ${laenge}` }
  return { ok: true, versatz }
}

export interface Bestaetigung {
  treffer: number
  abweichend: number
}

/** Wie viele Folgentitel der Meldungen den Versatz bestätigen und wie viele (mit eindeutigem Treffer) woanders liegen. */
export function zaehleTitel(versatz: number, meldungen: TitelMeldung[], liste: UnsereFolge[]): Bestaetigung {
  let treffer = 0
  let abweichend = 0
  for (const m of meldungen) {
    const nr = folgenZuTitel(m.titel, liste)
    if (nr.length !== 1) continue
    if (nr[0] === m.pos + versatz) treffer++
    else abweichend++
  }
  return { treffer, abweichend }
}

export type Urteil = { ok: true; versatz: number; vermerk: string } | { ok: false; grund: string }

/** Summe und Bestätigung zusammen; `quelle` nennt, woher die Titel stammen (Netflix-Meldung, RTL+ …). */
export function urteileStaffelsumme(
  eingabe: { erste: number; jw: JwStaffel[]; blockFolgen: number; meldungen: TitelMeldung[]; liste: UnsereFolge[]; quelle: string; laenge?: number },
): Urteil {
  const summe = versatzAusJustWatch(eingabe.erste, eingabe.jw, eingabe.blockFolgen, eingabe.laenge ?? eingabe.liste.length)
  if (!summe.ok) return summe
  const { treffer, abweichend } = zaehleTitel(summe.versatz, eingabe.meldungen, eingabe.liste)
  if (treffer < MIN_TREFFER) return { ok: false, grund: `nur ${treffer} Folgentitel bestätigen den Versatz ${summe.versatz}` }
  if (treffer / (treffer + abweichend) < MIN_ANTEIL) return { ok: false, grund: `nur ${treffer} von ${treffer + abweichend} Folgentiteln liegen am Versatz ${summe.versatz}` }
  const von = summe.versatz + 1
  const vermerk = `Umrechnung: ${SUMME_VERMERK} – Staffel ${eingabe.erste} beginnt bei unserer Folge ${von} (JustWatch: ${summe.versatz} Folgen davor, Block ${eingabe.blockFolgen}); ${BESTAETIGT_VERMERK} Folgentitel (${treffer} von ${treffer + abweichend}, ${eingabe.quelle})`
  return { ok: true, versatz: summe.versatz, vermerk }
}

/** Belege, deren Umrechnung sich auf die Staffelsumme beruft, aber kein Merkmal der Bestätigung nennt. */
export function findeUnbestaetigteSumme(belege: { title?: string; anilistId?: number; note?: string }[]): string[] {
  return belege
    .filter((b) => b.note?.includes(SUMME_VERMERK) && !b.note.includes(BESTAETIGT_VERMERK))
    .map((b) => `${b.title ?? b.anilistId} (${b.anilistId}): Umrechnung über die Staffelsumme ohne "${BESTAETIGT_VERMERK}"`)
}
