import type { Title } from '../../shared/types.ts'
import { nachJahrUndId } from '../../shared/titles.ts'
import { sammelName, namensWoerter } from './sammel-titel.ts'

/**
 * **Kurzname in »…« als Namensanfang eines Bestandstitels** (18.11.2026): „Hell Mode“ (Blu-ray 25.02.2027) ist nur der Anfang von „Hell Mode: The Hardcore
 * Gamer …“, `findeTitel` meldet das als Präfix (`genau: false`), und für einen Termin reichte das nicht — die Meldung ging verloren. Von 66 Meldungen mit Termin
 * ohne Titel hatten 10 einen Präfix-Kandidaten; hier zählt davon nur, was eindeutig ist. Nur Anime, mindestens zwei ganze Wörter („Mononoke“ trifft zu viel).
 */
export type PraefixBefund =
  | { titel: Title }
  /** Mehrere Titel beginnen so und sind nicht sicher zu trennen: keiner wird geraten, der Grund wird gezählt. */
  | { mehrdeutig: true }

/** Ein Preisangebot nennt als Datum sein Ende, nicht ein Erscheinen („Dritte »ARIFURETA«-Staffel zum Sonderpreis“, bis 31.10.). */
const ANGEBOT = /\b(angebot|sonderpreis|rabatt\w*|aktion|sale)\b/i

const beginntMit = (frage: string[], name: string): boolean => {
  const w = namensWoerter(name)
  return frage.every((x, i) => w[i] === x)
}

/**
 * Eindeutig ist: genau ein Titel beginnt so, oder alle gehören zu einer Franchise und die Überschrift nennt eine Staffel/einen Film
 * (`teilAngabe`) — dann wählt `reihenTeil` den Teil und gibt auf, wenn es keinen findet. Mehrere Franchisen („Princess Mononoke“ neben den Mononoke-Filmen)
 * oder mehrere Teile ohne Angabe (Heaven’s Feel: drei Filme, eine Box) sind mehrdeutig.
 */
export function praefixTitel(artikelTitel: string, anime: Title[], teilAngabe: boolean): PraefixBefund | undefined {
  const frage = namensWoerter(sammelName(artikelTitel) ?? '')
  if (frage.length < 2 || ANGEBOT.test(artikelTitel)) return undefined
  const treffer = anime.filter((t) => [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && beginntMit(frage, n)))
  if (!treffer.length) return undefined
  if (treffer.length === 1) return { titel: treffer[0]! }
  const reihe = (t: Title) => t.franchiseId ?? t.id
  const eineReihe = treffer.every((t) => reihe(t) === reihe(treffer[0]!))
  return eineReihe && teilAngabe ? { titel: [...treffer].sort(nachJahrUndId)[0]! } : { mehrdeutig: true }
}
