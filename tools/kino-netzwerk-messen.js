/**
 * Woher holt kinoheld die Vorstellungen — und steht die Sprachfassung dabei?
 *
 * ## Warum dieses Skript
 *
 * Der Kalender führt Kinostarts (`platform: 'kino'`), aber bei zweien steht
 * „die Sprachfassungen sind unbestätigt". Daniel am 25.08.2026: In seinem Kino
 * läuft „Detektiv Conan Film 29" um 17 Uhr auf **Deutsch**, später am Tag als
 * **OmU**. Genau diese Unterscheidung ist die Trennlinie dieses Projekts.
 *
 * Gemessen ist bisher:
 *
 * - **TMDB** bestätigt den Kinostart (25.08.2026, Typ 3), aber `iso_639_1` und
 *   `note` sind leer — keine Sprachfassung.
 * - **kinoheld** kennzeichnet sie sehr wohl: Im Nuxt-Payload der Filmseite
 *   stehen `languageFlags` mit `deutsch` und `OmU`. Das ist aber nur die
 *   **Filterliste**; Uhrzeiten stehen im ausgelieferten HTML keine (null
 *   Treffer für `"HH:MM"` und für Zeitstempel).
 * - `kinoheld.de/robots.txt` sperrt `/ajax/`, `/payment/`, `/user/`. Kein
 *   `Disallow: /`, keine namentliche Bot-Sperre.
 *
 * **Offen ist genau eine Frage:** Über welchen Pfad kommen die Vorstellungen?
 * Liegt er unter `/ajax/`, ist er gesperrt und der Weg endet hier. Liegt er
 * woanders, ist er erlaubt — und dann liefert er die Sprachfassung gleich mit.
 *
 * Diese Frage kann nur ein Mensch am eigenen Browser beantworten, deshalb
 * dieses Skript.
 *
 * ## So wird gemessen
 *
 * 1. Diese Datei öffnen, den **ganzen** Inhalt kopieren.
 * 2. Im Browser eine kinoheld-Filmseite öffnen, zum Beispiel:
 *    https://www.kinoheld.de/film/detektiv-conan-film-29-der-gefallene-engel-des-highways
 * 3. F12 → Konsole → einfügen → Enter. Es kommt „Messung läuft".
 * 4. **Auf der Seite eine Stadt oder ein Kino auswählen**, sodass Spielzeiten
 *    erscheinen. Genau dabei lädt die Seite nach.
 * 5. `akKino()` in die Konsole tippen. Die Tabelle zeigt jeden Abruf mit Pfad,
 *    Größe und ob „OmU"/„deutsch" in der Antwort vorkommen.
 *
 * Nichts wird gesendet, nichts gespeichert — das Skript liest nur mit.
 */
;(() => {
  if (window.__akKinoLaeuft) {
    console.log('Messung läuft bereits — einfach akKino() aufrufen.')
    return
  }
  window.__akKinoLaeuft = true

  /** Jeder Abruf, den die Seite seit dem Start gemacht hat. */
  const abrufe = []

  /**
   * Beide Wege abfangen, nicht nur einen.
   *
   * Nuxt nutzt `fetch`, ältere Bausteine und manche Tracker `XMLHttpRequest`.
   * Wer nur einen abfängt, sieht die Hälfte und hält sie für das Ganze.
   */
  const echterFetch = window.fetch
  window.fetch = async function (...args) {
    const adresse = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '')
    const antwort = await echterFetch.apply(this, args)
    try {
      const kopie = antwort.clone()
      const text = await kopie.text()
      abrufe.push(pruefe('fetch', adresse, text))
    } catch {
      abrufe.push({ art: 'fetch', adresse, laenge: null, hinweis: 'nicht lesbar' })
    }
    return antwort
  }

  const echtesOeffnen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (methode, adresse, ...rest) {
    this.addEventListener('load', () => {
      try {
        abrufe.push(pruefe('xhr', String(adresse), String(this.responseText ?? '')))
      } catch {
        /* Antwort nicht als Text lesbar — dann eben nicht. */
      }
    })
    return echtesOeffnen.call(this, methode, adresse, ...rest)
  }

  /** Was an einer Antwort für uns interessant ist. */
  function pruefe(art, adresse, text) {
    const hat = (muster) => (new RegExp(muster, 'i').test(text) ? 'ja' : '')
    return {
      art,
      pfad: kurz(adresse),
      kb: Math.round(text.length / 102.4) / 10,
      OmU: hat('omu|untertitel|subtitled'),
      deutsch: hat('"deutsch"|synchron|\\bde\\b.{0,12}fassung'),
      zeiten: (text.match(/\d{2}:\d{2}/g) ?? []).length,
      conan: hat('conan'),
    }
  }

  function kurz(adresse) {
    try {
      const u = new URL(adresse, location.origin)
      const gesperrt = /^\/(ajax|payment|user)\//.test(u.pathname) ? '  ⛔' : ''
      return u.pathname.slice(0, 60) + gesperrt
    } catch {
      return String(adresse).slice(0, 60)
    }
  }

  window.akKino = () => {
    const mitInhalt = abrufe.filter((a) => a.kb > 0.2)
    console.log(
      `${abrufe.length} Abrufe seit dem Start, ${mitInhalt.length} mit Inhalt.\n` +
        '⛔ = liegt unter einem in robots.txt gesperrten Pfad.',
    )
    console.table(mitInhalt)
    const traeger = mitInhalt.filter((a) => a.zeiten > 3)
    if (traeger.length) {
      console.log('Diese Antworten tragen Uhrzeiten — hier liegen die Vorstellungen:')
      console.table(traeger)
    } else {
      console.log(
        'Keine Antwort mit Uhrzeiten dabei. Wurde auf der Seite ein Kino ausgewählt, ' +
          'sodass Spielzeiten erschienen sind?',
      )
    }
    return mitInhalt
  }

  console.log(
    'Messung läuft. Jetzt auf der Seite eine Stadt oder ein Kino auswählen, ' +
      'bis Spielzeiten zu sehen sind — danach akKino() aufrufen.',
  )
})()
