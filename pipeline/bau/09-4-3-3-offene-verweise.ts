import { readJson, log } from '../lib/util.ts'
import { type OffenerBefund, serienNachKennung, neinUeberholtMitLog } from '../lib/cr-nein-ueberholt.ts'
import { vorDemStart } from '../lib/crunchyroll-vollstaendig.ts'
import { todayIso } from '../../shared/time.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { type Title } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

/**
 * **Die Verweise, die alle Runden davor nicht beurteilen konnten.**
 *
 * Daniel am 07.09.2026: „39 Fragezeichen? wir haben crunchyroll
 * automatisiert, es sollte 0 fragezeichen geben." Gemessen am 09.09.2026
 * blieben 34 übrig, und keiner davon aus einem Fehler: 27 tragen eine
 * Adresse im alten Format ohne Serienkennung, der Rest sind Filme und OVAs,
 * die eine Serienrunde bauartbedingt nicht beurteilt.
 *
 * `pipeline/fetch-crunchyroll-offene.ts` geht sie einzeln an — Kennung aus
 * der Adresse auflösen, sonst die Serie im Katalog suchen und ihre
 * **Staffelliste** lesen. Hier wird nur angewandt, was dort belegt wurde.
 *
 * **Ein `tot` ist kein Sprachurteil.** Die Videokennung ist abgelaufen, die
 * Adresse führt ins Leere; der Verweis fliegt weiter unten über dieselbe
 * Regel wie jede andere tote Adresse. Ihn hier auf `dub: false` zu setzen
 * hieße, ein fehlendes Angebot als „ohne deutschen Ton" auszugeben — die
 * Unterscheidung, die `DubCheck.available` seit dem 12.08.2026 zieht.
 */
export function beurteileOffeneCrVerweise({ crDub, titles, verweiseEntfernt }: {
  crDub: CrDubData
  titles: Map<number, Title>
  verweiseEntfernt: EntfernterVerweis[]
}) {
  {
    const offene = readJson<Record<string, OffenerBefund & { grund?: string }>>('data/crunchyroll-offene.json', {})
    const crSerienJeKennung = serienNachKennung(crDub.serien)
    let ausOffenen = 0
    let toteOffene = 0
    for (const title of titles.values()) {
      for (const stream of [...title.streams]) {
        if (stream.platform !== 'crunchyroll' || stream.dub !== undefined) continue
        const b = offene[stream.url]
        if (!b || vorDemStart(title, b.geprueftAm)) continue
        /**
         * **Ein `tot` wurde gezählt und nie angewandt — 11 Verweise standen so
         * dauerhaft auf „🇩🇪 ?".**
         *
         * Der Kommentar darüber sagte, der Verweis fliege „weiter unten über
         * dieselbe Regel wie jede andere tote Adresse". Die Regel gibt es, nur
         * kennt sie diese Adressen nicht: Sie läuft über `crDub.serien`, also
         * über die Serien, die der wöchentliche Lauf geprüft hat. Was
         * `fetch-crunchyroll-offene.ts` als tot belegt, steht dort nicht.
         *
         * Gemessen am 10.09.2026: 28 Verweise ohne Sprachurteil im Datensatz,
         * 17 davon beim Lauf offen — und **11 als tot beurteilt**, ohne jede
         * Wirkung. Die Erklärung vom Vortag („das macht die aniSearch-Nachrunde
         * wieder auf") war falsch: Dem Lauf war keine einzige dieser Adressen
         * unbekannt.
         *
         * Entfernt wird, nicht auf `dub: false` gesetzt: Es fehlt das Angebot,
         * nicht die deutsche Fassung — dieselbe Unterscheidung wie bei
         * „Videos dieser Serie nicht mehr verfügbar".
         */
        if (b.herkunft === 'tot') {
          title.streams = title.streams.filter((s) => s !== stream)
          toteOffene++
          verweiseEntfernt.push({
            titleId: title.id,
            titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
            plattform: 'crunchyroll',
            url: stream.url,
            seriesId: null,
            grund: b.grund ?? 'Adresse führt ins Leere (fetch-crunchyroll-offene)',
            geprueftAm: null,
            entferntAm: todayIso(),
            letzterWeg: title.streams.length === 0,
          })
          continue
        }
        if (typeof b.dub !== 'boolean') continue
        /* Ein Nein, das der jüngere Dub-Bestand widerlegt, gilt nicht: der normale Weg entscheidet. */
        if (neinUeberholtMitLog(b, crSerienJeKennung, title)) continue
        stream.dub = b.dub
        ausOffenen++
      }
    }
    if (ausOffenen)
      log(`${ausOffenen} Crunchyroll-Verweise über Videokennung oder Staffelliste beurteilt`)
    if (toteOffene)
      log(`${toteOffene} Crunchyroll-Verweise entfernt: die Adresse führt ins Leere (abgelaufene Videokennung oder im deutschen Katalog nicht geführt)`)
    }
}
