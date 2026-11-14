import { type WatchLink, type Title } from '../../shared/types.ts'
import { providerName } from '../../shared/mappings.ts'
import { log } from '../lib/util.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type IstTot } from '../lib/adresse-tot.ts'

export function entferneFremdePrimeWege({ titles }: {
  titles: Map<number, Title>
}) {
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
}

export function ordneDigitaleShopsEin({ titles }: {
  titles: Map<number, Title>
}) {
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
}

export function entferneToteWegeSpaet({ titles, linkBefunde }: {
  titles: Map<number, Title>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
}) {
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
}

export function entferneWegeOhneDatum({ titles }: {
  titles: Map<number, Title>
}) {
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
}

export function ergaenzeWegeFuerTitelOhneWeg({ titles, anisearch, istTot }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  istTot: IstTot
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
      if (istTot(url)) continue
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
}
