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
  const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

  /** Die Kennung aus der Adresse — beide Formen kommen vor. */
  function asin() {
    return /\/(?:dp|detail)\/([A-Z0-9]{10})/.exec(location.pathname + location.search)?.[1] ?? null
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
  function spuren() {
    const text = document.documentElement.innerHTML
    const alle = new Set()
    const nummern = new Set()
    // Nur Tonspuren, die zu einer Folge gehören — der Abstand ist bewusst eng.
    for (const m of text.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\][\s\S]{0,240}?"episodeNumber"\s*:\s*(\d+)/g)) {
      nummern.add(Number(m[2]))
      for (const s of m[1].split(',')) {
        const name = s.trim().replace(/^"|"$/g, '')
        if (name) alle.add(name)
      }
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
    return { sprachen: [...alle], nummern, gesamt }
  }

  /** Welche Abos diese Staffel freischalten — `Prime`, `aniversede`, … */
  function abos() {
    const text = document.documentElement.innerHTML
    return [...new Set([...text.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))]
  }

  const liste = globalThis.AK_OFFENE_AMAZON ?? {}
  const id = asin()
  if (!id || !liste[id]) return // Kein Titel von unserer Liste: still bleiben.

  const eintrag = liste[id]

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
   * Deshalb merkt sich der Knopf, was er schon gesehen hat, und zählt beim
   * Wechseln des Abschnitts weiter. Daniel klickt die Abschnitte durch, der
   * Knopf füllt sich auf; gemeldet wird, was bis dahin zusammengekommen ist.
   *
   * **Bewusst nicht automatisch durchgeklickt:** Dieser Weg beruht darauf, dass
   * ein Mensch die Seite ansieht — dafür gibt es die Erweiterung überhaupt.
   * Ein Skript, das selbsttätig durch Menüs klickt, wäre wieder das, was
   * Amazons Bedingungen „Robots" nennen.
   */
  const gesehen = { sprachen: new Set(), nummern: new Set(), gesamt: null }

  let letzterStand = ''
  function zeichnen() {
    const jetzt = spuren()
    for (const s of jetzt.sprachen) gesehen.sprachen.add(s)
    for (const n of jetzt.nummern) gesehen.nummern.add(n)
    if (jetzt.gesamt) gesehen.gesamt = jetzt.gesamt

    const deutsch = [...gesehen.sprachen].some((s) => /deutsch|german/i.test(s))
    const geladen = gesehen.nummern.size
    const stand = `${deutsch}|${geladen}|${gesehen.gesamt}`
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
    const umfang = vollstaendig
      ? `${geladen} Folgen`
      : `${geladen} von ${gesehen.gesamt} — weitere Abschnitte öffnen`
    knopf.textContent = `${deutsch ? '🇩🇪 Deutsch' : '✕ kein Deutsch'} · ${umfang} · melden`
    knopf.dataset.teilweise = String(!vollstaendig)
  }

  /**
   * Amazon lädt die Folgenliste nach, nicht mit dem ersten HTML.
   *
   * Deshalb wird wiederholt nachgesehen statt einmal beim Laden — sonst stünde
   * dort dauerhaft „noch nicht geladen", obwohl die Angaben längst da sind.
   */
  zeichnen()
  setInterval(zeichnen, 500)

  // --- Melden --------------------------------------------------------------

  knopf.addEventListener('click', async () => {
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
          titel: eintrag.titel,
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
              ? `alle ${geladen} Folgen geprüft`
              : `nur ${geladen} von ${gesehen.gesamt} Folgen geladen — Rest ungeprüft`) +
            `, Abos: ${abos().join(', ') || 'keine Angabe'}`,
        }),
      })
      knopf.textContent = antwort.ok ? '✓ gemeldet' : `Fehler ${antwort.status}`
    } catch (err) {
      knopf.textContent = `Nicht erreichbar: ${err.message}`
    }
    setTimeout(() => {
      letzterStand = ''
      knopf.disabled = false
      zeichnen()
    }, 2500)
  })
})()
