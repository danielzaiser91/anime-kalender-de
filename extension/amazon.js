/**
 * Liest bei Amazon die Tonspuren mit, während Daniel die Seite ohnehin ansieht.
 *
 * ## Warum das hier einfacher ist als bei Netflix
 *
 * Netflix gibt seine Tonspuren erst preis, wenn eine Folge läuft — deshalb
 * braucht es dort ein Skript in der Seitenwelt, das `window.netflix` erreicht.
 * Amazon liefert sie **im HTML mit**: je Folge ein `audioTracks`-Feld, je
 * Staffel ein `benefitId`. Ein gewöhnliches Content-Script genügt.
 *
 * Gemessen am 23.08.2026 an „Naruto Shippuden", drei Staffeln einzeln:
 *
 * ```
 * "audioTracks":["Deutsch","日本語"]      je Folge
 * "benefitId":"Prime" | "aniversede"     je Staffel — welches Abo nötig ist
 * ```
 *
 * ## Was ausdrücklich nicht gelesen wird
 *
 * `entitlementType` sagt, ob **dieses Konto** Zugriff hat — anonym steht dort
 * immer „Unentitled", bei Daniel etwas anderes. Eine Angabe über ihn, nicht
 * über den Titel. Sie bleibt liegen.
 *
 * ## Warum die Erweiterung und kein Abruf
 *
 * Amazons Nutzungsbedingungen untersagen „Data Mining, Robots oder ähnliche
 * Datensammel- und Extraktionsprogramme". Ein Mensch, der eine Seite ansieht,
 * nutzt die Lizenz bestimmungsgemäß. Deshalb wird hier **nichts angefordert** —
 * gelesen wird nur, was die Seite ohnehin geladen hat.
 */
;(async () => {

/**
 * Lebt die Verbindung zur Erweiterung noch?
 *
 * Chrome trennt beim Neuladen der Erweiterung alle laufenden
 * Content-Scripts von ihr. Sie laufen weiter, aber jeder `chrome.*`-Zugriff
 * wirft „Extension context invalidated" (Daniel, 23.08.2026, mit Bild aus
 * der Fehlerkonsole). Das trifft jede offene Seite nach jedem Neuladen.
 *
 * `chrome.runtime.id` ist der zuverlässige Prüfstein: Sie verschwindet mit
 * der Verbindung.
 */
function verbindungLebt() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

/**
 * Ein Speicherzugriff, der einen toten Kontext überlebt.
 *
 * Gibt `null` zurück, statt zu werfen — der Aufrufer entscheidet, was das
 * heißt. Wichtig ist, dass die Oberfläche stehen bleibt und sagen kann, was
 * los ist, statt mitten im Aufbau abzubrechen.
 */
/**
 * Liest den Speicher — und gibt synchron zurück, wo das möglich ist.
 *
 * Chrome liefert hier immer ein Promise. Der Testsandkasten kann es synchron:
 * Er hat keinen echten Speicher, sondern ein Objekt. Ohne diesen Weg zeigte der
 * Knopf im Test dauerhaft „prüfe Melde-Status", weil der Microtask nie an die
 * Reihe kam — der Sandkasten führt auch keine Timer aus. Ein Test, der deshalb
 * einen anderen Zustand prüft als den gemeinten, ist schlechter als keiner.
 */
function speicherLesen(schluessel) {
  if (!verbindungLebt()) return null
  try {
    return chrome.storage.local.get(schluessel)
  } catch {
    return null
  }
}

async function speicherSchreiben(werte) {
  if (!verbindungLebt()) return false
  try {
    await chrome.storage.local.set(werte)
    return true
  } catch {
    return false
  }
}
  /**
   * Der Seiten-Quelltext, einmal je Takt statt achtmal.
   *
   * **Das hat einen Tab zum Absturz gebracht** (Daniel, 24.08.2026: „Aw, Snap!
   * Error code: Out of Memory", dazu „die performance auf dem tab war echt
   * schlecht"). Der Grund liegt in einer Zahl, die niemand nachgerechnet hat:
   * `document.documentElement.innerHTML` **baut die Zeichenkette jedes Mal neu
   * auf**, und bei einer Prime-Video-Seite sind das rund 1,6 MB.
   *
   * `zeichnen()` läuft alle 500 ms und ruft dabei `spuren()`, `asinAusSeite()`,
   * `staffelAusSeite()`, `staffelZahl()`, `abos()` und `zugangsart()` — acht
   * Lesungen im Takt, also gut 25 MB Müll je Sekunde. Der Speicherbereiniger
   * kommt dabei nicht hinterher.
   *
   * Gewachsen ist das Stück für Stück: Jede neue Beobachtung bekam ihre eigene
   * Lesung, und keine davon sah teuer aus. **Wer hier eine Funktion ergänzt,
   * die den Quelltext braucht, nimmt `seitenHtml()`** — nie `innerHTML` direkt.
   *
   * **Zwei Sekunden Frist — der zweite Anlauf, und diesmal gemessen.**
   *
   * Der erste Versuch war „einmal je Durchlauf": `zeichnen()` warf den
   * Zwischenspeicher zu Beginn weg, damit jeder Durchlauf einen frischen Stand
   * sieht. Das senkte acht Lesungen auf eine — aber `zeichnen()` läuft im
   * 500-ms-Takt, und `beiStaffelwechsel()` daneben liest noch einmal. Rund
   * **3 MB Zeichenketten je Sekunde**, dauerhaft, auf einer Seite, die
   * stundenlang offen ist.
   *
   * Am 25.08.2026 ist Daniels Tab erneut daran gestorben: „nach ca 20 meldungen
   * in a row, crashed es … memory leak??" — dasselbe „Aw, Snap! Out of Memory"
   * wie am Vortag, nur später. Chrome hält alle Tabs derselben Site in **einem**
   * Renderer-Prozess; der Müll mehrerer Prime-Video-Tabs summiert sich dort.
   *
   * Die Frist kostet, was sie kosten muss: Ein Wechsel wird bis zu zwei
   * Sekunden später bemerkt. Das ist zu verschmerzen, weil die Erkennung
   * ohnehin nicht am Quelltext hängt — Amazon tauscht ihn beim Staffelwechsel
   * gar nicht aus (siehe CLAUDE.md). Was wirklich etwas Neues bringt, sind
   * Ereignisse: eine Nachricht des Mitlesers und der Klick auf den Knopf. Beide
   * werfen den Zwischenspeicher **sofort** weg, und damit ist die Frist überall
   * dort unwirksam, wo sie schaden könnte.
   *
   * **Wer hier eine Funktion ergänzt, die den Quelltext braucht, nimmt
   * `seitenHtml()`** — nie `innerHTML` direkt.
   */
  const HTML_FRIST_MS = 2000
  let htmlZwischenspeicher = null
  let htmlGelesenAm = 0
  function seitenHtml() {
    if (htmlZwischenspeicher === null || Date.now() - htmlGelesenAm > HTML_FRIST_MS) {
      htmlZwischenspeicher = document.documentElement?.innerHTML ?? ''
      htmlGelesenAm = Date.now()
    }
    return htmlZwischenspeicher
  }
  function htmlNeuLesen() {
    htmlZwischenspeicher = null
  }

  /**
   * Was die Seite über sich selbst sagt — einmal je Quelltext-Lesung.
   *
   * Die drei Sätze und der Folgen-Reiter wurden bis zum 25.08.2026 in jedem
   * `zeichnen()` neu gesucht, und zwar über `body.innerText` **plus** den
   * ganzen Quelltext. `innerText` ist dabei der teurere Teil: Es erzwingt ein
   * Layout über die ganze Seite, zweimal je Sekunde, für einen Zustand, der
   * sich nur beim Staffel- oder Seitenwechsel ändert.
   *
   * Gelesen wird beides zusammen, weil keine der beiden Quellen allein
   * genügt: `innerText` gibt es nur, wo etwas gerendert ist; der Hinweis steht
   * aber auch in der ausgelieferten Seite, bevor sie gerendert ist.
   */
  /**
   * Die Folgennummern, deren Kachel „In deiner Region nicht mehr …" trägt.
   *
   * XPath statt `querySelectorAll('*')`: Eine Prime-Video-Seite hat
   * zehntausende Elemente, und diese Funktion läuft im Takt der Lage. Der
   * Browser findet die paar Textknoten selbst, ohne dass hier jedes Element
   * angefasst wird.
   *
   * Nach oben wird höchstens acht Ebenen gegangen. Weiter oben liegt die
   * Folgenliste als Ganzes — dort stünde die Nummer der ersten Folge, nicht
   * die der gemeinten.
   */
  function regionFolgenAusDom() {
    try {
      /**
       * **Erst im Quelltext nachsehen, dann den DOM durchsuchen.**
       *
       * `//*[contains(text(), …)]` prüft **jeden Knoten des Dokuments** — auf
       * einer Prime-Seite sind das mehrere Tausend —, und danach liest die
       * Schleife unten je Treffer bis zu acht Mal `innerText`, was jedes Mal
       * ein vollständiges Layout erzwingt. Das lief bisher in **jedem** Takt,
       * auch auf den allermeisten Seiten, die überhaupt keinen Regionshinweis
       * tragen.
       *
       * Der Quelltext liegt ohnehin im Speicher und beantwortet dieselbe Frage:
       * Steht der Satz dort nicht, gibt es auch keinen Knoten damit. Ein
       * `includes` über eine Zeichenkette ist um Größenordnungen billiger als
       * ein XPath über einen Baum — und die Bedingung ist dieselbe, nicht bloß
       * eine ähnliche.
       *
       * Anlass: Daniels Bildschirmmitschnitt vom 25.08.2026 („it impacts
       * performance drastically").
       */
      if (!seitenHtml().includes('In deiner Region nicht mehr')) return []
      const treffer = document.evaluate?.(
        '//*[contains(text(), "In deiner Region nicht mehr")]',
        document,
        null,
        7 /* ORDERED_NODE_SNAPSHOT_TYPE */,
        null,
      )
      if (!treffer?.snapshotLength) return []
      const nummern = new Set()
      for (let i = 0; i < treffer.snapshotLength; i++) {
        let el = treffer.snapshotItem(i)
        for (let hoch = 0; el && hoch < 8; hoch++, el = el.parentElement) {
          const n = /(?:^|\n)\s*(\d{1,3})\.\s+\S/.exec(el.innerText ?? '')?.[1]
          if (n) {
            nummern.add(Number(n))
            break
          }
        }
      }
      return [...nummern].sort((a, b) => a - b)
    } catch {
      return []
    }
  }

  let lage = null
  let lageZu = -1
  function seitenLage() {
    const html = seitenHtml()
    if (lage && lageZu === htmlGelesenAm) return lage
    const sichtbar = document.body?.innerText ?? ''
    const text = `${sichtbar} ${html}`
    lage = {
      fehlerseite: /keine funktionsf(?:ä|ae)hige Seite|Suchen Sie etwas?/i.test(text),
      regionWeg: /In deiner Region nicht mehr auf Prime Video verf(?:ü|ue)gbar/i.test(text),
      /**
       * Amazons dritter Satz für dasselbe Nein — und der einzige, den Filme
       * bekommen.
       *
       * „Dieses Video ist derzeit nicht verfügbar." steht dort, wo sonst der
       * Abspiel-Knopf sitzt. Belegt am 25.08.2026 an „Onigamiden — Legend of
       * the Millennium Dragon" (Daniel, mit Bild): ein Film, also ohne
       * Folgenliste und ohne „Folgen"-Reiter. Der Knopf schickte ihn deshalb
       * zur „anderen Fassung im Auswahlfeld" — eine, die es bei einem Film
       * nicht gibt: „kann nicht melden, dass dieses video nicht verfügbar ist".
       *
       * Das „derzeit" ändert nichts am Befund: Was heute nicht läuft, ist
       * heute kein Angebot. Es wird als `weg` gemeldet, wie jedes andere Nein
       * auch, und ein späterer Lauf darf es zurücknehmen.
       */
      nichtAbrufbar: /Dieses Video ist derzeit nicht verf(?:ü|ue)gbar/i.test(text),
      stoerung: /Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten/i.test(text),
      hatFolgenReiter: /(^|>)\s*Folgen\s*(<|$)/m.test(sichtbar),
      /**
       * Wie viele Staffeln diese Serie führt — aus dem **sichtbaren** Text.
       *
       * Bis zum 25.08.2026 suchte `staffelZahl()` `(\\d+)\\s*Staffeln` im ganzen
       * Quelltext. Der ist 1,6 MB groß und voller Empfehlungskacheln, und die
       * erste Fundstelle ist dort fast nie die richtige — dieselbe Falle, die
       * `seitenTitel()` am 24.08. eine fremde Serie lesen ließ.
       *
       * Bei „Gurren Lagann" kam beides zusammen: Der Kopf schreibt „1 Staffel"
       * im **Singular**, die Regex verlangte den Plural und suchte weiter — bis
       * sie irgendwo „20 Staffeln" fand. Die Übersicht zeigte daraufhin „3/20"
       * für eine Serie mit einer Staffel (Daniel, 25.08.2026, mit Bild).
       *
       * Der sichtbare Text ist um ein Vielfaches kleiner, und der Kopf steht
       * darin vor allen Kacheln. Findet sich nichts, gilt eine Staffel — die
       * Annahme, mit der jede Seite ohne Auswahlfeld richtig liegt.
       */
      staffelZahl:
        Number(/(\d+)\s*Staffeln?\b/.exec(sichtbar)?.[1]) ||
        // Rückfall auf den Quelltext, solange die Seite noch nichts gerendert
        // hat. Der Singular gehört dabei dazu: Ohne ihn übersprang die Suche
        // „1 Staffel" im Kopf und lief bis zur nächsten Empfehlungskachel.
        Number(/(\d+)\s*Staffeln?\b/.exec(html)?.[1]) ||
        1,
      /**
       * Welche **einzelnen Folgen** den Regionshinweis in ihrer Kachel tragen.
       *
       * Daniel am 25.08.2026 zu „Mahouka" Staffel 2, zweimal: „folge 1 und 2
       * sind in deiner region nicht mehr verfügbar, aber alle anderen folgen
       * der staffel sind doch verfügbar" — und dann: „kann ich trotzdem nicht
       * melden, dass die ersten 2 nicht in region sind, die anderen 11 schon".
       *
       * Die Staffel als Ganzes ist abrufbar, ein `weg` wäre also falsch. Die
       * Auskunft geht deshalb als **Notiz** mit: Sie geht nicht verloren, und
       * sie behauptet nichts, was der Datensatz nicht abbilden kann.
       *
       * Gesucht wird über die Baumstruktur, nicht über einen Abstand in
       * Zeichen: Vom Element mit dem Satz aus aufwärts, bis ein Vorfahre eine
       * Folgenüberschrift der Form „N. Titel" trägt. Ein Ausschnitt fester
       * Länge hinge davon ab, wie lang die Beschreibung daneben gerade ist —
       * genau die Sorte Zufall mit Frist, an der die Folgenerkennung schon
       * einmal gescheitert ist (siehe CLAUDE.md).
       */
      regionFolgen: regionFolgenAusDom(),
      /**
       * Wie viele Folgen die Seite über der Liste **anzeigt** — „13 Folgen".
       *
       * Das ist die einzige Angabe zur gewählten Staffel, die ein Dropdown-
       * Wechsel wirklich aktualisiert: Sie wird gerendert, während die
       * JSON-Fracht im Skriptblock stehen bleibt (CLAUDE.md, „Der Quelltext
       * veraltet beim Staffelwechsel").
       *
       * Damit ist sie der Prüfstein für alles, was aus dem Quelltext kommt.
       * Widersprechen sich beide, hat die Seite recht — Daniel am 25.08.2026
       * an „Solar Impulse": Wechsel von Staffel 7 auf 8, die Seite schreibt
       * „1 Folge", der Knopf sagte „3 von 26".
       */
      folgenLautSeite: folgenAusText(sichtbar),
      /**
       * Nennt die Seite eine **Laufzeit** — „1 Std. 26 Min." oder „97 Min."?
       *
       * Zusammen mit dem fehlenden „Folgen"-Reiter ist das der Film (siehe
       * `istFilmSeite()`). Der Wert entsteht hier, weil `body.innerText` ein
       * Neuberechnen des Layouts erzwingt und deshalb nur an dieser einen
       * Stelle gelesen wird.
       */
      hatLaufzeit: /\d+\s*Std\.\s*\d+\s*Min\.|\b\d{2,3}\s*Min\.\B/.test(sichtbar),
    }
    lageZu = htmlGelesenAm
    return lage
  }

  const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

  /** Kurz und eindeutig — der Knopf hat wenig Platz. */
  const ZUGANG_TEXT = {
    kauf: '💰 nur Kauf',
    kauf_oder_leihe: '💰 Kauf/Leihe',
    abo_und_kauf: 'Abo + Kauf',
    abo: 'Abo',
  }

  /** Die Kennung aus der Adresse — beide Formen kommen vor. */
  function asinAusAdresse() {
    return /\/(?:dp|detail)\/([A-Z0-9]{10,32})/.exec(`${location.pathname}${location.search}`)?.[1] ?? null
  }

  /**
   * Die Kennung der Staffel, die **gerade** in der Folgenliste steht.
   *
   * ## Warum die Adresse dafür nicht taugt
   *
   * **Alle Staffeln einer Serie teilen sich eine ASIN.** Welche gezeigt wird,
   * steht im Verweis-Parameter: `/gp/video/detail/B0GFPBT6FG?ref_=
   * atv_dp_season_select_s3` ist Staffel 3, dieselbe Kennung wie Staffel 1
   * (Daniel, 23.08.2026 — er hatte die Seite frisch geladen, nicht das
   * Auswahlfeld benutzt).
   *
   * Die Meldung ging deshalb mit richtigem Befund und falscher Kennung raus:
   * Inhalt und Folgenzahl waren Staffel 3 (11 Folgen, aniverse statt Prime),
   * die Adresse zeigte auf Staffel 1. Das ist schlimmer als keine Meldung —
   * es schreibt das Ergebnis dem falschen Titel zu.
   *
   * Im Quelltext steht dagegen `"titleID"` und meint die gezeigte Staffel.
   * Denselben Wert nutzt `amazon-leser.js`, um die Folgenabschnitte
   * nachzuladen — er muss also stimmen, sonst käme dort nichts an.
   *
   * Gesucht wird über **alle** Fundstellen: Auf der Digimon-Seite steht
   * `titleID` 220-mal, und die erste trägt keinen Wert.
   */
  /**
   * **Eine Prime-Kennung hat nicht immer zehn Zeichen.**
   *
   * Bis zum 25.08.2026 stand hier `[A-Z0-9]{10}` — die Länge einer ASIN. Prime
   * Video führt daneben aber GTIs mit **26** Zeichen, und das Muster schnitt sie
   * ab: Aus `0J16B1NAB82TO0O5A5Q8TLG1VP` wurde `0J16B1NAB8`. Der Vergleich in
   * `quelltextPasst()` scheiterte damit zwangsläufig, `spuren()` wurde gar nicht
   * erst aufgerufen, und der Knopf blieb auf „Tonspuren noch nicht geladen"
   * stehen — bei „Babylon" ebenso wie bei „Akame ga Kill"
   * (`0HSXN9KO9VCAUTXWKIY203H5KV`, auch 26 Zeichen).
   *
   * Sichtbar wurde es erst durch die Messung in Daniels Sitzung: Die Seite führt
   * 15 Tonspurangaben, alle mit Deutsch, und die Paarung findet 12 Folgen. Die
   * Daten waren da; sie wurden nur nie gelesen.
   *
   * `{10,32}` deckt beide Formen ab. Eine Obergrenze bleibt, damit das Muster
   * nicht in einen benachbarten Wert hineinläuft.
   */
  /**
   * Die Zahl über der Folgenliste — „12 Folgen".
   *
   * **Zwei Fallen stehen im selben sichtbaren Text**, und beide sind gemessen,
   * nicht ausgedacht (Daniel, 25.08.2026, an „Babylon"):
   *
   * 1. **Die Reiterleiste.** Dort steht „Staffel 1" direkt vor dem Reiternamen
   *    „Folgen" — zusammengelesen ergibt das „1 Folgen". Der alte Einzeiler
   *    nahm genau diesen ersten Treffer, kam auf **1** und stellte ihn gegen
   *    die 12 aus dem Quelltext. Da beide auseinandergingen, hielt
   *    `quelltextPasst()` den Quelltext für veraltet, `spuren()` lief nie, und
   *    der Knopf blieb auf „Tonspuren noch nicht geladen" — bei 15 vorhandenen
   *    Tonspurangaben mit Deutsch.
   *
   * 2. **Die Erscheinungsdaten der Folgen.** „25 Min. 6. Okt. 2019 Folge 2 …"
   *    liefert zwölfmal die Zahl **2019**. Sie stand in der Messung direkt
   *    hinter dem richtigen Treffer; fehlt der einmal, wäre eine Jahreszahl die
   *    Folgenzahl.
   *
   * Beide werden am **Umfeld** erkannt, nicht an der Zahl selbst: Eine feste
   * Obergrenze („keine Staffel hat 2019 Folgen") wäre wieder ein Zufall mit
   * Frist — „One Piece" führt über tausend.
   */
  /**
   * Zeigt diese Seite einen **Film**?
   *
   * Erkannt an dem, was ein Film hat und eine Staffel nicht: eine **Laufzeit**
   * („1 Std. 26 Min.", „97 Min.") statt einer Folgenzahl, und keinen
   * „Folgen"-Reiter. Beides muss zusammenkommen — eine Staffelseite nennt
   * ebenfalls Minuten, aber je Folge, und sie führt den Reiter.
   *
   * Gemessen am 25.08.2026 an „Bayonetta: Bloody Fate [dt./OV]": „Anime ·
   * Animation · Action · 4.6/5 · IMDb 5,7/10 · 2013 · 1 Std. 26 Min.", Reiter
   * „Ähnliches" und „Details" — kein „Folgen".
   */
  /**
   * **Ein Film braucht den Mitleser nicht — die Tonspuren stehen im DOM.**
   *
   * Gemessen am 28.08.2026 an den beiden Fällen, die Daniel gemeldet hat, mit
   * einem funktionierenden Film als Gegenprobe:
   *
   * | Titel | Adresse | pageTitleId | audioTracks |
   * |---|---|---|---|
   * | Blood-C: The Last Dark | B0GQJFL1XG | **B0GQJ8WYJD** | Deutsch, 日本語 |
   * | Have A Nice Day | B0FYSH898T | **B0FWK8XMDJ** | Deutsch |
   * | Avatar Aang (geht) | B0H6QYBZFS | B0H6QYBZFS | Deutsch, English |
   *
   * Der Block ist vollständig, `entityType` sagt „Movie", die Tonspuren stehen
   * im Klartext — und trotzdem kam am Knopf nichts an. Der Zählstand im Bericht
   * zeigt warum: `gesamt: 1` bei `fuerAdresse: null`. Diese Eins stammt aus dem
   * Seitengerüst, nicht vom Mitleser; der hat für diese Seiten nie geliefert.
   *
   * **Statt die postMessage-Kette zu reparieren, entfällt sie hier.** Mitleser
   * und Erweiterung teilen sich das DOM — das `<script>` mit dem Block ist für
   * beide dasselbe Element. Bei einem Film ist ohnehin nichts nachzuladen: keine
   * Abschnitte, keine Folgenliste, ein einziger Satz Tonspuren. Der Umweg über
   * eine Nachricht hat dort nie etwas hinzugefügt, nur eine Fehlerquelle.
   *
   * **Gelesen wird einmal je Adresse.** Der Block ist 145 bis 204 KB JSON; ihn
   * je Takt zu parsen wäre genau die Sorte Arbeit, die am 28.08.2026 schon
   * einmal die Seite lahmgelegt hat (`taktMax: 1377`).
   */
  let filmStand = { fuerAdresse: null, gelesenAm: 0, daten: null }
  function filmAusSeite() {
    /*
      **Drei Riegel vor dem Parsen — jeder einzeln notwendig.**

      Die erste Fassung (3.82) hat Daniels Rechner eingefroren: „die extension
      friert den pc ein … download von diagnose dauert jetzt schon 3min".

      Der Block ist 145 bis 440 KB groß. Ihn zu lesen heißt, `textContent` zu
      einem neuen String zu ziehen **und** einen Objektbaum daraus zu bauen — je
      Takt, also alle 500 ms. Der Speicher kommt dabei nicht hinterher.

      Gedacht war ein Zwischenspeicher je Adresse. Er hat nie gegriffen, weil der
      Schlüssel `location.search` enthielt: **Prime schreibt den
      `ref_`-Parameter laufend um**, und damit war die Adresse bei jedem Takt eine
      andere. Genau davor warnt `extension/PERFORMANCE.md`, und genau dieselbe
      Ursache hatte der Einbruch vom Nachmittag (`taktMax: 1377`).

      1. **Der Pfad ist der Schlüssel, nicht die Adresse.** Der Verweis-Parameter
         sagt nichts über den Inhalt der Seite.
      2. **Serien fassen den Block gar nicht an.** Wer einen Folgen-Reiter hat,
         ist keine Filmseite — und die teuersten Seiten sind genau die (Pokémon
         mit siebenundfünfzig Staffeln).
      3. **Und höchstens einmal je fünf Sekunden**, komme was wolle. Ein Riegel,
         der von einer Annahme über fremde Adressen abhängt, braucht einen
         zweiten, der ohne Annahmen auskommt.
    */
    const schluessel = location.pathname
    if (filmStand.fuerAdresse === schluessel) return filmStand.daten
    if (Date.now() - filmStand.gelesenAm < 5000) return filmStand.daten
    /*
      Die billige Vorprüfung zuerst: `seitenLage()` läuft ohnehin je Takt und
      ist zwischengespeichert, `getElementById` kostet nichts.
    */
    try {
      if (seitenLage().hatFolgenReiter) {
        filmStand = { fuerAdresse: schluessel, gelesenAm: Date.now(), daten: null }
        return null
      }
    } catch {
      /* Ohne Lage wird gelesen — lieber einmal zu viel als eine tote Seite. */
    }
    filmStand = { fuerAdresse: schluessel, gelesenAm: Date.now(), daten: null }
    try {
      const block = document.getElementById('dv-web-page-hydration-data')
      if (!block) return null
      const daten = JSON.parse(block.textContent)
      const oben = daten?.init?.preparations?.body?.atf?.state
      if (!oben) return null
      /*
        **`headerDetail` ist manchmal leer — dann steht alles in `detail`.**

        Daniel am 30.08.2026 an „One Piece – Strong World": Der Knopf blieb auf
        „Tonspuren nicht gefunden — Seite neu laden" stehen, obwohl
        `istFilmSeite` griff und der Quelltext frisch war.

        Anonym nachgemessen: Die Seite führt `audioTracks: ["Deutsch","日本語"]`
        **dreimal** — unter `detail.headerDetail`, unter `detail.detail` und
        unter `btfMoreDetails`. Im Zustand, den dieser Code liest, ist
        `headerDetail` ein leeres Objekt, und `Object.values(alle)[0]` gibt
        deshalb `undefined`.

        Gelesen wird jetzt aus beiden Töpfen, `headerDetail` zuerst. Der
        Rückfall auf den ersten Eintrag bleibt: Die Adresse (`B0DQM5BCFD`) und
        die Kennung im Block (`B0DQM2JXB6`) gehen bei Filmen regelmäßig
        auseinander.
      */
      const alle = { ...(oben.detail?.detail ?? {}), ...(oben.detail?.headerDetail ?? {}) }
      const kopf = alle[oben.pageTitleId ?? ''] ?? Object.values(alle).find((x) => x?.audioTracks?.length)
      if (!kopf) return null
      /*
        Nur ein Film. Bei einer Serie liefert der Mitleser die Folgen einzeln,
        und die sind die genauere Auskunft — hier würde eine einzelne
        Sprachliste für die ganze Staffel stehen.
      */
      const art = String(kopf.entityType ?? '')
      if (art && art !== 'Movie') return null
      const sprachen = (kopf.audioTracks ?? [])
        .map((t) => (typeof t === 'string' ? t : (t?.displayName ?? t?.name ?? null)))
        .filter(Boolean)
      if (!sprachen.length) return null
      filmStand.daten = {
        kennung: oben.pageTitleId ?? null,
        titel: kopf.title ?? null,
        sprachen,
        untertitel: Array.isArray(kopf.subtitles) ? kopf.subtitles : [],
        dauerSek: Number.isFinite(kopf.duration) ? kopf.duration : null,
        erschienen: kopf.releaseDate ?? null,
      }
      return filmStand.daten
    } catch {
      return null
    }
  }

  function istFilmSeite() {
    const lage = seitenLage()
    // Die Laufzeit kommt aus `seitenLage()` mit — `body.innerText` erzwingt ein
    // Neuberechnen des Layouts und wird deshalb nur an einer Stelle gelesen
    // (eine Zusicherung in `amazon.test.cjs` wacht darüber).
    /*
      **„1 Folge laut Seite" schließt einen Film nicht aus — es beschreibt ihn.**

      Bis 3.77 verlangte die Erkennung `!lage.folgenLautSeite`, also gar keine
      Zahl. „Blood-C: The Last Dark" nennt aber eine: eine. Damit galt der Film als
      Serie, der Knopf wartete auf eine Folgenliste, die es nicht gibt, und stand
      nach 42 Sekunden auf „✕ keine Folgen für diese Staffel — melden" (Daniels
      Bericht vom 28.08.2026, `istFilmSeite: false` bei `hatLaufzeit: true`,
      `hatFolgenReiter: false`, `folgenLautSeite: 1`).

      Entscheidend sind die beiden anderen Merkmale: **kein Folgen-Reiter** und
      **eine Laufzeit im Seitenkopf**. Eine Serie hat den Reiter, ein Film die
      Laufzeit. Eine Zahl über eins widerspricht dem Film weiterhin.
    */
    /*
      **Der Hydration-Block schlägt den gerenderten Text.**

      „5 Centimeters per Second" (`B0FMNGNH2G`) zeigte am 28.08.2026 erst
      „1 Film melden" und eine Sekunde später „1 von 3 — Abschnitte selbst
      öffnen", dann hing es (Daniel, mit Bild). Der Knopf war also zuerst
      richtig: Solange nur das Gerüst stand, war `folgenLautSeite` null.

      Anonym nachgemessen sagt der Block:

          entityType   Movie
          audioTracks  Deutsch, … , 日本語
          runtime      1 Std. 2 Min.
          episodeCount nicht gesetzt
          seasons      keine

      Kein Feld nennt drei Folgen, und im Quelltext steht nirgends „3 Folgen".
      Die Zahl entsteht erst im **gerenderten** Text — der Beschreibungstext
      spricht von „drei miteinander verbundenen Kurzfilmen", daneben laufen
      Empfehlungsleisten. `seitenLage()` liest `body.innerText`, und was dort
      nachträglich erscheint, kippte die Erkennung.

      Ein Textmuster gegen ein Datenfeld antreten zu lassen ist der falsche Weg
      herum. Sagt der Block „Movie" und nennt Tonspuren, ist es ein Film — was
      die Seite daneben schreibt, ändert daran nichts. Der Textweg bleibt als
      Rückfall für Seiten ohne brauchbaren Block.
    */
    if (filmAusSeite()) return true
    return !lage.hatFolgenReiter && (lage.folgenLautSeite ?? 0) <= 1 && lage.hatLaufzeit
  }

  /**
   * Die Zahl über der Folgenliste — **am Zeilenanfang**, nicht irgendwo im Text.
   *
   * ## Warum keine Ausschlussliste
   *
   * Die erste Fassung nahm den ersten Treffer von `(\d+)\s*Folgen?` und schloss
   * danach aus, was falsch aussah. Diese Liste wuchs an einem einzigen Abend
   * viermal, jedes Mal nach einem echten Fehlgriff (Daniel, 25.08.2026):
   *
   * | Seite | gelesen | richtig | Ursache |
   * |---|---|---|---|
   * | Babylon | 1 | 12 | „Staffel 1" + Reiter „Folgen" |
   * | JUJUTSU KAISEN | 3 | 12 | „Season 3" + Reiter |
   * | Made in Abyss | 2 | 6 | „Staffel 1, Volume 2" + Reiter |
   * | Detektiv Conan | 254 | 24 | „EPISODEN 231-254" + Reiter |
   *
   * Nach dem vierten war klar, dass die Liste den Fällen immer hinterherläuft:
   * Jeder neue Titelzusatz bringt eine neue Variante, und gemerkt wird es erst,
   * wenn eine falsche Zahl an den Worker gegangen ist.
   *
   * ## Was stattdessen trägt
   *
   * `body.innerText` liefert **Zeilen**, keinen Fließtext — und die Zahl über
   * der Liste steht dort immer allein auf ihrer:
   *
   * ```
   * Staffel 1, Volume 2
   * Folgen
   * Ähnliches
   * Details
   * 6 Folgen          ← die gesuchte Zeile
   * 1. Die Reise
   * ```
   *
   * Alle vier Fehlgriffe entstanden, weil der **Reiter** „Folgen" hinter einem
   * Text mit Zahl stand. Am Zeilenanfang verankert, fällt jeder davon weg,
   * ohne dass ein einziges Wort aufgezählt werden muss. Gegen alle vier
   * gemessenen Seitentexte geprüft — und gegen einen Film, der weiterhin keine
   * Zahl liefert.
   *
   * Der Preis: Diese Funktion braucht `innerText`, nicht `textContent`. Genau
   * den bekommt sie aus `seitenLage()`, das ihn ohnehin einmal je Frist liest.
   */
  function folgenAusText(text) {
    if (typeof text !== 'string') return null
    for (const m of text.matchAll(/(?:^|\n)[ \t]*(\d+)[ \t]*Folgen?\b/g)) {
      return Number(m[1]) || null
    }
    return null
  }

  let taktMs = 0
  let taktSumme = 0
  let taktMax = 0
  let takte = 0
  /**
   * **Die Kennung, die der Mitleser aus dem JSON gemeldet hat.**
   *
   * Daniel am 25.08.2026: „falsche asin darf nie passieren, das ist wieder eine
   * altlast von geparsedtem code, die asin steht auch in hydrated und metadata
   * drin."
   *
   * Er hat recht, und die Messung zeigt zugleich, warum sie die Adresse **nicht**
   * ersetzt: `pageTitleId` ist eine andere Kennung als die in der Adresse.
   *
   *     Kill Blue    Adresse B0GTN94C9M    pageTitleId B0GVSG9NN1
   *     Avatar Aang  Adresse B0H6R4L3Y8    pageTitleId B0H6QYBZFS
   *
   * Für die Zuordnung zur Prüfliste zählt deshalb weiterhin die Adresse. Die
   * gemeldete Kennung ist die **zweite** Angabe — sie gehört in die Notiz, und
   * sie kommt aus gültigem JSON statt aus einem Muster über 2,2 Millionen
   * Zeichen, das nach einem Wechsel den vorigen Titel nennt.
   */
  let gemeldeteSeitenKennung = null

  /**
   * **Serientitel und Staffelnummer, aus dem JSON gemeldet.**
   *
   * Beide standen bisher nur im Quelltext und wurden über Muster gesucht — der
   * Serientitel über vier Rückfallebenen bis hinunter zum Fenstertitel, die
   * Staffelnummer über ein Fenster um jede `titleID`-Fundstelle.
   *
   * Der Hydration-Block nennt beides direkt (gemessen an „Yu-Gi-Oh! ZEXAL"
   * Staffel 2): `parentTitle: "Yu-Gi-Oh! ZEXAL [OV]"` und `seasonNumber: 2`.
   */
  let gemeldeterSerientitel = null
  let gemeldeteStaffelNummer = null
  /** Der Bandname, wenn Prime die Staffel geteilt hat („Season 2, Volume 2"). */
  let gemeldeterBand = null

  let asinZwischenspeicher = null
  let asinZu = -1
  /**
   * **Ein Muster über den ganzen Quelltext — nicht 220 Ausschnitte.**
   *
   * Die erste Fassung lief über **alle** `titleID`-Fundstellen und legte je
   * Fundstelle einen 80-Zeichen-Ausschnitt an, um darauf ein zweites Muster
   * anzuwenden. Bei „Digimon Tamers" steht `titleID` **220-mal** im Quelltext
   * (siehe CLAUDE.md) — bis zu 220 Substring-Allokationen je Aufruf. Und
   * aufgerufen wird die Funktion mehrfach je Takt: aus `asin()`, aus
   * `quelltextPasst()`, aus `quelltextGehoertZurSeite()` und aus der Diagnose.
   *
   * Das vollständige Muster direkt über den Quelltext leistet dasselbe: Der
   * Regex-Motor sucht die erste Stelle, die **ganz** passt, und überspringt
   * Fundstellen ohne brauchbaren Wert von selbst. Genau das war der Sinn der
   * Schleife — sie hat ihn nur teuer erkauft.
   *
   * Dazu ein Zwischenspeicher an derselben Frist wie der Quelltext: Solange
   * der sich nicht geändert hat, kann sich die Kennung darin nicht ändern.
   */
  function asinAusSeite() {
    /* Aus dem JSON gemeldet schlägt aus dem Quelltext gelesen. */
    if (gemeldeteSeitenKennung) return gemeldeteSeitenKennung
    const html = seitenHtml()
    if (typeof html !== 'string') return null
    if (asinZu === htmlGelesenAm) return asinZwischenspeicher
    asinZwischenspeicher = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10,32})/.exec(html)?.[1] ?? null
    asinZu = htmlGelesenAm
    return asinZwischenspeicher
  }

  /**
   * Die Adresse beim **Seitenstart** — und welche Staffel sie meint.
   *
   * **Widerlegt am 24.08.2026:** Hier stand, alle Staffeln einer Serie teilten
   * sich eine ASIN und nur der Verweis-Parameter (`?ref_=atv_dp_season_select_s3`)
   * sage, welche gemeint ist. Gemessen an Barbapapa führt jede Staffel ihre
   * **eigene** ASIN, und `seasonNumber` steht daneben — siehe `staffelAusSeite()`.
   * Die Adresse bleibt trotzdem nützlich: Sie ist da, bevor der Quelltext steht.
   * Daniel am 23.08.2026: „ich hab dropdown nicht angefasst, sondern die seite
   * neugeladen, diese url … ?ref_=atv_dp_season_select_s3."
   *
   * **Amazon räumt den Parameter weg, sobald die Seite steht.** Dieses Skript
   * startet bei `document_idle` und sieht ihn nicht mehr — `amazon-leser.js`
   * läuft bei `document_start` und schickt ihn mit. Die Meldung von 19:31 Uhr
   * trug deshalb keine Staffelangabe, obwohl die Adresse sie enthielt.
   *
   * Die Nummer entscheidet **nichts** — gemeldet wird, was im Quelltext steht.
   * Sie kommt in die Notiz, damit später erkennbar ist, welche Staffel gemeint
   * war, auch wenn die Kennung einmal nicht zuzuordnen ist.
   */
  let startAdresse = location.href || `${location.pathname ?? ''}${location.search ?? ''}`

  /** Ab dem ersten Wechsel im Auswahlfeld ist `startAdresse` veraltet. */
  /**
   * **Ein Fahrtenschreiber für den Fall, dass es hängt.**
   *
   * Der Staffelwechsel blieb am 27.08.2026 bei „Staffel wechselt — einen
   * Moment" stehen (Daniel, an „Dragon Ball Super", Staffel 2). Von außen ist
   * nicht zu sehen, woran: Der Wechsel hängt an vier Zuständen — Kennung,
   * Listeneintrag, Zählstand, Widget-Antworten —, und welcher davon nicht
   * nachzog, weiß nur die Erweiterung selbst.
   *
   * Sie schreibt deshalb mit. Der Puffer hält die letzten 400 Ereignisse; das
   * sind bei einem 500-ms-Takt gut drei Minuten, und länger als drei Minuten
   * wartet ohnehin niemand, bevor er neu lädt.
   *
   * Abholen in der Konsole: `AK.report()` lädt eine JSON-Datei herunter.
   */
  const TAGEBUCH_MAX = 400
  const tagebuch = []

  /**
   * **Gekappt wird der einzelne Wert, nicht nur die Zahl der Einträge.**
   *
   * Vierhundert Einträge sind harmlos, solange jeder klein bleibt. Ein
   * einziges Feld mit einer Folgenliste über tausend Einträge oder einem
   * Quelltext-Ausschnitt macht daraus ein Leck, das über Stunden wächst —
   * und die Erweiterung läuft auf jeder Prime-Seite mit (Daniel, 27.08.2026:
   * „nur aufpassen das du kein memory leak einbaust").
   *
   * Deshalb: Zeichenketten auf 300 Zeichen, Listen auf 60 Einträge, alles
   * andere fliegt raus. Was hier nicht hineinpasst, gehört ohnehin in den
   * Zustandsteil des Berichts, der jedes Mal neu berechnet wird.
   */
  const kappe = (wert) => {
    if (typeof wert === 'string') return wert.length > 300 ? wert.slice(0, 300) + '…' : wert
    if (Array.isArray(wert)) return wert.length > 60 ? [...wert.slice(0, 60), `… +${wert.length - 60}`] : wert
    if (wert && typeof wert === 'object') return undefined
    return wert
  }

  function notiere(was, daten) {
    try {
      const eintrag = { t: new Date().toISOString(), was }
      for (const [k, v] of Object.entries(daten ?? {})) {
        const gekappt = kappe(v)
        if (gekappt !== undefined) eintrag[k] = gekappt
      }
      tagebuch.push(eintrag)
      if (tagebuch.length > TAGEBUCH_MAX) tagebuch.splice(0, tagebuch.length - TAGEBUCH_MAX)
    } catch {
      /* Ein Fahrtenschreiber, der die Fahrt stört, ist keiner. */
    }
  }

  /**
   * **Der Bericht, den Daniel herunterlädt.**
   *
   * Er enthält alles, was für die Ferndiagnose zählt, und nichts darüber
   * hinaus: Adresse, Version, die vier Zustände des Staffelwechsels, den
   * Zählstand und das Tagebuch. Keine Kontodaten, kein Schlüssel.
   */
  function bericht() {
    const sicher = (f) => {
      try {
        return f()
      } catch (e) {
        return `FEHLER: ${e?.message ?? e}`
      }
    }
    return {
      erzeugtAm: new Date().toISOString(),
      version: chrome?.runtime?.getManifest?.()?.version ?? 'unbekannt',
      adresse: location.href,
      zustand: {
        id: sicher(() => id),
        listenId: sicher(() => listenId),
        eintrag: sicher(() => (eintrag ? { titel: eintrag.titel, ausSuche: Boolean(eintrag.ausSuche) } : null)),
        letzteKennung: sicher(() => letzteKennung),
        staffelKennung: sicher(() => staffelKennung()),
        staffelNummer: sicher(() => staffelNummer()),
        /* Damit der nächste Bericht zeigt, welche der drei Quellen geantwortet hat. */
        staffelAusAdresse: sicher(() => staffelAusAdresse()),
        staffelAusSeite: sicher(() => staffelAusSeite()),
        gemeldeteStaffelNummer: sicher(() => gemeldeteStaffelNummer ?? null),
        gabStaffelwechsel: sicher(() => gabStaffelwechsel),
        letzteZahl: sicher(() => letzteZahl),
        letzterStand: sicher(() => letzterStand),
        letzterFortschritt: sicher(() => new Date(letzterFortschritt).toISOString()),
        wartetSeitMs: sicher(() => Date.now() - letzterFortschritt),
        langsam: sicher(() => langsam),
        taktMs: sicher(() => taktMs),
        taktMax: sicher(() => taktMax),
        takte: sicher(() => takte),
      },
      zaehlstand: sicher(() => ({
        gesamt: gesehen?.gesamt ?? null,
        fuerAdresse: gesehen?.fuerAdresse ?? null,
        nummern: [...(gesehen?.nummern ?? [])].sort((a, b) => a - b),
        jeFolge: [...(gesehen?.jeFolge ?? new Map())].map(([nr, sp]) => [nr, sp]),
        sprachen: [...(gesehen?.sprachen ?? [])],
        /*
          **Ohne dieses Feld war der Bericht vom 30.08.2026 nicht auswertbar.**

          Der Knopf stand auf „10 von 10 Folgen gelesen — 0 fehlen noch" und
          gab nicht frei. Warum, entscheidet `istVollstaendig()`: Sind
          Abschnitte bekannt, zählt allein `abschnitte.offen`, und die Zahl der
          Folgen daneben sagt gar nichts mehr. Genau die stand im Bericht — die
          entscheidende nicht.
        */
        abschnitte: gesehen?.abschnitte ?? null,
      })),
      /*
        Die Seitenlage entscheidet, ob ein Film oder eine Staffel vor uns liegt —
        und genau da lag der Knopf am 27.08.2026 falsch: Auf der Filmseite von
        „Halo: Legends" bot er „keine Folgen für diese Staffel" an, obwohl
         das hätte verhindern müssen.
      */
      lage: sicher(() => seitenLage()),
      istFilmSeite: sicher(() => istFilmSeite()),
      quelltextVeraltet: sicher(() => quelltextVeraltet()),
      seite: sicher(() => ({
        titel: document.title,
        folgenImDom: document.querySelectorAll('[data-testid="episode-list-item"], li[data-automation-id^="ep-"]').length,
        knopfText: document.querySelector('.ak-amazon-knopf')?.textContent ?? null,
      })),
      /*
        Was sonst noch das Verhalten erklärt: die Größe der Listen, der
        laufende Suchauftrag, die Zugangsart. Alles knapp gehalten — der
        Bericht soll gelesen werden, nicht gescrollt.
      */
      umfeld: sicher(() => ({
        eintraegeInListe: Object.keys(liste ?? {}).length,
        erledigteEintraege: Object.keys(erledigt ?? {}).length,
        offeneSuchen: Object.keys(suchliste ?? {}).length,
        suchauftrag: suchauftrag(),
        zugangsart: zugangsart(),
        abos: abos(),
        ueberKanal: ueberKanal(),
        teilBereich,
      })),
      tagebuch,
    }
  }

  /**
   * **Der Auslöser ist ein DOM-Ereignis, keine Variable.**
   *
   * `window.AK = …` war der falsche Weg: Ein Content-Script läuft in einer
   * eigenen Welt mit eigenem `window`. In der Konsole der Seite kam nur
   * „AK is not defined" an (Daniel, 27.08.2026, mit Bild).
   *
   * Das `document` teilen beide Welten, und DOM-Ereignisse gehen hindurch.
   * Der Befehl für die Konsole lautet deshalb:
   *
   *     document.dispatchEvent(new CustomEvent('ak-report'))
   */
  /**
   * **Der Bericht landet als Datei — zwei Wege dorthin.**
   *
   * Das Ereignis geht aus jedem Scope, auch aus `top`: Beide Welten teilen
   * sich das `document`.
   *
   *     document.dispatchEvent(new CustomEvent('ak-report'))
   *
   * `AK.report()` bleibt daneben stehen. Es funktioniert nur, wenn die Konsole
   * auf den Scope der Erweiterung umgeschaltet ist — dafür war es gedacht, und
   * genau so hat Daniel es benutzt. In 3.61 habe ich es ersatzlos gestrichen,
   * statt beide Wege zu lassen; die Folge war „AK is not defined" an einer
   * Stelle, an der es vorher ging (27.08.2026).
   */
  function berichtHerunterladen() {
    const daten = JSON.stringify(bericht(), null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([daten], { type: 'application/json' }))
    a.download = `anime-kalender-diagnose-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    console.log('[Anime-Kalender] Diagnosebericht heruntergeladen.')
    return 'Bericht heruntergeladen.'
  }

  try {
    window.AK = { bericht, report: berichtHerunterladen }
  } catch {
    /* Ohne window bleibt das Ereignis. */
  }

  try {
    document.addEventListener('ak-report', () => {
      berichtHerunterladen()
    })
    /**
     * **Gezielt wieder öffnen, was abgehakt ist.**
     *
     * „Abhaken zurücksetzen" in der Übersicht leert den ganzen Speicher — am
     * 28.08.2026 wären das sechzig Einträge gewesen, um an zwei heranzukommen.
     * Daniel brauchte genau zwei zurück („Digimon Adventure", „Blood-C"), um
     * eine Messung nachliefern zu können, und der einzige vorhandene Weg hätte
     * ihm die Arbeit eines halben Tages weggeworfen.
     *
     * Der Speicher liegt in `chrome.storage`, an das die Seiten-Konsole nicht
     * herankommt (getrennte Welten). Deshalb derselbe Weg wie beim Bericht: ein
     * Ereignis am gemeinsamen `document`.
     *
     *     document.dispatchEvent(new CustomEvent('ak-oeffnen', { detail: 'digimon' }))
     *
     * Verglichen wird gegen Titel **und** Serienname, ohne Groß-/Kleinschreibung.
     * Die Zahl der wieder geöffneten Einträge steht danach in der Konsole.
     */
    document.addEventListener('ak-oeffnen', async (e) => {
      const suche = String(e?.detail ?? '').trim().toLowerCase()
      if (!suche) {
        console.log("[AK] ak-oeffnen braucht einen Text, z. B. { detail: 'digimon' }")
        return
      }
      /*
        **Es gibt zwei Speicher, und das war der Fehler von 3.80.**

        `amazonErledigt` hält die Titelseiten, `amazonSuche` die Suchadressen.
        Die erste Fassung räumte nur den ersten, meldete Erfolg — und in der
        Liste änderte sich nichts, weil die über den zweiten filtert (Daniel,
        28.08.2026: „der command sagt in console die sind wieder offen aber sind
        sie nicht").
      */
      const offen = []
      for (const [schluessel, wert] of Object.entries(erledigt)) {
        const text = `${wert?.titel ?? ''} ${wert?.serie ?? ''}`.toLowerCase()
        if (text.includes(suche)) offen.push(schluessel)
      }
      const offeneSuchen = []
      for (const url of Object.keys(suchErledigt)) {
        const text = `${url} ${suchliste[url]?.titel ?? ''}`.toLowerCase()
        if (text.includes(suche)) offeneSuchen.push(url)
      }
      if (!offen.length && !offeneSuchen.length) {
        console.log(
          `[AK] nichts Abgehaktes passt auf „${suche}“ — ${Object.keys(erledigt).length} Titelseiten und ` +
            `${Object.keys(suchErledigt).length} Suchadressen geprüft`,
        )
        return
      }
      for (const schluessel of offen) delete erledigt[schluessel]
      for (const url of offeneSuchen) delete suchErledigt[url]
      await speicherSchreiben({ amazonErledigt: erledigt, amazonSuche: suchErledigt })
      /*
        Der lokale Speicher ist nur die Überbrückung — maßgeblich ist der
        Briefkasten. Steht die Adresse dort noch, bleibt sie abgehakt, und genau
        das soll man sehen.
      */
      await briefkastenHolen(true)
      console.log(
        `[AK] ${offen.length} Titelseite(n) und ${offeneSuchen.length} Suchadresse(n) lokal geöffnet.`,
        'Maßgeblich ist der Briefkasten — was dort noch liegt, bleibt abgehakt.',
        { titelseiten: offen, suchen: offeneSuchen },
      )
      try {
        uebersichtZeichnen()
      } catch {
        /* Die Übersicht ist nicht auf jeder Seite gebaut — der Speicher zählt. */
      }
    })
  } catch {
    /* Ohne Ereignis kein Konsolenzugang — die Erweiterung läuft trotzdem. */
  }

  let gabStaffelwechsel = false
  /** Titel und Quelltext-Kennung, wie sie zuletzt zusammen gesehen wurden. */
  let titelZuQuelltext = null

  /**
   * Die Staffelnummer, wie die Seite sie selbst nennt.
   *
   * Gemessen am 24.08.2026 an `amazon.de/dp/B0CBNFP57W`:
   *
   *     "titleID":"B0CBNFP57W" … "seasonNumber":2
   *
   * Und der Seitentitel bestätigt es: „Barbapapa, Staffel 2". **Jede Staffel
   * hat ihre eigene ASIN**, die Nummer steht im selben JSON-Block. Das ist die
   * verlässliche Quelle — sie überlebt, was Amazon mit der Adresse macht.
   *
   * Der Kommentar unten behauptete bis dahin das Gegenteil, und daran hing ein
   * echter Datenverlust: Ohne Nummer fiel der Meldeschlüssel auf die
   * **Folgenzahl** zurück, zwei Staffeln kollidierten, und die zweite Meldung
   * überschrieb die erste.
   */
  function staffelAusSeite() {
    /* Aus dem JSON gemeldet schlägt aus dem Quelltext gesucht. */
    if (Number.isFinite(gemeldeteStaffelNummer)) return gemeldeteStaffelNummer
    /*
      **Die Fundstelle gehört zur Adresse, nicht zur ersten `titleID`.**

      Die Schleife unten nimmt die erste Kennung im Quelltext — bei einer
      Serienseite ist das die Reihe oder die erste Staffel, nicht die gewählte.
      Steht die Kennung aus der Adresse im Text (bei Sekirei 91-mal), ist ihr
      Umfeld die richtige Stelle.
    */
    /*
      **Hier stand bis 4.1.7 eine zweite Suche über den ganzen Quelltext.**

      Sie sollte die `seasonNumber` im Umfeld der Adress-Kennung finden statt
      bei der ersten `titleID`. Der Gedanke stimmt — der Preis nicht: Der Aufruf
      lag in `staffelSchluessel()`, das mehrfach je Takt läuft, und jeder
      `seitenHtml()`-Aufruf baut bei Prime **zwei Megabyte** neu auf.

      Daniel am 31.08.2026: „horrible performance … es dauert 5 sec bis der
      hover effekt von einer kachel aktiviert wird", dazu ein Tab mit **9,4 GB**
      und `setInterval handler took 1228ms` in der Konsole.

      Die Staffelnummer kommt jetzt wieder allein aus der Adresse und aus dem
      Mitleser — beides kostet nichts. Dieselbe Lehre wie am 28.08.2026: Wer
      den Quelltext ein weiteres Mal liest, zahlt dafür bei jedem Takt.
    */
    const html = seitenHtml()
    if (typeof html !== 'string') return null
    // Im Umkreis der ersten titleID suchen — das ist die gerade gezeigte
    // Staffel. Weiter hinten stehen Empfehlungen mit fremden Nummern.
    for (const m of html.matchAll(/titleID/g)) {
      const fenster = html.slice(m.index, m.index + 900)
      if (!/titleID\\*"\s*:\s*\\*"[A-Z0-9]{10,32}/.test(fenster)) continue
      const n = /"seasonNumber\\*"\s*:\s*(\d+)/.exec(fenster)?.[1]
      if (n) return Number(n)
      break
    }
    // Rückfall: der Seitentitel nennt sie im Klartext.
    const ausTitel = /,\s*(?:Staffel|Season)\s*(\d+)/i.exec(document.title || '')?.[1]
    return ausTitel ? Number(ausTitel) : null
  }

  /**
   * **Die Staffelnummer — das JSON schlägt die Adresse.**
   *
   * Bis zum 25.08.2026 stand `staffelAusAdresse()` vorn, und das war richtig,
   * solange der Quelltext nach einem Wechsel veraltete: Die Adresse wanderte
   * mit, das JSON nicht.
   *
   * Seit die Angabe aus dem Hydration-Block kommt, dreht sich das um — und
   * „Yu-Gi-Oh! ZEXAL" zeigt, warum das nötig ist. Prime teilt dort jede
   * Staffel in zwei Bände und nutzt `sequenceNumber` als **Sortierschlüssel**,
   * nicht als Staffelnummer:
   *
   * ```
   * B0CB8SGJCZ  seq 1    Staffel 1, Band 2
   * B0GTJV4S7L  seq 1    Season 1, Volume 2
   * B0GV8N71SL  seq 2    Season 2, Volume 2
   * B0FHGJ7KS1  seq 3    Season 3, Volume 2
   * B01EKI0P2U  seq 101  Season 1, Volume 1
   * B01EKI0SQ8  seq 201  Season 2, Volume 1
   * ```
   *
   * Die Adresse trägt genau diese Zahl (`?ref_=atv_dp_season_select_s101`).
   * Ein Klick auf „Season 1, Volume 1" hätte also **Staffel 101** gemeldet.
   * `headerDetail.seasonNumber` sagt dort 1 — geprüft am gewählten Band, wo
   * es 2 sagt und die Adresse `s2` trägt.
   *
   * Die Adresse bleibt die Rückfallebene: Sie ist die einzige Quelle, wenn der
   * Block nicht gelesen werden konnte. Ihre Zahl wird dann aber verworfen,
   * sobald sie kein Staffelwert mehr sein kann — mehr als fünfzig Staffeln hat
   * keine Reihe bei Prime, und die Grenze trennt jeden echten Fall von den
   * dreistelligen Sortierschlüsseln.
   */
  /*
    **Die Adresse steht wieder vorn — aber nur, wenn ihre Zahl eine sein kann.**

    Drei Fälle vom 31.08.2026, alle mit Bericht in `docs/diagnose/`: Shangri-La
    Frontier, Space Dandy und Sekirei. Überall trug die Adresse
    `?ref_=atv_dp_season_select_s2`, das Auswahlfeld den Staffel-2-Namen,
    `lage.staffelZahl` die 2 — und der Knopf meldete Staffel 1.

    Seit 2.8 stand `gemeldeteStaffelNummer` vorn, weil Yu-Gi-Oh! ZEXAL zeigte,
    dass die Adresse **Sortierschlüssel** trägt: 101 und 201 für die beiden
    Bände derselben Staffel. Genau dagegen gibt es aber schon die Grenze von
    fünfzig — sie trennt jeden echten Staffelwert von jedem Sortierschlüssel.

    Die Meldung des Mitlesers hat dafür einen Nachteil, den die Adresse nicht
    hat: Sie kann **alt** sein. Sie entsteht beim Lesen des Seitenblocks, und
    nach einem Wechsel über das Auswahlfeld tauscht Amazon den nicht aus
    (CLAUDE.md, 24.08.2026). Die Adresse wandert dagegen sofort mit.

    Also: Adresse zuerst, solange ihre Zahl ≤ 50 ist; darüber gilt sie als
    Sortierschlüssel und die Meldung übernimmt. Beide Fälle sind damit
    abgedeckt, ohne dass einer den anderen kostet.
  */
  function staffelNummer() {
    const ausAdresse = staffelAusAdresse()
    if (Number.isFinite(ausAdresse) && ausAdresse <= 50) return ausAdresse
    if (Number.isFinite(gemeldeteStaffelNummer)) return gemeldeteStaffelNummer
    if (Number.isFinite(ausAdresse)) return null
    return quelltextPasst() ? staffelAusSeite() : null
  }

  function staffelAusAdresse() {
    /**
     * Zwei Quellen, und die gemerkte ist die Rückfallebene.
     *
     * Solange Amazon den Parameter noch nicht weggeräumt hat, steht er in der
     * **aktuellen** Adresse — die ist auch nach einem Staffelwechsel richtig,
     * während die gemerkte noch die erste Staffel nennt. Fehlt er dort, gilt
     * die Adresse vom Seitenstart, die `amazon-leser.js` bei `document_start`
     * gesehen hat.
     */
    /**
     * Die gemerkte Startadresse gilt nur bis zum ersten Staffelwechsel.
     *
     * Sie ist die Adresse, mit der die Seite geladen wurde — und damit die
     * Staffel, bei der Daniel eingestiegen ist. Wechselt er im Auswahlfeld,
     * nennt sie weiter die alte, und ein leerer `location.search` liesse sie
     * gewinnen: Jede Meldung waere wieder die Startstaffel.
     *
     * Genau das ist am 24.08.2026 bei „Captain Tsubasa" passiert — gemeldet
     * wurden fuenf Staffeln, abgehakt kamen S1 und S5 an.
     */
    const quellen = gabStaffelwechsel ? [location.search] : [location.search, startAdresse]
    for (const wo of quellen) {
      const n = /[?&]ref_=[^&]*_s(\d+)/.exec(wo ?? '')?.[1]
      if (n) return Number(n)
    }
    return null
  }

  /**
   * Unter welcher Nummer diese Staffel abgehakt wird — an **einer** Stelle.
   *
   * Sie wurde an zwei Orten gebildet, und beide waren falsch: der
   * Meldeschlüssel und der Vergleich in `zeichnen()`, der entscheidet, ob am
   * Knopf „✓ gemeldet" stehen bleibt. Beide fielen ohne Adressparameter auf die
   * **Folgenzahl** zurück. Zwei Fassungen derselben Regel laufen auseinander —
   * hier taten sie es sogar gleichzeitig in dieselbe falsche Richtung.
   *
   * Die Reihenfolge ist die Reihenfolge der Verlässlichkeit: die Nummer aus dem
   * Quelltext, dann die aus der Adresse, dann die ASIN. Die ASIN ist je Staffel
   * verschieden und kollidiert nie — anders als die Folgenzahl.
   */
  /**
   * Amazons Nummer für die Anzeige — aus 201 wird „2, Vol. 1".
   *
   * Ist eine Staffel in Bänden geteilt, zählt Amazon sie dreistellig:
   * Hunderterstelle ist die Staffel, die letzten beiden Stellen der Band.
   * Belegt am 25.08.2026 an „Made in Abyss" (Daniel): Das Auswahlfeld führt
   * „Staffel 1", „Staffel 1, Volume 2", „Staffel 2, Volume 1", „Staffel 2,
   * Volume 2" — gemeldet wurden sie als 1, 102, 201 und 202.
   *
   * Umgeschrieben wird nur die **Anzeige**. Der Schlüssel bleibt Amazons Zahl:
   * Er muss eindeutig sein, nicht schön, und über ihn läuft der Abgleich mit
   * den Meldungen im Worker.
   */
  function staffelText(nr) {
    const m = /^([1-9]\d?)(\d{2})$/.exec(String(nr))
    return m && Number(m[2]) > 0 ? `${m[1]}, Vol. ${Number(m[2])}` : String(nr)
  }

  function staffelSchluessel() {
    return String(staffelAusAdresse() ?? staffelAusSeite() ?? id ?? 1)
  }

  /**
   * Wie viele Ausgaben die Seite für die gerade gewählte Staffel führt.
   *
   * Prime führt dieselbe Staffel regelmäßig zweimal — bei „Mob Psycho 100 II"
   * einmal als reinen Kauftitel, einmal über ein Kanal-Abo (Daniel,
   * 30.08.2026). Die Zugangsart gilt dann nur für die geöffnete Ausgabe, und
   * genau das muss am Knopf und in der Notiz stehen.
   *
   * **Verglichen wird als Zahl.** Der erste Anlauf nahm `staffelSchluessel()`,
   * und der liefert einen String — `Number.isFinite('2')` ist `false`, der
   * Zusatz konnte also nie erscheinen. An der zweiten Stelle war die Variable
   * gar nicht im Scope; beide Zugriffe standen in einem `try`, deshalb fiel
   * nichts auf außer der ausbleibenden Wirkung.
   */
  function ausgabenDieserStaffel() {
    try {
      const nr = Number(staffelAusAdresse() ?? staffelAusSeite())
      if (!Number.isFinite(nr)) return 0
      return (gesehen?.seite?.staffeln ?? []).filter((s) => s?.nummer === nr).length
    } catch {
      return 0
    }
  }

  /**
   * Die Kennung zum Melden: erst die Seite, dann die Adresse.
   *
   * Die Adresse bleibt als Rückfallebene — sie stimmt, solange niemand die
   * Staffel gewechselt hat, und sie ist da, bevor der Quelltext steht.
   */
  /**
   * **Die Adresse zuerst — sie wandert mit, der Quelltext nicht.**
   *
   * Bis 2.3.2 galt die Kennung aus dem Quelltext als die bessere. Das war die
   * Reihenfolge aus der Zeit, in der der Quelltext die einzige Quelle war; seit
   * dem Umbau auf die Widget-Antworten ist sie schlicht falsch herum.
   *
   * Sichtbar wurde es an zwei Meldungen vom 25.08.2026, 20:20 Uhr: Für
   * „PAC-MAN und die Geisterabenteuer" — beide Staffeln — stand in der Notiz
   * „Amazon-Seite B0FFRD3ZRL". Das ist „New PANTY & STOCKING", der Titel
   * achtzehn Sekunden davor. Die **Sprachen** stimmten (26 Folgen, alle nur
   * Deutsch, an der Seite nachgemessen) — allein die Kennung stammte vom
   * vorigen Titel, und damit war die Meldung nicht mehr sauber zuzuordnen.
   *
   * Umgekehrt gibt es keinen Fall, in dem die Adresse falscher wäre als der
   * Quelltext: Sie ist da, bevor irgendetwas geladen ist, und sie ist das
   * Einzige, was Amazon beim Wechsel zuverlässig austauscht (CLAUDE.md,
   * „Der Quelltext veraltet beim Staffelwechsel").
   */
  function asin() {
    return asinAusAdresse() ?? asinAusSeite()
  }

  /**
   * Die Tonspuren der **geladenen** Folgen — und wie viele das von wie vielen sind.
   *
   * Gelesen wird aus dem Quelltext, nicht aus dem sichtbaren DOM: Amazon legt
   * die Angaben in JSON-Blöcken ab, die nie als Text erscheinen.
   *
   * ## Zwei Fehler der ersten Fassung (Daniel, 23.08.2026, mit Bild)
   *
   * Sie zeigte bei „Digimon Tamers" **27 Folgen**, während die Seite „51 Folgen"
   * nennt und im Auswahlfeld „Folgen 1–24" steht. Beides war falsch:
   *
   * 1. **Gezählt wurde jedes `audioTracks`-Feld im Quelltext** — auch solche aus
   *    Vorschauen und Empfehlungsleisten, die zu anderen Titeln gehören. Deshalb
   *    27 statt 24. Jetzt zählt nur, was zu einer `episodeNumber` gehört.
   * 2. **Amazon lädt seine Folgenliste seitenweise.** Was im Quelltext steht,
   *    ist der gerade sichtbare Ausschnitt, nicht die Staffel. Ein Befund über
   *    24 von 51 Folgen als „51 Folgen deutsch" auszugeben, wäre genau der
   *    Fehler, den dieses Projekt an anderen Quellen kritisiert.
   *
   * Deshalb wird die Gesamtzahl von der Seite gelesen und **beides** angezeigt.
   * Was nicht geladen ist, wird nicht behauptet.
   */
  /**
   * Die Sprachnamen aus einem `audioTracks`-Inhalt.
   *
   * **Zwei Formen, beide echt.** Die meisten Seiten führen schlichte Namen:
   *
   *     "audioTracks":["Deutsch","日本語"]
   *
   * „Oshi no Ko" Staffel 3 dagegen ganze Objekte (Daniel, 23.08.2026):
   *
   *     "audioTracks":[{"audioTrackId":"de-de_dialog_0","displayName":"Deutsch",
   *                     "languageCode":"de-de","audioSubtype":"dialog", …}]
   *
   * Die erste Fassung zerlegte den zweiten Fall an den Kommas und schickte
   * Bruchstücke wie `{"audioTrackId":"de-de_dialog_0` als „Sprache" an den
   * Worker. Erkannt wird die Objektform am `displayName`; bleibt keiner übrig,
   * gilt die schlichte Lesart.
   */
  function sprachnamen(inhalt) {
    const namen = [...inhalt.matchAll(/"displayName"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    if (namen.length) return namen
    return inhalt
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter((s) => s && !s.includes('{') && !s.includes(':'))
  }

  let spurenSpeicher = null
  let spurenZu = -1
  /*
    Der Zwischenspeicher hängt an `htmlGelesenAm` — solange der Quelltext
    derselbe ist, kann sich daraus nichts anderes ergeben. Gerufen wird die
    Funktion je Takt zwei- bis viermal (aus `quelltextPasst()`, direkt beim
    Zeichnen und aus dem Diagnosefeld); bei 2,2 Mio. Zeichen macht das den
    Unterschied.

    **Das Ergebnis wird geteilt und enthält `Set`-Felder.** Kein Aufrufer darf
    es verändern — heute liest `zeichnen()` nur, und dabei muss es bleiben.
  */
  function spuren() {
    const text = seitenHtml()
    if (spurenZu === htmlGelesenAm && spurenSpeicher) return spurenSpeicher
    const alle = new Set()
    const nummern = new Set()
    /*
      **Die Sprachen gehören zur Folge, nicht zur Staffel.**

      Bis zum 25.08.2026 landete alles in `alle` — sobald **eine** Folge Deutsch
      trug, meldete der Knopf „🇩🇪 Deutsch" für die ganze Staffel. Bei „Kill Blue"
      hieß das: 12 Folgen behauptet, 4 vorhanden. Daniel hat es an drei Quellen
      unabhängig gemessen (ADN 4, Netflix 4, Crunchyroll 0) und die Antwort der
      Seite selbst dagegengehalten:

          Folge 1–4    audioTracks: ["Deutsch","日本語"]
          Folge 5–12   audioTracks: ["日本語"]

      Amazon liefert es also je Folge und liefert es richtig. Der Fehler lag
      allein im Zusammenwerfen. `jeFolge` hält es getrennt; daraus entstehen die
      Bereiche in der Meldung.
    */
    const jeFolge = new Map()
    /**
     * **Gepaart über die Reihenfolge, nicht über einen Abstand.**
     *
     * Bis zum 25.08.2026 verlangte ein einziges Muster, dass `audioTracks` und
     * `episodeNumber` höchstens 400 Zeichen auseinanderliegen. Bei „Babylon"
     * liegen sie weiter auseinander — die Seite führt 15 Tonspurangaben, alle
     * mit Deutsch, und 12 Folgennummern, und die Erweiterung fand **null**
     * Paare. Der Knopf blieb auf „Tonspuren noch nicht geladen" stehen
     * (Daniel, 25.08.2026, gemessen mit `tools/amazon-tonspuren-messen.js`).
     *
     * Dass ein fester Abstand nicht trägt, steht seit dem 23.08.2026 in
     * `CLAUDE.md`: „Ein Abstand, der vom Inhalt eines Nachbarfelds abhängt, ist
     * keine Regel, sondern ein Zufall mit Frist." Die Frist ist jetzt abgelaufen.
     *
     * Stattdessen werden beide Feldarten mit ihrer Position eingesammelt und
     * der Reihe nach gepaart: Zu einer Tonspurangabe gehört die **nächste**
     * Folgennummer dahinter — aber nur, wenn vorher keine weitere
     * Tonspurangabe kommt. Das braucht keine Zahl und gilt unabhängig davon,
     * wie viel Amazon dazwischenschreibt.
     */
    const tonspuren = [...text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)]
    const folgenNr = [...text.matchAll(/"episodeNumber"\s*:\s*(\d+)/g)]
    let nrIndex = 0
    for (let i = 0; i < tonspuren.length; i++) {
      const von = tonspuren[i].index ?? 0
      const bis = tonspuren[i + 1]?.index ?? text.length
      while (nrIndex < folgenNr.length && (folgenNr[nrIndex].index ?? 0) < von) nrIndex++
      const treffer = folgenNr[nrIndex]
      if (!treffer || (treffer.index ?? 0) >= bis) continue
      const nr = Number(treffer[1])
      nummern.add(nr)
      const namen = sprachnamen(tonspuren[i][1])
      jeFolge.set(nr, namen)
      for (const name of namen) alle.add(name)
    }
    /**
     * Wie viele Folgen die Staffel insgesamt hat.
     *
     * Steht als Fließtext über der Liste („51 Folgen") und zusätzlich als Feld.
     * Fehlt beides, bleibt die Zahl offen — dann wird auch keine Vollständigkeit
     * behauptet.
     */
    /**
     * Das Seitengerüst zuerst — es gehört zur **gezeigten** Staffel.
     *
     * Bis zum 24.08.2026 stand `episodeCount` vorn, mit der Begründung, das
     * Seitengerüst nenne nur die Zahl des gerade gewählten Abschnitts. An drei
     * Seiten nachgemessen stimmt das nicht: Digimon Tamers zeigt `>51 Folgen<`
     * bei den Abschnitten 1–24, 25–48 und 49–51; Bakugan Staffel 1 zeigt 13 bei
     * einem Abschnitt; Barbapapa Staffel 1 zeigt 45. Auf allen dreien fehlte
     * `episodeCount` im Rohzustand ganz — es kommt erst mit den nachgeholten
     * Abschnitten.
     *
     * Und genau darin lag der Fehler: Nach einem Staffelwechsel steht dort noch
     * die Zahl der **vorigen** Staffel, und sie gewann. Der Knopf sagte „55
     * Folgen" auf einer Staffel mit 45 (Daniel, 24.08.2026, zweimal gemeldet).
     */
    const gesamt =
      Number(/>\s*(\d+)\s*Folgen\s*</.exec(text)?.[1]) ||
      Number(/"episodeCount"\s*:\s*(\d+)/.exec(text)?.[1]) ||
      null

    /**
     * Ein Film hat keine Folgenliste — und damit keine `episodeNumber`.
     *
     * Die Suche oben verlangt beides nebeneinander und findet bei „Sing a Bit
     * of Harmony" deshalb nichts; der Knopf blieb auf „Tonspuren noch nicht
     * geladen" (Daniel, 23.08.2026, mit Bild). Ein Film ist aber genau der
     * einfache Fall: **eine** Tonspurangabe für **einen** Titel.
     *
     * Erkannt wird er daran, dass die Seite keine Folgenzahl nennt. Gezählt
     * wird er als eine Einheit, damit der Knopf eine Zahl zeigt und die
     * Vollständigkeitsprüfung aufgeht.
     */
    if (!alle.size && gesamt === null) {
      for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)) {
        for (const name of sprachnamen(m[1])) alle.add(name)
      }
      if (alle.size) {
        nummern.add(1)
        jeFolge.set(1, [...alle])
      }
    }

    spurenSpeicher = { sprachen: [...alle], nummern, gesamt, jeFolge }
    spurenZu = htmlGelesenAm
    return spurenSpeicher
  }

  /**
   * Der Serientitel, wie ihn die Seite selbst nennt.
   *
   * Gebraucht für Staffeln, die unser Bestand nicht kennt — etwa solche, die
   * nur über ein Zusatzabo laufen (Daniel, 23.08.2026: „staffel 3 ist nur mit
   * aniverse anschaubar").
   */
  function seitenTitel() {
    /* Aus dem JSON gemeldet schlägt aus dem Quelltext gesucht. */
    if (gemeldeterSerientitel) return gemeldeterSerientitel
    /**
     * `document.title` taugt nicht — gemessen, nicht vermutet.
     *
     * Bei „Oshi no Ko" Staffel 3 steht dort **„Amazon.de: Season 3"**: kein
     * Serienname, nur die Staffelnummer und der Shopname. Genau so kam die
     * Meldung am 23.08.2026 an, und zuzuordnen war sie damit nicht.
     *
     * Der Serientitel steht im Quelltext, und zwar in der Überschrift der
     * Seite. Probiert wird von der verlässlichsten Stelle abwärts; erst zum
     * Schluss der Fenstertitel, und der nur, wenn er nach etwas aussieht.
     */
    /**
     * Das Open-Graph-Feld zuerst — es ist dafür gemacht, geteilt zu werden.
     *
     * Weder `<h1>` noch `pageTitle` lieferten bei „Oshi no Ko" Staffel 3
     * etwas; die Meldung kam zweimal ohne Titel an (23.08.2026). `og:title`
     * steht dagegen in jeder Seite, die in einer Linkvorschau erscheinen soll,
     * und trägt den Serientitel ohne Staffelzusatz.
     */
    /**
     * Das Auswahlfeld der Staffeln — die verlässlichste Stelle.
     *
     * Gemessen am 23.08.2026 an „Oshi no Ko" Staffel 3: `og:title`,
     * `twitter:title` und `<h1>` sind **alle leer**, `document.title` trägt
     * „Amazon.de: Season 3 ansehen | Prime Video". Der Serientitel steht
     * einzig im Auswahlfeld:
     *
     *     <span class="_36qUej">[Oshi No Ko] - [Mein*Star] - Staffel 1</span>
     *
     * Die Klasse ist generiert und beim nächsten Amazon-Deploy eine andere —
     * gesucht wird deshalb nach dem **Textmuster**, nicht nach dem Element.
     *
     * **Nur der Teil vor „ - Staffel N" wird genommen, nie die Nummer.** Im
     * Auswahlfeld stand „Season 3", im Quelltext fand sich trotzdem
     * „… - Staffel 1" (Daniel, 23.08.2026, mit Bild): Der Quelltext führt alle
     * Einträge, nicht nur den gewählten. Der Serientitel ist bei allen
     * derselbe und deshalb brauchbar; die Staffelnummer kommt ausschließlich
     * aus dem Verweis-Parameter.
     */
    /**
     * **Die Reihenfolge ist seit dem 24.08.2026 umgekehrt** — und das aus einem
     * Fehler heraus, der teuer hätte werden können.
     *
     * Das Auswahlfeld-Muster stand vorn. Es sucht „*Titel* – Staffel N" im
     * **gesamten** HTML, und wo das echte Auswahlfeld nur „Staffel 1" trägt —
     * ohne Serienname davor, wie bei „Chaika" —, trifft es den ersten
     * passenden Text irgendwo sonst: eine Empfehlungskachel.
     *
     * Sichtbar wurde es im Diagnose-Tooltip, den Daniel geschickt hat:
     *
     *     Serie im Bestand: Ragna Crimson · Seitentitel: Ragna Crimson
     *
     * Auf einer Chaika-Seite. Und weil der Serientitel seit 0.72 Meldungen
     * einem Listeneintrag zuordnet, hätte das den Befund einer Serie an eine
     * andere geschrieben.
     *
     * `og:title` ist dafür gemacht, **diese** Seite zu benennen, und kann
     * nichts aus einer Kachel aufschnappen. Das Auswahlfeld bleibt als
     * Rückfall: Bei „Oshi no Ko" Staffel 3 sind `og:title`, `twitter:title`
     * und `<h1>` allesamt leer (gemessen 23.08.2026), und dort ist es die
     * einzige Quelle.
     */
    const ausOg = document
      .querySelector?.('meta[property="og:title"], meta[name="twitter:title"]')
      ?.getAttribute?.('content')
    if (ausOg) {
      const sauber = saeubern(ausOg)
      if (sauber) return sauber
    }

    for (const wahl of ['h1', '[data-automation-id="title"]', '[data-testid="title"]']) {
      const text = document.querySelector?.(wahl)?.textContent
      if (text) {
        const sauber = saeubern(text)
        if (sauber) return sauber
      }
    }

    /**
     * **Erst den Anker suchen, dann rückwärts lesen — nicht umgekehrt.**
     *
     * Hier stand `([^<>"]{3,120}?)\s+[-–—]\s+(?:Staffel|Season)\s+\d+`, und
     * dieses Muster war mit Abstand der teuerste Posten der ganzen Erweiterung:
     * **81,4 ms je Durchlauf**, gemessen am 25.08.2026 über einen Quelltext von
     * knapp einer Million Zeichen — dreißigmal mehr als alle anderen Muster
     * zusammen.
     *
     * Der Grund ist nicht die Länge des Quelltextes, sondern das **faule
     * Zählquantiv**: An jeder der rund einer Million Startstellen probiert der
     * Regex-Motor die Längen 3, 4, 5 … durch, bis die Zeichenklasse abbricht.
     * Ohne Tags im Text sind es sogar 119 ms — die Zahl hängt also nicht an der
     * Füllmasse, sondern am Rückzugsverhalten.
     *
     * Und der Rückfall ist kein Sonderfall: Er greift, sobald `og:title`,
     * `twitter:title` und `<h1>` **alle** leer sind — genau so sah „Oshi no Ko"
     * Staffel 3 aus (23.08.2026). Dort ruft ein Takt `seitenTitel()` bis zu
     * fünfmal auf; fünfmal 81 ms sind 400 ms in einem 500-ms-Takt. Das deckt
     * sich mit der Messung in Daniels Sitzung: `taktMax: 417 ms`.
     *
     * Jetzt sucht ein billiges Muster den **Anker** („– Staffel 3"), und der
     * Titel wird aus den 120 Zeichen davor gelesen. Der Motor hat damit
     * höchstens so viele Startstellen wie es Trennzeichen gibt, statt einer je
     * Zeichen.
     */
    const anker = /\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(seitenHtml())
    if (anker) {
      const davor = seitenHtml().slice(Math.max(0, anker.index - 120), anker.index)
      const ausAuswahl = /([^<>"]{3,120})$/.exec(davor)?.[1]
      if (ausAuswahl) {
        const sauber = saeubern(ausAuswahl)
        if (sauber) return sauber
      }
    }

    const html = seitenHtml()
    // Amazons eigener Titel für diese Seite — dasselbe Feld, das die
    // Freigabehinweise und die Besetzung trägt.
    const ausDaten = /"pageTitle"\\*"?\s*:\s*\\*"([^"\\]{3,120})/.exec(html)?.[1]
    if (ausDaten) {
      const sauber = saeubern(ausDaten)
      if (sauber) return sauber
    }

    return saeubern(document.title ?? '')
  }

  /**
   * Aus einem gefundenen Text einen brauchbaren Titel machen — oder keinen.
   *
   * „Season 3" allein ist kein Titel, „Amazon.de: Season 3" erst recht nicht.
   * Lieber nichts schicken als etwas, das beim Zuordnen in die Irre führt: Die
   * Kennung und die Staffelnummer tragen die Meldung dann allein.
   */
  function saeubern(roh) {
    const geputzt = String(roh)
      .replace(/^Amazon\.de\s*:\s*/i, '')
      .replace(/\s*[|–—-]\s*(Prime Video|Amazon\.de|Amazon Prime).*$/i, '')
      .replace(/\s+(ansehen|anschauen|streamen)\s*$/i, '')
      .trim()
    if (!geputzt || geputzt.length < 3) return null
    if (/^(season|staffel)\s*\d+$/i.test(geputzt)) return null
    if (/^amazon\.de$/i.test(geputzt)) return null
    return geputzt
  }

  /**
   * Wie man an diesen Titel kommt: im Abo, gegen Geld, oder beides.
   *
   * Amazon führt beides nebeneinander, und die Seite sagt es im Klartext —
   * „Als Kauftitel verfügbar", „Folge 1 kaufen in HD 2,99 €", „Staffel 1
   * kaufen HD 29,99 €". Daneben steht das Abo als `benefitId` im Quelltext.
   *
   * **Beides zugleich ist der Regelfall, nicht die Ausnahme.** „Akane-banashi"
   * läuft im aniverse-Abo **und** ist einzeln zu kaufen (Daniel, 23.08.2026,
   * mit Bild). Wer nur eines meldet, meldet die Hälfte.
   *
   * Gelesen wird der **sichtbare Text**, nicht nur das JSON: Ein `benefitId`
   * steht auch bei Titeln, die zusätzlich Geld kosten, und fehlt bei reinen
   * Kauftiteln ganz. Die Kaufhinweise sind verlässlicher, weil Amazon sie dem
   * Kunden zeigen muss.
   *
   * Bleibt beides stumm, wird **nichts** behauptet — der Datensatz hat schon
   * 202 Verweise mit geratener Zugangsart, ein weiterer hilft niemandem.
   */
  let zugangSpeicher = null
  let zugangZu = -1
  function zugangsart() {
    const text = seitenHtml()
    if (zugangZu === htmlGelesenAm && zugangSpeicher !== null) return zugangSpeicher
    const kauf =
      /Als Kauf-?\s*(oder Leihtitel|titel)\s*verfügbar/i.test(text) ||
      /(Folge|Staffel)\s+\d+\s+kaufen/i.test(text) ||
      /Kaufen\s+(SD|HD|UHD)\b/.test(text)
    const leihe =
      /Als Kauf- oder Leihtitel verfügbar/i.test(text) || /Leihen\s+(SD|HD|UHD)\b/.test(text)
    const abo = abos().length > 0

    zugangSpeicher =
      abo && kauf ? 'abo_und_kauf' : abo ? 'abo' : kauf ? (leihe ? 'kauf_oder_leihe' : 'kauf') : null
    zugangZu = htmlGelesenAm
    return zugangSpeicher
  }

  /**
   * Wie viele Staffeln dieser Titel hat — laut Seite.
   *
   * Amazon schreibt es in die Kopfzeile: „Kinder · Animation · Drama · 4.8/5
   * · IMDb 7,7/10 · 1988 · **5 Staffeln**". Ohne diese Zahl weiß die
   * Erweiterung nicht, wann ein Titel wirklich durch ist.
   *
   * Fehlt sie, gilt der Titel als einstaffelig — dann ist eine Meldung eine
   * ganze Auskunft, und das ist der häufigere Fall.
   */
  function staffelZahl() {
    /*
      **Zwei Einträge, eine Staffel — Amazon zählt trotzdem zwei.**

      Bei „Kakushite! Makina-san!!" führt Prime dieselbe erste Staffel zweimal
      (zwei Ausgaben, beide `sequenceNumber: 1`) und schreibt „2 Staffeln" in
      den Seitentext. Die Erweiterung verlangte daraufhin eine zweite Meldung —
      für eine Staffel, die es nicht gibt (Daniel, 30.08.2026: „auf amazon gibt
      es 2x die 1. staffel, aber keine 2., also kann ich auch keine 2. staffel
      melden, was die extension aber möchte").

      Die Staffelliste aus dem Hydration-Block weiß es besser: Sie nennt je
      Eintrag die Nummer, und verschiedene Nummern sind verschiedene Staffeln.
      Der Seitentext bleibt Rückfall, solange sie fehlt.

      In `try`, weil `gesehen` weiter unten angelegt wird und diese Funktion
      beim Seitenaufbau läuft — derselbe Grund wie bei `nichtAngekommen()`.
    */
    const ausText = seitenLage().staffelZahl
    try {
      const staffelListe = gesehen?.seite?.staffeln ?? []
      const nummern = new Set(staffelListe.map((s) => s?.nummer).filter((n) => Number.isFinite(n)))
      /*
        **Nur eine vollständige Liste darf die Zahl senken.**

        Die Staffelliste trifft mit Verzögerung ein. Steht dort erst ein
        Eintrag, während der Seitentext „5 Staffeln" sagt, wäre eine 1 keine
        Korrektur, sondern ein halber Ladezustand — und die Serie gälte nach
        einer einzigen Meldung als fertig. Genau das ist bei „Danmachi" passiert:
        Staffel 1 gemeldet, Eintrag weg, Staffel 2 nicht mehr meldbar (Daniel,
        30.08.2026).

        Vollständig ist die Liste, wenn sie so viele Einträge hat, wie die Seite
        Staffeln nennt. Dann — und nur dann — zählen ihre Nummern: bei
        „Kakushite" zwei Einträge mit derselben Nummer 1, also eine Staffel.
      */
      if (nummern.size && staffelListe.length >= ausText) return nummern.size
    } catch {
      /* Noch keine Staffelliste — dann gilt die Zahl aus dem Seitentext. */
    }
    return ausText
  }

  /**
   * Laeuft dieser Titel ueber einen fremden Kanal statt ueber Prime selbst?
   *
   * Amazon fuehrt beides unter derselben Oberflaeche: eigene Inhalte
   * ("In Prime enthalten", benefitId "Prime") und Kanal-Abos wie ADN,
   * aniverse oder Crunchyroll, die man dort dazubucht.
   *
   * **Der Unterschied entscheidet, ob die Sprachangabe etwas taugt.** Bei
   * "Kill Blue" behauptet Amazon 12 deutsche Folgen; ADN, die Quelle hinter
   * dem Kanal, hat 2 (Daniel, 24.08.2026). Offenbar zeigt Amazon dort die
   * Sprachen des Kanals, nicht die der Folge.
   *
   * Ein Kauftitel zaehlt nicht als Kanal: Was gekauft wird, hat seine
   * eigene Tonspur, und die kennt Amazon.
   */
  let kanalSpeicher = null
  let kanalZu = -1
  function ueberKanal() {
    seitenHtml()
    if (kanalZu === htmlGelesenAm && kanalSpeicher !== null) return kanalSpeicher
    kanalSpeicher = ueberKanalRechnen()
    kanalZu = htmlGelesenAm
    return kanalSpeicher
  }

  function ueberKanalRechnen() {
    const gefunden = abos()
    if (!gefunden.length) return false
    if (gefunden.some((a) => /^prime$/i.test(a))) return false
    const art = zugangsart()
    if (art === 'kauf' || art === 'kauf_oder_leihe') return false
    return true
  }

  /** Welche Abos diese Staffel freischalten — `Prime`, `aniversede`, … */
  let abosSpeicher = null
  let abosZu = -1
  function abos() {
    const text = seitenHtml()
    if (abosZu === htmlGelesenAm && abosSpeicher) return abosSpeicher
    abosSpeicher = [...new Set([...text.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))]
    abosZu = htmlGelesenAm
    return abosSpeicher
  }

  const liste = globalThis.AK_OFFENE_AMAZON ?? {}

  /**
   * **„Alles geprüft" ist nur wahr, solange die Liste aktuell ist.**
   *
   * `AK_OFFENE_AMAZON` liegt in der Erweiterung, nicht auf dem Server: Was der
   * Bau hinzufügt, sieht der Browser erst nach einem Neuladen in
   * `chrome://extensions`. Bis dahin sagt der Knopf „Prime: alles geprüft" und
   * meint „in meiner Liste steht nichts mehr" — zwei verschiedene Aussagen.
   *
   * Real am 02.09.2026: „Karakai Jouzu no Takagi-san 2" kam um 08:53 in die
   * Liste. Um 11:16 stand der Titel auf dem Bildschirm, die Statusanzeige
   * zählte ihn als offen, und der Knopf meldete „alles geprüft". Beide hatten
   * recht — nur aus verschiedenen Ständen, und nichts sagte es.
   *
   * Verglichen wird eine **Prüfsumme der Prüfliste** gegen die der Live-Seite.
   * Einmal je Stunde; ein Fehlschlag bleibt folgenlos — dann steht dort eben kein
   * Hinweis.
   *
   * **Nicht der Datenstand.** Die erste Fassung verglich `meta.generatedAt`, und
   * das war ein Fehlalarm-Generator: Der Datensatz wird stündlich neu gebaut, die
   * Prüfliste ändert sich dabei fast nie. Zwölf Minuten nach dem Neuladen stand
   * bei Daniel wieder „Prime-Liste veraltet" auf dem Bildschirm (02.09.2026) —
   * bei einer Liste, die Zeichen für Zeichen die aktuelle war. Eine Warnung, die
   * zuverlässig zu Unrecht kommt, ist schlimmer als keine.
   */
  const STAND_FRIST_MS = 60 * 60 * 1000
  let listeVeraltet = false
  let standGeprueftAm = 0

  async function standPruefen() {
    const eigener = globalThis.AK_OFFENE_AMAZON_STAND ?? null
    if (!eigener) return
    if (Date.now() - standGeprueftAm < STAND_FRIST_MS) return
    standGeprueftAm = Date.now()
    try {
      const antwort = await fetch('https://anime-kalender.de/data/pruefliste-stand.json', { cache: 'no-store' })
      if (!antwort.ok) return
      const daten = await antwort.json()
      /*
        **Verglichen wird die Prüfliste, nicht der Datenstand.**

        `generatedAt` ändert sich stündlich mit jedem Bau; die Prüfliste ändert
        sich fast nie. Die erste Fassung verglich den Datenstand und meldete
        deshalb zwölf Minuten nach dem Neuladen wieder „veraltet" — bei einer
        Liste, die Zeichen für Zeichen die aktuelle war.
      */
      if (!daten?.amazon) return
      listeVeraltet = String(daten.amazon) !== String(eigener)
    } catch {
      /* Kein Netz, keine Aussage — der Hinweis bleibt weg, statt falsch zu sein. */
    }
  }
  /**
   * **Die Prüflisten kommen von der Seite, nicht aus dem Paket.**
   *
   * Beide Listen stecken als Datei in der Erweiterung und altern damit ab dem
   * Moment, in dem sie gepackt wurde. Am 31.08.2026 sagte die Erweiterung
   * „Prime: alles geprüft", während die Statusanzeige 24 offene Suchen zeigte —
   * beide hatten recht, nur lag zwischen ihnen ein Tiefendurchlauf, der 25 neue
   * Aufträge erzeugt hatte. Daniel: „single source of truth."
   *
   * Beim Start wird deshalb nachgeladen, was der Bau zuletzt veröffentlicht hat.
   * Die gepackte Fassung bleibt als Rückfall: Ohne Netz oder mit einer alten
   * Seite arbeitet die Erweiterung weiter, nur eben mit dem Stand von damals.
   *
   * Zwischengespeichert wird in `chrome.storage.local` — ein Abruf je zehn
   * Minuten reicht für eine Liste, die sich im Takt der Datenläufe ändert, und
   * ein neuer Prime-Tab kostet dann nichts.
   */
  let suchliste = globalThis.AK_PRIME_SUCHE ?? {}
  const FRISCH_MS = 10 * 60 * 1000
  const QUELLE = 'https://anime-kalender.de/data/prime-suche.json'
  ;(async () => {
    try {
      const { primeSuche } = await chrome.storage.local.get('primeSuche')
      if (primeSuche?.stand && Date.now() - primeSuche.stand < FRISCH_MS) {
        if (primeSuche.liste) uebernehmen(primeSuche.liste)
        return
      }
      const antwort = await fetch(QUELLE, { cache: 'no-store' })
      if (!antwort.ok) return
      const frisch = await antwort.json()
      if (frisch && typeof frisch === 'object' && Object.keys(frisch).length) {
        await chrome.storage.local.set({ primeSuche: { stand: Date.now(), liste: frisch } })
        uebernehmen(frisch)
      }
    } catch {
      /* Ohne Netz bleibt die gepackte Liste — sie ist alt, aber sie trägt. */
    }
  })()

  /** Die frische Liste einsetzen und alles neu zeichnen, was aus ihr liest. */
  function uebernehmen(frisch) {
    if (JSON.stringify(frisch) === JSON.stringify(suchliste)) return
    suchliste = frisch
    try {
      uebersichtZeichnen()
    } catch {
      /* Der Kasten steht noch nicht — dann zeichnet ihn der nächste Takt. */
    }
  }

  // --- Suchseiten: der Weg zur echten Titelseite ----------------------------

  /**
   * **118 unserer Prime-Verweise sind Suchen, keine Titelseiten.**
   *
   * Weder AniList noch aniSearch liefern für diese Titel eine belastbare
   * Produktseite, und weder MOTN noch TMDB führen eine (beides am 27.08.2026
   * gemessen, beides null Treffer). Auf einer Suchseite gibt es keine
   * Tonspuren zu lesen.
   *
   * Was die Erweiterung kann: den Weg zeigen. Hier steht ein Hinweis, welcher
   * Titel gemeint ist; der Klick auf den richtigen Treffer hinterlegt ihn für
   * zehn Minuten, und auf der Titelseite läuft die gewohnte Prüfung — auch
   * wenn deren Adresse in keiner Liste steht.
   *
   * Der Rest ist schon gebaut: Die Handbeleg-Datei kennt ein Feld für „die
   * richtige Adresse, falls die im Datensatz danebenliegt", und der
   * Übernahme-Lauf ordnet eine unbekannte Adresse über den Namen zu.
   */
  const SUCH_SCHLUESSEL = 'ak-prime-suchauftrag'

  function suchauftragMerken(auftrag) {
    try {
      sessionStorage.setItem(SUCH_SCHLUESSEL, JSON.stringify({ ...auftrag, zeit: Date.now() }))
    } catch {
      /* Ohne Speicher fällt nur diese Bequemlichkeit aus. */
    }
  }

  /** Der Auftrag ist abgearbeitet — Speicher leeren, Kasten entfernen. */
  function suchauftragVergessen() {
    try {
      sessionStorage.removeItem(SUCH_SCHLUESSEL)
    } catch {
      /* Ohne Speicher gab es auch nichts zu vergessen. */
    }
    document.querySelector('.ak-amazon-suchhinweis')?.remove()
  }

  function suchauftrag() {
    try {
      const roh = sessionStorage.getItem(SUCH_SCHLUESSEL)
      if (!roh) return null
      const a = JSON.parse(roh)
      return Date.now() - a.zeit > 600000 ? null : a
    } catch {
      return null
    }
  }

  /** Steht die aktuelle Adresse als Suche auf der Liste? */
  function offeneSuche() {
    /*
      **Verglichen wird der Suchbegriff, nicht die Adresse.** Amazon hängt beim
      Aufruf eigene Parameter an (`crid`, `sprefix`), und alle 118 Adressen aus
      unserem Bestand tragen ein `k` — geprüft, nicht angenommen.
    */
    const begriff = new URLSearchParams(location.search).get('k')
    if (!begriff) return null
    for (const [url, wert] of Object.entries(suchliste)) {
      try {
        /*
          **Der Auftrag wird auch unter seinem Suchbegriff wiedererkannt.**

          Seit 4.1.1 öffnet die Prüfliste nicht mehr die Adresse aus dem
          Bestand, sondern den beigelegten `suchbegriff` — den deutschen Titel
          ohne Gattungswörter. Der Vergleich lief aber weiter nur gegen den
          `k`-Parameter des Listenschlüssels, und der trägt den alten Begriff.

          Folge: Nach einem Klick aus der Liste fand `offeneSuche()` nichts, es
          gab keinen Auftrag, und der Kasten blieb aus (Daniel, 31.08.2026:
          „immer noch keine hinweise nach klick auf eintrag in prüfliste" —
          Diagnose zeigte `suchauftrag: null` bei 129 offenen Suchen).

          Verglichen wird deshalb gegen alle drei Schreibweisen: den Schlüssel,
          den deutschen Suchbegriff und den englischen. Gemeldet wird weiterhin
          unter `suchUrl` — der Adresse aus dem Bestand.
        */
        const ausSchluessel = new URLSearchParams(new URL(url).search).get('k')
        if (
          ausSchluessel === begriff ||
          (wert?.suchbegriff && wert.suchbegriff === begriff) ||
          (wert?.suchbegriffEn && wert.suchbegriffEn === begriff)
        ) {
          return { ...wert, suchUrl: url }
        }
      } catch {
        /* Eine kaputte Adresse in der Liste hält den Rest nicht auf. */
      }
    }
    return null
  }

  /**
   * **Was die Suchseite wirklich gefunden hat — und was nur Werbung ist.**
   *
   * Prime Video legt jeden Treffer als `article[data-testid="card"]` ab, mit
   * allem Nötigen in Attributen:
   *
   * ```
   * data-card-title       "Saber Rider and the Star Sheriffs"
   * data-card-entity-type "TV Show" | "Movie"
   * a[href]               /gp/video/detail/B088PPNGFS?…
   * ```
   *
   * **Die Falle ist die Liste darum.** Findet die Suche nichts, füllt Amazon
   * die Seite trotzdem mit Karten — unter `ul[aria-label="Mehr entdecken"]`.
   * Bei der Suche nach „009 Re:Cyborg" standen dort Predator, Aliens und
   * Hentai Kamen (Daniel, 27.08.2026, mit Quelltext). Wer die mitzählt, hält
   * fünf Empfehlungen für fünf Treffer.
   *
   * Dieselbe Verwechslung hat schon einmal Geld gekostet: Bei Disney+ galt die
   * Empfehlungsleiste als Staffel, und aus 86 Folgen wurden 94.
   */
  /**
   * **Nur eine Liste auf der Seite enthält Suchtreffer: „Beste Ergebnisse".**
   *
   * Prime Video stapelt auf einer Suchseite mehrere Karussells übereinander,
   * alle aus denselben `article[data-testid="card"]`:
   *
   * ```
   * ul[aria-label="Beste Ergebnisse"]              ← die Treffer
   * ul[aria-label="Death Note -Zuschauer sahen auch"]  Empfehlung
   * ul[aria-label="Mehr entdecken"]                    Empfehlung
   * ```
   *
   * Deshalb wird eingeschlossen statt ausgeschlossen. Eine Liste zu verwerfen,
   * weil sie „Mehr entdecken" heißt, hat zweimal danebengelegen: Bei „Angels
   * of Death" stand der gesuchte Titel als Karte 0 genau dort, bei „009
   * Re:Cyborg" standen dort Predator und Aliens. Der Listenname trennt also
   * nicht Treffer von Werbung — nur der Name **dieser einen** Liste tut es.
   *
   * Fehlt sie ganz, hat die Suche nichts gefunden. Amazon schreibt das dann
   * auch hin („Für … wurden keine Ergebnisse gefunden"), aber die fehlende
   * Liste ist das robustere Merkmal: Sie hängt nicht an einem Satz.
   */
  const ERGEBNISLISTE = /^(beste ergebnisse|best results|ergebnisse|results)/i

  function suchTreffer() {
    const karten = [...document.querySelectorAll('article[data-testid="card"]')]
    return {
      /** Alle Karten auf der Seite. Null davon heißt: nichts gelesen. */
      gesehen: karten.length,
      /**
       * Wie viele in der Ergebnisliste stehen — nur zur Anzeige.
       *
       * **Entschieden wird über den Namen, nicht über die Liste.** Drei Anläufe
       * haben das gekostet: erst wurden Empfehlungslisten ausgeschlossen (dann
       * fiel „Angels of Death" als Karte 0 unter „Mehr entdecken" durch), dann
       * nur „Beste Ergebnisse" eingeschlossen (dann fiel derselbe Titel wieder
       * durch, weil Amazon auf dieser Suchseite gar keine Ergebnisliste
       * ausliefert — nur zwanzig Empfehlungen, deren erste der gesuchte Titel
       * ist).
       *
       * Beide Male war die Liste das falsche Merkmal. Was „009 Re:Cyborg" von
       * „Angels of Death" trennt, ist nicht, wo die Karten stehen, sondern ob
       * eine davon so heißt wie der gesuchte Titel: Dort Saber Rider und
       * Predator, hier „Angels of Death" auf Position 0.
       */
      echte: karten.filter((k) => ERGEBNISLISTE.test((k.closest('ul')?.getAttribute('aria-label') ?? '').trim())).length,
      treffer: karten.map((k) => ({
        titel: k.getAttribute('data-card-title') ?? '',
        typ: k.getAttribute('data-card-entity-type') ?? '',
        /*
          „Entitled" heißt, dass Daniels Konto den Titel abspielen darf —
          Prime-eigen oder über ein gebuchtes Kanal-Abo. Für die Tonspur sagt
          das nichts, aber es sagt, ob ein Klick dorthin überhaupt etwas
          bringt. Kanal-Titel bleiben die bekannte Grauzone: Amazon nennt dort
          die Sprachen des Kanals, nicht der Folge.
        */
        zugang: k.getAttribute('data-card-entitlement') ?? '',
        url: k.querySelector('a[href*="/gp/video/detail/"]')?.getAttribute('href') ?? null,
      })),
    }
  }

  /** Titel auf ihren Kern bringen — dieselbe Kürzung wie bei Crunchyroll. */
  const titelKern = (t) =>
    (t ?? '')
      .toLowerCase()
      .replace(/\b(staffel|season|vol\.?|volume|teil|part)\s*\d+\b/g, '')
      .replace(/[^a-z0-9]/g, '')

  /**
   * **Prime zählt Teile, wo unser Bestand keinen Teil kennt.**
   *
   * Gemessen am 28.08.2026 an „Code Geass: Akito the Exiled — The Wyvern
   * Arrives". Die Karte auf Platz 1 der Trefferliste ist der richtige Titel,
   * der Kasten sagte trotzdem „2 Treffer gelesen, keiner passt":
   *
   *     Auftrag  codegeassakitotheexiled thewyvernarrives
   *     Karte    codegeassakitotheexiled1thewyvernarrivesova
   *
   * Zwei Abweichungen, beide von Prime hinzugefügt: die **Teilnummer** mitten
   * im Titel und das **Typ-Kürzel** am Ende. `titelKern` streicht „Teil 1" und
   * „Part 1", aber eine nackte Ziffer war nie vorgesehen — und weil sie in der
   * Mitte steht, greift auch der Rückfall über `includes` nicht.
   *
   * **Beide Regeln sind eng gefasst, und das mit Absicht.** Die Ziffer wird nur
   * einstellig und nur als eigenes Wort entfernt: „Mob Psycho 100" und
   * „Ranking of Kings" behalten ihre Zahlen, „Golden Kamuy 2" ebenfalls — dort
   * ist die Zahl die Staffel, und die trennt `staffelImTitel()` weiterhin. Das
   * Kürzel fällt nur am **Ende**; mittendrin trennt es Ausgaben voneinander
   * (siehe CLAUDE.md, „Wolf’s Rain OVA" gegen die Serie).
   */
  const titelKernLocker = (t) =>
    titelKern(
      (t ?? '')
        .toLowerCase()
        .replace(/\s*[-–—:]\s*(ova|ona|oad|tv|movie|film)\s*$/i, ' ')
        .replace(/[[(]\s*(ova|ona|oad|tv)\s*[\])]\s*$/i, ' ')
        .replace(/\b\d\b/g, ' '),
    )

  /**
   * **Ein eingeschobener Reihenname macht aus demselben Titel keinen anderen.**
   *
   * Daniel am 28.08.2026 an „Arpeggio of Blue Steel - Cadenza": Die einzige
   * Karte der Trefferliste heißt bei Prime „Arpeggio of Blue Steel - **Ars
   * Nova** - Cadenza" — derselbe Film, mit dem Reihennamen dazwischen. Unser
   * eigener Bestand führt ihn übrigens auch, im japanischen Titel („Aoki
   * Hagane no Arpeggio: Ars Nova - Cadenza"); nur der deutsche lässt ihn weg.
   *
   * Ein Zusatz **am Rand** fangen `ohneBeiwerk` und der `includes`-Rückfall
   * längst ab. Steht er in der **Mitte**, greift keiner von beiden: Die
   * Zeichenkette ist an dieser Stelle aufgetrennt.
   *
   * Verglichen wird deshalb wortweise. Die Wörter des Auftrags müssen alle in
   * der Karte vorkommen, **in derselben Reihenfolge** — dazwischen darf stehen,
   * was will.
   *
   * **Zwei Riegel halten das eng**, denn sonst würde „Attack on Titan" auf
   * „Attack on Titan: Final Season" passen:
   *
   * - Höchstens zwei zusätzliche Wörter. Ein Titel, dem drei Wörter fehlen, ist
   *   ein anderer Titel.
   * - Keines davon darf eine Fortsetzung ankündigen. `staffelImTitel()` erkennt
   *   nur nummerierte Staffeln; „Final Season", „The Movie" und „Chapter"
   *   tragen keine Zahl und kämen sonst durch.
   */
  /*
    **Was eine Fortsetzung ankündigt — und was nur Satzbau ist.**

    `the`, `ova`, `ona` und `oad` standen hier bis 3.83 mit drin und haben
    „Code Geass: Akito the Exiled 4 — From the Memories of Hatred — OVA"
    blockiert (Daniel, 28.08.2026). Ein Artikel kündigt keine Fortsetzung an,
    und ein Formatkürzel am Ende schneidet `titelKernLocker` ohnehin weg.

    `movie`, `film` und `special` bleiben: Sie trennen ein eigenes Werk von der
    Serie („Jujutsu Kaisen" gegen „Jujutsu Kaisen The Movie"), und genau das ist
    ein Unterschied, der zählt.
  */
  const REIHENFOLGE_SPERRE =
    /^(final|last|first|second|third|next|new|season|staffel|movie|film|part|teil|cour|chapter|kapitel|special|recap|origin|beginning|end|ending|zero|remake|reboot)$/i
  /**
   * **Gattungswörter sagen nichts über das Werk.**
   *
   * Daniel am 31.08.2026: „remove special characters from matching, just match
   * with words. instead of 'One Piece Film: Strong World' -> 'One Piece Strong
   * World'. remove generics and special characters."
   *
   * Sonderzeichen fielen schon vorher weg — der Split trennt an allem, was kein
   * Buchstabe und keine Ziffer ist. Die Gattungswörter blieben und haben den
   * Vergleich gekippt: Unser Titel führt „Film", Prime schreibt „One Piece –
   * Strong World", und schon zählte der Auftrag ein Wort mehr als die Karte.
   *
   * **Film und Serie trennt trotzdem niemand mehr über den Titel** — das macht
   * `typPasst()` über Amazons `data-card-entity-type`. Ein Datenfeld schlägt ein
   * Textmuster, hier wie überall in diesem Projekt.
   */
  /*
    **Gemessen am eigenen Bestand, nicht ausgedacht.**

    Ausgezählt wurden am 31.08.2026 alle Titelzusätze hinter dem letzten
    Doppelpunkt oder Gedankenstrich (Daniel: „check existing data for more
    examples"):

        40× the movie      18× the animation     17× der film
         7× the series      5× die serie          5× episoden

    „The Animation" ist der Fall, an dem es auffiel: Unser Titel lautet
    „Phantasy Star Online 2: The Animation", Prime schreibt „Phantasy Star
    Online 2".

    **Die Artikel gehören dazu.** Ohne sie bliebe „the" stehen, und der Auftrag
    hätte immer noch ein Wort mehr als die Karte — der Treffer fiele durch
    dieselbe Längenprüfung wie vorher. `FUELLWORT` führt sie ohnehin; hier
    fallen sie eine Stufe früher weg.
  */
  const GATTUNG = new Set([
    'film', 'movie', 'serie', 'series', 'anime', 'animation', 'staffel', 'season',
    'komplett', 'komplette', 'complete', 'gesamtausgabe', 'edition',
    'episoden', 'folgen',
    /* Artikel und Bindewörter — sie benennen nichts. */
    'the', 'der', 'die', 'das', 'des', 'dem', 'den', 'und', 'and',
  ])
  const titelWorte = (t) =>
    (t ?? '')
      .toLowerCase()
      .replace(/\b(staffel|season|vol\.?|volume|teil|part)\s*\d+\b/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !GATTUNG.has(w))
  /*
    **Nicht jedes fremde Wort unterscheidet.** „Code Geass: Akito the Exiled —
    Memories of Hatred" gegen die Prime-Karte „… Akito the Exiled 4 — From the
    Memories of Hatred — OVA" (Daniel, 28.08.2026): drei Zusatzwörter, und damit
    über der Grenze — obwohl nur eines davon etwas aussagt.

        from   ein Wort des Satzbaus
        the    Füllwort, steht im Auftrag schon einmal
        ova    Typ-Kürzel am Ende, das `titelKernLocker` längst wegschneidet

    Gezählt werden deshalb nur Wörter, die eine Sache benennen. Die Grenze von
    zwei bleibt, sie misst jetzt nur das Richtige.
  */
  const FUELLWORT = new Set([
    'the', 'and', 'for', 'from', 'with', 'der', 'die', 'das', 'des', 'dem', 'den',
    'und', 'von', 'vom', 'zum', 'zur', 'ein', 'eine', 'einen', 'einer',
  ])
  const TYP_KUERZEL = new Set([
    'ova', 'ona', 'oad', 'omu', 'uncut', 'edition',
  ])
  const wortFolgePasst = (auftrag, karte) => {
    const a = titelWorte(auftrag)
    const k = titelWorte(karte)
    if (!a.length || k.length < a.length) return false
    /* Die Auftragswörter der Reihe nach in der Karte suchen. */
    let n = 0
    const zusatz = []
    for (const wort of k) {
      if (n < a.length && wort === a[n]) n++
      else zusatz.push(wort)
    }
    if (n !== a.length) return false
    /*
      Ein Fortsetzungswort sperrt weiterhin sofort, auch als Füllwort-Nachbar —
      sonst käme „Attack on Titan" auf „Attack on Titan: Final Season" durch.
    */
    if (zusatz.some((w) => REIHENFOLGE_SPERRE.test(w))) return false
    if (zusatz.some((w) => /^\d+$/.test(w))) return false
    const benennend = zusatz.filter((w) => !FUELLWORT.has(w) && !TYP_KUERZEL.has(w))
    return benennend.length <= 2
  }

  /**
   * **Welche Staffel meint dieser Titel?**
   *
   * `titelKern()` wirft die Staffelangabe weg — richtig, wenn es darum geht,
   * denselben Stoff wiederzuerkennen, und falsch, wenn es darum geht, die
   * richtige Staffel zu treffen. Bei Prime ist jede Staffel ein eigener
   * Eintrag mit eigener Kennung: „Call of the Night" (Staffel 1, aniverse,
   * deutsch) und „Call of the Night (OmU)" (zwei Staffeln, ADN, nur
   * untertitelt) sind zwei Seiten mit zwei ASINs.
   *
   * Ohne diese Unterscheidung meldete die Erweiterung am 27.08.2026 für
   * „Call of the Night: Season 2" die dreizehn deutschen Folgen der ersten
   * Staffel — auf einer Seite, die Staffel 2 gar nicht führt (Daniel, mit
   * drei Bildern).
   *
   * Ohne Angabe gilt Staffel 1: Ein Titel ohne Nummer meint die erste.
   */
  const staffelImTitel = (t) => {
    const s = (t ?? '').toLowerCase()
    /*
      **Anbieter schreiben Staffeln auf ein halbes Dutzend Arten.**

      „Staffel 2" und „Season 2" waren der einfache Fall. Daneben stehen im
      Bestand: „Golden Kamuy 2" (nackte Zahl), „Food Wars! The Second Plate"
      (ausgeschriebenes Zahlwort mit eigenem Substantiv), „2nd Season". Alle
      drei galten als Staffel 1 — und damit meldete die Erweiterung am
      27.08.2026 die erste Staffel für einen Auftrag, der die zweite meinte
      (Daniel: „golden kamuy 2 hat für staffel 1 gemeldet, ist das richtig so?").

      Die nackte Zahl bleibt bewusst auf 2 bis 9 beschränkt: „Fate/Zero" und
      „Ranking of Kings" enden auch auf Ziffern, und eine dreistellige Zahl war
      noch nie eine Staffel.
    */
    const WORTE = { second: 2, zweite: 2, third: 3, dritte: 3, fourth: 4, vierte: 4, fifth: 5 }
    const treffer =
      /\b(?:staffel|season|teil|part|cour|plate)\s*(\d+)\b/.exec(s) ??
      /\b(\d+)(?:st|nd|rd|th)?\s*(?:staffel|season|plate)\b/.exec(s)
    if (treffer) return Number(treffer[1])
    const wort = /\b(second|zweite|third|dritte|fourth|vierte|fifth)\b/.exec(s)?.[1]
    if (wort) return WORTE[wort]
    /*
      **Die nackte Zahl steht am Ende — auch wenn ein Gattungswort folgt.**

      „Phantasy Star Online 2" gilt hier als Staffel 2 (die Zahl schließt den
      Titel ab), „Phantasy Star Online 2: The Animation" dagegen als Staffel 1
      — dort endet der Titel auf „animation". Damit galten Auftrag und Karte als
      verschiedene Staffeln, und der Treffer fiel auf „ähnlich" zurück (Daniel,
      31.08.2026).

      Gattungswörter sagen nichts über die Staffel; sie werden vorher
      abgeschnitten. Dass beide Seiten dieselbe Nummer bekommen, ist der ganze
      Zweck — welche es ist, entscheidet der Rest des Namens.
    */
    /* Im Rumpf, nicht daneben: Die Zusicherungen schneiden Funktionen einzeln aus. */
    const ohneGattung = s.replace(
      /[\s:–—-]+(?:the\s+)?(?:animation|movie|film|serie|series|anime|edition)\s*$/i,
      '',
    )
    const nackt = /\s([2-9])\s*$/.exec(ohneGattung)?.[1]
    return nackt ? Number(nackt) : 1
  }

  /**
   * Wie gut passt die Trefferliste zu dem, was wir suchen?
   *
   * Drei Ausgänge, und der mittlere ist der heikle:
   *
   * | Befund | Was er heißt |
   * |---|---|
   * | `genau` | Der Titel steht dort — die Tonspuren holt ein Klick |
   * | `aehnlich` | Etwas Verwandtes, aber nicht **dieses** Werk |
   * | `keiner` | Prime führt den Titel nicht |
   *
   * **`aehnlich` ist für den gesuchten Titel dasselbe wie `keiner`.** Eine
   * Suche nach „Cowboy Bebop" liefert bei Prime nur den Film von 2001; das
   * heißt, dass es **die Serie** dort nicht gibt. Der Film ist ein eigener
   * Eintrag in unserem Bestand und braucht seinen eigenen Verweis — er darf
   * nie das Urteil der Serie werden.
   *
   * Deshalb wird bei `aehnlich` nichts von selbst gemeldet: Der Fund gehört
   * jemandem, nur nicht dem, der gerade gesucht wurde.
   */
  function beurteileTreffer(auftrag, gefunden) {
    const kern = titelKern(auftrag.titel)
    if (!kern) return { art: 'unklar' }
    /**
     * **Der Typ trennt, was der Name nicht trennt.**
     *
     * Prime nennt an jeder Karte `data-card-entity-type`: „TV Show" oder
     * „Movie". Film und Serie tragen oft denselben Namen — „Akira", „Ghost in
     * the Shell", „Fullmetal Alchemist" gibt es als beides. Ohne den Typ
     * bekäme eine Serie das Urteil ihres Films, und dessen Tonspur ist eine
     * andere Frage.
     *
     * Erwartet wird nach der Folgenzahl aus unserem Bestand: mehr als eine
     * Folge heißt Serie, genau eine heißt Film. Kennen wir sie nicht, zählt
     * der Typ nicht mit — dann ist Schweigen besser als eine Regel aus einer
     * fehlenden Zahl.
     */
    const erwartetSerie = auftrag.folgen > 1
    const erwartetFilm = auftrag.folgen === 1
    const typPasst = (t) => {
      if (!auftrag.folgen) return true
      const istSerie = /tv|show|serie|season/i.test(t.typ)
      const istFilm = /movie|film/i.test(t.typ)
      if (!istSerie && !istFilm) return true
      return erwartetSerie ? istSerie : erwartetFilm ? istFilm : true
    }

    /*
      **Ein Doppeltitel ist derselbe Titel.**

      Wir führen „Beyond the Boundary: Kyoukai no Kanata" — englischer Titel,
      Doppelpunkt, japanischer Titel. Prime führt dieselbe Serie schlicht als
      „Beyond the Boundary". Der Vergleich auf Gleichheit fand sie nicht,
      obwohl sie in der Ergebnisliste ganz vorn stand (Daniel, 27.08.2026:
      „da ist der suchtreffer, warum wird es nicht gefunden?").

      Verglichen wird deshalb auch gegen den Teil vor dem ersten Doppelpunkt —
      aber nur, wenn der für sich trägt: mindestens zwei Wörter und zehn
      Zeichen. Sonst würde „Gundam: Iron-Blooded Orphans" jede Karte namens
      „Gundam" einsammeln, und das ist eine andere Serie.
    */
    const vorn = auftrag.titel.split(':')[0].trim()
    /*
      Ein Untertitel, der die Staffel nennt, ist kein Untertitel: „Call of the
      Night: Season 2" auf „Call of the Night" zu kürzen träfe Staffel 1.
    */
    const untertitelIstStaffel = staffelImTitel(auftrag.titel.split(':').slice(1).join(':')) > 1
    const kernVorn =
      !untertitelIstStaffel && vorn !== auftrag.titel.trim() && vorn.split(/\s+/).length >= 2 && titelKern(vorn).length >= 10
        ? titelKern(vorn)
        : null
    /*
      **Der Suchbegriff zählt mit, nicht nur unser Anzeigetitel.**

      Wir führen „Captain Tsubasa" mit 52 Folgen; die Suchadresse in unserem
      Bestand lautet aber `k=Captain Tsubasa (2018)`. Prime nennt die Serie
      genau so — und der Vergleich gegen den Anzeigetitel fand sie nicht:
      „captaintsubasa" gegen „captaintsubasa2018" (Daniel, 27.08.2026: „wieso
      sagt extension kein treffer").

      Der Begriff ist dabei die **bessere** Auskunft, nicht die schlechtere: Er
      wurde gezielt gesetzt, weil unser Eintrag die Fassung von 2018 meint und
      nicht die von 1983 — eine andere Serie mit 128 Folgen. Ein Jahr pauschal
      wegzuwerfen würde genau diese Unterscheidung zerstören.
    */
    const begriff = decodeURIComponent((/[?&]k=([^&#]*)/.exec(auftrag.suchUrl ?? '')?.[1] ?? '').replace(/\+/g, ' '))
    const kernBegriff = begriff ? titelKern(begriff) : null
    /*
      **Beiwerk vor und hinter dem Titel zählt nicht mit.**

      Prime führt „H.O.T.D. High School of the Dead" und „Highschool of the
      Dead [dt./OV]" — dieselbe Serie, einmal mit Abkürzung davor, einmal mit
      Fassungsangabe dahinter. Beide galten nur als „ähnlich" (Daniel,
      27.08.2026, mit zwei Bildern).

      Weggeschnitten wird deshalb, was erkennbar Beiwerk ist: eine Abkürzung
      aus Großbuchstaben mit Punkten am Anfang, eine Klammer- oder
      Fassungsangabe am Ende. Ein bloßes „enthält" wäre zu großzügig —
      „Naruto" steckt auch in „Naruto Shippuden", und das ist eine andere
      Serie.
    */
    const ohneBeiwerk = (t) =>
      titelKern(
        (t ?? '')
          .replace(/^\s*(?:[A-Z]\.){2,}\s*/, '')
          /* Eine Jahreszahl bleibt: Sie trennt Neuauflagen — „Captain Tsubasa (1983)". */
          .replace(/\s*[[(](?!\s*\d{4}\s*[\])])[^\])]*[\])]\s*$/, '')
          .replace(/\s*[-–]\s*(?:dt\.?|omu|ov|uncut|subbed|dubbed)[\s\S]*$/i, ''),
      )
    /*
      Die lockere Form kommt als **weitere** Schreibweise dazu, nicht als
      Ersatz: Verglichen wird weiterhin zuerst streng, und die Typ- und
      Staffelprüfung darunter gilt unverändert für jeden Treffer.
    */
    const kernLocker = titelKernLocker(auftrag.titel)
    const gleichNamig = gefunden.treffer.filter((t) => {
      const k = titelKern(t.titel)
      const roh = ohneBeiwerk(t.titel)
      const locker = titelKernLocker(t.titel)
      return (
        [k, roh, locker].some(
          (x) => x === kern || x === kernBegriff || (kernVorn !== null && x === kernVorn) || x === kernLocker,
        ) ||
        /* Ein Reihenname mitten im Titel — „Arpeggio of Blue Steel - Ars Nova - Cadenza". */
        wortFolgePasst(auftrag.titel, t.titel) ||
        (begriff ? wortFolgePasst(begriff, t.titel) : false)
      )
    })
    /*
      **Und die Staffel muss dieselbe sein.**

      Ab Staffel 2 zählt der Name allein nicht mehr: Prime führt jede Staffel
      als eigenen Eintrag, und der trägt ihre Nummer im Titel. Eine Karte ohne
      Nummer meint die erste — die ist für „Season 2" der falsche Eintrag,
      selbst wenn sie deutsche Folgen führt.

      Sie fällt damit nicht unter den Tisch, sondern auf „ähnlich": Daniel
      sieht sie samt Namen und entscheidet selbst.
    */
    const gesuchteStaffel = staffelImTitel(auftrag.titel)
    const staffelPasst = (t) => staffelImTitel(t.titel) === gesuchteStaffel
    const genau = gleichNamig.filter((t) => typPasst(t) && staffelPasst(t))
    if (genau.length) return { art: 'genau', treffer: genau }
    /*
      Gleicher Name, falscher Typ — das ist kein Treffer, sondern der
      Nachbar: der Film zur gesuchten Serie oder umgekehrt.
    */
    if (gleichNamig.length) {
      return { art: 'aehnlich', treffer: gleichNamig }
    }
    const aehnlich = gefunden.treffer.filter((t) => {
      const k = titelKern(t.titel)
      return k.length >= 4 && (k.includes(kern) || kern.includes(k))
    })
    if (aehnlich.length) return { art: 'aehnlich', treffer: aehnlich }

    /*
      Null Karten heißt nicht „null Treffer", sondern „nichts gelesen" — die
      Seite war vielleicht noch nicht fertig. Ein Befund „nichts gefunden"
      beantwortet nicht, ob überhaupt gesucht wurde.
    */
    if (!gefunden.gesehen) return { art: 'unklar' }

    /*
      Karten da, aber keine trägt den Namen: Der Titel ist nicht dabei. Das
      ist ein Befund, kein Zweifel — die Karten wurden gelesen.
    */
    return { art: 'keiner', treffer: [] }
  }

  /** Eine Zeile im Kasten, mit eigener Klasse für ihre Rolle. */
  function kastenZeile(klasse, text) {
    const z = document.createElement('div')
    z.className = klasse
    z.textContent = text
    return z
  }

  /**
   * Der Kasten — auf der Suchseite wie auf der Titelseite derselbe.
   *
   * **Der gesuchte Titel steht oben und groß**, alles andere darunter und
   * kleiner. Daniel am 27.08.2026: „titel des gesuchten anime ganz oben ganz
   * groß anzeigen, damit ich nicht so viel text lesen muss."
   *
   * Er sieht diesen Kasten 117 Mal. Was er jedes Mal braucht, ist eine einzige
   * Auskunft — welchen Titel suche ich gerade —, und die darf nicht in einem
   * Absatz stehen. Der Befund darunter ist eingefärbt statt beschrieben:
   * grün heißt gefunden, gelb heißt nichts da.
   */
  /**
   * **Im laufenden Player hat die Erweiterung nichts zu suchen.**
   *
   * Gesammelt wird auf der Übersichtsseite — dort stehen die Folgenliste und
   * die Tonspuren. Der Player weiß darüber nichts und ist der einzige Ort, an
   * dem ein eingeblendeter Kasten wirklich stört (Daniel, 27.08.2026: „im
   * prime player generell nicht, weil wir ja über die overview seite alles
   * sammeln").
   */
  function imPlayer() {
    try {
      /*
        **Nur ein sichtbarer Player zählt.** Die erste Fassung fragte auch nach
        `video[src]` — das gibt es auf jeder Übersichtsseite als Hintergrundvideo,
        und damit verschwand der Listen-Knopf dort ebenfalls (Daniel, 27.08.2026:
        „auf der overview jedes anime sollte die Liste öffenbar sein, nur wenn
        player da ist soll es verschwinden").

        Prime Video hängt seinen Player als `.webPlayerSDKContainer` ein. Der
        steht auf der Übersicht mitunter schon im DOM, aber ohne Höhe — deshalb
        entscheidet die gemessene Größe, nicht die bloße Anwesenheit.
      */
      const el = document.querySelector('.webPlayerSDKContainer, [data-testid="player-container"]')
      return Boolean(el && el.offsetHeight > 200)
    } catch {
      return false
    }
  }

  function hinweisKasten(titel, unterzeile, ...zusatz) {
    /*
      **Der Vorgänger geht, bevor der Nachfolger kommt.**

      Daniel am 30.08.2026, mit Bild: „hab es als 1-12 gemeldet, jetzt ist das
      div doppelt dort?" Der Knopf „Als Folgen 1–12 melden" ruft
      `zeigeAuftragshinweis()` erneut auf, um den Bereich einzublenden — und
      baute einen zweiten Kasten über den ersten.

      Der Takt räumte auf, dieser Aufrufer nicht. Ein Vorsatz, den jeder
      Aufrufer einhalten muss, wird irgendwann vergessen; die Stelle, die den
      Kasten **erzeugt**, weiß immer, dass es nur einen geben darf.
    */
    document.querySelector('.ak-amazon-suchhinweis')?.remove()
    const kasten = document.createElement('div')
    kasten.className = 'ak-amazon-suchhinweis'
    /*
      **Der Kasten gehört zu einer Adresse — sonst überlebt er den Wechsel.**

      Daniel am 30.08.2026: „warum ändert sich das div nicht, ich hab den
      treffer in der suche angeklickt und will ihn melden, das tool lässt mich
      nicht." Auf der Danmachi-Seite stand der Befund der **Suchseite**:
      „Nicht dieser Titel — gefunden: … Familia Myth 3 OVA".

      Beide Hinweise werden **einmal beim Seitenaufbau** gebaut, nicht im Takt.
      Prime Video wechselt aber ohne Neuladen: Das Skript läuft weiter, der
      Kasten bleibt hängen, und sein Inhalt beschreibt eine Seite, die niemand
      mehr ansieht.

      Dieselbe Lösung wie beim Mitleser (`fuerAdresse`, 25.08.2026): Jedes
      Ergebnis trägt mit, wozu es gehört, und wer es liest, verwirft Fremdes.
    */
    /*
      **Zwei Suchseiten unterscheiden sich nur in der Query.**

      Der Vergleich lief über `location.pathname` — bei jeder Prime-Suche ist
      das `/s`. Ein Klick auf den nächsten Listeneintrag führte damit auf eine
      Seite, die für den Kasten „dieselbe" war: Er blieb stehen und zeigte den
      Auftrag von vorhin (Daniel, 31.08.2026, mit Bild: Suche nach „One Piece
      Abenteuer auf Nebulandia", Kasten zeigte „Tenjo Tenge OVA").

      Auf Titelseiten trägt der Pfad die Kennung, dort fiel es nie auf.
    */
    kasten.dataset.fuerAdresse = location.pathname + location.search
    /*
      **Und er gehört zu einem Folgenstand, nicht nur zu einer Adresse.**

      Der Auftragshinweis entscheidet über die Folgenzahl, ob die Seite ein
      Werk bündelt, es teilt oder ein anderes ist. Gebaut wird er beim
      Seitenaufbau — da steht die Zahl oft noch auf null, und der Kasten wählte
      den Zweig „zeigt deutlich weniger, ist ein anderes Werk".

      Bei „Danganronpa 3" stand genau das über einer Seite mit 24 Folgen für
      einen Auftrag über 12: Prime bündelt dort Future und Despair Arc, und der
      Knopf „Als Folgen 1–12 melden" wäre der richtige gewesen — er kam nie,
      weil niemand den Kasten noch einmal ansah (Daniel, 30.08.2026).
    */
    try {
      kasten.dataset.beiFolgen = String(gesehen?.gesamt ?? 0)
    } catch {
      kasten.dataset.beiFolgen = '0'
    }
    kasten.appendChild(kastenZeile('ak-such-titel', titel))
    if (unterzeile) kasten.appendChild(kastenZeile('ak-such-unter', unterzeile))
    for (const z of zusatz) if (z) kasten.appendChild(z)
    /*
      **Der Verweis gehoert in jeden Kasten, nicht in einen.**

      Er stand seit 3.80 nur im Auftragshinweis auf der Titelseite. Genau dort
      braucht man ihn am wenigsten: Wer eine Seite offen hat, sieht den Titel.
      Gebraucht wird er im Kein-Treffer-Kasten auf der Suchseite — dort steht
      die Frage, ob der Suchbegriff ueberhaupt stimmt (Daniel, 28.08.2026:
      „wo ist der anilist link? ich muss vergleichen koennen").

      Deshalb haengt er hier und nicht an einer Aufrufstelle: Jeder Kasten
      gehoert zu einem Auftrag, und der traegt die Kennung. Ein Kasten, der
      kuenftig dazukommt, hat den Verweis damit von selbst.
    */
    /*
      **Ein wackeliger Auftrag sagt es selbst, bevor jemand sucht.**

      Der Vermerk kommt aus `vorschlaege-anbieter.ts`: Dort passte das Format
      oder das Jahr des TMDB-Treffers nicht zu unserem Eintrag. Wer das vorher
      weiß, hört nach zwei Blicken auf zu suchen statt nach zwei Minuten — und
      genau das war Daniels Anliegen am 28.08.2026 („die prüfliste ist extrem
      mühselig für mich abzuarbeiten").

      Er steht hier und nicht an einer Aufrufstelle, aus demselben Grund wie
      der Verweis darunter: Jeder Kasten gehört zu einem Auftrag.
    */
    try {
      const auftrag = suchauftrag()
      if (auftrag?.unsicher) {
        kasten.appendChild(kastenZeile('ak-such-warn', 'Wackeliger Vorschlag: ' + auftrag.unsicher))
      }
      if (auftrag?.asId) {
        /*
          **aniSearch vor AniList** (Daniel, 28.08.2026: „nimm fuer prueflist titel
          anisearch statt anilist.co"). aniSearch fuehrt deutsche Titel, deutsche
          Beschreibungen und die deutschen Anbieter — fuer die Frage „ist das
          derselbe Titel, den Prime hier zeigt" die brauchbarere Seite. Es hat
          ausserdem eine Episodenliste mit deutschen Folgentiteln, und die
          entscheidet bei Reihen, die Prime durchnummeriert.
        */
        kasten.appendChild(
          kastenVerweis('Bei aniSearch nachsehen', 'https://www.anisearch.de/anime/' + auftrag.asId + '/episodes'),
        )
      } else if (auftrag?.titel) {
        /*
          **Ohne Kennung die aniSearch-Suche, nicht AniList.**

          AniList führt romanisierte Titel ohne deutschen Bezug; bei einer Reihe
          mit vier Teilen ist von dort aus nicht zu erkennen, welcher gemeint
          ist (Daniel, 30.08.2026: „da kann ich nicht herausfinden wozu das
          gehört"). Die aniSearch-Suche führt in zwei Klicks zur Episodenliste
          mit deutschen Folgentiteln — genau dem, was den Vergleich entscheidet.

          **Zwei Dinge daran sind gemessen, nicht geraten** (30.08.2026, nachdem
          der erste Anlauf Daniel auf „Deine Suchanfrage ist ungültig" schickte):

          - `/anime/index?text=…` ist der **Filter** des Anime-Index und
            beantwortet einen Aufruf von außen mit genau dieser Fehlermeldung.
            `/search?q=…` ist die Volltextsuche und liefert Treffer.
          - Gesucht wird mit dem **Kern** des Titels. „Kizumonogatari III:
            Kaltes Blut — Teil 3" findet nichts, „Kizumonogatari" findet beide
            Filme. Der Zusatz hinter Doppelpunkt oder Gedankenstrich ist die
            deutsche Ausgabenbezeichnung; aniSearch führt sie nicht.
        */
        const suchBegriff = auftrag.titel.split(/[:—–-]/)[0].trim() || auftrag.titel
        kasten.appendChild(
          kastenVerweis(
            'Bei aniSearch suchen',
            'https://www.anisearch.de/search?q=' + encodeURIComponent(suchBegriff),
          ),
        )
      }
    } catch {
      /* Ohne Auftrag kein Verweis — der Kasten steht trotzdem. */
    }
    document.body.appendChild(kasten)
    return kasten
  }

  /**
   * **Die Adresse eines Suchtreffers ohne ihre Parameter.**
   *
   * Der Link in einer Trefferkarte trägt Amazons Verfolgungsmarken mit:
   * `?qid=…&pageTypeIdSource=ASIN&pageTypeId=…&ref_=atv_sr_fle_c_…&sr=1-1`.
   * Ein Klick darauf landet bei „Da ist etwas schief gelaufen." — dieselbe
   * Adresse ohne alles hinter dem Fragezeichen öffnet die Titelseite normal
   * (Daniel, 27.08.2026, mit Bild und Gegenprobe an „Angels of Death").
   *
   * Was genau Amazon daran stört, ist von hier nicht zu klären. Es genügt zu
   * wissen, dass die Parameter nichts tragen, was wir brauchen: Die Kennung
   * steht im Pfad.
   */
  const ohneParameter = (url) => (url ?? '').split('?')[0]

  /** Ein Knopf im Kasten — gleiche Form für alle Fälle. */
  /**
   * **Woher der Auftrag stammt, gehört in den Kasten.**
   *
   * Daniel am 28.08.2026: „pack in dieses prüf-div fenster auch den link zu
   * anilist, wo du das herhast, damit ich nachschauen kann und nicht jedes mal
   * manuell googlen muss."
   *
   * Der Kasten nennt Titel und erwartete Folgenzahl — beides stammt aus unserem
   * Bestand, und der stammt aus AniList. Wenn die Zahl nicht zur Seite passt (was
   * bei Prime der Regelfall ist, siehe „Prime schneidet Reihen anders zu"), ist
   * die erste Frage: Was steht dort eigentlich? Ein Klick beantwortet sie.
   *
   * `target="_blank"` mit `rel="noopener"`, damit die Prime-Seite stehen bleibt —
   * ein Wechsel würde den halb geladenen Zählstand wegwerfen.
   */
  function kastenVerweis(text, adresse) {
    const a = document.createElement('a')
    a.className = 'ak-such-quelle'
    a.href = adresse
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = text
    a.style.cssText = 'display:block;margin-top:4px;color:#7cc4ff;text-decoration:underline;font-size:12px'
    return a
  }

  /**
   * Die Karte zu einer Prime-Kennung auf der Trefferseite.
   *
   * Gesucht wird über den Verweis, nicht über einen gespeicherten Knoten: Amazon
   * baut die Trefferliste beim Filtern neu auf, und eine gemerkte Referenz zeigt
   * danach auf ein Element, das nicht mehr im Baum steht.
   */
  function karteZu(kennung) {
    if (!kennung) return null
    try {
      return (
        document.querySelector(`article[data-testid="card"] a[href*="${kennung}"]`)?.closest('article') ?? null
      )
    } catch {
      return null
    }
  }

  /**
   * Ein Knopf im Auftragskasten — mit der Karte, die er meint.
   *
   * Daniel am 30.08.2026 vor „One Punch Man", das die Suche achtmal ausgibt:
   * „ich hab überhaupt keine ahnung was der eine oder der andere button meint,
   * welcher der button springt zu welchem der suchtreffer? markier beim hover
   * auf die button die suchtreffer irgendwie und setz in klammern hinter die
   * label evtl die asin."
   *
   * Beides ist hier drin: Die Kennung steht im Label, und beim Überfahren
   * bekommt die Karte einen Rahmen und wird ins Bild geholt. Ohne das ist ein
   * Klick ein Sprung ins Ungewisse — zwischen einem Kauftitel und einem
   * Kanal-Abo entscheidet er, was überhaupt belegbar ist.
   */
  function kastenKnopf(beschriftung, tun, kennung = null) {
    const k = document.createElement('button')
    k.type = 'button'
    k.className = 'ak-suchknopf'
    k.textContent = kennung ? `${beschriftung} (${kennung})` : beschriftung
    k.addEventListener('click', () => tun(k))
    if (kennung) {
      k.title = `Zeigt auf ${kennung} — beim Überfahren wird die Karte markiert`
      k.addEventListener('mouseenter', () => {
        const karte = karteZu(kennung)
        if (!karte) return
        karte.classList.add('ak-treffer-zeigen')
        /* `nearest` statt `center`: Steht die Karte schon im Bild, soll nichts springen. */
        karte.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      })
      k.addEventListener('mouseleave', () => {
        for (const el of document.querySelectorAll('.ak-treffer-zeigen')) {
          el.classList.remove('ak-treffer-zeigen')
        }
      })
    }
    return k
  }

  /**
   * „Prime führt diesen Titel nicht" — die Meldung dazu.
   *
   * Gemeldet wird unter der **Suchadresse**, denn die steht in unserem
   * Bestand; die Übernahme macht daraus ein `available: false` und entfernt
   * den Verweis. Das ist derselbe Weg, den Crunchyroll seit dem 27.08.2026
   * geht, und dieselbe Begründung: Ein Verweis, der auf eine Trefferliste
   * ohne den gesuchten Titel führt, kostet einen Klick und liefert nichts.
   */
  async function nichtBeiPrimeMelden(auftrag, befund, knopf) {
    knopf.disabled = true
    knopf.textContent = 'meldet …'
    try {
      /* Der Schlüssel liegt im Sitzungs-Speicher, wie beim Melde-Knopf auch. */
      const { token } = await chrome.storage.sync.get('token')
      if (!token) throw new Error('kein Schlüssel hinterlegt')
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'primevideo',
          url: auftrag.suchUrl,
          befund: 'weg',
          titel: auftrag.titel,
          /* Woher die Auskunft stammt — Suchseite oder geöffnete Titelseite. */
          notiz:
            befund.art === 'titelseite'
              ? 'Titelseite auf Prime Video geöffnet und geprüft: Sie gehört nicht zu diesem Titel'
              : 'Suche auf Prime Video: ' +
                (befund.art === 'aehnlich'
                  ? 'kein Treffer für diesen Titel, nur Verwandtes (' +
                    befund.treffer.map((t) => t.titel).slice(0, 3).join(', ') +
                    ')'
                  : 'kein einziger Treffer'),
        }),
      })
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
      await suchAbhaken(auftrag.suchUrl)
      knopf.textContent = 'gemeldet ✓'
      uebersichtZeichnen()
    } catch (err) {
      knopf.disabled = false
      knopf.textContent = `Fehler: ${err.message} — nochmal`
    }
  }

  /**
   * Kennungen der übrigen passenden Treffer derselben Suche — siehe `weitere=`.
   *
   * **Vor dem ersten Zugriff deklariert**, nicht darunter: `let` hebt den Namen
   * hoch, aber nicht den Wert. Ein Zugriff davor wirft, statt `undefined` zu
   * liefern — derselbe Fehler wie bei `listenId`, `knopf` und `istGemeldet`.
   */
  let weitereAusgaben = []

  function zeigeSuchhinweis() {
    /*
      **Eine zweite Suche gehört noch zum selben Auftrag.**

      `offeneSuche()` vergleicht den Suchbegriff mit unseren Adressen. Wer über
      „Kürzer suchen" oder „Anders schreiben" weitersucht, steht danach auf
      einer Adresse, die dort nicht steht — und der Kasten war weg, mitsamt dem
      Auftrag (Daniel, 27.08.2026: „lädt die seite neu und dann ist das div
      nicht mehr da").

      Bei „Horimiya" fiel das nicht auf: Die Kurzform ist zufällig selbst ein
      Eintrag. Das ist der Zufall, nicht die Regel.

      Der gemerkte Auftrag gilt zehn Minuten und überlebt jeden Seitenwechsel.
      Auf einer Suchseite ist er die richtige Auskunft — dort gibt es nichts
      anderes, worauf er sich beziehen könnte.
    */
    const ausListe = offeneSuche()
    const gemerkt = !ausListe && /^\/s(\/|$)/.test(location.pathname) ? suchauftrag() : null
    const auftrag = ausListe ?? gemerkt
    if (!auftrag) return false
    /*
      **Die aniSearch-Kennung muss mitwandern.**

      Hier standen vier Felder, und `asId` war keines davon. Auf der Suchseite
      zeigte der Kasten deshalb den aniSearch-Verweis, nach dem Sprung auf die
      Titelseite — wo der Vergleich wirklich stattfindet — fiel er auf AniList
      zurück.

      Daniel am 30.08.2026: „ich will keine anilist links, die sind furchtbar,
      da kann ich nicht herausfinden wozu das gehört, ich brauche anisearch
      links zu dem arc, damit ich das vergleichen und korrekt zuordnen kann."
      Sein Beispiel war „Danganronpa 3 — Future Arc"; der Auftrag trägt
      `asId: 11046`, nur kam sie nie an.

      Übernommen wird jetzt der ganze Auftrag; `suchUrl` bleibt ausdrücklich
      stehen, weil sie aus dem Aufrufer kommt und nicht aus dem Listeneintrag.
    */
    suchauftragMerken({ ...auftrag, suchUrl: auftrag.suchUrl })
    /*
      Die Treffer stehen erst da, wenn die Seite fertig ist. Zweimal
      nachsehen genügt: einmal sofort, einmal nach anderthalb Sekunden.
    */
    const zeichnen = () => {
      document.querySelector('.ak-amazon-suchhinweis')?.remove()
      const gefunden = suchTreffer()
      const befund = beurteileTreffer(auftrag, gefunden)
      const folgen = auftrag.folgen ? `${auftrag.folgen} ${auftrag.folgen === 1 ? 'Folge' : 'Folgen'}` : ''
      /*
        **Gesucht wird oft unter einem anderen Namen, als wir führen.**

        Die Suchadresse stammt aus unserem Bestand und trägt den Begriff, unter
        dem Prime den Titel kennt — „Captain Tsubasa (2018)", während unser
        Eintrag „Captain Tsubasa" heißt. Der Kasten zeigte nur unseren Namen,
        und das sah aus wie ein Fehler: oben ein Titel, in der Suchzeile ein
        anderer (Daniel, 27.08.2026, mit Bild).

        Weichen beide ab, steht der Suchbegriff jetzt dabei.
      */
      const begriff = decodeURIComponent((/[?&]k=([^&#]*)/.exec(auftrag.suchUrl ?? '')?.[1] ?? '').replace(/\+/g, ' '))
      /*
        Weg mit dem, was Prime nicht führt: der Zusatz in Bindestrichen
        („-Dive to the Future-"), die Klammer, alles ab dem Doppelpunkt. Was
        übrig bleibt, ist der Name, unter dem die Serie dort steht.
      */
      const kurzform = begriff
        .replace(/\s-[^-]+-\s*$/, '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .split(':')[0]
        .trim()
      /*
        Die ersten beiden Wörter zusammengezogen: „High School" → „HighSchool".
        Genau dieses Paar trennt bei Prime Treffer von Nichts.
      */
      /*
        **Verglichen wird mit der Suche, auf der wir stehen — nicht mit unserer.**

        `begriff` kommt aus `auftrag.suchUrl`, also aus dem Bestand. Nach einem
        Klick auf „Anders schreiben" steht in der Adresse längst die Variante,
        der Auftrag aber unverändert — und der Knopf bot dieselbe Schreibweise
        ein zweites Mal an (Daniel, 27.08.2026: „bietet er erneut anders
        schreiben an aber mit identischem text").

        Steht die Variante schon in der Adresse, ist der Weg zurück das
        Sinnvolle: Beide Schreibweisen sind dann gesehen.
      */
      const jetzigerBegriff = decodeURIComponent((/[?&]k=([^&#]*)/.exec(location.search)?.[1] ?? '').replace(/\+/g, ' '))
      const zusammengezogen = (t) => t.replace(/^(\S+)\s+(\S+)/, (_, a, b) => a + b.charAt(0).toUpperCase() + b.slice(1))
      const variante = zusammengezogen(begriff)
      const zusammen = jetzigerBegriff === variante ? begriff : variante
      /*
        Die englische Schreibweise kommt aus dem Bestand, nicht aus einer
        Umformung — der Listengenerator legt sie als `suchbegriffEn` bei.
      */
      /* Beide aus dem Bestand, nicht aus einer Umformung des laufenden Begriffs. */
      const auftragDe = (() => {
        try {
          return suchliste[auftrag?.suchUrl]?.suchbegriff ?? null
        } catch {
          return null
        }
      })()
      const auftragEn = (() => {
        try {
          return suchliste[auftrag?.suchUrl]?.suchbegriffEn ?? null
        } catch {
          return null
        }
      })()
      const begriffZeile =
        begriff && titelKern(begriff) !== titelKern(auftrag.titel)
          ? [kastenZeile('ak-such-hinweis', `gesucht als: ${begriff}`)]
          : []

      if (befund.art === 'genau') {
        /*
          **Zwei richtige Treffer sind keine Verlegenheit, sondern zwei Wege.**

          „One Punch Man" steht bei Prime zweimal: einmal als Kauftitel, einmal
          über den Crunchyroll-Kanal — beide mit vier Staffeln, beide korrekt
          (Daniel, 30.08.2026: „2 valide treffer in suche, wie damit umgehen?").
          Bis hierher nahm der Kasten `treffer[0]`, also den, der zufällig oben
          stand.

          **Der Kauftitel ist der bessere.** Bei einem Kanal-Titel nennt Amazon
          die Sprachen des Kanals, nicht der Folge — an „Kill Blue" gemessen:
          zwölf behauptete deutsche Folgen, vier echte (CLAUDE.md, 24.08.2026).
          Die Karten tragen ihre Zugangsart als `data-card-entitlement` mit, also
          wird danach sortiert und nicht nach Reihenfolge.

          Angeboten werden trotzdem beide: Welcher Weg im Kalender stehen soll,
          entscheidet Daniel — der Kauftitel steht nur oben.
        */
        const kanalKarte = (k) => /channel|subscription/i.test(String(k.zugang ?? ''))
        const sortiert = befund.treffer.slice().sort((a, b) => Number(kanalKarte(a)) - Number(kanalKarte(b)))
        const t = sortiert[0]
        /*
          **Die zweite Ausgabe geht mit, sonst sieht sie nie jemand wieder.**

          Prime führt „My First Girlfriend Is a Gal" zweimal: als Kauftitel mit
          FSK 16 und elf Folgen und über den Crunchyroll-Kanal mit FSK 18 und
          zehn — andere Folgentitel, zwei Verlage. Meldet Daniel eine davon,
          fiel der Auftrag aus der Liste, und die andere blieb ungeprüft
          (30.08.2026: „ich sehe keinen prüfliste eintrag für die kaufbare
          option?").

          Hier steht die Trefferliste noch vollständig da. Ihre Kennungen gehen
          als `weitere=` in die Notiz — daraus legt `extension-offene-amazon.mjs`
          eigene Aufträge an. Über die Notiz, weil die Meldetabelle keine Spalte
          dafür hat und eine Migration für zwei Kennungen zu viel wäre.
        */
        try {
          weitereAusgaben = sortiert
            .slice(1, 4)
            .map((z) => /\/(?:dp|detail)\/([A-Z0-9]{10,26})/.exec(z.url ?? '')?.[1])
            .filter(Boolean)
          /*
            **Die Kennungen müssen den Sprung überleben.**

            Gemeldet wird fast immer auf der **Titelseite**, nicht auf der
            Suchseite — und dorthin führt ein Seitenwechsel. Eine Variable im
            Skript ist danach leer; gemessen am 31.08.2026: Von 78 offenen
            Meldungen trug **keine einzige** ein `weitere=`, obwohl der Weg seit
            4.0.22 eingebaut ist.

            Der Suchauftrag liegt im `sessionStorage` und überlebt den Wechsel.
          */
          if (weitereAusgaben.length) {
            suchauftragMerken({ ...auftrag, suchUrl: auftrag.suchUrl, weitere: weitereAusgaben })
          }
        } catch {
          weitereAusgaben = []
        }
        const ziel = ohneParameter(t.url)
        /*
          Die Kennung des Treffers gehört in den Auftrag. Ohne sie klebte der
          Hinweis an **jeder** Amazon-Seite, die Daniel danach öffnete — er stand
          sogar im Player einer fremden Serie und behauptete dort, die Meldung
          laufe unter „Angels of Death" (27.08.2026, mit Bild).
        */
        suchauftragMerken({ ...auftrag, suchUrl: auftrag.suchUrl, zielAsin: /\/(?:dp|detail)\/([A-Z0-9]{10,26})/.exec(ziel)?.[1] ?? null })
        hinweisKasten(
          auftrag.titel,
          folgen,
          kastenZeile('ak-such-gut', `Treffer: ${t.titel} (${t.typ})`),
          ...begriffZeile,
          /*
            **Der Name des Treffers steht bewusst dabei.** Entschieden wird über
            einen Namensvergleich, und der kann danebenliegen — dann sieht Daniel
            es hier, bevor er springt, statt auf einer fremden Titelseite zu melden.
          */
          ziel
            ? kastenKnopf(
                'Zum Anime springen',
                () => {
                  location.href = ziel
                },
                /\/(?:dp|detail)\/([A-Z0-9]{10,26})/.exec(ziel)?.[1] ?? null,
              )
            : kastenZeile('ak-such-hinweis', 'Öffnen — dort werden die Tonspuren gelesen'),
          /* Der zweite Weg, falls es einen gibt — mit seiner Zugangsart benannt. */
          ...sortiert.slice(1, 3).flatMap((z) => {
            const zZiel = ohneParameter(z.url)
            if (!zZiel) return []
            return [
              kastenKnopf(
                /*
                  **Der Titel der Karte gehört ins Label.** „Stattdessen: andere
                  Ausgabe" sagt nicht, welche — bei „One Punch Man" gibt die Suche
                  acht Karten aus, vier davon heißen fast gleich (Daniel,
                  30.08.2026). Mit Name und Kennung ist der Knopf ohne Klick zu
                  verstehen.
                */
                `Stattdessen: ${kanalKarte(z) ? 'Kanal-Abo' : 'Kauf/Abo'} · ${(z.titel ?? 'andere Ausgabe').slice(0, 40)}`,
                () => {
                  suchauftragMerken({
                    ...auftrag,
                    suchUrl: auftrag.suchUrl,
                    zielAsin: /\/(?:dp|detail)\/([A-Z0-9]{10,26})/.exec(zZiel)?.[1] ?? null,
                  })
                  location.href = zZiel
                },
                /\/(?:dp|detail)\/([A-Z0-9]{10,26})/.exec(zZiel)?.[1] ?? null,
              ),
            ]
          }),
          sortiert.length > 1
            ? kastenZeile(
                'ak-such-hinweis',
                'Beim Kanal-Titel nennt Amazon die Sprachen des Kanals, nicht der Folge — der Kauftitel ist der belastbarere.',
              )
            : null,
          /*
            **Auch ein gefundener Treffer kann der falsche sein.**

            Daniel am 31.08.2026 an „Ronja Räubertochter": Der Namensvergleich
            fand eine Karte, und sie heißt tatsächlich so — nur ist es Viaplays
            **Realverfilmung**, nicht der Anime von 1984. Der Kasten bot „Zum
            Anime springen" an und sonst nichts; um „nicht bei Prime" zu melden,
            hätte der Treffer erst verschwinden müssen.

            Der Knopf steht deshalb auch hier, hinter den Sprungzielen: Wer
            hinsieht und merkt, dass es der falsche Titel ist, kann es sofort
            sagen. Er ist derselbe wie im Kein-Treffer-Kasten und meldet unter
            der Suchadresse.
          */
          istGemeldet(auftrag.suchUrl)
            ? kastenZeile('ak-such-gut', 'gemeldet ✓')
            : kastenKnopf('Nicht bei Prime — melden', (k) => nichtBeiPrimeMelden(auftrag, befund, k)),
        )
        return
      }

      if (befund.art === 'unklar') {
        hinweisKasten(auftrag.titel, folgen, kastenZeile('ak-such-hinweis', 'Ergebnisse noch nicht gelesen …'))
        return
      }

      /*
        **Nur Verwandtes ist für diesen Titel dasselbe wie nichts.** Der Film
        zur Serie ist ein eigener Eintrag in unserem Bestand und bekommt seinen
        eigenen Verweis; er darf nie das Urteil der Serie werden.
      */
      const nurAehnlich = befund.art === 'aehnlich'
      /*
        **Gleicher Name, anderer Typ — das kann eine Sammelfassung sein.**

        Die Typregel trennt den Film zur Serie von der Serie („Akira", „Ghost
        in the Shell"), und das ist richtig: zwei Werke, zwei Verweise.

        Sie trennt aber auch, was zusammengehört. AniList führt „Halo Legends"
        als ONA mit neun Teilen; Prime zeigt dieselben Kurzfilme am Stück, als
        Film von 1:57 h — neun mal dreizehn Minuten (Daniel, 27.08.2026: „Halo:
        Legends ist ein film, wieso suchst du 9 folgen?"). Anthologien liegen
        bei Anbietern regelmäßig so.

        Von hier aus ist beides nicht zu unterscheiden: Die Karte nennt keine
        Laufzeit. Also entscheidet Daniel — der Knopf steht nur da, wenn der
        Name **genau** passt und allein der Typ widerspricht.
      */
      /*
        **Die Reihenseite führt unsere Staffel, nur unter dem Grundtitel.**

        Wir führen „Free! Dive to the Future" (Staffel 3), Prime führt „Free!"
        mit drei Staffeln; dasselbe bei „Food Wars! The Second Plate" gegen
        „Food Wars!" und „Golden Kamuy 2" gegen „Golden Kamuy" (Daniel,
        27.08.2026, drei Bilder). Der Kasten sagte jedes Mal „Anderes Werk".

        Erkennbar ist das am Namen: Der Kartentitel ist der Anfang unseres
        Titels, und die Karte ist eine Serie. Der Sprung führt dann auf die
        Reihenseite — dort wählt Daniel die Staffel, und die Sperre aus 3.59
        passt auf, dass er die richtige erwischt.
      */
      const reihenTreffer = befund.treffer.find(
        (t) =>
          /tv|show|serie|season/i.test(t.typ) &&
          titelKern(t.titel).length >= 4 &&
          titelKern(auftrag.titel).startsWith(titelKern(t.titel)) &&
          titelKern(t.titel) !== titelKern(auftrag.titel),
      )
      const nurTypStreitig =
        nurAehnlich &&
        befund.treffer.length === 1 &&
        titelKern(befund.treffer[0].titel) === titelKern(auftrag.titel) &&
        /movie|film/i.test(befund.treffer[0].typ)
      hinweisKasten(
        auftrag.titel,
        folgen,
        ...begriffZeile,
        nurAehnlich
          ? kastenZeile('ak-such-warn', `Nicht dieser Titel — gefunden: ${befund.treffer.map((t) => t.titel).slice(0, 2).join(', ')}`)
          : kastenZeile('ak-such-warn', 'Kein Treffer bei Prime'),
        kastenZeile(
          'ak-such-hinweis',
          /*
            **„Anderes Werk" stimmt nicht, wenn die Reihe danebensteht.**

            Daniel am 31.08.2026 an „Two Car: Racing Sidecar": Die Karte heißt
            bei Prime schlicht „Two Car" — derselbe Anime, nur ohne Untertitel.
            Der Wortvergleich verlangt aber **alle** Auftragswörter in der
            Karte, und „racing sidecar" fehlt dort; ein Präfix-Treffer wäre zu
            riskant, weil er „Sword Art Online" auf „… Alicization" treffen
            ließe.

            Der Kasten bietet den richtigen Weg trotzdem an — „Zur Reihe
            springen" —, sagte darüber aber „Anderes Werk". Zwei Zeilen, die
            einander widersprechen. Steht ein Reihen-Treffer bereit, sagt die
            Zeile jetzt, was Sache ist.
          */
          nurAehnlich
            ? reihenTreffer
              ? 'Prime führt nur den Reihennamen — der Sprung unten führt hin'
              : 'Anderes Werk — gehört zu einem eigenen Eintrag'
            : gefunden.echte
              ? `${gefunden.echte} Treffer gelesen, keiner passt`
              : `${gefunden.gesehen} Karten gelesen, alle Empfehlungen`,
        ),
        /*
          **Ein Titel mit Zusatz findet oft nichts, der Haupttitel schon.**

          `Free! -Dive to the Future-` liefert bei Prime null Treffer, `Free!`
          findet die Serie auf Anhieb; dasselbe bei `Doukyuusei -Classmates-`
          gegen `Doukyuusei` (Daniel, 27.08.2026, beide mit Bild). Die Zusätze
          stammen aus unserem Bestand — Prime führt sie nicht.

          Angeboten wird die Kurzform nur, wenn sie sich vom Begriff
          unterscheidet und noch etwas übrig bleibt. Gesucht wird sie nicht von
          selbst: Ein zweiter Seitenaufruf ohne Not ist keiner.
        */
        /*
          **Amazon findet je nach Schreibweise etwas anderes.**

          „High School of the Dead" liefert nichts, „HighSchool of the Dead"
          findet die Serie auf Platz eins (Daniel, 27.08.2026, mit beiden
          Bildern). Welche Schreibweise trifft, ist von außen nicht zu wissen —
          also wird die andere angeboten, statt sie zu erraten.
        */
        /*
          **Die englische Schreibweise als zweiter Versuch.**

          Bis 4.1.0 stand hier „Anders schreiben" mit einer aus dem Begriff
          zusammengezogenen Variante („SailorMoon" statt „Sailor Moon") — ein
          Rateversuch. Daniel am 31.08.2026: „optional soll ein button angezeigt
          werden der die englische schreibweise hat (ersetzt ‚anders
          schreiben')."

          Der englische Titel steht im Bestand und wird vom Listengenerator als
          `suchbegriffEn` beigelegt, ebenfalls ohne Gattungswörter. Er ist die
          bessere Zweitsuche: Prime führt manche Titel nur englisch.

          Die zusammengezogene Variante bleibt als dritter Weg — sie hat bei
          „Horimiya" wirklich getragen —, steht aber hinter dem Englischen.
        */
        /*
          **Der deutsche Titel gehört an die erste Stelle.**

          Daniel am 31.08.2026 vor „Tenjo Tenge OVA": Die Suche lief unter
          „Tenjho Tenge: The Ultimate Fight", und der Kasten bot „Englisch
          suchen", „Anders schreiben" und „Kürzer suchen" an — **keiner der drei
          trug den deutschen Titel**, obwohl er im Auftrag steht.

          Die Vorschläge wurden alle aus dem **laufenden** Suchbegriff gebaut,
          nicht aus dem Bestand. Der deutsche Titel ist aber der, unter dem Prime
          einen Titel führt, wenn er ihn führt — er steht deshalb zuerst.
        */
        ...(auftragDe && auftragDe !== jetzigerBegriff
          ? [
              kastenKnopf(`Deutsch suchen: ${auftragDe}`, () => {
                location.href = `https://www.amazon.de/s?k=${encodeURIComponent(auftragDe)}&i=instant-video`
              }),
            ]
          : []),
        ...(auftragEn && auftragEn !== jetzigerBegriff
          ? [
              kastenKnopf(`Englisch suchen: ${auftragEn}`, () => {
                location.href = `https://www.amazon.de/s?k=${encodeURIComponent(auftragEn)}&i=instant-video`
              }),
            ]
          : []),
        /*
          **„Anders schreiben" ist raus** (Daniel, 31.08.2026, mit Bild: „dieses
          anders schreiben zusammengeschriebene button entfernen").

          Der Knopf bot den Begriff mit zusammengezogenen ersten zwei Wörtern an
          — „DreiKleine Geister" statt „Drei kleine Geister". Bei „Horimiya" hat
          das einmal getragen, sonst schlägt es Schreibweisen vor, die es nicht
          gibt. Deutsch und Englisch stehen darüber, „Kürzer suchen" darunter;
          beide kommen aus dem Bestand statt aus einer Regel.
        */
        ...(kurzform && kurzform !== jetzigerBegriff ? [kastenKnopf(`Kürzer suchen: ${kurzform}`, () => {
          location.href = `https://www.amazon.de/s?k=${encodeURIComponent(kurzform)}&i=instant-video`
        })] : []),
        ...(reihenTreffer && ohneParameter(reihenTreffer.url)
          ? [
              kastenKnopf(`Zur Reihe springen: ${reihenTreffer.titel}`, () => {
                location.href = ohneParameter(reihenTreffer.url)
              }),
            ]
          : []),
        ...(nurTypStreitig
          ? [
              kastenKnopf(`Als Sammelfassung öffnen: ${befund.treffer[0].titel}`, () => {
                const ziel = ohneParameter(befund.treffer[0].url)
                if (ziel) location.href = ziel
              }),
            ]
          : []),
        /*
          **Ist die Adresse schon gemeldet, gibt es nichts mehr zu melden.**

          Daniel am 28.08.2026: „gemeldet nicht bei prime -> eintrag
          verschwindet aus liste korrekt, aber button nicht bei prime melden
          wird wieder klickbar." Der Knopf wird nach der Meldung gesperrt — nur
          baut der Takt den Kasten kurz darauf neu auf, und der neue Knopf
          kennt die Sperre nicht. Ein zweiter Klick haette dieselbe Meldung
          ein zweites Mal geschickt.

          Gefragt wird deshalb der Briefkasten, nicht der alte Knopf: Liegt die
          Suchadresse dort, steht an seiner Stelle die Bestaetigung.
        */
        istGemeldet(auftrag.suchUrl)
          ? kastenZeile('ak-such-gut', 'gemeldet ✓')
          : kastenKnopf('Nicht bei Prime — melden', (k) => nichtBeiPrimeMelden(auftrag, befund, k)),
      )
    }

    zeichnen()
    setTimeout(zeichnen, 1500)
    return true
  }

  /**
   * **Auf der Titelseite muss stehen, unter welchem Titel gemeldet wird.**
   *
   * Der Suchauftrag lässt eine fremde Adresse als unseren Titel melden — das
   * ist der ganze Zweck. Genau darin liegt aber auch die Gefahr: Eine Suche
   * liefert nicht immer das gesuchte Werk. Daniel am 27.08.2026 an „Cowboy
   * Bebop": Prime führt die Serie nicht, nur den Film. Wer dort meldet,
   * meldet die Tonspur des Films als die der Serie.
   *
   * Deshalb steht auf der Titelseite dasselbe Kästchen wie auf der Suchseite,
   * mit der erwarteten Folgenzahl. Sie ist das Merkmal, an dem sich beides
   * unterscheidet — 26 gegen 1. Entschieden wird von Hand; die Erweiterung
   * kann diese Frage nicht beantworten, aber sie kann sie stellen.
   */
  /**
   * **Der Ausschnitt, für den die nächste Meldung gilt.**
   *
   * Prime bündelt mehrere Arcs zu einem Eintrag mit durchlaufender
   * Nummerierung: „Captain Tsubasa (2018)" ist eine Liste von 91 Folgen, und
   * unser Eintrag „Staffel 2 — Die Junioren" sind davon die Nummern 53 bis
   * 91. Ohne diese Angabe meldete ein Blick auf die Seite 91 Folgen für eine
   * Staffel, die 39 hat — und der deutsche Ton der ersten 52 landete auf dem
   * falschen Eintrag (Daniel, 27.08.2026, mit IMDb-Gegenprobe an den
   * Folgentiteln 89 bis 91).
   *
   * Gesetzt wird er nur, wenn Daniel ihn bestätigt: Die Vermutung stammt aus
   * einem Zahlenvergleich, und die Reihenfolge der Arcs ist eine Annahme.
   */
  let teilBereich = null

  function zeigeAuftragshinweis() {
    /*
      **Nach `listenId`, nicht davor.** Diese Funktion braucht den fertigen
      Eintrag; ein Aufruf weiter oben läse `listenId` vor seinem `let` und
      würde werfen statt `undefined` zu liefern — derselbe Fehler, der am
      25.08.2026 den Dialog auf jeder Seite ohne Kennung tötete.
    */
    if (!eintrag?.ausSuche) return false
    const auftrag = suchauftrag()
    if (!auftrag) return false
    /*
      **Nur auf der Seite, zu der der Auftrag gehört.** Ein Auftrag gilt zehn
      Minuten; ohne diese Prüfung erschien der Hinweis in dieser Zeit überall,
      auch im Player einer ganz anderen Serie.
    */
    /*
      **Eine fremde Kennung blendet den Kasten nicht mehr aus — sie warnt.**

      Bis 3.84 verschwand der Hinweis, sobald die Seite eine andere Kennung trug
      als die Karte, auf die geklickt wurde. Gedacht war das gegen den Fall, dass
      der Auftrag zehn Minuten lang überall aufpoppt.

      Am 28.08.2026 hat sich die Kehrseite gezeigt: Daniel klickte in der Suche
      auf ein **zweites** Ergebnis, weil das erste der falsche Titel war — und
      genau dort war der Kasten weg. Der Melde-Knopf blieb. Damit war die einzige
      Stelle verschwunden, die die Zuordnung prüft, während die Stelle blieb, die
      meldet. Das ist die falsche Richtung herum.

      Der Kasten bleibt jetzt und sagt, dass diese Seite nicht die angeklickte
      ist. Der Player bleibt ausgenommen — dort gehört kein Hinweis hin.
    */
    const andereSeite = Boolean(auftrag.zielAsin && auftrag.zielAsin !== asin())
    /*
      **Eine andere Ausgabe ist etwas anderes als ein fremdes Werk.**

      Der Absatz darüber hält den Kasten bewusst offen, wenn die Kennung
      abweicht — Daniel klickt in derselben Suche auf ein zweites Ergebnis, und
      dort wird der Hinweis gebraucht.

      Am 30.08.2026 zeigte sich die andere Seite davon: Auf einer
      Pokémon-Titelseite stand der Kasten für „One Piece Film: Strong World".
      Der Auftrag gilt zehn Minuten, und Daniel war längst weitergezogen.

      Die Trennlinie ist der **Name**. Trägt der Seitentitel den Auftragstitel
      (oder umgekehrt), ist es dieselbe Sache in einer anderen Ausgabe — dann
      warnt der Kasten. Haben beide nichts gemeinsam, ist es ein fremdes Werk,
      und der Auftrag hat hier nichts zu suchen.
    */
    if (andereSeite) {
      try {
        const a = titelKern(auftrag.titel ?? '')
        const b = titelKern(seitenTitel() ?? '')
        if (a && b && !a.includes(b) && !b.includes(a)) return false
      } catch {
        /* Ohne Titel bleibt es beim bisherigen Verhalten: warnen statt ausblenden. */
      }
    }
    if (imPlayer()) return false
    /*
      **Deutlich mehr Folgen als erwartet heißt: Die Seite bündelt.**

      Vorgeschlagen werden die **letzten** Folgen der Liste, weil Arcs
      chronologisch angehängt werden — bei Captain Tsubasa liegen die 39
      Junioren-Folgen hinter den 52 der ersten Staffel. Bestätigt wird die
      Annahme von Daniel, nicht von der Zahl allein.
    */
    /*
      **Die Gesamtzahl der Seite zählt, nicht die schon geladene.**

      Prime lädt in Abschnitten zu 24 Folgen. Verglichen mit den geladenen kam
      das Angebot deshalb nie: 24 ist nicht mehr als die 39 erwarteten, obwohl
      die Seite oben „91 Folgen" schreibt (Daniel, 27.08.2026: „da steht immer
      noch 91").

      `gesehen.gesamt` ist genau diese Zahl. Fehlt sie, bleibt die geladene als
      Rückfall — dann ist die Seite noch nicht weit genug, und ein Angebot wäre
      ohnehin geraten.
    */
    let hier = 0
    try {
      hier = gesehen?.gesamt || geladeneFolgen()
    } catch {
      hier = 0
    }
    /*
      **Welcher Teil gemeint ist, weiß die Seite nicht — also werden beide angeboten.**

      Bis 3.77 stand hier nur das hintere Fenster, begründet damit, dass Arcs
      chronologisch angehängt werden. Das galt für den Auftrag, an dem es gebaut
      wurde: „Captain Tsubasa — Junior Youth Arc" mit 39 Folgen liegt bei Prime
      wirklich hinter den 52 der ersten Staffel.

      Für den Auftrag „Captain Tsubasa (2018)" mit 52 Folgen ist genau dieselbe
      Seite umgekehrt zu lesen — gemeint sind die **ersten** 52 (Daniel,
      28.08.2026). Dieselbe Zahl, dieselbe Seite, zwei richtige Antworten; welche
      gilt, entscheidet der Auftrag, und der steht nicht auf der Seite.

      Beide Fenster werden berechnet und stehen im Diagnosebericht — als
      Knöpfe gab es sie bis 4.0.16, seitdem ordnet der Bau über die Folgentitel
      zu. Geraten wird weiterhin nichts.
    */
    const buendel =
      auftrag.folgen && hier > auftrag.folgen
        ? [
            { von: 1, bis: auftrag.folgen },
            { von: hier - auftrag.folgen + 1, bis: hier },
          ]
        : null
    /*
      **Die offene Staffel muss die gesuchte sein.**

      Der Sprung landet auf der Serienseite, und die zeigt Staffel 1. Wer dort
      meldet, meldet die erste Staffel für einen Auftrag, der die zweite meint —
      genau so geschehen bei „Golden Kamuy 2" (Daniel, 27.08.2026, mit Bild).

      Der Knopf verschwindet dann, statt eine falsche Meldung anzubieten; die
      Zeile darüber sagt, was zu tun ist. Sobald Daniel die richtige Staffel
      wählt, ist er wieder da — der Takt zeichnet ohnehin neu.
    */
    const gesuchteStaffel = staffelImTitel(auftrag.titel)
    let offeneStaffel = null
    try {
      offeneStaffel = staffelNummer()
    } catch {
      offeneStaffel = null
    }
    /*
      Die Prüfung gilt in beide Richtungen. „Goblin Slayer" ohne Zusatz ist bei
      uns Staffel 1 mit 12 Folgen; der Sprung landete auf Staffel 2, die
      ebenfalls 12 Folgen hat, und der Knopf bot an, sie zu melden (Daniel,
      27.08.2026). Eine Fassung, die nur „ab Staffel 2" prüft, hätte das
      durchgelassen.
    */
    /*
      **Eine fehlende Staffelangabe ist keine Eins.**

      `staffelImTitel()` gibt 1 zurück, wenn im Titel keine Nummer steht — als
      **Standardwert**, nicht als Feststellung. Die Warnung behandelte ihn wie
      eine: Bei „Tokyo Ghoul:re" (das ist Staffel 3, trägt die Zahl aber nirgends)
      stand auf der Staffel-3-Seite „Hier steht Staffel 3 — gesucht ist Staffel 1",
      obwohl alle Staffeln längst gemeldet waren (Daniel, 31.08.2026).

      Gewarnt wird deshalb nur, wenn der Auftragstitel eine Staffel wirklich
      **nennt**. Der Fall, für den die Warnung gebaut wurde, bleibt gedeckt:
      „Goblin Slayer" gegen Staffel 2 fiel darunter, weil dort die Seite die
      Nummer trägt — und „Call of the Night: Season 2" nennt sie im Auftrag.
    */
    /* Zusammengesetzt statt als Literal: Ein Regex mit Escapes überlebt keinen Patch. */
    const NENNT_STAFFEL = new RegExp(
      [
        '\\b(?:staffel|season|teil|part|cour|plate)\\s*\\d+\\b',
        '\\b\\d+(?:st|nd|rd|th)?\\s*(?:staffel|season)\\b',
        '\\b(?:second|zweite|third|dritte|fourth|vierte|fifth)\\b',
        '\\s[2-9]\\s*$',
      ].join('|'),
      'i',
    )
    const auftragNenntStaffel = NENNT_STAFFEL.test(auftrag.titel ?? '')
    const falscheStaffel =
      auftragNenntStaffel && Number.isFinite(offeneStaffel) && offeneStaffel !== gesuchteStaffel
    /*
      **Der Knopf entsteht rund 950 Zeilen weiter unten — vorher wirft jeder
      Zugriff.**

      `const knopf = document.createElement('button')` steht im selben Scope, und
      `const` hebt den Namen hoch, aber nicht den Wert. `zeigeAuftragshinweis()`
      läuft beim Seitenaufbau, also regelmäßig davor:

          Uncaught (in promise) ReferenceError:
          Cannot access 'knopf' before initialization
          amazon.js:2398 (zeigeAuftragshinweis)

      Daniel hat es am 28.08.2026 in der Fehlerliste der Erweiterung gefunden —
      zusammen mit der Meldung, die Erweiterung friere den Rechner ein. Beides
      gehört zusammen: Der Fehler entsteht in einem `await`-Zweig, wird als
      abgelehnte Zusage geschluckt und wiederholt sich bei jedem Takt. Chrome
      hält zu jeder davon einen Stapelauszug fest.

      **Das ist derselbe Fehler wie bei `listenId` am 25.08.2026**, und dieselbe
      Lehre gilt: Ein `let` oder `const` weiter unten liefert kein `undefined`,
      es wirft. Ein `typeof` hilft hier nicht — auch das wirft in der toten Zone.
    */
    if (falscheStaffel) {
      try {
        knopf.style.display = 'none'
      } catch {
        /* Der Knopf existiert noch nicht; er wird beim Aufbau ohnehin gezeichnet. */
      }
    }
    const teilZeilen = []
    if (falscheStaffel) {
      teilZeilen.push(
        kastenZeile('ak-such-warn', `Hier steht Staffel ${offeneStaffel} — gesucht ist Staffel ${gesuchteStaffel}`),
        kastenZeile('ak-such-hinweis', 'Oben die richtige Staffel wählen, dann melden'),
      )
    }
    if (teilBereich) {
      teilZeilen.push(kastenZeile('ak-such-gut', `Meldung gilt für Folgen ${teilBereich.von}–${teilBereich.bis}`))
    } else if (buendel) {
      /*
        **Zuordnen ist Sache des Baus, nicht Daniels.**

        Hier standen bis 4.0.16 Knöpfe „Als Folgen 1–12 melden" — Daniel sollte
        die Folgentitel vergleichen und den Bereich wählen. Sein Einwand vom
        30.08.2026 trifft: „wozu muss ich 1-12 überhaupt melden wenn du die 24
        bereits gemeldet und im katalog hast, du hättest die verlinkung selbst
        machen und den eintrag aus der prüfliste nehmen können."

        Er hat recht, und es steht so schon in CLAUDE.md: Seit 3.77 trägt jede
        Meldung ihre Folgen einzeln mit — Nummer, Titel, Datum, Laufzeit —, und
        `pipeline/fetch-rohfolgen.ts` legt sie über TMDBs Folgentitel auf unsere
        Zählung. „Sammeln und zuordnen sind zwei Arbeiten, und nur die erste
        passiert im Browser."

        Die Knöpfe waren außerdem eine Sackgasse: Sie setzten nur den Bereich
        und meldeten nichts; der Melde-Knopf daneben stand auf „✓ alles
        gemeldet" und war gesperrt.

        Was bleibt, ist die Auskunft — sie erklärt, warum hier mehr Folgen
        stehen als erwartet.
      */
      teilZeilen.push(
        kastenZeile('ak-such-hinweis', `${hier} Folgen hier, ${auftrag.folgen} erwartet — Prime bündelt mehrere Teile`),
        kastenZeile('ak-such-gut', 'Alles melden genügt; welche Folgen zu diesem Titel gehören, entscheidet der Bau über die Folgentitel'),
      )
    } else if (auftrag.folgen && hier && hier < auftrag.folgen) {
      /*
        **Weniger Folgen heißt: Prime teilt, wo wir zusammenfassen.**

        „Chibi Maruko-chan" führt Prime als Staffel 1 mit 52 Folgen, unser Bestand
        die Reihe mit 142 (Daniel, 28.08.2026, mit Bild). Gemeldet wird trotzdem —
        was hier steht, ist wahr, es ist nur ein Teil. Welcher, entscheidet der Bau
        über die Folgentitel.
      */
      teilZeilen.push(
        kastenZeile('ak-such-hinweis', `${hier} Folgen hier, ${auftrag.folgen} erwartet — die Reihe ist aufgeteilt, melden ist richtig`),
      )
    }
    /*
      **Gleicher Name, anderes Jahrzehnt — dann ist es ein anderes Werk.**

      „Elysium" steht bei uns als koreanischer Mecha-Film von 2003 (AniList
      2941). Die Prime-Suche führt auf den Hollywood-Film mit Matt Damon von
      2013, und der Kasten bot an, den zu melden (Daniel, 28.08.2026: „warum
      elysium prüfen? das ist kein anime?"). Titel, Typ und Folgenzahl stimmen
      dort alle überein — nur das Jahr nicht.

      Ein Jahr allein widerlegt noch nichts: Zwischen japanischer
      Erstausstrahlung und deutscher Veröffentlichung liegen regelmäßig ein, zwei
      Jahre, und Prime nennt oft das Datum der eigenen Fassung. Der zweite
      Elysium-Treffer (2005 bei Prime, 2003 bei uns) ist genau so ein Fall und
      muss durchgehen. Ab **fünf** Jahren Abstand ist es keine Fassung mehr,
      sondern ein anderer Film.

      Gemeldet wird trotzdem nicht verhindert — Daniel sieht die Seite, wir
      nicht. Der Kasten sagt beide Jahreszahlen, und der AniList-Verweis
      daneben klärt den Rest.
    */
    const jahrZeilen = []
    if (Number.isFinite(auftrag.jahr)) {
      /*
        Das Jahr steht schon da: Der Mitleser liest `releaseYear` aus dem
        Hydration-Block und schickt es als `seite.jahr` mit. Kein zweiter Parse,
        keine neue Messung — genau die Sorte Arbeit, die heute schon einmal einen
        Rechner lahmgelegt hat.
      */
      /*
        In try, nicht mit `?.`: Ist der Name im Geltungsbereich gar nicht
        angelegt, wirft auch die optionale Kette — dieselbe tote Zone, die heute
        schon `knopf` betroffen hat.
      */
      let seitenJahr = null
      try {
        seitenJahr = Number.isFinite(gesehen?.seite?.jahr) ? gesehen.seite.jahr : null
      } catch {
        seitenJahr = null
      }
      if (Number.isFinite(seitenJahr) && Math.abs(seitenJahr - auftrag.jahr) >= 5) {
        jahrZeilen.push(
          kastenZeile(
            'ak-such-warn',
            `Diese Seite ist von ${seitenJahr}, unser Eintrag von ${auftrag.jahr} — vermutlich ein anderes Werk`,
          ),
        )
      }
    }

    /*
      **Nach einem Staffelwechsel schweigt der Kasten über die Seite.**

      Daniel am 30.08.2026 an „Pokémon — Sonne & Mond": Er wechselte im
      Auswahlfeld auf „Ultra-Legenden" (Adresse `s2204`, Seite zeigt 2020, 14
      Folgen) — im Kasten stand weiter „Diese Seite ist von 1999" und „Hier
      steht Staffel 201".

      Der Grund steht seit dem 24.08.2026 in CLAUDE.md: **Amazon tauscht beim
      Wechsel über das Auswahlfeld den Quelltext nicht aus.** Jahr und
      Staffelnummer stammen von dort und gehören danach zur alten Staffel.

      Eine falsche Auskunft ist schlechter als keine — die beiden Zeilen fallen
      weg, bis die Seite frisch geladen ist. Was der Kasten sonst sagt (Titel,
      erwartete Folgenzahl, Zugangsart), hängt am Auftrag und bleibt richtig.
    */
    const seitenAngabenGelten = !quelltextVeraltet()

    hinweisKasten(
      auftrag.titel,
      auftrag.folgen ? `${auftrag.folgen} ${auftrag.folgen === 1 ? 'Folge' : 'Folgen'} erwartet` : '',
      kastenZeile(andereSeite ? 'ak-such-warn' : 'ak-such-gut', 'Meldung läuft unter diesem Titel'),
      ...(andereSeite
        ? [kastenZeile('ak-such-warn', 'Andere Seite als der Treffer aus der Suche — vor dem Melden prüfen')]
        : []),
      ...(seitenAngabenGelten
        ? [...jahrZeilen, ...teilZeilen]
        : [kastenZeile('ak-such-hinweis', 'Staffel gewechselt — für Jahr und Staffelnummer die Seite neu laden')]),
      ...(seitenAngabenGelten
        ? [kastenZeile('ak-such-hinweis', 'Zeigt die Seite deutlich weniger, ist es ein anderes Werk')]
        : []),
      /*
        **„Nicht bei Prime" gehört auch auf die Titelseite.**

        Auf der Suchseite steht der Knopf seit dem 30.08.2026 — dort sieht man,
        dass kein Treffer passt. Auf der Titelseite fehlte er, und genau dort
        merkt man es oft erst: „Pinocchio" verlangt 52 Folgen, die geöffnete
        Seite führt 18 (Daniel, 31.08.2026, mit Bild).

        Kurz stand daneben ein Schalter „ohne Zuordnung", der die Meldung von
        ihrem Auftrag löste. Er ist wieder weg — Daniel: „warum ohne zuordnung
        und nicht bei prime beides?? eins von beidem reicht. besser nicht bei
        prime, weil das funktioniert."

        Der Knopf ist derselbe wie im Treffer-Kasten und meldet unter der
        Suchadresse; die Notiz nennt, dass die geöffnete Titelseite nicht passt.
      */
      ...(istGemeldet(auftrag.suchUrl)
        ? []
        : [
            kastenKnopf('Nicht bei Prime — melden', (k) =>
              nichtBeiPrimeMelden(auftrag, { art: 'titelseite' }, k),
            ),
          ]),
    )
    return true
  }
  /*
    **Sofort, nicht am Ende des Aufbaus.** Eine Suchseite trägt keine Kennung,
    und der Ablauf weiter unten setzt eine voraus — dort angehängt, wurde der
    Hinweis nie erreicht (gemessen am 27.08.2026, der Übersichts-Knopf kam an,
    der Kasten nicht). Er hängt von nichts ab außer der Adresse.
  */
  /*
    **Eine Suchseite bleibt eine Suchseite, auch ohne unseren Auftrag.**

    `zeigeSuchhinweis()` sagt nur, ob eine Suche **aus unserer Liste** läuft.
    Sucht Daniel selbst — Amazons eigenes Feld schickt an `/s?ref=nb_sb_noss…`
    mit `field-keywords` statt `k` —, war das falsch, und der Melde-Knopf stand
    wieder auf einer Trefferliste („✕ keine Folgen für diese Staffel",
    27.08.2026, mit Bild).

    Der Pfad entscheidet, nicht die Parameter: `/s` ist Amazons Suche.
  */
  const aufSuchseite = zeigeSuchhinweis() || /^\/s(\/|$)/.test(location.pathname)

  /**
   * **Dieselbe Frage, aber jetzt statt beim Aufbau.**
   *
   * `aufSuchseite` oben entsteht einmal und bleibt es. Prime Video wechselt
   * ohne Neuladen: Wer aus der Trefferliste auf einen Titel klickt, steht auf
   * einer Seite, auf der gemeldet werden kann — mit einem Skript, das die Seite
   * für eine Trefferliste hält und den Melde-Knopf ausblendet.
   *
   * Daniel am 30.08.2026: „ich hab den treffer in der suche angeklickt und will
   * ihn melden, das tool lässt mich nicht."
   *
   * Der Pfad allein entscheidet, und zwar zur Zeichenzeit. Der gemerkte Auftrag
   * gehört nicht in diese Frage: Er gilt zehn Minuten und über Seiten hinweg —
   * genau deshalb darf er keine Titelseite stumm schalten.
   */
  const jetztAufSuchseite = () => /^\/s(\/|$)/.test(location.pathname)


  // Veränderlich: Das Auswahlfeld wechselt die Staffel ohne Seitenneuladen,
  // und damit die Kennung — siehe `beiStaffelwechsel()`.
  let id = asin()

  // --- Die Übersicht: was noch zu prüfen ist --------------------------------

  /**
   * Der Weg in die Liste, ohne eine Datei zu suchen.
   *
   * Daniels Frage vom 23.08.2026: „also du hast eine liste für prime
   * vorbereitet die ich damit durchgehen soll?" — Die Liste gab es, aber nur
   * in `extension/offene-amazon.js`, einer Datei, die niemand von Hand liest.
   * Für Netflix steht sie seit dem 22.08. als aufklappbare Übersicht in der
   * Erweiterung; hier fehlte sie.
   *
   * Absichtlich **vor** dem Ausstieg für unbekannte Titel: Der Knopf soll auch
   * dann erreichbar sein, wenn die gerade geöffnete Seite nicht auf der Liste
   * steht — sonst käme man aus einer Sackgasse nicht mehr in die Liste zurück.
   */
  let erledigt = {}
  /**
   * **Hier oben, nicht bei ihrem Gebrauch — sonst wirft der Seitenaufbau.**
   *
   * Der Speicher-Ladepfad ein paar Zeilen weiter unten schreibt diesen Wert,
   * und er liegt rund 150 Zeilen vor der Stelle, an der der Zähler ihn liest.
   * Ein `let` hebt den Namen zwar hoch, aber nicht den Wert: Jeder Zugriff
   * davor wirft, statt `undefined` zu liefern.
   *
   * **Das ist in dieser Datei der dritte Fall derselben Art** — nach
   * `listenId` und `dialog`, beide mit demselben Kommentar versehen.
   *
   * `no-use-before-define` als Zusicherung wurde am 27.08.2026 probiert und
   * wieder verworfen: Die Regel kann einen Zugriff **innerhalb** einer erst
   * später aufgerufenen Funktion nicht von einem auf Ausführungsebene
   * unterscheiden und meldet in dieser Datei 25 Stellen, von denen keine
   * einzige abstürzt. Eine Prüfung, die 25 Fehlalarme liefert, wird
   * abgeschaltet — dann hätte sie nichts gebracht.
   *
   * Gefangen hat diesen Fall der Sandkasten-Durchlauf in
   * `amazon-uebersicht.test.cjs`: Er lädt die Datei wirklich und stirbt am
   * Absturz. Das ist die Zusicherung, die trägt — sie hat hier binnen einer
   * halben Minute rot gemeldet.
   */
  let suchErledigt = {}

  /**
   * **Eine beantwortete Wiedervorlage bleibt beantwortet — über das Neuladen hinweg.**
   *
   * Der Riegel kennt sonst kein Ende: Die Liste trägt `erneut`, bis der nächste
   * Bau sie neu erzeugt, und der Knopf stünde die ganze Zeit offen. Daniel am
   * 01.09.2026 nach der Meldung: „ich hab geklickt - button bleibt klickbar -
   * ist was angekommen?" — sie war angekommen, der Knopf sagte es nur nicht.
   *
   * **Der erste Anlauf war ein `Set` im Arbeitsspeicher** und überlebte kein
   * Neuladen; zwei Minuten später stand dieselbe Frage wieder da („soll ich
   * klicken oder wie wird er zu 'alles gemeldet'?"). Gespeichert wird deshalb
   * wie alles andere hier: in `chrome.storage.local`.
   *
   * Der Eintrag hält den **Grund**, auf den geantwortet wurde. Schreibt der
   * nächste Bau eine *andere* Wiedervorlage, greift der Merker nicht mehr —
   * eine neue Frage ist eine neue Frage.
   */
  let wiedervorlageBeantwortet = {}
  /**
   * Bis der Stand da ist, wird nichts behauptet.
   *
   * `speicherLesen` ist asynchron; in den ersten Millisekunden nach dem Laden
   * ist `erledigt` leer. Der Knopf sah darin einen ungemeldeten Titel und lud
   * zum Melden ein — Sekunden später sprang er auf „alles gemeldet" zurück
   * (Daniel, 24.08.2026). Wer in diesem Fenster klickt, meldet eine Staffel ein
   * zweites Mal.
   */
  let standGeladen = false
  /** Das Laden selbst — damit ein Klick darauf warten kann statt zu pollen. */
  const gelesen = speicherLesen(['amazonErledigt', 'amazonSuche', 'amazonWiedervorlage'])
  // Synchron oder als Zusage — beides kommt vor, siehe `speicherLesen`.
  const standFertig = gelesen && typeof gelesen.then === 'function' ? gelesen : Promise.resolve(gelesen)
  if (gelesen && typeof gelesen.then !== 'function') {
    erledigt = gelesen.amazonErledigt ?? {}
    suchErledigt = gelesen.amazonSuche ?? {}
    wiedervorlageBeantwortet = gelesen.amazonWiedervorlage ?? {}
    standGeladen = true
  }
  standFertig
    .then((x) => {
      erledigt = x?.amazonErledigt ?? {}
      suchErledigt = x?.amazonSuche ?? {}
      wiedervorlageBeantwortet = x?.amazonWiedervorlage ?? {}
      standGeladen = true
      /**
       * Jetzt erst kann der Weg über den Serientitel greifen — vorher war
       * `erledigt` leer. Ohne diese Zeile bliebe der Schlüssel auf der fremden
       * Staffel-ASIN stehen, die beim Seitenaufbau herauskam.
       */
      const besser = listenSchluessel(listenId)
      if (besser !== listenId) {
        listenId = besser
        eintrag = liste[listenId] ?? eintrag
        letzterStand = ''
      }
      uebersichtZeichnen()
      /*
        Und gleich beim Briefkasten nachfragen, wer wirklich schon gemeldet ist.
        Der lokale Stand hat den Aufbau nur überbrückt; ab hier gilt der
        gemeinsame (Daniel, 28.08.2026: „single source of truth").
      */
      void briefkastenHolen(true)
    })
    .catch(() => {
      // Ohne Speicher ist der Stand unbekannt — dann lieber melden lassen als
      // dauerhaft sperren.
      standGeladen = true
      void briefkastenHolen(true)
    })

  /**
   * Was ein anderer Tab meldet, kommt hier an.
   *
   * Ohne das zeigt dieser Tab weiter „offen" für etwas, das nebenan längst
   * gemeldet ist — und beim nächsten eigenen Melden wäre sein Stand wieder der
   * alte. Zusammen mit dem Zusammenführen beim Schreiben ergibt das einen
   * Stand, den sich alle Tabs teilen.
   */
  try {
    chrome.storage?.onChanged?.addListener?.((aenderungen, bereich) => {
      if (bereich !== 'local') return
      if (aenderungen.amazonSuche) suchErledigt = aenderungen.amazonSuche.newValue ?? {}
      if (!aenderungen.amazonErledigt) return uebersichtZeichnen()
      erledigt = aenderungen.amazonErledigt.newValue ?? {}
      /**
       * Auch der Melde-Knopf, nicht nur die Zahl in der Übersicht.
       *
       * Meldet Daniel denselben Titel in einem zweiten Tab, sprang die Zahl
       * dort sofort — der Knopf erst Sekunden später (Daniel, 25.08.2026:
       * „der melde button aktualisiert erst nach weiteren ~5sek").
       *
       * Der Grund ist `letzterStand`: `zeichnen()` steigt früh aus, wenn sich
       * an Sprache, Folgenzahl und Vollständigkeit nichts geändert hat — und
       * eine fremde Meldung ändert daran nichts. Sie ändert nur den Bestand,
       * und den muss die Signatur nicht kennen; sie muss nur einmal verworfen
       * werden.
       */
      letzterStand = ''
      uebersichtZeichnen()
      zeichnen()
    })
  } catch {
    // Erweiterung neu geladen — dann gibt es hier nichts mehr zu hören.
  }

  /**
   * Ist dieser Titel **vollständig** abgearbeitet?
   *
   * Ein Eintrag im Speicher sieht so aus:
   *
   *     "B018YLXXNW": { staffeln: { "1": "🇩🇪" }, gesamt: 5 }
   *
   * Erledigt ist er erst, wenn so viele Staffeln gemeldet sind, wie die
   * Seite nennt. Vorher bleibt die Zeile in der Liste stehen und zeigt den
   * Fortschritt.
   */
  /**
   * Alle Listeneinträge, die dieselbe Amazon-Serie meinen.
   *
   * Bakugan steht bei uns als drei Titel, bei Amazon als **eine** Serie mit
   * fünfzehn Staffeln; Barbapapa als zwei. Wer alle durchgeht, verteilt seinen
   * Fortschritt sonst auf mehrere Zeilen, und keine wird je fertig — „12/15",
   * „2/15", „2/15" (Daniel, 24.08.2026).
   *
   * Verbunden wird über den Serientitel, den Amazon beim Melden liefert. Fehlt
   * er — bei allem, was vor dem 24.08.2026 gemeldet wurde —, bleibt der Eintrag
   * für sich; erfunden wird nichts.
   */
  function serienGefaehrten(asinEintrag) {
    const serie = erledigt[asinEintrag]?.serie
    if (!serie) return [asinEintrag]
    return Object.keys(erledigt).filter((k) => erledigt[k]?.serie === serie)
  }

  /** Die gemeldeten Staffeln aller Zeilen derselben Serie, zusammengelegt. */
  function staffelnDerSerie(asinEintrag) {
    const zusammen = {}
    for (const k of serienGefaehrten(asinEintrag)) {
      Object.assign(zusammen, erledigt[k]?.staffeln ?? {})
    }
    return zusammen
  }

  /** Wie viele Staffeln die Serie insgesamt hat — die größte bekannte Angabe. */
  /**
   * Wie viele Staffeln diese Zeile hat.
   *
   * **Bewusst nicht über die Serie gebündelt** — das war der erste Versuch und
   * ein Fehlgriff: Das Maximum über alle Zeilen derselben Serie zieht jede
   * fehlerhafte Zahl auf alle anderen. Bei „K — Return of Kings" (zwei
   * Staffeln) stand daraufhin „noch 19 Staffeln" am Knopf (Daniel, 24.08.2026).
   *
   * Die gemeldeten Staffeln werden weiterhin zusammengelegt — das ist die
   * Auskunft, um die es Daniel ging. Die Gesamtzahl bleibt bei ihrer Zeile.
   */
  function gesamtDerSerie(asinEintrag) {
    /*
      Die Staffeln werden über alle Einträge der Serie gesammelt — die Zahl, mit
      der sie verglichen werden, muss denselben Umfang haben. Sonst entsteht
      „7/5" (Daniel, 28.08.2026).
    */
    let groesste = 0
    for (const k of serienGefaehrten(asinEintrag)) {
      const n = erledigt[k]?.gesamt
      if (Number.isFinite(n) && n > groesste) groesste = n
    }
    /*
      **Die offene Seite darf eine zu kleine gespeicherte Zahl berichtigen.**

      Ein `gesamt`, das beim Melden aus einem halben Ladezustand entstand,
      bliebe sonst für immer stehen — und mit ihm ein Titel, der nach einer
      Meldung als fertig gilt. Bei „Danmachi" war das eine 1 für eine Serie mit
      fünf Staffeln; der Eintrag verschwand aus der Liste, und Staffel 2 war
      nicht mehr erreichbar (Daniel, 30.08.2026).

      Nur nach oben, und nur für den Eintrag, dessen Seite gerade offen ist:
      Was hier steht, ist die Auskunft der Seite selbst.
    */
    try {
      if (asinEintrag === listenId) {
        const jetzt = staffelZahl()
        if (Number.isFinite(jetzt) && jetzt > groesste) groesste = jetzt
      }
    } catch {
      /* `listenId` noch nicht gesetzt — dann bleibt es beim Gespeicherten. */
    }
    return groesste || erledigt[asinEintrag]?.gesamt || 1
  }

  /**
   * **Lokal abgehakt, aber beim Worker nie angekommen.**
   *
   * Der Briefkasten führt jede Adresse, unter der jemals gemeldet wurde. Kennt
   * er eine nicht, ist die Arbeit verloren gegangen — der lokale Vermerk gilt
   * dann nicht, ganz gleich was er sagt.
   *
   * Als eigene Funktion, weil dieselbe Regel an drei Stellen gebraucht wird:
   * `fertig()` hatte sie, die Marke in der Liste bekam sie am 30.08.2026, und
   * der Melde-Knopf hatte sie nicht. Genau das fiel Daniel auf: „eintrag der
   * ‚nicht angekommen' ist angeklickt, da steht alles gemeldet, wie soll ich
   * das erneut melden?" Drei Kopien derselben Regel laufen auseinander; eine
   * Funktion tut es nicht.
   *
   * In `try`, weil `briefkastenAdressen` weiter unten angelegt wird und diese
   * Funktion beim Seitenaufbau läuft. Vorher gilt: noch keine Auskunft, also
   * entscheidet der lokale Stand.
   */
  /**
   * **Ein Eintrag mit Wiedervorlage ist nie „alles gemeldet".**
   *
   * `tools/extension-offene-amazon.mjs` schreibt seit dem 29.08.2026 ein Feld
   * `erneut` mit dem Grund, aus dem ein längst gemeldeter Titel noch einmal
   * angesehen gehört — bei „Golden Kamuy: Final Season" steht dort „9 von 13
   * deutsch, obwohl Crunchyroll alle führt — derselbe Kanal".
   *
   * **Gelesen hat es hier niemand.** Der Kasten zeigte „✓ alles gemeldet", der
   * Grund stand nirgends, und der Auftrag war damit unerreichbar (Daniel,
   * 01.09.2026). Derselbe Fehlertyp wie bei `titelId` am 28.08. und bei
   * `paare` in `melder.js`: Das Feld entsteht, reist mit — und kommt nie an.
   *
   * Der lokale Vermerk bleibt stehen; er trägt den Befund von damals.
   */

  function wiedervorlage(asinEintrag) {
    try {
      const grund = String(liste[asinEintrag]?.erneut ?? '') || null
      if (!grund) return null
      return wiedervorlageBeantwortet[asinEintrag] === grund ? null : grund
    } catch {
      return null
    }
  }

  function nichtAngekommen(asinEintrag) {
    try {
      const url = liste[asinEintrag]?.url
      return Boolean(url && briefkastenAdressen && !briefkastenAdressen.has(url))
    } catch {
      return false
    }
  }

  function fertig(asinEintrag) {
    /*
      **Auch hier entscheidet der Briefkasten, nicht der Rechner.**

      Führt er die Adresse dieses Eintrags nicht mehr, ist nichts gemeldet — egal
      was lokal steht. Das ist die Richtung, an der am 28.08.2026 zwei Titel
      hängen blieben: lokal abgehakt, im Briefkasten nie angekommen (oder längst
      übernommen), und damit für immer unsichtbar.
    */
    if (nichtAngekommen(asinEintrag)) return false
    /*
      **Und eine Wiedervorlage ist nie fertig.**

      Der erste Anlauf (4.9.6) fasste nur den Melde-Knopf an — Liste und
      Uebersicht haengen aber an dieser Funktion, und die sagte weiter
      "alles geprueft" (Daniel, 01.09.2026, mit Bild). Ein Riegel, der an
      einer von zwei Stellen sitzt, ist keiner.
    */
    if (wiedervorlage(asinEintrag)) return false
    const e = erledigt[asinEintrag]
    if (!e) return false
    return Object.keys(staffelnDerSerie(asinEintrag)).length >= gesamtDerSerie(asinEintrag)
  }

  /**
   * Welche Staffeln gemeldet sind und welche fehlen — im Klartext.
   *
   * Steht als Tooltip an der Fortschritts-Marke. Gemeldete Staffeln mit ihrem
   * Befund, fehlende als Aufzählung: „Gemeldet: S1 🇩🇪, S2 ✕ · Es fehlen: S3, S4".
   *
   * Die Nummern sind die aus dem Quelltext (`seasonNumber`), also dieselben,
   * die im Auswahlfeld stehen — man kann sie unmittelbar ansteuern. Wo eine
   * Meldung ohne Nummer erfolgte (ältere Einträge tragen dort eine ASIN),
   * bleibt sie stehen, wie sie ist; erfunden wird nichts.
   */
  function staffelUebersicht(asinEintrag) {
    const e = erledigt[asinEintrag]
    if (!e) return 'Noch nichts gemeldet'
    const geprueft = Object.entries(staffelnDerSerie(asinEintrag))
    if (!geprueft.length) return 'Noch nichts gemeldet'

    const teile = ['Gemeldet: ' + geprueft.map(([nr, befund]) => `S${nr} ${befund}`).join(', ')]

    // Welche Nummern fehlen — nur dort, wo die Staffeln durchnummeriert sind.
    const gesamt = gesamtDerSerie(asinEintrag)
    const zahlen = geprueft.map(([nr]) => Number(nr)).filter((n) => Number.isFinite(n))
    if (gesamt > 1 && zahlen.length === geprueft.length) {
      const fehlen = []
      for (let n = 1; n <= gesamt; n++) if (!zahlen.includes(n)) fehlen.push('S' + n)
      if (fehlen.length) teile.push('Es fehlen: ' + fehlen.join(', '))
    }
    return teile.join(' · ')
  }

  /** Wie weit dieser Titel ist — für die Zeile in der Liste. */
  /**
   * Wie weit dieser Titel ist — für die Zeile in der Liste.
   *
   * **„7/5" stand am 28.08.2026 bei „Golden Kamuy: Final Season"** (Daniel, mit
   * Bild). Der Zähler sammelt die gemeldeten Staffeln über **alle** Einträge
   * derselben Serie (`staffelnDerSerie` läuft über `serienGefaehrten`), verglich
   * sie aber gegen die Staffelzahl **eines** Eintrags. Golden Kamuy hat mehrere
   * Prime-Einträge; sieben gemeldete Staffeln gegen die fünf des einen.
   *
   * Verglichen wird deshalb gegen die größte Zahl, die einer der Gefährten
   * nennt. Bleibt es darüber, ist die Sache erledigt und der Bruch sagt nichts
   * mehr — dann steht dort ein Haken.
   */
  function fortschritt(asinEintrag) {
    const e = erledigt[asinEintrag]
    if (!e) return null
    const staffeln = staffelnDerSerie(asinEintrag)
    const zahl = Object.keys(staffeln).length
    const gesamt = gesamtDerSerie(asinEintrag)
    if (gesamt <= 1) return Object.values(staffeln)[0] ?? '✓'
    return zahl >= gesamt ? '✓' : `${zahl}/${gesamt}`
  }

  const offeneZahl = () => Object.keys(liste).filter((a) => !fertig(a)).length

  /**
   * **Die Suchadressen gehören in dieselbe Übersicht wie die Titelseiten.**
   *
   * Daniel am 27.08.2026, nach der ersten Runde: „golden kamui stand auch in
   * der liste, hab ich gemeldet, mehr seh ich in der liste nicht." Der Knopf
   * zählte zwei offene Titelseiten und schwieg über 118 Suchadressen — die
   * gab es nur zu sehen, wenn man zufällig auf einer davon landete.
   *
   * Ein Zähler, der einen ganzen Stapel Arbeit verschweigt, ist schlimmer als
   * keiner: „Prime: alles geprüft" war schlicht falsch.
   *
   * Abgehakt werden sie getrennt von den Titelseiten. Deren Abhak-Liste hängt
   * an Kennung, Staffel und Serientitel; eine Suchadresse hat nichts davon.
   * Sie ist erledigt, sobald unter ihr gemeldet wurde — mehr gibt es dort
   * nicht zu wissen.
   */
  /**
   * **Was gemeldet ist, sagt der Briefkasten — nicht der Rechner.**
   *
   * Bis 3.81 führte die Erweiterung zwei eigene Speicher: `amazonErledigt` für
   * Titelseiten, `amazonSuche` für Suchadressen. Beide lagen nur hier, und
   * genau daran ist am 28.08.2026 sichtbar geworden, was daran falsch ist:
   *
   * - Ein Werkzeug zum Zurücksetzen räumte einen der beiden Speicher, meldete
   *   Erfolg — und in der Liste änderte sich nichts, weil der andere filterte.
   * - Was auf einem Rechner abgehakt war, war es auf keinem anderen.
   * - Zwei Quellen für dieselbe Frage laufen auseinander, und keine kann sagen,
   *   welche recht hat.
   *
   * Daniel dazu: „die liste sollte synchron sein … gemeldet/nicht gemeldet
   * sollte ebenfalls synchron remote abgeglichen werden, kein lokales
   * zurücksetzen only, kein localstorage dafür … single source of truth."
   *
   * Der Briefkasten weiß es ohnehin: Jede Meldung landet dort, und
   * `?zaehlen=1&nummern=1` gibt die Adressen zurück, die noch nicht übernommen
   * sind. Genau diesen Weg geht `disney.js` seit dem 26.08.2026.
   *
   * **Der lokale Speicher bleibt als Überbrückung, nicht als Wahrheit.** Zwischen
   * dem Klick auf „melden" und der nächsten Antwort des Briefkastens liegen
   * Sekunden; ohne ihn stünde der Titel in dieser Zeit wieder als offen da. Er
   * wird deshalb weiter geschrieben, aber nur noch **zusätzlich** gelesen — und
   * jede Adresse, die der Briefkasten nicht mehr führt, gilt als offen, auch
   * wenn sie lokal abgehakt ist.
   */
  let briefkastenAdressen = null
  let briefkastenGeholtAm = 0
  const BRIEFKASTEN_FRIST_MS = 60_000

  async function briefkastenHolen(erzwingen = false) {
    if (!erzwingen && briefkastenAdressen && Date.now() - briefkastenGeholtAm < BRIEFKASTEN_FRIST_MS) return
    try {
      const antwort = await fetch(`${WORKER}?zaehlen=1`, { cache: 'no-store' })
      if (!antwort.ok) return
      const daten = await antwort.json()
      if (!Array.isArray(daten.adressen)) return
      /*
        **`gemeldet` statt `adressen` — der Unterschied kostete jede Meldung
        ihre Wirkung.**

        `adressen` führt nur, was der Datenlauf noch nicht abgeholt hat. Wer
        einen Titel meldete und danach lief ein Datenlauf, fand ihn am nächsten
        Tag wieder in der Prüfliste — die Meldung war da, nur eben nicht mehr
        „im Briefkasten" (Daniel, 30.08.2026).

        Der Rückfall auf `adressen` gilt für die Minuten zwischen dem Ausrollen
        der Erweiterung und dem des Workers; danach ist `gemeldet` immer da.
      */
      briefkastenAdressen = new Set(Array.isArray(daten.gemeldet) ? daten.gemeldet : daten.adressen)
      briefkastenGeholtAm = Date.now()
      try {
        uebersichtZeichnen()
      } catch {
        /* Die Übersicht ist nicht auf jeder Seite gebaut. */
      }
    } catch {
      /*
        **Ohne Auskunft wird nichts ausgeblendet.** Ein Netzfehler darf keine
        Arbeit verstecken — lieber ein Titel zu viel in der Liste als einer, den
        niemand mehr sieht.
      */
    }
  }

  /**
   * Ist unter dieser Adresse schon gemeldet worden?
   *
   * Solange der Briefkasten nicht geantwortet hat, gilt der lokale Stand — sonst
   * flackerte die Liste bei jedem Seitenaufbau. Sobald er da ist, entscheidet er.
   */
  function istGemeldet(url) {
    /*
      **Als Funktionsdeklaration, und der Rumpf in try.**

      Der Aufruf aus dem Auftragskasten steht rund 560 Zeilen weiter oben. Ein
      Pfeil-const dort ist die tote Zone: „Cannot access istGemeldet before
      initialization" (Daniel, 28.08.2026) — der dritte Fall derselben Art an
      einem Tag, nach knopf und listenId.

      Die Deklaration wird hochgezogen, ihre beiden Variablen nicht. Deshalb
      zusaetzlich try: Vor ihrer Zeile gilt „noch nichts bekannt", und das ist
      die richtige Antwort — nicht gemeldet, also offen.
    */
    try {
      /*
        **Eine Suchadresse kann der Briefkasten gar nicht kennen.**

        Für Titelseiten ist er die einzige Quelle, und das bleibt so — dort
        entscheidet er auch gegen einen lokalen Vermerk (28.08.2026).

        Eine Suchadresse landet dort aber nur in einem einzigen Fall: wenn
        „nicht bei Prime" gemeldet wurde. Wer den Treffer **findet**, meldet
        unter der Titeladresse — und die Suchadresse bleibt dem Worker
        unbekannt. `suchAbhaken()` trug sie hilfsweise in die geholte Liste
        ein, und der nächste Abruf warf sie sofort wieder hinaus.

        Sichtbar wurde das an „Jormungand: Perfect Order": gemeldet, Knopf auf
        „alles gemeldet", und der Sucheintrag stand weiter in der Liste
        (Daniel, 30.08.2026).

        Deshalb gilt hier beides. Das ist keine Rückkehr zum alten Zustand,
        sondern die Trennung, die vorher fehlte: Der Briefkasten entscheidet,
        wo er etwas wissen kann.
      */
      if (briefkastenAdressen?.has(url)) return true
      return Boolean(suchErledigt[url])
    } catch {
      return false
    }
  }

  const suchOffen = () => Object.keys(suchliste).filter((u) => !istGemeldet(u))

  async function suchAbhaken(url) {
    /*
      Der lokale Eintrag überbrückt die Sekunden bis zur nächsten Antwort des
      Briefkastens; danach ist dessen Liste maßgeblich.
    */
    suchErledigt = { ...suchErledigt, [url]: new Date().toISOString().slice(0, 10) }
    if (briefkastenAdressen) briefkastenAdressen.add(url)
    await speicherSchreiben({ amazonSuche: suchErledigt })
    /* Und gleich nachfragen, damit der gemeinsame Stand stimmt. */
    void briefkastenHolen(true)
  }

  /**
   * Muss **vor** `uebersichtZeichnen()` stehen, nicht darunter.
   *
   * `let` hebt den Namen zwar hoch, aber nicht den Wert: Ein Zugriff vor der
   * Zeile wirft `Cannot access 'dialog' before initialization` — und
   * `uebersichtZeichnen()` läuft sofort beim Seitenaufbau. Die Erweiterung
   * wäre auf jeder Amazon-Seite mit einem Fehler ausgestiegen, ohne Knopf und
   * ohne sichtbare Ursache.
   */
  let dialog = null

  /**
   * **Aus demselben Grund steht der Name hier und nicht bei seinem Wert.**
   *
   * `listenId` bekommt seinen Wert erst 300 Zeilen weiter unten, sobald
   * `listenSchluessel()` alles beisammen hat, was es braucht — Adresse,
   * Bestand, Serientitel von der Seite. `listenSignatur()` liest es aber schon
   * hier oben, und ein `let` weiter unten heißt für jeden Zugriff davor nicht
   * „undefined", sondern **Absturz**:
   *
   *     Uncaught ReferenceError: Cannot access 'listenId' before initialization
   *     amazon.js:1286
   *
   * Daniel am 25.08.2026 mit dem Fehlerbild aus `chrome://extensions`: „dialog
   * öffnet sich nicht auf amazon.de". Der Knopf war da — er wird vor der
   * Absturzstelle angelegt —, nur lief danach nichts mehr, und deshalb blieb
   * auch die Zahl darauf stehen, wie sie beim Aufbau gerade war.
   *
   * Die Deklaration hier oben nimmt den Namen aus der temporalen Totzone; bis
   * zur Zuweisung ist er schlicht `undefined`, und damit kommt eine Signatur
   * aus Zeichenketten zurecht.
   */
  let listenId

  const uebersichtKnopf = document.createElement('button')
  uebersichtKnopf.className = 'ak-uebersicht ak-amazon-uebersicht'
  uebersichtKnopf.type = 'button'
  uebersichtKnopf.addEventListener('click', dialogUmschalten)
  document.body.appendChild(uebersichtKnopf)

  function uebersichtZeichnen() {
    // Nach einem Neuladen der Erweiterung ist die Verbindung weg. Das
    // gehoert an den Knopf, sonst klickt Daniel ins Leere.
    if (!verbindungLebt()) {
      setz(uebersichtKnopf, 'textContent', 'Erweiterung neu geladen — Seite aktualisieren')
      uebersichtKnopf.classList.add('ak-fertig')
      return
    }
    const offen = offeneZahl()
    const suchen = suchOffen().length
    const gesamt = offen + suchen
    uebersichtKnopf.classList.toggle('ak-fertig', !gesamt)
    /*
      Beide Zahlen getrennt, weil sie verschiedene Arbeit meinen: Eine
      Titelseite liest die Erweiterung selbst, eine Suchadresse verlangt, den
      richtigen Treffer herauszusuchen.
    */
    setz(
      uebersichtKnopf,
      'textContent',
      gesamt
      ? suchen && offen
        ? `${offen} Prime-Titel · ${suchen} Suchen offen`
        : suchen
          ? `${suchen} Prime-Suchen offen`
          : `${offen} Prime-Titel offen`
      : listeVeraltet
        ? 'Prime-Liste veraltet — neu laden'
        : 'Prime: alles geprüft',
    )
    setz(
      uebersichtKnopf,
      'title',
      gesamt
        ? listeVeraltet
          ? 'Der Bestand ist neuer als diese Liste — es können weitere Aufträge dazugekommen sein. In chrome://extensions auf „Aktualisieren".'
          : 'Liste öffnen — Seite aufrufen, warten bis der Knopf eine Zahl zeigt, klicken'
        : listeVeraltet
          ? 'Der Bestand ist neuer als diese Liste. In chrome://extensions auf „Aktualisieren", dann stehen die neuen Aufträge hier.'
          : 'Keine offenen Prime-Titel mehr',
    )
    void standPruefen()
    if (dialog) dialogFuellen()
  }
  uebersichtZeichnen()

  function dialogUmschalten() {
    if (dialog) {
      dialog.remove()
      dialog = null
      return
    }
    dialog = document.createElement('div')
    dialog.className = 'ak-dialog'
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialogUmschalten()
    })
    document.body.appendChild(dialog)
    dialogFuellen()
  }

  /**
   * Woran sich ablesen lässt, ob ein Neuaufbau überhaupt nötig ist.
   *
   * Alles, was in der Liste sichtbar ist: die offene Gesamtzahl, welcher Titel
   * gerade offen ist, und je Eintrag sein Fortschritt. Ändert sich davon
   * nichts, ändert sich auch die Anzeige nicht.
   */
  function listenSignatur() {
    /*
      **Die Suchadressen gehören in die Signatur, nicht nur die Titelseiten.**

      Daniel am 28.08.2026: „und nach meldung bleibt der eintrag in der liste."
      Der Dialog wird nur neu gefüllt, wenn sich die Signatur ändert — und die
      zählte ausschließlich `liste`, also die Titelseiten. Eine abgehakte
      Suchadresse ließ sie unverändert, der Dialog blieb stehen, wie er war.

      Die Anzeige führt beide Sorten in einer Liste; dann muss die Signatur auch
      beide messen. `suchOffen()` ist billig — eine Filterung über ein Set.
    */
    const teile = [offeneZahl(), suchOffen().length, listenId]
    for (const asinEintrag of Object.keys(liste)) {
      teile.push(asinEintrag + ':' + (fortschritt(asinEintrag) || '') + ':' + (fertig(asinEintrag) ? '1' : '0'))
    }
    return teile.join('|')
  }
  let letzteSignatur = null

  function dialogFuellen() {
    if (!dialog) return

    /**
     * Nur neu bauen, wenn sich wirklich etwas geändert hat.
     *
     * Ohne diese Zeile lief `dialogFuellen` zweimal je Sekunde durch, weil sie
     * am Ende von `uebersichtZeichnen` steht und die im 500-ms-Takt läuft. Das
     * Suchfeld bekam dabei jedes Mal neu den Fokus (es blinkte), und ein Klick,
     * der zwischen `mousedown` und `mouseup` in einen Neuaufbau fiel, traf ein
     * Element, das es nicht mehr gab — Daniel musste Titel mehrfach anklicken
     * (24.08.2026).
     */
    /**
     * Ein frisch geöffneter Dialog ist leer — der muss immer gefüllt werden.
     *
     * Der Wächter allein prüfte nur, ob sich am **Inhalt** etwas geändert hat.
     * Beim Schließen und Neuöffnen ändert sich daran nichts, also baute er
     * nichts: „es kommt backdrop aber kein dialog" (Daniel, 24.08.2026).
     */
    const signatur = listenSignatur()
    if (signatur === letzteSignatur && dialog.querySelector('.ak-kasten')) return
    letzteSignatur = signatur

    // Was ein Neuaufbau sonst verschluckt: der eingetippte Suchbegriff, die
    // Scrollposition und die Einstellung „Erledigte zeigen".
    const altesFeld = dialog.querySelector('.ak-suche')
    const altesInhalt = dialog.querySelector('.ak-liste')
    const merkeSuche = altesFeld ? altesFeld.value : ''
    const merkeScroll = altesInhalt ? altesInhalt.scrollTop : 0
    const merkeErledigte = !!dialog.querySelector('.ak-kasten.ak-mit-erledigten')
    const hatteFokus = altesFeld && document.activeElement === altesFeld

    dialog.textContent = ''

    const kasten = document.createElement('div')
    kasten.className = 'ak-kasten'
    dialog.appendChild(kasten)

    const kopf = document.createElement('div')
    kopf.className = 'ak-kopf'
    kasten.appendChild(kopf)

    const titelzeile = document.createElement('strong')
    const offen = offeneZahl()
    titelzeile.textContent = offen ? `${offen} Prime-Titel zu prüfen` : 'Alles geprüft'
    kopf.appendChild(titelzeile)

    const suche = document.createElement('input')
    suche.className = 'ak-suche'
    suche.type = 'search'
    suche.placeholder = 'Suchen'
    kopf.appendChild(suche)

    // Erledigtes ist standardmäßig weg — dieselbe Entscheidung wie bei
    // Netflix, und aus demselben Grund: Bei 300 abgehakten Zeilen findet man
    // die offenen sonst nicht mehr.
    const umschalter = document.createElement('button')
    umschalter.className = 'ak-umschalter'
    umschalter.type = 'button'
    umschalter.textContent = 'Erledigte zeigen'
    umschalter.addEventListener('click', () => {
      const an = kasten.classList.toggle('ak-mit-erledigten')
      umschalter.textContent = an ? 'Erledigte ausblenden' : 'Erledigte zeigen'
    })
    kopf.appendChild(umschalter)

    /**
     * Die Abhak-Liste wegwerfen — ohne eine einzige Meldung zu verlieren.
     *
     * Beides zu trennen ist der Grund, warum das gefahrlos geht: Was gemeldet
     * wurde, liegt beim Worker und trägt seine eigene Adresse. Hier steht nur,
     * was **dieser Browser** für erledigt hält.
     *
     * Gebraucht wurde das am 24.08.2026: Ein Fehler in `seitenTitel()` hat
     * Meldungen unter fremden Serien abgelegt („Ragna Crimson" auf einer
     * Chaika-Seite), und der Knopf zeigte danach überall den Stand des falschen
     * Titels. Eine kaputte Abhak-Liste lässt sich nicht reparieren — sie sagt
     * ja nicht, welcher Eintrag falsch ist. Sie lässt sich nur neu aufbauen,
     * und das kostet Daniel nichts als ein paar Klicks auf Titel, die er ohnehin
     * schon gemeldet hat.
     */
    const zuruecksetzen = document.createElement('button')
    zuruecksetzen.className = 'ak-umschalter'
    zuruecksetzen.type = 'button'
    zuruecksetzen.textContent = 'Abhaken zurücksetzen'
    zuruecksetzen.title =
      'Leert nur die Liste, was dieser Browser für erledigt hält.\n' +
      'Die gemeldeten Tonspuren liegen beim Worker und bleiben erhalten.'
    zuruecksetzen.addEventListener('click', async () => {
      zuruecksetzen.textContent = 'setzt zurück …'
      erledigt = {}
      await speicherSchreiben({ amazonErledigt: {} })
      letzteSignatur = null
      letzterStand = ''
      uebersichtZeichnen()
      zeichnen()
    })
    kopf.appendChild(zuruecksetzen)

    const inhalt = document.createElement('div')
    inhalt.className = 'ak-liste'
    kasten.appendChild(inhalt)

    /**
     * Offenes zuerst, Erledigtes ans Ende — und der gerade geöffnete Titel
     * ganz oben, damit erkennbar ist, wo man steht.
     */
    const eintraege = Object.entries(liste).sort((a, b) => {
      if (a[0] === listenId) return -1
      if (b[0] === listenId) return 1
      const d = Number(fertig(a[0])) - Number(fertig(b[0]))
      return d || a[1].titel.localeCompare(b[1].titel, 'de')
    })

    for (const [asinEintrag, e] of eintraege) {
      const zeile = document.createElement('div')
      zeile.className = 'ak-zeile'
      if (fertig(asinEintrag)) zeile.classList.add('ak-abgehakt')

      const verweis = document.createElement('a')
      verweis.className = 'ak-titel'
      verweis.href = e.url
      verweis.textContent = e.titel
      if (asinEintrag === listenId) verweis.textContent = `▸ ${e.titel}`
      zeile.appendChild(verweis)

      /**
       * Getroffen wird die ganze Zeile, nicht nur der Linktext.
       *
       * Daniel am 24.08.2026: „das klick event in der liste sollte nicht auf
       * dem linktext liegen sondern auf der zeile". Bei einem kurzen Titel ist
       * der Streifen daneben breiter als der Text selbst — und ein Klick
       * dorthin tat bisher nichts.
       *
       * Der Klick auf den Verweis selbst bleibt unberührt: Sonst würde er hier
       * ein zweites Mal ausgelöst und der Titel ginge doppelt auf.
       */
      zeile.style.cursor = 'pointer'
      zeile.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return
        verweis.click()
      })

      // Was an dieser Adresse hängt: mehrere Staffeln unter einer Seite sind
      // der Regelfall, nicht die Ausnahme.
      const offeneNamen = e.eintraege.filter((x) => x.offen)
      if (offeneNamen.length > 1) {
        const zusatz = document.createElement('span')
        zusatz.className = 'ak-folge'
        zusatz.textContent = `${offeneNamen.length} Einträge`
        zeile.appendChild(zusatz)
      }
      // Der Fortschritt gehört sichtbar in die Zeile: „1/5" sagt, dass hier
      // noch vier Staffeln warten.
      const stand = fortschritt(asinEintrag)
      if (stand) {
        const marke = document.createElement('span')
        /**
         * **Lokal abgehakt, beim Worker nichts — das muss dastehen.**
         *
         * Daniel am 30.08.2026: „einträge in der liste sind mit checkmark und x
         * symbol markiert, was bedeutet es? wenn das bedeutet sie wurden bereits
         * gemeldet, warum sind sie dann immer noch in der liste?"
         *
         * Beides stimmt gleichzeitig: Die Marke zeigt den **lokal gemerkten**
         * Befund, und die Zeile bleibt stehen, weil beim Worker keine Meldung
         * liegt. Gemessen am selben Tag: 435 von 582 Prime-Adressen sind dort
         * angekommen — die acht in der Liste nicht, obwohl alle acht lokal einen
         * Befund tragen. Die Meldung ist unterwegs verloren gegangen.
         *
         * Die Liste hat recht, sie zu zeigen. Sie war nur stumm darüber, warum.
         */
        const verloren = nichtAngekommen(asinEintrag)
        marke.className = fertig(asinEintrag)
          ? 'ak-folge ak-fertig'
          : verloren
            ? 'ak-folge ak-verloren'
            : 'ak-folge ak-angefasst'
        marke.textContent = verloren ? `${stand} — nicht angekommen` : stand
        /**
         * Beim Überfahren steht da, **welche** Staffeln durch sind.
         *
         * „12/15" sagt, dass drei fehlen, aber nicht welche — bei fünfzehn
         * Staffeln bleibt sonst nur, alle noch einmal durchzugehen (Daniel,
         * 24.08.2026). Die Antwort liegt im Bestand: Jede gemeldete Staffel
         * steht dort mit ihrem Befund.
         */
        marke.title = staffelUebersicht(asinEintrag)
        zeile.appendChild(marke)
      }
      inhalt.appendChild(zeile)
    }

    /**
     * **Die Suchadressen — dieselbe Liste, eigener Abschnitt.**
     *
     * 118 unserer Prime-Verweise sind Suchen statt Titelseiten. Sie standen
     * bis zum 27.08.2026 in keiner Übersicht: Der Knopf zählte zwei offene
     * Titelseiten, und nach deren Meldung schrieb er „Prime: alles geprüft",
     * während 118 Adressen unbearbeitet waren (Daniel: „mehr seh ich in der
     * liste nicht").
     *
     * Sie bekommen einen eigenen Abschnitt, weil sie andere Arbeit meinen:
     * Eine Titelseite liest die Erweiterung selbst; hier muss erst der
     * richtige Treffer herausgesucht werden. Die Folgenzahl steht in der
     * Zeile — sie ist das Merkmal, an dem sich die Serie von ihrem Film
     * unterscheidet.
     */
    const suchZeilen = Object.entries(suchliste)
    if (suchZeilen.length) {
      const trenner = document.createElement('div')
      trenner.className = 'ak-abschnitt'
      trenner.textContent = `Suche nötig — ${suchOffen().length} von ${suchZeilen.length} offen`
      trenner.title = 'Für diese Titel kennt niemand eine Prime-Adresse. Öffne die Suche, klicke den richtigen Treffer an — dort läuft die Prüfung wie gewohnt.'
      inhalt.appendChild(trenner)

      /*
        **Was aussichtsreich ist, steht oben — abgehakt unten, wackelig ganz unten.**

        Die Liste war rein alphabetisch, und damit ging genau die Reihenfolge
        verloren, die `vorschlaege-anbieter.ts` mühsam herstellt: Titel mit
        belegten deutschen Sprechrollen zuerst, wackelige TMDB-Treffer zuletzt.
        Wer von oben nach unten arbeitet, soll den Ertrag vorn haben.

        Ein wackeliger Vorschlag wird deshalb **nicht** ausgeblendet — er ist
        seltener richtig, nicht nie. Er steht nur hinten und sagt in der Zeile,
        woran es liegt.
      */
      for (const [url, e] of suchZeilen.sort((a, b) => {
        const d = Number(Boolean(suchErledigt[a[0]])) - Number(Boolean(suchErledigt[b[0]]))
        if (d) return d
        const u = Number(Boolean(a[1].unsicher)) - Number(Boolean(b[1].unsicher))
        if (u) return u
        return a[1].titel.localeCompare(b[1].titel, 'de')
      })) {
        const zeile = document.createElement('div')
        zeile.className = 'ak-zeile ak-suchzeile'
        if (suchErledigt[url]) zeile.classList.add('ak-abgehakt')

        const verweis = document.createElement('a')
        verweis.className = 'ak-titel'
        /*
          **Geöffnet wird der Suchbegriff, gemeldet die Adresse.**

          Die Adresse aus dem Bestand ist der Schlüssel für jede Zuordnung — sie
          bleibt unverändert. Womit gesucht wird, ist davon unabhängig: Der
          Listengenerator legt seit dem 31.08.2026 einen `suchbegriff` bei,
          gebaut aus dem **deutschen** Titel ohne Gattungswörter.

          Daniel: „alle titel sollen im search mit ihrem deutschen titel gesucht
          werden … die generics sollen aus der search rausgenommen werden."
          Gemessen trugen 26 von 51 Adressen den englischen Titel, und der
          findet bei Prime oft nichts.
        */
        verweis.href = e?.suchbegriff
          ? `https://www.amazon.de/s?k=${encodeURIComponent(e.suchbegriff)}&i=instant-video`
          : url
        verweis.textContent = e.titel
        zeile.appendChild(verweis)

        /*
          Die Folgenzahl ist hier kein Fortschritt, sondern das Erkennungs-
          merkmal: Eine Suche nach „Cowboy Bebop" liefert bei Prime nur den
          Film — eine Folge statt sechsundzwanzig (Daniel, 27.08.2026).
        */
        if (e.folgen) {
          const marke = document.createElement('span')
          marke.className = 'ak-folge'
          marke.textContent = `${e.folgen} Folgen`
          marke.title = 'So viele Folgen führt unser Bestand. Zeigt der Treffer deutlich weniger, ist es ein anderes Werk — meist der Film zur Serie.'
          zeile.appendChild(marke)
        }

        /*
          **Der Vermerk gehört in die Zeile, nicht erst in den Kasten.**

          Bis 3.91 stand er nur auf der Suchseite — also erst, nachdem Daniel
          geklickt und gewartet hat. Hier entscheidet er, was er überhaupt
          anfasst; ein Hinweis danach kommt zu spät.
        */
        if (e.unsicher) {
          const marke = document.createElement('span')
          marke.className = 'ak-folge ak-unsicher'
          marke.textContent = 'wackelig'
          marke.title = e.unsicher + ' — der Anbieter gehört vielleicht einem anderen Werk. Findest du hier nichts, ist das die wahrscheinliche Erklärung.'
          zeile.appendChild(marke)
        }

        zeile.style.cursor = 'pointer'
        zeile.addEventListener('click', (ev) => {
          if (ev.target.closest('a')) return
          verweis.click()
        })
        inhalt.appendChild(zeile)
      }
    }

    const filtern = () => {
      const q = suche.value.trim().toLowerCase()
      for (const z of inhalt.children) {
        z.style.display = !q || z.textContent.toLowerCase().includes(q) ? '' : 'none'
      }
    }
    suche.addEventListener('input', filtern)

    // Der gemerkte Zustand zurück: Suchbegriff, Filter, Scrollposition,
    // „Erledigte zeigen". Ein Neuaufbau soll für den Benutzer unsichtbar sein.
    if (merkeSuche) {
      suche.value = merkeSuche
      filtern()
    }
    if (merkeErledigte) {
      kasten.classList.add('ak-mit-erledigten')
      umschalter.textContent = 'Erledigte ausblenden'
    }
    inhalt.scrollTop = merkeScroll

    /**
     * Der Fokus kommt nur beim **Öffnen** ins Suchfeld — oder zurück, wenn er
     * vorher schon dort war.
     *
     * Bedingungslos gesetzt sprang er zweimal je Sekunde hinein, das Feld
     * blinkte, und wer gerade woanders klickte, verlor den Klick.
     */
    if (!altesFeld || hatteFokus) suche.focus()
  }

  /**
   * Auch Staffeln, die **nicht** auf unserer Liste stehen, sind meldenswert.
   *
   * Daniel am 23.08.2026: „staffel 3 ist nur mit aniverse anschaubar … nach
   * neuladen auf season 3 erscheint der button nicht." Der Grund war nicht das
   * Abo — die Erweiterung kennt keine Abo-Sperre —, sondern dass diese Staffel
   * unter einer eigenen Kennung läuft, die im Bestand fehlt.
   *
   * Sie stumm zu übergehen ist der falsche Schluss: Eine belegte deutsche
   * Tonspur ist auch dann etwas wert, wenn wir den Titel noch nicht führen. Die
   * Meldung geht dann mit der Adresse der Seite raus und ohne unsere Kennung;
   * zuordnen lässt sie sich später über den Titel.
   */
  /**
   * Keine Titelseite? Dann wird gewartet, nicht ausgestiegen.
   *
   * Seit dem 24.08.2026 läuft dieses Skript auf **jeder** Amazon-Seite — anders
   * kommt es bei einer Navigation innerhalb der Seite gar nicht erst zum Zug
   * (Chrome injiziert bei einem History-Wechsel nicht nach). Auf der Startseite
   * gibt es dann keine Kennung, und ein `return` an dieser Stelle hieße: Wer
   * von dort aus einen Titel öffnet, sieht keine Knöpfe und muss F5 drücken.
   * Genau das war Daniels Beschwerde.
   *
   * Gewartet wird auf die Kennung, nicht auf die Adresse: Amazon tauscht den
   * Seiteninhalt aus, und erst wenn der Quelltext eine Titel-Kennung trägt,
   * gibt es überhaupt etwas zu melden.
   *
   * Fünf Minuten Frist, dann ist Schluss — wer so lange bei Amazon liest, ohne
   * einen Titel zu öffnen, braucht keinen Melder, und ein Takt, der ewig läuft,
   * gehört nicht auf eine Seite, die stundenlang offen sein kann.
   */
  if (!id) {
    id = await new Promise((fertig) => {
      const bis = Date.now() + 5 * 60 * 1000
      const takt = setInterval(() => {
        const jetzt = asin()
        if (jetzt || Date.now() > bis) {
          clearInterval(takt)
          fertig(jetzt ?? null)
        }
      }, 700)
    })
    if (!id) return
    // Die Adresse hat sich unterdessen geändert — die gemerkte Startadresse
    // stammt noch von der Seite, auf der wir angekommen sind.
    startAdresse = location.href || startAdresse
  }

  /**
   * Unter welcher Kennung dieser Titel in **unserer Liste** steht.
   *
   * Nicht dieselbe wie die Melde-Kennung: Die Liste entsteht aus den
   * Adressen im Datensatz, der Quelltext nennt die Kennung der gezeigten
   * Staffel. Bei „Digimon Tamers" sind das B0CQ4VL364 und B0CKPCSHMC.
   *
   * Gesucht wird über beide — und abgehakt wird unter **dieser**, sonst
   * verschwindet der Eintrag nie aus der Liste.
   */
  /**
   * Unter welchem Listeneintrag diese Seite abgehakt wird.
   *
   * `bisher` ist der Eintrag, unter dem wir gerade stehen — und der Grund,
   * warum er übergeben wird: **Ein Staffelwechsel wechselt die ASIN, nicht die
   * Serie.** Jede Staffel hat ihre eigene, unsere Liste kennt aber nur die
   * eine, über die der Verweis in den Bestand kam.
   *
   * Ohne diesen Rückfall landete jede Meldung ab Staffel 2 unter einer
   * Kennung, die in keiner Zeile der Liste steht: Bei „Captain Tsubasa" waren
   * vier von fünf Meldungen unsichtbar, bei Bakugan verteilten sie sich auf
   * drei Zeilen derselben Serie (Daniel, 24.08.2026).
   */
  /**
   * **Steht diese Serie irgendwo bei uns — egal unter welcher Staffel?**
   *
   * Prime gibt jeder Staffel eine eigene Kennung. Unsere Liste führt aber
   * nicht jede davon: Wer Staffel 1 gemeldet hat und dann auf Staffel 2
   * umschaltet, landet auf einer Kennung, die dort nicht steht — und seit
   * 3.44 verschwanden damit alle Bedienelemente (Daniel, 27.08.2026: „ich
   * wechsel zu staffel 2, die elemente verschwinden und ich kann nicht
   * melden").
   *
   * Das Ausblenden war für **fremde** Titelseiten gedacht, nicht für die
   * zweite Staffel einer Serie, die wir führen. Der Serientitel trennt beides:
   * Amazon nennt ihn auf jeder Staffel-Seite gleich.
   */
  function serieBekannt() {
    const serie = titelKern(seitenTitel())
    if (!serie) return false
    /*
      **Verglichen wird der Kern, und „enthält" genügt.**

      Gleichheit trägt hier nicht: Amazon nennt die Seite „Dr. Stone", unser
      Eintrag heißt „Dr. Stone – Staffel 3", und die Prüfliste führt oft nur
      eine der Staffeln. `titelKern()` wirft Staffelangaben und Satzzeichen
      ohnehin weg; was bleibt, muss nur ineinander vorkommen.
    */
    const passt = (t) => {
      const k = titelKern(t)
      return k.length >= 4 && (k === serie || k.includes(serie) || serie.includes(k))
    }
    if (Object.keys(erledigt).some((k) => passt(erledigt[k]?.serie) || passt(erledigt[k]?.titel))) return true
    return Object.values(liste).some((e) => passt(e?.serie) || passt(e?.titel))
  }

  function listenSchluessel(bisher) {
    const ausAdresse = asinAusAdresse()
    if (ausAdresse && liste[ausAdresse]) return ausAdresse
    if (liste[id]) return id
    if (bisher && liste[bisher]) return bisher
    /**
     * Nach einem **Neuladen** auf einer Staffel-Seite hilft `bisher` nicht mehr.
     *
     * Der Rückfall darüber gilt nur innerhalb einer Sitzung: Wer die Seite neu
     * lädt, während Staffel 3 offen ist, startet ohne vorherigen Eintrag — und
     * die ASIN dieser Staffel steht nicht in unserer Liste. Die Meldung landete
     * dann wieder unter einer fremden Kennung, und der Fortschritt sprang
     * zurück: „ich sende die ersten 2 staffeln, es steht 2 staffeln noch …
     * wenn ich die seite neulade kann ich staffel 3 senden, aber dann steht
     * dort 4 staffeln noch" (Daniel, 24.08.2026, an „Wickie").
     *
     * Der Serientitel schließt die Lücke: Er steht seit dem 24.08.2026 in jedem
     * gemeldeten Eintrag, und Amazon nennt ihn auf jeder Staffel-Seite gleich.
     */
    const serie = seitenTitel()
    if (serie) {
      const treffer = Object.keys(erledigt).find((k) => erledigt[k]?.serie === serie && liste[k])
      if (treffer) return treffer
    }
    return ausAdresse ?? id
  }

  /**
   * Der Listeneintrag zur aktuellen Seite — oder der Ersatz dafür.
   *
   * Steht die Seite in keiner Liste, gibt es zwei Fälle. Der Regelfall ist
   * eine Seite, die uns nichts angeht; dann bleibt der Platzhalter stehen.
   * Der zweite ist der Treffer einer **Suche**, die aus unserer Liste kam:
   * Dann steht der gemeinte Titel im Suchauftrag, und gemeldet wird unter der
   * **Suchadresse** — die kennt die Pipeline, die Titelseite nicht.
   */
  function eintragFuer(schluessel) {
    if (liste[schluessel]) return liste[schluessel]
    const auftrag = suchauftrag()
    if (auftrag) {
      return { titel: auftrag.titel, url: auftrag.suchUrl, ausSuche: true }
    }
    return { titel: null, url: `https://www.amazon.de/dp/${id}`, unbekannt: true }
  }

  listenId = listenSchluessel()
  let eintrag = eintragFuer(listenId)
  /*
    **Auf einer Suchseite gibt es nichts zu melden.**

    Der rote Knopf „✕ keine Folgen für diese Staffel — melden" stand am
    27.08.2026 auf `amazon.de/s?k=Anonymous+Noise` — einer Trefferliste ohne
    Staffel, ohne Folgen und ohne Kennung. Er kam dorthin, weil ein Auftrag
    aus der Suche als Listeneintrag gilt (3.47, damit der Sprung meldet); für
    die Suchseite selbst gilt das gerade nicht.
  */
  if (!aufSuchseite) zeigeAuftragshinweis()

  // --- Der Knopf -----------------------------------------------------------

  const knopf = document.createElement('button')
  knopf.className = 'ak-amazon-knopf'
  knopf.type = 'button'
  document.body.appendChild(knopf)


  /**
   * Gesammelt wird über die Abschnitte hinweg, nicht je Ansicht.
   *
   * Amazon zeigt lange Staffeln seitenweise („Folgen 1–24", „25–48", „49–51").
   * Im Quelltext steht immer nur der gerade gewählte Abschnitt. Wer einmal
   * meldet, meldet also einen Ausschnitt — bei „Digimon Tamers" wären das 24
   * von 51 Folgen (Daniel, 23.08.2026, mit Bild).
   *
   * Deshalb merkt sich der Knopf, was er schon gesehen hat, und zählt weiter,
   * während die Abschnitte eintreffen — gleich ob Daniel sie anklickt oder
   * `amazon-leser.js` sie nachholt.
   */
  /**
   * **Ein Zählstand gehört zu genau einer Adresse — sonst ist er keiner.**
   *
   * Daniel am 25.08.2026: „warum schmeißt du alt daten nach erkanntem wechsel
   * nicht direkt weg und hörst nur auf widget, sobald neues widget reinkommt
   * alte daten rausschmeißen, dann kann das nie passieren."
   *
   * Bis dahin wuchs `gesehen` über die Zeit und wurde aus **zwei** Quellen
   * gefüttert: aus den Widget-Antworten und aus dem Seiten-Quelltext. Der
   * Quelltext ist nach einem Staffelwechsel aber der alte (siehe CLAUDE.md),
   * und damit mischten sich zwei Stände. Dagegen wurden nacheinander sechs
   * Wächter gebaut — Ruhefristen, Signaturvergleiche, Kennungsprüfungen —, und
   * jeder einzelne behandelte ein Symptom.
   *
   * `fuerAdresse` behandelt die Ursache: Kommt eine Antwort für eine andere
   * Adresse, wird der Stand **ersetzt**, nicht ergänzt. Ein alter Stand kann
   * damit gar nicht überleben.
   */
  const leererStand = () => ({
    fuerAdresse: null,
    sprachen: new Set(),
    nummern: new Set(),
    gesamt: null,
    jeFolge: new Map(),
    /* Folgen, die hier nicht abrufbar sind — sie zählen weder mit noch dagegen. */
    gesperrt: new Map(),
    /* Wie viele Folgenabschnitte die Seite kennt und wie viele davon noch fehlen. */
    abschnitte: null,
    /* Was der Hydration-Block über die Seite selbst sagt. */
    seite: null,
  })
  let gesehen = leererStand()

  /**
   * Was der Mitleser aus den Nachlade-Antworten fischt, kommt hier an.
   *
   * Ohne diesen Weg bliebe der Knopf beim ersten Abschnitt stehen: Amazon
   * schreibt die Tonspuren nur einmal ins HTML, beim Blättern kommen sie
   * ausschließlich über das Netz (gemessen am 23.08.2026, siehe
   * `amazon-leser.js`).
   */
  /**
   * Muss **vor** dem Hörer stehen, nicht darunter.
   *
   * `let` hebt den Namen hoch, aber nicht den Wert: Ein Zugriff vor der Zeile
   * wirft `ReferenceError`. Der Hörer kann sofort feuern — der Leser schickt
   * seine erste Nachricht, während dieses Skript noch aufgebaut wird —, und
   * dann bricht der Aufbau ab: kein Takt, kein Knopf, keine Reaktion auf einen
   * Staffelwechsel (Daniel, 24.08.2026: „button hat label nie gewechselt, nie
   * versucht neue infos reinzubekommen").
   *
   * Genau dieselbe Falle steht weiter oben schon einmal beschrieben, für
   * `dialog`. Zweimal dieselbe Ursache in einer Datei heißt: Wer hier eine
   * Variable ergänzt, die ein Hörer benutzt, deklariert sie **darüber**.
   */
  let frischeStaffel = null

  /**
   * Was der Worker über gemeldete Titel weiß — die verlässliche Quelle.
   *
   * Geholt wird einmal je Seitenaufruf, im Hintergrund. Schlägt es fehl, bleibt
   * es beim lokalen Stand: Ein Abgleich, der beim ersten Netzproblem alles
   * vergisst, wäre schlechter als einer, der manchmal hinterherhinkt.
   *
   * Die Meldungen tragen die **Listen-Adresse** (`url`) und, wo sie bekannt
   * war, die Staffelnummer. Von 192 Meldungen am 24.08.2026 trugen 65 eine
   * Nummer; die übrigen sind Filme oder Einzelstaffeln, bei denen es keine
   * gibt. Wo sie fehlt, zählt die Meldung als „dieser Titel wurde gemeldet" —
   * gröber, aber nie falsch.
   */
  async function standVomWorker() {
    try {
      const { token } = await chrome.storage.sync.get('token')
      if (!token) return null
      const antwort = await fetch(`${WORKER}?token=${encodeURIComponent(token)}`)
      if (!antwort.ok) return null
      const { pruefungen } = await antwort.json()
      if (!Array.isArray(pruefungen)) return null

      const jeAdresse = {}
      for (const p of pruefungen) {
        if (p?.plattform !== 'primevideo' || typeof p.url !== 'string') continue
        // Die Kennung aus der Adresse ist der Listenschlüssel.
        const asin = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})/.exec(p.url)?.[1]
        if (!asin) continue
        const nr = p.staffel != null ? String(p.staffel) : 'ohne Nummer'
        // Dieselbe Schreibweise wie auf dem Knopf: „201" liest sich als
        // „2, Vol. 1" — siehe staffelText() in der Knopf-Logik.
        const bandNr = /^([1-9]\d?)(\d{2})$/.exec(nr)
        const angezeigt =
          bandNr && Number(bandNr[2]) > 0 ? `${bandNr[1]}, Vol. ${Number(bandNr[2])}` : nr
        const zeichen = p.befund === 'dub' ? '🇩🇪' : p.befund === 'weg' ? '✕✕' : '✕'
        jeAdresse[asin] = jeAdresse[asin] ?? { staffeln: {}, gesamt: 1, serie: null }
        jeAdresse[asin].staffeln[angezeigt] = zeichen
        if (p.titel) jeAdresse[asin].serie = p.titel
        jeAdresse[asin].gesamt = Math.max(
          jeAdresse[asin].gesamt,
          Object.keys(jeAdresse[asin].staffeln).length,
        )
      }
      return jeAdresse
    } catch {
      return null
    }
  }

  /**
   * Den Worker-Stand mit dem lokalen vereinigen.
   *
   * **In beide Richtungen**, und das ist der Punkt: Der Worker kennt, was
   * andere Browser und frühere Sitzungen gemeldet haben; der lokale Stand
   * kennt den Klick von vor zwei Sekunden. Beide sind wahr, keine Meldung wird
   * je zurückgenommen.
   *
   * `gesamt` bleibt beim lokalen Wert, wo es einen gibt: Der stammt aus
   * „N Staffeln" auf der Seite und ist genauer als die Zahl der Meldungen.
   */
  function vereinige(lokal, ausWorker) {
    if (!ausWorker) return lokal
    const zusammen = { ...lokal }
    for (const [asin, wert] of Object.entries(ausWorker)) {
      const da = zusammen[asin]
      zusammen[asin] = {
        ...wert,
        ...(da ?? {}),
        staffeln: { ...(wert.staffeln ?? {}), ...(da?.staffeln ?? {}) },
        gesamt: Math.max(da?.gesamt ?? 1, wert.gesamt ?? 1),
        serie: da?.serie ?? wert.serie ?? null,
      }
    }
    return zusammen
  }

  // Im Hintergrund abgleichen — der Knopf wartet nicht darauf.
  void (async () => {
    const ausWorker = await standVomWorker()
    if (!ausWorker) return
    erledigt = vereinige(erledigt, ausWorker)
    letzteSignatur = null
    letzterStand = ''
    uebersichtZeichnen()
  })()

  window.addEventListener('message', (e) => {
    /**
     * **Eine späte Antwort des vorigen Titels gehört nicht in diesen Zählstand.**
     *
     * Daniel hat den Wettlauf am 25.08.2026 eingekreist, und zwar durch
     * Abwarten statt durch Raten: Lädt ein Titel noch — erkennbar an Amazons
     * Abspiel-Knopf, der rund zwanzig Sekunden lang eine Ladeanimation zeigt —
     * und wechselt man in dieser Zeit, kommen dessen Nachlade-Antworten **nach**
     * dem Wechsel an. Sie landeten im frisch geleerten Zählstand des neuen
     * Titels: „13 von 24" bei Clannad, wo die dreizehn zu „Darwin Jihen"
     * gehörten. Wartete er, bis der vorige Titel fertig war, stimmten die 24.
     *
     * Das erklärt auch, warum die Fehler so sprunghaft wirkten: Sie hingen
     * daran, **wie schnell** geklickt wurde, nicht daran, welcher Titel es war.
     *
     * Der Mitleser hängt seit 1.7 an jede Meldung die Adresse, für die er
     * gelesen hat. Passt sie nicht zur jetzigen, ist die Antwort überholt —
     * und eine überholte Antwort ist schlimmer als keine.
     */
    if (
      typeof e?.data?.fuerAdresse === 'string' &&
      e.data.fuerAdresse !== location.pathname + location.search
    ) {
      return
    }
    // Ein Ereignis schlägt jede Frist: Was der Mitleser meldet, kann den Stand
    // der Seite geändert haben — dann wird der Quelltext sofort neu gelesen.
    htmlNeuLesen()
    /**
     * Eine gezielt geholte Staffel **ersetzt** den Zählstand.
     *
     * Sonst mischen sich die Folgen zweier Staffeln: Der Quelltext trägt nach
     * einem Dropdown-Wechsel weiter die alten, und die neuen kämen obendrauf.
     */
    /**
     * Die Marke steht hier als Literal — `MARKE` gehört dem Leser.
     *
     * Die beiden Skripte laufen in getrennten Welten: `amazon-leser.js` in der
     * Seitenwelt, dieses hier in der isolierten. Eine Konstante von dort ist
     * hier schlicht nicht vorhanden, und der Zugriff wirft — bei **jeder**
     * Nachricht, also bei jedem Takt. Genau das stand am 24.08.2026 in Daniels
     * Fehlerkonsole: „Uncaught ReferenceError: MARKE is not defined".
     *
     * Die Folge war die schlimmste Sorte: Der Hörer starb, die gezielt geholte
     * Staffel kam nie an, und der Knopf verlangte weiter ein Neuladen — für
     * einen Umbau, der genau das abschaffen sollte.
     *
     * Zwei Zeilen tiefer stand das Literal die ganze Zeit richtig da.
     */
    /*
      **Die Adresse entscheidet, nicht ein Flag.**

      Bis zum 25.08.2026 wurde der Stand nur geleert, wenn die Antwort
      `ersetzt: true` trug — also nur beim gezielt geholten Block. Jede andere
      Antwort kam obendrauf, auch wenn sie zu einer anderen Staffel gehörte.

      Jetzt gilt: Gehört der Stand zu einer anderen Adresse als diese Antwort,
      ist er alt und wird weggeworfen. Das deckt beide Fälle ab, den gezielten
      Abruf und die nachlaufenden Abschnitte, und braucht keinen Sonderfall.
    */
    if (e?.data?.marke === 'ak-amazon-folgen') {
      const jetzigeAdresse = e.data.fuerAdresse ?? location.pathname + location.search
      /*
        **Jede Antwort wird vermerkt, bevor sie verarbeitet wird.**

        Bei „Haikyu!!" fehlten die Folgen 3 und 4 im Zählstand (Daniel,
        27.08.2026). Ob ihre Antwort nie kam oder ankam und verworfen wurde,
        beantwortet nur diese Zeile: Der Zählstand zeigt das Ergebnis, nicht
        den Weg dorthin.
      */
      notiere('antwort', {
        fuerAdresse: jetzigeAdresse,
        standAdresse: gesehen?.fuerAdresse ?? null,
        nummern: (e.data.folgen ?? []).map((f) => f?.nummer ?? null).filter((n) => n !== null),
        anzahl: (e.data.folgen ?? []).length,
        ersetzt: Boolean(e.data.ersetzt),
      })
      if (gesehen.fuerAdresse !== jetzigeAdresse) {
        gesehen = leererStand()
        gesehen.fuerAdresse = jetzigeAdresse
        /* Sie gehören zur alten Adresse — mit ihr wandern sie weg. */
        gemeldeteSeitenKennung = null
        gemeldeterSerientitel = null
        gemeldeteStaffelNummer = null
        gemeldeterBand = null
        letzteZahl = -1
        gemeldeteStaffel = null
        letzterStand = ''
        letzterFortschritt = Date.now()
      }
      if (e.data.abschnitte) gesehen.abschnitte = e.data.abschnitte
    if (e.data.ersetzt) frischeStaffel = e.data.asin ?? null
    }
    if (e.source !== window || e.data?.marke !== 'ak-amazon-folgen') return
    // `episodeCount` aus der Nachlade-Antwort ist verlässlicher als die Zahl im
    // Seitengerüst — die steht dort für die gerade gewählte Staffel.
    if (Number.isFinite(e.data.gesamt)) gesehen.gesamt = e.data.gesamt
    // Der Leser sah die Adresse noch mit dem Verweis-Parameter.
    if (typeof e.data.startAdresse === 'string') startAdresse = e.data.startAdresse
    /*
      Was der Hydration-Block über die Seite sagt — Kennung, Serientitel,
      Staffelnummer, Gesamtzahl. Alles aus gültigem JSON, keine Muster mehr.
    */
    if (e.data.seite) {
      const s = e.data.seite
      if (s.kennung) gemeldeteSeitenKennung = s.kennung
      if (s.serie || s.titel) gemeldeterSerientitel = s.serie ?? s.titel
      if (Number.isFinite(s.staffel)) gemeldeteStaffelNummer = s.staffel
      if (s.band) gemeldeterBand = s.band
      gesehen.seite = s
    }
    for (const f of e.data.funde ?? []) {
      // Ein Fund ohne Nummer stammt aus der Rückfallebene des Mitlesers: seine
      // Sprache zählt, als **Folge** zählt er nicht. Sonst stünde am Knopf
      // wieder eine Zahl, die keine Folgen meint (der 27-von-24-Fehler).
      /*
        **Eine gesperrte Folge zählt nicht als „ohne deutsche Fassung".**

        Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 2: Zwölf der
        vierundzwanzig Folgen tragen statt eines Abspiel-Knopfes nur die
        Meldung „In deiner Region nicht mehr auf Prime Video verfügbar" — und
        ihre `audioTracks` sind **leer**. Wer sie mitzählt, meldet für die
        halbe Staffel ein Nein, das keine Quelle deckt.
      */
      if (f.verfuegbar === false) {
        gesehen.gesperrt ??= new Map()
        gesehen.gesperrt.set(f.kennung ?? f.nummer, f)
        continue
      }
      if (Number.isFinite(f.nummer)) {
        gesehen.nummern.add(f.nummer)
        /*
          Die ganze Folge, nicht zwei Felder daraus: Titel, Beschreibung,
          Laufzeit, Erscheinungsdatum, FSK, Zugänge. Der Leser liest sie aus
          gültigem JSON; sie hier wegzuwerfen hieße, sie später ein zweites Mal
          abzurufen.
        */
        gesehen.jeFolge.set(f.nummer, f.sprachen ?? [])
        gesehen.metaJeFolge ??= new Map()
        gesehen.metaJeFolge.set(f.nummer, f)
      }
      for (const s of f.sprachen ?? []) gesehen.sprachen.add(s)
    }
    zeichnen()
  })

  let letzterStand = ''
  /**
   * Wann die Zahl zuletzt gestiegen ist.
   *
   * `amazon-leser.js` holt die übrigen Abschnitte selbst nach — solange das
   * läuft, wäre „weitere Abschnitte öffnen" eine falsche Aufforderung. Bleibt
   * die Zahl aber stehen, ist das Nachholen fehlgeschlagen, und dann muss der
   * Knopf den Weg zeigen: Daniel kann die Abschnitte von Hand durchklicken.
   */
  let letzterFortschritt = Date.now()
  let letzteZahl = -1
  /** Welche Staffel gerade gemeldet wurde — hält den Knopf auf „gemeldet". */
  let gemeldeteStaffel = null
  const GEDULD_MS = 8000

  /**
   * Wie lange die Folgenzahl unverändert stehen muss, bevor sie gilt.
   *
   * Amazon tauscht beim Staffelwechsel erst das Gerüst und dann die Zahlen. In
   * diesem Fenster steht am Knopf die Zahl der **vorigen** Staffel, und wer
   * dann klickt, meldet den falschen Stand (Daniel, 24.08.2026).
   *
   * Zwei Sekunden sind großzügig für einen Austausch, der im Bruchteil davon
   * passiert — und kurz genug, dass niemand darauf wartet.
   */
  const RUHE_MS = 2000
  /**
   * Wann Warten keine Auskunft mehr ist.
   *
   * Zwölf Sekunden, weil ein Abschnitt bei Prime in zwei bis drei ankommt — wer
   * so lange nichts geschickt hat, schickt nichts mehr. Die Konstante steht hier
   * oben, weil die Signatur in `zeichnen()` sie braucht: Ohne sie dort läuft die
   * Frist ab, ohne dass jemand hinsieht.
   */
  const WARTE_FRIST_MS = 12_000

  /**
   * Wie lange ein Widerspruch zwischen Adresse und Quelltext sperren darf.
   *
   * Danach gewinnt die Adresse. Fünf Sekunden reichen für jeden Austausch, den
   * Amazon im Bruchteil davon erledigt — und sie sind kurz genug, dass niemand
   * vor einem Knopf sitzt, der sich nicht mehr rührt.
   */
  const WIDERSPRUCH_MS = 5000
  let widerspruchSeit = 0
  let gesamtGeaendertAm = 0
  /** Die Folgenzahl, die der Quelltext zuletzt nannte — für die Regel darunter. */
  let letzteQuelltextGesamt = null

  /**
   * Warum der Knopf sagt, was er sagt — beim Überfahren lesbar.
   *
   * Am 24.08.2026 stand er bei „Chaika" auf „noch 1 Staffel" und blieb dort,
   * auch über einen Staffelwechsel hinweg. Von außen war nicht zu sehen, ob er
   * die falsche Staffel meinte, den falschen Listeneintrag oder gar nicht mehr
   * lief — und ein Skript in Daniels Chrome kann ich nicht befragen.
   *
   * Statt dessen sagt er es jetzt selbst. Kein Aufwand: Die Werte liegen ohnehin
   * vor, sie standen nur nirgends.
   */
  function zustandAlsText() {
    const e = erledigt[listenId]
    return [
      `Listeneintrag: ${listenId}${liste[listenId] ? '' : ' (nicht in der Liste)'}`,
      /*
        **Was der Band heißt, steht vor dem, wonach er sortiert wird.**

        Daniel am 30.08.2026 an „Pokémon — Staffel 20 Teil 1": „tooltip sagt
        staffel 2001 adresse 2001 seite 201? evtl ist es doch richtig, aber
        liest sich komisch."

        Es war richtig und trotzdem unlesbar. 2001 und 201 sind Amazons
        **Sortierschlüssel**, keine Staffelnummern — dieselbe Beobachtung wie
        bei „Yu-Gi-Oh! ZEXAL", wo Band 1 und Band 2 derselben Staffel als 101
        und 1 nebeneinander stehen (CLAUDE.md, 25.08.2026). Der Name, den die
        Seite selbst führt, sagt dagegen genau, wo man ist.
      */
      `Staffel: ${gemeldeterBand ?? staffelSchluessel()}`,
      `  Sortierschlüssel — Adresse ${staffelAusAdresse() ?? '—'}, Seite ${staffelAusSeite() ?? '—'}`,
      `gemeldet: ${Object.keys(staffelnDerSerie(listenId)).join(', ') || '—'} von ${gesamtDerSerie(listenId)} (Amazons Staffelzählung)`,
      `Serie im Bestand: ${e?.serie ?? '—'} · Seitentitel: ${seitenTitel() ?? '—'}`,
      `Folgen: ${gesehen.nummern.size} gelesen, ${gesehen.gesamt ?? '?'} laut Seite`,
      /* Der Grund der Wiedervorlage gehoert dorthin, wo jemand nachsieht, warum
         ein laengst gemeldeter Titel wieder dasteht. */
      wiedervorlage(listenId) ? `Wiedervorlage: ${wiedervorlage(listenId)}` : '',
    ]
      .filter(Boolean)
      .join(String.fromCharCode(10))
  }

  /**
   * Gehört der Quelltext überhaupt zu der Staffel, die gerade gewählt ist?
   *
   * Amazon tauscht ihn beim Wechsel über das Auswahlfeld **nicht** aus (siehe
   * CLAUDE.md). Die Adresse wandert mit, die JSON-Fracht bleibt. Nennen beide
   * verschiedene Kennungen, gehören Folgenzahl, Tonspuren und Nummern im
   * Quelltext nachweislich zu einer **anderen** Staffel.
   *
   * Bis zum 25.08.2026 flossen sie trotzdem in den Zählstand. Das war auch
   * dann noch falsch, wenn der Mitleser die richtige Staffel längst geholt
   * hatte: Sein `ersetzt: true` leert den Stand, und der nächste Durchlauf
   * kippte die alten Folgen sofort wieder hinein — jede halbe Sekunde aufs
   * Neue. Zwei Meldungen von Daniel an einem Abend, beide mit Bild:
   *
   * - „Jackie und Jill" Staffel 3: Knopf sagte 7 Folgen, die Staffel hat 6.
   * - „Solar Impulse" Staffel 8: Knopf sagte 26, die Seite schreibt „1 Folge".
   *
   * Stimmen die Kennungen nicht überein, kommt der Zählstand deshalb
   * ausschließlich vom Mitleser. Hat der noch nichts geliefert, steht er auf
   * null, und der Knopf sagt „Tonspuren noch nicht geladen" — richtig, denn
   * dann weiß niemand etwas über diese Staffel.
   *
   * Bei einer **Sammel-ASIN** sind beide Kennungen gleich, obwohl die Staffel
   * gewechselt hat. Dagegen hilft diese Prüfung nicht — dort greift der
   * Vergleich der Staffelnummern weiter unten, der zum Neuladen auffordert.
   */
  let kennungBekanntSpeicher = null
  let kennungBekanntZu = -1
  /**
   * **Kennt der Quelltext die Kennung aus der Adresse überhaupt?**
   *
   * Der Wächter unterscheidet einen *Staffel*wechsel von einem *Titel*wechsel,
   * und das ist der Unterschied, an dem am 25.08.2026 eine Falschmeldung
   * vorbeikam: Für „My Isekai Life" (`0RNU3R7XQ7HDN1EOCZRAFD5R5R`, ein reiner
   * ADN-Kanal-Titel ohne deutschen Ton) meldete die Erweiterung neun Tonspuren
   * einschließlich Deutsch, der Knopf war grün. Die Sprachen gehörten zu „Ein
   * Stern, heller als die Sonne" (`B0FMNQMXXG`) — dem Titel, den Daniel vier
   * Sekunden zuvor gemeldet hatte.
   *
   * Gefangen hat es keiner der drei vorhandenen Prüfsteine: Die Staffelnummer
   * war in beiden Fällen dieselbe, die Folgenzahl **beide Male 12**, und ohne
   * gezielt geholten Block (`frischeStaffel === null`) fiel der Kennungsvergleich
   * ganz aus.
   *
   * **Gemessen an sechs Seitenabrufen** (25.08.2026, ohne Anmeldung):
   *
   *     eigene Seite    0RNU3R7XQ7HDN1EOCZRAFD5R5R in ihrem Quelltext    11x
   *     eigene Seite    B0FMNQMXXG in ihrem Quelltext                    91x
   *     fremder Text    0RNU3R7XQ7HDN1EOCZRAFD5R5R in B0FMNQMXXG          0x
   *     fremder Text    B0FMNQMXXG in der Isekai-Seite                    0x
   *
   * **Und die Gegenprobe, die den Sammelseiten-Fall schützt:** Die
   * GOSICK-Staffel-1-Seite (`B0B8MTPWRN`) nennt die Kennung ihrer zweiten
   * Staffel (`B0B8XVGL62`) **dreimal** — ein Staffelwechsel läuft hier also
   * nicht hinein. Der bleibt Sache von `quelltextVeraltet()`.
   *
   * Null Treffer heißt damit: Der Quelltext gehört zu einem anderen Titel.
   */
  function kennungImQuelltextBekannt() {
    const html = seitenHtml()
    if (kennungBekanntZu === htmlGelesenAm) return kennungBekanntSpeicher
    const ausAdresse = asinAusAdresse()
    /* Ohne Kennung in der Adresse gibt es nichts zu widerlegen. */
    kennungBekanntSpeicher =
      !ausAdresse || typeof html !== 'string' ? true : html.includes(ausAdresse)
    kennungBekanntZu = htmlGelesenAm
    return kennungBekanntSpeicher
  }

  function quelltextPasst() {
    /**
     * Der Beleg ist der Mitleser, nicht die Adresse.
     *
     * Erst wenn er eine Staffel **gezielt geholt** hat (`ersetzt: true` mit
     * ihrer Kennung), steht fest, dass der Quelltext zu einer anderen gehört —
     * vorher ist jede Abweichung zwischen Adresse und Quelltext harmlos: Eine
     * Sammelseite trägt im Quelltext die Sammel-Kennung und in der Adresse die
     * der Staffel, und beim ersten Laden stimmt der Quelltext trotzdem.
     *
     * `gabStaffelwechsel` taugt als Wächter nicht: Es steht schon nach dem
     * ersten Nachladen der Folgenliste auf true, weil sich dabei die
     * Staffelnummer im Quelltext von „unbekannt" auf „1" ändert.
     */
    /**
     * **Der erste Prüfstein ist die Zahl über der Folgenliste.**
     *
     * Sie wird beim Dropdown-Wechsel neu gerendert, der Quelltext nicht.
     * Nennen beide verschiedene Zahlen, gehört der Quelltext zu einer anderen
     * Staffel — und zwar auch dann, wenn die Kennung gleich geblieben ist.
     * Genau das ist der Sammel-ASIN-Fall, den kein Kennungsvergleich sieht:
     * „Solar Impulse" Staffel 8 zeigt „1 Folge", während im Quelltext noch die
     * 26 der siebten stehen (Daniel, 25.08.2026, mit Bild).
     */
    /*
      **Ein Titelwechsel macht den Quelltext wertlos — aber nicht die Seite.**

      Daniel am 25.08.2026: „wozu neuladen? die infos kommen auf die seite nach
      dem wechsel... ich sehe es doch". Er hat recht, und sein Netzwerkmitschnitt
      zeigt warum: Prime holt beim Navigieren
      `/gp/video/api/getDetailWidgets?titleID=<neue Kennung>&widgets=[EpisodeList]`
      und bekommt dort alles — `episodeCount`, je Folge `audioTracks` und
      `episodeNumber`, dazu die Tokens der übrigen Abschnitte.

      Der veraltete Quelltext ist also **kein Grund zum Neuladen**, sondern nur
      einer, ihn nicht zu lesen. `beiSeitenwechsel()` im Mitleser stößt denselben
      Abruf an; bis er ankommt, gilt der Zählstand als leer. Das ist der
      Unterschied zwischen „Seite neu laden" und „einen Moment".

      **Beide Wege müssen tragen** (Daniel, 25.08.2026): „prime ab und zu nicht
      neulädt … und manchmal neulädt". Bei einer echten Neuladung ist der
      Quelltext frisch, und die Kennung wandert mit — dann greift dieser Zweig
      gar nicht. Nur der Weg ohne Neuladen braucht ihn.
    */
    if (quelltextVeraltet()) return false
    const lautSeite = seitenLage().folgenLautSeite
    if (lautSeite) {
      /* Aus dem Hydration-Block, nicht aus dem Quelltext. */
      const imQuelltext = gesehen.seite?.folgenGesamt ?? null
      if (imQuelltext && imQuelltext !== lautSeite) return false
    }
    /*
      Der Titelwechsel wird **vor** der Sammelseiten-Ausnahme geprüft — sonst
      steigt die Funktion mit `true` aus, bevor sie ihn sehen kann.
    */
    if (!kennungImQuelltextBekannt()) return false
    if (frischeStaffel === null) return true
    const ausSeite = asinAusSeite()
    return !ausSeite || frischeStaffel === ausSeite
  }

  /**
   * Wie viele Folgen **dieser** Staffel gelesen sind.
   *
   * Eine Staffel mit dreizehn Folgen hat keine Folge 15. Steht trotzdem eine
   * im Zählstand, stammt sie aus einer anderen — der Mitleser hat sie geschickt,
   * bevor der Wechsel bemerkt war, oder der Quelltext trug sie noch. Solche
   * Nummern zählen nicht mit.
   *
   * Daniel am 25.08.2026 an „Mahouka" Staffel 2: „v90 zeigt jetzt übrigens 15
   * folgen auf button obwohl es 13 (minus 3) sind."
   *
   * Der Deckel wirkt unabhängig davon, welcher Weg die fremde Nummer
   * hereingetragen hat — und das ist der Punkt: An dieser Zahl hängt, was
   * gemeldet wird, und sie darf nicht davon abhängen, ob jede
   * Wechselerkennung rechtzeitig gegriffen hat.
   */
  function geladeneFolgen() {
    if (!gesehen.gesamt) return gesehen.nummern.size
    /*
      **Prime nummeriert bis 40 und hat 39 Folgen — die Lücke ist echt.**

      Bei „JoJo's Bizarre Adventure" Staffel 5 fehlt Folge 14; die übrigen
      tragen die Nummern 1–13 und 15–40. Gelesen wurden 38 Einträge, und der
      Knopf meldete „37 Folgen": Die Nummer 40 fiel durch die Grenze
      `nummer <= gesamt`, obwohl sie eine echte Folge bezeichnet (Daniel,
      30.08.2026).

      Die Grenze ist trotzdem richtig gedacht — sie fängt die durchlaufende
      Zählung ab, mit der Prime bei Detektiv Conan die Folgen 1146 bis 1148
      neben 149 bis 151 führt (CLAUDE.md, 25.08.2026). Dort sind es dieselben
      Folgen zweimal, hier ist es eine Lücke in der Nummerierung.

      Beides trennt die **Anzahl**, nicht die Höhe der Nummern: Gelesen ist,
      was gelesen wurde — höchstens aber so viel, wie die Staffel hat. Bei JoJo
      sind das 38 von 39, bei Detektiv Conan bleiben es die drei echten Folgen.
    */
    return Math.min(gesehen.nummern.size, gesehen.gesamt)
  }

  /**
   * **Ist die Folgenliste vollständig?**
   *
   * Entschieden wird an den **Abschnitten**, nicht an einer Zahl: Steht kein
   * Token mehr aus, gibt es nichts mehr zu holen — dann ist gezählt, was diese
   * Seite hergibt. Erst wenn die Seite gar keine Abschnitte nennt (Film, kurze
   * Staffel), entscheidet der Vergleich mit `episodeCount`.
   *
   * @param abschnitte `{ gesamt, offen }` vom Mitleser, oder `null`
   * @param gezaehlt   abrufbare plus gesperrte Folgen
   * @param gesamt     was die Seite als Folgenzahl nennt
   */
  function istVollstaendig(abschnitte, gezaehlt, gesamt, stillSeitMs = 0) {
    /*
      Die Frist steht hier drin, nicht daneben als Konstante: Die Testdatei
      `amazon-serie-hydration.test.cjs` schneidet diese Funktion einzeln aus
      der Datei heraus, und ein Bezug nach außen ist dort undefiniert.
    */
    const STILL_MS = 15_000
    /* Alle Abschnitte geholt — mehr gibt es nicht, und zwar sofort. */
    if (abschnitte && abschnitte.offen === 0) return true
    /*
      **Sonst entscheidet der Stillstand, nicht Amazons Zahl.**

      Daniel am 30.08.2026: „erst melden möglich machen nachdem alle episoden
      gesammelt wurden die amazon dort listet (nicht was wir erwarten, sondern
      tatsächliche realität)."

      Die alte Fassung verglich gegen `gesamt` — die Zahl aus dem Seitengerüst.
      Die ist bei Prime regelmäßig falsch: Sie zählt Sprachdubletten mit (15 statt
      13 bei „Infinite Dendrogram"), sie meint bei Bänden die ganze Staffel (96
      statt 48 erreichbare bei Yu-Gi-Oh ZEXAL), und sie kennt Lücken in der
      Nummerierung nicht (JoJo: 1–13 und 15–40 für 39 Folgen). Jede dieser
      Abweichungen sperrte den Knopf dauerhaft.

      Gemessen wird jetzt, was die Seite **hergibt**: Kommt fünfzehn Sekunden
      nichts mehr nach, ist gesammelt, was zu sammeln war. Beim normalen
      Nachladen tickt die Frist ständig neu, greift also nur im Stillstand.
    */
    if (gezaehlt > 0 && stillSeitMs >= STILL_MS) return true
    /*
      **Die Zahl bleibt — als Freigabe, nicht als Sperre.**

      Stimmt sie, ist sofort fertig; das ist der Normalfall und soll keine
      fünfzehn Sekunden warten. Stimmt sie nicht, hält sie nichts mehr auf, denn
      darüber entscheidet inzwischen der Stillstand. Genau das ist der
      Unterschied zur alten Fassung: Dort war sie die **einzige** Bedingung.
    */
    if (gesamt && gezaehlt >= gesamt) return true
    /* Ohne Abschnitte und ohne Erwartung ist da, was da ist. */
    if (!abschnitte && !gesamt) return gezaehlt > 0
    return false
  }


  /**
   * Setzt ein Attribut nur, wenn es sich unterscheidet.
   *
   * Daniel am 30.08.2026, mit Videomitschnitt aus dem Elements-Tab: „im element
   * tab flackern die elemente der extension, warum ist das per intervall statt
   * per eventing gemacht?"
   *
   * Der Takt war nicht die Ursache — `zeichnen()` steigt seit jeher aus, wenn
   * sich der Stand nicht geändert hat. Die Zuweisungen **davor** liefen aber
   * jedes Mal durch, allen voran `dataset.diag` mit den Taktmesswerten: vier
   * Zahlen, die sich zweimal je Sekunde ändern, in ein Attribut geschrieben,
   * das der Elements-Tab bei jeder Berührung aufblinken lässt.
   *
   * Eine Zuweisung mit gleichem Wert ist keine leere Anweisung: `textContent`
   * ersetzt den Textknoten, `dataset.x` setzt das Attribut neu, `style.x`
   * schreibt das Style-Attribut. Der Browser sieht eine Mutation, wo keine ist —
   * und jeder MutationObserver auf der Seite auch.
   */
  function setz(el, feld, wert) {
    if (el[feld] !== wert) el[feld] = wert
  }
  function setzData(el, feld, wert) {
    const text = String(wert)
    if (el.dataset[feld] !== text) el.dataset[feld] = text
  }
  function setzStil(el, feld, wert) {
    if (el.style[feld] !== wert) el.style[feld] = wert
  }


  function zeichnen() {
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
    if (jetztAufSuchseite()) {
      knopf.style.display = 'none'
      return
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
     * und der Abschnitt 25-48 gerade erst lud (Daniel, 25.08.2026).
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
      sprachen: [...gesehen.sprachen],
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
   * Ohne Folgendaten bleibt das Set: Ein Film hat keine Folgenliste, und dort
   * ist der Hydration-Block die einzige Quelle.
   */
    const deutschInFolgen = () => {
      for (const namen of gesehen.jeFolge.values()) {
        if ((namen ?? []).some((s) => /deutsch|german/i.test(s))) return true
      }
      return false
    }
    const deutsch = gesehen.jeFolge.size
      ? deutschInFolgen()
      : [...gesehen.sprachen].some((s) => /deutsch|german/i.test(s))
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
    const regionWeg =
      gesperrteFolgen > 0 || offeneFolgen > 0
        ? gesperrteFolgen > 0 && offeneFolgen === 0
        : lage.regionWeg

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
    const stand = `${deutsch}|${geladen}|${gesehen.gesamt}|${wartet}|${zahlenStehen}|${freigabeReif}`
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
     * in der liste kann ich nicht melden" (Daniel, 24.08.2026).
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
      **Ein Suchauftrag zählt wie ein Listeneintrag.** Der Knopf wurde in 3.44
      ausgeblendet, sobald der Titel nicht auf der Prüfliste steht — und genau
      das ist der Fall, für den der Sprung gebaut wurde: Die Titelseite hinter
      einer Suchadresse steht nirgends. Damit sammelte und meldete dort nichts
      mehr (Daniel, 27.08.2026: „ich hab den button im div angeklickt ‚zum anime
      springen`, dann erwarte ich das er wie vorher automatisch funktioniert").
    */
    if (!liste[listenId] && !eintrag?.ausSuche && !serieBekannt()) {
      /*
        **Weg statt grau.** Ein Knopf, der auf jeder fremden Titelseite „nicht
        auf der Prüfliste" schreibt, ist auf 99 von 100 Seiten Störung ohne
        Auskunft (Daniel, 27.08.2026: „extension elemente nicht auf anime
        anzeigen die nicht auf der liste sind"). Der Übersichts-Knopf bleibt —
        über den kommt man an die Liste.
      */
      knopf.style.display = 'none'
      return
    }
    knopf.style.display = ''

    if (!geladen) {
      /**
       * Auch eine tote Seite bleibt gemeldet, wenn sie gemeldet wurde.
       *
       * Dieser Zweig lief **vor** den Regeln weiter unten und setzte den Knopf
       * bei jedem Takt zurück auf „nicht abrufbar — melden" — Sekunden nach der
       * Meldung war er wieder anklickbar (Daniel, 24.08.2026). Auf einer
       * Fehlerseite gibt es keine geladenen Folgen, also kam der Code nie dort
       * an, wo „✓ gemeldet" steht.
       */
      const totAbgehakt = erledigt[listenId]
      if (gemeldeteStaffel !== null || Object.keys(totAbgehakt?.staffeln ?? {}).length) {
        /*
          **Gemeldet ist gemeldet — und das ist kein toter Verweis.**

          Die Farbe haengt an , und der Wert blieb hier stehen, wie
          ihn der Zustand davor hinterlassen hatte. Nach dem Melden eines Films
          mit Kauf- und Leihangebot stand deshalb ein rotes "alles gemeldet" da,
          obwohl die Meldung durchging (Daniel, 25.08.2026, Zaehler 77 auf 76).

          Rot heisst in dieser Oberflaeche "hier ist nichts mehr" — genau das
          Gegenteil dessen, was gerade passiert ist.
        */
        knopf.dataset.tot = 'false'
        knopf.textContent = '✓ alles gemeldet'
        knopf.disabled = true
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
      if (totAbgehakt?.staffeln?.[dieseStaffel]) {
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
          for (const name of film.sprachen) gesehen.sprachen.add(name)
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
      */
      if (!hatFolgenReiter && !seitenLage().folgenLautSeite && !istFilmSeite() && Date.now() - letzterFortschritt > 8000) {
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
        const wartetSeit = Date.now() - letzterFortschritt
        knopf.textContent =
          wartetSeit > 8000
            ? 'Tonspuren nicht gefunden — Seite neu laden'
            : 'Folgen werden geladen …'
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
    const wegInRegion = seitenLage().regionFolgen.length
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
    /*
      **Ist ein Teilbereich bestätigt, gilt seine Zahl.**

      Der Knopf schrieb „Folge 53–91 · 91 Folgen": Der Bereich stimmte, die
      Zahl daneben war die der ganzen Seite. Gemeldet worden wären damit 91
      Folgen für eine Staffel, die 39 hat (Daniel, 27.08.2026: „zeigt der
      button hier korrekt an? soll ich melden?" — nein, und darum nicht).
    */
    const teilLang = teilBereich ? teilBereich.bis - teilBereich.von + 1 : null
    const umfang = istFilm
      ? 'Film'
      : teilLang
        ? `${teilLang} ${teilLang === 1 ? 'Folge' : 'Folgen'} (Folge ${teilBereich.von}–${teilBereich.bis})`
      : vollstaendig
        ? `${geladen} ${geladen === 1 ? 'Folge' : 'Folgen'}`
        : regionWeg
          ? // Was fehlt, ist gesperrt — die Zahl sagt, worüber der Befund gilt.
            `${geladen} von ${gesehen.gesamt}, Rest nicht in Region`
          : `${geladen} von ${gesehen.gesamt}` +
            (wartet ? ' — lädt nach' : ' — Abschnitte selbst öffnen')
    // Eine Staffel, die wir nicht führen, wird trotzdem gemeldet — der Knopf
    // sagt es nur dazu, damit die Meldung nicht wie eine Zuordnung aussieht.
    const woher = eintrag.unbekannt ? ' · neu' : ''
    // Bei einem Kanal-Titel ist die Angabe ein Hinweis, kein Beleg.
    const kanalHinweis = ueberKanal() ? ' · ⚠ Kanal' : ''
    // Die Zugangsart gehört an den Knopf — sonst meldet man sie blind mit.
    const art = zugangsart()
    /*
      **Steht dieselbe Staffel zweimal im Angebot, gilt der Preis nur hier.**

      Bei „Mob Psycho 100 II" führte die geöffnete Seite Staffel 2 als reinen
      Kauftitel, eine zweite Ausgabe derselben Staffel lief über ein Kanal-Abo —
      gemeldet wurde „nur Kauf" (Daniel, 30.08.2026). Der Zusatz steht am Knopf,
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
     * nach paar sek steht da noch 1 staffel" (Daniel, 24.08.2026). Sein
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
     * „Gemeldet: S2 · Es fehlen: S1" direkt daneben (Daniel, 24.08.2026).
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
    const alleDurch = Boolean(abgehakt) && schonGemeldet && fertig(listenId) && !auftragOffen

    /**
     * Alles durch — dann gibt es hier nichts mehr zu tun.
     *
     * Der Knopf blieb bisher anklickbar und lud dazu ein, dieselbe Staffel
     * noch einmal zu melden (Daniel, 24.08.2026: „der button sollte zu ‚alles
     * erfolgreich gemeldet' und nicht anklickbar werden").
     */
    if (alleDurch) {
      knopf.textContent = '✓ alles gemeldet'
      knopf.disabled = true
      knopf.dataset.deutsch = String(deutsch)
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
    if (
      (schonGemeldet || gemeldeteStaffel === jetzigeStaffel) &&
      !nichtAngekommen(listenId) &&
      !wiedervorlage(listenId)
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
        Frage (Daniel, 27.08.2026: „über liste könnte zB stehen ‚bitte staffel 2
        als nächstes melden'").

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
          for (let n = 1; n <= zahl; n++) {
            if (n !== jetzigeStaffel && !fertige[String(n)]) return n
          }
          return null
        } catch {
          return null
        }
      }
      const weiterMit = offen > 0 ? naechsteOffene() : null
      knopf.textContent =
        offen > 0
          ? `✓ Staffel ${staffelText(jetzigeStaffel)} gemeldet` + (weiterMit ? ` · weiter mit Staffel ${weiterMit}` : '')
          : '✓ alles gemeldet'
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
      const fehlend = Math.max(0, gesehen.gesamt - geladen)
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
            ? `${geladen} von ${gesehen.gesamt} Folgen gelesen — ${fehlend} fehlen noch`
            : `${geladen} von ${gesehen.gesamt} Folgen gelesen — fuer „kein Deutsch" fehlen ${fehlend}`
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
      dauerhaft auf „Staffel wird geladen …" (Daniel, 25.08.2026).

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
     * die es hier nicht mehr gibt (Daniel, 24.08.2026).
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
    if (regionWeg && !vollstaendig && !deutsch) {
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
     * schreibt entsprechend „Folgen 26–105" (Daniel, 27.08.2026).
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
      es dort gibt (Daniel, 30.08.2026: „nicht was wir erwarten, sondern
      tatsächliche realität").
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
    const gelesenText = gesamtFolgen && geladen && geladen < gesamtFolgen ? ` · ${geladen} von ${gesamtFolgen} gelesen` : ''
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
      Frage (Daniel, 27.08.2026: „der melde button sollte dazuschreiben für
      welche staffel er denkt das er meldet").

      Bei einer Seite ohne Staffelwahl bleibt es weg — dort gibt es nichts zu
      verwechseln.
    */
    let staffelText2 = null
    try {
      const n = staffelNummer()
      staffelText2 = Number.isFinite(n) ? ` · Staffel ${n}` : null
    } catch {
      staffelText2 = null
    }
    /*
      **Zweimal dieselbe Zahl ist eine Zahl zu viel.**

      Am 30.08.2026 stand über JoJo Staffel 5: „✕ kein Deutsch · 38 von 39
      gelesen · 37 Folgen" — drei Zahlen für zwei Sachverhalte, und die letzten
      beiden meinten dasselbe. Nennt der Sprachstand schon, wie viel gelesen
      wurde, ist der Umfang daneben Wiederholung.

      Film und Teilbereich behalten ihren Zusatz: „Film" ist keine Zahl, und
      ein bestätigter Bereich sagt etwas anderes als die gelesene Menge.
    */
    const umfangTeil = (bereiche || gelesenText) && !istFilm && !teilLang ? '' : ' · ' + umfang
    /*
      **Wohin die Meldung geht, steht auf dem Knopf.**

      Nur bei einem Auftrag aus der Suche: Auf einer Seite, die selbst in der
      Prüfliste steht, gibt es nichts zu verwechseln. Der Titel wird gekürzt —
      der Knopf soll nicht die halbe Seite einnehmen.
    */
    const zielTitel = eintrag?.ausSuche ? (eintrag.titel ?? '') : ''
    const kurz = zielTitel.length > 38 ? zielTitel.slice(0, 36) + '…' : zielTitel
    const zielTeil = kurz ? ` · melden als „${kurz}"` : ' · melden'
    const neuerText = `${sprachStand}${umfangTeil}${staffelText2 ?? ''}${zugang}${kanalHinweis}${woher}${zielTeil}`
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

  /**
   * Amazon lädt die Folgenliste nach, nicht mit dem ersten HTML.
   *
   * Deshalb wird wiederholt nachgesehen statt einmal beim Laden — sonst stünde
   * dort dauerhaft „noch nicht geladen", obwohl die Angaben längst da sind.
   */
  zeichnen()

  /**
   * Der Staffelwechsel im Auswahlfeld ist ein Seitenwechsel ohne Neuladen.
   *
   * Amazon tauscht bei „Season 2" den ganzen Inhalt aus und schreibt eine neue
   * Kennung in die Adresse — `B0GFPBT6FG` wird zu `B0D8FH5NC6`. Ein
   * Content-Script läuft dabei **nicht** neu: Es behält seine alte Kennung,
   * seinen alten Zählstand und meldet die neue Staffel unter der alten Adresse.
   *
   * Genau das ist Daniel am 23.08.2026 passiert: „beim dropdownwechsel hat der
   * button unten rechts nicht reagiert, es stand weiterhin immer 12 folgen, und
   * der nächste eintrag der liste blieb stehen nach klick auf 12 melden."
   * Erledigt wurde dabei die **erste** Staffel — ein zweites Mal, mit deren
   * Zahlen.
   *
   * Deshalb wird die Kennung bei jedem Takt nachgesehen. Ändert sie sich, fängt
   * alles von vorn an: neuer Eintrag, leerer Zählstand, leerer Knopf.
   */
  /**
   * Woran ein Staffelwechsel erkennbar ist — die Kennung reicht nicht.
   *
   * Daniel am 23.08.2026: „nach dropdown auswahl von staffel 3 zeigt button
   * weiterhin 12 folgen, wenn ich auf staffel 3 neulade steht dort 11 folgen."
   *
   * Beim Wechsel im Auswahlfeld ändert sich **weder die Adresse noch die
   * `titleID` im Quelltext** — alle Staffeln einer Serie teilen sich beides.
   * Was sich ändert, ist die Folgenliste. Die Gesamtzahl ist der schärfste
   * Anhaltspunkt: 12 wird zu 11.
   *
   * Zwei Staffeln mit gleicher Folgenzahl bleiben damit unerkannt. Dafür ist
   * die Staffelnummer aus der Adresse da — und wo auch die schweigt, meldet
   * der Knopf wenigstens keine **falsche** Zahl, sondern die der zuletzt
   * geladenen Liste.
   */
  /**
   * Woran ein Staffelwechsel erkannt wird.
   *
   * Die Nummer aus dem Quelltext gehoert hier an die erste Stelle, und das ist
   * der Grund: Wechselt Daniel im Auswahlfeld, tauscht Amazon die Seite ohne
   * Neuladen. ASIN und Folgenzahl im Quelltext koennen dabei kurz noch die
   * alten sein -- der Wechsel blieb unbemerkt, und die Erweiterung zeigte auf
   * Staffel 1 noch die Folgenzahl von Staffel 2 (Daniel, 24.08.2026: "bei
   * barbapapa steht 55 folgen auf staffel 1 obwohl diese nur 45 folgen hat").
   *
   * Gemessen an beiden Seiten: B0CC7FXYFQ meldet Staffel 1 mit 45 Folgen,
   * B0CBNFP57W Staffel 2 mit 55. Die Nummer trennt sie sauber.
   */
  function staffelKennung() {
    /**
     * Die Folgenzahl gehört **nicht** in die Kennung.
     *
     * Sie stand hier, damit ein Wechsel auffällt, bevor ASIN und Nummer
     * nachgezogen sind. Der Preis war zu hoch: Wechselt Daniel auf den Reiter
     * „Ähnliches" oder „Details", verschwindet die Folgenliste aus dem DOM, die
     * Zahl wird zu `undefined` — und die Kennung ändert sich. Der Zählstand
     * wurde geleert, und der Knopf sagte „nicht abrufbar" für einen Titel mit
     * 24 deutschen Folgen (Daniel, 24.08.2026, an „Kanon").
     *
     * Staffelnummer und ASIN genügen. Wo beide fehlen, hilft die
     * Beruhigungsfrist in `zeichnen()`.
     */
    /**
     * **Der sichtbare Titel gehört dazu — sonst bleibt ein Titelwechsel unbemerkt.**
     *
     * Gemessen am 25.08.2026 in Daniels Sitzung, über zwei Wechsel aus der
     * Prüfliste heraus:
     *
     * | | Start | Wechsel 1 | Wechsel 2 |
     * |---|---|---|---|
     * | Adresse | `0NWGEHP4…` | `0J16B1NAB8…` | `0OULQMP5Z…` |
     * | Überschrift | Armed Girl's… | Babylon | Bayonetta |
     * | Quelltext-Kennung | `B0CJPZFQ9H` | `B0CJPZFQ9H` | `B0CJPZFQ9H` |
     *
     * Der Knopf zeigte acht Sekunden lang unverändert „🇩🇪 Deutsch · 12 Folgen
     * · ⚠ Kanal" — über drei verschiedene Titel. Er war nicht zu langsam: Seine
     * Datenquelle hat sich nie geändert.
     *
     * `asin()` allein genügt hier nicht, weil es aus der **Adresse** liest und
     * damit zwar wandert — aber der geleerte Zählstand füllt sich sofort wieder
     * aus demselben alten Quelltext. Erst der Titel macht den Widerspruch
     * sichtbar, und `quelltextVeraltet()` zieht daraus die Folgerung.
     *
     * Ein **leerer** Titel zählt nicht mit: Bei „Oshi no Ko" Staffel 3 waren
     * `og:title`, `twitter:title` und `<h1>` allesamt leer (siehe
     * `seitenTitel()`). Ohne diese Ausnahme würde jede Seite, die den Titel
     * kurzzeitig nicht rendert, den Zählstand verwerfen.
     */
    const titel = seitenTitel()
    return `${staffelAusAdresse() ?? '?'}|${staffelAusSeite() ?? '?'}|${asin()}|${titel || '?'}`
  }

  /**
   * Zeigt die Seite einen anderen Titel, als der Quelltext beschreibt?
   *
   * Amazon rendert beim Wechsel innerhalb der Anwendung den sichtbaren Inhalt
   * neu, tauscht die JSON-Fracht im Skriptblock aber nicht aus — dieselbe
   * Beobachtung wie beim Staffelwechsel, nur eine Ebene höher. Was danach aus
   * dem Quelltext gelesen wird, gehört zum **vorigen** Titel.
   *
   * Erkannt wird das an einem Paar, nicht an einer Zahl: Beim ersten Zeichnen
   * merkt sich die Erweiterung Titel und Quelltext-Kennung gemeinsam. Wandert
   * der Titel, während die Kennung stehen bleibt, ist der Quelltext veraltet.
   */
  function quelltextVeraltet() {
    // Der eindeutige Fall zuerst: gleiche Kennung in Adresse und Quelltext.
    if (quelltextGehoertZurSeite()) return false
    const titel = seitenTitel()
    const kennung = asinAusSeite()
    if (!titel || !kennung) return false
    if (!titelZuQuelltext) {
      titelZuQuelltext = { titel, kennung }
      return false
    }
    if (titelZuQuelltext.kennung !== kennung) {
      // Der Quelltext ist nachgezogen — ab hier gilt das neue Paar.
      titelZuQuelltext = { titel, kennung }
      return false
    }
    return titelZuQuelltext.titel !== titel
  }

  /**
   * **Nennen Adresse und Quelltext dieselbe Kennung, ist nichts veraltet.**
   *
   * Diese Zeile fehlte, und sie hat den Wächter darüber unbrauchbar gemacht:
   * Er merkt sich ein Paar aus Titel und Quelltext-Kennung und meldet
   * „veraltet", sobald der Titel wechselt, während die Kennung steht. Beim
   * Rendern wechselt der Titel aber auch dann, wenn alles in Ordnung ist —
   * erst ist er leer oder trägt den Shopnamen, dann den echten. Danach kam der
   * Wächter nie wieder heraus, weil sein Paar nur ein **Kennungswechsel**
   * erneuert.
   *
   * Sichtbar wurde es erst durch das Diagnosefeld (Daniel, 25.08.2026, an
   * „Clannad"): `ausSeite` und `ausAdresse` standen beide auf `B0FM2CDBWL`,
   * `quelltextVeraltet` trotzdem auf `true`. Dass es dort funktionierte, lag
   * allein am Mitleser — bei einem **Film** gibt es den nicht, und genau dort
   * erschien deshalb der Neuladen-Knopf.
   *
   * Denselben Schluss legt der Versionsvergleich nahe: Mit 1.2.2 ging es
   * nicht, mit 1.3 schon — und 1.3 hat nur die Diagnose ergänzt, keine Zeile
   * Logik. Was sich geändert hatte, war der **frisch geladene Zustand**.
   *
   * Der Vergleich hier ist der eindeutige Fall und gehört deshalb nach vorn.
   * Der Titelvergleich bleibt für den Rest: Bei einer Sammel-Kennung dürfen
   * Adresse und Quelltext auseinandergehen, ohne dass etwas veraltet ist.
   */
  function quelltextGehoertZurSeite() {
    const ausSeite = asinAusSeite()
    /*
      **asinAusAdresse(), nicht asin().**

      asin() liefert asinAusSeite() ?? asinAusAdresse() — also zuerst den
      Quelltext. Der Vergleich fragte damit zweimal dieselbe Quelle ab und war
      immer wahr; der Waechter darueber wurde wirkungslos, und der veraltete
      Quelltext galt als frisch.

      Sichtbar im Diagnosefeld (Daniel, 25.08.2026, Wechsel von Darwin Jihen zu
      Clannad): Die Adresse lautete .../detail/0FQH6UJI..., ausAdresse meldete
      trotzdem B0FZLQTT9W — die Kennung aus dem alten Quelltext. Gelesen wurden
      dessen dreizehn Folgen und neun Sprachen, obwohl Clannad nur Deutsch und
      Japanisch fuehrt.
    */
    const ausAdresse = asinAusAdresse()
    return Boolean(ausSeite && ausAdresse && ausSeite === ausAdresse)
  }

  let letzteKennung = staffelKennung()

  function beiStaffelwechsel() {
    const kennung = staffelKennung()
    if (kennung === letzteKennung) return
    notiere('staffelwechsel', { von: letzteKennung, nach: kennung, adresse: location.search })
    letzteKennung = kennung
    gabStaffelwechsel = true
    const jetzt = asin()
    if (!jetzt) {
      /* Ohne Kennung bricht der Wechsel hier ab — und genau das war unsichtbar. */
      notiere('staffelwechsel-ohne-asin', { kennung })
      return
    }
    id = jetzt
    listenId = listenSchluessel(listenId)
    eintrag = eintragFuer(listenId)
    /*
      **Das Leeren hier ist weg — es machte kaputt, was es schützen sollte.**

      Der Zählstand gehört zur Staffel, nicht zur Sitzung. Bis 2.3 leerte ihn
      `beiStaffelwechsel()` bei jedem erkannten Kennungswechsel, und das lief
      im Takt: **nach** dem Empfang der Widget-Antwort. Bei einer Sammelseite
      gehen Adress-Kennung und `titleID` im Quelltext dauerhaft auseinander —
      der Wechsel galt damit als erkannt, sobald die Antwort da war, und der
      Stand war eine Zehntelsekunde später wieder leer. Am Knopf stand
      „Tonspuren noch nicht geladen", obwohl zwölf Folgen angekommen waren.

      Seit 2.3 hängt der Stand an der Adresse (siehe `leererStand()`), und der
      Empfänger ersetzt ihn, wenn eine Antwort für eine andere kommt. Ein
      zweiter Ort, der leert, kann diese Regel nur noch brechen.

      gesehen = leererStand()
    */
    letzteZahl = -1
    gemeldeteStaffelNummer = null /* gehört zur alten Staffel, schlägt sonst die Adresse */
    gemeldeteStaffel = null
    letzterStand = ''
    letzterFortschritt = Date.now()
    /**
     * **Auch die Zustände, die an einem Titel hängen — sonst bleiben sie kleben.**
     *
     * `frischeStaffel` merkt sich die Kennung des zuletzt gezielt geholten
     * Blocks; `quelltextPasst()` verlangt in seiner letzten Zeile, dass sie zur
     * Kennung im Quelltext passt. Gesetzt wurde sie im Mitleser-Empfang,
     * geleert **nirgends** — nach einem Wechsel stand dort weiter die des
     * vorigen Titels, und damit war `quelltextPasst()` dauerhaft falsch.
     *
     * Sichtbar durch das Diagnosefeld (Daniel, 25.08.2026, nach mehreren
     * Wechseln zwischen Serien):
     *
     *     frischeStaffel: 0FQH6UJINFTOTF1LP1IH1VQ7T5   (Clannad, vorheriger Abruf)
     *     ausSeite:       B0FZLQTT9W                    (die jetzige Seite)
     *     folgen: 0, sprachen: neun Stück               (vom vorigen Titel)
     *
     * Dasselbe gilt für das Titel-Kennung-Paar in `quelltextVeraltet()`. Beide
     * gehören zum Titel, also enden sie mit ihm.
     */
    frischeStaffel = null
    titelZuQuelltext = null
    /* Hängt an der alten Adresse — mit ihr wandert er weg. */
    kennungBekanntZu = -1
    knopf.disabled = false
    zeichnen()
    // Die Übersicht hebt den gerade offenen Titel hervor — nach dem Wechsel
    // ist das ein anderer.
    uebersichtZeichnen()
  }

  /**
   * **Wie lange ein Takt wirklich braucht — gemessen, nicht geschätzt.**
   *
   * Daniel am 25.08.2026 mit einem Bildschirmmitschnitt: „it impacts
   * performance drastically". Die Frame-Analyse des Videos gab den Unterschied
   * **nicht** her — 23,4 gegen 25,8 Bildänderungen je Sekunde, und die
   * schlechtesten Werte lagen in der Phase *ohne* Erweiterung. Kein Wunder:
   * Das Maß zählt Bildänderungen, und eine ruhende Seite ändert wenig.
   *
   * Also misst die Erweiterung sich selbst. Die Werte stehen im Diagnosefeld
   * (`taktMs`, `taktSchnitt`, `taktMax`, `takte`) und beantworten die Frage,
   * die das Video nicht beantworten kann: Wie viel von den 500 ms je Takt
   * verbraucht dieses Skript?
   */
  /**
   * **Die Ecke, in der unsere Knöpfe stehen, gehört uns.**
   *
   * Prime Video vergrößert eine Ergebniskarte, sobald die Maus sie berührt,
   * und legt die aufgeklappte Fassung über alles Tieferliegende. Der Kasten
   * verschwand darunter, obwohl er den höchsten z-index trägt: Amazon hängt
   * die Aufklappung **nach** unseren Elementen ins DOM, und bei gleichem
   * z-index gewinnt das spätere.
   *
   * Dagegen hilft kein höherer Wert — 2147483647 ist das Maximum. Es hilft,
   * dass die Karte gar nicht erst aufklappt: Diese Fläche liegt über den
   * **ruhenden** Karten und fängt den Zeiger ab, bevor er sie erreicht.
   *
   * Netflix hat eine Schwester dieser Fläche, dort aber mit `z-index: 1` —
   * das ist kein Widerspruch, sondern ein anderes Problem: Bei Netflix ging
   * es um Klicks, die die Ansicht schlossen, und die Fläche musste **unter**
   * allem liegen. Hier geht es um Hover, und sie muss darüber.
   */
  /** Amazons Ergebniskarten — dieselbe Wahl wie in `suchTreffer()`. */
  const KARTE = 'article[data-testid="card"], [data-testid="card"], .tst-hover-container'

  let schutzflaeche = null

  function schutzflaecheZeigen(sichtbar) {
    if (!sichtbar) {
      schutzflaeche?.remove()
      schutzflaeche = null
      return
    }
    if (schutzflaeche) return
    schutzflaeche = document.createElement('div')
    schutzflaeche.className = 'ak-amazon-schutz'
    schutzflaeche.title = 'Anime-Kalender — Diese Ecke gehört dem Anime-Kalender'
    /*
      Zum Einstellen der Maße trug sie einen roten Rahmen — `ak-schutz-sichtbar`
      in `melder.css` gibt es weiterhin. Wer die Fläche wieder sehen will,
      hängt die Klasse hier an; sie hat drei Fehler an einem Abend gefunden
      (falsche Größe, verschluckte Klicks, und dass sie überhaupt nie da war).
    */
    /* Der Zeiger endet hier; die Karte darunter erfährt nichts davon. */
    /*
      **Alle Zeigerereignisse, nicht nur der Hover.** Die Fläche ist selbst das
      Ziel: Was hier ankommt, erreicht Amazon nicht mehr — weder ein Klick, der
      eine fremde Serie öffnet, noch die Bewegung, die eine Karte aufklappt.
      Unsere eigenen Knöpfe liegen darüber und bekommen ihre Ereignisse wie
      zuvor (Daniel, 27.08.2026: „nicht nur hover, sondern auch click area
      schutz, beides").
    */
    for (const art of [
      'mouseover',
      'mousemove',
      'mouseenter',
      'pointerover',
      'pointermove',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'contextmenu',
      'wheel',
      'touchstart',
    ]) {
      schutzflaeche.addEventListener(art, (e) => {
        e.stopPropagation()
        /* Ein Klick ins Leere soll auch nichts auslösen, was Amazon daran hängt. */
        if (art !== 'wheel') e.preventDefault()
      })
    }
    document.body.appendChild(schutzflaeche)
    schutzflaecheAnpassen()
  }

  /**
   * **Die Fläche deckt genau das ab, was gerade zu sehen ist.**
   *
   * Sie war bis 3.48 ein festes Rechteck von 400 × 360 Pixeln in der Ecke —
   * groß genug für den ausgeklappten Kasten, und damit auf jeder Seite ohne
   * Kasten viel zu groß: Dort steht nur der Knopf „115 Prime-Suchen offen",
   * und ringsum lagen vier Bildschirmzentimeter, in denen Amazons Karten
   * tot waren, ohne dass etwas von uns dort stand (Daniel, 27.08.2026, mit
   * zwei eingezeichneten Bildern: „schutz area abhängig von eingeblendeten
   * elementen").
   *
   * Jetzt wird gemessen statt geschätzt: Die Fläche ist das umschließende
   * Rechteck aller sichtbaren eigenen Elemente plus einem Rand, der den Weg
   * des Zeigers dorthin abfängt. Ein Element weniger heißt eine kleinere
   * Fläche, ganz ohne zweiten Satz Maße.
   */
  const SCHUTZ_RAND = 12

  function schutzflaecheAnpassen() {
    if (!schutzflaeche) return
    /* Der Dialog deckt sich selbst — dahinter kommt ohnehin nichts durch. */
    const eigene = [knopf, uebersichtKnopf, document.querySelector('.ak-amazon-suchhinweis')]
    let links = Infinity
    let oben = Infinity
    let rechts = -Infinity
    let unten = -Infinity
    for (const el of eigene) {
      /*
        **Nicht `offsetParent` fragen.** Alle drei Elemente stehen
        `position: fixed` — und für die liefert Chrome `offsetParent === null`,
        auch wenn sie mitten auf dem Bildschirm stehen. Die Fläche hielt sich
        deshalb seit 3.49 für überflüssig und stellte sich auf `display: none`;
        der Schutz war nie aktiv, und der rote Rahmen aus 3.50 blieb unsichtbar
        (Daniel, 27.08.2026: „keine rote umrandung sichtbar").

        Das Rechteck beantwortet die Frage direkt: Was 0 × 0 misst, ist nicht da.
      */
      if (!el?.isConnected) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      links = Math.min(links, r.left)
      oben = Math.min(oben, r.top)
      rechts = Math.max(rechts, r.right)
      unten = Math.max(unten, r.bottom)
    }
    if (links === Infinity) {
      /* Nichts von uns sichtbar — dann schützt die Fläche auch nichts. */
      setzStil(schutzflaeche, 'display', 'none')
      return
    }

    setzStil(schutzflaeche, 'display', '')
    /*
      **Zur Ecke hin bis zum Rand, nach links mit Anlauf.**

      Ein enger Rand um die eigenen Elemente genügte nicht: Amazons Karte
      klappt auf, sobald die Maus sie irgendwo berührt, und die vergrößerte
      Fassung wächst dann über den Knopf. Rechts und unten ist der
      Bildschirmrand ohnehin die Grenze; nach links braucht es den Anlaufweg,
      auf dem der Zeiger sonst eine Karte streift (Daniels Maße, 27.08.2026:
      „should go ~100px more to left, and all the way to right and bottom").

      Nach oben bleibt es beim knappen Rand — dort steht die Seite selbst, und
      eine Fläche über den halben Bildschirm nähme mehr, als sie schützt.
    */
    const ANLAUF_LINKS = 100
    setzStil(schutzflaeche, 'left', `${Math.max(0, links - ANLAUF_LINKS)}px`)
    setzStil(schutzflaeche, 'top', `${Math.max(0, oben - SCHUTZ_RAND)}px`)
    setzStil(schutzflaeche, 'right', '0px')
    setzStil(schutzflaeche, 'bottom', '0px')
    setzStil(schutzflaeche, 'width', 'auto')
    setzStil(schutzflaeche, 'height', 'auto')
  }

  function taktSchritt() {
    const t0 = performance.now()
    /*
      **Im Player zeigt die Erweiterung gar nichts.** Gesammelt wird auf der
      Übersichtsseite; im Player gibt es nichts zu lesen und nichts zu melden,
      dafür ein Bild, das niemand verdeckt haben will.
    */
    if (imPlayer()) {
      knopf.style.display = 'none'
      uebersichtKnopf.style.display = 'none'
      document.querySelector('.ak-amazon-suchhinweis')?.remove()
      schutzflaecheZeigen(false)
      return
    }
    uebersichtKnopf.style.display = ''
    schutzflaecheZeigen(true)
    /*
      **Ein Hinweiskasten einer anderen Seite wird weggeräumt und neu gebaut.**

      Prime Video wechselt ohne Neuladen; beide Hinweise entstehen aber nur
      beim Seitenaufbau. Ohne diese Zeilen bleibt der Befund der Suchseite über
      einer Titelseite stehen und behauptet dort „Anderes Werk", während der
      Melde-Weg gerade offen wäre (Daniel, 30.08.2026, an „Danmachi").

      Neu aufgebaut wird nur der Auftragshinweis: Der Suchhinweis gehört auf
      eine Trefferliste, und die erreicht man nicht per Wechsel innerhalb des
      Titelbereichs.
    */
    const alterHinweis = document.querySelector('.ak-amazon-suchhinweis')
    if (alterHinweis) {
      const andereAdresse = alterHinweis.dataset.fuerAdresse !== location.pathname + location.search
      /*
        Die Folgenzahl kommt Sekunden nach dem Seitenaufbau — und sie
        entscheidet, welchen Zweig der Auftragshinweis wählt. Ändert sie sich,
        wird er neu gebaut.
      */
      let andereFolgen = false
      try {
        andereFolgen = alterHinweis.dataset.beiFolgen !== String(gesehen?.gesamt ?? 0)
      } catch {
        /* Kein Zählstand — dann bleibt es beim Adressvergleich. */
      }
      if (andereAdresse || andereFolgen) {
        alterHinweis.remove()
        try {
          /*
            **Auf einer Suchseite baut ihn `zeigeSuchhinweis()`, sonst `zeigeAuftragshinweis()`.**

            Bis 4.1.3 stand hier nur der zweite. Auf Titelseiten genügte das, weil
            der Pfad dort die Kennung trägt und ein Wechsel die Seite neu lädt.
            Auf Suchseiten war `andereAdresse` nie wahr — der Pfad ist immer
            `/s` —, also wurde der Kasten dort nie ersetzt: Er zeigte den Auftrag
            von vorhin (Daniel, 31.08.2026).

            Seit der Vergleich die Query einschließt, greift der Zweig auch dort.
            Nur baute ihn danach niemand neu, und der Kasten war ganz weg
            („wo ist die extension?"). Beide Bauer gehören hierher.
          */
          if (location.pathname === '/s' || location.pathname.startsWith('/s/')) zeigeSuchhinweis()
          else zeigeAuftragshinweis()
        } catch {
          /* Ohne Auftrag gibt es nichts zu zeigen — der alte Kasten ist trotzdem weg. */
        }
      }
    }
    beiStaffelwechsel()
    zeichnen()
    /**
     * Auch der Uebersichts-Knopf gehoert in den Takt.
     *
     * Er wurde bisher nur beim Start und nach einer Meldung gezeichnet.
     * Stirbt die Verbindung mitten in der Sitzung -- beim Neuladen der
     * Erweiterung --, blieb dort weiter "384 Prime-Titel offen" stehen,
     * obwohl ein Klick nichts mehr bewirkt haette.
     */
    uebersichtZeichnen()
    /* Erst nach dem Zeichnen messen: vorher stehen die Elemente noch anders. */
    schutzflaecheAnpassen()
    taktMs = performance.now() - t0
    taktSumme += taktMs
    takte++
    if (taktMs > taktMax) taktMax = taktMs
    /**
     * **Der Takt hält an, sobald es nichts mehr zu tun gibt.**
     *
     * Gemessen am 25.08.2026 in Daniels Sitzung: `taktSchnitt: 226 ms` bei
     * einem Takt von 500 ms — die Erweiterung verbrauchte **45 % der Zeit**,
     * Spitze 417 ms. Der Quelltext einer Prime-Seite ist dabei **2,2 Millionen
     * Zeichen** groß, nicht die zuvor angenommene knappe Million.
     *
     * Das ist die Erklärung für „it impacts performance drastically": Nicht
     * eine teure Einzelstelle, sondern zwanzig Regex-Läufe über zwei Megabyte,
     * zweimal je Sekunde, **auch wenn längst alles gelesen ist**.
     *
     * Ist der Zählstand vollständig — alle Folgen der Staffel liegen vor —,
     * ändert weiteres Lesen nichts mehr. Der Takt geht dann auf vier Sekunden
     * und kehrt sofort zurück, sobald sich Adresse oder Zählstand ändern. Das
     * ist derselbe Gedanke, den `amazon-leser.js` mit seinem gemächlichen Modus
     * schon verfolgt.
     */
    const fertig = Boolean(gesehen.gesamt) && geladeneFolgen() >= gesehen.gesamt
    if (fertig !== langsam) {
      langsam = fertig
      clearInterval(taktGeber)
      taktGeber = setInterval(taktSchritt, langsam ? 4000 : 500)
    }
  }

  let langsam = false
  let taktGeber = setInterval(taktSchritt, 500)


  // --- Melden --------------------------------------------------------------

  knopf.addEventListener('click', async () => {
    if (!verbindungLebt()) {
      knopf.textContent = 'Erweiterung neu geladen — Seite aktualisieren'
      return
    }
    // „Nicht abrufbar" ist eine eigene Aussage, kein Sonderfall von „kein
    // Deutsch" — siehe den Kommentar am Knopf.
    /**
     * Ein Klick, bevor der Stand da ist, meldet womöglich zum zweiten Mal.
     *
     * `speicherLesen` ist asynchron; in den ersten Millisekunden nach dem Laden
     * ist `erledigt` leer, und der Knopf lädt zum Melden ein, obwohl der Titel
     * längst durch ist — „nach dem ‚alles gemeldet' neuladen erlaubt erneutes
     * melden für paar sekunden, dann springt es zurück" (Daniel, 24.08.2026).
     *
     * Gesperrt wird der **Klick**, nicht die Anzeige: Was der Knopf über
     * Sprache und Folgenzahl sagt, stimmt auch ohne den gespeicherten Stand.
     */
    /**
     * Auf den gespeicherten Stand warten, statt den Klick zu verwerfen.
     *
     * `speicherLesen` ist asynchron; in den ersten Millisekunden nach dem Laden
     * ist `erledigt` leer, und der Knopf lädt zum Melden ein, obwohl der Titel
     * längst durch ist — „nach dem ‚alles gemeldet' neuladen erlaubt erneutes
     * melden für paar sekunden, dann springt es zurück" (Daniel, 24.08.2026).
     *
     * Gewartet wird auf das Lade-Promise selbst, nicht in einer Schleife: Ein
     * Klick ist gewollt, er soll nur einen Wimpernschlag später greifen.
     */
    if (!standGeladen) {
      try {
        await standFertig
      } catch {
        /* Ohne Speicher bleibt es beim ungeprüften Stand. */
      }
      // Der Stand kann die Lage geändert haben — diese Staffel ist womöglich
      // längst gemeldet.
      if (erledigt[listenId]?.staffeln?.[staffelSchluessel()]) {
        letzterStand = ''
        zeichnen()
        return
      }
    }
    /**
     * Steht der Knopf auf „Neuladen", meldet er nicht — er lädt neu.
     *
     * Der Quelltext gehört nach einem Dropdown-Wechsel zur alten Staffel; eine
     * Meldung von hier wäre eine Meldung über die falsche Staffel. Genau das
     * ist heute mehrfach passiert.
     */
    /**
     * Mitten im Staffelwechsel wird nicht gemeldet.
     *
     * Der Zaehlstand gehoert dann noch zur vorigen Staffel, die Nummer schon
     * zur neuen -- eine Meldung von hier traegt beides zusammen und ist
     * falsch. Gefangen hat das die Zusicherung, nicht der Blick: Der Knopf war
     * zwar gesperrt, aber `disabled` haelt keinen Klick auf, der aus dem Code
     * kommt.
     */
    if (knopf.dataset.wechselt === 'true' && knopf.dataset.neuLaden !== 'true') {
      return
    }
    if (knopf.dataset.neuLaden === 'true') {
      knopf.textContent = '↻ lädt neu …'
      // Defensiv: Im Testsandkasten gibt es kein `reload`.
      if (typeof location?.reload === 'function') location.reload()
      return
    }
    htmlNeuLesen()
    const nichtAbrufbar = knopf.dataset.tot === 'true'
    const sprachen = [...gesehen.sprachen]
    const geladen = geladeneFolgen()
    // Ein toter Verweis hat naturgemaess keine Folgen -- er ist der einzige
    // Grund, hier ohne geladene Folgen weiterzugehen.
    if (!geladen && !nichtAbrufbar) return
    const deutsch = sprachen.some((s) => /deutsch|german/i.test(s))
    /**
     * **Der Umfang ist die größere der beiden Zahlen — nicht die bekanntere.**
     *
     * `gesehen.gesamt` stammt aus der Nachlade-Antwort. Bleibt sie leer, weil
     * das Nachladen scheitert, galt der Stand bisher als „vollständig" — und
     * die Sperre unten lief ins Leere. Am 25.08.2026 meldete der Knopf bei
     * „Beyblade Burst" Staffel 3 deshalb `kein Deutsch · 3 Folgen`, während die
     * Seite darüber `51 Folgen` schrieb und den Abschnitt `Folgen 1–24` offen
     * hatte. Drei gelesene Folgen, ein Nein über einundfünfzig.
     *
     * Die Seite selbst nennt ihre Folgenzahl, und diese Angabe ist unabhängig
     * davon, ob unser Nachladen funktioniert. Sie zählt deshalb mit: Was die
     * Erweiterung nicht erklären kann, darf sie nicht überstimmen.
     */
    const lautSeite = seitenLage().folgenLautSeite || 0
    const sollFolgen = Math.max(gesehen.gesamt || 0, lautSeite)
    const vollstaendig = !sollFolgen || geladen >= sollFolgen

    /**
     * Aus einem Ausschnitt entsteht **nie** ein Nein.
     *
     * „Deutsch gefunden" bleibt wahr, auch wenn erst 24 von 51 Folgen geladen
     * sind — eine deutsche Tonspur ist eine deutsche Tonspur. „Kein Deutsch"
     * dagegen wäre eine Aussage über die **ganze** Staffel, gestützt auf die
     * Hälfte davon. Genau diese Asymmetrie hat dieses Projekt an fremden
     * Quellen wiederholt bemängelt; sie gilt hier genauso.
     *
     * Deshalb: Wer nichts Deutsches gefunden hat und noch nicht durch ist,
     * bekommt keine Meldung, sondern die Aufforderung, die übrigen Abschnitte
     * zu öffnen.
     */
    // Die Sperre gilt der Aussage "kein Deutsch". "Gibt es nicht" ist eine
    // andere -- sie stuetzt sich nicht auf Folgen, sondern auf ihr Fehlen.
    if (!nichtAbrufbar && !deutsch && !vollstaendig) {
      /*
        **Der Knopf sagt jetzt, woran es liegt.**

        „erst alle 11 Folgen ansehen — sonst kein ‚kein Deutsch'" stand am
        28.08.2026 bei „Domestic Girlfriend", und Daniel fragte: „warum dieser
        error auf dem melde button?" Zwei Dinge waren daran falsch, obwohl die
        Sperre selbst richtig ist:

        - **„ansehen" klingt nach abspielen.** Gemeint ist, dass die Erweiterung
          die Tonspuren noch nicht zu allen Folgen gelesen hat.
        - **Die Zahl allein erklärt nichts.** Wer nicht weiß, wie viele schon
          gelesen sind, kann nicht einschätzen, ob Warten hilft.

        Bei einem Kanal-Titel ohne gebuchtes Abo liefert Amazon für die übrigen
        Folgen gar keine Tonspur — dann ist die Bedingung durch Warten nicht zu
        erfüllen, und das gehört dazugesagt. Die Sperre bleibt trotzdem: Ein
        „kein Deutsch" über elf Folgen, gestützt auf sieben, ist genau die
        Asymmetrie, die dieses Projekt an fremden Quellen bemängelt.
      */
      const fehlend = Math.max(0, sollFolgen - geladen)
      knopf.textContent =
        `${geladen} von ${sollFolgen} Folgen gelesen — für „kein Deutsch" fehlen ${fehlend}`
      knopf.title = ueberKanal()
        ? 'Die übrigen Folgen laufen über ein Kanal-Abo; ohne das nennt Amazon ihre ' +
          'Tonspuren nicht. Ein „kein Deutsch" über die ganze Staffel wäre damit geraten.'
        : 'Noch nicht alle Abschnitte geladen. „Deutsch gefunden" gilt sofort — ' +
          '„kein Deutsch" erst, wenn jede Folge gelesen ist.'
      setTimeout(() => {
        letzterStand = ''
        zeichnen()
      }, 4000)
      return
    }
    /**
     * Jeder Schritt sagt, dass er dran ist — und keiner darf ewig dauern.
     *
     * Am 24.08.2026 blieb der Knopf eine Minute auf „sende …" stehen. Der
     * Worker antwortet in 0,2 Sekunden (gemessen, dreimal), also hing etwas
     * davor — nur ließ sich von außen nicht sagen, was: Der Vorgang hat drei
     * Wartestellen und alle drei sahen gleich aus.
     *
     * Statt zu raten, was hängt, sagt es der Knopf. Und nach fünfzehn Sekunden
     * bricht er ab: Ein Vorgang, der so lange braucht, kommt nicht mehr, und
     * ein Knopf, der ewig „sende …" zeigt, sagt weniger als einer, der einen
     * Fehler nennt.
     */
    const mitFrist = (zusage, was) =>
      Promise.race([
        zusage,
        new Promise((_, ab) => setTimeout(() => ab(new Error(`${was} antwortet nicht`)), 15000)),
      ])

    knopf.disabled = true
    let token
    try {
      knopf.textContent = 'hole Zugangsschlüssel …'
      ;({ token } = await mitFrist(chrome.storage.sync.get('token'), 'Der Speicher'))
    } catch (err) {
      knopf.textContent = err.message
      setTimeout(() => {
        letzterStand = ''
        zeichnen()
      }, 3000)
      return
    }
    if (!token) {
      knopf.textContent = 'Kein Token — Rechtsklick aufs Symbol, dann Optionen'
      return
    }
    knopf.textContent = 'sende …'

    /**
     * **Trägt jede Folge dieselben Sprachen — oder ist die Staffel gemischt?**
     *
     * Bei „Kill Blue" (`B0GTN94C9M`) trägt Folge 1 bis 4 `["Deutsch","日本語"]`
     * und Folge 5 bis 12 nur `["日本語"]`. Bis zum 25.08.2026 wurde daraus eine
     * Meldung „🇩🇪 Deutsch · 12 Folgen" — zwölf behauptet, vier vorhanden.
     * Daniel hat es an drei Quellen unabhängig gemessen (ADN 4, Netflix 4,
     * Crunchyroll 0); Amazon selbst liefert es je Folge und liefert es richtig.
     *
     * Ist die Staffel **einheitlich**, bleibt es bei einer Meldung wie bisher —
     * sonst schwölle der Briefkasten um das Zwölffache an, ohne mehr zu sagen.
     * Nur bei **Mischung** geht eine Meldung je Folge raus, jede mit ihrer
     * eigenen `folge_nr`. Aus denen baut `fetch-pruefungen.ts` die
     * `dubRanges`; das Feld gibt es dort seit jeher, es kam nur nie etwas an.
     */
    const meldeTeile = () => {
      const karte = gesehen.jeFolge
      if (!karte || karte.size < 2) return [null]
      const hatDeutsch = (namen) => (namen ?? []).some((s) => /deutsch|german/i.test(s))
      const werte = [...karte.values()]
      const gemischt = werte.some((n) => hatDeutsch(n) !== hatDeutsch(werte[0]))
      if (!gemischt) return [null]
      return [...karte.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([nr, namen]) => ({ folgeNr: nr, sprachen: namen, deutsch: hatDeutsch(namen) }))
    }

    const teile = meldeTeile()
    if (teile.length > 1) knopf.textContent = `sende ${teile.length} Folgen …`

    try {
      let antwort
      for (const teil of teile) {
      antwort = await mitFrist(
        fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'primevideo',
          url: eintrag.url,
          /**
           * **Die Kennung der Seite, auf der wirklich gelesen wurde.**
           *
           * `url` ist die Adresse aus unserer Prüfliste — dieselbe für beide
           * Ausgaben eines Titels. Prime führt aber regelmäßig zwei: „My First
           * Girlfriend is a Gal" liegt als Kauftitel mit **11 Folgen und FSK 16**
           * (die KAZÉ-Fassung samt OVA) und über den Crunchyroll-Kanal mit
           * **10 Folgen und FSK 18**, mit völlig anderen Folgentiteln — zwei
           * Lokalisierungen, zwei Angebote (Daniel, 30.08.2026, mit Bildern).
           *
           * Ohne dieses Feld tragen beide Meldungen dieselbe Adresse, und die
           * zweite überschreibt die erste schon im Briefkasten. Die Kennung
           * stand bisher nur im Fließtext der Notiz.
           */
          seiten_kennung: (() => {
            try {
              return asin() ?? null
            } catch {
              return null
            }
          })(),
          sprachen: teil ? teil.sprachen : sprachen,
          /* Ohne Mischung bleibt das Feld leer — dann gilt der Befund der Staffel. */
          folge_nr: teil ? teil.folgeNr : undefined,
          /**
           * `dub` / `kein_dub` — nicht `ja` / `nein`.
           *
           * Die erste Fassung schickte `ja`, und der Worker antwortete mit
           * HTTP 400 (Daniel, 23.08.2026, beim ersten Klick auf „Digimon
           * Tamers"). Die gültigen Werte stehen in `worker/src/index.ts`:
           * `['dub', 'kein_dub', 'weg']`. Sie waren nachzulesen, nicht zu
           * erraten.
           */
          befund: nichtAbrufbar ? 'weg' : (teil ? teil.deutsch : deutsch) ? 'dub' : 'kein_dub',
          /**
           * Kennen wir den Titel nicht, wird er von der Seite gelesen.
           *
           * Ohne ihn wäre die Meldung nicht zuzuordnen — und eine Meldung, die
           * niemand zuordnen kann, ist keine. Amazon setzt den Serientitel in
           * `<title>`, mit angehängtem „ansehen | Prime Video" o. Ä.; der Teil
           * hinter dem senkrechten Strich fällt weg.
           */
          titel: eintrag.titel ?? seitenTitel(),
          /**
           * Die Staffelnummer aus dem Verweis-Parameter, als Zahl.
           *
           * Alle Staffeln einer Serie können sich eine ASIN teilen — bei „Oshi
           * no Ko" ist `B0GFPBT6FG` die Sammelseite für alle drei. Dann ist die
           * Nummer das Einzige, was die Staffeln auseinanderhält, und sie
           * gehört in ihr Feld statt in einen Satz.
           *
           * **Und der Quelltext ist die zweite Quelle, nicht keine.** Bis zum
           * 25.08.2026 stand hier allein `staffelAusAdresse()`. Wer eine Seite
           * öffnet, ohne im Auswahlfeld zu wechseln, hat kein `_sN` in der
           * Adresse — die Meldung ging dann ohne Nummer raus. Gemessen im
           * Briefkasten: **203 von 297** Prime-Meldungen tragen `staffel: null`,
           * und in der Übersicht liest sich das als „S ohne Nummer" neben den
           * nummerierten (Daniel, 25.08.2026, mit Bild).
           *
           * `staffelAusSeite()` liest `seasonNumber` aus dem Quelltext und
           * schließt die Lücke — aber nur, solange der Quelltext zu dieser
           * Staffel gehört. Nach einem Wechsel gehört er zur vorigen.
           *
           * Ein Film bekommt weiterhin `null`, und das ist richtig: Er hat
           * keine Staffel, und eine erfundene 1 wäre schlimmer als keine Angabe.
           */
          staffel: staffelNummer(),
          /* Nur gesetzt, wenn Prime die Staffel in Bände geteilt hat. */
          band: gemeldeterBand,
          /**
           * Wie man an den Titel kommt — im Abo, gegen Geld, oder beides.
           *
           * Der Datensatz führt 202 Amazon-Verweise mit behaupteter
           * Zugangsart „Mit Abo", die niemand geprüft hat. Diese Angabe ist
           * die einzige, die sie berichtigen kann.
           */
          zugang: zugangsart(),
          /**
           * Laeuft der Titel ueber einen fremden Kanal, ist die
           * Sprachangabe ein Hinweis und kein Beleg — siehe `ueberKanal()`.
           * Die Pipeline muss das wissen, sonst wird aus einer Vermutung
           * eine Handpruefung.
           */
          ueberKanal: ueberKanal(),
          /**
           * Die geprüfte Folgenzahl, als Zahl.
           *
           * Sie stand bisher nur in der Notiz („alle 11 Folgen geprüft") und
           * musste dort beim Auswerten wieder herausgeklaubt werden. Geschickt
           * wird die **geladene** Zahl, nicht die behauptete Gesamtzahl: Nur
           * über die reicht der Befund.
           */
          /*
            Bei einem bestätigten Teilbereich zählt seine Länge, nicht die der
            Seite: Die Meldung gilt für unseren Eintrag, nicht für Amazons Liste.
          */
          folgen: teil ? 1 : teilBereich ? teilBereich.bis - teilBereich.von + 1 : geladen,
          /**
           * Zugangsart und Abos als eigene Felder, nicht nur als Fließtext.
           *
           * Beides steht seit jeher auf dem Melde-Knopf („🇩🇪 Deutsch · 12 Folgen
           * · Kaufen oder leihen"), landete aber nur in der Notiz und musste
           * dort beim Auswerten wieder herausgeklaubt werden — derselbe Umweg,
           * den die Folgenzahl schon hinter sich hat.
           *
           * Bei Prime ist das die einzige Quelle: Kein öffentlicher Dienst nennt
           * die Zugangsart, weshalb am 24.08.2026 alle 203 Amazon-Suchadressen
           * ungeprüft „Mit Abo" trugen.
           *
           * `abos` trägt die `benefitId`-Liste. Sie unterscheidet, was von außen
           * nicht zu sehen ist: ob ein Titel Prime-eigen läuft oder über einen
           * Kanal. Bei „Kill Blue" meldete Amazon zwölf deutsche Folgen — die
           * aber nur sieht, wer das ADN-Kanal-Abo hat; ohne es sind es vier.
           */
          zugang: zugangsart(),
          abos: abos(),
         /**
           * **Die Folgen selbst — roh, ohne Deutung.**
           *
           * Bis 3.76 schickte die Meldung ein Urteil: `dub`, eine Folgenzahl, ein
           * Sprachbündel. Die Grundlage dafür — Titel, Erstausstrahlung, Laufzeit
           * je Folge — las der Leser längst aus, und die Meldung warf sie weg.
           *
           * Damit war jede spätere Frage unbeantwortbar („ist das dieselbe
           * Folge?", „gehört diese Staffel zu unserem Eintrag?"), und genau
           * deshalb musste die Erweiterung sie im Browser beantworten. Am
           * 27.08.2026 hat das neununddreißig Fassungen an einem Abend gekostet.
           *
           * Jetzt geht die Liste mit. Die Zuordnung passiert im Bau gegen TMDB —
           * dort liegen Folgentitel und Erstausstrahlungsdaten, gegen die sich
           * das abgleichen lässt.
           */
          /*
            **Unsere Titel-Kennung geht mit — sie loest die Zuordnung.**

            Gemessen am 28.08.2026: Von 67 gemeldeten Adressen liess sich
            genau eine einem Titel zuordnen. Der Bau suchte ueber die Adresse
            in `titles.streams.url`; ein Titel ohne Verweis steht dort nicht.
            Die Kennung liegt hier im Auftrag bereit und beendet das Raten.
          */
          /*
            **Die Kennung steht eine Ebene tiefer — deshalb kam nie eine an.**

            Das Feld wurde am 28.08.2026 eingebaut, damit die Zuordnung nicht
            mehr über die Adresse raten muss. Es blieb trotzdem leer: In
            `AK_OFFENE_AMAZON` trägt der äußere Eintrag Titel und Adresse, die
            AniList-Kennung steht je Werk in `eintraege[]`. Gemessen am
            31.08.2026: **0 von 21 Adressen** haben ein äußeres `id`, 19 haben
            eines in `eintraege`. Alle 795 gemeldeten Rohfolgen kamen deshalb
            mit `titel_id: null` an, und der Bau ordnete **null** davon zu.

            Genommen wird sie nur, wenn sie **eindeutig** ist: Hängen zwei
            Werke an derselben Adresse, entscheidet nicht der erste Treffer,
            sondern der Bau über die Folgentitel.
          */
          titelId: (() => {
            try {
              if (eintrag?.id != null) return eintrag.id
              const ids = [...new Set((eintrag?.eintraege ?? []).map((e) => e?.id).filter((x) => x != null))]
              if (ids.length === 1) return ids[0]
              return suchauftrag()?.id ?? null
            } catch {
              return null
            }
          })(),
          rohfolgen: [...(gesehen.metaJeFolge ?? new Map()).values()].map((f) => ({
            asin: f.kennung ?? null,
            gti: f.gti ?? null,
            nummer: f.nummer ?? null,
            titel: f.titel ?? null,
            erschienen: f.erschienen ?? null,
            dauerSek: f.dauerSek ?? null,
            sprachen: f.sprachen ?? [],
            untertitel: f.untertitel ?? [],
            staffelText: gemeldeterBand ?? null,
            staffelNr: (() => {
              try {
                return staffelNummer()
              } catch {
                return null
              }
            })(),
          })),
          /*
            Der bestätigte Ausschnitt, falls die Seite mehrere unserer Einträge
            in einer durchlaufenden Liste führt. Fehlt im Normalfall.
          */
          teil_von: teilBereich?.von ?? null,
          teil_bis: teilBereich?.bis ?? null,
          /**
           * Die Notiz sagt, worüber der Befund reicht.
           *
           * Ein Befund über 24 von 51 Folgen ist kein Befund über die Staffel.
           * Wer das später liest, muss es sehen können, ohne die Seite noch
           * einmal zu öffnen.
           */
          notiz:
            `Amazon-Seite ${asin()}: ` +
            (vollstaendig
              ? geladen === 1 && !gesehen.gesamt
                ? 'Film geprüft'
                : `alle ${geladen} ${geladen === 1 ? 'Folge' : 'Folgen'} geprüft`
              : `nur ${geladen} von ${gesehen.gesamt} Folgen geladen — Rest ungeprüft`) +
            `, Abos: ${abos().join(', ') || 'keine Angabe'}` +
            (eintrag.unbekannt ? ' — Staffel nicht im Bestand, Titel von der Seite gelesen' : '') +
            // Beide Kennungen, solange sie auseinandergehen können: Die eine
            // steht in der Adresse, die andere im Quelltext, und nur die
            // zweite meint die gezeigte Staffel.
            (asinAusAdresse() && asinAusAdresse() !== id ? `, Seitenadresse: ${asinAusAdresse()}` : '') +
            (staffelAusAdresse() ? `, laut Adresse Staffel ${staffelAusAdresse()}` : '') +
            /**
             * Die Zugangsart auch in die Notiz, nicht nur ins Feld.
             *
             * Die Tabelle im Worker hat keine Spalte dafür, und anlegen lässt
             * sie sich mit den vorhandenen Berechtigungen nicht (D1-API
             * antwortet 7403). Das Feld bleibt trotzdem im Meldekörper — es
             * schadet nicht und trägt, sobald die Spalte da ist. Bis dahin ist
             * die Notiz der Träger: `zugang=kauf` steht maschinenlesbar drin.
             */
            (zugangsart() ? `, zugang=${zugangsart()}` : '') +
            /*
              **Die Regionssperre gehört in die Meldung, auch wenn Folgen übrig sind.**

              Daniel am 31.08.2026 an „Shakugan no Shana": Die Seite trägt oben
              und unter Folge 1 „In deiner Region nicht mehr auf Prime Video
              verfügbar", die Meldung ging trotzdem als `dub` mit
              `zugang=abo_und_kauf` heraus — ohne jeden Hinweis darauf.

              Der Knopf urteilt zu Recht so: `regionWeg` gilt erst, wenn **keine**
              Folge mehr abrufbar ist (bei „Chaika" waren es 12 von 24, und die
              übrigen 12 laufen). Hier sind alle 24 lesbar, weil der Titel
              **kaufbar** bleibt — weg ist nur das Abo.

              Für die Sprachfrage ändert das nichts, für die Zugangsart schon.
              Der Vermerk steht deshalb in der Notiz, statt den Befund zu kippen:
              „deutsch" bleibt wahr, „im Abo" womöglich nicht.
            */
            (() => {
              try {
                return seitenLage().regionWeg ? ', regionsperre=laut Seite nicht mehr im Abo' : ''
              } catch {
                return ''
              }
            })() +
            /*
              Die übrigen Ausgaben derselben Suche, maschinenlesbar. Der
              Listengenerator macht daraus eigene Aufträge; ohne sie bliebe die
              zweite Ausgabe für immer ungeprüft.
            */
            (() => {
              /* Aus dem Auftrag, nicht nur aus der Variablen — sie überlebt den Sprung nicht. */
              const w = (() => {
                try {
                  return weitereAusgaben.length ? weitereAusgaben : (suchauftrag()?.weitere ?? [])
                } catch {
                  return weitereAusgaben
                }
              })()
              return w.length ? `, weitere=${w.join(',')}` : ''
            })() +
            /*
              Die Notiz trägt es maschinenlesbar mit, aus demselben Grund wie
              `zugang=`: Ohne den Vermerk sähe „kauf" im Datensatz aus wie eine
              Aussage über den Titel, und sie gilt nur für diese Ausgabe.
            */
            ((() => {
              const gleiche = ausgabenDieserStaffel()
              return gleiche > 1 ? `, ausgaben=${gleiche} (Zugangsart gilt nur für diese)` : ''
            })()) +
            (ueberKanal()
              ? ' — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
              : ''),
        }),
        }),
        'Der Anime-Kalender',
      )
      if (!antwort.ok) break
      }
      knopf.textContent = 'trage ein …'
      /**
       * Kein Zwischenstand mehr — nur Fehler werden gemeldet.
       *
       * Daniel am 24.08.2026: „angekommen auf button brauch ich auch nicht …
       * ich sehe am ‚alles gemeldet' wenn ich mit einer meldung fertig bin,
       * wenn es error oder sonstiges gibt, sollte ja nicht alles gemeldet
       * kommen." Der Erfolg zeigt sich am Ergebnis, nicht an einer Zwischenzeile.
       */
      if (!antwort.ok) knopf.textContent = `Fehler ${antwort.status}`
      /**
       * Abgehakt wird erst, wenn die Meldung wirklich angekommen ist.
       *
       * Die Liste selbst entsteht beim Datenlauf und weiß bis zum nächsten Bau
       * nichts von einer Meldung, die noch im Briefkasten liegt. Ohne diese
       * Markierung stünde jeder eben geprüfte Titel weiter obenauf — bei
       * Netflix war genau das Daniels Beschwerde („7seeds already checked but
       * still in list", 22.08.2026).
       *
       * Vermerkt wird der Befund, nicht nur ein Haken: Wer eine Seite ein
       * zweites Mal öffnet, soll sehen, was beim ersten Mal herauskam.
       */
      if (antwort.ok) {
        /**
         * Abgehakt wird **diese Staffel** unter der Listen-Kennung.
         *
         * Die Meldung trägt die Kennung aus dem Quelltext, die Liste kennt
         * nur die aus der Adresse — und ein Titel mit fünf Staffeln ist erst
         * durch, wenn alle fünf gemeldet sind.
         */
        /**
         * Der Schlüssel kommt aus dem Quelltext, nicht aus der Folgenzahl.
         *
         * `gesehen.gesamt` als letzte Rückfallebene war der Grund, warum zwei
         * gemeldete Staffeln als eine gezählt wurden: Stimmt die geladene
         * Folgenzahl zufällig überein — oder ist sie beim Wechsel noch die der
         * vorigen Staffel —, kollidieren die Schlüssel und die zweite Meldung
         * überschreibt die erste (Daniel, 24.08.2026, an Sindbad, Barbapapa
         * und Bakugan).
         *
         * Als allerletzter Ausweg steht jetzt die ASIN dort: Sie ist je
         * Staffel verschieden und kollidiert nie.
         */
        const nr = staffelSchluessel()
        /**
         * Frisch lesen, zusammenführen, schreiben — nie den eigenen Stand
         * für die Wahrheit halten.
         *
         * Jeder Tab hielt seine Kopie von `erledigt` und schrieb sie beim
         * Melden **komplett** zurück. Wer zwei Listeneinträge in zwei Tabs
         * öffnete und nacheinander meldete, verlor die erste Meldung: Der
         * zweite Tab kannte sie nicht und überschrieb sie mit seinem Stand von
         * vor dem Öffnen (Daniel, 24.08.2026).
         *
         * Der Speicher ist die gemeinsame Sache mehrerer Tabs — er wird
         * behandelt wie eine, nicht wie eine private Variable.
         */
        /**
         * Vereinigt, nicht ersetzt -- in beide Richtungen.
         *
         * Der Speicher hat, was andere Tabs gemeldet haben; `erledigt` hat,
         * was dieser Tab gemeldet hat. **Beide sind gueltig**, denn eine
         * Meldung wird nie zurueckgenommen. Wer eine Seite als Wahrheit nimmt,
         * verliert die andere -- und genau das ist zweimal passiert: erst
         * zwischen zwei Tabs, dann zwischen zwei Klicks im selben Tab, weil
         * das Schreiben nicht abgewartet wurde und der naechste Lesevorgang
         * den alten Stand sah.
         */
        const frisch = (await speicherLesen('amazonErledigt'))?.amazonErledigt ?? {}
        const zusammen = { ...frisch }
        for (const [schluessel, wert] of Object.entries(erledigt)) {
          zusammen[schluessel] = {
            ...(frisch[schluessel] ?? {}),
            ...wert,
            staffeln: { ...(frisch[schluessel]?.staffeln ?? {}), ...(wert.staffeln ?? {}) },
          }
        }
        const bisher = zusammen[listenId] ?? { staffeln: {}, gesamt: staffelZahl() }
        bisher.staffeln = { ...(bisher.staffeln ?? {}), [nr]: deutsch ? '🇩🇪' : '✕' }
        /**
         * Die Gesamtzahl wächst, sie schrumpft nicht.
         *
         * `staffelZahl()` liest „N Staffeln" aus dem Seitentext. Stand der beim
         * ersten Melden noch nicht da, kam eine 1 heraus — und jede weitere
         * Meldung schrieb sie erneut, auch wenn der Text inzwischen 2 sagte.
         * Der Knopf hielt den Titel dann für fertig (Daniel, 24.08.2026, an
         * „Barbapapa": „da steht alles gemeldet, obwohl liste sagt s1 muss noch
         * gemeldet werden").
         */
        bisher.gesamt = Math.max(staffelZahl(), bisher.gesamt ?? 1, Object.keys(bisher.staffeln).length)
        // Der Serienname, wie Amazon ihn nennt — er verbindet Listenzeilen, die
        // dieselbe Serie meinen (siehe `serienGefaehrten`).
        /**
         * Gespeichert wird der **Seitentitel**, nicht unser Listenname.
         *
         * Verglichen wird später mit `seitenTitel()` — wer hier etwas anderes
         * ablegt, findet seinen eigenen Eintrag nie wieder. Genau das ist bei
         * „Chaika" passiert (Daniel, 24.08.2026): Unsere Liste führt ihn als
         * „Hitsugi no Chaika: AVENGING BATTLE", Amazon nennt beide Staffeln
         * schlicht „Chaika". Nach dem Neuladen auf Staffel 1 passte nichts
         * zusammen, die Meldung landete unter einer fremden Kennung, und der
         * Knopf sagte weiter „noch 1 Staffel" — bei zwei gemeldeten von zwei.
         *
         * Der Listenname kommt als Rückfall dahinter: Wo Amazon keinen Titel
         * hergibt, ist er besser als nichts.
         */
        bisher.serie = seitenTitel() ?? eintrag.titel ?? bisher.serie
        erledigt = { ...zusammen, [listenId]: bisher }
        gemeldeteStaffel = nr
        // Abwarten: Der naechste Klick liest hier gleich wieder, und ohne das
        // liest er den Stand von vor dieser Meldung.
        await speicherSchreiben({ amazonErledigt: erledigt })
        /*
          **Die eigene Meldung zählt sofort, nicht erst beim nächsten Abruf.**

          `nichtAngekommen()` fragt die geholte Briefkasten-Liste, und die ist
          bis zu einer Minute alt. Direkt nach dem Melden stand die Adresse dort
          noch nicht — der Knopf ging wieder auf „melden", als wäre nichts
          geschehen (Daniel, 30.08.2026: „button ist nach meldung erneut
          klickbar"). Gemessen war die Meldung längst angekommen.

          Der Eintrag überbrückt die Zeit bis zum nächsten Abruf; danach
          entscheidet wieder der Worker. Kam sie wirklich nicht an, geht der
          Knopf dann zu Recht erneut auf.
        */
        try {
          if (briefkastenAdressen && eintrag.url) briefkastenAdressen.add(eintrag.url)
        } catch {
          /* Noch keine Auskunft vom Briefkasten — dann gibt es nichts zu ergänzen. */
        }
        /*
          **Und dieselbe Ueberbrueckung fuer die Wiedervorlage.**

          Sie steht in der Liste, bis der naechste Bau sie neu erzeugt — ohne
          diesen Merker bliebe der Knopf bis dahin offen, auch direkt nach einer
          angekommenen Meldung (Daniel, 01.09.2026: "ich hab geklickt - button
          bleibt klickbar - ist was angekommen?"). Sie war angekommen.
        */
        const grundJetzt = String(liste[listenId]?.erneut ?? '')
        if (grundJetzt) {
          wiedervorlageBeantwortet = { ...wiedervorlageBeantwortet, [listenId]: grundJetzt }
          await speicherSchreiben({ amazonWiedervorlage: wiedervorlageBeantwortet })
        }
        void briefkastenHolen(true)
        /*
          Kam der Eintrag aus einer Suche, ist die Suchadresse damit erledigt —
          der Treffer ist gefunden und gemeldet. Getrennt gespeichert, weil die
          Abhak-Liste der Titelseiten an Kennung, Staffel und Serientitel hängt
          und eine Suchadresse nichts davon hat.
        */
        /*
          **Die Suchadresse steht im Auftrag, nicht immer im Eintrag.**

          Daniel am 30.08.2026: „nach der meldung ist der eintrag weiterhin in
          der prüfliste." Sein Diagnosebericht zeigt warum — der Eintrag lautet
          `{"titel":"Danganronpa 3 … Future Arc","ausSuche":true}`, ohne `url`.
          Die Bedingung fiel durch, und abgehakt wurde nichts.

          Die Adresse gibt es trotzdem: Der Suchauftrag trägt sie als `suchUrl`
          über den Sprung von der Trefferliste auf die Titelseite hinweg.
        */
        const suchAdresse = eintrag.url ?? suchauftrag()?.suchUrl ?? null
        if (eintrag.ausSuche && suchAdresse) await suchAbhaken(suchAdresse)
        /*
          Und der Kasten verschwindet mit ihm. Er sagt „Meldung läuft unter
          diesem Titel" — nach der Meldung läuft nichts mehr, und er stand
          trotzdem weiter da (Daniel, 27.08.2026: „erfolgreich gemeldet,
          großes div muss entsprechend verschwinden").
        */
        if (eintrag.ausSuche) suchauftragVergessen()
        uebersichtZeichnen()
      }
    } catch (err) {
      knopf.textContent = `Nicht erreichbar: ${err.message}`
    }
    /**
     * „Gemeldet" bleibt stehen, bis sich etwas ändert.
     *
     * Vorher sprang der Knopf nach 2,5 Sekunden zurück auf „melden" — bei
     * einem Titel mit fünf Staffeln sah das aus, als wäre nichts passiert
     * (Daniel, 23.08.2026: „button zeigt an ich kann es nochmal melden, das
     * ‚gemeldet' sollte dort stehen bleiben").
     *
     * Zurück kommt er erst beim Staffelwechsel — dort wird
     * `gemeldeteStaffel` geleert.
     */
    setTimeout(() => {
      knopf.disabled = false
      letzterStand = ''
      zeichnen()
    }, 1200)
  })
})()
