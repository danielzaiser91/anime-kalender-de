import { readJson, log } from '../lib/util.ts'
import { type WatchLink, type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { providerName, stripAffiliate } from '../../shared/mappings.ts'
import { loadDubChecks, neinHandbelege } from '../lib/dub-confirmed.ts'
import { setzeTelekomAnnahme, type JwAngebot } from '../lib/telekom-annahme.ts'
import { providerToPlatform } from './titel-hilfen.ts'
import { ergaenzeWegeOhneWeg, PHYSISCHE_SHOPS, type JwEintrag } from './11-2-2-wege-ohne-weg.ts'
import { ergaenzeAboWege, type JwAbo } from './11-2-3-abo-wege.ts'
import { ergaenzeKaufWege, primeNeinTitel, type JwKauf } from './11-2-4-kauf-wege.ts'

type Runde = {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}

/* Ein Nein-Handbeleg gilt für alle Runden, die Wege anlegen (Titel ohne Weg, Abo-Weg mit deutschem Ton, Prime-Kauf). */
function legeWegeAn({ titles, tmdbMehrdeutig, toteAdressen }: Runde) {
  const handNein = neinHandbelege(loadDubChecks())
  ergaenzeWegeOhneWeg({
    titles,
    jw: readJson<Record<string, JwEintrag>>('data/justwatch-audio.json', {}),
    handNein,
    tmdbMehrdeutig,
    toteAdressen,
  })

  ergaenzeAboWege({
    titles,
    jw: readJson<Record<string, JwAbo>>('data/justwatch-audio.json', {}),
    handNein,
    tmdbMehrdeutig,
    toteAdressen,
  })

  ergaenzeKaufWege({
    titles,
    jw: readJson<Record<string, JwKauf>>('data/justwatch-audio.json', {}),
    handNein,
    primeNein: primeNeinTitel(),
    tmdbMehrdeutig,
    toteAdressen,
    heute: todayIso(),
  })
}

export function ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen }: Runde) {
  legeWegeAn({ titles, tmdbMehrdeutig, toteAdressen })

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
    const jwAlle = readJson<Record<string, { angebote?: (JwAngebot & { url?: string })[] }>>('data/justwatch-audio.json', {})
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
      videoloadDeutsch += setzeTelekomAnnahme(title, jwAlle[String(title.id)]?.angebote ?? [])
    }
  }
  if (videoloadDirekt) log(`${videoloadDirekt} Videoload-Wege über die MagentaTV-Kennung direkt verlinkt`)
  if (youtubeDirekt) log(`${youtubeDirekt} YouTube-Wege direkt zum Kaufangebot verlinkt (data/youtube-kauf.json)`)
  if (videoloadDeutsch) log(`${videoloadDeutsch} Telekom-Wege (Videoload, MagentaTV) als „Deutsch angenommen“ gekennzeichnet`)
  if (datenbankWege) log(`${datenbankWege} Wege ohne direkte Anbieteradresse als „über TMDB" gekennzeichnet`)
}
