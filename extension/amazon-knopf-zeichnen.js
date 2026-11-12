/**
 * Das Zeichnen des Meldeknopfs auf Amazon (`zeichnenRoh`), aus `amazon.js` herausgelöst (reiner Umbau).
 *
 * Die Funktion liest und ändert Zustand von `amazon.js` (Knopf, Liste, Zähler …). Statt ihn zu kopieren,
 * liegt er als `AK_ZEICHNEN_WELT` bereit: Eigenschaften mit Getter/Setter, die `amazon.js` beim Start
 * füllt. `with` löst jeden bloßen Namen im Rumpf dort auf — der Rumpf blieb dadurch Zeile für Zeile
 * unverändert. Lädt im Manifest vor `amazon.js`; Aufruf: `globalThis.AK_KNOPF_ZEICHNEN()`.
 */
globalThis.AK_ZEICHNEN_WELT = { __proto__: null }
with (globalThis.AK_ZEICHNEN_WELT) {
  globalThis.AK_KNOPF_ZEICHNEN = function zeichnenRoh() {
    /*
      **Auf einer Suchseite gibt es nichts zu melden — in jedem Takt.**

      Eine Trefferliste hat keine Staffel, keine Folgen und keine Kennung. Der
      Knopf stand dort trotzdem, mit wechselndem Text: erst „✕ keine Folgen für
      diese Staffel — melden", dann „Folgen werden geladen …" (Daniel,
      27.08.2026, zwei Bilder). Er kam dorthin, weil ein Auftrag aus der Suche
      seit 3.47 wie ein Listeneintrag zählt — richtig für die Titelseite, auf
      die der Sprung führt, falsch für die Suchseite selbst.

      Die Prüfung steht hier und nicht einmalig beim Aufbau: Der Takt zeichnet
      alle 500 ms neu und setzte die Anzeige jedes Mal zurück.
    */
    /* Während des Sendens gehört der Knopf dem Klick, nicht dem Takt. */
    if (sendetGerade) return

    if (jetztAufSuchseite()) {
      knopf.style.display = 'none'
      gemeldetMarke(false)
      return
    }

    /*
      **Der Takt beginnt ohne Marke — außer dieser Befund ist gemeldet (Sperre) oder alles durch.**
      Ohne die Sperre hier blendeten Zweige den Knopf aus und der Kasten blieb leer (06.09. und 16.10.2026).
    */
    {
      const an = meldeSperre.gesperrt() || durchFuerPfad === location.pathname
      const wegweisung = weiterTextPfad === location.pathname ? weiterText : null
      gemeldetMarke(an, an ? (wegweisung ?? 'gemeldet ✓') : undefined)
    }

    /*
      **Solange Adresse und Quelltext verschiedene Staffeln nennen, wird nicht
      gemeldet.**

      Daniel hat am 28.08.2026 eine Bildschirmaufnahme geliefert (Food Wars,
      Wechsel von Staffel 2 auf 3). Frame für Frame ausgewertet:

          Frame   0– 88   ✓ Staffel 2 gemeldet · weiter mit Staffel 3
          Frame  89–176   🇩🇪 Deutsch · 13 Folgen · Staffel 1 · … · neu · melden
          Frame 177–252   24 von 24 — lädt nach

      Anderthalb Sekunden lang stand der Knopf also auf **meldbar**, für
      **Staffel 1**, mitten in einem Wechsel von 2 auf 3. Ein Klick in diesem
      Fenster hätte die Folgen der alten Staffel unter der neuen gemeldet.

      Die Ursache ist bekannt und steht in CLAUDE.md: Nach einem Wechsel über das
      Auswahlfeld wandert die Adresse sofort, der Quelltext bleibt der alte. Es
      gab dagegen eine Regel, aber sie greift erst, wenn der Mitleser widerspricht
      — und bis dahin liest die Erweiterung den alten Quelltext als frisch.

      Dieser Riegel braucht niemanden, der widerspricht: Zwei Zahlen, beide schon
      berechnet, und wenn sie sich unterscheiden, ist eine davon falsch. Welche,
      spielt keine Rolle — melden darf man in diesem Zustand so oder so nicht.
    */
    try {
      const adrStaffel = staffelAusAdresse()
      const qtStaffel = quelltextPasst() ? staffelAusSeite() : null
      /*
        **Nur solange noch keine Antwort fuer diese Adresse da ist.**

        Bei einem Kanal-Titel bleibt der Quelltext dauerhaft der der alten
        Staffel — dort wuerde ein Riegel auf die blosse Ungleichheit nie wieder
        aufgehen und das Melden fuer immer sperren (die Zusicherungen zu
        „Kill Blue" haben genau das gemeldet). Gemeint ist nur das Fenster
        zwischen Wechsel und erster frischer Antwort.
      */
      const frischeAntwort = gesehen?.fuerAdresse === location.pathname + location.search
      if (!frischeAntwort && Number.isFinite(adrStaffel) && Number.isFinite(qtStaffel) && adrStaffel !== qtStaffel) {
        notiere('staffel-uneins', { adresse: adrStaffel, quelltext: qtStaffel })
        knopf.style.display = ''
        /*
          Derselbe Zustand wie beim Waechter weiter unten, nicht ein zweiter
          eigener: `wechselt` sperrt den Klick, `neuLaden` macht daraus die
          Handlung, die wirklich hilft. Ein eigener Text mit eigenem Zustand
          haette den Knopf gesperrt aussehen lassen und trotzdem gemeldet.
        */
        knopf.dataset.wechselt = 'true'
        knopf.dataset.neuLaden = 'true'
        knopf.dataset.deutsch = 'false'
        knopf.disabled = false
        knopf.textContent = `↻ Staffel ${adrStaffel} gewählt, Seite zeigt ${qtStaffel} — Neuladen`
        return
      }
    } catch {
      /* Fehlt eine der beiden Angaben, greift der Riegel nicht — er ist eine
         Zusatzsicherung, kein Ersatz für die Wächter darunter. */
    }

    /*
      **Eine Staffel ohne Folgenliste hat nichts zu melden.**

      Amazons Einträge für „JoJo's Bizarre Adventure" Staffel 2, 3 und 4 zeigen
      keinen Folgen-Reiter und keine Folgenzahl. Die Widget-Antwort lieferte
      dort trotzdem die Folgen der Nachbarstaffel nach.

      **Die Prüfung hängt sich an eine Messung, die ohnehin läuft.** In 3.74
      stand hier ein eigener `seitenLage()`-Aufruf, und der zieht `seitenHtml()`
      nach sich: bei „Pokémon" mit siebenundfünfzig Staffeln ein Quelltext von
      Megabytegröße, einmal je Takt. Daniels Messung danach: `taktMax: 1377`,
      und die Seite lag lahm (28.08.2026, mit Bericht).

      Weiter unten steht `hatFolgenReiter` schon bereit; dort, im selben Zweig,
      der ohnehin über „keine Folgen" entscheidet, gehört auch dieser Fall hin.
    */
    /*
      **Die Folgenzahl der Seite ist kein Riegel — in keiner Richtung.**

      Bis 3.77 sperrte hier ein Vergleich mit der erwarteten Zahl, sobald sie um
      mehr als ein Viertel abwich. An einem Nachmittag hat Daniel beide Richtungen
      widerlegt (28.08.2026, zwei Bilder):

      | Titel | Seite | erwartet | was wirklich vorliegt |
      |---|---|---|---|
      | Captain Tsubasa (2018) | 91 | 52 | Prime **bündelt** beide Staffeln |
      | Chibi Maruko-chan | 52 | 142 | Prime **teilt**, wir führen eine Reihe |

      Beide Male sagte der Knopf „andere Staffel wählen", und beide Male gab es
      keine andere Staffel, die die erwartete Zahl zeigt. Prime schneidet Reihen
      anders zu als AniList — mal zusammen, mal auseinander. Eine Abweichung ist
      damit der Normalfall und kein Verdacht.

      **Aufgelöst wird das im Bau, nicht hier** (siehe `docs/prime-erfassung-neu.md`).
      Die Meldung trägt seit 3.77 jede Folge einzeln mit Nummer, Titel, Datum und
      Laufzeit; `pipeline/fetch-rohfolgen.ts` legt sie über TMDBs Folgentitel und
      Erstausstrahlungsdaten auf unsere Zählung. Ein Riegel hier hält genau die
      Daten zurück, die diese Zuordnung möglich machen.

      **Was bleibt, ist der Hinweis.** Die Zeile nennt beide Zahlen, damit Daniel
      sieht, dass die Seite anders schneidet; gemeldet werden darf trotzdem. Die
      echten Riegel stehen weiterhin: `falscheStaffel` vergleicht die Staffel im
      Titel mit der offenen, `quelltextPasst()` fängt den Titelwechsel — beides
      Prüfungen an der Sache, nicht am Zahlenverhältnis.
    */
    const auftragJetzt = eintrag?.ausSuche ? suchauftrag() : null
    if (auftragJetzt?.folgen && Number.isFinite(gesehen?.gesamt) && gesehen.gesamt > 0) {
      if (gesehen.gesamt !== auftragJetzt.folgen) {
        notiere('andere-folgenzahl', { erwartet: auftragJetzt.folgen, hier: gesehen.gesamt })
      }
    }
    /*
      **Einmal berechnen, mehrfach lesen.**

      `quelltextPasst()` zieht `spuren()`, `quelltextVeraltet()` und darueber
      `seitenTitel()` mit sich. Bis zum 25.08.2026 lief es je Takt zwei- bis
      dreimal, weil auch das Diagnosefeld es noch einmal aufrief.
    */
    const passt = quelltextPasst()
    const istVeraltet = quelltextVeraltet()
    /*
      **Der Quelltext wird nicht mehr gelesen — auch nicht für die Gesamtzahl.**

      Daniel am 25.08.2026: „wieso reagiert der button immer noch auf folgen
      wenn ich ausklappe? der parser muss aus, das haben wir über das hydrated."

      Er hat recht. `spuren()` lief bis dahin in jedem Takt über 2,2 Millionen
      Zeichen — und beim Ausklappen eines Abschnitts änderte sich der gerenderte
      Inhalt, also änderte sich auch, was das Muster fand. Der Knopf zuckte,
      obwohl die Daten längst aus dem Hydration-Block kamen.

      Die Gesamtzahl steht dort ebenfalls (`metadata.episodeCount`, bei
      „Yu-Gi-Oh! ZEXAL" Staffel 2: „74 Folgen"). Gebraucht wird der Quelltext
      nur noch für die Lage der Seite — Fehlerseite, Störung — und dafür genügt
      ein Blick auf wenige Wörter.
    */
    const jetzt = { sprachen: new Set(), nummern: new Set(), gesamt: gesehen.seite?.folgenGesamt ?? null, jeFolge: new Map() }
    /*
      **Der Quelltext füttert den Zählstand nicht mehr — und das ist der Kern.**

      Daniel am 25.08.2026, nachdem der Knopf bei „Kill Blue" erst „Folge 1–4"
      und Sekunden später „12 Folgen" zeigte: „ich hab gesagt raus mit alter
      rein mit neuer."

      Er hat recht, und die Meldung id1347 belegt es: Sie kam pauschal an —
      `folge_nr: null`, zwölf Folgen, `dub`. Die Widget-Antwort hatte die
      Aufteilung korrekt geliefert (1–4 deutsch, 5–12 nicht); die
      Quelltext-Fütterung hier hat sie im nächsten Takt wieder plattgemacht,
      weil der Quelltext bei einem Kanal-Titel für **jede** Folge dieselben
      Sprachen führt.

      Der Zählstand kommt deshalb ausschließlich aus den Widget-Antworten:
      gültiges JSON, je Folge, mit der Adresse, zu der es gehört. Der Quelltext
      wird für die Sprachen gar nicht mehr gelesen.

      Auskommentiert statt gelöscht, bis alle Fälle belegt sind — der Film-Weg
      läuft über den Hydration-Block, und für Serien holt der Leser die Liste
      beim Seitenaufruf selbst.

      for (const s of jetzt.sprachen) gesehen.sprachen.add(s)
      for (const n of jetzt.nummern) gesehen.nummern.add(n)
      for (const [nr, namen] of jetzt.jeFolge) gesehen.jeFolge.set(nr, namen)
    */

    /*
      Die Gesamtzahl bleibt: Sie sagt, worüber ein Befund reicht, und steht im
      Seitengerüst noch, bevor die erste Antwort da ist. Sprachen macht sie
      keine.
    */
    if (!gesehen.gesamt && Number.isFinite(jetzt.gesamt)) gesehen.gesamt = jetzt.gesamt
    /**
     * Eine geänderte Folgenzahl ist selbst ein Staffelwechsel.
     *
     * Vorher wurde sie nur übernommen, solange keine dastand — danach war sie
     * eingefroren. Erkannte `beiStaffelwechsel()` den Wechsel nicht rechtzeitig,
     * blieb die alte Zahl für immer stehen, und die gezählten Folgen der alten
     * Staffel zählten weiter mit.
     *
     * Jetzt entscheidet die Tatsache statt der Erkennung: Ändert sich die Zahl,
     * beginnt der Zählstand von vorn. Das ist die Rückfallebene, die auch dann
     * greift, wenn Amazon eine Umschaltung erfindet, an die hier niemand gedacht
     * hat.
     */
    /**
     * Was die Seite anzeigt, schlägt jede geerbte Zahl.
     *
     * Ohne diese Zeile blieb `gesehen.gesamt` auf dem Wert der vorigen
     * Staffel stehen, sobald der Quelltext taub geworden ist — er liefert dann
     * keine neue Zahl mehr, mit der die Regel darunter sie ersetzen könnte.
     * Der Knopf zeigte „3 von 26" für eine Staffel mit einer Folge.
     */
    const lautSeite = seitenLage().folgenLautSeite
    /**
     * **Ohne Gesamtzahl ist jede Teilmenge "vollstaendig".**
     *
     * Faellt der Quelltext als Quelle weg, kommt von dort auch keine
     * Folgenzahl mehr — und `vollstaendig` ergibt sich aus
     * `!gesehen.gesamt`, ist also wahr. Der Knopf meldete daraufhin "3 Folgen"
     * fuer JoJos Staffel 3, waehrend die Seite darueber "48 Folgen" schreibt
     * und der Abschnitt 25-48 gerade erst lud.
     *
     * Die Zahl der Seite fuellt die Luecke, sobald es eine gibt.
     */
    if (lautSeite && (!gesehen.gesamt || (lautSeite !== gesehen.gesamt && !quelltextPasst()))) {
      gesehen.gesamt = lautSeite
    }
    /*
      **Der letzte Ort, an dem der Quelltext den Zählstand anfasste.**

      Wich die Folgenzahl im Quelltext von der bekannten ab, galt das als
      Staffelwechsel, und `sprachen` und `nummern` wurden mit den
      **Quelltext**-Werten überschrieben. Nach dem Umbau auf die Widget-Antworten
      ist das genau verkehrt herum: Der Quelltext ist die veraltete Quelle.

      Gemessen am 25.08.2026 an einem Staffelwechsel, bei dem nur der Parameter
      wandert: Der Empfänger trug korrekt fünf Folgen ein, und eine Zeile später
      standen wieder zwölf da — die des Quelltexts, der noch zur vorigen Staffel
      gehörte.

      Ein Wechsel wird jetzt an der Adresse erkannt, und die steht im Empfänger.
      Bleibt allein die Frist, die den Knopf nach einer geänderten Zahl kurz
      ruhig hält.

        gesehen.sprachen = new Set(jetzt.sprachen)
        gesehen.nummern = new Set(jetzt.nummern)
    */
    /*
      **Eine Abweichung ist kein Ereignis — eine Änderung ist eins.**

      Bis 3.80 stieß jeder Takt die Ruhefrist neu an, solange `jetzt.gesamt` von
      `gesehen.gesamt` abwich. Nach einem Staffelwechsel weicht sie dauerhaft ab:
      Der Quelltext ist der der alten Staffel (siehe „Der Quelltext veraltet beim
      Staffelwechsel"), und der nennt eine andere Zahl als die Widget-Antwort der
      neuen.

      Gemessen an Daniels Bericht vom 28.08.2026 (Digimon Adventure, Staffel 2):

          Quelltext (Staffel 1, veraltet)   54 Folgen
          Zählstand (Staffel 2, Antwort)    50 Folgen, 48 gelesen
          letzterFortschritt                steht seit 20 Sekunden

      `gesamtGeaendertAm` wurde damit alle 500 ms erneuert, `zahlenStehen` konnte
      nie wahr werden — und weil es in der Signatur steht, stieg `zeichnen()` bei
      jedem Takt vorzeitig aus. Die Freigabe nach zwölf Sekunden stand hinter
      diesem Ausstieg und wurde nie erreicht. Der Knopf blieb für immer auf
      „Staffel wechselt — einen Moment".

      Der Merker unterscheidet beides: Erst wenn der Quelltext eine **andere**
      Zahl nennt als beim letzten Mal, ist etwas passiert.
    */
    if (jetzt.gesamt && jetzt.gesamt !== gesehen.gesamt) {
      if (gesehen.gesamt && jetzt.gesamt !== letzteQuelltextGesamt) {
        gesamtGeaendertAm = Date.now()
        gemeldeteStaffel = null
      }
      letzteQuelltextGesamt = jetzt.gesamt
      /*
        Die Gesamtzahl aus dem Quelltext gilt nur, solange keine Antwort da ist.
        Sonst gewinnt die Antwort — sie meint die Folgenliste, um die es geht.
      */
      if (!gesehen.fuerAdresse) gesehen.gesamt = jetzt.gesamt
    }

    /**
     * **Der innere Zustand, auslesbar ohne Skript.**
     *
     * Der 25.08.2026 ging zu einem guten Teil damit hin, aus dem Verhalten des
     * Knopfes auf seinen Zustand zurückzuschließen — mit Messskripten, die
     * Daniel jedes Mal neu einfügen musste, und dreimal mit einer Vermutung,
     * die nicht trug. Der letzte Mitschnitt belegte, dass der Abruf ankommt
     * (16.780 Bytes, richtige Kennung) — was die Erweiterung damit macht, war
     * von außen weiter unsichtbar.
     *
     * Ab hier steht es am Knopf selbst:
     *
     *     JSON.parse(document.querySelector('.ak-amazon-knopf').dataset.diag)
     *
     * Das kostet einen `JSON.stringify` je Takt über ein Objekt mit sieben
     * Zahlen — nichts gegen den Quelltext, der ohnehin gelesen wird.
     */
    setzData(knopf, 'diag', JSON.stringify({
      folgen: gesehen.nummern.size,
      gesamt: gesehen.gesamt,
      sprachen: sprachenAusFolgen(),
      lautSeite,
      // Gelesen, nicht gerechnet — beide stehen oben schon fest. Ein erneuter
      // Aufruf zoege spuren() und seitenTitel() ein weiteres Mal mit.
      quelltextPasst: passt,
      quelltextVeraltet: istVeraltet,
      // Steht hier false, gehoert der Quelltext zu einem anderen Titel.
      kennungBekannt: kennungImQuelltextBekannt(),
      // Welche Folge welche Tonspuren traegt — daraus entstehen die Bereiche.
      jeFolge: Object.fromEntries(gesehen.jeFolge),
      frischeStaffel,
      ausSeite: asinAusSeite(),
      ausAdresse: asinAusAdresse(),
      // asin() faellt auf den Quelltext zurueck — hier steht es getrennt daneben,
      // damit die Diagnose nicht zweimal dieselbe Quelle zeigt.
      asinGemischt: asin(),
      quelltextZeichen: seitenHtml().length,
      /*
        **Die Taktmesswerte stehen hier nicht mehr.**

        `taktMs`, `taktSchnitt`, `taktMax` und `takte` ändern sich bei jedem
        Durchlauf. In einem DOM-Attribut heißt das: zweimal je Sekunde eine
        Mutation, auch wenn fachlich nichts passiert ist — im Elements-Tab ein
        Dauerflackern (Daniel, 30.08.2026, mit Video).

        Gebraucht werden sie im Diagnosebericht, und dort stehen sie weiterhin.
        Ein Attribut ist zum Nachsehen da, nicht zum Mitschreiben.
      */
    }))
    /**
   * **Der Befund kommt aus den Folgen, nicht aus dem Sammel-Set.**
   *
   * Daniel am 30.08.2026 an „Hell Mode": Staffel 2 wurde als „19 Folgen,
   * Deutsch" gemeldet — und sein Diagnosebericht zeigt für **jede** der 21
   * gelesenen Folgen nur `["日本語"]`. Deutsch stand allein im Sammel-Set
   * `gesehen.sprachen`. Vier Sekunden vor der Staffel-1-Meldung sagte der Knopf
   * außerdem „✕ kein Deutsch · 12 Folgen · Staffel 1", die Meldung trug
   * trotzdem `dub`.
   *
   * Das Set sammelt über alles, was je eingegangen ist; die Folgenliste sagt,
   * was auf **dieser** Seite steht. Wo es Folgendaten gibt, entscheiden sie —
   * das ist dieselbe Regel, die dieses Projekt bei Crunchyroll längst zieht
   * („der lauf muss jede folge individuell prüfen").
   *
   * Das Sammel-Set gibt es nicht mehr; auch ein Film trägt seine Tonspuren als
   * Einheit 1 in `jeFolge`. Der Sendeweg liest dieselbe Quelle.
   */
    const deutsch = deutschInFolgen()
    const geladen = geladeneFolgen()
    if (geladen !== letzteZahl) {
      letzteZahl = geladen
      letzterFortschritt = Date.now()
    }
    /**
     * Auf eine Fehlerseite wartet niemand acht Sekunden.
     *
     * Daniel am 24.08.2026: "warum dauert es so lange bis 'nicht abrufbar'
     * kommt auf dem button fuer diese seiten wo nichts ist?" -- Die Geduldsfrist
     * gilt dem Nachladen: Amazon holt lange Folgenlisten abschnittsweise, und
     * wer zu frueh urteilt, haelt 24 von 51 Folgen fuer alles.
     *
     * Eine Seite, die gar keine Titelseite ist, laedt aber nichts nach. Amazon
     * antwortet dort mit "Die eingegebene Webadresse ist keine funktionsfaehige
     * Seite auf unserer Website" -- und wo dieser Satz steht, ist die Frage
     * sofort beantwortet.
     */
    /**
     * Gelesen wird beides — sichtbarer Text und Quelltext.
     *
     * `innerText` gibt es nur, wo etwas gerendert ist; der Hinweis steht aber
     * auch in der ausgelieferten Seite. Wer nur eine der beiden Quellen nimmt,
     * verpasst den Fall, in dem die andere ihn trägt.
     */
    const lage = seitenLage()
    const { fehlerseite, stoerung, nichtAbrufbar } = lage

    /**
     * **Eine gesperrte Folge sperrt nicht die Staffel.**
     *
     * Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 2, mit Bild: Der Knopf
     * schrieb „✕ in dieser Region nicht mehr verfügbar — melden", obwohl
     * „1. Party Panic" und „2. Roller Duel!" direkt daneben abrufbar sind.
     *
     * `seitenLage().regionWeg` sucht die Meldung im **ganzen** Quelltext. Steht
     * sie irgendwo — und bei dieser Staffel steht sie zwölfmal —, galt die
     * ganze Seite als weg. Das war richtig, solange die Erweiterung nichts
     * Genaueres wusste; seit 2.5 weiß sie es je Folge.
     *
     * Gemessen an derselben Seite: 24 Folgen, davon 12 gesperrt und 12
     * abrufbar. Weg ist die Staffel nur, wenn **keine** übrig bleibt.
     */
    const gesperrteFolgen = gesehen.gesperrt?.size ?? 0
    const offeneFolgen = gesehen.nummern.size
    const regionWeg = globalThis.akPrimeStaffelRegionWeg(gesperrteFolgen, offeneFolgen, lage.regionWeg)

    /**
     * „Nicht mehr in deiner Region" ist eine Auskunft, ein Fehler ist keine.
     *
     * Beide Sätze am 24.08.2026 an „Chaika" belegt (Daniel, mit Bild):
     * Staffel 1 trägt „In deiner Region nicht mehr auf Prime Video verfügbar" —
     * das ist `available: false`, und der Knopf wartete stattdessen auf
     * Tonspuren, die nie kommen. Staffel 2 trug „Bei der Verarbeitung deiner
     * Anfrage ist ein Fehler aufgetreten", obwohl sie mit Prime ansehbar ist —
     * der Knopf meldete daraufhin „nicht abrufbar".
     *
     * Eine Störung darf nie zu einem Befund werden. Es ist derselbe
     * Unterschied, den dieses Projekt an fremden Quellen einfordert: Schweigen
     * ist kein Nein.
     */
    const wartet = !fehlerseite && Date.now() - letzterFortschritt < GEDULD_MS
    /**
     * Die Beruhigungsfrist gehört in die Signatur — sonst läuft sie ins Leere.
     *
     * `zeichnen()` steigt früh aus, wenn sich am Stand nichts geändert hat. Die
     * Frist ändert daran nichts: Sie läuft ab, ohne dass Sprache, Folgenzahl
     * oder Gesamtzahl anders werden. Der Knopf blieb deshalb für immer auf
     * „Staffel wechselt — einen Moment" stehen — „staffel längst gewechselt,
     * trotzdem steht das dort … auch nach 2min passiert nix" (Daniel,
     * 24.08.2026).
     *
     * Eine Anzeige, die von der Zeit abhängt, braucht die Zeit in ihrer
     * Signatur. Sonst ist der Ablauf ein Ereignis, das niemand bemerkt.
     */
    const zahlenStehen = Date.now() - gesamtGeaendertAm > RUHE_MS
    /*
      **Jede zeitabhängige Anzeige gehört in die Signatur — auch die zweite.**

      Der Kommentar darüber hat genau diese Lehre für `zahlenStehen` gezogen. Die
      Freigabe nach zwölf Sekunden (`langeStill`, weiter unten) hängt an
      `letzterFortschritt` und stand nicht darin — sie war damit vom selben
      Ausstieg betroffen, gegen den die erste Regel gebaut wurde.

      Am 28.08.2026 hat das den Staffelwechsel bei Digimon Adventure blockiert:
      Der Zustand war seit zwanzig Sekunden unverändert, also stieg `zeichnen()`
      aus, also lief die Prüfung nicht, die genau diesen Stillstand auflösen
      sollte. Eine Regel, die nur greift, während sich etwas bewegt, greift nie
      bei Stillstand — und für den ist sie gedacht.
    */
    const freigabeReif = Date.now() - letzterFortschritt > WARTE_FRIST_MS
    /*
      **Und die dritte Schwelle gehört genauso hinein.**

      Der Warte-Zweig weiter unten wechselt nach acht Sekunden von „Folgen
      werden geladen …" auf „Tonspuren nicht gefunden — Seite neu laden". Diese
      Schwelle stand nicht in der Signatur, `freigabeReif` kippt aber erst nach
      zwölf — der Satz kam also vier Sekunden zu spät, und wenn sich in der
      Zwischenzeit sonst nichts rührte, stand der Knopf so lange auf „lädt".

      Es ist derselbe Fehlgriff, den die beiden Kommentare darüber schon
      zweimal beschrieben haben. Beim dritten Mal gehört er nicht noch einmal
      erzählt, sondern abgestellt: **Jede Frist, die einen Text ändert, steht
      in der Signatur.**
    */
    const ladeFristReif = Date.now() - letzterFortschritt > 8000
    const stand = globalThis.akPrimeZeichenStand(deutsch, geladen, gesehen.gesamt, wartet, zahlenStehen, freigabeReif, ladeFristReif, standGeladen)
    if (stand === letzterStand) return
    letzterStand = stand
    try {
      knopf.title = zustandAlsText()
    } catch {
      /* Die Diagnose darf den Knopf nie aufhalten. */
    }

    knopf.dataset.deutsch = String(deutsch)
    /**
     * Kommt nichts, ist auch das eine Auskunft — nach einer Wartezeit.
     *
     * Der Knopf blieb gesperrt mit „Tonspuren noch nicht geladen", und bei
     * einer Seite, die es nicht mehr gibt, wartet man damit ewig: „tote links
     * in der liste kann ich nicht melden".
     *
     * Erst nach der Geduldsfrist — solange kann Amazon legitim nachladen —
     * wird daraus ein Angebot. Gemeldet wird dann `nichtAbrufbar`, nicht „kein
     * Deutsch": Das eine heißt „gibt es nicht", das andere „gibt es, aber
     * nicht auf Deutsch", und der Unterschied steht seit dem 20.08.2026 im
     * Datensatz.
     */
    knopf.disabled = geladen ? false : wartet
    /**
     * **Diese Prüfung steht ganz vorn, und das ist der Punkt.**
     *
     * Bis zum 25.08.2026 lag sie hinter dem Zweig für „keine Folge gelesen".
     * Wer einen Titel öffnete, den unsere Liste nicht führt, bekam dort „keine
     * Folgen für diese Staffel — melden" angeboten — eine Meldung zu einem
     * Verweis, den es bei uns gar nicht gibt. Daniel an JoJos Staffel 2:
     * „it should say nicht auf prüfliste".
     *
     * Ob eine Seite Folgen hergibt, ist erst interessant, wenn überhaupt etwas
     * zu tun ist. Die Frage davor ist immer: Steht dieser Titel auf der Liste?
     */
    /**
     * Was nicht auf der Prüfliste steht, wird nicht geprüft.
     *
     * Daniel am 25.08.2026: „alle die zu prüfen sind sollten als info
     * ausreichen, wenn der titel kein zu prüfender ist, sollte keine prüfung
     * möglich sein, so einfach, es muss keine altdaten stand behalten werden."
     *
     * Der erste Anlauf war eine zweite Liste mit den bereits geprüften Titeln,
     * damit sich „erledigt" von „unbekannt" unterscheiden lässt. Das war eine
     * Antwort auf eine Frage, die sich gar nicht stellt: **Die Prüfliste sagt
     * bereits, was zu tun ist.** Alles andere ist nichts zu tun — aus welchem
     * Grund auch immer.
     *
     * Damit fällt die Entscheidung vom 23.08.2026, auch unbekannte Staffeln
     * melden zu lassen. Sie hat einmal geholfen („Oshi no Ko" Staffel 3 kam so
     * in den Bestand), aber sie kostet mehr, als sie bringt: Ein Knopf, der
     * überall etwas anbietet, bietet es auch dort an, wo längst alles geklärt
     * ist. Fehlt uns eine Staffel wirklich, fällt das über die Serie auf — der
     * Listenschlüssel sucht sie auch über den Serientitel.
     */
    /*
      **Ein Suchauftrag zählt wie ein Listeneintrag; eine unbekannte Prime-Seite darf melden** (F109 = A, 07.11.2026,
      vorher „Weg statt grau"): Der Bau ordnet sie zu oder legt sie in die Liste ohne Zuordnung. Weg bleibt der Knopf nur
      auf Seiten ohne Prime-Video-Merkmal und ohne geladene Prüfliste (`akPrimeKnopfVersteckt`).
    */
    if (meldenVersteckt()) {
      knopf.style.display = 'none'
      return
    }
    knopf.style.display = ''

    /**
     * **Ein Knopf, der zur alten Seite gehört, wird nicht angeboten.**
     *
     * Der Zweig steht vor allen anderen, weil jede Auskunft darunter aus dem
     * Quelltext stammt: Folgenzahl, Tonspuren, Staffelnummer. Gehört der zur
     * verlassenen Seite, ist nicht nur die Beschriftung falsch — die Meldung
     * wäre es auch.
     *
     * Er löst sich von selbst, sobald Amazon nachgezogen hat; ein Neuladen
     * verlangt er deshalb nicht.
     */
    if (quelltextVonFruehererSeite() || globalThis.akPrimeKennungAlt(document.querySelector('.ak-amazon-suchhinweis .ak-meldet')?.dataset?.kennung, asinAusAdresse())) {
      knopf.disabled = true
      knopf.textContent = 'Seite wechselt …'
      knopf.title = 'Die Angaben gehören noch zur vorigen Seite. Einen Augenblick.'
      return
    }

    if (!geladen) return zeichnenUngeladen({ stoerung, fehlerseite, regionWeg, nichtAbrufbar, wartet, ladeFristReif })
    knopf.dataset.tot = 'false'
    /**
     * Folgen, die in dieser Region nicht mehr laufen, fehlen nicht — sie sind weg.
     *
     * „Mahouka" Staffel 2 führt dreizehn Folgen, zwei davon tragen den
     * Regionshinweis in ihrer Kachel. Der Quelltext nennt für sie keine
     * Tonspur, also zählte der Knopf elf und verlangte, die fehlenden
     * „Abschnitte selbst zu öffnen" — Abschnitte, die es nicht gibt. Daniel am
     * 25.08.2026: „einmal das kaputte 11/13".
     *
     * Was die Seite als gesperrt ausweist, ist damit beantwortet: Es kommt
     * nichts mehr nach. Die Staffel gilt als vollständig gelesen, und die
     * Notiz der Meldung nennt die betroffenen Folgen.
     */
    const wegInRegion = globalThis.akPrimeGesperrteZahl(gesehen.gesperrt, seitenLage().regionFolgen)
    /**
     * **Prime teilt eine Staffel in Bände — die Zahl gilt dann für beide.**
     *
     * Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 3, Band 2
     * (`B0FHGJ7KS1`), mit Bild: „extension erwartet 96, ausklappbar sind nur
     * 48, weil prime es in 2 volumes gesplittet hat."
     *
     * Die Staffelliste nennt sie beim Namen — „Season 3, Volume 2" mit
     * `sequenceNumber: 3` —, aber `metadata.episodeCount` sagt „96 Folgen"
     * für die **ganze** Staffel. Erreichbar sind von dieser Seite aus vier
     * Abschnitte (1–8, 9–16, 17–25, 25–48). Wer auf 96 wartet, wartet ewig.
     *
     * **Vollständig ist deshalb, wenn kein Abschnitt mehr aussteht**, nicht
     * wenn eine Zahl erreicht ist. Das weiß der Leser: Er kennt jedes Token,
     * das die Seite genannt hat, und welche davon er geholt hat. Ein
     * Textmuster auf „Volume" bräuchte es dafür nicht — und wäre bei der
     * Mischung aus „Staffel 1, Band 2" und „Season 1, Volume 2" in derselben
     * Liste ohnehin unzuverlässig.
     */
    const vollstaendig = istVollstaendig(
      gesehen.abschnitte,
      geladen + wegInRegion,
      gesehen.gesamt,
      Date.now() - letzterFortschritt,
    )
    // Die Zahl sagt, worüber der Befund wirklich etwas aussagt — nie mehr.
    /**
     * Ein Film ist keine Folge.
     *
     * „1 Folgen" stand am Knopf bei „Sing a Bit of Harmony" (Daniel,
     * 23.08.2026, mit Bild) — falsch in beidem: Es ist keine Serie, und der
     * Plural stimmt auch nicht. Erkannt wird der Film daran, dass die Seite
     * keine Folgenzahl nennt und genau eine Einheit gezählt wurde.
     */
    /*
      Bis 3.78 verlangte die Anzeige `!gesehen.gesamt`. „Blood-C" nennt im
      Seitengerüst „1 Folge", und diese Eins landet über Zeile 3759 im Zählstand
      — der Film hätte danach „1 Folge" am Knopf getragen statt „Film".
    */
    const istFilm = (istFilmSeite() || !gesehen.gesamt) && geladen === 1
    const umfang = istFilm
      ? 'Film'
      : vollstaendig
        ? `${geladen} ${geladen === 1 ? 'Folge' : 'Folgen'}`
        : regionWeg
          ? // Was fehlt, ist gesperrt — die Zahl sagt, worüber der Befund gilt.
            `${geladen} von ${gesehen.gesamt}, Rest nicht in Region`
          : `${geladen} von ${gesehen.gesamt}` +
            (wartet ? ' — lädt nach' : ' — Abschnitte selbst öffnen')
    // Bei einem Kanal-Titel ist die Angabe ein Hinweis, kein Beleg.
    const kanalHinweis = ueberKanal() ? ' · ⚠ Kanal' : ''
    // Die Zugangsart gehört an den Knopf — sonst meldet man sie blind mit.
    const art = zugangsart()
    /*
      **Steht dieselbe Staffel zweimal im Angebot, gilt der Preis nur hier.**

      Bei „Mob Psycho 100 II" führte die geöffnete Seite Staffel 2 als reinen
      Kauftitel, eine zweite Ausgabe derselben Staffel lief über ein Kanal-Abo —
      gemeldet wurde „nur Kauf". Der Zusatz steht am Knopf,
      damit das **vor** dem Klick sichtbar ist und nicht erst im Datensatz.
    */
    const mehrereAusgaben = ausgabenDieserStaffel() > 1
    const zugang =
      (art && art !== 'abo' ? ` · ${ZUGANG_TEXT[art]}` : '') + (mehrereAusgaben ? ' (diese Ausgabe)' : '')

    /**
     * Solange der gespeicherte Stand fehlt, wird nichts angeboten.
     *
     * `speicherLesen` ist asynchron; in den ersten Millisekunden nach dem Laden
     * ist `erledigt` leer, und der Knopf lud zum Melden ein, obwohl der Titel
     * längst durch war — „ich hab auf chaika link geklickt, ohne was zu machen
     * nach paar sek steht da noch 1 staffel". Sein
     * Vorschlag, und er ist richtig: Der Knopf soll in dieser Zeit sagen, was
     * er tut, und nicht klickbar sein.
     *
     * Der Klick wartet zwar seit 0.66 auf den Stand — aber ein Knopf, der
     * „melden" anbietet und dann seine Meinung ändert, ist trotzdem falsch.
     */
    if (!standGeladen) {
      knopf.disabled = true
      knopf.textContent = 'prüfe Melde-Status …'
      knopf.dataset.deutsch = String(deutsch)
      return
    }
    const jetzigeStaffel = staffelSchluessel()
    const abgehakt = erledigt[listenId]
    const schonGemeldet = Boolean(abgehakt?.staffeln?.[jetzigeStaffel])
    /**
     * „Alles gemeldet" verlangt zweierlei — und der zweite Teil ist der
     * wichtigere.
     *
     * Die Zahl allein trägt nicht: `gesamt` entsteht aus „N Staffeln" im
     * Seitentext, und stand der beim Speichern noch nicht da, blieb eine 1
     * stehen. Der Knopf sagte dann „alles gemeldet" auf einer Seite, deren
     * Staffel gar nicht im Bestand war — bei „Barbapapa" mit dem Tooltip
     * „Gemeldet: S2 · Es fehlen: S1" direkt daneben.
     *
     * Deshalb zählt zusätzlich die einfache Frage: Ist **diese** Staffel dabei?
     * Wenn nicht, ist hier etwas zu tun, ganz gleich was die Zahl sagt.
     */
    /*
      **Ein offener Auftrag schlägt „alles gemeldet".**

      Daniel am 30.08.2026 an „Danganronpa 3 — Future & Despair": „vorher stand
      bereits alles gemeldet, ich klick 1-12 danach steht immer noch alles
      gemeldet." Unter dieser Adresse war der **Despair Arc** gemeldet; der
      **Future Arc** stand als eigener Auftrag offen, und Prime führt beide auf
      derselben Seite.

      Der Abhak-Speicher kennt nur Adresse und Staffel — für ihn war die Sache
      erledigt. Die Prüfliste weiß es besser: Steht der Auftrag, der gerade
      verfolgt wird, noch nicht im Briefkasten, ist hier etwas zu tun.
    */
    const auftragOffen = (() => {
      try {
        const a = suchauftrag()
        return Boolean(a?.suchUrl && !istGemeldet(a.suchUrl))
      } catch {
        return false
      }
    })()
    /*
      **Und auch hier: eine Seite, die der Briefkasten nicht führt, ist offen.**

      Der dritte von drei Sperrzweigen. Die beiden anderen bekamen `seiteOffen()`
      am 02.09.2026, dieser blieb — und genau er griff auf der aniverse-Seite:
      Die Checkliste zeigte ○ (offen), der Knopf daneben „alles gemeldet".

      Ein Riegel, der an zwei von drei Stellen sitzt, ist keiner (dieselbe Lehre
      wie bei der Wiedervorlage am 01.09.2026).
    */
    /*
      **Ohne Antwort von Stand und Briefkasten gilt nichts als erledigt.** Vorher
      fiel `fertig()` auf Meldungen aller Zeiten zurück und `seiteOffen()` auf
      „nicht offen" — genau in den ersten Sekunden nach dem Laden.
    */
    const datenDa = standZiele !== null && briefkastenSeiten !== null
    /*
      **Das Auswahlfeld zählt mit** (Daniel, 17.09.2026, Kuroko): Die Prüfliste
      kannte nur Staffel 1, also galt die Seite nach deren Meldung als fertig —
      obwohl das Auswahlfeld eine zweite, ungemeldete Staffel anbot.
    */
    const auswahlOffen = (() => {
      try {
        const zahl = staffelZahl()
        return Number.isFinite(zahl) && zahl > Object.keys(staffelnDerSerie(listenId)).length
      } catch {
        return false
      }
    })()
    const alleDurch =
      datenDa && Boolean(abgehakt) && schonGemeldet && fertig(listenId) && !auftragOffen && !seiteOffen() && !auswahlOffen
    if (!alleDurch && durchFuerPfad === location.pathname) {
      durchFuerPfad = null
      weiterText = null
    }

    /**
     * Alles durch — dann gibt es hier nichts mehr zu tun.
     *
     * Der Knopf blieb bisher anklickbar und lud dazu ein, dieselbe Staffel
     * noch einmal zu melden.
     */
    if (alleDurch) {
      /*
        **Rot heißt „hier ist nichts mehr" — das Gegenteil dessen, was hier steht.**

        `dataset.tot` blieb stehen, wie der Zustand davor ihn hinterlassen hatte,
        und der Knopf zeigte ein rotes „✓ alles gemeldet" (02.09.2026, Video
        19:09). Derselbe Fehler wie am 25.08.2026 an einer anderen Stelle — dort
        wurde er behoben, hier nicht.
      */
      /*
        **„Alles gemeldet" braucht keinen Knopf — die Checkliste sagt es schon.**

        Daniel am 02.09.2026: „alles gemeldet kann komplett entfernt werden,
        weil es durch die checkbox box schon klar ist das alles gemeldet wurde."
        Ein Knopf, der nichts auslöst, ist Fläche ohne Handlung; die Haken in
        der Zeile darüber stehen ohnehin da und sagen dasselbe genauer.
      */
      knopf.style.display = 'none'
      knopf.disabled = true
      knopf.dataset.deutsch = String(deutsch)
      /*
        **Der Knopf geht, die Auskunft bleibt.**

        Am 02.09.2026 wurde „alles gemeldet" bewusst entfernt: „kann komplett
        entfernt werden, weil es durch die checkbox box schon klar ist das alles
        gemeldet wurde." Das stimmt — **wo eine Checkliste steht**. Bei einem
        Film gibt es keine: Dort blieb nach der Meldung nur die bloße Hülle
        übrig, und nichts sagte mehr, dass etwas passiert ist (Daniel,
        06.09.2026: „nach meldung verschwindet der button, stattdessen soll der
        button wie vorher mit checkmark zeigen das gemeldet wurde").

        Die Marke steht links in der Fußzeile — derselbe Platz, den sie seit dem
        02.09.2026 hat: „gemeldet links (besonders gestyled) und anisearch
        rechts".
      */
      /*
        **Der Zweig merkt sich den Pfad, statt die Marke nur zu setzen.**

        In 4.13.6 tat er nur das Zweite — und der Takt darüber nahm sie sofort
        wieder weg, weil `gemeldetFuerPfad` leer war. Ergebnis: Die Marke
        erschien und verschwand im Halbsekundentakt.

        Zwei Stellen, die dieselbe Anzeige aus verschiedenen Quellen speisen,
        laufen garantiert auseinander. Es gibt jetzt nur noch eine Quelle: den
        Pfad-Merker. Wer die Marke will, setzt ihn — angezeigt wird sie oben.
      */
      durchFuerPfad = location.pathname
      weiterText = null
      gemeldetMarke(true, 'gemeldet ✓')
      return
    }

    /**
     * Diese Staffel steht schon im Bestand — kein zweites Mal.
     *
     * „prevent repeat reports of already reported seasons". Eine zweite
     * Meldung derselben Staffel bringt nichts Neues und kostet einen Zugriff;
     * schlimmer noch, sie kann einen guten Befund durch einen schlechteren
     * ersetzen, wenn beim zweiten Mal weniger Folgen geladen waren.
     *
     * Der Unterschied zum Fall darüber: Hier sind **andere** Staffeln noch
     * offen, der Knopf sagt also, wie viele.
     */
    /*
      **Was nicht angekommen ist, gilt nicht als gemeldet — auch am Knopf.**

      Daniel am 30.08.2026: „eintrag der ‚nicht angekommen' ist angeklickt, da
      steht alles gemeldet, wie soll ich das erneut melden?" Die Liste hatte die
      Regel seit demselben Tag, der Knopf nicht: Er las allein den lokalen
      Vermerk und sperrte sich. Damit war der eine Weg zu, der aus dem Zustand
      herausführt.

      Der lokale Vermerk bleibt trotzdem stehen — er trägt den Befund von
      damals, und der spart beim erneuten Melden das Nachsehen.
    */
    /*
      **Der vierte Sperrzweig — und der, der wirklich griff.**

      Er beschriftet den Knopf über die Zahl der offenen Staffeln der Reihe. Die
      wird aus dem lokalen Abhak-Speicher gerechnet, und der kennt nur „Staffel 1
      dieser Kennung ist gemeldet" — nicht, dass eine zweite Ausgabe desselben
      Werks noch aussteht.

      Belegt am 02.09.2026 im Diagnosebericht, nachdem drei andere Zweige
      gefixt waren und der Knopf trotzdem „alles gemeldet" sagte:

          text "alles gemeldet"   seiteOffen true   lokalAbgehakt ["1"]

      Erst die Ausgabe hat ihn gefunden; vier Runden Raten davor nicht.
    */
    if (
      (schonGemeldet || gemeldeteStaffel === jetzigeStaffel) &&
      !nichtAngekommen(listenId) &&
      !wiedervorlage(listenId) &&
      !seiteOffen()
    ) {
      const offen = gesamtDerSerie(listenId) - Object.keys(staffelnDerSerie(listenId)).length
      /**
       * Kein „gemeldet" mehr — es zählt, was noch fehlt.
       *
       * Daniel am 24.08.2026: „gemeldet kann weg, dafür gibt es alles gemeldet
       * bzw staffel fehlt noch." Der Zwischenzustand sagte, was gerade
       * geschehen ist; die Frage beim Weiterarbeiten ist aber, was noch offen
       * ist. Zwei Zustände genügen: alles durch, oder N fehlen.
       */
      /**
       * Die Zahl nennt nur, wer sie kennt.
       *
       * `gesamt` kommt aus „N Staffeln" auf der Seite — Amazons Zahl für die
       * ganze Serie. Führen **mehrere** Listeneinträge auf dieselbe Serie,
       * bekommt jeder diese volle Zahl, meint aber nur einen Teil davon.
       *
       * Bei „Jujutsu Kaisen" stand deshalb „noch 3 Staffeln", während die Liste
       * daneben „3/4" und „1/4" zeigte — zusammen vier von vier (Daniel,
       * 25.08.2026). Dasselbe bei „Gunslinger Girl", wo zwei Einträge zwei
       * Staffeln meinen und jeder auf zwei zählte.
       *
       * Welche Amazon-Staffel zu welchem unserer Titel gehört, sagt keine der
       * beiden Seiten. Also wird die Zahl nicht genannt: Der Knopf sagt, was er
       * sicher weiß — diese Staffel ist gemeldet. Wie viele die Serie hat und
       * wie weit sie insgesamt ist, steht in der Übersicht, wo alle Zeilen
       * nebeneinander stehen.
       */
      /*
        **Was als Nächstes dran ist, steht am Knopf.**

        „✓ Staffel 1 gemeldet" sagt, was erledigt ist, und lässt offen, was
        folgt — bei „InuYasha" mit sieben Staffeln ist das die eigentliche
        Frage.

        Genannt wird die kleinste Staffel, die noch keine Meldung hat. Kennt die
        Seite ihre Staffelzahl nicht oder sind alle durch, bleibt es beim
        bisherigen Text — eine erfundene Nummer wäre schlimmer als keine.
      */
      const naechsteOffene = () => {
        try {
          const zahl = staffelZahl()
          if (!Number.isFinite(zahl) || zahl < 2) return null
          /*
            **Über die Serie hinweg, nicht über die Kennung dieser Staffel.**

            Prime gibt jeder Staffel eine eigene ASIN, und die Meldung für
            Staffel 1 steht unter deren Kennung. Auf Staffel 6 nachgeschlagen
            war `erledigt[listenId]` deshalb leer, und der Knopf riet zu
            „weiter mit Staffel 1" — die längst gemeldet war (Daniel,
            27.08.2026).

            Der Serientitel führt alle Kennungen derselben Reihe zusammen; er
            steht in jedem gemeldeten Eintrag.
          */
          const serie = titelKern(seitenTitel())
          const fertige = {}
          for (const k of Object.keys(erledigt)) {
            const e = erledigt[k]
            if (!e?.staffeln) continue
            if (serie && titelKern(e.serie ?? e.titel ?? '') !== serie && k !== listenId) continue
            for (const n of Object.keys(e.staffeln)) fertige[n] = true
          }
          return globalThis.akPrimeNaechsteStaffel(gesehen?.seite?.staffeln, zahl, fertige, jetzigeStaffel)
        } catch {
          return null
        }
      }
      const weiterMit = offen > 0 ? naechsteOffene() : null
      /*
        Bleibt eine Staffel offen, sagt der Knopf, welche als Nächstes dran ist
        — das ist eine Wegweisung und gehört sichtbar. Ist keine mehr offen,
        gilt der Grund von oben: Der Knopf verschwindet, die Haken bleiben.
      */
      if (offen > 0) {
        /*
          **Eine Zeile statt zwei** (Daniel, 17.09.2026, Schleim): Der Knopf
          „✓ Staffel 2 gemeldet · weiter mit Staffel 3" stand über der Marke
          „gemeldet ✓". Die Wegweisung wandert jetzt in die Marke, der Knopf geht.
        */
        knopf.style.display = 'none'
        weiterText =
          `✓ Staffel ${staffelText(jetzigeStaffel)} gemeldet` +
          (weiterMit ? ` · weiter mit Staffel ${weiterMit}` : '')
        weiterTextPfad = location.pathname
        durchFuerPfad = location.pathname
        gemeldetMarke(true, weiterText)
      } else {
        knopf.style.display = 'none'
      }
      knopf.disabled = true
      knopf.dataset.deutsch = String(deutsch)
      return
    }

    /*
      **Die Sperre stand nur im Melde-Pfad — der Knopf bot trotzdem „melden" an.**

      Daniel am 28.08.2026 an „Domestic Girlfriend": Der Knopf zeigte
      „✕ kein Deutsch · 10 Folgen · … · melden", und beim Klick erschien fuer
      ein paar Sekunden „10 von 11 Folgen gelesen — fuer „kein Deutsch" fehlen 1".

      Beides stimmt, nur an der falschen Stelle: Die Pruefung lief erst beim
      Melden. Der Kommentar darunter kuendigt sie seit Tagen fuer das Zeichnen
      an, der Code dazu fehlte. Ein Knopf, der etwas anbietet und es beim Klick
      abweist, ist eine Falle.

      Der Fall selbst ist echt: Die Seite fuehrt elf Folgen, gelesen sind
      1 und 3 bis 12 — Folge 2 fehlt, und die 12 liegt ueber der Staffelgroesse.
      `geladeneFolgen()` zaehlt nur Nummern bis `gesamt`, also zehn.
    */
    /*
      **Diese Sperre wartet aufs Sammeln, nicht auf eine Zahl.**

      `vollstaendig` entscheidet seit dem 30.08.2026 über den Stillstand: Kommt
      nichts mehr nach, ist gesammelt, was die Seite hergibt. Die Bedingung
      `gesehen.gesamt` bleibt nur als Zeichen dafür, dass überhaupt eine
      Folgenliste erwartet wird — sie ist keine Zielmarke mehr.
    */
    /*
      **Eine Seite ohne Folgen bleibt eine Seite ohne Folgen — auch mit Zählstand.**

      Daniel am 31.08.2026 an „Tokyo Ghoul" Staffel 4: Die Seite führt dort
      keinen Folgen-Reiter und keine einzige Folge, der Knopf sagte trotzdem
      „12 von 24 Folgen gelesen — 12 fehlen noch" und ließ nicht melden.

      Der Zweig, der genau das anbietet („✕ keine Folgen für diese Staffel —
      melden"), steht im Block `if (!geladen)` — er greift also nur, wenn gar
      nichts gelesen wurde. Klebte ein Zählstand aus der vorigen Staffel, war er
      unerreichbar.

      Die Frage „führt diese Seite Folgen?" beantwortet aber die **Seite**, nicht
      der Zählstand. Sagt sie nein, ist jeder Stand hier fremd. Die
      Acht-Sekunden-Frist bleibt: Amazon baut den Reiter manchmal spät.

      Belegt: Staffel 4 gibt es bei Prime nur als Kauftitel (`B0D7N68Q5T`, 12
      Folgen, deutsch — von Daniel Minuten später von dort gemeldet). Die
      Abo-Seite führt sie nicht, und genau das ist die Auskunft, die gefehlt hat.
    */
    /* Einmal fragen, zweimal verwenden — `seitenLage()` liest `body.innerText`. */
    const lageJetzt = seitenLage()
    if (
      !lageJetzt.hatFolgenReiter &&
      !lageJetzt.folgenLautSeite &&
      !istFilm &&
      !fehlerseite &&
      !regionWeg &&
      Date.now() - letzterFortschritt > 8000
    ) {
      knopf.dataset.tot = 'true'
      knopf.disabled = false
      knopf.dataset.deutsch = String(deutsch)
      knopf.textContent = '✕ keine Folgen für diese Staffel — melden'
      knopf.title =
        'Diese Seite führt keine Folgenliste. Was hier an Zahlen steht, stammt aus einer anderen Staffel.'
      return
    }
    if (!nichtAbrufbar && !istFilm && !vollstaendig && gesehen.gesamt) {
      const fehlend = Math.max(0, gesehen.gesamt - geladen - wegInRegion)
      knopf.disabled = true
      knopf.dataset.deutsch = String(deutsch)
      /*
        **„0 fehlen noch" und trotzdem gesperrt — der Knopf log über sich selbst.**

        Steht die Sperre nicht an fehlenden Folgen, sondern an einem Abschnitt,
        den die Seite nicht nachliefert, ist `fehlend` null. Der Satz „0 fehlen
        noch" sagt dann das Gegenteil dessen, was der Knopf tut (Daniel,
        30.08.2026). Wo die Zahl nichts erklärt, muss der Text es tun.
      */
      knopf.textContent =
        fehlend === 0
          ? `${geladen} von ${gesehen.gesamt} gelesen — ein Abschnitt fehlt noch`
          : deutsch
            ? `${geladen} von ${gesehen.gesamt} Folgen gelesen — ${fehlend} fehlen noch` +
              (gesehen.abschnitte?.unlesbar ? ` (${gesehen.abschnitte.unlesbar} Reiter nicht lesbar)` : '')
            : globalThis.akPrimeLeseStand({ sollFolgen: gesehen.gesamt, geladen, gesperrt: wegInRegion, fertig: false })
      knopf.title =
        'Solange nicht jede Folge gelesen ist, sagt die Meldung mehr, als geprueft wurde. ' +
        '„Deutsch gefunden" gilt fuer die Sprache sofort — die Zahl der Folgen aber erst, wenn sie stimmt.'
      return
    }

    /**
     * Unvollständig geladen? Dann wird gar nicht gemeldet.
     *
     * Daniel: „make reporting not possible until all entries are loaded (so for
     * example not possible to click when it says 24 of 26)."
     *
     * Bisher war nur „kein Deutsch" gesperrt — „Deutsch gefunden" durfte auch
     * aus einem Ausschnitt heraus gemeldet werden, weil eine deutsche Tonspur
     * eine deutsche Tonspur bleibt. Das gilt für die **Sprache**, aber die
     * Meldung trägt mehr: Sie nennt die Zahl der geprüften Folgen, und daraus
     * wird im Datensatz eine Reichweite. Aus „24 von 26" würde eine Grenze bei
     * Folge 24, die es nicht gibt.
     */
    /**
     * Frisch gewechselt? Dann zählt keine Zahl, auch keine passende.
     *
     * `vollstaendig` allein trägt hier nicht: Es vergleicht die geladenen
     * Folgen mit `gesehen.gesamt`, und beide können aus verschiedenen Staffeln
     * stammen. Bei 13 alten und 26 neuen Folgen ist `13 >= 13` erfüllt, sobald
     * die alte Zahl noch dasteht — freigegeben mit halbem Stand.
     */
    /**
     * Adresse und Quelltext müssen dieselbe Seite meinen.
     *
     * Beim Wechsel über das Auswahlfeld tauscht Amazon die Adresse sofort und
     * den Quelltext erst danach. In diesem Fenster nennt `asinAusSeite()` noch
     * die **vorige** Seite — und mit ihr kommen deren Folgenzahl und deren
     * Kennung in die Meldung.
     *
     * Gemessen an einer echten Meldung vom 24.08.2026 („How a Realist Hero",
     * Staffel 2 mit 13 Folgen):
     *
     *     Seitenadresse: B0G1DT86QJ   ← richtig, aus der Adresse
     *     Amazon-Seite:  B00WDK307K   ← falsch, aus dem alten Quelltext
     *     "alle 21 Folgen geprüft"    ← die Zahl der vorigen Staffel
     *
     * **Verglichen werden die Staffelnummern, nicht die Kennungen.** Dass
     * Adresse und Quelltext verschiedene ASINs nennen, ist der Normalfall: In
     * der Adresse steht die Kennung, über die der Verweis in unseren Bestand
     * kam, im Quelltext die der gezeigten Staffel. Die **Nummer** dagegen muss
     * übereinstimmen — tut sie es nicht, hinkt eine der beiden Quellen hinterher,
     * und das ist genau der Wechsel.
     */
    /**
     * Nach einem Dropdown-Wechsel hilft nur Neuladen — gemessen, nicht vermutet.
     *
     * Am 24.08.2026 hat Daniel den Wechsel mit `tools/amazon-diagnose.js`
     * aufgezeichnet („GOSICK", Staffel 1 → 2):
     *
     *     ms     adrAsin       adrStaffel   qtAsin        qtStaffel
     *     262    B0B8MTPWRN    —            B0B8MTPWRN    1
     *     7261   B0B8XVGL62    2            B0B8MTPWRN    1
     *     8519   B0B8XVGL62    2            B0B8MTPWRN    1
     *
     * **Amazon tauscht den Quelltext gar nicht aus.** Die Folgenliste wird im
     * DOM ersetzt, die JSON-Fracht im Skriptblock bleibt die der geladenen
     * Seite — auch nach achteinhalb Sekunden noch. Alles, was hier gelesen
     * wird, gehört danach zur **alten** Staffel: Folgenzahl, Kennung,
     * Staffelnummer, Abschnitts-Tokens.
     *
     * Das erklärt jeden Fehler dieses Abends, und es erklärt, warum keine
     * Wartezeit half: Es gab nichts, worauf zu warten war. Ein Dutzend
     * Wächter hat versucht, aus Daten Sinn zu machen, die nicht existieren.
     *
     * Die einzige ehrliche Auskunft ist deshalb: neu laden. Der Knopf sagt es
     * und tut es auf Klick — automatisch neu zu laden wäre ein Eingriff in eine
     * Seite, die Daniel gerade benutzt.
     */
    /**
     * Verglichen wird die **Staffelnummer**, nicht die Kennung.
     *
     * Dass Adresse und Quelltext verschiedene ASINs nennen, ist der Normalfall:
     * In der Adresse steht die Kennung, über die der Verweis in unseren Bestand
     * kam, im Quelltext die der geladenen Staffel. Wer daraus einen Widerspruch
     * macht, sperrt jede erste Seite.
     *
     * Die Nummer dagegen kann nicht auseinanderlaufen, ohne dass etwas veraltet
     * ist — in Daniels Messung stand die Adresse auf 3, der Quelltext auf 1.
     */
    const staffelLautAdresse = staffelAusAdresse()
    const staffelLautSeite = staffelAusSeite()
    /*
      Der Titelwechsel innerhalb der Anwendung zaehlt hier mit — er hinterlaesst
      denselben Zustand: eine gerenderte Seite ueber einem Quelltext, der zum
      vorigen Titel gehoert. Gemessen am 25.08.2026 ueber zwei Wechsel, acht
      Sekunden lang dieselbe Quelltext-Kennung bei drei verschiedenen Titeln.
    */
    const veraltet = Boolean(
      staffelLautAdresse && staffelLautSeite && staffelLautAdresse !== staffelLautSeite,
    )
    /**
     * Der Zeitpunkt, ab dem gewartet wird — ohne ihn ist die Frist sofort um.
     *
     * Beim Zurücknehmen der alten Widerspruchs-Sperre ist die Zeile
     * verschwunden, die ihn setzt. `widerspruchSeit` blieb auf 0, also war
     * `Date.now() - 0` immer größer als jede Frist: Der Knopf verlangte sofort
     * ein Neuladen, statt auf die geholte Staffel zu warten.
     */
    if (!veraltet) widerspruchSeit = 0
    else if (!widerspruchSeit) widerspruchSeit = Date.now()
    /**
     * Seit 0.73 wird die Staffel geholt, statt zum Neuladen aufzufordern.
     *
     * Der Leser fragt die Folgenliste mit der ASIN aus der Adresse ab — die
     * wandert beim Dropdown-Wechsel mit, anders als der Quelltext. Solange das
     * läuft, wartet der Knopf; kommt nichts, bleibt das Neuladen als Ausweg.
     */
    /*
      **Gewartet wird auf die Antwort, nicht auf einen frischen Quelltext.**

      Bis 2.3.2 stand hier: Nennt die Adresse eine andere Staffel als der
      Quelltext, warte auf einen gezielten Abruf mit genau dieser Kennung. Beide
      Bedingungen kommen aus dem Quelltext, und der wird für die Folgen gar
      nicht mehr gelesen — bei „Golden Kamuy" Staffel 3 hing der Knopf deshalb
      dauerhaft auf „Staffel wird geladen …".

      Die Frage ist einfacher geworden: Liegt für die jetzige Adresse schon eine
      Antwort vor? Wenn nein, wird gewartet; kommt keine, bleibt das Neuladen.
    */
    const nochKeineAntwort = gesehen.fuerAdresse !== location.pathname + location.search
    if (nochKeineAntwort && veraltet) {
      const wartetAufStaffel = Date.now() - widerspruchSeit < WIDERSPRUCH_MS
      knopf.disabled = wartetAufStaffel
      knopf.dataset.neuLaden = String(!wartetAufStaffel)
      // Solange geladen wird, gehoert der Zaehlstand noch zur alten Staffel --
      // ein Klick wuerde sie unter der neuen Nummer melden.
      knopf.dataset.wechselt = 'true'
      knopf.textContent = wartetAufStaffel
        ? 'Staffel wird geladen …'
        : '↻ hier klicken zum Neuladen'
      knopf.dataset.deutsch = 'false'
      return
    }
    knopf.dataset.neuLaden = 'false'
    knopf.dataset.wechselt = 'false'

    /**
     * **Der Knopf wartet, bis der Staffelwechsel wirklich verarbeitet ist.**
     *
     * Daniel am 09.09.2026, mit drei Bildern: „nach einem wechsel button erst
     * rot nicht klickbar, vorherige asin, dann grün klickbar, immer noch
     * vorherige asin, dann neue asin. … der melde button muss auch auf die
     * geänderte asin warten."
     *
     * Der mittlere Zustand ist der gefährliche, und zwar nicht wegen der
     * Anzeige: `beiStaffelwechsel()` zieht **drei** Dinge zusammen nach — `id`,
     * `listenId` und `eintrag`. Aus `eintrag.url` entsteht die Adresse der
     * Meldung. Wer klickt, bevor das gelaufen ist, meldet den Befund der neuen
     * Staffel unter dem Listeneintrag der alten.
     *
     * Verglichen wird gegen `asin()`, also gegen die Adresse: Sie wandert beim
     * Wechsel sofort mit, während der Quelltext hinterherhinkt (CLAUDE.md,
     * 24.08.2026). Weichen beide ab, ist der Wechsel bekannt und noch nicht
     * verarbeitet — das dauert höchstens einen Takt.
     */
    const kennungDerSeite = (() => {
      try {
        return asin()
      } catch {
        return null
      }
    })()
    if (kennungDerSeite && id && kennungDerSeite !== id) {
      knopf.disabled = true
      knopf.dataset.wechselt = 'true'
      knopf.textContent = 'Staffelwechsel wird übernommen …'
      knopf.title = `Die Seite steht auf ${kennungDerSeite}, der Auftrag noch auf ${id}. Eine Meldung von hier trüge die falsche Adresse.`
      knopf.dataset.deutsch = 'false'
      return
    }

    if (!zahlenStehen) {
      knopf.disabled = true
      /*
        **Ein Stand mit mehr Folgen, als die Staffel hat, ist vermischt.**

        Daniels Bericht vom 27.08.2026 (Dragon Ball Super, Staffel 2): 27
        gelesene Folgen bei `gesamt: 9`. Der Wechsel war erkannt, die Kennung
        nachgezogen — nur der Zählstand trug noch die 18 Folgen der ersten
        Staffel. Der Knopf wartete auf einen Gleichstand, den es nicht mehr
        geben konnte, und stand nach 96 Sekunden immer noch auf „einen Moment".

        Das Ersetzen hängt sonst an der Adresse der Widget-Antwort. Beim Wechsel
        über die Staffelauswahl ändert Prime nur `?ref_=atv_dp_season_select_s2`
        — kommt die nächste Antwort unter der alten Adresse, greift die Regel
        nicht.

        Diese hier greift immer: Mehr gelesene Folgen als die Staffel hat, ist
        keine Auslegungsfrage. Der Stand geht weg, der nächste Takt liest neu.
      */
      /*
        **Und irgendwann ist Warten keine Auskunft mehr.**

        Daniels Bericht vom 27.08.2026 (InuYasha, Staffel 3): `gesamt: 28`,
        `gelesen: 27`. Eine einzige Folge fehlte, und der Knopf stand seit
        fünfundzwanzig Sekunden auf „Staffel wechselt — einen Moment". Er
        wartete auf einen Gleichstand, den Amazon nicht liefert — die
        Widget-Antworten waren durch, die achtundzwanzigste Folge kam in keiner
        davon.

        Nach zwölf Sekunden ohne Fortschritt wird deshalb freigegeben, was da
        ist. Die Lücke verschweigt das nicht: Der Knopf schreibt seit 3.60
        „(n ungelesen)" dazu, und die Meldung trägt nur die gelesenen Folgen.

        Zwölf Sekunden, weil ein Abschnitt bei Prime in zwei bis drei ankommt —
        wer so lange nichts geschickt hat, schickt nichts mehr.
      */
      const langeStill = freigabeReif
      const etwasGelesen = (gesehen?.jeFolge?.size ?? 0) > 0
      if (langeStill && etwasGelesen) {
        notiere('warten-aufgegeben', {
          gesamt: gesehen?.gesamt ?? null,
          gelesen: gesehen?.jeFolge?.size ?? 0,
          stillMs: Date.now() - letzterFortschritt,
        })
        /*
          Die Zahl der Seite bleibt erhalten — sie ist die Grundlage für
          „(n ungelesen)". Sie einfach auf die gelesene Zahl zu setzen wäre
          bequem und würde die Lücke verschweigen, die gerade der Grund fürs
          Aufgeben ist.
        */
        gesehen.gesamtLautSeite = gesehen.gesamt
        gesehen.gesamt = gesehen.jeFolge.size
        letzterFortschritt = Date.now()
      }
      /*
        **Zu viele Folgen? Die überzähligen fliegen, nicht der ganze Stand.**

        Nach einem Staffelwechsel schickt Amazon die Folgen der **alten**
        Staffel noch einmal — unter der Adresse der neuen. Der Stand trug dann
        dreizehn Folgen, während die Seite zwölf nennt.

        Bis 3.74 wurde er komplett geleert. Das war zweimal falsch: Erstens kam
        danach nichts mehr nach, weil Amazon längst geliefert hatte — der Knopf
        endete auf „Tonspuren nicht gefunden — Seite neu laden", und ein
        Neuladen half sofort. Zweitens war das meiste davon richtig: Die Folgen
        1 bis 12 stimmen in beiden Staffeln überein, nur die dreizehnte gehört
        nicht hierher.

        Also wird gekappt statt geleert. Was über der Staffelgröße liegt, ist
        entweder eine Folge der Nachbarstaffel oder eine durchlaufende Nummer;
        beides gehört nicht in diesen Zählstand. Der Rest bleibt und ist sofort
        meldbar.

        Eine Frist braucht das nicht mehr: Die Regel wirft nichts weg, was zur
        Seite gehört, und darf deshalb jederzeit greifen.
      */
      /*
        **Und seit dem 30.08.2026 wird gar nicht mehr gekappt.**

        Die Regel darüber warf jede Nummer über `gesehen.gesamt` weg. Sie traf
        damit genau die Fälle, die Daniel geliefert hat: Bei „JoJo" Staffel 5
        fehlt Folge 14, die übrigen tragen 1–13 und 15–40 — die 40 flog raus.
        Bei einer Reihe mit Sprung („Folge 25 und Folge 1025 nebeneinander")
        wäre die 1025 verschwunden. Seine Vorgabe: „alle episoden einzeln
        geprüft und übermittelt … es kann sprünge geben."

        Der Fall, für den sie gebaut war — nach einem Staffelwechsel schickt
        Amazon die Folgen der alten Staffel nach —, ist seit dem 25.08. anders
        gelöst: Jede Antwort trägt `fuerAdresse` mit, und ein Stand zu einer
        fremden Adresse wird verworfen. Das trennt nach Zugehörigkeit statt nach
        Zahlengröße, und nur das kann eine echte Folge von einer fremden
        unterscheiden.
      */      knopf.textContent = 'Staffel wechselt — einen Moment'
      /* Jede Sekunde dieses Zustands ist eine Sekunde Warten für Daniel. */
      notiere('wartet-auf-staffel', {
        wartetSeitMs: Date.now() - letzterFortschritt,
        gesamt: gesehen?.gesamt ?? null,
        gelesen: gesehen?.jeFolge?.size ?? 0,
        staffel: (() => {
          try {
            return staffelNummer()
          } catch {
            return null
          }
        })(),
      })
      knopf.dataset.deutsch = String(deutsch)
      return
    }
    /**
     * „Nicht mehr in deiner Region" gilt für die **ganze Seite**.
     *
     * Die Prüfung stand bis zum 24.08.2026 im Zweig für „keine Folgen geladen"
     * — und wurde damit nur erreicht, wenn der Quelltext gar nichts hergab. Bei
     * „Chaika" Staffel 1 stehen zehn Folgen darin, während die Seite darüber
     * „In deiner Region nicht mehr auf Prime Video verfügbar" schreibt: Der
     * Knopf verlangte „10 von 12 — Abschnitte selbst öffnen" für Abschnitte,
     * die es hier nicht mehr gibt.
     *
     * Der Satz ist eine Aussage über das Angebot, nicht über die Folgenliste.
     * Er gehört deshalb **vor** jede Zählung — was gezählt wird, sind
     * Überbleibsel.
     */
    /**
     * **Aber nur, solange die Folgenliste selbst unvollständig ist.**
     *
     * Amazon setzt denselben Satz an zwei ganz verschiedene Stellen, und beide
     * Fälle sind belegt:
     *
     * - **Die ganze Seite** — „Chaika" Staffel 1 (24.08.2026): zehn Folgen im
     *   Quelltext, zwölf laut Zählwerk, und über allem der Hinweis. Die zehn
     *   sind Überbleibsel; die fehlenden zwei kommen nie.
     * - **Eine einzelne Folge** — „Mahouka Koukou no Rettousei" Staffel 2
     *   (25.08.2026, Daniel mit Bild): Folge 1 und 2 tragen ihn in ihrer
     *   Kachel, die übrigen elf sind normal abspielbar, alle dreizehn stehen in
     *   der Liste. Der Knopf bot trotzdem an, die ganze Reihe als verschwunden
     *   zu melden — aus zwei Folgen wäre ein `available: false` geworden.
     *
     * Unterschieden wird an der Vollständigkeit: Ist jede Folge da, die das
     * Zählwerk nennt, ist die Staffel abrufbar — dann gehört der Satz einzelnen
     * Folgen und ist keine Aussage über das Angebot. Fehlen Folgen, ist er
     * genau die Erklärung dafür.
     *
     * Die Reihenfolge bleibt damit richtig herum: Der Satz steht weiterhin
     * **vor** der Aufforderung, fehlende Abschnitte selbst zu öffnen — denn er
     * sagt, dass es dort nichts mehr zu öffnen gibt.
     */
    /**
     * **Ein gefundener Beleg schlägt den Regionshinweis.**
     *
     * Die Bedingung „nur bei unvollständiger Liste" aus 0.86 reichte nicht: Bei
     * „Mahouka" Staffel 2 sind drei von dreizehn Folgen gesperrt, die übrigen
     * zehn tragen deutschen Ton — und weil drei fehlen, galt die Liste als
     * unvollständig und der Knopf bot an, die ganze Reihe als verschwunden zu
     * melden. Daniel am 25.08.2026: „jetzt steht da in der region nicht
     * verfügbar, statt 10/13 melden (3 nicht verfügbar in region)".
     *
     * Die Erkennung der einzelnen gesperrten Folgen über das DOM hilft hier
     * nicht zuverlässig: Amazon rendert die Kacheln erst beim Scrollen, also
     * sieht sie nur, was gerade im Bild ist.
     *
     * Der Beleg ist die bessere Grundlage, und er ist unabhängig vom
     * Scrollzustand: **Wo deutscher Ton gefunden wurde, gibt es die Staffel.**
     * Das ist dieselbe Asymmetrie, die dieses Projekt überall zieht — aus einem
     * Ausschnitt entsteht nie ein Nein, ein Ja sehr wohl. Erst wenn gar nichts
     * gefunden wurde, ist der Hinweis die einzige Auskunft, die die Seite gibt.
     */
    if (regionWeg && !deutsch && (!vollstaendig || gesperrteFolgen > 0)) {
      knopf.disabled = false
      knopf.dataset.tot = 'true'
      knopf.dataset.deutsch = 'false'
      knopf.textContent = '✕ in dieser Region nicht mehr verfügbar — melden'
      return
    }

    /**
     * Fehlende Folgen auf einer Seite mit Regionshinweis fehlen nicht — sie
     * sind gesperrt. Dann gibt es nichts nachzuladen, und die Meldung geht mit
     * dem, was belegt ist.
     */
    const keinDeutschDaten = {
      sollFolgen: globalThis.akPrimeSollFolgen(gesehen, lageJetzt.folgenLautSeite, geladen + wegInRegion),
      geladen,
      gesperrt: wegInRegion,
    }
    /* Dieselbe Regel und Quelle für „nicht abrufbar“ (`dataset.tot`) wie im Klick: was er abweist, bietet der Knopf nicht an. */
    if (vollstaendig && !globalThis.akPrimeMeldungErlaubt({ nichtAbrufbar: knopf.dataset.tot === 'true', deutsch, ...keinDeutschDaten })) {
      const sperre = globalThis.akPrimeKeinDeutschSperre({ ...keinDeutschDaten, kanal: ueberKanal() })
      knopf.disabled = true
      knopf.dataset.deutsch = 'false'
      knopf.textContent = sperre.text
      knopf.title = sperre.title
      return
    }
    if (!vollstaendig && !(regionWeg && deutsch)) {
      knopf.disabled = true
      knopf.textContent = wartet
        ? `${deutsch ? '🇩🇪' : '·'} ${geladen} von ${gesehen.gesamt} — lädt nach`
        : `${geladen} von ${gesehen.gesamt} — Abschnitte selbst öffnen`
      knopf.dataset.deutsch = String(deutsch)
      return
    }
    knopf.disabled = false
    /**
     * **Was gemischt ist, wird als Bereich benannt — nicht als „Deutsch".**
     *
     * „Kill Blue" trägt Deutsch in Folge 1 bis 4 und Japanisch in 5 bis 12.
     * „🇩🇪 Deutsch · 12 Folgen" behauptet dort dreimal so viel, wie da ist
     * (Daniel, 25.08.2026, an drei Quellen nachgemessen). Der Knopf schreibt
     * deshalb, welche Folgen es wirklich sind.
     */
    const deutschBereiche = () => {
      const karte = gesehen.jeFolge
      if (!karte || !karte.size) return null
      const hat = (n) => (n ?? []).some((s) => /deutsch|german/i.test(s))
      const nummern = [...karte.entries()].filter(([, n]) => hat(n)).map(([nr]) => nr).sort((a, b) => a - b)
      if (!nummern.length || nummern.length === karte.size) return null
      const spannen = []
      let von = nummern[0]
      let bis = nummern[0]
      for (const nr of nummern.slice(1)) {
        if (nr === bis + 1) bis = nr
        else {
          spannen.push([von, bis])
          von = bis = nr
        }
      }
      spannen.push([von, bis])
      return spannen.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')
    }
    /**
     * **Was nicht gelesen wurde, ist nicht „kein Deutsch".**
     *
     * Die Bereiche entstehen aus `gesehen.jeFolge` — den Folgen, zu denen eine
     * Antwort vorliegt. Fehlt eine Folge darin, klaffte im Text dieselbe Lücke
     * wie bei einer Folge ohne deutschen Ton: „Folge 1–4, 6–12" sagte beides.
     *
     * Bei „Hensuki" stand Folge 5 so als undeutsch da, obwohl Crunchyroll alle
     * zwölf synchronisiert führt — sie war auf der Prime-Seite gerade
     * aufgeklappt (Daniel, 27.08.2026, mit Gegenprobe: „auf echtem crunchyroll
     * webseite sind alle synchronisiert").
     *
     * Eine Lücke im Wissen als Befund auszugeben ist der teuerste Fehler, den
     * dieses Projekt machen kann: Sie wandert als `dub: false` in den Bestand
     * und sieht dort aus wie eine Messung.
     */
    /**
     * **Amazon mischt staffelinterne und durchlaufende Nummern.**
     *
     * InuYasha Staffel 4 zeigt „28 Folgen" und darin die Nummern 26, 27, 28 —
     * und dann 105 („Die Rache der legendären Krieger", 17. März 2003). Beides
     * ist richtig: Die Folge ist die 105. der Reihe und zugleich die 23. dieser
     * Staffel (TV Wunschliste führt sie als 04x23). Amazons Abschnittswähler
     * schreibt entsprechend „Folgen 26–105".
     *
     * Für die Lückenrechnung heißt das: Eine Nummer über der Staffelgröße ist
     * keine fehlende Folge, sondern eine anders gezählte. Sie wird mitgezählt,
     * aber nicht als Position gesucht — sonst meldet der Knopf Lücken, die es
     * nicht gibt, und die Meldung trüge sie als ungeprüft weiter.
     */
    const ungelesen = () => {
      const karte = gesehen.jeFolge
      const gesamt = gesehen.gesamtLautSeite ?? gesehen.gesamt
      if (!karte?.size || !Number.isFinite(gesamt)) return []
      const ausreisser = [...karte.keys()].filter((n) => n > gesamt).length
      const fehlt = []
      for (let n = 1; n <= gesamt; n++) if (!karte.has(n)) fehlt.push(n)
      /* Je Ausreißer eine Position weniger, die wirklich fehlt. */
      return fehlt.slice(0, Math.max(0, fehlt.length - ausreisser))
    }
    const bereiche = deutschBereiche()
    const luecken = ungelesen()
    const lueckenText = luecken.length ? ` (${luecken.length} ungelesen)` : ''
    /*
      **Zwei Angaben, ein Bezug — und kein Urteil ohne Grundlage.**

      „Folge 1–25 · 26 Folgen" las sich wie ein Widerspruch („wieso 1-25 = 26?",
      Daniel, 27.08.2026); gerechnet war es richtig, Folge 26 führte nur
      Französisch und Japanisch. „von" stellt den Bezug her.

      Und bei „JoJo's Bizarre Adventure" Staffel 5 stand „✕ kein Deutsch (24
      ungelesen)" — gelesen waren fünfzehn von neununddreißig, der sichtbare
      Abschnitt hatte gar keine Antwort geliefert. Der Zusatz in Klammern rettet
      das nicht: „kein Deutsch" steht vorn und wird gelesen, der Rest ist
      Kleingedrucktes. Ein Urteil über eine Staffel, von der zwei Drittel
      fehlen, ist keins.

      Ein **positiver** Befund bleibt gültig: Wer deutschen Ton gefunden hat,
      hat ihn gefunden — dafür genügt eine Folge.
    */
    const gesamtFolgen = gesehen.gesamtLautSeite ?? gesehen.gesamt
    const anteilGelesen = gesamtFolgen && gesehen?.jeFolge?.size ? gesehen.jeFolge.size / gesamtFolgen : 1
    /*
      **Und „zu wenig gelesen" gilt nur, solange noch etwas nachkommt.**

      Der Anteil misst gegen `gesamtLautSeite` — dieselbe Zahl, die bei Prime
      regelmäßig danebenliegt. Ist alles gesammelt, was die Seite hergibt, ist
      der Befund nicht unklar, sondern fertig: Er gilt eben für die Folgen, die
      es dort gibt.
    */
    const zuWenigGelesen = !deutsch && !bereiche && !vollstaendig && anteilGelesen < 0.34
    /*
      **Drei Zahlen, drei Bedeutungen — und der Text nannte nur eine davon.**

      „Folge 1–11 von 15 (2 ungelesen)" stand am 30.08.2026 über „Infinite
      Dendrogram", und nach dem Klick meldete der Knopf „13 gemeldet". Daniel:
      „warum nicht 1-13? … was ist angekommen, warum so verwirrend auf button
      label?"

      Gerechnet war alles richtig, nur hieß jede Zahl etwas anderes:
      **11** = Folgen mit deutschem Ton (12 und 13 sind dort die englischen
      Einträge), **15** = Amazons Zahl für die Staffel, **13** = tatsächlich
      gelesene Folgen. „von" stellte einen Bezug her, den es nicht gibt — es
      las sich wie „11 von 15 gelesen".

      Jetzt trägt jede Zahl ihr Wort: was deutsch ist, und was gelesen wurde.
    */
    /*
      **Zwei Zahlen nur, wenn wirklich etwas fehlt.**

      Ist jede Folge gelesen, sagt „12 Folgen" alles — „12 von 12 gelesen" wäre
      dieselbe Auskunft mit mehr Wörtern. Erst wenn eine fehlt, trägt der
      Unterschied etwas bei.

      Gezählt wird mit `geladen`, nicht mit der rohen Kartengröße: Sonst steht
      dort „12 von 11 gelesen", sobald Prime eine Nummer über der Staffelgröße
      vergibt — genau der Fall aus `geladeneFolgen()`.
    */
    /*
      **Eine gesperrte Folge ist gelesen — nur nicht abrufbar.**

      Captain Tsubasa 2018 (`B0GC9MPBHQ`, 15.09.2026): alle Abschnitte geholt,
      Folgen 1–24 in der Region gesperrt, 25–91 gelesen. Der Knopf sagte „67 von
      91 gelesen", und Daniel wartete darauf, dass es weiterlädt. Gesperrte
      zählen deshalb als gelesen und stehen als eigene Zahl daneben.
    */
    const gesperrtZahl = gesehen.gesperrt?.size ?? 0
    const gelesenText =
      gesamtFolgen && geladen && geladen + gesperrtZahl < gesamtFolgen
        ? ` · ${geladen} von ${gesamtFolgen} gelesen${gesperrtZahl ? `, ${gesperrtZahl} gesperrt` : ''}`
        : gesperrtZahl && geladen
          ? ` · ${gesperrtZahl} gesperrt`
          : ''
    const sprachStand = bereiche
      ? `🇩🇪 Folge ${bereiche} deutsch${gelesenText}`
      : deutsch
        ? `🇩🇪 Deutsch${gelesenText || lueckenText}`
        : zuWenigGelesen
          ? `? unklar — erst ${gesehen.jeFolge.size} von ${gesamtFolgen} gelesen`
          : `✕ kein Deutsch${gelesenText || lueckenText}`
    /*
      **Der Knopf nennt die Staffel, die er melden würde.**

      Er zeigte Sprache, Folgenzahl und Zugangsart — aber nicht, worauf sich
      das bezieht. Bei einer Serie mit mehreren Staffeln ist genau das die
      Frage.

      Bei einer Seite ohne Staffelwahl bleibt es weg — dort gibt es nichts zu
      verwechseln.
    */
    let staffelText2 = null
    try {
      const n = staffelNummer()
      staffelText2 = Number.isFinite(n) ? ` · ${globalThis.akPrimeStaffelBezeichnung(n, gesehen?.seite?.staffeln, quelltextVonFruehererSeite())}` : null
    } catch {
      staffelText2 = null
    }
    /*
      **Zweimal dieselbe Zahl ist eine Zahl zu viel.**

      Am 30.08.2026 stand über JoJo Staffel 5: „✕ kein Deutsch · 38 von 39
      gelesen · 37 Folgen" — drei Zahlen für zwei Sachverhalte, und die letzten
      beiden meinten dasselbe. Nennt der Sprachstand schon, wie viel gelesen
      wurde, ist der Umfang daneben Wiederholung.

      Ein Film behält seinen Zusatz: „Film" ist keine Zahl.
    */
    const umfangTeil = (bereiche || gelesenText) && !istFilm ? '' : ' · ' + umfang
    /*
      **Wohin die Meldung geht, steht auf dem Knopf.**

      Nur bei einem Auftrag aus der Suche: Auf einer Seite, die selbst in der
      Prüfliste steht, gibt es nichts zu verwechseln. Der Titel wird gekürzt —
      der Knopf soll nicht die halbe Seite einnehmen.
    */
    const zielTitel = eintrag?.ausSuche ? (eintrag.titel ?? '') : ''
    const kurz = zielTitel.length > 38 ? zielTitel.slice(0, 36) + '…' : zielTitel
    // Eine Seite außerhalb der Prüfliste sagt es in der Kopfzeile des Kastens; am Knopf steht, was er tut.
    const zielTeil = kurz ? ` · melden als „${kurz}"` : eintrag.unbekannt ? ' · Sprache melden' : ' · melden'
    const neuerText = `${sprachStand}${umfangTeil}${staffelText2 ?? ''}${zugang}${kanalHinweis}${zielTeil}`
    /*
      **Jeder Wechsel der Beschriftung wird mitgeschrieben.**

      Der Knopf sprang am 27.08.2026 von „✕ in dieser Region nicht mehr
      verfügbar" auf „🇩🇪 Deutsch · 12 Folgen" (Daniel, mit Bild). Beides kann
      stimmen — im Abo weg, als Kauf da —, aber welcher Stand am Ende gilt und
      woher der Umschwung kam, ist im Nachhinein nur mit dieser Spur zu klären.
    */
    if (neuerText !== knopf.textContent) {
      notiere('knopftext', { von: knopf.textContent, nach: neuerText, gelesen: gesehen?.jeFolge?.size ?? 0 })
    }
    knopf.textContent = neuerText
    knopf.dataset.teilweise = String(!vollstaendig)
  }
  /** Der Knopf, solange noch keine Folge geladen ist (aus `zeichnenRoh` herausgelöst). */
  const zeichnenUngeladen = ({ stoerung, fehlerseite, regionWeg, nichtAbrufbar, wartet, ladeFristReif }) => {
    /**
     * Auch eine tote Seite bleibt gemeldet: Eine Fehlerseite hat keine geladenen Folgen und erreicht
     * „✓ gemeldet" weiter unten nie — ohne diese Prüfung wäre der Knopf nach dem Melden gleich wieder offen.
     */
    const totAbgehakt = erledigt[listenId]
    /*
      **Eine Seite, auf der noch niemand nachgesehen hat, ist nicht „gemeldet".**

      Der Auftrag läuft unter der Adresse aus dem Bestand — bei einem
      Suchauftrag also unter der Suchadresse. Wer den Kauftitel gemeldet hat,
      hat damit den Auftrag berührt, aber nicht die zweite Ausgabe: Prime führt
      denselben Anime über einen Kanal **und** als Kauftitel.

      Am 02.09.2026 sperrte genau das die zweite Meldung („kein melden möglich
      bei #3"), obwohl der Briefkasten die aniverse-Kennung gar nicht führte.
      `seiteOffen()` fragt ihn: Steht die Kennung dieser Seite nicht unter den
      gemeldeten, ist hier noch nichts passiert.
    */
    if ((gemeldeteStaffel !== null || Object.keys(totAbgehakt?.staffeln ?? {}).length) && !seiteOffen()) {
      /*
        **Gemeldet ist gemeldet — und das ist kein toter Verweis.**

        Die Farbe haengt an , und der Wert blieb hier stehen, wie
        ihn der Zustand davor hinterlassen hatte. Nach dem Melden eines Films
        mit Kauf- und Leihangebot stand deshalb ein rotes "alles gemeldet" da,
        obwohl die Meldung durchging (Daniel, 25.08.2026, Zaehler 77 auf 76).

        Rot heisst in dieser Oberflaeche "hier ist nichts mehr" — genau das
        Gegenteil dessen, was gerade passiert ist.
      */
      /*
        **„Alles gemeldet" braucht keinen Knopf — die Checkliste sagt es schon.**

        Daniel am 02.09.2026: „alles gemeldet kann komplett entfernt werden,
        weil es durch die checkbox box schon klar ist das alles gemeldet wurde."
        Ein Knopf, der nichts auslöst, ist Fläche ohne Handlung; die Haken in
        der Zeile darüber stehen ohnehin da und sagen dasselbe genauer.

        **Auf einer toten Seite gibt es diese Haken nicht** (Daniel, 19.09.2026,
        Peace Maker Kurogane: „nach reload ist der meldeknopf weg, obwohl dort
        gemeldet stehen müsste"). Eine 404 hat keine Staffeln, also keine
        Checkliste — und der Merker „eben gemeldet" hängt an der Sitzung, nach
        dem Neuladen ist er weg. Hier sagt es deshalb die Marke.
      */
      knopf.style.display = 'none'
      knopf.disabled = true
      gemeldetMarke(true)
      return
    }
    /**
     * **Dieselbe Staffel zweimal im Auswahlfeld — die zweite ist erledigt.**
     *
     * JoJo führt „Staffel 3" und „Staffel 4" je zweimal: einmal mit
     * Kaufsymbol und vollständiger Folgenliste, einmal im Abo und ohne jede
     * Folge. Wer die Kauffassung gemeldet hat, hat die Staffel beantwortet —
     * die leere Zwillingsseite darf daraus kein zweites, widersprechendes
     * `weg` machen. Daniel am 25.08.2026: „diese doppelt gelisteten staffeln
     * bereiten probleme".
     *
     * Der Vergleich läuft über die Nummer, nicht über die Kennung: Beide
     * Fassungen tragen dieselbe Staffelnummer, und genau darauf kommt es an.
     */
    const dieseStaffel = staffelSchluessel()
    /*
      Auch hier gilt: Eine Seite, deren Kennung der Briefkasten nicht führt, ist
      offen — was auch immer lokal abgehakt wurde. Derselbe Griff wie im Zweig
      darüber; er fehlte hier, und der Knopf blieb gesperrt (02.09.2026).
    */
    if (totAbgehakt?.staffeln?.[dieseStaffel] && !seiteOffen()) {
      knopf.disabled = true
      knopf.textContent = `✓ Staffel ${staffelText(dieseStaffel)} gemeldet`
      knopf.title =
        'Diese Staffel steht im Auswahlfeld zweimal — gemeldet wurde die Fassung mit Folgen.'
      return
    }
    if (stoerung) {
      // Eine Störung ist kein Befund — hier wird nicht gemeldet.
      knopf.dataset.tot = 'false'
      knopf.disabled = true
      knopf.textContent = 'Amazon meldet einen Fehler — Seite neu laden'
      return
    }
    /**
     * Eine Staffel ohne Folgenliste ist nicht „nicht abrufbar".
     *
     * Amazon führt dieselbe Staffel zweimal, wenn es sie im Abo **und** zum
     * Kauf gibt — und die Fassung, die im Abo fehlt, hat gar keine
     * Folgenliste: kein „Folgen"-Reiter, nur „Ähnliches" und „Details".
     * Belegt am 25.08.2026 an JoJo (B0CG7SS9KL): Das Auswahlfeld führt
     * „Staffel 3" und „Staffel 4" je zweimal, einmal mit Kaufsymbol. Die
     * Fassung mit Symbol trägt 48 deutsche Folgen, die andere nichts.
     *
     * Ein `weg` von hier würde den **ganzen Verweis** entfernen — für eine
     * Serie, die woanders vollständig dasteht. Der Knopf schickt Daniel
     * deshalb zur anderen Fassung, statt eine Meldung anzubieten.
     *
     * Erkannt wird es am fehlenden Reiter, nicht am Kaufsymbol: Der Reiter
     * ist die Aussage über die Folgenliste, das Symbol nur über den Preis.
     */
    const hatFolgenReiter = seitenLage().hatFolgenReiter
    /**
     * `!fehlerseite` gehört dazu — sonst frisst die Regel den toten Verweis.
     *
     * Eine Amazon-Fehlerseite („Suchen Sie etwas?") hat naturgemäß auch
     * keinen „Folgen"-Reiter, und die Regel schickte Daniel dort zu einer
     * anderen Fassung, die es nicht gibt: „inu ni kann ich nicht als toten
     * link melden" (25.08.2026, Minuten nach dem Einbau).
     *
     * Der Unterschied: Bei JoJo **gibt** es die Seite, sie führt nur diese
     * eine Fassung ohne Folgen. Hier gibt es die Seite nicht.
     */
    /**
     * **Ein Film hat keinen „Folgen"-Reiter — und ist trotzdem in Ordnung.**
     *
     * Daniel am 25.08.2026 an „Bayonetta: Bloody Fate [dt./OV]": Nach dem
     * Wechsel aus der Prüfliste stand dort erst „Tonspuren noch nicht
     * geladen" und danach „✕ keine Folgen für diese Staffel — melden". Die
     * Seite zeigt aber genau das, was ein Film zeigt: 1 Std. 26 Min.,
     * „Ähnliches", „Details" — keine Folgenliste, weil es keine gibt.
     *
     * Die zweite Meldung ist die gefährlichere: Ein Klick darauf hätte einen
     * gültigen Verweis als tot eingetragen. Der Titel trägt „[dt./OV]" im
     * Namen, die deutsche Fassung ist also nicht einmal strittig.
     *
     * **Der zweite Fall am selben Tag war noch schärfer.** Bei „Heidi —
     * Kindheit in den Bergen" (1 Std. 28 Min., ebenfalls ein Film) stand nach
     * dem Wechsel „24 von 48 — Abschnitte selbst öffnen": die Zahlen des
     * **vorigen** Titels, an einem Film. Eine Meldung von dort hätte ihm
     * achtundvierzig Folgen zugeschrieben. Nach einem Neuladen sagte derselbe
     * Knopf korrekt „🇩🇪 Deutsch · Film · Kauf/Leihe".
     *
     * Der Unterschied zwischen den beiden Fällen ist nur, wie weit der alte
     * Zählstand schon gefüllt war — die Ursache ist dieselbe.
     *
     * Warum die vorhandene Film-Behandlung nicht griff: Nach einem Wechsel
     * ohne Neuladen ist der Quelltext der des **vorigen** Titels, und der
     * Nachlade-Abruf holt eine `EpisodeList` — die es bei einem Film nicht
     * gibt. Es bleibt also nichts zu lesen, und dann ist die einzige ehrliche
     * Auskunft dieselbe wie beim Staffelwechsel: neu laden.
     */
    /*
      **Ein Film mit frischem Quelltext hatte keinen Zweig — er fiel durch.**

      Der Zweig direkt darunter verlangt `quelltextVeraltet()`, die beiden
      danach sind durch `!istFilmSeite()` gesperrt. Für einen Film, dessen
      Quelltext in Ordnung ist, blieb damit nichts übrig: Der Ablauf lief bis
      zum Warte-Zweig durch und stand dort fest — erst „Folgen werden geladen
      …", nach acht Sekunden „Tonspuren nicht gefunden — Seite neu laden".
      Neu laden half nicht, denn der Quelltext war nie das Problem (Daniel,
      28.08.2026, „Blood-C: The Last Dark" und „Have A Nice Day").

      Hier stehen die Tonspuren aus dem Block der Seite, gelesen ohne Umweg.
      Danach greift der reguläre Weg: eine Einheit, eine Sprachliste, der
      Knopf schreibt „Film".
    */
    if (istFilmSeite() && !quelltextVeraltet() && !gesehen.jeFolge.size) {
      const film = filmAusSeite()
      if (film) {
        gesehen.fuerAdresse = location.pathname + location.search
        gesehen.gesamt = null
        gesehen.jeFolge.set(1, film.sprachen)
        gesehen.nummern.add(1)
        gesehen.metaJeFolge ??= new Map()
        gesehen.metaJeFolge.set(1, {
          kennung: film.kennung,
          nummer: 1,
          titel: film.titel,
          erschienen: film.erschienen,
          dauerSek: film.dauerSek,
          sprachen: film.sprachen,
          untertitel: film.untertitel,
        })
        letzterFortschritt = Date.now()
      }
    }
    if (istFilmSeite() && quelltextVeraltet()) {
      knopf.dataset.tot = 'false'
      knopf.disabled = false
      knopf.textContent = '↻ Seite neu laden — Film, Daten noch vom vorigen Titel'
      knopf.title =
        'Ein Film hat keine Folgenliste, die nachgeladen werden könnte. Nach einem Wechsel ' +
        'ohne Neuladen steht im Quelltext noch der vorige Titel.'
      return
    }
    /*
      Kein Reiter **und** keine Folgenzahl: Dann führt die Staffel bei Amazon
      nichts — anders als eine Seite, die nur noch lädt.

      **Eine Fehlerseite ist keine Staffel ohne Folgen** (Daniel, 19.09.2026,
      Peace Maker Kurogane `B0D59HJGBZ`, mit zwei Bildern): Auf Amazons 404
      stand erst richtig „✕ nicht abrufbar — melden", nach acht Sekunden
      sprang der Knopf auf das gesperrte „führt keine Folgen" — die tote
      Adresse ließ sich nicht mehr melden. Auf einer Fehler-, Region- oder
      Nicht-verfügbar-Seite gilt deshalb der Melde-Knopf darunter.
    */
    if (
      !hatFolgenReiter &&
      !fehlerseite &&
      !nichtAbrufbar &&
      !regionWeg &&
      !seitenLage().folgenLautSeite &&
      !istFilmSeite() &&
      Date.now() - letzterFortschritt > 8000
    ) {
      notiere('staffel-ohne-folgen', { gelesen: gesehen?.jeFolge?.size ?? 0 })
      knopf.disabled = true
      knopf.textContent = 'Diese Staffel führt bei Amazon keine Folgen'
      return
    }
    if (!hatFolgenReiter && !fehlerseite && !regionWeg && !nichtAbrufbar && !wartet && !istFilmSeite()) {
      /**
       * **Gesperrt war zu viel** (Daniel, 25.08.2026: „keine folgen für die
       * staffel - melden nicht möglich", an „Space Dandy" Staffel 2).
       *
       * Die Regel entstand für JoJo, wo dieselbe Staffel zweimal im
       * Auswahlfeld steht und nur die Kauffassung Folgen führt — dort ist
       * eine Meldung falsch, die andere Fassung ist einen Klick entfernt.
       * „Space Dandy" hat aber genau zwei Staffeln, eine davon ohne jede
       * Folge, und keine Alternative dazu. Der Knopf schickte Daniel zu einer
       * Fassung, die es nicht gibt.
       *
       * Welcher der beiden Fälle vorliegt, sieht der Mensch vor dem Bildschirm
       * am Auswahlfeld — die Erweiterung sieht es nicht. Also entscheidet er:
       * Der Knopf sagt, was er weiß, lässt melden und warnt im Tooltip.
       *
       * Gefährlich ist das nicht: Ein `weg` löscht nichts, es landet in der
       * Arbeitsliste (`fetch-pruefungen.ts`) und wird dort vorgelegt.
       */
      knopf.dataset.tot = 'true'
      knopf.disabled = false
      knopf.textContent = '✕ keine Folgen für diese Staffel — melden'
      knopf.title =
        'Steht dieselbe Staffel noch einmal im Auswahlfeld (meist mit Kaufsymbol), ' +
        'dort nachsehen statt melden — dann führt nur die andere Fassung die Folgen.'
      return
    }

    /**
     * **Eine Seite, die "48 Folgen" schreibt, ist nicht "nicht abrufbar".**
     *
     * Hierher fuehrt jeder Weg, auf dem keine einzige Folge gelesen wurde —
     * auch der, auf dem der Quelltext bewusst verworfen wurde und der
     * Mitleser noch nichts geliefert hat. Das ist "unbekannt", nicht
     * "nichts", und der Unterschied entscheidet ueber eine Meldung, die
     * einen Verweis loescht.
     *
     * Daniel am 25.08.2026 an JoJo Staffel 3: Nach dem Neuladen stand
     * "nicht abrufbar - melden" ueber einer Seite mit achtundvierzig
     * sichtbaren Folgen.
     *
     * Zeigt die Seite eine Folgenzahl an, wird deshalb gesperrt statt
     * gemeldet. Lieber nicht melden koennen als falsch melden.
     */
    if (seitenLage().folgenLautSeite && !regionWeg && !nichtAbrufbar && !fehlerseite) {
      knopf.dataset.tot = 'false'
      knopf.disabled = true
      /*
        **„Noch nicht geladen" liest sich wie ein Fehler — meistens ist es
        Warten.** Nach einem Wechsel ohne Neuladen holt der Mitleser die
        Folgenliste; gemessen am 25.08.2026 dauerte das rund drei Sekunden,
        der Abruf selbst 554 ms. Daniels Eindruck war trotzdem „geht nicht",
        und das lag an diesem Satz.

        Also sagt der Knopf, was gerade geschieht — und ab wann es wirklich
        hakt. Die Grenze liegt bei acht Sekunden: Das ist mehr als das
        Doppelte des gemessenen Falls und immer noch kurz genug, dass niemand
        ins Leere wartet.
      */
      knopf.textContent =
        ladeFristReif
          ? 'Tonspuren nicht gefunden — Seite neu laden'
          : 'Folgen werden geladen …'
      /*
        **Ab hier steht fest, dass nichts kam — und das gehört gemeldet.**

        Acht Sekunden sind mehr als das Doppelte des gemessenen Normalfalls
        (554 ms). Was danach noch „nicht gefunden" heißt, ist ein Vorfall:
        Vielleicht hat Amazon den Seitenaufbau geändert, vielleicht greift ein
        Muster nicht mehr. Stünde das nur auf dem Knopf oder in der Konsole,
        erführe es niemand.

        Netflix meldet denselben Zustand seit 4.17.11 als `ohne_tonspur`.
        Der Riegel „je Art und Seite einmal" fängt den Takt ab, in dem
        `zeichnen()` läuft.
      */
      if (ladeFristReif) {
        void vorfallMelden('ohne_tonspur', {
          text: 'Nach acht Sekunden keine Tonspur auf der Seite gefunden',
        })
      }
      return
    }
    knopf.dataset.tot = String(regionWeg || nichtAbrufbar || !wartet)
    knopf.disabled = false
    knopf.textContent = regionWeg
      ? '✕ in dieser Region nicht mehr verfügbar — melden'
      : nichtAbrufbar
        ? '✕ derzeit nicht verfügbar — melden'
        : wartet
          ? 'Tonspuren noch nicht geladen'
          : '✕ nicht abrufbar — melden'
    if (!regionWeg && !nichtAbrufbar && wartet) knopf.disabled = true
    return
  }
}
