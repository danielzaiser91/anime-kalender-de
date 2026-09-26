import { readJson, log, ROOT } from '../lib/util.ts'
import { terminAusEintrag, verlagAlsDienst } from '../lib/anisearch-termine.ts'
import yaml from 'js-yaml'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type MotnDaten, LEER as MOTN_LEER, ordneShowsZu, tmdbZuordnung, uebernehmbar } from '../lib/motn.ts'
import { todayIso } from '../../shared/time.ts'
import { releaseStatus } from '../../shared/logic.ts'
import { staffelnDesFranchise, passtZuSerie, bewerteTreffer, volltreffer, type AdnData } from '../lib/adn.ts'
import { adnAdresseSchaerfen, adnFolgenAdresse, ladeAdnArchiv, beurteileAdnVerweis } from '../lib/adn-sprachen.ts'
import { type Release, type Title } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

export function werteWeitereQuellenAus({ releases, titles, adnKatalog, adnVerweiseErgaenzt, verweiseEntfernt }: {
  releases: Release[]
  titles: Map<number, Title>
  adnKatalog: AdnData
  adnVerweiseErgaenzt: number
  verweiseEntfernt: EntfernterVerweis[]
}) {
  /**
   * **Seit wann gibt es das auf Deutsch? — die Antwort aus aniSearch.**
   *
   * Gemessen am 03.09.2026: 2.202 Titel im Bestand haben eine belegte deutsche
   * Synchro und keinen einzigen Termin. Der Kasten im Detail-Panel sagt dort
   * „Auf Deutsch verfügbar" und kann nicht sagen, seit wann — obwohl aniSearch
   * es für 1.985 von ihnen weiß, mit Datum und Verlag. „Cowboy Bebop,
   * 08.01.2003 – 02.04.2003, Dybex" liegt seit Wochen im Haus und wurde von
   * nichts gelesen.
   *
   * **Es wird ein Feld, kein Release.** Der erste Anlauf baute daraus 1.985
   * Kalendereinträge — und `titles-core.json`, die Datei, die jeder Besucher
   * beim Erstaufruf lädt, wuchs von 554 KB auf 2,7 MB. Ein DVD-Datum von 2003
   * ist kein Termin, den jemand im Kalender sucht; es beantwortet eine
   * Stammdatenfrage im Detail-Panel. Die Regeln der Übernahme stehen in
   * `lib/anisearch-termine.ts`, die Begründung des Feldes bei `deErstausgabe`
   * in `shared/types.ts`.
   */
  {
    const asRoh = readJson<Record<string, { info?: { languages?: unknown[] } }>>(
      'data/anisearch.json',
      {},
    )
    const schonMitTermin = new Set(releases.map((r) => r.titleId))
    let asNeu = 0
    let asVorJp = 0
    let asSimulcast = 0
    let asDiscDatum = 0
    const discFuerErstausgabe = readJson<Record<string, { datum: string }[]>>('data/disc-ausgaben.json', {})
    for (const title of titles.values()) {
      if (schonMitTermin.has(title.id)) continue
      const termin = terminAusEintrag(
        asRoh[String(title.id)]?.info as { languages?: never[] } | undefined,
      )
      if (!termin) continue
      /*
        **Eine deutsche Fassung gibt es nicht vor dem Original.** Sechs Einträge
        scheitern daran — meist eine Verwechslung mit einem Vorgänger im
        aniSearch-Datensatz. Sie wären in der Anzeige nicht als falsch zu
        erkennen, also bleiben sie draußen.
      */
      if (termin.start && title.jpYear && Number(termin.start.slice(0, 4)) < title.jpYear) {
        asVorJp++
        continue
      }
      /*
        **Ein Simulcast-Datum ist kein Synchro-Datum.** aniSearchs deutscher Block
        nennt die erste deutsche Veröffentlichung überhaupt, und das ist oft der
        OmU-Simulcast: „Dragon Quest: The Adventure of Dai" — 03.10.2020, Publisher
        Crunchyroll, Kazé Deutschland. Die Synchro gibt es nur auf Kazés Disc; im
        Panel stand „Auf Deutsch seit 03.10.2020 · Crunchyroll" (Daniel, 16.09.2026).
        Gemessen: 375 Titel mit deutschem Datum am japanischen Start und einem
        Streamingdienst als erstem Verlag, 119 davon ohne belegten Dub-Stream dort.
        Bei denen fallen Datum und Dienst weg; ein Disc-Verlag bleibt als Spur.
      */
      const asDe = (asRoh[String(title.id)]?.info?.languages as { language?: string; released?: string; publisher?: string[] }[] | undefined) ?? []
      const tagAus = (s?: string) => {
        const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s ?? '')
        return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined
      }
      const deTag = tagAus(asDe.find((l) => l.language === 'Deutsch')?.released)
      const jpTag = tagAus(asDe.find((l) => l.language === 'Japanisch')?.released)
      const verlage = asDe.find((l) => l.language === 'Deutsch')?.publisher ?? []
      const simulcast =
        deTag !== undefined && jpTag !== undefined && Math.abs(deTag - jpTag) <= 7 * 864e5 &&
        verlage.length > 0 && verlagAlsDienst(verlage[0]!) !== undefined &&
        !(title.streams ?? []).some((s) => s.dub === true && s.platform === verlagAlsDienst(verlage[0]!))
      /*
        **Und ein Datum dicht am japanischen Start ist Simulcast, wenn die Discs erst später kamen.**
        „Undefeated Bahamut Chronicle": deutscher Block 20.01.–02.04.2016 (neun Tage nach dem
        japanischen Start, Verlag Nipponart), die deutschen Discs ab 30.06.2017 — Volume 1 bis 4,
        Gesamtausgabe 25.05.2020 (Daniel, 16.09.2026). Dann gilt das früheste Disc-Datum.
      */
      const fruehesteDisc = (discFuerErstausgabe[String(title.id)] ?? [])
        .map((a) => a.datum)
        .filter(Boolean)
        .sort()[0]
      /*
        Erst ab 2012 und nicht bei Filmen: Davor heißt ein deutsches Datum nah am japanischen
        Start eine echte Ausstrahlung mit Synchro — „Wickie" 1974, „Final Fantasy: Die Mächte
        in Dir" im Kino 2001. Gemessen danach: 548 Serien, Stichprobe durchweg OmU-Simulcasts
        (Kazé, peppermint, Crunchyroll) mit späteren deutschen Discs.
      */
      const nahAmStart =
        deTag !== undefined &&
        jpTag !== undefined &&
        deTag - jpTag <= 30 * 864e5 &&
        new Date(jpTag).getUTCFullYear() >= 2012 &&
        title.format !== 'MOVIE'
      const discDatumGilt =
        Boolean(fruehesteDisc) && (simulcast || nahAmStart) && (!termin.start || fruehesteDisc! > termin.start)
      if (discDatumGilt) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        title.deErstausgabe = { von: fruehesteDisc!, ...(disc ? { publisher: disc } : {}), ...(termin.synchro ? { synchro: true } : {}) }
        asDiscDatum++
        asNeu++
        continue
      }
      if (simulcast) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        asSimulcast++
        if (!disc) continue
        title.deErstausgabe = { publisher: disc, ...(termin.synchro ? { synchro: true } : {}) }
        asNeu++
        continue
      }
      title.deErstausgabe = {
        ...(termin.start ? { von: termin.start } : {}),
        ...(termin.zeitraum ? { zeitraum: termin.zeitraum } : {}),
        ...(termin.ende ? { bis: termin.ende } : {}),
        ...(termin.publisher ? { publisher: termin.publisher } : {}),
        ...(termin.synchro ? { synchro: true } : {}),
      }
      asNeu++
    }
    if (asNeu) {
      log(
        `${asNeu} deutsche Erstausgaben aus aniSearch übernommen ` +
          `(${asVorJp} vor der japanischen Ausstrahlung verworfen, ` +
          `${asSimulcast} Simulcast-Daten ohne Dub-Stream nicht als Synchro-Datum, ` +
          `${asDiscDatum} durch das früheste Disc-Datum ersetzt)`,
      )
    }
  }

  /*
    **Erste deutsche Ausstrahlung aus der Wikipedia-Episodenliste** (19.09.2026). Titel mit
    eigenem Termin bekommen von aniSearch kein Datum (siehe oben) — eine TV-Sichtung ist aber
    kein Starttermin. Dragon Ball, One Piece, Conan, Dragon Ball Super, Pokémon Horizonte und
    Daima standen deshalb ohne „Auf Deutsch seit". Die Liste nennt je Folge `EAD`; die früheste
    gilt, wenn der Titel noch keine Angabe hat.
  */
  {
    const wiki = readJson<{ titel?: Record<string, { folgen: { ead?: string }[] }> }>('data/wikipedia-folgen.json', {}).titel ?? {}
    let ausWiki = 0
    for (const [id, liste] of Object.entries(wiki)) {
      const title = titles.get(Number(id))
      const erste = liste.folgen.map((f) => f.ead).filter((d): d is string => Boolean(d)).sort()[0]
      if (!title || title.deErstausgabe || !erste) continue
      title.deErstausgabe = { von: erste, quelle: 'wikipedia' }
      ausWiki++
    }
    if (ausWiki) log(`${ausWiki} deutsche Erstausstrahlungen aus Wikipedia-Episodenlisten`)

    /* Von Hand, wo aniSearchs Datum nicht die Synchro meint (`data/erstausgabe-von-hand.yaml`). */
    const vonHand = (yaml.load(readFileSync(resolve(ROOT, 'data/erstausgabe-von-hand.yaml'), 'utf8')) ?? []) as {
      anilistId?: number
      von?: string
      publisher?: string
      sources?: string[]
    }[]
    for (const e of vonHand) {
      const title = e.anilistId ? titles.get(e.anilistId) : undefined
      if (!title || !e.von || !e.sources?.length) continue
      title.deErstausgabe = { von: e.von, ...(e.publisher ? { publisher: e.publisher } : {}), synchro: true }
    }
  }

  /**
   * Deutsche Tonspuren von der Streaming Availability API — nur Netflix.
   *
   * Diese Quelle nennt je Folge die `audios`, getrennt von den `subtitles`. Für
   * Netflix ist sie die einzige maschinenlesbare Auskunft überhaupt: 532
   * Verweise standen deshalb dauerhaft auf „🇩🇪 ?", und Netflix untersagt das
   * Auslesen seiner Seiten in der robots.txt.
   *
   * **Drei Regeln, jede aus einer Messung vom 21.08.2026** (Herleitung in
   * `lib/motn.ts`):
   *
   *  1. **Nie ein `false`.** Die Quelle hinkt mindestens zwei Tage hinterher —
   *     Folge 7 von „Thunderbolt Fantasy" war am 19.08. fällig, lag am 21.08.
   *     auf Netflix in deutscher Fassung, und die API kannte sie nicht. Ihr
   *     Schweigen ist kein Nein. Gesetzt wird ausschließlich `true`.
   *  2. **Nichts aus einem laufenden Release.** Bei einer laufenden Staffel
   *     entscheidet der Verzug darüber, was die Quelle zeigt; dort bleibt es
   *     beim Crunchyroll-Abruf und bei der Handarbeit. Die Zusicherung steht
   *     unten als `laeuft`, nicht als Kommentar.
   *  3. **Nur Netflix.** Für Crunchyroll widerspricht die Quelle sich selbst,
   *     für ADN ist der Sprachcode `vde` je Folge besser — beide liegen im
   *     Haus. Prime Video und Disney+ werden geholt und ausgewiesen, aber nicht
   *     übernommen, solange die Kontrollmessung sie nicht trägt.
   */
  const motn = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
  const heuteMotn = todayIso()
  let motnBelege = 0
  if (Object.keys(motn.shows ?? {}).length) {
    /**
     * Läuft zu diesem Titel gerade etwas?
     *
     * Der Status wird nie gespeichert, sondern immer gegen heute gerechnet
     * (`shared/logic.ts`) — also auch hier, statt aus einem Feld gelesen.
     */
    const laeuft = new Set<number>()
    for (const release of releases) {
      if (releaseStatus(release, heuteMotn) === 'airing') laeuft.add(release.titleId)
    }

    const alle = [...titles.values()]
    const belege = ordneShowsZu(
      alle,
      motn.shows,
      (t) => (t.franchiseId ? staffelnDesFranchise(alle, t.franchiseId) : []),
      { passtZuSerie, bewerteTreffer, volltreffer },
      tmdbZuordnung(readJson('data/tmdb-titles.json', {}), motn.tmdb),
    )

    let ausgelassenLaufend = 0
    for (const beleg of belege) {
      if (beleg.deutsch && beleg.eindeutig && laeuft.has(beleg.titleId)) ausgelassenLaufend++
      if (!uebernehmbar(beleg, laeuft.has(beleg.titleId), heuteMotn)) continue
      const stream = titles.get(beleg.titleId)?.streams.find((s) => s.platform === beleg.platform)
      if (!stream || stream.dub !== undefined) continue
      stream.dub = true
      motnBelege++
    }
    log(
      `${motnBelege} Synchro-Angaben über die Streaming Availability API belegt ` +
        `(${Object.keys(motn.shows).length} Serien im Bestand, ${ausgelassenLaufend} laufende ausgelassen)`,
    )
  }

  /**
   * Was ADN uns längst gesagt hat — nachgelesen im eigenen Archiv.
   *
   * ADN nennt je Folge die Sprachen (`vde` = deutsche Synchro, `vostde` =
   * Untertitel), und die Rohantworten liegen seit dem 11.08.2026 unter
   * `data/adn-raw/`. Ein `dub: true` entstand daraus bisher aber nur auf einem
   * Umweg: über einen **Release**. Wo kein Termin herauskam — Katalogtitel,
   * Filme, OVAs —, blieb der Verweis bei „🇩🇪 ?", obwohl die Auskunft im Haus lag
   * (am 21.08.2026 bei 63 von 161 ADN-Verweisen).
   *
   * Wie eng ausgewertet wird und warum das keine menschliche Prüfung ersetzt,
   * steht in `lib/adn-sprachen.ts`. Hier zählt nur die Reihenfolge: Der Block
   * läuft **nach** `dub-confirmed.yaml` und rührt nur an, was noch `undefined`
   * ist. Ein Beispiel dafür, warum das nicht anders geht, ist KILL BLUE — der
   * Verweis trägt `dub: true` aus einer Anime2You-Meldung über eine Synchro ab
   * dem 24.08.2026, während das Archiv vom 21.08. zu Recht zwölf Folgen ohne
   * `vde` führt. Beide Angaben stimmen; die jüngere gewinnt.
   */
  // `pflegen`: Der Bau ist der einzige Lauf, der das Gedächtnis fortschreiben
  // darf — die Checks lesen dieselbe Quelle und dürfen sie nicht verändern.
  /**
   * **Joyn ist ein deutscher Anbieter — dort läuft nichts auf Japanisch.**
   *
   * Daniel am 02.09.2026: „join titel immer als deutsch markieren. deutscher
   * anbieter, da ist immer alles deutsch." Der Kasten zeigte davor „🇩🇪 ?" mit
   * dem Vermerk „Der Anbieter macht dazu keine öffentliche Angabe" — richtig
   * über die Auskunftslage, falsch über die Sache.
   *
   * Das ist kein Raten: Joyn gehört zu ProSiebenSat.1 und führt sein Programm
   * für ein deutschsprachiges Publikum. Was dort im Katalog steht, ist
   * synchronisiert; ein OmU-Angebot gibt es nicht. Die Aussage stammt aus
   * derselben Quelle wie jede Zeile in `dub-confirmed.yaml` — von jemandem, der
   * nachgesehen hat.
   *
   * **Ein von Hand geprüfter Eintrag schlägt das trotzdem.** Die Bedingung
   * `dub === undefined` sorgt dafür: Wo jemand etwas anderes festgestellt hat,
   * bleibt es stehen.
   */
  {
    let joynJa = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'joyn' || stream.dub !== undefined) continue
        stream.dub = true
        joynJa++
      }
    }
    if (joynJa) log(`${joynJa} Joyn-Verweis(e) als deutsch gesetzt — deutscher Anbieter`)
  }

  /**
   * **Alte ADN-Adressen bekommen ihre Serienkennung — vor der Auswertung.**
   *
   * `animationdigitalnetwork.de/video/<slug>` trägt keine Kennung, und der
   * Namensteil ist teils französisch (`50-nuances-de-gras` für „Plus-Sized
   * Elf"). `beurteileAdnVerweis` steigt dort aus, obwohl die Serie im Archiv
   * liegt: Gemessen am 06.09.2026 bekamen **48 von 135** ADN-Verweisen kein
   * Urteil aus dem Archiv, 33 davon allein aus diesem Grund. (Im Datensatz
   * sichtbar offen waren zwölf — der Rest trägt sein `dub` aus einer anderen
   * Quelle und wäre bei deren Ausfall genauso stumm.)
   *
   * Die Kennung wird nicht gesucht, sondern nachgeschlagen — zwei Quellen, und
   * keine davon rät:
   *
   * - **Der Katalog** trägt je Serie eine `anilistId`. Sie entsteht in
   *   `fetch-adn.ts` über `bewerteTreffer`/`passtZuSerie`, wird je Serie nur
   *   einmal vergeben und ist damit dieselbe Zuordnung, aus der die übrigen
   *   ADN-Adressen im Bestand stammen. 33 der 65 alten Adressen sind so
   *   aufgelöst.
   * - **`data/adn-adressen.yaml`** für Serien, die der Katalog gerade nicht
   *   führt — die Liste ist gemessen, nicht geschätzt.
   *
   * Wirkung im selben Lauf gemessen: 38 Adressen berichtigt, danach 31 belegte
   * Ja und 6 belegte Nein; genau ein Verweis bleibt offen, weil seine Serie
   * gemischt ist (Chained Soldier, 1 von 24 Folgen mit `vde`).
   *
   * **Umgeschrieben wird nur die Serienadresse.** Ein Folgenverweis behält
   * seine alte Form, siehe `adnAdresseMitKennung`.
   */
    /**
     * **Serien, die der Katalog gerade nicht führt.**
     *
     * `data/adn-adressen.yaml` hält je AniList-Kennung die ADN-Serienkennung
     * fest — gemessen über `gw.api.animationdigitalnetwork.com/show/<id>` mit
     * `X-Target-Distribution: de`, nicht über einen Seitenaufruf: Beide
     * ADN-Domains antworten jedem Skript mit 403, die alte wie die neue.
     */
    const adnAdressen: Record<number, number> = (() => {
      try {
        const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-adressen.yaml'), 'utf8'))
        const raus: Record<number, number> = {}
        for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
          if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
          raus[Number(k)] = Number(v)
        }
        return raus
      } catch {
        return {}
      }
    })()
    /**
   * **Titel ohne eigenes ADN-Release — die Staffel steht dann hier.**
   *
   * Die Staffel kommt sonst aus dem Release-Slug (`adn-461-s3-20231001`). Zu
   * manchen Titeln gibt es kein ADN-Release; ihr Verweis zeigt auf die nackte
   * Serienkennung und bekommt den Befund „gemischt" — richtig und unbrauchbar.
   *
   * `data/adn-staffelzuordnung.yaml` hält je AniList-Kennung die ADN-Staffel
   * fest, belegt über die **Folgenzahl** und nur dort, wo sie eindeutig ist.
   * Gemessen am 07.09.2026 an JoJo (Serie 444): Staffel 1 hat 26 Folgen,
   * Staffel 2 achtundvierzig, Staffel 3 und 4 je 39 — die ersten drei unserer
   * fünf Titel sind damit eindeutig, die beiden 39er ausdrücklich nicht.
   */
  const adnStaffeln: Record<number, string> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/adn-staffelzuordnung.yaml'), 'utf8'))
      const raus: Record<number, string> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || !Number.isFinite(Number(v))) continue
        raus[Number(k)] = String(v)
      }
      return raus
    } catch {
      return {}
    }
  })()
  const katalogKennung = new Map<number, number>()
    // Derselbe Katalog wie oben, samt den dort verworfenen Zuordnungen.
    for (const s of adnKatalog.shows) {
      if (s.anilistId && !katalogKennung.has(s.anilistId)) katalogKennung.set(s.anilistId, s.showId)
    }
    /**
     * **Die Staffel steht im Release-Slug — und sie entscheidet das Urteil.**
     *
     * Eine ADN-Serienkennung ist ein Franchise: 461 führt alle
     * Haikyu!!-Staffeln, 444 alle vier JoJo-Blöcke. Ein Verweis auf die nackte
     * Serie bekommt deshalb „gemischt" — richtig und unbrauchbar.
     *
     * Die Staffel liegt längst im Haus: `adn-461-s3-20231001` steht als Slug an
     * jedem ADN-Release, und sie stammt aus `staffelBloecke()`, das über die
     * **Folgenzahl** zuordnet. Sie wird hier also nicht ermittelt, sondern
     * abgelesen — und nur, wenn sie eindeutig ist: Nennen zwei Releases
     * desselben Titels verschiedene Blöcke, bleibt der Verweis, wie er ist.
     *
     * Gemessen am 06.09.2026: 25 weitere Verweise bekommen so ein Ja. Übrig
     * bleiben acht, deren Serie gemischt ist und zu denen kein ADN-Release
     * existiert — dort sagt niemand, welche Staffel gemeint ist.
     */
    const ausRelease = new Map<number, { show: number; staffel?: string } | null>()
    for (const release of releases) {
      if (release.platform !== 'adn') continue
      const teile = /^adn-(\d+)(?:-s(\d+))?/.exec(release.slug)
      if (!teile) continue
      const jetzt = { show: Number(teile[1]), staffel: teile[2] }
      const bisher = ausRelease.get(release.titleId)
      if (bisher === undefined) ausRelease.set(release.titleId, jetzt)
      else if (bisher && (bisher.show !== jetzt.show || bisher.staffel !== jetzt.staffel)) {
        // Zwei Blöcke, kein eindeutiger Bezug — dann lieber keine Schärfung.
        ausRelease.set(release.titleId, null)
      }
    }
    let berichtigt = 0
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const ausSlug = ausRelease.get(title.id) ?? undefined
        const kennung = adnAdressen[title.id] ?? katalogKennung.get(title.id) ?? ausSlug?.show
        const neu = adnAdresseSchaerfen(stream.url, { kennung, staffel: ausSlug?.staffel })
        if (!neu) continue
        stream.url = neu
        berichtigt++
      }
    }
    if (berichtigt) log(`${berichtigt} ADN-Adressen um Serienkennung oder Staffel geschärft`)
    if (adnVerweiseErgaenzt) log(`${adnVerweiseErgaenzt} ADN-Verweise aus ADN-Terminen angelegt`)
  /**
   * **RTL+ hat seine Domain gewechselt — die alten Adressen zeigen ins Leere.**
   *
   * aniSearch führt zu zehn Titeln einen Verweis der Form
   * `www.tvnow.de/serien/<slug>-<nummer>`. TVNow heißt seit dem Umbau
   * `plus.rtl.de`, und die alten Adressen leiten **auf die Startseite** um —
   * gemessen am 07.09.2026: alle zehn antworten mit HTTP 200 und landen auf
   * `https://plus.rtl.de/`. Wer im Kalender darauf klickt, steht vor dem ganzen
   * Katalog statt vor der Serie.
   *
   * `data/rtlplus-befunde.json` weiß das seit dem 22.08.2026 für zwei davon
   * (`lebt: false`, `aufStartseite: true`) — der Befund wurde nur nie
   * angewandt. Dieselbe Klasse Fehler wie beim Handbeleg und bei den
   * ADN-Adressen: **ein Befund, den niemand liest, ist kein Befund.**
   *
   * Die neuen Adressen stehen in `data/rtlplus-adressen.yaml`, je Titel
   * einzeln über RTL+' Sitemaps belegt und mit dem `<title>` der Zielseite
   * gegengelesen.
   */
  const rtlAdressen: Record<number, string> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/rtlplus-adressen.yaml'), 'utf8'))
      const raus: Record<number, string> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || typeof v !== 'string' || !v) continue
        raus[Number(k)] = v
      }
      return raus
    } catch {
      return {}
    }
  })()
  {
    let ersetzt = 0
    for (const title of titles.values()) {
      const slug = rtlAdressen[title.id]
      if (!slug) continue
      for (const stream of title.streams) {
        if (stream.platform !== 'rtlplus' || !/tvnow\.de/.test(stream.url)) continue
        stream.url = `https://plus.rtl.de/${slug}`
        ersetzt++
      }
    }
    if (ersetzt) log(`${ersetzt} RTL+-Adressen von der abgeschalteten Domain tvnow.de umgestellt`)
  }

  /**
   * **Dieselbe Schärfung noch einmal, für alles, was später dazukommt.**
   *
   * Die Runde oben läuft, bevor `build.ts` ganz unten die Anbieter aus
   * aniSearch ergänzt. Ein ADN-Verweis, der dort entsteht, wird von ihr nie
   * berührt — er behält seine Slug-Adresse, `beurteileAdnVerweis` findet
   * nichts im Archiv, und der Verweis bleibt bei „🇩🇪 ?".
   *
   * Gemessen am 07.09.2026: **sieben** solche Verweise, darunter sechs, deren
   * Kennung seit dem 06.09. in `data/adn-adressen.yaml` steht — die Datei war
   * gepflegt und wirkungslos. Das ist derselbe Fehlgriff wie beim Handbeleg
   * einen Tag zuvor: **Wer unten ergänzt, muss unten auch schärfen und
   * beurteilen.**
   */
  const adnStreamSchaerfen = (titleId: number, stream: { platform: string; url: string }): boolean => {
    if (stream.platform !== 'adn') return false
    const ausSlug = ausRelease.get(titleId) ?? undefined
    const kennung = adnAdressen[titleId] ?? katalogKennung.get(titleId) ?? ausSlug?.show
    /* Der Release-Slug zuerst — er stammt aus der laufenden Zuordnung; die Datei
       ist für die Titel, zu denen es kein Release gibt. */
    const staffel = ausSlug?.staffel ?? adnStaffeln[titleId]
    const neu = adnFolgenAdresse(stream.url, adnArchiv) ?? adnAdresseSchaerfen(stream.url, { kennung, staffel })
    if (!neu) return false
    stream.url = neu
    return true
  }


  const adnArchiv = ladeAdnArchiv({ pflegen: true })
  {
    // Folgenverweise auf die alte Domain — Begründung an `adnFolgenAdresse`.
    let umgestellt = 0
    for (const title of titles.values())
      for (const stream of title.streams) {
        if (stream.platform !== 'adn') continue
        const neu = adnFolgenAdresse(stream.url, adnArchiv)
        if (!neu) continue
        stream.url = neu
        umgestellt++
      }
    if (umgestellt) log(`${umgestellt} ADN-Folgenverweise von animationdigitalnetwork.de auf ADNs eigene Adresse umgestellt`)
  }
  if (adnArchiv.serien.size) {
    let adnJa = 0
    let adnNein = 0
    const adnOffen: string[] = []
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'adn' || stream.dub !== undefined) continue
        const befund = beurteileAdnVerweis(stream.url, adnArchiv)
        if (befund.dub === undefined) {
          adnOffen.push(`${title.id}: ${befund.grund}`)
          continue
        }
        stream.dub = befund.dub
        if (befund.dub) adnJa++
        else adnNein++
      }
    }
    log(
      `${adnJa + adnNein} ADN-Verweise aus dem Archiv belegt (${adnJa}× deutsche Synchro, ${adnNein}× nur Untertitel; ` +
        `${adnArchiv.folgenMitVde} von ${adnArchiv.folgenGesamt} Folgen aus ${adnArchiv.serien.size} Serien tragen vde)`,
    )
    // Die offenen Fälle stehen im Protokoll, damit sie nicht still liegenbleiben:
    // Das Archiv wächst mit jedem Montagslauf, und was heute fehlt, kann nächste
    // Woche beantwortet sein.
    if (adnOffen.length) log(`${adnOffen.length} ADN-Verweise bleiben offen — ${adnOffen.join('; ')}`)
  }

  /**
   * **Ein ADN-Katalogeintrag mit gleichem Namen und gleicher Folgenzahl belegt Deutsch.**
   *
   * `data/adn-catalog.json` enthält **nur Serien mit deutschen Folgen**, und in
   * ihren `episodes` stehen **ausschließlich** die deutschen — der Katalog-Lauf
   * filtert vor dem Schreiben auf `vde`. Das steht so in `fetch-adn.ts`, und
   * `episodeAus()` schreibt deshalb bewusst kein `languages`-Feld.
   *
   * **Genau daran bin ich am 29.08.2026 gescheitert**, und der Irrtum gehört
   * hierher: Eine Auswertung suchte in den Katalogfolgen nach `vde`, fand in
   * allen 4.078 nichts und meldete „0 von 113 deutsch" für JoJo — während
   * CLAUDE.md „113 von 152 mit vde" festhält. Das sah nach einem Widerspruch in
   * den Daten aus und war ein Messfehler: gesucht nach einem Feld, das dort nie
   * steht. **Wahr ist das Gegenteil — jede Folge im Katalog ist deutsch.**
   *
   * Was diese Runde löst: Unser Bestand führt ADN unter zwei Adressformen, 70
   * mit Kennung und 65 als Slug aus aniSearch. Die Slugs finden über die
   * Adresse keinen Anschluss an den Katalog; über **Name und Folgenzahl**
   * finden sie ihn.
   *
   * **Zwei Sperren:** Der Name muss eindeutig treffen (ein Katalogtitel, nicht
   * zwei), und die Folgenzahl muss übereinstimmen. „JoJo's Bizarre Adventure"
   * hat bei uns 26 Folgen, der Katalogeintrag 113 — das ist die Sammelserie
   * aller Staffeln und bleibt offen.
   *
   * Nur Ja: Ein Titel, den der Katalog **nicht** führt, hat dort vielleicht
   * trotzdem etwas — der Katalog ist ein Ausschnitt, keine Gesamtschau.
   */
  {
    const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const katalog = readJson<{ shows?: { title?: string; originalTitle?: string; episodes?: unknown[] }[] }>(
      'data/adn-catalog.json',
      {},
    ).shows ?? []
    const nachName = new Map<string, { titel: string; folgen: number }[]>()
    for (const s of katalog) {
      const folgen = (s.episodes ?? []).length
      if (!folgen) continue
      for (const n of [s.title, s.originalTitle]) {
        if (!n) continue
        const k = norm(n)
        if (!nachName.has(k)) nachName.set(k, [])
        nachName.get(k)!.push({ titel: n, folgen })
      }
    }
    let ausKatalog = 0
    for (const title of titles.values()) {
      const stream = title.streams.find((s) => s.platform === 'adn' && s.dub === undefined)
      if (!stream) continue
      const namen = [title.titleDe, title.titleEn, title.titleRomaji].filter(Boolean).map((n) => norm(n))
      const treffer = namen.map((n) => nachName.get(n)).find(Boolean)
      if (!treffer || treffer.length !== 1) continue
      if (treffer[0]!.folgen !== title.episodes) continue
      stream.dub = true
      ausKatalog++
    }
    if (ausKatalog) {
      log(`${ausKatalog} ADN-Verweise über den Katalog belegt (Name und Folgenzahl treffen)`)
    }
  }

  /**
   * Anbieter ohne deutsche Synchro fliegen ganz raus.
   *
   * Bis zum 15.08.2026 blieben sie stehen und trugen ein rotes „🇩🇪 ✕" — die
   * Begründung war, die Auskunft „dort nur Originalton" sei ja brauchbar. Für
   * diese Seite ist sie es nicht: Sie beantwortet **eine** Frage, und zwar wo
   * ein Anime auf Deutsch zu sehen ist. Daniel am 15.08.2026: „wir
   * interessieren uns als app nur für deutsche synchros, keine anderen
   * synchron sprachen".
   *
   * Betroffen sind nur Verweise mit einem **belegten** Nein — aus
   * `dub-confirmed.yaml` oder aus der Folgenliste einer Serienseite. Ein
   * unbeantwortetes `undefined` bleibt selbstverständlich stehen; das ist der
   * Normalfall und heißt „wir wissen es nicht", nicht „dort gibt es keine".
   */
  let ohneDeutsch = 0
  for (const title of titles.values()) {
    const raus = title.streams.filter((s) => s.dub === false)
    if (!raus.length) continue
    title.streams = title.streams.filter((s) => s.dub !== false)
    ohneDeutsch += raus.length
    for (const s of raus) {
      verweiseEntfernt.push({
        titleId: title.id,
        titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
        plattform: s.platform,
        url: s.url,
        seriesId: null,
        grund: 'belegtes Nein: dort gibt es keine deutsche Tonspur',
        geprueftAm: null,
        entferntAm: todayIso(),
        letzterWeg: title.streams.length === 0,
      })
    }
    // `watchLinks` tragen keine Sprachangabe — sie sind Shops und Nischendienste,
    // zu denen niemand die Tonspur belegt. Sie bleiben unangetastet.
  }
  if (ohneDeutsch) log(`${ohneDeutsch} Verweise ohne deutsche Synchro entfernt`)
  return { adnArchiv, adnStreamSchaerfen, motnBelege }
}
