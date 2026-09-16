/**
 * **Das Markenzeichen des Anbieters an seiner Pille.**
 *
 * Daniel am 16.09.2026: „füg kleine icons zu anbietern ein die links an den
 * pills hängen." Die Pille trägt den Namen ohnehin — das Zeichen spart nicht
 * Text, es macht die Reihe auf einen Blick unterscheidbar.
 *
 * **Woher die Zeichen kommen:** [simple-icons](https://simpleicons.org), unter
 * CC0 veröffentlicht, als einfarbige Pfade. Sie liegen bei uns im Repo
 * (`public/anbieter/`) statt als Hotlink — eine fremde Adresse im Ladepfad
 * der eigenen Seite ist dieselbe Falle wie Live-Scraping.
 *
 * **Eingefärbt wird über eine CSS-Maske, nicht über `<img>`.** Ein eingebundenes
 * SVG bleibt schwarz; die Maske nimmt die Form und füllt sie mit der Farbe, die
 * `PLATFORMS` für den Anbieter ohnehin führt. Damit passt das Zeichen in beiden
 * Themen, ohne zwei Dateien.
 */

/** Anbieter-Kennung oder Name eines Bezugswegs → Datei in `public/anbieter/`. */
const DATEI: Record<string, string> = {
  crunchyroll: 'crunchyroll',
  netflix: 'netflix',
  primevideo: 'primevideo',
  youtube: 'youtube',
  rtlplus: 'rtlplus',
  'apple tv': 'apple-tv',
  'google play': 'google-play',
  'rakuten tv': 'rakuten-tv',
  'sky store': 'sky-store',
  'freenet meinvod': 'freenet',
  disneyplus: 'disneyplus',
  'disney+': 'disneyplus',
  adn: 'adn',
  maxdome: 'maxdome',
  'animation digital network': 'adn',
}

/**
 * **Zeichen, die breiter als hoch sind — Verhältnis Breite zu Höhe.**
 *
 * Für Disney+ gibt es kein freies quadratisches Zeichen: simple-icons hat die Marke
 * entfernt, Commons führt nur die Wortmarke („Disney+ 2024", gemeinfrei, 1033×565).
 * In ein Quadrat gezwängt blieb davon ein Strich; in ihrer Breite ist sie lesbar.
 *
 * **ADN hat kein frei lizenziertes Zeichen.** Die Wortmarke stammt von fr.wikipedia
 * („Logo Anime-Digital-Network.svg", dort als nicht freies Markenlogo geführt) und steht
 * hier nur zur Kennzeichnung des verlinkten Anbieters — Daniels Entscheidung vom
 * 16.09.2026, im Wissen um das Restrisiko. Widerspricht ADN, fliegt sie wieder raus.
 */
/*
  maxdome: das Bildzeichen („M") aus „Maxdome Logo (2021).svg" (Commons, videociety GmbH,
  CC BY-SA 4.0), auf das Zeichen zugeschnitten — der Schriftzug stünde neben dem Namen doppelt.
  Als Bild, weil es seine eigenen Blautöne trägt (Daniel, 16.09.2026: „bei maxdome fehlt noch
  das icon").
*/
const BREITE: Record<string, number> = { disneyplus: 1033 / 565, adn: 121 / 44, maxdome: 98 / 44.918 }

/**
 * Der Name eines Bezugswegs trägt manchmal den Kanal in Klammern — „Amazon Prime
 * (Crunchyroll)" ist ein Prime-Weg. Für das Zeichen zählt, wo man landet.
 */
export function anbieterDatei(was: string): string | undefined {
  const kern = was.toLowerCase().replace(/\s*\(.*$/, '').trim()
  if (DATEI[kern]) return DATEI[kern]
  if (kern.startsWith('amazon prime') || kern === 'prime video') return 'primevideo'
  /*
    Ein Kauf bei Amazon ist kein Prime-Weg — er bekommt das „a" des Shops (Commons,
    „Amazon icon.svg", gemeinfrei), nicht das Prime-Zeichen (Daniel, 16.09.2026).
  */
  if (kern.startsWith('amazon')) return 'amazon'
  return undefined
}

/**
 * **Zeichen, die als Bild gezeigt werden — mit ihren eigenen Farben.**
 *
 * Das Prime-Video-Zeichen von simple-icons ist die Wortmarke als Umriss; auf 14 px
 * blieb davon ein unleserlicher Strich (Daniel, 16.09.2026: „prime icon ist müll
 * hier"). Das quadratische Logo von Wikimedia Commons (gemeinfrei, blauer Grund mit
 * weißem Zeichen) trägt seine Farbe selbst — als Maske würde es zu einer blauen
 * Fläche, deshalb kommt es als `<img>`.
 */
const ALS_BILD = new Set(['primevideo', 'maxdome'])

export function AnbieterIcon({ was, groesse = 14 }: { was: string; groesse?: number }) {
  const datei = anbieterDatei(was)
  if (!datei) return null
  if (ALS_BILD.has(datei)) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}anbieter/${datei}.svg`}
        alt=""
        aria-hidden
        width={Math.round(groesse * (BREITE[datei] ?? 1))}
        height={groesse}
        className={datei === 'primevideo' ? 'shrink-0 rounded-[3px]' : 'shrink-0'}
      />
    )
  }
  const url = `url(${import.meta.env.BASE_URL}anbieter/${datei}.svg)`
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: Math.round(groesse * (BREITE[datei] ?? 1)),
        height: groesse,
        backgroundColor: 'currentColor',
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
