import { readJson, log } from '../lib/util.ts'
import { type WatchLink, type StreamLink, type Title } from '../../shared/types.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { plattformVon } from '../lib/cartoons.ts'
import { providerToPlatform } from './titel-hilfen.ts'

export function ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}) {
  /**
   * **Bei YouTube gilt eine Pille erst ab einer belegten Synchro.**
   *
   * Daniel am 07.09.2026 an „Kill Blue": „youtube hat nur untertitel, also weg
   * damit, wir führen nur >1 folge synchro pillen dort."
   *
   * YouTube ist der einzige Anbieter im Bestand, bei dem ein Verweis meist auf
   * eine **Playlist** zeigt, und was darin liegt, ist überwiegend untertitelt —
   * Trailer, Werbefolgen, ganze Staffeln mit Untertiteln. Ein „🇩🇪 ?" behauptet
   * dort nichts Falsches und ist trotzdem irreführend: Es sieht aus wie ein
   * Weg zur deutschen Fassung, und in aller Regel ist es keiner.
   *
   * Bei jedem anderen Anbieter bleibt das Fragezeichen richtig, und diese
   * Regel gilt ausdrücklich nur für YouTube. Der Unterschied ist die
   * Trefferquote: Bei Netflix oder Prime führt ein unbeantworteter Verweis in
   * aller Regel zu einer Seite, auf der es die Serie wirklich gibt.
   *
   * **Ins Gedächtnis der entfernten Verweise kommt das nicht.** Es ist kein
   * belegtes Nein, sondern eine fehlende Auskunft — sobald eine Prüfung sie
   * liefert, gehört der Weg zurück.
   */
  /**
   * **Ein Titel ohne jeden Bezugsweg — was JustWatch dazu kennt.**
   *
   * 243 Titel im Hauptbestand hatten am 07.09.2026 keinen einzigen Weg. Für
   * sie beantwortet der Kalender Punkt 4 des Projektziels gar nicht („Nicht
   * nur wann, auch wo"), und das ist bei den meisten Titeln **die** Frage: Nur
   * gut hundert haben überhaupt einen anstehenden Termin.
   *
   * `data/justwatch-audio.json` nennt zu jedem Angebot eine Adresse. Sie
   * kommen hier als **Bezugswege** an, nicht als Verweise mit Sprachurteil:
   * Die Tonspurangabe gilt der Serie, nicht der Folge, und daraus wird
   * grundsätzlich kein `dub`.
   *
   * Vier Riegel, jeder mit belegtem Anlass:
   *
   * | Riegel | warum |
   * |---|---|
   * | nur Titel **ohne** jeden Weg | wo schon einer steht, ist die Frage beantwortet — und unsere Adresse ist die geprüfte |
   * | nichts, was einmal entfernt wurde | sonst kommt ein belegtes Nein über die Hintertür zurück |
   * | „JustWatch TV" fliegt raus | die Eigenwerbung des Dienstes, führt zurück auf justwatch.com |
   * | höchstens vier je Titel | eine Liste von zwölf Amazon-Varianten beantwortet keine Frage |
   */
  /**
   * Händler, die bei JustWatch eine **Disc** verkaufen oder verleihen. Alle übrigen
   * Kauf- und Leihangebote dort sind digital. Belegt an den Anbietern im Bestand vom
   * 16.09.2026; Videobuster steht hier, weil es vor allem Discs per Post verleiht.
   */
  const PHYSISCHE_SHOPS =
    /amazon dvd|blu-ray|thalia|hugendubel|buecher|zavvi|jpc|zoxs|medimops|verleihshop|behind the tree|videobuster/i
  let jwWege = 0
  {
    const jw = readJson<
      Record<string, { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string }[] }>
    >('data/justwatch-audio.json', {})
    for (const title of titles.values()) {
      if ((title.streams ?? []).length || (title.watchLinks ?? []).length) continue
      /* JustWatch findet den Titel über dieselbe TMDB-Kennung — mehrdeutig heißt auch hier: nicht verwenden. */
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const b = jw[String(title.id)]
      if (!b || b.ohneTreffer || !b.angebote?.length) continue
      const wege: WatchLink[] = []
      for (const a of b.angebote) {
        if (!a.url || /^justwatch/i.test(a.anbieter)) continue
        if (toteAdressen.has(a.url)) continue
        const name = providerName(a.anbieter)
        if (!name || wege.some((w) => w.name === name)) continue
        /*
          **Ein Kino ist kein Bezugsweg** (Daniel, 19.09.2026: Cinestar führte nach Leipzig,
          Filmspiegel nach Essen). JustWatch kennzeichnet Kinoangebote selbst mit `art: CINEMA`
          (gemessen: Cinestar 3, UCI 2, Filmspiegel 1) — das ist sicherer als eine Namensliste,
          die „Netzkino" (ein Streamingdienst) mitgeschluckt hat. Die Spielzeiten stehen im
          Kinobanner, bundesweit über kinoheld.
        */
        if (a.art === 'CINEMA') continue
        /*
          JustWatch führt Disc-Händler und Online-Videotheken in derselben Liste. Ein
          Disc-Händler bleibt ein Kaufweg; alles andere ist digital und zählt zum
          Streamen — gemessen an 3.279 Kauf- und Leihangeboten im Bestand vom 16.09.2026.
        */
        const physisch = PHYSISCHE_SHOPS.test(a.anbieter)
        wege.push({
          name,
          /* JustWatch hängt an Amazon-Links seine Partnerkennung (`tag=movie0c6-21`). */
          url: stripAffiliate(a.url),
          kind: physisch ? 'buy' : 'stream',
          ...(physisch
            ? {}
            : { zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf' }),
        } as WatchLink)
        if (wege.length >= 4) break
      }
      if (!wege.length) continue
      title.watchLinks = wege
      jwWege += wege.length
    }
  }
  if (jwWege) log(`${jwWege} Bezugswege aus JustWatch für Titel ohne jeden Weg ergänzt`)

  /**
   * **Ein Abo-Angebot mit belegtem deutschem Ton kommt auch dazu, wenn der Titel schon Wege
   * hat** (Daniel, 23.09.2026: „ja").
   *
   * Die Runde darüber ergänzt nur Titel **ohne jeden** Weg — eine Regel gegen Listen von zwölf
   * Amazon-Varianten. Sie ließ 40 Angebote liegen, bei denen JustWatch die deutsche Tonspur je
   * Angebot ausweist: One Piece bei Disney+, Naruto Shippuden und Trigun bei Prime, Dragon Ball
   * Super: Broly bei Disney+, wo wir nur Crunchyroll und Prime zeigen (gemessen 23.09.2026:
   * 24 Prime, 9 Crunchyroll, 7 Disney+).
   *
   * Drei Riegel halten die Pillenreihe schmal und die Aussage belegt:
   *
   * 1. Nur **Abo** (`FLATRATE`/`ADS`) — Kauf und Leihe stehen weiter in `watchLinks`.
   * 2. Nur mit `audio`, das `de` enthält. Ein Angebot ohne Sprachangabe belegt nichts
   *    (CLAUDE.md: „Eine Zahl am Weg braucht einen Beleg an genau diesem Weg").
   * 3. Nur Anbieter, die wir als Plattform führen, und höchstens **zwei** je Titel.
   *
   * Der Weg trägt `dub: true` — die Tonspur ist die Auskunft, wegen der er überhaupt dazukommt.
   */
  {
    const jw = readJson<
      Record<string, { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string; audio?: string[] }[] }>
    >('data/justwatch-audio.json', {})
    /**
     * **Eine Handprüfung hat das letzte Wort** (Lauf 35900967510, 23.09.2026).
     *
     * Der erste Anlauf dieser Runde legte vier Wege an, die jemand von Hand geprüft und
     * verneint hatte: Free! und Free!: Eternal Summer bei Crunchyroll („ohne deutsche
     * Tonspur"), AIR GEAR Special und Girls und Panzer Specials bei Prime („nicht
     * verfügbar"). `check:handbelege` hat den Bau dafür zu Recht rot gemacht — genau dafür
     * gibt es die Prüfung.
     *
     * JustWatch weiß, was ein Anbieter **listet**. Wer nachgesehen hat, weiß, was dort
     * wirklich läuft. Bei einem Widerspruch gewinnt das Nachsehen.
     */
    const handNein = new Set<string>()
    for (const b of loadDubChecks()) {
      if (b.dub === false || b.available === false) handNein.add(`${b.anilistId}|${b.platform}`)
    }
    let ergaenzt = 0
    for (const title of titles.values()) {
      const b = jw[String(title.id)]
      if (!b || b.ohneTreffer || !b.angebote?.length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const vorhanden = new Set((title.streams ?? []).map((x) => x.platform))
      let neueHier = 0
      for (const a of b.angebote) {
        if (neueHier >= 2) break
        if (a.art !== 'FLATRATE' && a.art !== 'ADS') continue
        if (!(a.audio ?? []).includes('de')) continue
        if (!a.url || toteAdressen.has(a.url)) continue
        /*
          **Ein Amazon-Kanal ist nicht der Anbieter selbst** (gemessen 23.09.2026, bevor das
          live ging): `plattformVon()` vergleicht mit `startsWith`, und „RTL+ Max Amazon
          Channel" beginnt nun einmal mit „RTL+". Von 112 Kandidaten waren 68 solche Kanäle —
          ihre Adresse führt zu `watch.amazon.de`, die Pille hätte „RTL+" behauptet und Amazon
          geöffnet. Wer den Kanal gebucht hat, sieht den Weg ohnehin über Prime.
        */
        if (/Amazon Channel/i.test(a.anbieter)) continue
        const plattform = plattformVon(a.anbieter)
        if (!plattform || vorhanden.has(plattform)) continue
        if (handNein.has(`${title.id}|${plattform}`)) continue
        title.streams = [
          ...(title.streams ?? []),
          {
            platform: plattform,
            url: stripAffiliate(a.url),
            dub: true,
            ...(a.art === 'ADS' ? { zugang: 'kostenlos' as const } : { zugang: 'abo' as const }),
          } as StreamLink,
        ]
        vorhanden.add(plattform)
        neueHier++
        ergaenzt++
      }
    }
    if (ergaenzt) log(`${ergaenzt} Abo-Weg(e) aus JustWatch ergänzt (deutsche Tonspur belegt)`)
  }

  /*
    **Ein Bezugsweg führt zum Anbieter, nicht zu einer Datenbank.**

    Die Pille „maxdome · 2 Angebote" öffnete `themoviedb.org/movie/347200-3/watch`
    statt `store.maxdome.de/mo45163184` (Daniel, 16.09.2026, mit drei Bildern:
    „stattdessen direkt zu maxdome leiten → generisch fixen"). Der Kommentar an
    der erzeugenden Stelle nennt den Grund und war bis heute richtig: „Einen Link
    je Anbieter liefert TMDB nicht, nur eine Übersichtsseite."

    **JustWatch liefert ihn** — dieselbe Datenbasis, eine Ebene tiefer:
    `data/justwatch-audio.json` führt je Angebot eine Adresse beim Anbieter
    selbst. Gemessen am 16.09.2026: 1.187 Bezugswege zeigen auf themoviedb.org
    (Apple TV 248, freenet 213, MagentaTV 168, Videoload 148, maxdome 97 …),
    verteilt auf 364 Titel. Von den zehn, die JustWatch schon kennt, ließen sich
    16 von 20 Wegen ersetzen.

    Ersetzt wird nur, was zum selben Anbieter gehört. **Überholt am 22.09.2026:**
    Bis dahin blieb die Übersichtsseite stehen, wo JustWatch schwieg. Seitdem fällt
    sie weg (Videoload über die MagentaTV-Kennung ausgenommen) — siehe den Block
    „Kein Weg auf eine Datenbank" weiter unten.
  */
  let jwDirekt = 0
  let jwNeu = 0
  {
    const jw = readJson<
      Record<string, { angebote?: { anbieter: string; art?: string; url?: string; audio?: string[] }[] }>
    >('data/justwatch-audio.json', {})
    const kern = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const title of titles.values()) {
      const wege = title.watchLinks
      if (!wege?.length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      for (const w of wege) {
        if (!/themoviedb.org/.test(w.url)) continue
        const treffer = angebote.find(
          (a) => a.url && (kern(a.anbieter).includes(kern(w.name)) || kern(w.name).includes(kern(a.anbieter))),
        )
        if (!treffer?.url || toteAdressen.has(treffer.url)) continue
        w.url = stripAffiliate(treffer.url)
        delete w.ueberTmdb
        jwDirekt++
      }
    }
    /*
      **Auch Titel mit Wegen bekommen JustWatchs übrige Angebote** (Daniel, 17.09.2026,
      zu Apple TV). TMDBs Anbieterliste ist dieselbe Datenbasis, aber je Titel teils
      Wochen alt; JustWatch fragt der Wochenlauf jetzt reihum. Übernommen wird nur,
      was keine eigene Plattform hat (die haben Verweise mit Sprachurteil) und noch
      nicht als Weg dasteht — dieselben Regeln wie für Titel ohne jeden Weg.
    */
    for (const title of titles.values()) {
      if (!(title.streams ?? []).length && !(title.watchLinks ?? []).length) continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      const wege = title.watchLinks ?? []
      for (const a of angebote) {
        if (!a.url || /^justwatch/i.test(a.anbieter) || toteAdressen.has(a.url)) continue
        if (providerToPlatform(a.anbieter)) continue
        const name = providerName(a.anbieter)
        if (!name || wege.some((w) => w.name === name)) continue
        /*
          Nur digital. Gemessen am 17.09.2026: 728 der 781 zusätzlichen Wege wären
          Disc-Händler gewesen (bücher.de, Thalia, Zavvi …) — ohne Angabe zur Ausgabe,
          Zavvi verkauft UK-Importe. Kinos sind keine Bezugswege.
        */
        if (PHYSISCHE_SHOPS.test(a.anbieter) || a.art === 'CINEMA') continue
        wege.push({
          name,
          url: stripAffiliate(a.url),
          kind: 'stream',
          zugang: a.art === 'FLATRATE' ? 'abo' : a.art === 'FREE' || a.art === 'ADS' ? 'kostenlos' : 'kauf',
        } as WatchLink)
        jwNeu++
      }
      if (wege.length) title.watchLinks = wege.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'stream' ? -1 : 1))
    }
    /*
      **Bei einem Film ist JustWatchs Tonspur eine Aussage über das Werk** (17.09.2026).

      Für Serien gilt sie nicht als Beleg, und das bleibt so: Sie hängt am Titel, unsere
      Frage hängt an der Folge (07.09.2026). Ein Film hat genau eine Einheit — damit
      entfällt der Grund. Daniel an „Your Name.": „maxdome hat nachweislich deutsche
      synchro", während die Pille „DE ?" trug, obwohl JustWatch für dieses Angebot
      `audio: de` meldet.

      Gewertet wird nur das Angebot **dieses** Anbieters, und nur das Ja: Ein Angebot
      ohne deutschen Ton kann eine Ausgabe unter mehreren sein, und ein fehlendes „de"
      bleibt Schweigen. Gemessen: 435 Bezugswege in 231 Filmen.
    */
    let jwFilmDe = 0
    for (const title of titles.values()) {
      if (title.format !== 'MOVIE') continue
      if (tmdbMehrdeutig.has(String(title.id))) continue
      const angebote = jw[String(title.id)]?.angebote ?? []
      if (!angebote.length) continue
      for (const w of title.watchLinks ?? []) {
        if (w.dubRanges?.length) continue
        const passend = angebote.filter(
          (a) => kern(a.anbieter).includes(kern(w.name)) || kern(w.name).includes(kern(a.anbieter)),
        )
        if (!passend.some((a) => (a.audio ?? []).includes('de'))) continue
        w.dubRanges = [{ from: 1, to: 1, dub: true }]
        jwFilmDe++
      }
    }
    if (jwFilmDe) log(`${jwFilmDe} Film-Bezugswege mit deutschem Ton belegt (JustWatch je Angebot)`)
  }
  if (jwNeu) log(`${jwNeu} Bezugswege aus JustWatch bei Titeln ergänzt, die schon Wege hatten`)
  if (jwDirekt)
    log(`${jwDirekt} Bezugswege zeigen jetzt direkt zum Anbieter statt auf die TMDB-Übersicht`)

  /**
   * **Kein Weg auf eine Datenbank — Videoload über die MagentaTV-Kennung, der Rest fällt weg.**
   *
   * Daniel am 22.09.2026 an „Ame & Yuki": „videoload linkt auf tmdb, das ist falsch, es muss
   * direkt zum anbieter linken." Das kehrt die Entscheidung vom 16.09.2026 um („wo JustWatch
   * schweigt, bleibt die Übersichtsseite stehen").
   *
   * Gemessen am selben Tag: 389 Pillen bei 202 Titeln zeigten auf themoviedb.org (Videoload 146,
   * YouTube 100, Google Play 97, …). JustWatch hatte alle 202 Titel geprüft und nannte **keinen**
   * dieser Anbieter dafür — Videoload führt es gar nicht, obwohl es den Dienst gibt.
   *
   * **Videoload und MagentaTV sind derselbe Telekom-Katalog mit derselben Gracenote-Kennung:**
   * `magenta.tv/film/ame-and-yuki-die-wolfskinder/GN_MV026220360000` ↔
   * `videoload.de/film/ame-and-yuki-die-wolfskinder/GN_MV026220360000`. So ließen sich 136 der
   * 146 Videoload-Pillen richten. Die Seite ist eine Browser-Anwendung und antwortet auch auf
   * erfundene Kennungen mit 200 — belegt hat es deshalb Daniel von Hand, 4 von 4 (Wolfskinder,
   * Der Junge und der Reiher, Cowboy Bebop: Der Film, Final Fantasy VII: Advent Children).
   * **Videoload gilt als deutsch** — dieselbe Regel wie bei Joyn. Daniel am 22.09.2026:
   * „videoload hat .de als domain, und es ist telekom deutschland, und ich hab katalog
   * durchstöbert, wir können annehmen das alle de sind, bis wir irgendwann ein gegenteil
   * beweisen." Ein Weg mit eigener Angabe (`dubRanges`) behält sie.
   *
   * **Was danach noch auf TMDB zeigt, bleibt — gekennzeichnet** (`ueberTmdb`, Pille „… (über TMDB)").
   * Die Angebote sind echt: TMDBs Liste ist JustWatchs Partner-Export und vollständiger als unsere
   * JustWatch-Abfrage; nur die Adresse gibt TMDBs API nicht heraus, und die Übersichtsseite sperrt
   * Claude per robots.txt (docs/wissen/quellen.md). Daniel am 22.09.2026: „anbieter info haben wir,
   * also das als ersten weg umsetzen … youtube im label lassen, aber in klammern (über tmdb)".
   * Zuerst die direkte Adresse, erst dann der gekennzeichnete Umweg.
   */
  let videoloadDirekt = 0
  let youtubeDirekt = 0
  let videoloadDeutsch = 0
  let datenbankWege = 0
  {
    const jwAlle = readJson<Record<string, { angebote?: { url?: string }[] }>>('data/justwatch-audio.json', {})
    /* YouTube-Kaufangebote aus `fetch-youtube-kauf.ts` — nur genaue Treffer („YouTube Movies", gleicher Titel). */
    const ytKaufListe = readJson<Record<string, { video?: string }>>('data/youtube-kauf.json', {})
    for (const title of titles.values()) {
      const wege = title.watchLinks
      if (!wege?.length) continue
      for (const w of wege) {
        const ytVideo = ytKaufListe[String(title.id)]?.video
        if (w.name === 'YouTube' && ytVideo && /themoviedb\.org/.test(w.url)) {
          w.url = `https://www.youtube.com/watch?v=${ytVideo}`
          /* Ein Video von „YouTube Movies" ist Kauf oder Leihe (`zugangsart.ts`), auch wo TMDB „Abo" meldete. */
          w.zugang = 'kauf'
          delete w.ueberTmdb
          youtubeDirekt++
          continue
        }
        if (w.name !== 'Videoload' || !/themoviedb\.org/.test(w.url)) continue
        /*
          Film: `magenta.tv/film/<slug>/GN_MV…`. Serie: `magenta.tv/serie/<slug>/staffel-1/GN_SEASON_…`
          — der Staffelteil geht mit (Evangelion von Hand belegt, 22.09.2026; Videoload schreibt
          selbst auf `staffel-01` um). Ohne ihn liefen die 7 Serien als „ohne Kennung" durch.
        */
        const magenta = [...wege.map((x) => x.url), ...(jwAlle[String(title.id)]?.angebote ?? []).map((a) => a.url ?? '')]
          .map((u) => /magenta\.tv\/((?:film|serie)\/[^/?#]+(?:\/staffel-\d+)?\/GN_[A-Z0-9_]+)/i.exec(u))
          .find(Boolean)
        if (!magenta) continue
        w.url = `https://www.videoload.de/${magenta[1]}`
        delete w.ueberTmdb
        videoloadDirekt++
      }
      /* Neben einem direkten Weg desselben Anbieters ist der TMDB-Weg doppelt (Videoload von Hand). */
      const direkt = new Set(wege.filter((w) => !/themoviedb\.org/.test(w.url)).map((w) => w.name))
      title.watchLinks = wege.filter((w) => !/themoviedb\.org/.test(w.url) || !direkt.has(w.name))
      for (const w of title.watchLinks) {
        if (!/themoviedb\.org/.test(w.url)) continue
        w.ueberTmdb = true
        datenbankWege++
      }
      for (const w of title.watchLinks) {
        if (w.name !== 'Videoload' || w.dubRanges?.length) continue
        w.dubRanges = [{ from: 1, to: title.format === 'MOVIE' ? 1 : Math.max(1, title.episodes ?? 1), dub: true }]
        videoloadDeutsch++
      }
    }
  }
  if (videoloadDirekt) log(`${videoloadDirekt} Videoload-Wege über die MagentaTV-Kennung direkt verlinkt`)
  if (youtubeDirekt) log(`${youtubeDirekt} YouTube-Wege direkt zum Kaufangebot verlinkt (data/youtube-kauf.json)`)
  if (videoloadDeutsch) log(`${videoloadDeutsch} Videoload-Wege als deutsch gesetzt — deutscher Anbieter`)
  if (datenbankWege) log(`${datenbankWege} Wege ohne direkte Anbieteradresse als „über TMDB" gekennzeichnet`)
}
