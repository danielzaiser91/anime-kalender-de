import type { Title } from '../../shared/types.ts'
import { nachJahrUndId } from '../../shared/titles.ts'
import type { Vorschlag } from './meldungen.ts'
import { sammelName, namensWoerter } from './sammel-titel.ts'

/**
 * **Kurzname in »…« als Namensanfang eines Bestandstitels** (18.11.2026): „Hell Mode“ (Blu-ray 25.02.2027) ist nur der Anfang von „Hell Mode: The Hardcore
 * Gamer …“, `findeTitel` meldet das als Präfix (`genau: false`), und für einen Termin reichte das nicht — die Meldung ging verloren. Von 66 Meldungen mit Termin
 * ohne Titel hatten 10 einen Präfix-Kandidaten; hier zählt davon nur, was eindeutig ist. Nur Anime, mindestens zwei ganze Wörter („Mononoke“ trifft zu viel).
 */
export type PraefixBefund =
  | { titel: Title }
  /** Mehrere Titel beginnen so und sind nicht sicher zu trennen, oder keiner hat das Format der Meldung: keiner wird geraten, der Grund wird gezählt. */
  | { mehrdeutig: true }

/**
 * Ein Preisangebot nennt als Datum sein Ende, nicht ein Erscheinen („Dritte »ARIFURETA«-Staffel zum Sonderpreis“, bis 31.10.). Gelistet sind die
 * Formulierungen echter Meldungen (Sparaktion, Black Friday/Weeks, reduziert, Deal-Preis, „Vorbestellphase endet am“).
 */
const ANGEBOT = /\b(angebot|sonderpreis|rabatt\w*|aktion|sale|\w*sparaktion|black[\s-](?:friday|weeks?|days?)|reduziert|deal\w*|günstig\w*|endet|bis zum)\b/i

/** Was die Meldung ankündigt: ein Film (Kino, Film-Wort) oder eine Serie (Streaming, Staffel/Simulcast/Start); eine Disc-Box ohne Hinweis lässt beides offen. */
function meldungsArt(v: Pick<Vorschlag, 'articleTitle' | 'category'>): 'film' | 'serie' | undefined {
  if (v.category === 'kino' || /\b(film|movie|kino)\b/i.test(v.articleTitle)) return 'film'
  return v.category === 'streaming' || /\b(staffel|season|simulcast|serie|start)\b/i.test(v.articleTitle) ? 'serie' : undefined
}

/** Ein Film-Treffer für eine Serien-Meldung („Street Fighter“ → „Street Fighter II: The Animated Movie“) wäre ein falsches Werk. */
const formatPasst = (t: Title, art: 'film' | 'serie' | undefined): boolean =>
  art === 'film' ? t.format === 'MOVIE' : art === 'serie' ? !['MOVIE', 'OVA', 'SPECIAL'].includes(t.format ?? '') : true

const beginntMit = (frage: string[], name: string): boolean => {
  const w = namensWoerter(name)
  return frage.every((x, i) => w[i] === x)
}

/**
 * Eindeutig ist: genau ein Titel passenden Formats beginnt so, oder alle gehören zu einer Franchise und die Überschrift nennt eine Staffel/einen Film
 * (`teilAngabe`) — dann wählt `reihenTeil` den Teil und gibt auf, wenn es keinen findet. Mehrere Franchisen („Princess Mononoke“ neben den Mononoke-Filmen),
 * mehrere Teile ohne Angabe (Heaven’s Feel: drei Filme, eine Box) und Treffer nur anderen Formats sind mehrdeutig.
 */
export function praefixTitel(v: Pick<Vorschlag, 'articleTitle' | 'category'>, anime: Title[], teilAngabe: boolean): PraefixBefund | undefined {
  const frage = namensWoerter(sammelName(v.articleTitle) ?? '')
  if (frage.length < 2 || ANGEBOT.test(v.articleTitle)) return undefined
  const namenstreffer = anime.filter((t) => [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && beginntMit(frage, n)))
  if (!namenstreffer.length) return undefined
  const art = meldungsArt(v)
  const treffer = namenstreffer.filter((t) => formatPasst(t, art))
  if (!treffer.length) return { mehrdeutig: true }
  if (treffer.length === 1) return { titel: treffer[0]! }
  const reihe = (t: Title) => t.franchiseId ?? t.id
  const eineReihe = treffer.every((t) => reihe(t) === reihe(treffer[0]!))
  return eineReihe && teilAngabe ? { titel: [...treffer].sort(nachJahrUndId)[0]! } : { mehrdeutig: true }
}
