import { loadJson } from './data.ts'
import { umleiteKarte, umleiteListe } from './ak-umleiten.ts'

/**
 * **Zusammengeführte Titel ziehen in gemerkten Listen auf ihren Nachfolger um** (Dubletten, 08.10.2026).
 *
 * Wird ein Titel in einem anderen aufgelöst (aniSearch-Zeile und AniList-Titel waren dasselbe Werk), bekommt seine alte Kennung `ak` einen Nachfolger
 * (`zuAk` in `data/kennungen.json`, Ausgabe `ak-umleitung.json` als `[[alt, neu], …]`). Favoriten, Ausgeblendetes und Gesehenes im Browser tragen
 * die alte Kennung und laufen sonst ins Leere. Die Datei wächst nur; die Marke merkt, wie viele Paare schon angewandt sind.
 */
const MARKE = 'kennung:umleitung'
const LISTEN = ['favorites', 'hidden'] as const
const KARTEN = ['favorites:seit', 'gesehenBis'] as const
/** Länger wartet der erste Bildaufbau nicht; was bis dahin fehlt, folgt beim nächsten Laden. */
const WARTEZEIT_MS = 1500

function anwenden(abbild: Map<number, number>): void {
  for (const schluessel of LISTEN) {
    const roh = localStorage.getItem(schluessel)
    const alt: unknown = roh ? JSON.parse(roh) : undefined
    if (Array.isArray(alt)) localStorage.setItem(schluessel, JSON.stringify(umleiteListe(alt, abbild)))
  }
  for (const schluessel of KARTEN) {
    const roh = localStorage.getItem(schluessel)
    const alt: unknown = roh ? JSON.parse(roh) : undefined
    if (alt && typeof alt === 'object' && !Array.isArray(alt)) localStorage.setItem(schluessel, JSON.stringify(umleiteKarte(alt as Record<string, unknown>, abbild)))
  }
}

/** Eine geöffnete Adresse `#/…?t=<Cartoon>`: Cartoons, die als Anime geführt werden, stehen mit ihrer negativen Kennung in `ak-umleitung.json`. */
const CARTOON_IN_ADRESSE = /([?&]t=)(-\d+)(?!\d)/

function adresseUmschreiben(abbild: Map<number, number>): void {
  const treffer = CARTOON_IN_ADRESSE.exec(location.hash)
  const ziel = treffer && abbild.get(Number(treffer[2]))
  if (ziel) history.replaceState(history.state, '', `${location.pathname}${location.search}${location.hash.replace(CARTOON_IN_ADRESSE, `$1${ziel}`)}`)
}

async function umleiten(): Promise<void> {
  try {
    const mitAdresse = CARTOON_IN_ADRESSE.test(location.hash)
    if (!mitAdresse && ![...LISTEN, ...KARTEN].some((k) => localStorage.getItem(k))) return
    const paare = await loadJson<[number, number][]>('ak-umleitung.json')
    if (mitAdresse) adresseUmschreiben(new Map(paare))
    if (paare.length <= Number(localStorage.getItem(MARKE) ?? 0)) return
    anwenden(new Map(paare))
    localStorage.setItem(MARKE, String(paare.length))
    localStorage.removeItem('newsletterSyncSent')
  } catch {
    /* Ohne Netz oder Speicher bleibt alles liegen und wird beim nächsten Laden umgeschrieben. */
  }
}

/** Läuft vor dem ersten Rendern; ohne gemerkte Titel kostet es nichts. */
export function akUmleitung(): Promise<void> {
  return Promise.race([umleiten(), new Promise<void>((fertig) => setTimeout(fertig, WARTEZEIT_MS))])
}
