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
  /**
   * Der Block des Anbieters umfasst **mehrere** unserer Einträge.
   *
   * Dann sagt das Paar nur, **welcher Block** gemeint ist — welcher unserer
   * Titel eine einzelne Folge bekommt, entscheidet erst ihre Nummer. Ohne
   * dieses Feld landeten alle 26 Folgen von „Tokyo Revengers" bei „Christmas
   * Showdown", der nur 13 hat (26.08.2026).
   */
  zusammengefasst?: Staffeleintrag[]
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
  /**
   * Ein einziger Eintrag nimmt alles auf, was der Anbieter dort führt.
   *
   * Netflix teilt „One Piece" in sieben Arcs — East Blue, Grand Line, Drum,
   * Alabasta, Egghead 1 und 2, Elbaph (Daniel, 22.08.2026, mit Bild). Unser
   * Datensatz kennt einen Eintrag. Von einer falschen Reihenfolge kann hier
   * nichts kommen: Es gibt nur eine, und alles gehört dazu.
   *
   * Dasselbe bei „Carole & Tuesday" (zwei Teile bei Netflix, ein Eintrag bei
   * uns) und „BAKI-DOU". Die Folgenzahlen bleiben dabei in der Zählung des
   * Anbieters — sie sind es, die im Player stehen.
   */
  /**
   * Führt der Anbieter **eine** Staffel und wir mehrere, entscheidet die Summe.
   *
   * Netflix zeigt BAKI-DOU als eine Staffel mit 25 Folgen, AniList als zwei mit
   * 13 und 12 — zusammen genau 25 (Daniel, 22.08.2026). Dann ist klar, dass es
   * dieselbe Sache ist, nur anders geschnitten. Alles gehört zur ersten unserer
   * Staffeln; wo genau die Grenze liegt, sagt die Folgennummer der Meldung.
   */
  if (sortiert.length === 1 && unsere.length > 1) {
    const summe = unsere.reduce((n, u) => n + u.folgen, 0)
    if (Math.abs(summe - sortiert[0]!.folgen) <= 3) {
      return {
        paare: [{ anbieter: sortiert[0]!, unser: unsere[0]! }],
        ohneEntsprechung: [],
        zusammengefasst: unsere,
      }
    }
  }


  if (unsere.length === 1) {
    return {
      paare: sortiert.map((a) => ({ anbieter: a, unser: unsere[0]! })),
      ohneEntsprechung: [],
    }
  }

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
    /**
     * Ein paar Folgen Unterschied sind keine Abweichung, sondern OVAs.
     *
     * Der Anbieter rechnet Specials und Bonusfolgen der Staffel zu, AniList
     * führt sie getrennt: KONOSUBA hat bei Netflix 11, 11 und 13 Folgen, bei
     * uns 10, 10 und 11 — jedes Mal genau die eine OVA am Ende (22.08.2026).
     * Bei drei solchen Differenzen verweigerte sich die Zuordnung, obwohl sie
     * offensichtlich richtig war.
     *
     * Drei Folgen Spielraum, und nur bei Staffeln ab fünf Folgen: Bei einer
     * Reihe mit drei Teilen wäre derselbe Abstand ein völlig anderer Titel.
     */
    const abstand = Math.abs(a.folgen - u.folgen)
    const kleinereZahl = Math.min(a.folgen, u.folgen)
    if (abstand > 0 && (abstand > 3 || kleinereZahl < 5)) {
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
    /**
     * **Bevor aufgegeben wird: Passt eine seiner Staffeln auf unsere Summe?**
     *
     * Disney+ zeigt „Tokyo Revengers" unter einer Adresse mit zwei Staffeln, 24
     * und 26 Folgen. Unser Bestand führt dort nur die zweite, aufgeteilt in
     * „Christmas Showdown" und „Tenjiku Arc" mit je 13 — zusammen genau 26. Die
     * erste hängt bei uns an einer anderen Adresse.
     *
     * Der Reihe nach gepaart trifft unsere 13 auf seine 24, beide Zahlen weichen
     * ab, und 50 Meldungen blieben liegen (26.08.2026). Über die Summe ist der
     * Fall dagegen eindeutig.
     *
     * **Nur bei genau einem Kandidaten**, und nur wenn unsere Staffeln zusammen
     * wirklich eine seiner ergeben. Führt er zwei mit derselben Zahl, ist nicht
     * zu entscheiden, welche gemeint ist — dann bleibt es beim Aufgeben.
     */
    const summe = unsere.reduce((n, u) => n + u.folgen, 0)
    /*
      Erst exakt, dann mit Spielraum. Bei Tokyo Revengers ergeben unsere
      13 + 13 genau 26 — und der Nachbarblock hat 24, liegt also ebenfalls in
      der Drei-Folgen-Toleranz. Wer gleich mit Spielraum sucht, findet zwei
      Kandidaten und gibt auf, obwohl einer exakt trifft.
    */
    const genau = sortiert.filter((a) => a.folgen === summe)
    const passende = genau.length ? genau : sortiert.filter((a) => Math.abs(summe - a.folgen) <= 3)
    /*
      **Nur wenn keine einzelne Staffel passt.**

      Trifft schon eine der Reihe nach exakt, ist die Reihenfolge im Kern
      richtig, und die eine Abweichung ist der Befund — nicht ein Hinweis auf
      eine andere Aufteilung. Der Fall steht als Zusicherung in check-logic:
      Anbieter [13, 25] gegen unsere [13, 12] ordnet nichts zu, obwohl 13+12
      seine 25 ergeben. Die 13 passt bereits.

      Bei Tokyo Revengers passt dagegen keine einzelne: 13 gegen 24, 13 gegen
      26. Erst dann ist die Summe die bessere Erklärung.
    */
    if (passende.length === 1 && unsere.length > 1 && exakt === 0) {
      return {
        paare: [{ anbieter: passende[0]!, unser: unsere[0]! }],
        ohneEntsprechung: [],
        zusammengefasst: unsere,
        problem: `Zusammengefasst: ${unsere.length} Einträge (${summe} Folgen) entsprechen Staffel ${passende[0]!.seq} des Anbieters (${passende[0]!.folgen})`,
      }
    }
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
    const { paare, zusammengefasst } = ordneNachStaffelliste(anbieter, unsere)
    const paar = paare.find((p) => p.anbieter.seq === meldung.staffel)
    if (!paar) return null
    /*
      Fasst der Block mehrere unserer Einträge zusammen, entscheidet die
      Folgennummer, welcher gemeint ist: Bei „Tokyo Revengers" gehören die
      Folgen 1–13 zu „Christmas Showdown", 14–26 zu „Tenjiku Arc".
    */
    if (zusammengefasst && zusammengefasst.length > 1) {
      const inBlock = meldung.folge - paar.anbieter.erste + 1
      if (inBlock < 1 || inBlock > paar.anbieter.folgen) return null
      const treffer = ordneFolgeZu(inBlock, zusammengefasst)
      return treffer ? { staffel: treffer.staffel, folgeInStaffel: treffer.folgeInStaffel } : null
    }
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
