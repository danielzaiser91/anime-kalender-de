/**
 * Handliste `data/cartoon-handliste.yaml`: ADN-Serien mit deutschem Ton, die keine Anime-Datenbank führt (31.10.2026).
 *
 * `fetch-cartoons.ts` sucht nur englische Originale; Dreamland, Tintin, Spirou & Co. fielen nie hinein. Die Liste nimmt sie
 * unabhängig von der Originalsprache auf. Mit `tmdb` ist die Kennung fest; ohne sucht der Abruf per Name und übernimmt nur einen
 * eindeutigen Treffer (Animation, gleicher Name, bei `jahr` auch gleiches Jahr). Mehrdeutig oder ohne Treffer bleibt der Eintrag draußen.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { normalisiere } from './anisearch-namen.ts'

export interface HandlisteEintrag {
  /** ADN-Serienkennung. */
  adn: number
  /** Name bei ADN (deutsch). */
  name: string
  /** Originalname bei ADN. */
  original?: string
  /** Weitere Namen der Serie (z. B. deutscher Titel), nach denen gesucht und gegen die der Treffer geprüft wird. */
  varianten?: string[]
  /** TMDB-Kennung, falls bekannt; sonst sucht der Abruf. */
  tmdb?: number
  /** Erstausstrahlungsjahr, trennt gleichnamige Serien. */
  jahr?: number
  /** Grenzfall (Grund im Text): der Abruf lässt den Eintrag aus, bis jemand entschieden hat. */
  pruefen?: string
}

export type TmdbSuchtreffer = { id?: number; name?: string; original_name?: string; first_air_date?: string; genre_ids?: number[]; number_of_episodes?: number }

export type Wahl = { id: number } | { grund: string }

const ANIMATION = 16

export function handlisteLaden(wurzel: string): HandlisteEintrag[] {
  const roh = yaml.load(readFileSync(resolve(wurzel, 'data/cartoon-handliste.yaml'), 'utf8')) as { eintraege?: HandlisteEintrag[] } | null
  const liste = roh?.eintraege ?? []
  const gesehen = new Set<number>()
  for (const [i, e] of liste.entries()) {
    const wo = `data/cartoon-handliste.yaml, Eintrag ${i + 1} (${e?.adn ?? '?'})`
    if (!Number.isInteger(e?.adn)) throw new Error(`${wo}: adn fehlt`)
    if (!e.name) throw new Error(`${wo}: name fehlt`)
    if (e.tmdb !== undefined && !Number.isInteger(e.tmdb)) throw new Error(`${wo}: tmdb ist keine Zahl`)
    if (gesehen.has(e.adn)) throw new Error(`${wo}: ADN-Kennung steht doppelt`)
    gesehen.add(e.adn)
  }
  return liste
}

/** Die Suchbegriffe eines Eintrags: Original zuerst, dann der deutsche Name, dann die Varianten. */
export function suchbegriffe(e: HandlisteEintrag): string[] {
  return [...new Set([e.original, e.name, ...(e.varianten ?? [])].filter((n): n is string => Boolean(n)))]
}

/** Ergänzt die Folgenzahl der Animations-Kandidaten (höchstens zehn Kennungen) aus einer Detailabfrage; ohne `folgen` bleibt alles, wie es ist. */
export async function mitFolgen(treffer: TmdbSuchtreffer[], folgen?: (id: number) => Promise<number | undefined>): Promise<TmdbSuchtreffer[]> {
  if (!folgen) return treffer
  const ergaenzt = new Map<number, TmdbSuchtreffer>()
  for (const t of treffer) {
    if (!t.id || ergaenzt.has(t.id) || ergaenzt.size >= 10) continue
    const animation = (t.genre_ids ?? []).includes(ANIMATION)
    ergaenzt.set(t.id, animation ? { ...t, number_of_episodes: await folgen(t.id) } : t)
  }
  return [...ergaenzt.values()]
}

/** Die Kandidaten einer Suche fürs Log: Kennung, Name, Originalname, Jahr, Folgenzahl, Animation; ohne Doppelte, höchstens zehn. */
export function kandidatenZeile(treffer: TmdbSuchtreffer[]): string {
  const einzeln = new Map<number, TmdbSuchtreffer>()
  for (const t of treffer) if (t.id && !einzeln.has(t.id)) einzeln.set(t.id, t)
  const zeilen = [...einzeln.values()].slice(0, 10).map((t) => {
    const animation = (t.genre_ids ?? []).includes(ANIMATION) ? 'Animation' : 'keine Animation'
    return `${t.id} „${t.name ?? '?'}“/„${t.original_name ?? '?'}“ ${jahrFolgen(t)}, ${animation}`
  })
  return zeilen.length ? zeilen.join('; ') : 'keine Treffer'
}

/** Der einzige Treffer, dessen Name stimmt (Animation, Name oder Originalname gleich einem Namen des Eintrags, bei `jahr` auch das Jahr). */
export function waehleTreffer(e: HandlisteEintrag, treffer: TmdbSuchtreffer[]): Wahl {
  const namen = new Set(suchbegriffe(e).map(normalisiere))
  const passend = new Map<number, TmdbSuchtreffer>()
  for (const t of treffer) {
    if (!t.id || !(t.genre_ids ?? []).includes(ANIMATION)) continue
    if (![t.name, t.original_name].some((n) => n && namen.has(normalisiere(n)))) continue
    if (e.jahr !== undefined && Number(t.first_air_date?.slice(0, 4)) !== e.jahr) continue
    passend.set(t.id, t)
  }
  if (passend.size === 1) return { id: [...passend.keys()][0] }
  if (!passend.size) return { grund: 'kein Treffer mit Animation und gleichem Namen' }
  return { grund: `mehrdeutig (TMDB ${[...passend.keys()].join(', ')})` }
}

/** „Jahr/Folgen“ des Treffers fürs Log; die TMDB-Suche liefert keine Folgenzahl, dann „?“. */
export function jahrFolgen(t: TmdbSuchtreffer | undefined): string {
  return `Jahr/Folgen ${t?.first_air_date?.slice(0, 4) || '?'}/${t?.number_of_episodes ?? '?'}`
}

/** Zwei Einträge, die auf dieselbe TMDB-Serie zeigen, sind nicht entscheidbar: keiner wird übernommen. */
export function ohneDoppelte(aufgeloest: Map<number, number>): { ok: Map<number, number>; doppelt: number[] } {
  const jeTmdb = new Map<number, number[]>()
  for (const [adn, tmdb] of aufgeloest) jeTmdb.set(tmdb, [...(jeTmdb.get(tmdb) ?? []), adn])
  const doppelt = [...jeTmdb.values()].filter((a) => a.length > 1).flat()
  return { ok: new Map([...aufgeloest].filter(([adn]) => !doppelt.includes(adn))), doppelt }
}

/**
 * ADN-Kennung → TMDB-Kennung für alle Einträge, die der Abruf aufnimmt. Feste `tmdb` gilt ohne Suche; sonst sucht der Abruf je Begriff
 * und nimmt nur einen eindeutigen Treffer. Ein Eintrag, den der Bestand schon trägt (`bestandsTmdb`), wird nicht neu gesucht.
 */
export async function loeseHandliste(
  liste: HandlisteEintrag[],
  bestandsTmdb: Map<number, number>,
  suche: (begriff: string) => Promise<TmdbSuchtreffer[]>,
  melde: (zeile: string) => void,
  folgen?: (id: number) => Promise<number | undefined>,
): Promise<Map<number, number>> {
  const aufgeloest = new Map<number, number>()
  for (const e of liste) {
    if (e.pruefen) {
      melde(`  Handliste ${e.adn} (${e.name}): ausgelassen, Grenzfall: ${e.pruefen}`)
      continue
    }
    const fest = e.tmdb ?? bestandsTmdb.get(e.adn)
    if (fest) {
      aufgeloest.set(e.adn, fest)
      continue
    }
    const treffer: TmdbSuchtreffer[] = []
    for (const begriff of suchbegriffe(e)) treffer.push(...(await suche(begriff)))
    const wahl = waehleTreffer(e, treffer)
    if ('id' in wahl) {
      melde(`  Handliste ${e.adn} (${e.name}): TMDB ${wahl.id} gefunden (Name und Animation stimmen; ${jahrFolgen((await mitFolgen(treffer.filter((t) => t.id === wahl.id), folgen))[0])})`)
      aufgeloest.set(e.adn, wahl.id)
    } else melde(`  Handliste ${e.adn} (${e.name}): nicht übernommen — ${wahl.grund}. Kandidaten: ${kandidatenZeile(await mitFolgen(treffer, folgen))}`)
  }
  const { ok, doppelt } = ohneDoppelte(aufgeloest)
  for (const adn of doppelt) melde(`  Handliste ${adn}: nicht übernommen — dieselbe TMDB-Serie wie ein anderer Eintrag`)
  return ok
}

/** Die Kandidaten des Abrufs plus die Serien der Handliste (ohne Doppelte). */
export function mitHandliste(ids: number[], adnJeTmdb: Map<number, number>): number[] {
  return [...new Set([...ids, ...adnJeTmdb.keys()])]
}

/** Trägt der Bestand eine andere ADN-Kennung als die Handliste (neu aufgenommen oder entfernt), wird der Eintrag neu geholt. */
export function adnKennungGeaendert(e: { adnId?: number }, adnId: number | undefined): boolean {
  return e.adnId !== adnId
}

/** Der geholte Eintrag trägt die ADN-Kennung der Handliste. */
export function mitAdnKennung<T extends object>(e: T, adnId: number | undefined): T & { adnId?: number } {
  return adnId ? { ...e, adnId } : e
}
