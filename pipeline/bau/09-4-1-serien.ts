import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { beurteile, type CrDubData, type CrSerie } from '../lib/crunchyroll-dub.ts'
import { kennungAusZiel } from '../lib/crunchyroll-api.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

/**
 * **Alle Titel, an denen diese Crunchyroll-Serie hängt — über die Adresse *und* die Kennung**
 * (28.09.2026).
 *
 * `nachUrl.get(serie.url)` fand nichts, wenn der Dub-Bestand die Seite anders schreibt als der
 * Datensatz: Perfect Blue stand dort unter `…/de/fr/series/GZJH3D8V3/…` (französischer
 * Sprachcode, aus der Zeit vor dem `germanizeUrl`-Fix), bei uns als
 * `…/de/series/GZJH3D8V3/…`. Kein Zeichen stimmte, die Schleife lief leer, der tote Verweis
 * blieb stehen — und kam nach dem Adresswechsel sogar zurück. Die **Serienkennung** ist die
 * Identität; Sprache und Slug sind Beiwerk. Der genaue Adressvergleich bleibt für Serien ohne
 * Kennung.
 */
function betroffeneTitel(nachUrl: Map<string, Title[]>, serie: CrSerie): Title[] {
  const betroffen = new Map<number, Title>()
  for (const t of nachUrl.get(serie.url) ?? []) betroffen.set(t.id, t)
  if (serie.seriesId) {
    for (const [url, ts] of nachUrl) {
      if (kennungAusZiel(url) !== serie.seriesId) continue
      for (const t of ts) betroffen.set(t.id, t)
    }
  }
  return [...betroffen.values()]
}

/** Gehört dieser Verweis zu dieser (toten) Serie? Adresse **oder** Kennung genügt. */
function gehoertZurSerie(stream: Title['streams'][number], serie: CrSerie): boolean {
  return (
    stream.platform === 'crunchyroll' &&
    (stream.url === serie.url ||
      (Boolean(serie.seriesId) && kennungAusZiel(stream.url) === serie.seriesId))
  )
}

export function ordneCrSerienZu({ titles, crDub, usNeinWiderlegt, verweiseEntfernt }: {
  titles: Map<number, Title>
  crDub: CrDubData
  usNeinWiderlegt: (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null; }) => boolean
  verweiseEntfernt: EntfernterVerweis[]
}) {
    const nachUrl = new Map<string, Title[]>()
    for (const title of titles.values()) {
      for (const stream of title.streams) {
        if (stream.platform !== 'crunchyroll') continue
        const liste = nachUrl.get(stream.url) ?? []
        liste.push(title)
        nachUrl.set(stream.url, liste)
      }
    }
    let belegt = 0
    let verschwunden = 0
    let usNeinOffen = 0
    /**
     * Was entfernt wurde, und warum — der Datenbestand behält es.
     *
     * Daniel am 27.08.2026: „wenn du für tracking zwecke intern die links
     * weiterhin benötigst kannst du sie im datenbestand bestehen lassen und
     * entsprechend markieren. auf der webseite sichtbar für user sollten sie
     * jedenfalls nicht werden."
     *
     * `data/` ist der Bestand, `public/data/` die Auslieferung. Die Trennung
     * ist genau die gewünschte: Hier steht jeder entfernte Verweis mit Grund
     * und Prüfdatum, ausgeliefert wird er nicht.
     */
    /* Die Liste steht weiter oben auf Funktionsebene — auch spätere
       Entfernungen sollen hineinschreiben, nicht nur die dieses Blocks. */
    for (const serie of crDub.serien) {
      /**
       * „Leider sind die Videos dieser Serie nicht mehr verfügbar."
       *
       * Crunchyroll sagt es selbst — dann gibt es dort kein Angebot mehr, und
       * ein Verweis darauf führt Besucher ins Leere. Das ist `available: false`
       * und ausdrücklich **nicht** `dub: false`: Es fehlt das Angebot, nicht die
       * deutsche Fassung (Daniel, 21.08.2026, an „Dragon Ball" gezeigt).
       *
       * Der Verweis wird entfernt, so wie bei jeder anderen toten Adresse auch.
       * Kommt die Serie zurück, bringt der nächste Katalogabruf sie mit.
       */
      /**
       * **Kein Block im deutschen Katalog heißt: dort läuft nichts.**
       *
       * Bis zum 27.08.2026 galt nur Crunchyrolls ausdrückliches „Leider sind
       * die Videos dieser Serie nicht mehr verfügbar" als Nein. Daneben stand
       * ein zweiter Fall, der genauso endet und nichts auslöste: Die
       * Content-API antwortet mit HTTP 200 und **null Staffeln**.
       *
       * 287 unserer Verweise sind so. Der Grund, sie stehen zu lassen, war
       * Vorsicht: Der erste Beleg war lange Crunchyrolls Fehlerseite aus
       * **US**-Sicht, und `CLAUDE.md` verlangt deshalb einen zweiten. Der liegt
       * jetzt vor, und beide stammen aus Deutschland:
       *
       *  1. Die Content-API mit deutschem Token (`katalog: de`) findet unter
       *     der Serienkennung keine einzige Staffel.
       *  2. Die Suche im deutschen Katalog findet den Titel nicht — während
       *     dieselbe Suche „Detektiv Conan", „Fairy Tail", „Frieren" und
       *     „JUJUTSU KAISEN" auf Anhieb und exakt trifft.
       *
       * Dazu Daniels Augenschein vom 27.08.2026 an drei Stichproben aus seiner
       * angemeldeten deutschen Sitzung — Witch Hunter Robin, Trinity Blood,
       * Chrono Crusade: dreimal „Keine Videos verfügbar", mit Bild.
       *
       * Seine Ansage dazu: „auf unserem kalender sollen nur funktionierende
       * links angezeigt werden." Ein Verweis, der auf eine Fehlermeldung führt,
       * ist schlechter als kein Verweis — er kostet einen Klick und liefert
       * nichts.
       *
       * **Verloren geht dabei nichts.** Was entfernt wird, steht mit Grund und
       * Datum in `data/verweise-entfernt.json`; kommt die Serie zurück, bringt
       * der nächste Katalogabruf sie mit, denn der liest den Katalog, nicht
       * unseren Bestand.
       *
       * Zwei Bedingungen halten die Regel eng: Es braucht eine **Serienkennung**
       * (sonst wurde gar nicht richtig gefragt) und den **deutschen** Katalog
       * (`katalog: de`). Ein Befund aus dem US-Katalog entfernt weiterhin nichts
       * — das ist genau der Fehler, vor dem `CLAUDE.md` warnt.
       */
      const ohneBlock = Boolean(serie.seriesId) && serie.katalog === 'de' && !(serie.staffeln ?? []).length
      if (usNeinWiderlegt(serie)) {
        usNeinOffen++
        continue
      }
      if (serie.nichtVerfuegbar || ohneBlock) {
        for (const title of betroffeneTitel(nachUrl, serie)) {
          const vorher = title.streams.length
          title.streams = title.streams.filter((s) => !gehoertZurSerie(s, serie))
          const weg = vorher - title.streams.length
          verschwunden += weg
          if (weg) {
            verweiseEntfernt.push({
              titleId: title.id,
              titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
              plattform: 'crunchyroll',
              url: serie.url,
              seriesId: serie.seriesId ?? null,
              grund: serie.nichtVerfuegbar
                ? 'Crunchyroll meldet: Videos dieser Serie nicht mehr verfügbar'
                : 'deutscher Katalog führt unter dieser Kennung keine einzige Staffel',
              geprueftAm: serie.geprueftAm ?? null,
              entferntAm: todayIso(),
              /* Bleibt der Titel danach ganz ohne Weg? Das gehoert ins Protokoll. */
              letzterWeg: title.streams.length === 0,
            })
          }
        }
        continue
      }
      for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
        const title = titles.get(urteil.titleId)
        const stream = title?.streams.find((s) => s.platform === 'crunchyroll' && s.url === serie.url)
        if (!stream || stream.dub !== undefined) continue
        stream.dub = urteil.dub
        belegt++
      }
    }
  return { nachUrl, belegt, verschwunden, usNeinOffen }
}
