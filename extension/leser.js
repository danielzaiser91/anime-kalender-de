/**
 * Läuft in der Seitenwelt: liest den Player und hört mit, was Netflix selbst lädt.
 *
 * **Warum getrennt vom Knopf:** Ein gewöhnliches Content-Skript läuft in einer
 * eigenen, abgeschotteten Welt. Es sieht das DOM, aber **nicht** die
 * JavaScript-Objekte der Seite — `window.netflix` ist dort schlicht nicht da.
 * Genau daran ist die erste Fassung gescheitert: Der Knopf fand nie Tonspuren,
 * auch nicht in einer laufenden Folge (Daniel, 22.08.2026, mit Bild).
 *
 * **Warum zusätzlich mitgehört wird:** Die Seite weiß mehr, als sie anzeigt.
 * Daniels Frage, 22.08.2026: „nutze die extension um daten zu sammeln, was dort
 * alles im netzwerktab auslesbar ist, und vielleicht existieren ja dort bereits
 * alle infos, und ich muss noch weniger machen." Genau die Prüfung, die der
 * Skill `netzwerkverkehr-statt-scraping` vorschreibt — nur diesmal von innen,
 * weil Netflix von außen nicht abgefragt werden darf.
 *
 * Mitgehört wird ausschließlich, was die Seite ohnehin lädt, weil Daniel sie
 * geöffnet hat. Es wird nichts angefordert.
 */
;(() => {
  // Seit dem 22.08.2026 laeuft dieses Skript nur auf Netflix. Crunchyroll
  // lesen wir ueber die Content-API; dort hat die Erweiterung nichts mehr zu
  // suchen, und was sie nicht anfasst, kann sie auch nicht stoeren.
  const MARKE = 'ak-spuren'

  // --- Der Player ----------------------------------------------------------

  function netflixSpuren() {
    // Nur im echten Abspieler. Auf einer Titelseite läuft die Vorschau, und
    // deren Sprachen haben mit der Reihe nichts zu tun.
    if (!location.pathname.startsWith('/watch/')) return null
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
    const alle = api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []
    // „motion-billboard" ist die Vorschau auf der Titelseite, „trailer" spricht
    // für sich. Beide haben eigene Tonspuren, die mit der Reihe nichts zu tun
    // haben.
    const sitzungen = alle.filter((id) => !/motion-billboard|trailer|preview/i.test(String(id)))
    if (!sitzungen.length) return null
    const player = api.videoPlayer.getVideoPlayerBySessionId(sitzungen[0])
    const spuren = player?.getAudioTrackList?.() ?? []
    if (!spuren.length) return null
    return spuren.map((s) => ({ code: s.bcp47 ?? s.language ?? '', name: s.displayName ?? '' }))
  }

  /**
   * Die Reihe, zu der eine Meldung gehört — und warum das nicht der Player weiß.
   *
   * Ein Klick auf `/watch/<reihe>` leitet Netflix intern auf `/watch/<folge>`
   * um. In der Adresse steht danach die **Folge**, und genau die wurde gemeldet:
   * Neun von zwölf Meldungen aus Batch 1 trugen eine Kennung, die unser
   * Datensatz nicht kennt (22.08.2026).
   *
   * Der Player hilft nicht weiter. Gemessen im laufenden Abspieler: Die Sitzung
   * kennt nur `movieId` — die Folge —, keine `ancestorId`, keine `seriesId`,
   * und im Seitenzustand steht dazu nichts. Deshalb drei Quellen in dieser
   * Reihenfolge, und wenn keine trägt, wird **nichts** gemeldet:
   *
   * 1. Die Adresse, wenn sie eine Titelseite ist (`/title/<nummer>` oder `?jbv=`).
   * 2. Die zuletzt gesehene Titelseite dieser Sitzung — wer von dort auf
   *    „Abspielen" klickt, hat sie eben noch offen gehabt.
   * 3. Ein Verweis auf `/title/<nummer>` im Seiteninhalt. Im Abspieler führt
   *    der Weg zurück zur Reihe über einen solchen Link.
   */
  let letzteReihe = null

  function reihenNummer() {
    const ausPfad = /\/title\/(\d+)/.exec(location.pathname)?.[1]
    const ausQuery = new URLSearchParams(location.search).get('jbv')
    const ausTitelseite = ausPfad || ausQuery
    if (ausTitelseite) {
      letzteReihe = ausTitelseite
      return ausTitelseite
    }
    if (letzteReihe) return letzteReihe
    const ausInhalt = /\/title\/(\d+)/.exec(
      Array.from(document.querySelectorAll('a[href*="/title/"]'))
        .map((a) => a.getAttribute('href') ?? '')
        .join(' '),
    )?.[1]
    if (ausInhalt) {
      letzteReihe = ausInhalt
      return ausInhalt
    }
    return null
  }

  /**
   * Welche Folge gerade läuft — aus der Titelzeile des Abspielers.
   *
   * Die Player-Schnittstelle gibt es nicht her: Gemessen am 22.08.2026 kennt
   * die Sitzung nur `movieId`, und im Seitenzustand steht weder
   * `episodeNumber` noch `seasonNumber`. Netflix baut die Zeile aber aus festen
   * Bausteinen, und die stehen in seinen eigenen Übersetzungen:
   *
   *     player.status.bar.episodic.single.season
   *       "<h4>{SHOW_TITLE}</h4><span>Flg. {EPISODE_NUMBER}</span><span>{EPISODE_TITLE}</span>"
   *     player.season.episode.title
   *       "{SEASON_ABR}: Flg. {EPISODE} „{TITLE}“"
   *
   * Gelesen wird deshalb „St. 2" und „Flg. 5" — auf Englisch „S2" und „E5".
   * Fehlt die Staffel, ist es eine Reihe ohne Staffelzählung; dann zählt allein
   * die Folgennummer, und das ist ohnehin die Größe, mit der wir rechnen.
   */
  function folgeUndStaffel() {
    const knoten =
      document.querySelector('[data-uia*="video-title"]') ??
      document.querySelector('.video-title') ??
      document.querySelector('.ltr-1472ymd')
    const text = (knoten?.innerText ?? '').replace(/\s+/g, ' ')
    if (!text) return { folge: null, staffel: null, zeile: null }

    // Erst Netflix' eigenes Kürzel, dann das ausgeschriebene Wort.
    //
    // Der Episodentitel darf selbst „Folge 1" heißen — real bei „The Cleaning
    // Lady": „The Cleaning LadyFlg. 1Folge 1" (Daniel, 22.08.2026). Wer nur
    // nach der ersten Zahl sucht, trifft dort zufällig richtig; steht die Zahl
    // aber im Serientitel, trifft er daneben. Deshalb hat das Kürzel Vorrang.
    const kuerzel = /(?:Flg\.|Ep\.|\bE)\s*(\d{1,4})/i.exec(text)?.[1]
    const wort = /(?:Folge|Episode)\s*(\d{1,4})/i.exec(text)?.[1]
    const folge = kuerzel ?? wort
    const staffel = /(?:St\.|Staffel|Season|\bS)\s*(\d{1,2})\s*[:.]?\s*(?:Flg\.|E)/i.exec(text)?.[1]
    return {
      folge_nr: folge ? Number(folge) : null,
      staffel: staffel ? Number(staffel) : null,
      zeile: text.slice(0, 120),
    }
  }

  /** Die laufende Folge — nur als Beleg, nie als Ersatz für die Reihe. */
  function folgenNummer() {
    return /\/watch\/(\d+)/.exec(location.pathname)?.[1] ?? null
  }

  // --- Netflix' eigene Auskunft über die Reihe ------------------------------

  /**
  // Ohne Aufrufer, seit der Mitschnitt heraus ist. Der Auswerter bleibt
  // stehen, weil er an Daniels echter Antwort geprueft ist — es fehlt nur
  // der Weg, auf dem die Antwort hereinkommt.
   * Was die Seite selbst über Serie, Staffeln und Folgen weiß.
   *
   * Beim Abspielen holt Netflix
   * was das Raten überflüssig macht (Daniel hat den Aufruf am 22.08.2026 im
   * Netzwerkverkehr gefunden):
   *
   *     video.id            die **Serie** — nicht die Folge
   *     video.currentEpisode die gerade laufende Folge
   *     video.seasons[]     je Staffel: seq, shortName, episodes[]
   *     episodes[].seq      die Folgennummer **innerhalb** der Staffel
   *
   * Damit ist die Zuordnung exakt: Wir wissen, welche Folge welcher Staffel
   * gerade läuft und wie viele Folgen jede Staffel hat. Der Umweg über die
   * Titelzeile des Abspielers entfällt.
   */
  let metadaten = null

  function lesMetadaten(text) {
    let daten
    try {
      daten = JSON.parse(text)
    } catch {
      return
    }
    const v = daten?.video
    if (!v?.id || !Array.isArray(v.seasons)) return

    const staffeln = v.seasons.map((s) => ({
      seq: s.seq,
      name: s.shortName ?? s.longName ?? null,
      folgen: (s.episodes ?? []).length,
      erste: (s.episodes ?? [])[0]?.seq ?? null,
    }))

    let laufend = null
    for (const s of v.seasons) {
      for (const e of s.episodes ?? []) {
        if (e.episodeId === v.currentEpisode || e.id === v.currentEpisode) {
          laufend = { staffel: s.seq, folge: e.seq, titel: e.title ?? null }
        }
      }
    }

    metadaten = {
      reihe: String(v.id),
      titel: v.title ?? null,
      art: v.type ?? null,
      staffeln,
      laufend,
    }
    // Zum Nachsehen in der Konsole — sonst ist von aussen nicht zu erkennen,
    // ob die Metadaten ankamen oder die Titelzeile aushelfen musste.
    window.__akMeta = metadaten
  }

  // --- Mitlesen -------------------------------------------------------------

  /**
   * Die Metadaten-Antwort mitlesen — am Ergebnis, nicht am Aufruf.
   *
   * Zwei Anläufe sind gescheitert, beide mit Fehlercode NSES-UHX:
   *
   * 1. `window.fetch` und `XMLHttpRequest.prototype.open` ersetzen — Netflix
   *    setzt beide danach selbst neu, unsere Hüllen waren weg. Harmlos, aber
   *    wirkungslos.
   * 2. Dieselben Stellen hinter einen Zugriffsschutz legen — Netflix liest beim
   *    eigenen Wrappen zuerst den bestehenden Wert, bekam unsere Hülle, und
   *    beide riefen einander auf. *Maximum call stack size exceeded*, die Seite
   *    lud nicht mehr.
   *
   * Der Unterschied jetzt: `responseText` ist eine Eigenschaft, die Netflix
   * **liest** und nie ersetzt. Der native Getter liegt in einer Closure, damit
   * kann ihn niemand verdrängen, und niemand verwendet unseren Wert als
   * „Original" weiter — die Schleife von Anlauf 2 kann nicht entstehen.
   *
   * **Und es darf nichts kosten:** Gelesen wird nur bei einer einzigen Adresse,
   * jede Zeile liegt in einem `try`, und der Rückgabewert ist immer der native.
   * Geht bei uns etwas schief, merkt die Seite davon nichts.
   */
  const METADATEN_ADRESSE = 'memberapi/release/metadata'

  try {
    const beschreibung = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')
    const nativGetter = beschreibung?.get
    if (nativGetter) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
        configurable: true,
        enumerable: beschreibung.enumerable,
        get() {
          const text = nativGetter.call(this)
          try {
            const url = String(this.responseURL ?? '')
            if (url.includes(METADATEN_ADRESSE) && typeof text === 'string' && text.length > 100) {
              window.__akGesehen = (window.__akGesehen ?? 0) + 1
              lesMetadaten(text)
            }
          } catch (err) {
            window.__akMetaFehler = err.message
          }
          return text
        },
      })
    }
  } catch {
    /* Ohne Mitlesen bleibt der Weg über die Titelzeile. */
  }

  /**
   * Derselbe Griff für den `fetch`-Weg — am Ergebnis, nicht am Aufruf.
   *
   * Der XHR-Griff darüber ist am 22.08.2026 harmlos durchgelaufen (JJK-Test),
   * hat aber nichts gesehen: `serientitel` und `staffeln` fehlten in allen
   * Meldungen. Netflix holt die Metadaten also per `fetch`; der Header
   * `ui/xhrUnclassified` aus Daniels curl ist nur ein Name, den der Client
   * selbst setzt, keine Aussage über XMLHttpRequest.
   *
   * `Response.prototype.json` zu umhüllen ist aus demselben Grund sicher wie
   * der Getter: Die native Funktion liegt in einer Closure, Netflix ersetzt sie
   * nicht, und der Rückgabewert ist unverändert der native. **Kein `clone()`
   * nötig** — wir lesen das fertige Objekt, nicht den Datenstrom, und
   * verbrauchen damit nichts.
   */
  try {
    const urJson = Response.prototype.json
    Response.prototype.json = function () {
      const versprechen = urJson.call(this)
      try {
        const url = String(this.url ?? '')
        if (url.includes(METADATEN_ADRESSE)) {
          void versprechen
            .then((daten) => {
              window.__akGesehen = (window.__akGesehen ?? 0) + 1
              lesMetadaten(JSON.stringify(daten))
            })
            .catch(() => {})
        }
      } catch (err) {
        window.__akMetaFehler = err.message
      }
      return versprechen
    }
  } catch {
    /* Ohne Mitlesen bleibt der Weg über die Titelzeile. */
  }

  function melden() {
    // Die Nummer in der Adresse ist beim Abspielen die der Folge — genau die
    // erwartet der Metadaten-Endpunkt als `movieid`.
    // Was Netflix selbst sagt, schlägt jede Ableitung aus der Titelzeile.
    const ausMeta = metadaten
      ? {
          reihe: metadaten.reihe,
          folge_nr: metadaten.laufend?.folge ?? null,
          staffel: metadaten.laufend?.staffel ?? null,
          staffeln: metadaten.staffeln,
          serientitel: metadaten.titel,
          art: metadaten.art,
        }
      : {}
    window.postMessage(
      {
        marke: MARKE,
        spuren: netflixSpuren(),
        reihe: reihenNummer(),
        folge: folgenNummer(),
        ...folgeUndStaffel(),
        ...ausMeta,
        titel: document.title,
      },
      '*',
    )
  }

  setInterval(melden, 1500)
  melden()
})()
