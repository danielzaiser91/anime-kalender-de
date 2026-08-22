/**
 * Aus einzelnen Folgenmeldungen zusammenhängende Bereiche bilden.
 *
 * Daniel am 22.08.2026: „melden von 1,3,4,13 müsste reichen, um daraus die
 * infos zu ziehen das 1-3 keine und 4-13 eine synchro haben." Genau das
 * passiert hier — vorher schrieb jede Meldung ein `dub: true/false` für die
 * **ganze** Reihe, und sieben Meldungen zu einer Serie hoben einander auf.
 *
 * **Interpoliert wird nur zwischen zwei gleichen Befunden.** Aus „1 nein" und
 * „3 nein" wird 1–3, weil Synchrongrenzen zusammenhängen. Aus „3 nein" und
 * „6 ja" wird dagegen **nicht** 3–5 nein: Wo die Grenze zwischen 4 und 6 genau
 * liegt, weiß niemand, also bleibt sie offen. Eine geratene Grenze wäre
 * schlimmer als eine fehlende — sie sieht aus wie ein Befund.
 */

/** Eine einzelne Meldung: Folge X hat deutschen Ton, oder eben nicht. */
export interface Folgenmeldung {
  folge: number
  dub: boolean
}

/** Ein zusammenhängender Bereich mit einheitlichem Befund. */
export interface Folgenbereich {
  von: number
  bis: number
  dub: boolean
  /** Die Folgen, für die eine echte Meldung vorliegt — der Rest ist gefolgert. */
  belegt: number[]
}

/**
 * Meldungen zu Bereichen zusammenfassen.
 *
 * Doppelte Meldungen zur selben Folge: die **letzte** gewinnt, weil sie die
 * jüngere Beobachtung ist. Widersprechen sie einander, steht das in
 * `widersprueche` — stillschweigend eine Seite zu wählen wäre falsch.
 */
export function bildeBereiche(meldungen: Folgenmeldung[]): {
  bereiche: Folgenbereich[]
  widersprueche: number[]
} {
  const jeFolge = new Map<number, boolean>()
  const widersprueche: number[] = []
  for (const m of meldungen) {
    if (!Number.isFinite(m.folge) || m.folge < 1) continue
    const vorher = jeFolge.get(m.folge)
    if (vorher !== undefined && vorher !== m.dub && !widersprueche.includes(m.folge)) {
      widersprueche.push(m.folge)
    }
    jeFolge.set(m.folge, m.dub)
  }

  const sortiert = [...jeFolge.entries()].sort((a, b) => a[0] - b[0])
  const bereiche: Folgenbereich[] = []
  for (const [folge, dub] of sortiert) {
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter.dub === dub) {
      letzter.bis = folge
      letzter.belegt.push(folge)
    } else {
      bereiche.push({ von: folge, bis: folge, dub, belegt: [folge] })
    }
  }
  return { bereiche, widersprueche }
}

/**
 * Die Bereiche als ein Satz, den ein Mensch lesen kann.
 *
 * Die Lücken werden benannt, nicht verschwiegen: „4–5 ungeprüft" ist eine
 * Angabe, „1–3 ohne, 6–13 mit" allein sähe nach Vollständigkeit aus.
 */
export function beschreibeBereiche(bereiche: Folgenbereich[]): string {
  const teile: string[] = []
  let vorheriges = 0
  for (const b of bereiche) {
    if (vorheriges && b.von > vorheriges + 1) {
      teile.push(`${vorheriges + 1}–${b.von - 1} ungeprüft`)
    }
    const spanne = b.von === b.bis ? `Folge ${b.von}` : `Folgen ${b.von}–${b.bis}`
    teile.push(`${spanne} ${b.dub ? 'mit deutschem' : 'ohne deutschen'} Ton`)
    vorheriges = b.bis
  }
  return teile.join(', ')
}

/**
 * Ein Eintrag unseres Datensatzes, wie ihn die Zuordnung braucht.
 *
 * `folgen` ist die Folgenzahl **dieser** Staffel, nicht die der Reihe.
 */
export interface Staffeleintrag {
  id: number
  titel: string
  folgen: number
}

/**
 * Eine durchgezählte Anbieternummer auf unsere Staffeln umrechnen.
 *
 * Netflix zählt Jujutsu Kaisen durch: Folge 59 heißt dort „Die Sendai-Barriere"
 * (Daniel, 22.08.2026, mit Bild). Unser Datensatz führt dieselbe Adresse an
 * drei AniList-Einträgen mit 24, 23 und 12 Folgen — 24 + 23 + 12 = 59. Die 59
 * gehört also in die dritte Staffel, als deren zwölfte Folge.
 *
 * **Die Reihenfolge der Staffeln muss stimmen**, sonst rechnet das hier
 * zuverlässig falsch. Sie kommt von außen (nach Erstausstrahlung sortiert),
 * nicht aus der AniList-Kennung — die steigt zwar meistens mit der Zeit, aber
 * eben nur meistens.
 *
 * Fällt die Nummer hinter die letzte bekannte Folge, kommt `null` zurück: Dann
 * kennt der Anbieter mehr Folgen als wir, und raten hilft niemandem.
 */
export function ordneFolgeZu(
  folge: number,
  staffeln: Staffeleintrag[],
): { staffel: Staffeleintrag; folgeInStaffel: number; index: number } | null {
  let gezaehlt = 0
  for (let i = 0; i < staffeln.length; i++) {
    const s = staffeln[i]!
    if (folge <= gezaehlt + s.folgen) {
      return { staffel: s, folgeInStaffel: folge - gezaehlt, index: i }
    }
    gezaehlt += s.folgen
  }
  return null
}

/**
 * Einen Folgenbereich auf die Staffeln verteilen, die er berührt.
 *
 * Black Clover auf Netflix: 1–155 deutsch, 156–171 nicht. Unser Datensatz kennt
 * vier Staffeln — der erste Bereich deckt drei davon ganz und die vierte
 * teilweise. Genau diese Teilung steht hier: je Staffel, wie viele Folgen des
 * Bereichs in ihr liegen und ob sie **ganz** darin liegt.
 *
 * Nur eine vollständig abgedeckte Staffel darf einen Befund für die ganze
 * Staffel bekommen. Bei einer angeschnittenen wäre „hat deutschen Ton" eine
 * Aussage über Folgen, die niemand geprüft hat.
 */
export function verteileAufStaffeln(
  bereich: { von: number; bis: number; dub: boolean },
  staffeln: Staffeleintrag[],
): Array<{ staffel: Staffeleintrag; von: number; bis: number; ganz: boolean; dub: boolean }> {
  const ergebnis: Array<{ staffel: Staffeleintrag; von: number; bis: number; ganz: boolean; dub: boolean }> = []
  let gezaehlt = 0
  for (const s of staffeln) {
    const erste = gezaehlt + 1
    const letzte = gezaehlt + s.folgen
    const von = Math.max(bereich.von, erste)
    const bis = Math.min(bereich.bis, letzte)
    if (von <= bis) {
      ergebnis.push({
        staffel: s,
        von: von - gezaehlt,
        bis: bis - gezaehlt,
        ganz: von === erste && bis === letzte,
        dub: bereich.dub,
      })
    }
    gezaehlt = letzte
  }
  return ergebnis
}

/** Eine Staffel, wie der Anbieter sie selbst meldet. */
export interface AnbieterStaffel {
  seq: number
  name: string
  folgen: number
  /** Die Nummer der ersten Folge — 1, wenn der Anbieter je Staffel neu zählt. */
  erste: number
}

/**
 * Die Staffelliste des Anbieters auf unsere Einträge legen.
 *
 * **Das schlägt jede Rechnung.** Bis zum 22.08.2026 rechnete `ordneFolgeZu` die
 * Folgennummer über die Staffelgrenzen hinweg um, weil Netflix bei Jujutsu
 * Kaisen durchzählt (bis 59). Bei Sword Art Online tut es das **nicht**: Die
 * gemeldete Liste ist `[{seq:1, folgen:25, erste:1}, {seq:2, folgen:24,
 * erste:1}]` — jede Staffel fängt wieder bei 1 an. Die Zählweise ist je Serie
 * verschieden, und geraten hätte hier eine Meldung an die falsche Staffel
 * geschrieben.
 *
 * Liegt die Liste vor, wird also nicht mehr gerechnet, sondern gelesen.
 *
 * **Die Folgenzahl ist die Kontrolle**, nicht bloß Beiwerk: Stimmt sie bei
 * einem Paar nicht überein, ist die Reihenfolge falsch, und dann wird gar
 * nichts zugeordnet. Ein falsch zugeordneter Befund sieht aus wie ein geprüfter.
 */
export function ordneNachStaffelliste(
  anbieter: AnbieterStaffel[],
  unsere: Staffeleintrag[],
): {
  paare: Array<{ anbieter: AnbieterStaffel; unser: Staffeleintrag }>
  /** Unsere Einträge, für die der Anbieter gar keine Staffel führt. */
  ohneEntsprechung: Staffeleintrag[]
  /** Warum keine Zuordnung zustande kam — leer, wenn alles passt. */
  problem?: string
} {
  const sortiert = [...anbieter].sort((a, b) => a.seq - b.seq)

  /**
   * Der Reihe nach paaren geht nur in **einer** Richtung.
   *
   * Führt der Anbieter **weniger** Staffeln als wir, sind seine die ersten
   * unserer Reihe: Netflix zeigt von Sword Art Online zwei Staffeln (25 und 24
   * Folgen), unsere ersten beiden haben genau diese Zahlen, die übrigen zwei
   * laufen dort nicht. Paaren von vorn ist richtig.
   *
   * Führt er **mehr**, stimmt die Reihenfolge nicht mehr. Bei „My Hero
   * Academia" führt Netflix sieben Staffeln, an unserer Adresse hängen nur zwei
   * Einträge — Staffel 1 und Staffel **6**, weil für die vier dazwischen nie
   * jemand einen Verweis eingetragen hat (Daniel, 22.08.2026). Von vorn gepaart
   * würde Netflix' zweite Staffel mit unserer sechsten verheiratet; beide haben
   * 25 Folgen, und die Folgenzahl-Kontrolle merkt nichts davon.
   *
   * Dann wird gar nicht gepaart. Die fehlenden Verweise sind das eigentliche
   * Ergebnis — sie stehen im Problemtext und gehören von Hand ergänzt.
   */
  if (sortiert.length > unsere.length) {
    return {
      paare: [],
      ohneEntsprechung: [],
      problem:
        `Der Anbieter führt ${sortiert.length} Staffel(n), unser Datensatz nur ${unsere.length} an dieser Adresse — ` +
        `uns fehlen Verweise, und ohne sie ist keine Zuordnung sicher`,
    }
  }

  const paare: Array<{ anbieter: AnbieterStaffel; unser: Staffeleintrag }> = []
  const abweichungen: string[] = []
  for (let i = 0; i < sortiert.length; i++) {
    const a = sortiert[i]!
    const u = unsere[i]!
    if (a.folgen !== u.folgen) {
      abweichungen.push(`Staffel ${a.seq}: Anbieter ${a.folgen} Folgen, wir ${u.folgen} (${u.titel})`)
    }
    paare.push({ anbieter: a, unser: u })
  }

  /**
   * Eine einzelne Abweichung kippt die Reihenfolge nicht — mehrere schon.
   *
   * Bei „My Hero Academia" meldet Netflix 13, 25, 25, 25, 25, 25, 25; unsere
   * sieben Staffeln haben 13, 25, 25, 25, 25, 25, **21**. Sechs Zahlen in Folge
   * treffen exakt — dass die siebte abweicht, liegt an unterschiedlicher
   * Zählung (Netflix rechnet dort Folgen mit, die AniList nicht führt), nicht
   * an einer falschen Reihenfolge.
   *
   * Weichen dagegen **zwei oder mehr** ab, ist die Reihe verschoben, und dann
   * wird gar nichts zugeordnet: Ein falsch zugeordneter Befund sieht aus wie
   * ein geprüfter.
   *
   * **Und die Nachsicht braucht Rückhalt.** Bei einer einzigen Staffel, deren
   * Zahl nicht stimmt, bestätigt nichts die Reihenfolge — dann ist die
   * Abweichung nicht die Ausnahme, sondern der ganze Befund. Erst ab zwei
   * exakten Treffern trägt die Reihe eine Ausnahme.
   */
  const exakt = paare.length - abweichungen.length
  if (abweichungen.length > 1 || (abweichungen.length === 1 && exakt < 2)) {
    return { paare: [], ohneEntsprechung: [], problem: abweichungen.join('; ') }
  }
  return {
    paare,
    ohneEntsprechung: unsere.slice(sortiert.length),
    problem: abweichungen[0],
  }
}

/**
 * Eine gemeldete Folge auf unseren Eintrag bringen — der ganze Weg auf einmal.
 *
 * Kennt der Anbieter seine Staffeln, entscheidet seine Liste. Sonst bleibt die
 * Umrechnung über die Folgenzahlen, und die trägt nur, wo durchgezählt wird.
 */
export function ordneMeldungZu(
  meldung: { folge: number; staffel?: number | null },
  unsere: Staffeleintrag[],
  anbieter?: AnbieterStaffel[],
): { staffel: Staffeleintrag; folgeInStaffel: number } | null {
  if (anbieter?.length && meldung.staffel) {
    const { paare } = ordneNachStaffelliste(anbieter, unsere)
    const paar = paare.find((p) => p.anbieter.seq === meldung.staffel)
    if (!paar) return null
    // `erste` sagt, wo die Zählung dieser Staffel beginnt — bei 1, wenn der
    // Anbieter je Staffel neu zählt, sonst beim Fortlauf.
    const inStaffel = meldung.folge - paar.anbieter.erste + 1
    // Gegen die Folgenzahl des **Anbieters** geprüft, nicht gegen unsere: Wie
    // viele Folgen seine Staffel hat, weiß er besser. Bei My Hero Academia
    // zählt Netflix in Staffel 7 fünfundzwanzig Folgen, AniList einundzwanzig —
    // Daniels Folge 170 ist dort die 25. und läge außerhalb unserer Zählung.
    if (inStaffel < 1 || inStaffel > paar.anbieter.folgen) return null
    return { staffel: paar.unser, folgeInStaffel: inStaffel }
  }
  const ergebnis = ordneFolgeZu(meldung.folge, unsere)
  return ergebnis ? { staffel: ergebnis.staffel, folgeInStaffel: ergebnis.folgeInStaffel } : null
}
