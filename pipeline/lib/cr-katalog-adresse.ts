/**
 * **Die Serienadresse zu einem Namen — aus dem deutschen Crunchyroll-Katalog.**
 *
 * Bis zum 10.09.2026 machte `build.ts` aus einer kaputten Crunchyroll-Adresse
 * eine Suche mit unserem Titel als Suchbegriff. Für „Kaiju No. 8 Narumi's Week
 * at Work" antwortet Crunchyroll darauf mit „Es konnte nichts gefunden werden"
 * (Daniel, 10.09.2026, mit Bild) — unser Titel ist dort der Name eines
 * Staffelblocks, kein Suchbegriff.
 *
 * Die Adresse selbst liegt seit dem 22.08.2026 im Repo: `data/cr-katalog-de.json`
 * führt „Kaiju No. 8" unter `GG5H5XQ7D`/`kaiju-no-8`. Genau die Adresse, die
 * Daniel danach von Hand herausgesucht hat.
 *
 * ## Warum hier ein Namensabgleich zulässig ist
 *
 * Dieses Projekt misstraut Namensabgleichen zu Recht — `To Love-Ru`,
 * `Wolf's Rain OVA` und die 16 Katalogzuordnungen vom 29.08.2026 sind alle
 * daran gescheitert. Der Unterschied ist die **Frage**: Dort ging es um „läuft
 * dieses Werk bei diesem Anbieter?", hier um „unter welcher Adresse liegt das
 * Werk, von dem wir schon wissen, dass es dort läuft?". Der Verweis samt
 * Sprachurteil steht bereits; ersetzt wird ausschließlich seine Adresse.
 *
 * Dieselbe Trennung wie bei JustWatch (10.09.2026): Eine Quelle, die als Zeuge
 * nicht taugt, taugt als Wegweiser.
 *
 * ## Und warum der Reihenkopf die richtige Antwort ist
 *
 * Eine Crunchyroll-Serienseite führt alle Staffeln und Nebenausgaben einer
 * Reihe. Daniels Bildschirmabzug zeigt unter `GG5H5XQ7D` die vier Blöcke
 * „Season 1 · Mission Recon · Season 2 · Narumi's Week at Work". Für ein
 * Special ist der Reihenkopf damit nicht die zweitbeste Adresse, sondern die
 * einzige, die es dort gibt.
 */
import { readJson } from './util.ts'

interface KatalogEintrag {
  id?: string
  titel?: string
  slug?: string
}

/** Name auf Kleinbuchstaben und Wörter — die Leerzeichen tragen die Wortgrenze. */
export function nameKern(x: string): string {
  return x
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Baut den Namensindex. `null` steht für einen mehrdeutigen Namen: Zwei Serien
 * gleichen Namens entscheiden nichts, dann lieber gar keine Adresse.
 */
export function crNamensindex(eintraege: KatalogEintrag[]): Map<string, string | null> {
  const index = new Map<string, string | null>()
  for (const e of eintraege) {
    if (!e?.id || !e.titel || !e.slug) continue
    const k = nameKern(e.titel)
    if (!k) continue
    index.set(k, index.has(k) ? null : `https://www.crunchyroll.com/de/series/${e.id}/${e.slug}`)
  }
  return index
}

/**
 * Die Serienadresse zu unserem Titel — exakt oder über den Reihenkopf.
 *
 * Der Präfix-Weg ist eng gefasst: Der Katalogname muss an einer **Wortgrenze**
 * enden, sonst träfe „Kaiju" auch „Kaiju Girls". Bleiben mehrere Reihenköpfe
 * übrig, gewinnt der längste — „Sword Art Online II" gehört zu „Sword Art
 * Online", nicht zu einem kürzeren Namen, der zufällig auch passt.
 */
export function crAdresseZu(index: Map<string, string | null>, name: string): string | undefined {
  const k = nameKern(name)
  if (!k) return undefined
  const genau = index.get(k)
  if (genau) return genau
  let bester: { laenge: number; url: string } | undefined
  for (const [kandidat, url] of index) {
    if (!url || kandidat.length >= k.length) continue
    if (!k.startsWith(kandidat)) continue
    if (k[kandidat.length] !== ' ') continue
    if (!bester || kandidat.length > bester.laenge) bester = { laenge: kandidat.length, url }
  }
  return bester?.url
}

/** Der Index aus dem gespeicherten Katalog — die Einträge liegen unter `eintraege`. */
export function crNamensindexAusDatei(pfad = 'data/cr-katalog-de.json'): Map<string, string | null> {
  return crNamensindex(readJson<{ eintraege?: KatalogEintrag[] }>(pfad, {}).eintraege ?? [])
}
