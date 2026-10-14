import { readJson, log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { type AnisearchEintrag } from './01-quellen.ts'

/**
 * **Neunte Runde: der Katalog legt den Verweis an, nicht nur das Urteil.**
 *
 * Die Runde darüber beurteilt einen Verweis, der schon dasteht. Genau daran
 * ist am 07.09.2026 „Kill Blue" gescheitert, von Daniel gemeldet:
 *
 * - Am 24.08. hatte Crunchyroll dort **null** deutsche Folgen — der Verweis
 *   flog zu Recht heraus.
 * - Am **06.09.** erschienen die Folgen 1–8 auf Deutsch.
 * - Der Kalender zeigte weiter keinen Crunchyroll-Weg und behauptete damit
 *   das Gegenteil.
 *
 * **Kein einziger Lauf hätte es finden können**, und das ist der eigentliche
 * Befund:
 *
 * | Lauf | was er sieht |
 * |---|---|
 * | `crunchyroll` (stündlich) | den **Sendekalender** — dort steht Kill Blue nicht, denn eine nachgereichte Katalog-Synchro ist kein Simulcast-Termin |
 * | `crunchyroll-dub` (wöchentlich) | nur Serien, die **schon** einen Verweis haben |
 * | `cr-katalog` | den ganzen deutschen Katalog — läuft aber nicht automatisch, weil er eine deutsche IP braucht |
 *
 * Diese Runde schließt die Lücke: Der Katalog nennt zu jeder Serienkennung
 * ihre Tonspuren. Führt er `de-DE` und der Titel hat keinen
 * Crunchyroll-Weg, entsteht er hier — mit Urteil, denn dieselbe Antwort
 * belegt beides.
 *
 * **Die Zuordnung läuft über die aniSearch-Adresse**, nicht über den Namen.
 * Ein Namensabgleich gegen 1.589 Katalogeinträge ist genau der Fehler, der
 * am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch gemacht hat. Wo
 * aniSearch eine Crunchyroll-Adresse mit Kennung führt, ist die Zuordnung
 * dagegen eine Zeichenkette.
 *
 * **Und nur bei genau einer Staffel** — aus demselben Grund wie eine Runde
 * darüber: Eine Serienkennung ist ein Franchise.
 */
export function legeCrWegeAusKatalogAn({ titles, anisearch }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
}) {
  let ausKatalogNeu = 0
  const katalog = readJson<{
    eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
  }>('data/cr-katalog-de.json', {})
  const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
  if (nachKennung.size) {
    for (const title of titles.values()) {
      if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
      const asCr = (anisearch[title.id]?.streams ?? []).find((q) => q.provider === 'crunchyroll')
      const kennung = /\/series\/([A-Z0-9]+)/.exec(asCr?.url ?? '')?.[1]
      if (!kennung) continue
      const eintrag = nachKennung.get(kennung)
      if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
      if (!(eintrag.audio ?? []).includes('de-DE')) continue
      const url = (asCr?.url ?? '').split('?')[0]!
      title.streams.push({ platform: 'crunchyroll', url, dub: true })
      ausKatalogNeu++
    }
  }
  if (ausKatalogNeu)
    log(`${ausKatalogNeu} Crunchyroll-Wege neu angelegt: der deutsche Katalog führt sie mit deutscher Tonspur`)
}
