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
 * Die Zugangsart eines Verweises.
 *
 * `kind` aus den `watchLinks` bleibt die stärkste Auskunft: Was der Anbieter
 * selbst als Kauf ausweist, ist einer. Erst danach entscheidet der Name.
 * Bleibt beides stumm, gilt `abo` — das ist bei Anime der Normalfall und die
 * vorsichtigere Annahme: Wer faelschlich ein Abo erwartet, verpasst nichts;
 * wer faelschlich „kostenlos" liest, aergert sich an der Kasse.
 */
export function zugangsart(name: string, kind?: 'stream' | 'buy', url?: string): Zugangsart {
  const n = name.toLowerCase().trim()
  // „Crunchyroll über Prime Video" ist ein Kanal — bezahlt wird das Abo dahinter.
  const kern = n.split(' über ')[0]!.trim()

  if (kind === 'buy') return 'kauf'
  // YouTube Movies verlangt Geld, ein hochgeladenes Video nicht.
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
