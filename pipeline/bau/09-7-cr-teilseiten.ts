import { resolve } from 'node:path'
import { log, ROOT, writeJson } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import type { CrDubData } from '../lib/crunchyroll-dub.ts'
import { ladeCrArchiv } from './folgentitel-cr.ts'
import { folgenlisteVon } from '../lib/titel-bloecke.ts'
import { geteilteAdressen, type TeilseitenPruefung } from '../lib/teilseiten.ts'
import {
  bereicheImFenster,
  crPositionen,
  ordneSeiteZu,
  type RohArchiv,
  type UnserTitel,
} from '../lib/cr-teilseiten.ts'

/**
 * **Geteilte Crunchyroll-Seiten: der Folgenbereich je Titel** (Regel und Begründung: `lib/cr-teilseiten.ts`).
 * `setzeCrBereiche` überspringt Adressen, die mehrere unserer Titel bedienen; hier bekommt jeder Titel dort seinen Bereich,
 * wo Titel oder Folgenzahl sein Fenster auf der Seite belegen. Der Rest steht mit Grund in `data/cr-teilseiten-pruefliste.json`.
 */
export const PRUEFLISTE = 'data/cr-teilseiten-pruefliste.json'

const ZAEHLT = new Set(['TV', 'TV_SHORT'])

function unserTitel(t: Title): UnserTitel {
  return { id: t.id, episodes: t.episodes ?? 0, zaehlt: ZAEHLT.has(t.format ?? ''), folgen: folgenlisteVon(t.id) }
}

export function setzeCrTeilseiten(titles: Map<number, Title>, crDub: CrDubData, schreibWurzel = ROOT): void {
  const serien = new Map(crDub.serien.filter((s) => s.katalog === 'de').map((s) => [s.url, s]))
  const pruefen: TeilseitenPruefung[] = []
  const je = { titel: 0, zahl: 0 }
  for (const [url, eintraege] of geteilteAdressen(titles, 'crunchyroll')) {
    const offen = eintraege.filter((e) => e.stream.dub === true && !e.stream.dubRanges?.length)
    if (!offen.length) continue
    const archiv = ladeCrArchiv(serien.get(url)?.seriesId) as RohArchiv | undefined
    const liste = archiv ? crPositionen(archiv) : []
    const urteile = liste.length ? ordneSeiteZu(eintraege.map((e) => unserTitel(e.title)), liste) : undefined
    for (const { title, stream } of offen) {
      const urteil = urteile?.get(title.id)
      const bereiche = urteil && 'fenster' in urteil ? bereicheImFenster(urteil.fenster, liste) : []
      if (urteil && 'fenster' in urteil && bereiche.length) {
        stream.dubRanges = bereiche
        je[urteil.fenster.quelle]++
        continue
      }
      const grund = urteil ? ('grund' in urteil ? urteil.grund : 'im Fenster keine deutsche Folge') : 'Folgenliste der Seite fehlt im Archiv'
      pruefen.push({ titleId: title.id, titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? '', url, grund })
    }
  }
  writeJson(resolve(schreibWurzel, PRUEFLISTE), pruefen.sort((a, b) => a.titleId - b.titleId))
  log(`Geteilte Crunchyroll-Seiten: ${je.titel} Bereiche über Folgentitel, ${je.zahl} über die Folgenzahl, ${pruefen.length} auf der Prüfliste`)
}
