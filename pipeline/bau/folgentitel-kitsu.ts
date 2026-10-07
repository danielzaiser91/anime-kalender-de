import type { Title } from '../../shared/types.ts'

/**
 * **Folgentitel und Folgenlänge aus Kitsu** — letzte Stufe hinter aniSearch, Crunchyroll und TMDB (Daniel, 07.10.2026, „Black Butler: Book of Murder": keine Titel,
 * keine Laufzeit je Folge). Quelle ist `data/kitsu-folgen.json` (`fetch-kitsu-folgen.ts`): Kitsu-Kennung über die MAL-Kennung, je Folge Nummer, Titel, Minuten.
 *
 * Es zählt nur, was zusammenpasst: Kitsus Folgenzahl ist genau unsere, die Nummern laufen 1…n ohne Lücke und Doppelte. Sonst gibt es nichts — keine Nummer wird geraten.
 * Kitsus Titel sind englisch oder umschrieben, nie deutsch; sie füllen nur Folgen, die sonst gar keinen Titel hätten. Ein Titel aus einer früheren Stufe bleibt.
 */
export interface KitsuEintrag {
  k: number | null
  f: [number, string, number][]
}

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

const PLATZHALTER = /^(folge|episode|ep\.?)\s*\d*$/i

/** Die Kitsu-Folgen dieses Titels, wenn sie zu ihm passen: genau seine Zahl, Nummern 1…n. */
function passendeFolgen(titel: Title, e: KitsuEintrag | undefined): [number, string, number][] | undefined {
  if (!e?.k || !titel.episodes || e.f.length !== titel.episodes) return undefined
  const nummern = e.f.map((x) => x[0]).sort((a, b) => a - b)
  return nummern.every((n, i) => n === i + 1) ? e.f : undefined
}

/** Füllt Lücken in Titel und Minuten; ein vorhandener Wert bleibt. Gibt die Liste unverändert zurück, wo Kitsu nichts Passendes hat. */
export function mitKitsuTiteln(titel: Title, folgen: Folge[] | undefined, e: KitsuEintrag | undefined): Folge[] | undefined {
  const aus = passendeFolgen(titel, e)
  if (!aus) return folgen
  const jeNr = new Map(aus.map((x) => [x[0], x]))
  const basis: Folge[] = folgen && folgen.length >= 2 ? folgen : aus.map((x) => ({ nr: x[0] }))
  return basis.map((x) => {
    const k = jeNr.get(x.nr)
    if (!k) return x
    const name = k[1] && !PLATZHALTER.test(k[1]) ? k[1] : undefined
    return {
      ...x,
      ...(!(x.de ?? x.en ?? x.ja) && name ? { en: name } : {}),
      ...(!x.minuten && k[2] > 0 ? { minuten: k[2] } : {}),
    }
  })
}
