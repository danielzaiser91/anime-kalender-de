import { providerToPlatform } from './titel-hilfen.ts'
import { providerName } from '../../shared/mappings.ts'
import { type Title } from '../../shared/types.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'

export function uebernehmeTmdbAngebote({ titles, tmdbTitles, toteAdressen }: {
  titles: Map<number, Title>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  toteAdressen: Set<string>
}) {
  // Angebote von TMDB (Datenbasis JustWatch) — dieselbe Quelle, aus der auch
  // werstreamt.es schöpft. Bisher behielten wir davon nur die Dienste mit
  // eigener Plattform und warfen Videobuster, maxdome, Sky Store und Apple TV
  // weg. Die Daten waren immer da.
  //
  // Einen Link je Anbieter liefert TMDB nicht, nur eine Übersichtsseite für
  // die Region. Also zeigt jede Zeile den Anbieternamen und führt dorthin —
  // besser als ein erfundener Deeplink, der ins Leere geht.
  /*
    **Ein Special unter der Kennung einer TV-Serie erbt deren Anbieter nicht.**

    TMDB legt OVAs und Specials oft als „Staffel 0" der Hauptserie ab; die Anbieterliste
    gilt dann für die Serie. „The Testament of Sister New Devil Burst: Basara Tojos äußerst
    friedlicher Alltag" (OVA, TMDB tv/64163) bekam so eine Akibapass-Pille auf die
    TMDB-Seite — Akibapass führt nur die zwölf Folgen der ersten Staffel (Daniel,
    21.09.2026, mit Bildschirmfoto). Gemessen am selben Tag: drei solche Fälle im Bestand
    (21489, 8465, 1335), alle OVA/Special neben einer TV-Serie derselben Kennung.
  */
  const tvJeTmdb = new Set<string>()
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (info?.tmdbId && title.format === 'TV') tvJeTmdb.add(`${info.kind}${info.tmdbId}`)
  }
  for (const title of titles.values()) {
    const info = tmdbTitles[title.id]
    if (!info?.offers?.length || !info.justwatchUrl) continue
    if (title.format !== 'TV' && tvJeTmdb.has(`${info.kind}${info.tmdbId}`)) continue
    const watchLinks = title.watchLinks ?? []
    for (const offer of info.offers) {
      if (providerToPlatform(offer.name)) continue
      // Denselben Weg über providerName wie die aniSearch-Angebote — sonst
      // stünden „maxdome" und „maxdome Store" als zwei Anbieter nebeneinander.
      const name = providerName(offer.name)
      if (!name) continue
      if (watchLinks.some((w) => w.name === name)) continue
      /*
        **Kauf und Leihe sind hier digital — sie gehören zum Streamen, nicht zur Disc.**

        TMDB listet unter `watch/providers` ausschließlich Video-on-Demand-Anbieter.
        Bis zum 16.09.2026 wurde aus `rent`/`buy` ein `kind: 'buy'`, und damit standen
        maxdome und freenet meinVOD im Disc-Reiter des Panels. Die Zugangsart trägt
        den Unterschied zwischen Abo und Kauf; der Reiter trägt nur, ob man es
        anschaut oder ins Regal stellt.
      */
      watchLinks.push({
        name,
        url: info.justwatchUrl,
        kind: 'stream',
        zugang: offer.kind === 'flatrate' ? 'abo' : 'kauf',
        /*
          Gekennzeichnet beim Anlegen, nicht erst am Ende: `pruefeErgebnis()` läuft vor den
          JustWatch-Runden, die eine direkte Adresse einsetzen (und die Kennzeichnung dann löschen).
          Der Bestandslauf vom 22.09.2026 17:33 brach mit 1.172 ungekennzeichneten Wegen ab, weil die
          Kennzeichnung erst nach der Prüfung kam.
        */
        ueberTmdb: true,
      })
    }
    if (watchLinks.length) {
      title.watchLinks = watchLinks
        .filter((w) => !toteAdressen.has(w.url))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1))
    }
  }
  return { tvJeTmdb }
}
