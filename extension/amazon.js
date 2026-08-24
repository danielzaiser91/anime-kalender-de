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
;(() => {

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
async function speicherLesen(schluessel) {
  if (!verbindungLebt()) return null
  try {
    return await chrome.storage.local.get(schluessel)
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
    const html = document.documentElement?.innerHTML
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
   * Alle Staffeln einer Serie teilen sich eine ASIN; welche gezeigt wird,
   * steht allein im Verweis-Parameter (`?ref_=atv_dp_season_select_s3`).
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
    for (const wo of [location.search, startAdresse]) {
      const n = /[?&]ref_=[^&]*_s(\d+)/.exec(wo ?? '')?.[1]
      if (n) return Number(n)
    }
    return null
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
    const text = document.documentElement.innerHTML
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
    const gesamt =
      Number(/"episodeCount"\s*:\s*(\d+)/.exec(text)?.[1]) ||
      Number(/>\s*(\d+)\s*Folgen\s*</.exec(text)?.[1]) ||
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
      document.documentElement?.innerHTML ?? '',
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

    const html = document.documentElement?.innerHTML ?? ''
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
    const text = document.documentElement.innerHTML
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
    const text = document.documentElement.innerHTML
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
    const text = document.documentElement.innerHTML
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
  speicherLesen('amazonErledigt')
    .then((x) => {
      erledigt = x.amazonErledigt ?? {}
      uebersichtZeichnen()
    })
    .catch(() => {})

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
  function fertig(asinEintrag) {
    const e = erledigt[asinEintrag]
    if (!e) return false
    const zahl = Object.keys(e.staffeln ?? {}).length
    return zahl >= (e.gesamt ?? 1)
  }

  /** Wie weit dieser Titel ist — für die Zeile in der Liste. */
  function fortschritt(asinEintrag) {
    const e = erledigt[asinEintrag]
    if (!e) return null
    const zahl = Object.keys(e.staffeln ?? {}).length
    const gesamt = e.gesamt ?? 1
    return gesamt > 1 ? `${zahl}/${gesamt}` : (Object.values(e.staffeln ?? {})[0] ?? "✓")
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

  function dialogFuellen() {
    if (!dialog) return
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
        zeile.appendChild(marke)
      }
      inhalt.appendChild(zeile)
    }

    suche.addEventListener('input', () => {
      const q = suche.value.trim().toLowerCase()
      for (const z of inhalt.children) {
        z.style.display = !q || z.textContent.toLowerCase().includes(q) ? '' : 'none'
      }
    })
    suche.focus()
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
  if (!id) return // Gar keine Titelseite — dann gibt es nichts zu melden.

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
  function listenSchluessel() {
    const ausAdresse = asinAusAdresse()
    if (ausAdresse && liste[ausAdresse]) return ausAdresse
    if (liste[id]) return id
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

  function zeichnen() {
    const jetzt = spuren()
    for (const s of jetzt.sprachen) gesehen.sprachen.add(s)
    for (const n of jetzt.nummern) gesehen.nummern.add(n)
    if (jetzt.gesamt && !gesehen.gesamt) gesehen.gesamt = jetzt.gesamt

    const deutsch = [...gesehen.sprachen].some((s) => /deutsch|german/i.test(s))
    const geladen = gesehen.nummern.size
    if (geladen !== letzteZahl) {
      letzteZahl = geladen
      letzterFortschritt = Date.now()
    }
    const wartet = Date.now() - letzterFortschritt < GEDULD_MS
    const stand = `${deutsch}|${geladen}|${gesehen.gesamt}|${wartet}`
    if (stand === letzterStand) return
    letzterStand = stand

    knopf.dataset.deutsch = String(deutsch)
    knopf.disabled = !geladen
    if (!geladen) {
      knopf.textContent = 'Tonspuren noch nicht geladen'
      return
    }
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

    // Diese Staffel ist durch — das bleibt sichtbar, bis eine andere kommt.
    const jetzigeStaffel = String(staffelAusAdresse() ?? gesehen.gesamt ?? 1)
    if (gemeldeteStaffel === jetzigeStaffel) {
      const e = erledigt[listenId]
      const offen = (e?.gesamt ?? 1) - Object.keys(e?.staffeln ?? {}).length
      knopf.textContent = offen > 0 ? `✓ gemeldet — noch ${offen} Staffeln` : '✓ gemeldet'
      knopf.dataset.deutsch = String(deutsch)
      return
    }
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
  function staffelKennung() {
    return `${asin()}|${spuren().gesamt ?? '?'}|${staffelAusAdresse() ?? '?'}`
  }

  let letzteKennung = staffelKennung()

  function beiStaffelwechsel() {
    const kennung = staffelKennung()
    if (kennung === letzteKennung) return
    letzteKennung = kennung
    const jetzt = asin()
    if (!jetzt) return
    id = jetzt
    listenId = listenSchluessel()
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
    const sprachen = [...gesehen.sprachen]
    const geladen = gesehen.nummern.size
    if (!geladen) return
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
    if (!deutsch && !vollstaendig) {
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
          befund: deutsch ? 'dub' : 'kein_dub',
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
      knopf.textContent = antwort.ok ? '✓ gemeldet' : `Fehler ${antwort.status}`
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
        const nr = String(staffelAusAdresse() ?? gesehen.gesamt ?? 1)
        const bisher = erledigt[listenId] ?? { staffeln: {}, gesamt: staffelZahl() }
        bisher.staffeln = { ...(bisher.staffeln ?? {}), [nr]: deutsch ? '🇩🇪' : '✕' }
        bisher.gesamt = staffelZahl()
        erledigt[listenId] = bisher
        gemeldeteStaffel = nr
        void speicherSchreiben({ amazonErledigt: erledigt })
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
