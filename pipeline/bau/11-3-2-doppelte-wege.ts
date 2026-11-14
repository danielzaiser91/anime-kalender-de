import { log, readJson } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { wegKern } from '../lib/weg-kern.ts'
import { type EntfernterVerweis } from './grundlagen.ts'

export function entferneWegeNachNein({ verweiseEntfernt, titles }: {
  verweiseEntfernt: EntfernterVerweis[]
  titles: Map<number, Title>
}) {
  let wegNachNein = 0
  {
    const kern = wegKern
    const raus = new Set(verweiseEntfernt.map((e) => kern(e.url ?? '')))
    for (const e of readJson<{ verweise?: { url?: string }[] }>('data/verweise-entfernt.json', {}).verweise ?? []) {
      raus.add(kern(e.url ?? ''))
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length) continue
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !raus.has(kern(w.url)))
      wegNachNein += vorher - title.watchLinks.length
    }
  }
  if (wegNachNein) log(`${wegNachNein} Bezugswege entfernt, deren Adresse als belegtes Nein aus den Verweisen flog`)
}

export function entferneDoppelteWege({ titles }: {
  titles: Map<number, Title>
}) {
  /**
   * **Was als belegtes Nein aus den Verweisen flog, kommt nicht als Bezugsweg zurück.**
   *
   * Gefunden am 07.09.2026 an „7th Time Loop": Der Prime-Verweis wurde wegen
   * des Handbelegs „kein deutscher Ton" entfernt — und derselbe Weg stand als
   * Bezugsweg weiter da, mit „🇩🇪 ?" daneben. Für einen Besucher ist das
   * dieselbe Zeile, nur ohne Wissen; Daniels Punkt war genau diese Pille.
   *
   * Verglichen wird über den Adresskern, denn beide Listen führen dieselbe
   * Adresse mal mit und mal ohne Parameter.
   *
   * **Nur belegte Neins, keine Frist.** Ein Weg, den ein Mensch als „dort
   * nicht auf Deutsch" geprüft hat, gehört nicht in die Antwort auf „wo läuft
   * es auf Deutsch" — und wenn sich das ändert, ändert sich der Handbeleg.
   */
  /**
   * **Eine Adresse, eine Pille.**
   *
   * Daniel am 07.09.2026 an „Kill Blue": „aniverse button führt auf tote seite
   * -> entfernen". Er führte nicht ins Leere — er führte auf **dieselbe**
   * Amazon-Seite wie die Prime-Video-Pille daneben (`B0GTN94C9M`). Wer dort
   * den Aniverse-Kanal sucht, findet ihn nicht, denn die Seite ist das
   * Prime-Angebot.
   *
   * Zwei Zeilen, die auf dieselbe Adresse zeigen, sind keine zwei Auskünfte.
   * Dasselbe Bild wie bei „City The Animation" (zwei Prime-Zeilen) und bei
   * „7th Time Loop" (Verweis entfernt, Bezugsweg blieb) — dreimal am selben
   * Tag, jedes Mal von Daniel gemeldet.
   *
   * Der **Verweis** gewinnt: Er trägt das Sprachurteil und die Zugangsart, der
   * Bezugsweg nur einen Namen. Gemessen sind es 37 Dopplungen.
   */
  let doppelterWeg = 0
  {
    const kern = (u: string): string => {
      const asin = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,26})/i.exec(u)?.[1]
      if (asin) return `amazon:${asin.toLowerCase()}`
      return u
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('?')[0]!
        .replace(/\/$/, '')
        .toLowerCase()
    }
    for (const title of titles.values()) {
      if (!title.watchLinks?.length || !title.streams?.length) continue
      const belegt = new Set(title.streams.map((s) => kern(s.url)))
      const vorher = title.watchLinks.length
      title.watchLinks = title.watchLinks.filter((w) => !belegt.has(kern(w.url)))
      doppelterWeg += vorher - title.watchLinks.length
    }
  }
  if (doppelterWeg) log(`${doppelterWeg} Bezugswege entfernt, die auf dieselbe Adresse zeigen wie ein Verweis desselben Titels`)
}
