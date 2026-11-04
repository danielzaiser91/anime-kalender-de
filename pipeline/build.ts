/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 *
 * Die Phasen liegen in `pipeline/bau/NN-*.ts`, die Nummer ist die Aufrufreihenfolge. Was eine
 * Phase braucht und liefert, steht in ihrer Signatur — die Reihenfolge steht in
 * `bau/phasenfolge.ts` und ist Teil der Logik (z. B. kommen die Disc-Wege in `schliesseWegeAb`
 * erst nach der letzten Entfernung).
 */
import { ladeQuellen } from './bau/01-quellen.ts'
import { bauePhasenfolge, type Phasenergebnis } from './bau/phasenfolge.ts'
import { vermerkeQuarantaene } from './bau/11-9-quarantaene.ts'
import { baueMeta } from './bau/12-meta.ts'
import { schreibeDatensatzGemessen } from './bau/anisearch-reihen-abweichungen.ts'
import { schreibeEmpfehlung } from './bau/13-10-empfehlung.ts'
import { schreibeAboFeeds } from './bau/14-ics.ts'
import { pruefeSchalter } from './bau/phasen-zustand.ts'
import { merkeBestandVorher } from './lib/bestand-vorher.ts'

function main(): void {
  liefereAus(bauePhasenfolge(ladeQuellen()))
}

/** Ab `baueMeta` beginnt die Auslieferung: Meta, Datensatz, Abo-Feeds. */
function liefereAus({ synchro, quarantaene, ...rest }: Phasenergebnis): void {
  const { titles, releases, events } = rest
  const { allTitles, meta, platforms, genres, keywords } = baueMeta({
    titles,
    releases,
    events,
    motnBelege: synchro.motnBelege,
  })
  vermerkeQuarantaene(meta, quarantaene)
  const { newsFuerRss } = schreibeDatensatzGemessen({
    ...rest,
    allTitles,
    kanalJeAdresse: synchro.kanalJeAdresse,
    motnTon: synchro.motnTon,
    meta,
  })
  schreibeAboFeeds({ newsFuerRss, events, platforms, allTitles, genres, meta, keywords })
  schreibeEmpfehlung()
}

pruefeSchalter()
merkeBestandVorher()
main()
