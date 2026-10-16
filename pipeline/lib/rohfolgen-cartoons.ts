/**
 * Cartoons im Zuordner der gemeldeten Rohfolgen (Daniel, 16.10.2026, F20).
 *
 * `fetch-rohfolgen.ts` kannte nur `titles.json`. Eine Netflix- oder Disney+-Adresse eines Cartoons (`public/data/cartoons.json`,
 * negative Kennung) blieb deshalb „kein Titel zu dieser Adresse", wurde nie abgehakt und kam bei jedem Bau erneut aus der D1:
 * 950 Adressen mit 12.456 Folgen am 16.10.2026.
 *
 * Gleiche Grundsätze wie bei Anime: Die Adresse gehört dem Titel, dessen Verweis sie führt (Plattform-Kennung = Franchise, die
 * Staffel steckt in der Folgenzahl, nicht in der Kennung); nur bei genau einem Titel, sonst bleibt sie mit Grund offen. Die Folgen
 * werden über ihre Titel in die **durchgezählte** Liste des Cartoons gelegt (`data/cartoon-folgen.json`, wie
 * `episodentitel-block.ts`); ohne Folgenliste oder ohne Treffer gilt der Beleg dem Titel (`unsere: null`) — nur bei einheitlichen
 * Tonspuren, wie bei Anime.
 */
import { folgenZuTitel, unsereFolgen, type CartoonFolge, type UnsereFolge } from './episodentitel-block.ts'
import { adressKern } from '../../shared/adresse-kern.ts'
import type { Title } from '../../shared/types.ts'

/** Die Felder einer Rohfolge, die dieser Weg liest. */
export interface CartoonRohfolge {
  id: number
  url: string
  asin: string | null
  titel: string | null
  sprachen: string | null
  plattform?: string | null
  seiten_kennung?: string | null
  titel_id: number | null
  serientitel?: string | null
}

/** Der Titel, dem eine Adresse gehört — ein Cartoon oder der Titel eines Handbelegs. */
export interface ZielTitel {
  id: number
  name: string | null
  /** Der Handbeleg sagt für diese Adresse: kein deutscher Ton. */
  dubFalse?: boolean
}

/** Adresskern → Titel, die ein Handbeleg dort führt (auch mit `dub: false`, auch ohne Verweis im Bestand). */
export type HandbelegAdressen = Map<string, ZielTitel[]>

export interface CartoonZuordnung {
  titleId: number
  asin: string | null
  seite: string | null
  plattform: string
  folgen: { unsere: number | null; sprachen: string[] }[]
}

export interface CartoonOffen {
  url: string
  titel: string | null
  grund: string
  folgen: number
  mitKennung: boolean
}

export type CartoonUrteil = { zugeordnet: CartoonZuordnung } | { offen: Pick<CartoonOffen, 'titel' | 'grund'> }

export type CartoonFolgenDatei = Record<string, { folgen: CartoonFolge[] }>

export interface CartoonLauf<T> {
  zugeordnet: Record<string, CartoonZuordnung>
  offen: CartoonOffen[]
  /** Kennungen der Rohfolgen, die damit erledigt sind (zugeordnet oder als Titel belegt). */
  erledigt: number[]
  /** Die Gruppen, die kein Cartoon betrifft — sie gehen in den Anime-Zuordner. */
  uebrig: Map<string, T[]>
}

const alsZiel = (c: Title): ZielTitel => ({ id: c.id, name: c.titleDe ?? c.titleEn ?? null })

/** Die Cartoons, deren Verweis diese Adresse führt, oder (Kennung der Meldung) die gemeldete Kennung. */
export function cartoonsZurAdresse(url: string, gemeldeteId: number | null, cartoons: Title[]): Title[] {
  if (gemeldeteId !== null && gemeldeteId < 0) return cartoons.filter((c) => c.id === gemeldeteId)
  return cartoons.filter((c) => (c.streams ?? []).some((s) => s.url === url || s.seite === url))
}

/** Die Titel je Adresse aus den Handbelegen; ein Titel zählt nur dann `dubFalse`, wenn alle seine Belege dort Nein sagen. */
export function handbelegAdressen(belege: { anilistId?: number; title?: string; url?: string; dub?: boolean }[]): HandbelegAdressen {
  const karte: HandbelegAdressen = new Map()
  for (const b of belege) {
    if (!b.url || b.anilistId == null) continue
    const kern = adressKern(b.url)
    const liste = karte.get(kern) ?? []
    const da = liste.find((z) => z.id === b.anilistId)
    if (da) da.dubFalse = da.dubFalse && b.dub === false
    else liste.push({ id: b.anilistId, name: b.title ?? null, dubFalse: b.dub === false })
    karte.set(kern, liste)
  }
  return karte
}

/** Wem gehört die Adresse: erst Cartoon (Kennung, Verweis), sonst der Handbeleg. */
export function zielTitelZurAdresse(url: string, gemeldeteId: number | null, cartoons: Title[], belege: HandbelegAdressen): ZielTitel[] {
  const ausCartoons = cartoonsZurAdresse(url, gemeldeteId, cartoons)
  if (ausCartoons.length) return ausCartoons.map(alsZiel)
  return belege.get(adressKern(url)) ?? []
}

/** Der Rest-Eintrag nennt die Serie; ein Folgentitel nur, wenn keine bekannt ist, und dann als „Folge: …“. */
export function restTitel(liste: { titel: string | null; serientitel?: string | null }[]): string | null {
  const serie = liste.find((f) => f.serientitel)?.serientitel
  if (serie) return serie
  return liste[0]?.titel ? `Folge: ${liste[0].titel}` : null
}

/** Die Seite einer Gruppe — nur wenn alle Folgen dieselbe nennen. */
function seiteDer(liste: CartoonRohfolge[]): string | null {
  const s = new Set(liste.map((f) => f.seiten_kennung ?? ''))
  return s.size === 1 ? [...s][0] || null : null
}

/** Je Folge die Zeile unserer durchgezählten Liste, wenn ihr Titel genau eine trifft. */
function folgenInListe(liste: CartoonRohfolge[], unsere: UnsereFolge[]): { index: number; unsere: number }[] {
  const treffer: { index: number; unsere: number }[] = []
  liste.forEach((f, index) => {
    const nr = folgenZuTitel(f.titel, unsere)
    if (nr.length === 1) treffer.push({ index, unsere: nr[0]! })
  })
  return treffer
}

/** Urteil für eine Adresse, die genau einem Cartoon gehört. */
export function ordneCartoonAdresse(liste: CartoonRohfolge[], ziel: ZielTitel, folgenDatei: CartoonFolgenDatei): CartoonUrteil {
  const kopf = {
    titleId: ziel.id,
    asin: liste.find((f) => f.asin)?.asin ?? null,
    seite: seiteDer(liste),
    plattform: liste[0]!.plattform ?? 'primevideo',
  }
  const sprachenJe = liste.map((f) => f.sprachen ?? '[]')
  const titelFolge = [{ unsere: null, sprachen: JSON.parse(sprachenJe[0]!) as string[] }]
  const alsTitel: CartoonUrteil = { zugeordnet: { ...kopf, folgen: titelFolge } }
  if (liste.length === 1) return alsTitel
  const unsere = unsereFolgen(folgenDatei[String(ziel.id)]?.folgen ?? [])
  const treffer = folgenInListe(liste, unsere)
  if (treffer.length) {
    const folgen = treffer.map((t) => ({ unsere: t.unsere, sprachen: JSON.parse(sprachenJe[t.index]!) as string[] }))
    return { zugeordnet: { ...kopf, folgen } }
  }
  const keinDeutsch = Boolean(ziel.dubFalse) && !sprachenJe.some((s) => s.includes('Deutsch'))
  if (new Set(sprachenJe).size === 1 || keinDeutsch) return alsTitel
  const anker = unsere.length ? 'Cartoon-Folgenliste' : 'keine Folgenliste in cartoon-folgen.json'
  const grund = `keine einzige Folge zuzuordnen, Tonspuren uneinheitlich (Anker: ${anker})`
  return { offen: { titel: ziel.name ?? restTitel(liste), grund } }
}

/**
 * Löst die Gruppen heraus, die zu genau einem Cartoon gehören. Gehört Adresse oder gemeldete Kennung einem Anime
 * (`animeGehoert`), entscheidet der Anime-Weg wie bisher.
 */
export function ordneCartoonsZu<T extends CartoonRohfolge>(
  jeUrl: Map<string, T[]>,
  cartoons: Title[],
  belege: HandbelegAdressen,
  folgenDatei: CartoonFolgenDatei,
  animeGehoert: (url: string, gemeldeteId: number | null) => boolean,
): CartoonLauf<T> {
  const lauf: CartoonLauf<T> = {
    zugeordnet: {},
    offen: [],
    erledigt: [],
    uebrig: new Map(),
  }
  for (const [schluessel, liste] of jeUrl) {
    const url = liste[0]!.url
    const gemeldeteId = liste.find((f) => Number.isFinite(f.titel_id))?.titel_id ?? null
    const treffer = animeGehoert(url, gemeldeteId) ? [] : zielTitelZurAdresse(url, gemeldeteId, cartoons, belege)
    if (!treffer.length) {
      lauf.uebrig.set(schluessel, liste)
      continue
    }
    const kopf = { url, mitKennung: gemeldeteId !== null, folgen: liste.length }
    if (treffer.length > 1) {
      const grund = `${treffer.length} Titel teilen diese Adresse`
      lauf.offen.push({ ...kopf, titel: restTitel(liste), grund })
      continue
    }
    const urteil = ordneCartoonAdresse(liste, treffer[0]!, folgenDatei)
    if ('offen' in urteil) {
      lauf.offen.push({ ...kopf, ...urteil.offen })
      continue
    }
    lauf.zugeordnet[schluessel] = urteil.zugeordnet
    for (const f of liste) lauf.erledigt.push(f.id)
  }
  return lauf
}

/** Ob Adresse oder gemeldete Kennung einem Anime aus `titles.json` gehört — dann bleibt es beim Anime-Weg. */
export function animeZugehoerigkeit(titles: Title[]): (url: string, gemeldeteId: number | null) => boolean {
  const ids = new Set(titles.map((t) => t.id))
  const adressen = new Set<string>()
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      adressen.add(s.url)
      if (s.seite) adressen.add(s.seite)
    }
  }
  return (url, gemeldeteId) => (gemeldeteId !== null && ids.has(gemeldeteId)) || adressen.has(url)
}
