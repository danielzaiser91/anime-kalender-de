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
   * 400 ms Frist: kürzer als der Takt, also sieht jeder Durchlauf frische
   * Daten, aber innerhalb eines Durchlaufs wird nur einmal gelesen.
   */
  let htmlZwischenspeicher = null
  function seitenHtml() {
    if (htmlZwischenspeicher === null) htmlZwischenspeicher = document.documentElement?.innerHTML ?? ''
    return htmlZwischenspeicher
  }
  /**
   * Zu Beginn jedes Durchlaufs weggeworfen — nicht nach einer Frist.
   *
   * Eine Frist (400 ms) war der erste Versuch und der falsche: Sie hält den
   * Quelltext auch dann fest, wenn Amazon ihn gerade ausgetauscht hat, und
   * verzögert damit genau die Erkennung, um die es hier geht. Ein Durchlauf
   * sieht jetzt einen Stand — den aktuellen — und liest ihn einmal.
   */
  function htmlNeuLesen() {
    htmlZwischenspeicher = null
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
    return /\/(?:dp|detail)\/([A-Z0-9]{10})/.exec(`${location.pathname}${location.search}`)?.[1] ?? null
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
  function asinAusSeite() {
    const html = seitenHtml()
    if (typeof html !== 'string') return null
    for (const m of html.matchAll(/titleID/g)) {
      const treffer = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10})/.exec(html.slice(m.index, m.index + 80))
      if (treffer) return treffer[1]
    }
    return null
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
  let gabStaffelwechsel = false

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
    const html = seitenHtml()
    if (typeof html !== 'string') return null
    // Im Umkreis der ersten titleID suchen — das ist die gerade gezeigte
    // Staffel. Weiter hinten stehen Empfehlungen mit fremden Nummern.
    for (const m of html.matchAll(/titleID/g)) {
      const fenster = html.slice(m.index, m.index + 900)
      if (!/titleID\\*"\s*:\s*\\*"[A-Z0-9]{10}/.test(fenster)) continue
      const n = /"seasonNumber\\*"\s*:\s*(\d+)/.exec(fenster)?.[1]
      if (n) return Number(n)
      break
    }
    // Rückfall: der Seitentitel nennt sie im Klartext.
    const ausTitel = /,\s*(?:Staffel|Season)\s*(\d+)/i.exec(document.title || '')?.[1]
    return ausTitel ? Number(ausTitel) : null
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
  function staffelSchluessel() {
    return String(staffelAusAdresse() ?? staffelAusSeite() ?? id ?? 1)
  }

  /**
   * Die Kennung zum Melden: erst die Seite, dann die Adresse.
   *
   * Die Adresse bleibt als Rückfallebene — sie stimmt, solange niemand die
   * Staffel gewechselt hat, und sie ist da, bevor der Quelltext steht.
   */
  function asin() {
    return asinAusSeite() ?? asinAusAdresse()
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

  function spuren() {
    const text = seitenHtml()
    const alle = new Set()
    const nummern = new Set()
    // Nur Tonspuren, die zu einer Folge gehören — der Abstand ist bewusst eng.
    // `[^\]]` deckt beide Formen ab: Namen wie Objekte, solange keine
    // verschachtelte Klammer dazwischenliegt.
    for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\][\s\S]{0,400}?"episodeNumber"\s*:\s*(\d+)/g)) {
      nummern.add(Number(m[2]))
      for (const name of sprachnamen(m[1])) alle.add(name)
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
      if (alle.size) nummern.add(1)
    }

    return { sprachen: [...alle], nummern, gesamt }
  }

  /**
   * Der Serientitel, wie ihn die Seite selbst nennt.
   *
   * Gebraucht für Staffeln, die unser Bestand nicht kennt — etwa solche, die
   * nur über ein Zusatzabo laufen (Daniel, 23.08.2026: „staffel 3 ist nur mit
   * aniverse anschaubar").
   */
  function seitenTitel() {
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
    const ausAuswahl = /([^<>"]{3,120}?)\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(
      seitenHtml(),
    )?.[1]
    if (ausAuswahl) {
      const sauber = saeubern(ausAuswahl)
      if (sauber) return sauber
    }

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
  function zugangsart() {
    const text = seitenHtml()
    const kauf =
      /Als Kauf-?\s*(oder Leihtitel|titel)\s*verfügbar/i.test(text) ||
      /(Folge|Staffel)\s+\d+\s+kaufen/i.test(text) ||
      /Kaufen\s+(SD|HD|UHD)\b/.test(text)
    const leihe =
      /Als Kauf- oder Leihtitel verfügbar/i.test(text) || /Leihen\s+(SD|HD|UHD)\b/.test(text)
    const abo = abos().length > 0

    if (abo && kauf) return "abo_und_kauf"
    if (abo) return "abo"
    if (kauf) return leihe ? "kauf_oder_leihe" : "kauf"
    return null
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
    const text = seitenHtml()
    const n = /(\d+)\s*Staffeln/.exec(text)?.[1]
    return n ? Number(n) : 1
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
  function ueberKanal() {
    const gefunden = abos()
    if (!gefunden.length) return false
    if (gefunden.some((a) => /^prime$/i.test(a))) return false
    const art = zugangsart()
    if (art === 'kauf' || art === 'kauf_oder_leihe') return false
    return true
  }

  /** Welche Abos diese Staffel freischalten — `Prime`, `aniversede`, … */
  function abos() {
    const text = seitenHtml()
    return [...new Set([...text.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))]
  }

  const liste = globalThis.AK_OFFENE_AMAZON ?? {}
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
  const gelesen = speicherLesen('amazonErledigt')
  // Synchron oder als Zusage — beides kommt vor, siehe `speicherLesen`.
  const standFertig = gelesen && typeof gelesen.then === 'function' ? gelesen : Promise.resolve(gelesen)
  if (gelesen && typeof gelesen.then !== 'function') {
    erledigt = gelesen.amazonErledigt ?? {}
    standGeladen = true
  }
  standFertig
    .then((x) => {
      erledigt = x?.amazonErledigt ?? {}
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
    })
    .catch(() => {
      // Ohne Speicher ist der Stand unbekannt — dann lieber melden lassen als
      // dauerhaft sperren.
      standGeladen = true
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
      if (bereich !== 'local' || !aenderungen.amazonErledigt) return
      erledigt = aenderungen.amazonErledigt.newValue ?? {}
      uebersichtZeichnen()
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
    return erledigt[asinEintrag]?.gesamt ?? 1
  }

  function fertig(asinEintrag) {
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
  function fortschritt(asinEintrag) {
    const e = erledigt[asinEintrag]
    if (!e) return null
    const staffeln = staffelnDerSerie(asinEintrag)
    const zahl = Object.keys(staffeln).length
    const gesamt = gesamtDerSerie(asinEintrag)
    return gesamt > 1 ? `${zahl}/${gesamt}` : (Object.values(staffeln)[0] ?? "✓")
  }

  const offeneZahl = () => Object.keys(liste).filter((a) => !fertig(a)).length

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

  const uebersichtKnopf = document.createElement('button')
  uebersichtKnopf.className = 'ak-uebersicht ak-amazon-uebersicht'
  uebersichtKnopf.type = 'button'
  uebersichtKnopf.addEventListener('click', dialogUmschalten)
  document.body.appendChild(uebersichtKnopf)

  function uebersichtZeichnen() {
    // Nach einem Neuladen der Erweiterung ist die Verbindung weg. Das
    // gehoert an den Knopf, sonst klickt Daniel ins Leere.
    if (!verbindungLebt()) {
      uebersichtKnopf.textContent = 'Erweiterung neu geladen — Seite aktualisieren'
      uebersichtKnopf.classList.add('ak-fertig')
      return
    }
    const offen = offeneZahl()
    uebersichtKnopf.classList.toggle('ak-fertig', !offen)
    uebersichtKnopf.textContent = offen ? `${offen} Prime-Titel offen` : 'Prime: alles geprüft'
    uebersichtKnopf.title = offen
      ? 'Liste öffnen — Seite aufrufen, warten bis der Knopf eine Zahl zeigt, klicken'
      : 'Keine offenen Prime-Titel mehr'
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
    const teile = [offeneZahl(), listenId]
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
        marke.className = fertig(asinEintrag) ? 'ak-folge ak-fertig' : 'ak-folge ak-angefasst'
        marke.textContent = stand
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

  let listenId = listenSchluessel()
  let eintrag = liste[listenId] ?? {
    titel: null,
    url: `https://www.amazon.de/dp/${id}`,
    unbekannt: true,
  }

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
  const leererStand = () => ({ sprachen: new Set(), nummern: new Set(), gesamt: null })
  let gesehen = leererStand()

  /**
   * Was der Mitleser aus den Nachlade-Antworten fischt, kommt hier an.
   *
   * Ohne diesen Weg bliebe der Knopf beim ersten Abschnitt stehen: Amazon
   * schreibt die Tonspuren nur einmal ins HTML, beim Blättern kommen sie
   * ausschließlich über das Netz (gemessen am 23.08.2026, siehe
   * `amazon-leser.js`).
   */
  window.addEventListener('message', (e) => {
    /**
     * Eine gezielt geholte Staffel **ersetzt** den Zählstand.
     *
     * Sonst mischen sich die Folgen zweier Staffeln: Der Quelltext trägt nach
     * einem Dropdown-Wechsel weiter die alten, und die neuen kämen obendrauf.
     */
    if (e?.data?.marke === MARKE && e.data.ersetzt) {
      gesehen = leererStand()
      letzteZahl = -1
      gemeldeteStaffel = null
      letzterStand = ''
      letzterFortschritt = Date.now()
      frischeStaffel = e.data.asin ?? null
    }
    if (e.source !== window || e.data?.marke !== 'ak-amazon-folgen') return
    // `episodeCount` aus der Nachlade-Antwort ist verlässlicher als die Zahl im
    // Seitengerüst — die steht dort für die gerade gewählte Staffel.
    if (Number.isFinite(e.data.gesamt)) gesehen.gesamt = e.data.gesamt
    // Der Leser sah die Adresse noch mit dem Verweis-Parameter.
    if (typeof e.data.startAdresse === 'string') startAdresse = e.data.startAdresse
    for (const f of e.data.funde ?? []) {
      // Ein Fund ohne Nummer stammt aus der Rückfallebene des Mitlesers: seine
      // Sprache zählt, als **Folge** zählt er nicht. Sonst stünde am Knopf
      // wieder eine Zahl, die keine Folgen meint (der 27-von-24-Fehler).
      if (Number.isFinite(f.nummer)) gesehen.nummern.add(f.nummer)
      for (const s of f.sprachen) gesehen.sprachen.add(s)
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
   * Wie lange ein Widerspruch zwischen Adresse und Quelltext sperren darf.
   *
   * Danach gewinnt die Adresse. Fünf Sekunden reichen für jeden Austausch, den
   * Amazon im Bruchteil davon erledigt — und sie sind kurz genug, dass niemand
   * vor einem Knopf sitzt, der sich nicht mehr rührt.
   */
  const WIDERSPRUCH_MS = 5000
  let widerspruchSeit = 0

  /** Für welche ASIN der Leser die Folgenliste zuletzt gezielt geholt hat. */
  let frischeStaffel = null
  let gesamtGeaendertAm = 0

  function zeichnen() {
    htmlNeuLesen()
    const jetzt = spuren()
    for (const s of jetzt.sprachen) gesehen.sprachen.add(s)
    for (const n of jetzt.nummern) gesehen.nummern.add(n)
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
    if (jetzt.gesamt && jetzt.gesamt !== gesehen.gesamt) {
      if (gesehen.gesamt) {
        /**
         * Nur ein **Wechsel** löst die Beruhigungsfrist aus, nicht das erste
         * Setzen. Beim Seitenaufbau ist die Zahl vorher schlicht unbekannt —
         * da gibt es keine alte, die noch dastehen könnte.
         */
        gesamtGeaendertAm = Date.now()
        gesehen.sprachen = new Set(jetzt.sprachen)
        gesehen.nummern = new Set(jetzt.nummern)
        gemeldeteStaffel = null
      }
      gesehen.gesamt = jetzt.gesamt
    }

    const deutsch = [...gesehen.sprachen].some((s) => /deutsch|german/i.test(s))
    const geladen = gesehen.nummern.size
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
    const seitentext = `${document.body?.innerText ?? ''} ${seitenHtml()}`
    const fehlerseite = /keine funktionsf(?:ä|ae)hige Seite|Suchen Sie etwas?/i.test(seitentext)

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
    const regionWeg = /In deiner Region nicht mehr auf Prime Video verf(?:ü|ue)gbar/i.test(seitentext)
    const stoerung = /Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten/i.test(seitentext)
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
    const stand = `${deutsch}|${geladen}|${gesehen.gesamt}|${wartet}|${zahlenStehen}`
    if (stand === letzterStand) return
    letzterStand = stand

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
        knopf.textContent = '✓ alles gemeldet'
        knopf.disabled = true
        return
      }
      if (stoerung) {
        // Eine Störung ist kein Befund — hier wird nicht gemeldet.
        knopf.dataset.tot = 'false'
        knopf.disabled = true
        knopf.textContent = 'Amazon meldet einen Fehler — Seite neu laden'
        return
      }
      knopf.dataset.tot = String(regionWeg || !wartet)
      knopf.disabled = false
      knopf.textContent = regionWeg
        ? '✕ in dieser Region nicht mehr verfügbar — melden'
        : wartet
          ? 'Tonspuren noch nicht geladen'
          : '✕ nicht abrufbar — melden'
      if (!regionWeg && wartet) knopf.disabled = true
      return
    }
    knopf.dataset.tot = 'false'
    const vollstaendig = !gesehen.gesamt || geladen >= gesehen.gesamt
    // Die Zahl sagt, worüber der Befund wirklich etwas aussagt — nie mehr.
    /**
     * Ein Film ist keine Folge.
     *
     * „1 Folgen" stand am Knopf bei „Sing a Bit of Harmony" (Daniel,
     * 23.08.2026, mit Bild) — falsch in beidem: Es ist keine Serie, und der
     * Plural stimmt auch nicht. Erkannt wird der Film daran, dass die Seite
     * keine Folgenzahl nennt und genau eine Einheit gezählt wurde.
     */
    const istFilm = !gesehen.gesamt && geladen === 1
    const umfang = istFilm
      ? 'Film'
      : vollstaendig
      ? `${geladen} ${geladen === 1 ? 'Folge' : 'Folgen'}`
      : `${geladen} von ${gesehen.gesamt}` + (wartet ? ' — lädt nach' : ' — Abschnitte selbst öffnen')
    // Eine Staffel, die wir nicht führen, wird trotzdem gemeldet — der Knopf
    // sagt es nur dazu, damit die Meldung nicht wie eine Zuordnung aussieht.
    const woher = eintrag.unbekannt ? ' · neu' : ''
    // Bei einem Kanal-Titel ist die Angabe ein Hinweis, kein Beleg.
    const kanalHinweis = ueberKanal() ? ' · ⚠ Kanal' : ''
    // Die Zugangsart gehört an den Knopf — sonst meldet man sie blind mit.
    const art = zugangsart()
    const zugang = art && art !== 'abo' ? ` · ${ZUGANG_TEXT[art]}` : ''

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
    const alleDurch = Boolean(abgehakt) && schonGemeldet && fertig(listenId)

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
    if (schonGemeldet || gemeldeteStaffel === jetzigeStaffel) {
      const offen = gesamtDerSerie(listenId) - Object.keys(staffelnDerSerie(listenId)).length
      /**
       * Kein „gemeldet" mehr — es zählt, was noch fehlt.
       *
       * Daniel am 24.08.2026: „gemeldet kann weg, dafür gibt es alles gemeldet
       * bzw staffel fehlt noch." Der Zwischenzustand sagte, was gerade
       * geschehen ist; die Frage beim Weiterarbeiten ist aber, was noch offen
       * ist. Zwei Zustände genügen: alles durch, oder N fehlen.
       */
      knopf.textContent =
        offen > 0 ? `noch ${offen} ${offen === 1 ? 'Staffel' : 'Staffeln'}` : '✓ alles gemeldet'
      knopf.disabled = true
      knopf.dataset.deutsch = String(deutsch)
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
    const veraltet = Boolean(
      staffelLautAdresse && staffelLautSeite && staffelLautAdresse !== staffelLautSeite,
    )
    /**
     * Seit 0.73 wird die Staffel geholt, statt zum Neuladen aufzufordern.
     *
     * Der Leser fragt die Folgenliste mit der ASIN aus der Adresse ab — die
     * wandert beim Dropdown-Wechsel mit, anders als der Quelltext. Solange das
     * läuft, wartet der Knopf; kommt nichts, bleibt das Neuladen als Ausweg.
     */
    if (veraltet && frischeStaffel !== asinAusAdresse()) {
      const wartetAufStaffel = Date.now() - widerspruchSeit < WIDERSPRUCH_MS
      knopf.disabled = wartetAufStaffel
      knopf.dataset.neuLaden = String(!wartetAufStaffel)
      knopf.textContent = wartetAufStaffel
        ? 'Staffel wird geladen …'
        : '↻ hier klicken zum Neuladen'
      knopf.dataset.deutsch = 'false'
      return
    }
    knopf.dataset.neuLaden = 'false'

    if (!zahlenStehen) {
      knopf.disabled = true
      knopf.textContent = 'Staffel wechselt — einen Moment'
      knopf.dataset.deutsch = String(deutsch)
      return
    }
    if (!vollstaendig) {
      knopf.disabled = true
      knopf.textContent = wartet
        ? `${deutsch ? '🇩🇪' : '·'} ${geladen} von ${gesehen.gesamt} — lädt nach`
        : `${geladen} von ${gesehen.gesamt} — Abschnitte selbst öffnen`
      knopf.dataset.deutsch = String(deutsch)
      return
    }
    knopf.disabled = false
    knopf.textContent = `${deutsch ? '🇩🇪 Deutsch' : '✕ kein Deutsch'} · ${umfang}${zugang}${kanalHinweis}${woher} · melden`
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
    return `${staffelAusAdresse() ?? '?'}|${staffelAusSeite() ?? '?'}|${asin()}`
  }

  let letzteKennung = staffelKennung()

  function beiStaffelwechsel() {
    const kennung = staffelKennung()
    if (kennung === letzteKennung) return
    letzteKennung = kennung
    gabStaffelwechsel = true
    const jetzt = asin()
    if (!jetzt) return
    id = jetzt
    listenId = listenSchluessel(listenId)
    eintrag = liste[listenId] ?? {
      titel: null,
      url: `https://www.amazon.de/dp/${id}`,
      unbekannt: true,
    }
    // Der Zählstand gehört zur Staffel, nicht zur Sitzung. Ohne das Leeren
    // trüge Staffel 2 die Folgen von Staffel 1 mit.
    gesehen = leererStand()
    letzteZahl = -1
    gemeldeteStaffel = null
    letzterStand = ''
    letzterFortschritt = Date.now()
    knopf.disabled = false
    zeichnen()
    // Die Übersicht hebt den gerade offenen Titel hervor — nach dem Wechsel
    // ist das ein anderer.
    uebersichtZeichnen()
  }

  setInterval(() => {
    htmlNeuLesen()
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
  }, 500)

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
    if (knopf.dataset.neuLaden === 'true') {
      knopf.textContent = '↻ lädt neu …'
      // Defensiv: Im Testsandkasten gibt es kein `reload`.
      if (typeof location?.reload === 'function') location.reload()
      return
    }
    htmlNeuLesen()
    const nichtAbrufbar = knopf.dataset.tot === 'true'
    const sprachen = [...gesehen.sprachen]
    const geladen = gesehen.nummern.size
    // Ein toter Verweis hat naturgemaess keine Folgen -- er ist der einzige
    // Grund, hier ohne geladene Folgen weiterzugehen.
    if (!geladen && !nichtAbrufbar) return
    const deutsch = sprachen.some((s) => /deutsch|german/i.test(s))
    const vollstaendig = !gesehen.gesamt || geladen >= gesehen.gesamt

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
      knopf.textContent = `erst alle ${gesehen.gesamt} Folgen ansehen — sonst kein „kein Deutsch"`
      setTimeout(() => {
        letzterStand = ''
        zeichnen()
      }, 4000)
      return
    }
    knopf.textContent = 'sende …'
    knopf.disabled = true
    const { token } = await chrome.storage.sync.get('token')
    if (!token) {
      knopf.textContent = 'Kein Token — Rechtsklick aufs Symbol, dann Optionen'
      return
    }
    try {
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'primevideo',
          url: eintrag.url,
          sprachen,
          /**
           * `dub` / `kein_dub` — nicht `ja` / `nein`.
           *
           * Die erste Fassung schickte `ja`, und der Worker antwortete mit
           * HTTP 400 (Daniel, 23.08.2026, beim ersten Klick auf „Digimon
           * Tamers"). Die gültigen Werte stehen in `worker/src/index.ts`:
           * `['dub', 'kein_dub', 'weg']`. Sie waren nachzulesen, nicht zu
           * erraten.
           */
          befund: nichtAbrufbar ? 'weg' : deutsch ? 'dub' : 'kein_dub',
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
           */
          staffel: staffelAusAdresse(),
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
          folgen: geladen,
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
            (ueberKanal()
              ? ' — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
              : ''),
        }),
      })
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
