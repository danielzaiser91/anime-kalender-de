import { log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'

export function entferneSuchadressen({ titles, crAdresseZu, beantworteteSuchen, suchOffen }: {
  titles: Map<number, Title>
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
}) {
  /**
   * **Und was am Ende noch auf eine Suche zeigt, fliegt.**
   *
   * Die Reparatur weiter oben hat den Katalog gefragt, die Runden dazwischen
   * hatten jede Gelegenheit, eine echte Titelseite einzusetzen. Was hier noch
   * steht, ist eine Suche — und die ist als Auskunft schlechter als nichts:
   * Sie sieht aus wie ein Weg und endet auf „Es konnte nichts gefunden werden".
   *
   * Die Frage dahinter geht deshalb nicht verloren, sie wechselt den Ort:
   * `daniel-zum-abarbeiten/listen/18-suchadressen.md`.
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
}

export function entferneStummeYoutubeWege({ titles }: {
  titles: Map<number, Title>
}) {
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
}
