/**
 * **Das Markenzeichen des Anbieters an seiner Pille.**
 *
 * Daniel am 16.09.2026: „füg kleine icons zu anbietern ein die links an den
 * pills hängen." Die Pille trägt den Namen ohnehin — das Zeichen spart nicht
 * Text, es macht die Reihe auf einen Blick unterscheidbar.
 *
 * **Woher die Zeichen kommen:** [simple-icons](https://simpleicons.org), unter
 * CC0 veröffentlicht, als einfarbige Pfade. Sie liegen bei uns im Repo
 * (`web/public/anbieter/`) statt als Hotlink — eine fremde Adresse im Ladepfad
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
}

/**
 * Der Name eines Bezugswegs trägt manchmal den Kanal in Klammern — „Amazon Prime
 * (Crunchyroll)" ist ein Prime-Weg. Für das Zeichen zählt, wo man landet.
 */
export function anbieterDatei(was: string): string | undefined {
  const kern = was.toLowerCase().replace(/\s*\(.*$/, '').trim()
  if (DATEI[kern]) return DATEI[kern]
  if (kern.startsWith('amazon prime') || kern === 'prime video') return 'primevideo'
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
const ALS_BILD = new Set(['primevideo'])

export function AnbieterIcon({ was, groesse = 14 }: { was: string; groesse?: number }) {
  const datei = anbieterDatei(was)
  if (!datei) return null
  if (ALS_BILD.has(datei)) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}anbieter/${datei}.svg`}
        alt=""
        aria-hidden
        width={groesse}
        height={groesse}
        className="shrink-0 rounded-[3px]"
      />
    )
  }
  const url = `url(${import.meta.env.BASE_URL}anbieter/${datei}.svg)`
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: groesse,
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
