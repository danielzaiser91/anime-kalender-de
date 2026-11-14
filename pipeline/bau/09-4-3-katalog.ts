import { readJson, log } from '../lib/util.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { belegeEinzelwerke, type EinzelwerkEintrag } from '../lib/cr-einzelwerk-urteil.ts'
import { type Title } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { belegeAusKatalogZuordnung, belegeFilmbloecke, belegeKapitelImBlock } from './09-4-3-1-katalog-zuordnung.ts'
import { belegeUeberSerienkennung } from './09-4-3-2-katalog-kennung.ts'
import { beurteileOffeneCrVerweise } from './09-4-3-3-offene-verweise.ts'

export function ordneCrKatalogZu({ titles, crDub, verweiseEntfernt }: {
  titles: Map<number, Title>
  crDub: CrDubData
  verweiseEntfernt: EntfernterVerweis[]
}) {
    /**
     * **Fünfte Runde: Filme und Specials, die der Katalog einzeln führt.**
     *
     * Die Suche nach Serienkennungen läuft mit `type=series` — Filme findet sie
     * nie. Am 29.08.2026 hatten 26 der 56 offenen Verweise deshalb keine
     * Kennung, davon 18 Filme. `data:cr-einzelwerke` sucht ohne Typ-Filter und
     * findet sie als `movie_listing`, mit ihren Tonspuren.
     *
     * **Der Beleggrad ist derselbe wie bei einer Serie:** Der deutsche Katalog
     * nennt für diesen Titel `de-DE`. Der Namensvergleich ist exakt (nach
     * Kleinschreibung ohne Sonderzeichen) — ein Film hat keinen zweiten
     * Prüfstein, keine Folgenzahl und keine Staffelstruktur, deshalb wird hier
     * nichts geraten.
     *
     * **Nur Ja, kein Nein.** Findet der Katalog den Film nicht, heißt das „hier
     * nicht geführt" — und daraus wird kein `dub: false` (CLAUDE.md).
     */
    const einzeln = belegeEinzelwerke(titles, readJson<({ id: number } & EinzelwerkEintrag)[]>('data/cr-einzelwerke.json', []))
    if (einzeln) log(`${einzeln} Filme/Specials über den deutschen Katalog belegt (Einzelwerk-Suche)`)

    belegeFilmbloecke({ titles })

    belegeKapitelImBlock({ crDub, titles })

    belegeAusKatalogZuordnung({ titles })

    belegeUeberSerienkennung({ crDub, titles })

    beurteileOffeneCrVerweise({ crDub, titles, verweiseEntfernt })
}
