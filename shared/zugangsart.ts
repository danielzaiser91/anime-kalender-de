/**
 * Wie kommt man an einen Titel heran — kostenlos, mit Abo, oder gegen Geld?
 *
 * Daniel am 23.08.2026: „wir brauchen bereich streaming und disc, und unter
 * streaming die kategorien kostenlos, abo, kauf/leih."
 *
 * Bis dahin kannte der Datensatz nur zwei Werte: `stream` und `buy`. Das trennte
 * Ansehen von Erwerben, aber nicht **Abo** von **kostenlos** — und beides ist für
 * einen Besucher etwas völlig anderes. Wer kein Netflix hat, dem nützt ein
 * Netflix-Eintrag nichts; wer die Folge bei ZDF frei sehen kann, will das oben
 * stehen haben.
 */

/** Streaming, unterteilt nach dem, was es kostet. */
export type Zugangsart = 'kostenlos' | 'abo' | 'kauf'

/**
 * Anbieter, bei denen man ohne Abo und ohne Zahlung sieht.
 *
 * Öffentlich-rechtliche Mediatheken, werbefinanzierte Dienste, offene
 * YouTube-Kanäle. Der Fall „YouTube" ist zweigeteilt: Ein hochgeladenes Video
 * ist kostenlos, ein Film bei YouTube Movies kostet — deshalb entscheidet dort
 * die Adresse, nicht der Name.
 */
const KOSTENLOS = new Set([
  'ard',
  'zdf',
  'youtube',
  'pluto tv',
  'toggo',
  'kixi',
  'filmfriend',
  'pokémon tv',
  'pokemon tv',
  'x',
  'vimeo',
])

/** Dienste, die ein laufendes Abonnement verlangen. */
const ABO = new Set([
  'netflix',
  'crunchyroll',
  'primevideo',
  'prime video',
  'disneyplus',
  'disney+',
  'adn',
  'aniverse',
  'wow',
  'joyn',
  'rtlplus',
  'rtl+',
  'akibapass',
  'paramount+',
  'shahid vip',
  'hbo max',
  'hbomax',
  'sooner',
  'wetv',
  'iqiyi',
  'arthouse cnma',
])

/**
 * Was JustWatch über ein Angebot sagt, wie TMDB es ausliefert.
 *
 * `flatrate` = im Abo enthalten, `rent` = leihen, `buy` = kaufen. Beide
 * Bezahlformen landen in derselben Kategorie `kauf`; Daniels Vorgabe vom
 * 23.08.2026 nennt genau drei Stufen („kostenlos, abo, kauf/leih").
 */
export type JustWatchArt = 'flatrate' | 'rent' | 'buy'

/**
 * Die Zugangsart eines Verweises.
 *
 * **Die Rangfolge ist der ganze Punkt.** Eine gemessene Angabe schlägt jede
 * Namensliste:
 *
 * 1. `justwatch` — die lizenzierte Angabe aus TMDB. Sie sagt für **diesen
 *    Titel bei diesem Anbieter**, was er kostet, statt für den Anbieter im
 *    Allgemeinen. Prime Video führt beides nebeneinander: Vieles steckt im
 *    Abo, „DEATH NOTE" und „FAIRY TAIL" stehen hinter der Kasse.
 * 2. `kind` aus den `watchLinks` — was der Anbieter selbst als Kauf ausweist.
 * 3. Der Name, über die Listen `KOSTENLOS` und `ABO`.
 *
 * Bleibt alles stumm, gilt `abo` — bei Anime der Normalfall und die
 * vorsichtigere Annahme: Wer faelschlich ein Abo erwartet, verpasst nichts;
 * wer faelschlich „kostenlos" liest, aergert sich an der Kasse.
 *
 * Vor dem 23.08.2026 entschied allein der Name. Das war bei 28 von 774
 * belegbaren Verweisen falsch — alle bei Prime Video, alle als „abo"
 * geraten, tatsaechlich Kauf oder Leihe. Die Quelle lag die ganze Zeit im
 * Datensatz (`data/tmdb-titles.json`, Feld `offers`) und wurde nur fuer die
 * kleinen Anbieter ausgewertet.
 */
export function zugangsart(
  name: string,
  kind?: 'stream' | 'buy',
  url?: string,
  justwatch?: JustWatchArt,
  kanal?: string,
): Zugangsart {
  const n = name.toLowerCase().trim()
  // „Crunchyroll über Prime Video" ist ein Kanal — bezahlt wird das Abo dahinter.
  const kern = n.split(' über ')[0]!.trim()

  // Gemessen schlägt geraten. Auch `flatrate` zählt hier: Es widerlegt einen
  // falschen Kauf-Verdacht aus der Adresse genauso, wie `buy` ein falsches Abo
  // widerlegt.
  if (justwatch === 'rent' || justwatch === 'buy') return 'kauf'
  if (justwatch === 'flatrate') return 'abo'

  if (kind === 'buy') return 'kauf'
  /**
   * Bei YouTube entscheidet der **Kanal**, nicht die Adresse.
   *
   * „YouTube Movies" ist der Verleih-Kanal: Was dort liegt, kostet Geld. Seine
   * Videos tragen aber gewöhnliche `watch?v=…`-Adressen — die Prüfung auf
   * `/movies` im Pfad greift bei ihnen nicht. Gemessen am 23.08.2026 standen
   * deshalb **40 Titel als „kostenlos"**, die in Wahrheit gekauft oder geliehen
   * werden müssen; der Kalender schickte Leute an eine Kasse, die er als
   * Gratisangebot angekündigt hatte.
   *
   * Der Kanalname liegt seit dem 22.08. in `data/youtube-befunde.json`
   * (`author_name` aus YouTubes oEmbed) — er wurde nur nie ausgewertet.
   */
  if (kern === 'youtube' && kanal && /^(youtube movies|movies & tv)$/i.test(kanal.trim())) return 'kauf'
  // Der ältere Weg über die Adresse bleibt: Er greift bei Verleih-Playlists,
  // die keinen Kanalnamen im Bestand haben.
  if (kern === 'youtube' && url && /\/(movies|playlist\?list=PL[A-Za-z0-9_-]*movie)/i.test(url)) return 'kauf'
  if (KOSTENLOS.has(kern)) return 'kostenlos'
  if (ABO.has(kern)) return 'abo'
  return 'abo'
}

/** Für die Anzeige: der Bereich, unter dem ein Verweis steht. */
export function bereich(platform: string): 'streaming' | 'disc' | 'kino' {
  if (platform === 'disc') return 'disc'
  if (platform === 'kino') return 'kino'
  return 'streaming'
}
