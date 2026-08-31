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
  /** Die Folgenliste einer Staffel — Nummer und Kennung je Folge. */
  const MARKE_FOLGEN = 'ak-folgenliste'
  /** Steuerbefehle vom Melder: Videodaten zu/auf, Liste nachfragen. */
  const MARKE_STEUER = 'ak-steuer'

  /* Woher die Folgenliste kommt — gemessen am 26.08.2026 an Beyblade X. */
  const GRAPHQL = 'https://web.prod.cloud.netflix.com/graphql'
  const FOLGEN_OPERATION = 'PreviewModalEpisodeSelectorSeasonEpisodes'
  const FOLGEN_QUERY = { id: '4cf0a279-dd32-454d-9758-486359c0d48b', version: 102 }

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
        /*
          **Die Folgenliste ist die Kennungsquelle — und sie kommt genau einmal.**

          Netflix holt sie beim ersten Öffnen einer Staffel und bedient sich
          danach aus seinem Zwischenspeicher. Ein Skript aus der Konsole kam
          deshalb zweimal zu spät (26.08.2026); dieses hier läuft bei
          `document_start` und ist vor dem ersten Abruf da.

          Je Folge stehen dort Nummer und `videoId` beieinander — genau das
          Paar, das für einen Durchlauf fehlte.
        */
        if (url.includes('/graphql')) {
          window.__akGraphql = (window.__akGraphql ?? 0) + 1
          void versprechen.then((daten) => lesFolgenliste(daten)).catch(() => {})
        }
      } catch (err) {
        window.__akMetaFehler = err.message
      }
      return versprechen
    }
  } catch {
    /* Ohne Mitlesen bleibt der Weg über die Titelzeile. */
  }

  /**
   * Die Folgen einer Staffel, wie Netflix sie liefert.
   *
   * Gesammelt wird über Staffeln hinweg: Wer im Auswahlfeld wechselt, bekommt
   * eine neue Liste, und die alte bleibt gültig — beide gehören zur Reihe.
   */
  const folgenliste = new Map()
  /** Für welche Adresse die Liste gilt — wechselt sie, wird geleert. */
  let folgenFuer = null

  /** Feldpfade einer Antwort — nur zur Diagnose, gekürzt. */
  function pfadeMitZahlen(o) {
    const raus = []
    const lauf = (x, p, t) => {
      if (!x || typeof x !== 'object' || t > 8 || raus.length > 80) return
      for (const [k, v] of Object.entries(x)) {
        const pfad = Array.isArray(x) ? p + '[]' : (p ? p + '.' : '') + k
        if (v && typeof v === 'object') lauf(v, pfad, t + 1)
        else if (!raus.includes(pfad)) raus.push(pfad)
      }
    }
    lauf(o, '', 0)
    return raus
  }

  /**
   * Jeden Knoten nehmen, der Nummer **und** Kennung zusammen trägt.
   *
   * Ein fester Pfad (`data.videos.episodes.edges`) bricht bei der ersten
   * Umbenennung, und bei Daniel hat er am 26.08.2026 gar nicht erst gegriffen:
   * 32 Antworten liefen durch, keine passte. Gesucht wird deshalb nach dem
   * Paar, nicht nach seinem Ort — dieselbe Regel wie bei Amazon.
   */
  /**
   * **Die Staffel steht über der Folge, nicht an ihr.**
   *
   * Netflix zählt jede Staffel neu bei 1: „7 Seeds" hat zweimal die Folgen 1
   * bis 12, „Beastars" dreimal eine Folge 1. Die Folgenknoten selbst tragen
   * keine Staffelnummer — sie hängt am umgebenden Knoten (`seasonSeq`,
   * `seasonNumber`, oder als `seasonId` in den Abfragevariablen).
   *
   * Bis zum 31.08.2026 nahm der Durchlauf sie stattdessen aus dem **Player**,
   * während er lief. Der hinkt hinterher, und das Ergebnis war Zufall: Von 24
   * geprüften Folgen bei „7 Seeds" landeten 22 unter Staffel 1 und zwei unter
   * Staffel 2. Bei „Beastars" begann Staffel 3 dadurch bei Folge 1 statt 25.
   *
   * Deshalb wird sie beim Sammeln mitgeführt: Trägt ein Knoten auf dem Weg nach
   * unten eine Staffelangabe, gilt sie für alles darunter. Findet sich keine,
   * bleibt das Feld leer — eine geratene Staffel ist schlimmer als keine.
   */
  function staffelAus(o) {
    for (const feld of ['seasonSeq', 'seasonNumber', 'seasonSequenceNumber', 'seq']) {
      const wert = o?.[feld]
      if (Number.isFinite(wert) && wert > 0 && wert < 100 && /season/i.test(String(o.__typename ?? feld))) {
        return wert
      }
    }
    /* Ein Staffelknoten nennt seinen Typ — dann zählt auch ein schlichtes `seq`. */
    if (/season/i.test(String(o?.__typename ?? '')) && Number.isFinite(o?.seq) && o.seq > 0) {
      return o.seq
    }
    return null
  }

  function sammleFolgen(o, raus, tiefe, staffel = null) {
    if (!o || typeof o !== 'object' || tiefe > 10) return raus
    if (Array.isArray(o)) {
      for (const x of o) sammleFolgen(x, raus, tiefe + 1, staffel)
      return raus
    }
    /* Von hier ab gilt die Staffel dieses Knotens — falls er eine nennt. */
    const hier = staffelAus(o) ?? staffel
    const nummer = o.number ?? o.episodeNumber ?? o.seq
    const kennung = o.videoId ?? o.id
    const istFolge = /episode/i.test(String(o.__typename ?? ''))
    /*
      **Nur echte Folgen — der Typ entscheidet, nicht die Zahl.**

      Die erste Fassung nahm jeden Knoten mit Nummer und großer Kennung. Damit
      fielen die Empfehlungsleisten, "Weiter ansehen" und die Startseiten-Reihen
      mit hinein: Daniel sah am 26.08.2026 fremde Serien im Player, mitten in
      einem Durchlauf über One Piece. Eine Kennung über einer Million hat jeder
      Netflix-Titel.
    */
    /*
      **Null ist keine Kennung.**

      `Number.isFinite(0)` ist wahr, und so geriet ein Knoten mit
      `videoId: 0` in die Liste. Der Durchlauf öffnete daraufhin
      `/watch/0?origId=…`, und Netflix antwortete mit UI3003 — „Dieser Titel
      ist in Ihrem Land derzeit nicht verfügbar" (Daniel, 26.08.2026, mit Bild).

      Dieselbe Falle wie bei jeder Prüfung auf Vorhandensein: Eine Zahl kann
      gültig und trotzdem unbrauchbar sein.
    */
    /*
      **Was nicht abspielbar ist, gehört nicht in die Liste.**

      Die Antwort trägt je Folge `isAvailable` und `isPlayable` — beides stand
      im Mitschnitt vom 26.08.2026, und beides habe ich übergangen. Der
      Durchlauf öffnete daraufhin `/watch/82757184`, und Netflix antwortete mit
      E103: „Dieser Titel steht nicht zum Streaming zur Verfügung."

      Eine Kennung kann echt sein und trotzdem ins Leere führen. Die Seite weiß
      das vorher; man muss sie nur fragen.
    */
    const abspielbar = o.isPlayable !== false && o.isAvailable !== false
    if (abspielbar && istFolge && Number.isFinite(nummer) && nummer > 0 && Number(kennung) > 0) {
      raus.push({ nummer, videoId: Number(kennung), titel: o.title ?? null, staffel: hier })
    }
    for (const v of Object.values(o)) sammleFolgen(v, raus, tiefe + 1, hier)
    return raus
  }

  /** Woher jede Folge kam — für die Diagnose, nicht für die Auswertung. */
  const herkunft = []

  /** Die letzten GraphQL-Anfragen mit ihren Variablen — nur zur Diagnose. */
  const anfragen = []

  function merkeAnfrage(koerper) {
    if (typeof koerper !== 'string' || !koerper.includes('operationName')) return
    try {
      const d = JSON.parse(koerper)
      anfragen.push({
        operation: d.operationName ?? null,
        variables: d.variables ?? null,
        query: d.extensions?.persistedQuery ?? null,
      })
      if (anfragen.length > 30) anfragen.shift()
    } catch {
      /* Keine JSON-Anfrage — dann ist sie nicht für uns. */
    }
  }

  /**
   * **Die übrigen Folgen nachladen — Netflix liefert dreißig auf einmal.**
   *
   * Bei „Beyblade X" fehlten dadurch die Folgen 31 bis 48, bis Daniel die
   * Liste von Hand aufklappte (26.08.2026). Bei 49 Folgen geht das noch; One
   * Piece hat 1.175.
   *
   * Wie die Fortsetzung angefordert wird, stand nicht in der Antwort, sondern
   * in der **Anfrage** — deshalb schneidet der Leser sie seit 3.14 mit. Ein
   * Aufklappen von Hand hat es geklärt:
   *
   * ```
   * 1. { seasonId, count: 30 }
   * 2. { seasonId, count: 50, cursor: "Mjk=" }
   * ```
   *
   * `Mjk=` ist base64 für **29** — der Index der letzten geladenen Folge,
   * null-basiert. Die Antwort beginnt danach, also bei Folge 31. Ein
   * `pageInfo` gibt es nicht; nachgeladen wird, bis nichts Neues mehr kommt.
   *
   * Das ist Zeichen für Zeichen der Abruf, den ein Klick auf „mehr" auslöst —
   * in Daniels angemeldeter Sitzung, mit Pause, und mit einer Obergrenze.
   */
  const NACHLADE_PAUSE_MS = 400
  /** 40 Runden × 50 Folgen — reicht für 2.000 und verhindert eine Endlosschleife. */
  const NACHLADE_RUNDEN = 40

  let laedtNach = false

  async function folgenNachladen(seasonId, bekannt) {
    if (laedtNach || !Number.isFinite(seasonId)) return
    laedtNach = true
    try {
      let stand = bekannt
      for (let runde = 0; runde < NACHLADE_RUNDEN; runde++) {
        await new Promise((r) => setTimeout(r, NACHLADE_PAUSE_MS))
        const antwort = await fetch(GRAPHQL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-netflix.context.locales': 'de-DE',
            'x-netflix.context.operation-name': FOLGEN_OPERATION,
          },
          credentials: 'include',
          body: JSON.stringify({
            operationName: FOLGEN_OPERATION,
            variables: {
              seasonId,
              count: 50,
              opaqueImageFormat: 'WEBP',
              artworkContext: {},
              /* Der Index der letzten bekannten Folge, base64 — so macht es die Seite. */
              cursor: btoa(String(stand - 1)),
            },
            extensions: { persistedQuery: FOLGEN_QUERY },
          }),
        })
        const daten = await antwort.json()
        const vorher = folgenliste.size
        lesFolgenliste(daten, true)
        /* Kommt nichts Neues, ist die Staffel vollständig. */
        if (folgenliste.size === vorher) break
        stand = folgenliste.size
      }
    } catch {
      /* Ein Fehlschlag lässt die Liste unvollständig — der Knopf sagt es. */
    } finally {
      laedtNach = false
    }
  }

  function lesFolgenliste(daten, ausNachladen) {
    /*
      Nur auf einer Titelseite. Auf der Startseite und im Player kommen
      dieselben Antworten, gehören aber zu allem Möglichen.
    */
    const kennung = /\/title\/(\d+)/.exec(location.pathname + location.search)?.[1]
      ?? new URLSearchParams(location.search).get('jbv')
    if (!kennung) return

    if (folgenFuer !== kennung) {
      folgenliste.clear()
      folgenFuer = kennung
    }

    /**
     * **Nur `data.videos` — das ist die Folgenliste einer Staffel.**
     *
     * Die Diagnose vom 26.08.2026 auf der Kakegurui-Seite zeigt zwei Sorten
     * Antworten, und beide tragen `__typename: "Episode"`:
     *
     * ```
     * data: videos            12 Folgen, Nr 1,2,3,4,5    ← die Staffel
     * data: unifiedEntities    4 Folgen, Nr 1,13,1,1     ← Empfehlungsleiste
     * data: unifiedEntities   13 Folgen, Nr 1,10,1,4,1   ← noch eine
     * ```
     *
     * `unifiedEntities` sind die Reihen der Startseite, die hinter dem
     * Titel-Dialog weiterlädt. Es sind **echte Folgen** — nur von fremden
     * Serien, und deshalb ließ die Typ-Prüfung sie durch. Erkennbar an den
     * Nummern: Keine Staffel zählt `1,13,1,1`.
     *
     * Der Ort entscheidet hier, nicht der Typ. Zwei Anläufe zuvor hatte ich es
     * umgekehrt versucht — erst ein fester Pfad, der nicht griff (weil
     * `text()` noch nicht eingehakt war), dann eine Suche über den ganzen
     * Baum, die zu viel fand. Die Diagnose hat beides aufgelöst.
     */
    const gefunden = daten?.data?.videos ? sammleFolgen(daten.data.videos, [], 0) : []
    if (gefunden.length) {
      herkunft.push({
        adresse: location.pathname + location.search,
        /* Was die Antwort über sich selbst sagt. */
        typ: daten?.data ? Object.keys(daten.data).join(',') : typeof daten,
        seasonId: daten?.data?.videos?.videoId ?? null,
        typname: daten?.data?.videos?.__typename ?? null,
        anzahl: gefunden.length,
        nummern: gefunden.slice(0, 5).map((f) => f.nummer),
        titel: gefunden.slice(0, 5).map((f) => f.titel),
        /* Die ersten 600 Zeichen der Antwort — daran sieht man, was es war. */
        anfang: JSON.stringify(daten).slice(0, 600),
      })
      if (herkunft.length > 40) herkunft.shift()
    }
    if (!gefunden.length) return
    let neu = 0
    for (const k of gefunden) {
      if (!folgenliste.has(k.videoId)) neu++
      folgenliste.set(k.videoId, k)
    }
    window.__akFolgen = folgenliste.size
    if (!neu) return
    window.postMessage(
      {
        marke: MARKE_FOLGEN,
        fuerReihe: folgenFuer,
        folgen: [...folgenliste.values()].sort((a, b) => a.nummer - b.nummer),
      },
      '*',
    )

    /*
      Ein voller Block heißt: Es gibt wahrscheinlich mehr. Ein halber heißt:
      Das war das Ende. Nachgeladen wird nur aus dem ersten Abruf heraus —
      sonst riefe sich die Kette selbst auf.
    */
    if (!ausNachladen && gefunden.length >= 30) {
      const seasonId = daten?.data?.videos?.[0]?.videoId ?? daten?.data?.videos?.videoId
      void folgenNachladen(Number(seasonId), folgenliste.size)
    }
  }

  /**
   * **Videodaten abdrehen, sobald die Tonspur feststeht.**
   *
   * Gemessen am 26.08.2026: Weder `pause()` noch das Verlassen der Seite hält
   * das Vorausladen auf — der Player füllt seinen Puffer weiter (129 Segmente
   * in fünf Sekunden, 42 MB). Was greift, ist, ihm die Segmente gar nicht erst
   * zu geben.
   *
   * Der Player bricht dann ab, und genau das ist gewollt. **Für Netflix
   * bedeutet es weniger Last, nicht mehr** — abgewiesen wird hier, bevor der
   * Abruf die Leitung erreicht.
   */
  let videoZu = false
  const istVideoAbruf = (u) => typeof u === 'string' && /nflxvideo.net/.test(u)

  try {
    const urFetch = window.fetch
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
      if (videoZu && istVideoAbruf(url)) return Promise.reject(new Error('ak-abgedreht'))
      if (typeof url === 'string' && url.includes('/graphql')) merkeAnfrage(args[1]?.body)
      return urFetch.apply(this, args)
    }
    const urOeffnen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (m, u, ...rest) {
      this.__akVideo = istVideoAbruf(u)
      return urOeffnen.call(this, m, u, ...rest)
    }
    const urSenden = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function (koerper) {
      if (videoZu && this.__akVideo) return this.abort()
      merkeAnfrage(koerper)
      return urSenden.call(this, koerper)
    }
  } catch {
    /* Ohne den Griff läuft der Durchlauf teurer, aber er läuft. */
  }

  /* Der Melder steuert den Durchlauf und sagt, wann zu ist. */
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.marke !== MARKE_STEUER) return
    if (typeof e.data.videoZu === 'boolean') videoZu = e.data.videoZu
    if (e.data.frage === 'folgen') {
      window.postMessage(
        {
        marke: MARKE_FOLGEN,
        fuerReihe: folgenFuer,
        folgen: [...folgenliste.values()].sort((a, b) => a.nummer - b.nummer),
      },
        '*',
      )
    }
  })

  try {
    const urText = Response.prototype.text
    Response.prototype.text = function () {
      const versprechen = urText.call(this)
      try {
        const url = String(this.url ?? '')
        if (url.includes('/graphql')) {
          window.__akGraphqlText = (window.__akGraphqlText ?? 0) + 1
          void versprechen
            .then((text) => {
              if (typeof text !== 'string') return
              /* Was für Antworten kommen hier überhaupt an? */
              const op = /"__typename"\s*:\s*"([^"]+)"/.exec(text)?.[1]
              window.__akOps = window.__akOps ?? []
              if (op && !window.__akOps.includes(op)) window.__akOps.push(op)
              if (!text.includes('episodes')) return
              window.__akMitEpisodes = (window.__akMitEpisodes ?? 0) + 1
              let daten
              try {
                daten = JSON.parse(text)
              } catch {
                return
              }
              /* Die erste solche Antwort einmal vollständig aufheben. */
              if (!window.__akRoh) {
                window.__akRoh = text.slice(0, 4000)
                window.__akPfade = pfadeMitZahlen(daten)
              }
              lesFolgenliste(daten)
            })
            .catch(() => {})
        }
      } catch (err) {
        window.__akMetaFehler = err.message
      }
      return versprechen
    }
  } catch {
    /* Ohne diesen Weg bleibt der über `json()`. */
  }

  /*
    3. Und derselbe für XMLHttpRequest.

    Der vorhandene Getter oben filtert auf die Metadaten-Adresse. Die
    Folgenliste kommt woanders her, also braucht sie ihre eigene Bedingung.
  */
  try {
    const beschreibung2 = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')
    const nativ2 = beschreibung2?.get
    if (nativ2) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
        configurable: true,
        enumerable: beschreibung2.enumerable,
        get() {
          const text = nativ2.call(this)
          try {
            const url = String(this.responseURL ?? '')
            if (url.includes('/graphql') && typeof text === 'string' && text.includes('episodes')) {
              window.__akGraphqlXhr = (window.__akGraphqlXhr ?? 0) + 1
              try {
                lesFolgenliste(JSON.parse(text))
              } catch {
                /* Keine JSON-Antwort. */
              }
            }
          } catch (err) {
            window.__akMetaFehler = err.message
          }
          return text
        },
      })
    }
  } catch {
    /* Ohne diesen Weg bleiben die beiden anderen. */
  }

  /**
   * Alles, was der Leser über die Folgenliste weiß — für die Konsole.
   *
   * Aufruf: `__akDiagnose()` auf der Titelseite.
   */
  window.__akDiagnose = () => {
    const raus = {
      adresse: location.pathname + location.search,
      folgenFuer,
      gesammelt: folgenliste.size,
      /*
        Was Netflix über die Staffeln sagt — und ob die laufende Folge einer
        zugeordnet ist. Die Meldungen des ersten Kakegurui-Durchlaufs trugen
        alle staffel: null, und die Pipeline verteilte sie daraufhin über zwei
        Staffeln (Folge 1 zu Staffel 1, 2-12 zu Staffel 2).
      */
      metadaten: metadaten,
      staffelIds: (metadaten?.staffeln ?? []).map((x) => JSON.stringify(x)),
      folgen: [...folgenliste.values()].sort((a, b) => a.nummer - b.nummer),
      antworten: herkunft,
      /*
        Die Anfragen — daran hängt das Nachladen. Gesucht wird die zweite
        `PreviewModalEpisodeSelectorSeasonEpisodes`: Was steht in ihren
        `variables`, das die erste nicht hatte?
      */
      anfragen,
      zaehler: {
        graphqlJson: window.__akGraphql ?? 0,
        graphqlText: window.__akGraphqlText ?? 0,
        graphqlXhr: window.__akGraphqlXhr ?? 0,
        mitEpisodes: window.__akMitEpisodes ?? 0,
      },
    }
    console.log('%c[Anime-Kalender] Diagnose', 'font-weight:bold')
    console.log('Adresse:', raus.adresse, '| Liste gilt für:', raus.folgenFuer, '| gesammelt:', raus.gesammelt)
    const folgenAnfragen = raus.anfragen.filter((x) => /Episode/i.test(x.operation ?? ''))
    console.log(`Folgenlisten-Anfragen: ${folgenAnfragen.length}`)
    for (const x of folgenAnfragen) console.log('  ', x.operation, JSON.stringify(x.variables))
    console.table(
      raus.antworten.map((h) => ({
        Adresse: h.adresse,
        'data-Felder': h.typ,
        Typname: h.typname,
        seasonId: h.seasonId,
        Folgen: h.anzahl,
        Nummern: h.nummern.join(','),
        Titel: h.titel.join(' | ').slice(0, 60),
      })),
    )
    try {
      const blob = new Blob([JSON.stringify(raus, null, 1)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'ak-diagnose.json'
      a.click()
    } catch {
      /* Ohne Datei bleibt die Ausgabe in der Konsole. */
    }
    return raus
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

  /**
   * Vier Blicke pro Sekunde statt einem alle anderthalb.
   *
   * Daniel am 22.08.2026: „der text sollte schneller den echten zustand
   * anzeigen, da ist irgendeine random verzögerung eingebaut." Die Verzögerung
   * war nicht zufällig, sondern genau dieser Takt — zwischen dem Umschalten der
   * Tonspur und der nächsten Prüfung lagen bis zu 1,5 Sekunden, und so lange
   * zeigte der Knopf den alten Stand.
   *
   * Der Preis ist gering: Gelesen wird die Tonspurliste des Players und eine
   * Überschrift, kein Netzabruf.
   */
  setInterval(melden, 250)
  melden()
})()
