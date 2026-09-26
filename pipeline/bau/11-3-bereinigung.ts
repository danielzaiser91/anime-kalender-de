import { type WatchLink, type Title } from '../../shared/types.ts'
import { providerName } from '../../shared/mappings.ts'
import { log, readJson } from '../lib/util.ts'
import { schreibeSuchadressen } from './nebendateien.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

export function bereinigeWege({
  titles,
  anisearch,
  toteAdressen,
  linkBefunde,
  verweiseEntfernt,
  crAdresseZu,
  beantworteteSuchen,
  suchOffen,
}: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  toteAdressen: Set<string>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  verweiseEntfernt: EntfernterVerweis[]
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
}) {
  /**
   * **Und dieselbe Frage an aniSearch — sie kennt Wege, die JustWatch nicht hat.**
   *
   * Gemessen am 10.09.2026: 236 Titel zeigen keinen einzigen Weg, und zu zwölf
   * davon führt `data/anisearch.json` eine Quelle. JustWatch kennt nur einen
   * einzigen davon — seine Datei deckt 351 Titel ab, unser Bestand 2.768.
   *
   * Die Riegel sind dieselben wie beim Block darüber, und der wichtigste ist
   * der erste: **nur wo gar nichts steht.** Wo ein geprüfter Verweis existiert,
   * ist er die bessere Auskunft; hier geht es um die Titel, bei denen der
   * Kalender auf „wo läuft das" nichts antwortet.
   *
   * **YouTube bleibt draußen**, und das ist kein Versehen: Ein Kanal zeigt dort
   * regelmäßig die untertitelte Fassung, und ein Weg ohne Sprachurteil ist
   * genau die Halbwahrheit, gegen die Punkt 1 des Projektziels steht (16 solche
   * Verweise sind am 07.09.2026 entfernt worden). Sieben der zwölf sind
   * YouTube-Fälle — sie bleiben ungezeigt, bis eine Tonspur belegt ist.
   */
  let asWege = 0
  for (const title of titles.values()) {
    if ((title.streams ?? []).length || (title.watchLinks ?? []).length) continue
    const quellen = anisearch[title.id]?.streams ?? []
    if (!quellen.length) continue
    const wege: WatchLink[] = []
    for (const quelle of quellen) {
      const url = (quelle.url ?? '').split('?')[0]
      const anbieter = String(quelle.provider ?? '')
      if (!url || /youtube/i.test(anbieter)) continue
      if (toteAdressen.has(url)) continue
      /* Die aniSearch-Kennung trägt ein `-de` am Ende, das `providerName()` nicht kennt. */
      const name = providerName(anbieter.replace(/-de$/, ''))
      if (!name || /^Primevideo/i.test(name) || wege.some((w) => w.name === name)) continue
      wege.push({ name, url, kind: 'stream' })
      if (wege.length >= 4) break
    }
    if (!wege.length) continue
    title.watchLinks = wege
    asWege += wege.length
  }
  if (asWege) log(`${asWege} Bezugswege aus aniSearch für Titel ohne jeden Weg ergänzt`)

  /*
    **Dieselbe Prüfung ein zweites Mal — nach der letzten Runde, die Wege anlegt.**

    Der Filter gegen tote Adressen steht rund 2.500 Zeilen weiter oben und
    arbeitet dort richtig. Nur entstehen Bezugswege danach noch dreimal: aus
    aniSearchs Kanal-Angeboten, aus JustWatch und aus aniSearch für Titel ohne
    jeden Weg. Was dort neu dazukommt, hat der Filter nie gesehen.

    Gemessen am 16.09.2026: **96 Bezugswege** zeigten auf Adressen, die
    data/link-check.json als 404 führt — der von Daniel gemeldete seit dem
    20.08.2026. Er klickte bei „Code Geass" auf „Amazon Prime (Crunchyroll)"
    und landete auf Amazons Fehlerseite: „fix das generisch."

    Das ist der Fall, den diese Akte unter „Wer unten ergänzt, muss unten auch
    beurteilen" führt (06.09.2026) — hier zum dritten Mal, diesmal für die
    Bezugswege. Die frühe Filterung bleibt trotzdem stehen: Ohne sie gälte ein
    toter Weg zwischenzeitlich als Weg, und die Runden für „Titel ohne jeden
    Weg" sprängen nicht an.
  */
  /*
    **Ein Werk ohne jedes Datum läuft noch nirgends.** Princess Principal: Crown
    Handler, Kapitel 5 und 6, tragen bei AniList weder Start noch Jahr, standen
    aber mit „Crunchyroll DE ?" im Datensatz: Crunchyroll führt alle Kapitel
    unter der Adresse der Reihe, und die Adresse wandert von Titel zu Titel
    (Stichprobe 17.09.2026). Ein Verweis ohne belegtes Deutsch fällt hier weg;
    ein angekündigter Titel **mit** Termin bleibt unberührt, denn dessen Seite
    gibt es beim Anbieter oft schon vor dem Start.
  */
  let ohneDatumWeg = 0
  for (const title of titles.values()) {
    if (title.jpStart || title.jpYear) continue
    const vorher = title.streams.length
    title.streams = title.streams.filter((s) => s.dub === true)
    ohneDatumWeg += vorher - title.streams.length
  }
  if (ohneDatumWeg) log(`${ohneDatumWeg} Verweise ohne Sprachbeleg bei Titeln ohne jedes Datum entfernt`)

  let toteWegeSpaet = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => {
      const status = linkBefunde[w.url]?.status
      return !(status === 404 || status === 'region')
    })
    toteWegeSpaet += vorher - title.watchLinks.length
    if (!title.watchLinks.length) delete title.watchLinks
  }
  if (toteWegeSpaet)
    log(`${toteWegeSpaet} Bezugswege entfernt, die nach der ersten Prüfung dazukamen und ins Leere führen`)

  /*
    **Ein digitaler Shop ist ein Stream, egal welche Runde ihn angelegt hat.** Die
    TMDB- und JustWatch-Runden ordnen seit dem 16.09.2026 richtig ein; aniSearchs
    Bezugsquellen und `watch-links.yaml` legten maxdome, Sky Store, Videoload und
    Apple TV weiter als `buy` an — 218 Wege im Disc-Reiter (gemessen am selben Tag,
    „Final Fantasy VII: Advent Children"). „Amazon" bleibt Kauf: Hinter `/dp/` kann
    eine Disc liegen.
  */
  const DIGITALE_SHOPS = /^(maxdome|sky store|videoload|apple tv|google play|rakuten tv|magentatv|freenet meinvod|chili|youtube|amazon video)$/i
  let digitalUmgeordnet = 0
  for (const title of titles.values()) {
    for (const w of title.watchLinks ?? []) {
      if (w.kind !== 'buy' || !DIGITALE_SHOPS.test(w.name ?? '')) continue
      w.kind = 'stream'
      w.zugang ??= 'kauf'
      digitalUmgeordnet++
    }
  }
  if (digitalUmgeordnet) log(`${digitalUmgeordnet} Kaufwege digitaler Shops als Stream eingeordnet`)

  /**
   * **Prime Video führen wir über amazon.de — `primevideo.com` fliegt raus.**
   *
   * Daniel am 07.09.2026 an „City The Animation", mit vier Bildern: Der Titel
   * stand in der „Wo sehen?"-Liste zweimal mit Prime Video, einmal als „DE ✓"
   * (amazon.de) und einmal als „DE ?" (primevideo.com). „entfern alle links /
   * pills / verweise / etc. zu primevideo.com. diese domain unterstützen wir
   * nicht, nur amazon.de wird als ‚prime video' von uns unterstützt".
   *
   * Die Regel gibt es seit dem 08.08.2026 als `isUnusablePrimeLink()`, und sie
   * greift bei den **Verweisen**. Die **Bezugswege** liefen daran vorbei: Sie
   * entstehen aus aniSearchs Quellenliste, und die führt beide Domains. Ein
   * Titel bekam so zwei Prime-Zeilen, von denen die zweite nichts wusste — für
   * einen Besucher sieht das aus wie zwei Angebote.
   *
   * Der Grund für die Regel ist unverändert: Eine ASIN gilt nicht
   * marktübergreifend, und `amazon.de` ist die vertrautere Adresse zur selben
   * Inhalteseite.
   */

  let primeFremd = 0
  for (const title of titles.values()) {
    if (!title.watchLinks?.length) continue
    const vorher = title.watchLinks.length
    title.watchLinks = title.watchLinks.filter((w) => !/(^|\/\/|\.)primevideo\.com\//.test(w.url))
    primeFremd += vorher - title.watchLinks.length
  }
  if (primeFremd) log(`${primeFremd} Bezugswege auf primevideo.com entfernt — Prime Video führen wir über amazon.de`)

  /**
   * **Was als belegtes Nein aus den Verweisen flog, kommt nicht als Bezugsweg zurück.**
   *
   * Gefunden am 07.09.2026 an „7th Time Loop": Der Prime-Verweis wurde wegen
   * des Handbelegs „kein deutscher Ton" entfernt — und derselbe Weg stand als
   * Bezugsweg weiter da, mit „🇩🇪 ?" daneben. Für einen Besucher ist das
   * dieselbe Zeile, nur ohne Wissen; Daniels Punkt war genau diese Pille.
   *
   * Verglichen wird über den Adresskern, denn beide Listen führen dieselbe
   * Adresse mal mit und mal ohne Parameter.
   *
   * **Nur belegte Neins, keine Frist.** Ein Weg, den ein Mensch als „dort
   * nicht auf Deutsch" geprüft hat, gehört nicht in die Antwort auf „wo läuft
   * es auf Deutsch" — und wenn sich das ändert, ändert sich der Handbeleg.
   */
  /**
   * **Eine Adresse, eine Pille.**
   *
   * Daniel am 07.09.2026 an „Kill Blue": „aniverse button führt auf tote seite
   * -> entfernen". Er führte nicht ins Leere — er führte auf **dieselbe**
   * Amazon-Seite wie die Prime-Video-Pille daneben (`B0GTN94C9M`). Wer dort
   * den Aniverse-Kanal sucht, findet ihn nicht, denn die Seite ist das
   * Prime-Angebot.
   *
   * Zwei Zeilen, die auf dieselbe Adresse zeigen, sind keine zwei Auskünfte.
   * Dasselbe Bild wie bei „City The Animation" (zwei Prime-Zeilen) und bei
   * „7th Time Loop" (Verweis entfernt, Bezugsweg blieb) — dreimal am selben
   * Tag, jedes Mal von Daniel gemeldet.
   *
   * Der **Verweis** gewinnt: Er trägt das Sprachurteil und die Zugangsart, der
   * Bezugsweg nur einen Namen. Gemessen sind es 37 Dopplungen.
   */
  let doppelterWeg = 0
  {
    const kern = (u: string): string => {
      const asin = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,26})/i.exec(u)?.[1]
      if (asin) return `amazon:${asin.toLowerCase()}`
      return u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length || !title.streams?.length) continue
      const belegt = new Set(title.streams.map((s) => kern(s.url)))
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !belegt.has(kern(w.url)))
      doppelterWeg += vorher - title.watchLinks.length
    }
  }
  if (doppelterWeg)
    log(`${doppelterWeg} Bezugswege entfernt, die auf dieselbe Adresse zeigen wie ein Verweis desselben Titels`)

  let wegNachNein = 0
  {
    const kern = (u: string): string =>
      u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    const raus = new Set(verweiseEntfernt.map((e) => kern(e.url ?? '')))
    for (const e of readJson<{ verweise?: { url?: string }[] }>('data/verweise-entfernt.json', {}).verweise ?? []) {
      raus.add(kern(e.url ?? ''))
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length) continue
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !raus.has(kern(w.url)))
      wegNachNein += vorher - title.watchLinks.length
    }
  }
  if (wegNachNein) log(`${wegNachNein} Bezugswege entfernt, deren Adresse als belegtes Nein aus den Verweisen flog`)

  /**
   * **Ein YouTube-Verweis bleibt, wenn sein Umfang dransteht — nicht, wenn er groß genug ist.**
   *
   * Die erste Fassung vom 07.09.2026 zählte Folgen: unter zwei belegten flog
   * der Verweis, Anlass war „Kill Blue" („youtube hat nur untertitel, also weg
   * damit, wir führen nur >1 folge synchro pillen dort"). Sechzehn Verweise
   * gingen so.
   *
   * Am selben Abend kam die genauere Vorgabe, mit einem Gegenbeispiel: „season
   * 1 ep 1 date a live, deutsch komplett. füg es hinzu, schreib auch das es nur
   * diese ep unter diesem verweis gibt, sodass kein falscher eindruck
   * entsteht." Ein Verweis auf **eine** Folge ist also kein Problem — der
   * falsche Eindruck ist es. Und der entsteht nicht aus der Zahl, sondern
   * daraus, dass niemand sie sieht.
   *
   * Deshalb entscheidet jetzt, ob der Umfang **ausgewiesen** ist:
   *
   * - keine Bereiche → der Beleg gilt dem ganzen Weg, die Pille sagt „alle
   *   Folgen"; das war schon immer so und bleibt richtig, wo es stimmt;
   * - Bereiche, die bis zur letzten Folge reichen → die Pille nennt die Grenze
   *   („✓ DE nur Fg. 1"), und niemand kann sich verlesen;
   * - Bereiche, die **vor** der letzten Folge enden → genau die Lücke von
   *   „Kill Blue": Belegt sind acht von zwölf, über die übrigen vier sagt
   *   niemand etwas, und die Pille schwiege ebenfalls. Der Verweis fliegt.
   *
   * Ohne bekannte Folgenzahl gibt es nichts zu vergleichen; dann zählt der
   * Beleg, wie bisher.
   */
  let youtubeStumm = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const vorher = title.streams.length
    title.streams = title.streams.filter((s) => {
      if (s.platform !== 'youtube') return true
      if (s.dub !== true) return false
      const bereiche = s.dubRanges ?? []
      if (!bereiche.length) return true
      const gesamt = title.episodes
      if (!gesamt) return true
      /* Reicht die Beschreibung bis zur letzten Folge? Dann steht der Umfang in der Pille. */
      const bisWohin = bereiche.reduce((n, r) => Math.max(n, r.to), 0)
      return bisWohin >= gesamt
    })
    youtubeStumm += vorher - title.streams.length
  }
  if (youtubeStumm)
    log(`${youtubeStumm} YouTube-Verweise entfernt, deren Umfang unbekannt bleibt — dort führen wir nur ausgewiesene Wege`)


  /**
   * **Und was am Ende noch auf eine Suche zeigt, fliegt.**
   *
   * Die Reparatur weiter oben hat den Katalog gefragt, die Runden dazwischen
   * hatten jede Gelegenheit, eine echte Titelseite einzusetzen. Was hier noch
   * steht, ist eine Suche — und die ist als Auskunft schlechter als nichts:
   * Sie sieht aus wie ein Weg und endet auf „Es konnte nichts gefunden werden".
   *
   * Die Frage dahinter geht deshalb nicht verloren, sie wechselt den Ort:
   * `daniel-zum-abarbeiten/18-suchadressen.md`.
   */
  let suchAdressen = 0
  let ausSuche = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
    title.streams = title.streams.filter((stream) => {
      let suche = false
      try {
        const u = new URL(stream.url)
        /* Amazons `/s?k=`, Crunchyrolls `/search?q=`, Netflix' `/search?q=`. */
        suche = /\/search(\/|$)|^\/s$/.test(u.pathname) || u.searchParams.has('k') || u.searchParams.has('q')
      } catch {
        suche = false
      }
      if (!suche) return true
      /*
        **Auch hier wird erst repariert.** Die Suchadresse steht heute nicht
        mehr nur im Bau: Ein früherer Lauf hat sie aus dem Datensatz nach
        `data/crunchyroll-series-ids.json` übernommen, und von dort kommt sie
        zurück. Wer sie nur wegwirft, verliert den Verweis — obwohl der Katalog
        die Adresse kennt.
      */
      if (stream.platform === 'crunchyroll' && name) {
        const echte = crAdresseZu(name)
        if (echte) {
          stream.url = echte
          ausSuche++
          return true
        }
      }
      suchAdressen++
      /*
        Trägt der Titel beim selben Anbieter schon eine Titelseite, ist die Frage
        beantwortet — die Suche fällt weg, ohne auf der Liste zu landen (18.09.2026:
        fünf Suchen blieben offen, nachdem ihre Seiten in `verweise-von-hand.yaml`
        standen).
      */
      const hatSeite = title.streams.some((s) => {
        if (s === stream || s.platform !== stream.platform) return false
        try {
          const v = new URL(s.url)
          return !(/\/search(\/|$)|^\/s$/.test(v.pathname) || v.searchParams.has('k') || v.searchParams.has('q'))
        } catch {
          return false
        }
      })
      if (!hatSeite && !beantworteteSuchen.has(`${title.id}|${stream.platform}`))
        suchOffen.push({ id: title.id, titel: name, plattform: stream.platform, url: stream.url })
      return false
    })
  }
  if (ausSuche) log(`${ausSuche} Suchadressen über den deutschen Katalog auf ihre Serienadresse gesetzt`)
  if (suchAdressen) log(`${suchAdressen} Suchadressen entfernt — eine Suche ist kein Weg zu einem Titel`)
  schreibeSuchadressen(suchOffen)
}
