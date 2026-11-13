import { werkTitel } from './titel-hilfen.ts'
import { log } from '../lib/util.ts'
import { type WatchLink, type Title } from '../../shared/types.ts'
import {
  stripAffiliate,
  anisearchPlatform,
  providerName,
  providerKind,
  PLATFORM_PRIORITY,
} from '../../shared/mappings.ts'
import { entwirreWeiterleitung, adressePasst, plattformAusAdresse } from '../../shared/adresse-passt.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'
import type { TitelDe } from '../lib/titel-de.ts'
import { uebernehmeTitelDeVonHand } from './03-2-titel-de-hand.ts'

export function uebernehmeAnisearchUndDeutscheTitel({ handTitel, titles, anisearch, tmdbTitles, toteAdressen }: {
  handTitel: TitelDe[]
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  toteAdressen: Set<string>
}) {
  // Anbieter von aniSearch dazunehmen. Die decken genau die Lücke, die AniList
  // lässt: alte Katalogtitel, die nur noch als DVD oder bei einem kleinen
  // Dienst zu haben sind.
  let fremdeAdressen = 0
  let umsortiert = 0
  uebernehmeTitelDeVonHand({ handTitel, titles })

  let deutscheTitel = 0
  let deutscheTitelTmdb = 0
  let netflixOhneKennung = 0
  for (const title of titles.values()) {
    const extra = anisearch[title.id]

    /**
     * Der deutsche Name des Werks — die Antwort auf „warum finde ich das nicht".
     *
     * aniSearch ist eine deutsche Datenbank und führt den Titel je Sprache.
     * Für AniList 169969 steht dort:
     *
     *     Japanisch   Mushoku no Eiyuu: Betsu ni Skill nanka Iranakattan da ga
     *     Englisch    Hero Without a Class: Who Even Needs Skills?!
     *     Deutsch     Der Held ohne Klasse: Der Aufstieg eines Talentlosen
     *
     * Genau danach hat Daniel am 24.08.2026 gesucht und nichts gefunden — der
     * Anime stand im Kalender, aber unter seinem japanischen Namen. Die Suche
     * im Frontend liest `titleDe` längst; es war nur bei **99 von 2.762**
     * Titeln gefüllt, während diese Datei für **2.553** einen deutschen Namen
     * hergibt. Die Daten lagen seit Tagen im Repo und wurden nie ausgewertet.
     *
     * Steht hier derselbe Text wie im englischen Feld, ist das kein Fehler: Ein
     * Werk, das hier unter seinem englischen Namen läuft, heißt eben so.
     *
     * **Ein vorhandener Wert bleibt unangetastet** — ein kuratierter oder vom
     * Anbieter gemeldeter Titel ist näher am Sprachgebrauch als ein
     * Datenbankeintrag.
     */
    if (!title.titleDe) {
      const de = (extra?.info?.languages ?? []).find((l) => /deutsch/i.test(l.language ?? ''))
      if (de?.title?.trim()) {
        title.titleDe = werkTitel(de.title.trim())
        deutscheTitel++
      }
    }

    /*
      **TMDB als zweite Quelle für den deutschen Titel.**

      194 Titel hatten am 28.08.2026 keinen — `titleDe` kam allein aus aniSearch.
      TMDB antwortet auf `language=de-DE` mit dem deutschen Namen, wenn es einen
      gibt, und **sonst mit dem Originaltitel**. Genau darum wird hier
      verglichen: Stimmt der Name mit einem unserer Originaltitel überein, ist es
      keine Übersetzung, sondern dieselbe Auskunft noch einmal.

      Ein deutscher Titel, der dem englischen gleicht, ist kein Gewinn — er
      füllt nur ein Feld und lässt die Lücke unsichtbar werden.
    */
    if (!title.titleDe && tmdbTitles[title.id]?.nameDe) {
      const kandidat = tmdbTitles[title.id]!.nameDe!.trim()
      const gleichWie = [title.titleEn, title.titleRomaji, title.titleNative]
        .filter(Boolean)
        .map((x) => x!.toLowerCase().replace(/[^a-z0-9]/g, ''))
      const kern = kandidat.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (kandidat && !gleichWie.includes(kern)) {
        title.titleDe = werkTitel(kandidat)
        deutscheTitelTmdb++
      }
    }

    if (!extra?.streams?.length) continue
    const watchLinks: WatchLink[] = []
    for (const { provider, url: raw } of extra.streams) {
      const url = stripAffiliate(entwirreWeiterleitung(raw))
      const platform = anisearchPlatform(provider)
      if (platform) {
        /**
         * Der Name nennt den Anbieter, die Adresse muss ihn auch tragen.
         *
         * Bei aniSearch stehen beide getrennt, und sie gehören nicht immer
         * zusammen: Unter „Crunchyroll" fanden sich am 22.08.2026 ein
         * Amazon-Link („Attack on Titan: The Roar of Awakening") und eine
         * Google-Weiterleitung („NANA"). Beide landeten als Crunchyroll-Verweis
         * im Datensatz und kosteten bei jedem Abruflauf einen Aufruf, ohne je
         * etwas zu liefern.
         */
        let ziel = platform
        if (!adressePasst(url, platform)) {
          /**
           * Nicht wegwerfen, sondern richtig einsortieren.
           *
           * Von 33 falsch einsortierten Adressen zeigten am 22.08.2026 alle auf
           * Amazon — 30 unter „Aniverse", 3 unter „Crunchyroll". Sie zu
           * verwerfen hätte 33 gültige Kaufwege gekostet. Nur was zu **gar
           * keinem** bekannten Anbieter führt, fällt raus.
           */
          const echt = plattformAusAdresse(url)
          if (!echt) {
            fremdeAdressen++
            continue
          }
          ziel = echt
          umsortiert++
        }
        // Kennt unsere Plattformliste den Dienst, gehört er zu den Streams —
        // aber nur, wenn dort nicht schon ein Link steht.
        if (!title.streams.some((s) => s.platform === ziel)) {
          title.streams.push({ platform: ziel, url })
        }
        continue
      }
      // Ein Anbieter genügt einmal. Zwei Amazon-Zeilen nebeneinander sind
      // keine Auswahl, sondern Rauschen — aniSearch führt dort oft mehrere
      // Ausgaben desselben Titels.
      const name = providerName(provider)
      // Leerer Name heißt: der Anbieter gehört nicht auf eine deutsche Seite.
      if (!name) continue
      if (!watchLinks.some((w) => w.name === name)) {
        /*
          **Zeigt die Adresse auf eine einzelne Folge, sagt der Weg das.**

          Bei „Banana Fish" führt die Akibapass-Pille auf
          `…/exklusive-dub-previews/videos/banana-fish-s1e01-…` — eine
          Dub-Vorschau der ersten Folge. Im Panel sah sie aus wie ein Weg zur
          ganzen Serie, daneben stand als Termin der 06.11.2026 (Daniel,
          12.09.2026: „folge 1 jetzt, rest 06.11.").

          Erkannt wird nur, was die Adresse selbst nennt — `s1e01`, `folge-1`,
          `episode-3`. Drei Wege im Bestand tragen so etwas; alles Weitere wäre
          Raten über fremde Adressen.
        */
        const nurFolge = Number(/(?:s\d+e|episode-|folge-|-ep-?)(\d{1,3})(?:[^\d]|$)/i.exec(url)?.[1])
        watchLinks.push({
          name,
          url,
          kind: providerKind(provider),
          ...(Number.isFinite(nurFolge) && nurFolge > 0 ? { nurFolge } : {}),
        })
      }
    }
    if (watchLinks.length) {
      // Ansehen vor Kaufen — wer ein Abo hat, will nicht erst zur Kasse.
      title.watchLinks = watchLinks
        .filter((w) => !toteAdressen.has(w.url))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }
  if (netflixOhneKennung) log(`${netflixOhneKennung} Netflix-Verweise ohne Kennung entfernt — sie führen ins Leere`)
  if (deutscheTitelTmdb) log(`${deutscheTitelTmdb} deutsche Titel von TMDB ergänzt (aniSearch hatte keinen)`)
  if (umsortiert) log(`${umsortiert} aniSearch-Verweise umsortiert: Adresse gehört zu einem anderen Anbieter als dem genannten`)
  if (fremdeAdressen) log(`${fremdeAdressen} aniSearch-Verweise verworfen: Adresse führt zu gar keinem bekannten Anbieter`)
  return { netflixOhneKennung }
}
