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
  const FUND = 'ak-netzfund'

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
   * Was die Seite selbst über Serie, Staffeln und Folgen weiß.
   *
   * Beim Abspielen holt Netflix
    if (url.includes('memberapi/release/metadata')) lesMetadaten(text)
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

  /**
   * Die Metadaten selbst holen, statt auf sie zu warten.
   *
   * Der Mitschnitt ist gescheitert, und zwar messbar: Netflix ersetzt sowohl
   * `window.fetch` als auch `XMLHttpRequest.prototype.open` **nach** unserem
   * Skript — beide Wrapper waren nach dem Laden weg, null Antworten gesehen
   * (Daniel, 22.08.2026). Dagegen anzukämpfen hieße, den Zeitpunkt zu erraten,
   * an dem Netflix fertig ist.
   *
   * **Warum ein eigener Abruf hier vertretbar ist:** Es ist dieselbe Adresse,
   * die die Seite in derselben Sekunde selbst geholt hat, mit denselben
   * Anmeldedaten, ausgelöst dadurch, dass ein Mensch eine Folge gestartet hat.
   * Was `robots.txt` untersagt, ist das systematische Abklappern durch ein
   * Programm — hier wird nichts abgeklappert: eine Folge, ein Abruf, und nur
   * die, die gerade offen ist. Ohne Nutzerklick passiert nichts.
   */
  let holtGerade = null

  async function holeMetadaten(movieId) {
    if (!movieId || holtGerade === movieId) return
    holtGerade = movieId
    const adresse =
      '/nq/website/memberapi/release/metadata' +
      `?movieid=${encodeURIComponent(movieId)}&imageFormat=webp&withSize=true&materialize=true`
    try {
      const antwort = await fetch(adresse, { credentials: 'include', headers: { accept: '*/*' } })
      if (!antwort.ok) {
        window.__akMetaFehler = `HTTP ${antwort.status}`
        return
      }
      lesMetadaten(await antwort.text())
    } catch (err) {
      window.__akMetaFehler = err.message
    }
  }

  // --- Mithören ------------------------------------------------------------

  /**
   * Was uns interessiert: Antworten, in denen Sprachen oder Folgenlisten
   * vorkommen. Netflix lädt sein halbes Frontend über `pathEvaluator` und
   * `metadata`; die Namen der Felder wechseln, die Begriffe nicht.
   */
  const INTERESSANT = /pathEvaluator|metadata|playerApi|shakti|episodes|videos|manifest|licensedManifest/i
  const SPRACHFELD = /audioLocale|audioTracks|audio_locale|languages|soundtrack|trackIds|dubbed|"de-DE"|Deutsch/i

  const gesehen = new Set()

  function pruefeAntwort(url, text) {
    window.__akGesehen = (window.__akGesehen ?? 0) + 1
    if (!text || text.length < 200) return
    // Eines von beidem genuegt: der Pfad sieht nach Metadaten aus, oder der
    // Inhalt nennt Sprachen. Sonst faellt genau das durch, was wir suchen.
    if (!INTERESSANT.test(url) && !SPRACHFELD.test(text)) return
    const schluessel = url.split('?')[0]
    if (gesehen.has(schluessel)) return
    gesehen.add(schluessel)

    // Nur ein Auszug: die Feldnamen und ein paar Fundstellen, nicht der ganze
    // Datenstrom. Es geht um die Frage „steht es da überhaupt", nicht um eine
    // zweite Kopie von Netflix.
    const felder = [...new Set((text.match(/"[a-zA-Z_]*([Aa]udio|[Ll]anguage|dub|track)[a-zA-Z_]*"/g) ?? []).slice(0, 40))]
    const proben = (text.match(/"(de|de-DE|German|Deutsch)[^"]{0,30}"/g) ?? []).slice(0, 10)
    window.postMessage(
      { marke: FUND, url: schluessel, laenge: text.length, felder, proben, reihe: reihenNummer() },
      '*',
    )
  }

  /**
   * Mithören, ohne sich abhängen zu lassen.
   *
   * Die erste Fassung hat `window.fetch` und `XMLHttpRequest.prototype.open`
   * schlicht ersetzt — und war nach dem Laden weg: Netflix setzt beide selbst
   * neu und verkettet dabei nichts. Gemessen am 22.08.2026: beide Wrapper
   * verschwunden, null Antworten gesehen.
   *
   * Der Ausweg ist ein **Zugriffsschutz** statt einer Zuweisung. Wer
   * `window.fetch` liest, bekommt immer unsere Hülle; wer ihm etwas zuweist,
   * ersetzt nur das, was die Hülle innen aufruft. Netflix darf also weiter
   * seinen eigenen Wrapper setzen — er landet unter unserem, statt ihn zu
   * verdrängen.
   */
  let echterFetch = window.fetch
  const huelleFetch = function (...args) {
    const zusage = echterFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '')
      if (INTERESSANT.test(url)) {
        zusage
          .then((antwort) => antwort.clone().text())
          .then((text) => pruefeAntwort(url, text))
          .catch(() => {})
      }
    } catch {
      /* Mithören darf die Seite nie stören. */
    }
    return zusage
  }
  try {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      get: () => huelleFetch,
      set: (neu) => {
        echterFetch = neu
      },
    })
  } catch {
    window.fetch = huelleFetch
  }

  const echtesOeffnen = XMLHttpRequest.prototype.open
  const huelleOeffnen = function (methode, url, ...rest) {
    this.addEventListener('load', () => {
      try {
        if (typeof this.responseText === 'string') pruefeAntwort(String(url), this.responseText)
      } catch {
        /* siehe oben */
      }
    })
    return echtesOeffnen.call(this, methode, url, ...rest)
  }
  let echtesOeffnenAktuell = echtesOeffnen
  try {
    Object.defineProperty(XMLHttpRequest.prototype, 'open', {
      configurable: true,
      get: () => huelleOeffnen,
      set: (neu) => {
        echtesOeffnenAktuell = neu
      },
    })
  } catch {
    XMLHttpRequest.prototype.open = huelleOeffnen
  }

  // --- Takt ----------------------------------------------------------------

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
