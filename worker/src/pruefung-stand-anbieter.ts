/**
 * **Ein Anbieter des Prüfstands, abzüglich dessen, was schon gemeldet ist.**
 *
 * Aus `pruefung-stand.ts` ausgelagert (11.10.2026): die Rechnung je Anbieter, ohne Datenbank.
 */

/** Was der Briefkasten zu den Adressen weiß; Schlüssel der äußeren Maps ist die Plattform. */
export type Gemeldet = {
  /** Offen im Briefkasten (`uebernommen = 0`): was der nächste Datenlauf noch abholt. */
  unterwegs: Map<string, Set<string>>
  /** Adressen, zu denen seit dem Prüfstand gemeldet wurde. */
  seitPruefstand: Map<string, Set<string>>
  /** Je Adresse die Staffeln, zu denen seit dem Prüfstand gemeldet wurde (22.09.2026). */
  staffeln: Map<string, Set<number>>
  /** Je Adresse die Staffeln der Meldungen, die auf die Übernahme warten. */
  wartendeStaffeln: Map<string, Set<number>>
  /** Ziele, deren offene Staffeln der Briefkasten deckt (`pruefung-gedeckt.ts`, Netflix); fehlt in Tests. */
  gedeckt?: Set<string>
}

export function rechneAnbieter(roh: unknown, gemeldet: Gemeldet) {
  const a = roh as {
    name: string
    plattform: string
    offen: number
    gesamt: number
    gemeldet: number
    ohneSeite?: number
    suchAdressen?: string[]
    ziele?: { url: string; titel: string; staffeln?: number[]; seit?: string }[]
  }
  const unterwegs = gemeldet.unterwegs.get(a.plattform) ?? new Set<string>()
  const schonGemeldet = gemeldet.seitPruefstand.get(a.plattform) ?? new Set<string>()
  /*
    **Dieselbe Regel wie `istErledigt()` in `extension/disney.js`** (11.10.2026). Erledigt ist eine
    Adresse, unter der seit dem Prüfstand gemeldet wurde, oder die im Briefkasten auf die Übernahme
    wartet — der Bau kennt diese Meldung noch nicht. Eine Wiedervorlage (`seit`) braucht dagegen eine
    Meldung seit dem Prüfstand (die Erweiterung rechnet mit `pruefstandAm`, `akGemeldetSeit`); eine
    ältere Meldung hat sie ja gerade erst wieder aufgemacht („7 statt 9").
  */
  const adresseErledigt = (url: string, seit?: string) =>
    schonGemeldet.has(url) || (!seit && unterwegs.has(url))
  /*
    **Nennt das Ziel seine offenen Staffeln, ist es erst erledigt, wenn jede gemeldet ist**
    (22.09.2026). Sonst verschwand Dr. STONE nach der Meldung von Staffel 1 bis zur nächsten
    Übernahme aus der Prüfliste, obwohl Staffel 2 offen war. Ziele ohne Staffelangabe bleiben
    bei der Adresse.
  */
  const offeneZiele = (a.ziele ?? []).filter((z) => {
    if (gemeldet.gedeckt?.has(z.url)) return false
    if (!adresseErledigt(z.url, z.seit)) return true
    if (!z.staffeln?.length) return false
    const gemeldeteStaffeln = [
      ...(gemeldet.staffeln.get(z.url) ?? []),
      ...(gemeldet.wartendeStaffeln.get(z.url) ?? []),
    ]
    return !z.staffeln.every((nr) => gemeldeteStaffeln.includes(nr))
  })
  /* Die Adressen dieses Anbieters, die als erledigt zählen — nur solche, die auch in der Zahl `offen` stecken. */
  const erledigteAdressen = new Set<string>()
  for (const z of a.ziele ?? []) {
    if (adresseErledigt(z.url, z.seit)) erledigteAdressen.add(z.url)
  }
  for (const u of a.suchAdressen ?? []) {
    if (adresseErledigt(u)) erledigteAdressen.add(u)
  }
  /**
   * **Eine Suchadresse ist auch ein Ziel.**
   *
   * Daniel am 31.08.2026: „pill click in status app doesn't open next
   * item in prüfliste, it just opens storefront." Zu Recht — bei Prime
   * waren alle 100 offenen Aufträge Suchadressen, und die standen nur als
   * **Zahl** in `ohneSeite`. `ziele` blieb leer, `ziel` null, und die
   * Anzeige fiel auf die Startseite zurück.
   *
   * Die Adressen liegen längst vor — der Prüfstand schickt sie seit dem
   * 30.08.2026 als `suchAdressen` mit, damit hier die gemeldeten
   * abgezogen werden können. Sie hinten anzuhängen kostet nichts und gibt
   * der Pille ein Ziel: die nächste Suche, die noch niemand erledigt hat.
   *
   * Titelseiten stehen davor: Dort liest die Erweiterung selbst, bei
   * einer Suche muss der Treffer erst herausgesucht werden.
   */
  const offeneSuchen = (a.suchAdressen ?? [])
    .filter((u) => !adresseErledigt(u))
    .map((u) => ({ url: u, titel: '' }))
  const alleZiele = [...offeneZiele, ...offeneSuchen]
  return {
    name: a.name,
    plattform: a.plattform,
    gesamt: a.gesamt,
    /**
     * Staffeln, zu denen weder der Datensatz noch eine Meldung etwas hat.
     *
     * Abgezogen wird, was **jemals** gemeldet wurde, nicht nur das
     * Offene: Sonst wächst die Zahl nach jedem Datenlauf wieder an, weil
     * die übernommenen Meldungen aus dem Briefkasten verschwinden, bevor
     * der nächste Datenbau sie einarbeitet (30.08.2026).
     */
    offen: Math.max(0, a.offen - erledigteAdressen.size),
    /** Adressen, die noch niemand gemeldet hat. */
    titel: offeneZiele.length,
    /** Was davon schon unterwegs ist. */
    unterwegs: unterwegs.size,
    /**
     * Verweise, für die niemand eine Titelseite kennt.
     *
     * Bei Prime sind das 117 Suchadressen — weder AniList noch aniSearch
     * führen für diese Titel eine Produktseite, und weder MOTN noch TMDB
     * kennen eine. Die Erweiterung zeigt auf der Suchseite, welcher Titel
     * gemeint ist; gesucht werden muss er trotzdem von Hand.
     *
     * Der Prüfstand zählt sie seit jeher, der Worker reichte sie nicht
     * weiter — die Anzeige schrieb deshalb „alles geprüft" für einen
     * Anbieter mit dreistelliger offener Arbeit (Daniel, 27.08.2026:
     * „wieso steht in status app oben keine klickbare pill?").
     */
    /*
      Abgezogen wird, was schon gemeldet ist — sonst zählt die Anzeige Arbeit mit, die längst getan ist.

      Am 30.08.2026 stand in der Statusanzeige „58 Suchen", in der
      Erweiterung im selben Moment „122 von 176 offen". Zwei Ursachen hintereinander:
      Der Prüfstand rechnete die Suchaufträge selbst nach, statt die Liste
      zu zählen, die Daniel abarbeitet — und hier wurde nichts abgezogen.

      Beide sind behoben — `suchAdressen` trägt die Liste, `suchOffen()` ebenso.
    */
    ohneSeite: a.suchAdressen
      ? a.suchAdressen.filter((u) => !adresseErledigt(u)).length
      : (a.ohneSeite ?? 0),
    ziel: alleZiele[0]?.url ?? null,
    /*
      **Alle Ziele, nicht die ersten 25** (19.09.2026). Die Erweiterung hält für erledigt, was
      hier nicht steht (`fertig()` → `standZiele`). Mit `slice(0, 25)` zeigte sie bei 37 offenen
      Titeln „25 offen", die Statusanzeige 36 — und ein eben gemeldeter Titel rückte nach dem
      Abzug aus der Liste, ein anderer nach (Daniel). Selbst 384 Ziele wären einige Dutzend KB.
    */
    ziele: alleZiele,
  }
}
