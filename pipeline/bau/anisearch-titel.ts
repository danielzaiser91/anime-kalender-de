import { log, readJson, warn } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import { ohneSynchroVonHand } from './ohne-beleg.ts'
import type { DubConfidence, Title } from '../../shared/types.ts'
import { anisearchHand } from './grundlagen.ts'
import { slugify } from '../lib/util.ts'

/**
 * **Titel, die nur bei aniSearch stehen** (Daniel, 06.10.2026: „wir nehmen alle Kennungen von aniSearch und tragen alle Titel so ein, wie
 * aniSearch es tut"). AniList fasst manches zusammen, was aniSearch einzeln führt — Specials einer Serie, Teile einer Staffel — und führt
 * anderes gar nicht (westliche Serien, Filme, Web-Produktionen).
 *
 * Quelle ist `data/anisearch-eintraege.json` (Kennung → kompakter Eintrag aus `/v1/anime/<Kennung>`, ohne Hentai). Der Titel bekommt die
 * Kennung `ANISEARCH_ID_BASIS + aniSearch-Kennung`; AniList-Kennungen liegen weit darunter, die Cartoons nutzen negative. Er trägt **kein Cover**
 * von aniSearch (die Bilder dort sind nicht zur Weitergabe freigegeben; ein TMDB-Plakat gilt, wo eines zu Name und Jahr passt) und keine MAL-Kennung (sie gehört der Hauptfassung, sonst verwechselt der
 * Bau beide). Wo aniSearch Deutsch nicht kennt (`-`), bleibt er hinter dem Toggle (`anisearchNurKatalog`).
 */
export const ANISEARCH_ID_BASIS = 10_000_000

type Eintrag = {
  t: string
  n?: string
  de?: string
  en?: string
  ty: string
  y?: number
  f?: number
  min?: number
  von?: string
  bis?: string
  mal?: number
  st?: string[]
  /** Deutsch bei aniSearch: `d` vertont, `p` geplant, `c` abgebrochen, `-` nicht genannt. */
  dub: 'd' | 'p' | 'c' | '-'
  pub?: string[]
  dvon?: string
}

/**
 * Die Typen, die aniSearch liefert — englisch ohne, deutsch mit ?lang=de (fetch-anisearch-eintraege.ts). Bis zum 07.10.2026 kannte die Tabelle nur die englischen Namen: Jede Serie, jeder
 * Film und jede Web-Produktion aus der Eintragsdatei wurde zum „Special" (Super Wings: „Special · 52 Folgen"), und der Saison-Überblick sah keine einzige davon.
 */
export const FORMAT: Record<string, string> = {
  'TV-Series': 'TV', 'TV-Serie': 'TV',
  Movie: 'MOVIE', Film: 'MOVIE',
  OVA: 'OVA',
  'TV-Special': 'SPECIAL', 'TV-Spezial': 'SPECIAL', Bonus: 'SPECIAL', Other: 'SPECIAL', Anderes: 'SPECIAL', CM: 'SPECIAL', Unbekannt: 'SPECIAL', Unknown: 'SPECIAL',
  Web: 'ONA',
  'Music Video': 'MUSIC', Musikvideo: 'MUSIC',
}
const SICHERHEIT: Record<Eintrag['dub'], DubConfidence> = { d: 'high', p: 'normal', c: 'normal', '-': 'low' }

let eintraege: Record<string, Eintrag> | undefined
export const alle = (): Record<string, Eintrag> => (eintraege ??= readJson<Record<string, Eintrag>>('data/anisearch-eintraege.json', {}))

/** Ausschließlich im Katalog: Einträge, bei denen aniSearch kein Deutsch nennt. */
export function anisearchNurKatalog(): Set<number> {
  return new Set(Object.entries(alle()).filter(([, e]) => e.dub === '-').map(([id]) => ANISEARCH_ID_BASIS + Number(id)))
}

type Zuordnung = Record<string, { anisearchId?: number }>
/** Die Zuordnung AniList → aniSearch: Abruf-Ergebnis (`data/anisearch.json`), darüber die Handdatei (`data/anisearch-ids-hand.yaml`). */
const zuordnungen = (): Zuordnung => ({
  ...readJson<Zuordnung>('data/anisearch.json', {}),
  ...Object.fromEntries(Object.entries(anisearchHand).map(([anilist, anisearchId]) => [anilist, { anisearchId }])),
})
const mitDeutsch = (dub?: string): boolean => dub === 'd' || dub === 'p' || dub === 'c'

/**
 * Eigenkennungen, die ein Katalog-Lauf nachträglich einem AniList-Titel zugeordnet hat: Der Titel zieht um, er geht nicht verloren.
 * Führt aniSearch Deutsch (d/p/c), muss der Nachfolger im `hauptbestand` stehen; ohne Deutsch genügt `hinterToggle`.
 */
export function anisearchUmgezogen(hauptbestand: Set<number>, hinterToggle: Set<number>, zuordnung: Zuordnung = zuordnungen(), eintraege: Record<string, Eintrag> = alle()): Set<number> {
  const umgezogen = new Set<number>()
  for (const [anilist, z] of Object.entries(zuordnung)) {
    if (!z.anisearchId) continue
    const ziel = Number(anilist)
    if (hauptbestand.has(ziel) || (hinterToggle.has(ziel) && !mitDeutsch(eintraege[String(z.anisearchId)]?.dub))) umgezogen.add(ANISEARCH_ID_BASIS + z.anisearchId)
  }
  return umgezogen
}

/**
 * Einträge mit Deutsch bei aniSearch (d/p/c), deren eigener oder zugeordneter AniList-Titel nicht im `hauptbestand` steht (Daniel, 08.10.2026:
 * Teilsynchro gehört in den Hauptbestand). Ausgenommen: noch nicht gestartet (Ankündigung bleibt hinter dem Toggle) und `ausgenommen` (Handurteil „keine Synchro").
 */
export function dubNurHinterToggle(hauptbestand: Set<number>, heute: string, ausgenommen: Set<number> = new Set(), zuordnung: Zuordnung = zuordnungen(), eintraege: Record<string, Eintrag> = alle(), angekuendigt: Set<number> = new Set()): string[] {
  const anilistIds = new Map<number, number[]>()
  for (const [anilist, z] of Object.entries(zuordnung)) if (z.anisearchId) anilistIds.set(z.anisearchId, [...(anilistIds.get(z.anisearchId) ?? []), Number(anilist)])
  return Object.entries(eintraege)
    .filter(([schluessel, e]) => {
      if (!mitDeutsch(e.dub) || (e.von && e.von > heute)) return false
      const kennungen = [ANISEARCH_ID_BASIS + Number(schluessel), ...(anilistIds.get(Number(schluessel)) ?? [])]
      /* Geplanter Dub (`p`) bei einem Titel, dessen Ankündigung oder japanischer Start noch aussteht, ist der dokumentierte Grund (AniList-Start und aniSearch-Start weichen um Tage ab). */
      return !kennungen.some((id) => hauptbestand.has(id) || ausgenommen.has(id) || (e.dub === 'p' && angekuendigt.has(id)))
    })
    .map(([schluessel]) => schluessel)
}

/**
 * Für den Verlust-Riegel des Baus: die umgezogenen Eigenkennungen (Lauf 37730481739, 37735573290: acht Titel mit abgebrochenem Dub, 2908 → 2930). Nachfolger hinter dem Toggle
 * zählt auch der AniList-Katalog. **Bricht ab**, wenn ein Eintrag mit vertontem oder abgebrochenem Deutsch (d/c) weder im Hauptbestand steht
 * noch einen dokumentierten Grund hat (noch nicht gestartet, Handurteil „keine Synchro"). Ein geplanter Dub (p) ohne Grund (auch `angekuendigt` zählt) wird gemeldet,
 * nicht hart geprüft: Er kann seit Jahren offen sein (Servamp-Film 2018).
 */
export function anisearchUmgezogenInBestand(hauptbestand: Set<number>, hinterToggle: Set<number>, angekuendigt: Set<number> = new Set()): Set<number> {
  const katalog = readJson<{ eintraege?: { id: number }[] }>('data/cache/anilist-katalog.json', {}).eintraege ?? []
  const abseits = dubNurHinterToggle(hauptbestand, todayIso(), ohneSynchroVonHand(), zuordnungen(), alle(), angekuendigt)
  const hart = abseits.filter((id) => alle()[id]?.dub !== 'p')
  if (hart.length) throw new Error(`${hart.length} aniSearch-Einträge mit vertontem oder abgebrochenem Deutsch (d/c) stehen nicht im Hauptbestand und haben keinen Grund: ${hart.slice(0, 10).join(', ')}`)
  if (abseits.length > hart.length) warn(`${abseits.length - hart.length} aniSearch-Einträge mit geplantem Deutsch (p) stehen nicht im Hauptbestand: ${abseits.filter((id) => !hart.includes(id)).slice(0, 10).join(', ')}`)
  return anisearchUmgezogen(hauptbestand, new Set([...hinterToggle, ...katalog.map((e) => e.id)]))
}

const erstausgabeAus = (e: Eintrag) => ({ ...(e.dvon && /^\d{4}-\d{2}-\d{2}$/.test(e.dvon) ? { von: e.dvon } : {}), publisher: e.pub?.[0], synchro: e.dub === 'd' })

/** Der AniList-Titel, an den die Handdatei einen aniSearch-Eintrag bindet, übernimmt dessen deutsche Erstausgabe — sonst ginge sie mit dem aufgegangenen Titel verloren. */
function erstausgabeUebernehmen(titles: Map<number, Title>): void {
  for (const [anilist, anisearchId] of Object.entries(anisearchHand)) {
    const t = titles.get(Number(anilist))
    const e = alle()[String(anisearchId)]
    if (t && e && e.dub !== '-' && !t.deErstausgabe) t.deErstausgabe = erstausgabeAus(e)
  }
}

/** Legt die Titel an, die bei uns noch keine eigene aniSearch-Kennung tragen. Gibt zurück, wie viele es sind. */
export function ergaenzeAnisearchTitel(titles: Map<number, Title>, jpStart: Map<number, string>, jpStartAnzeige: Map<number, string>): number {
  /* Cover: die aniSearch-Bilder dürfen wir nicht weitergeben; wo TMDB ein Plakat zu Name und Jahr kennt (`fetch-tmdb-poster.ts`), steht es als Cover. */
  const poster = readJson<Record<string, { p: string } | null>>('data/tmdb-poster.json', {})
  const vergeben = new Set<number>()
  /*
    Eine Zuordnung zu einem AniList-Titel sperrt den Eintrag nur, wenn dieser Titel im Hauptbestand steht oder der Eintrag kein Deutsch führt: Liegt der
    Titel nur im Katalog hinter dem Toggle, bliebe ein Eintrag mit deutscher Vertonung sonst bis zum nächsten Abruf ganz aus dem Hauptbestand (07.10.2026:
    acht Titel mit abgebrochenem Dub fielen so aus dem Bau). Für die Handdatei gilt es strenger: Auch ohne Deutsch muss der AniList-Titel da sein (Dubletten,
    `docs/wissen/datensatz.md`), sonst bliebe das Werk ohne Zeile und der Termin ohne Titel, an den die Meldungen ihn hängen.
  */
  for (const [anilistId, e] of Object.entries(zuordnungen())) {
    if (!e.anisearchId) continue
    const ohneDeutsch = alle()[String(e.anisearchId)]?.dub === '-' && !(Number(anilistId) in anisearchHand)
    if (titles.has(Number(anilistId)) || ohneDeutsch) vergeben.add(e.anisearchId)
  }
  let neu = 0
  for (const [schluessel, e] of Object.entries(alle())) {
    const asId = Number(schluessel)
    if (vergeben.has(asId)) continue
    const id = ANISEARCH_ID_BASIS + asId
    const anzeige = e.de ?? e.en ?? e.t
    titles.set(id, {
      id,
      slug: `${slugify(anzeige)}-${id}`,
      titleRomaji: e.t,
      titleEn: e.en,
      /* Ein deutscher Name mit angehängter Staffel- oder Teilnummer bleibt weg (`check:logic`: kein Titel trägt die Nummer eines seiner Teile im Namen); es gilt der englische. */
      titleDe: e.de && !/[–—-]\s*(staffel|season|vol\.?|teil|part)\s*\d+\s*$/i.test(e.de) ? e.de : undefined,
      titleNative: e.n,
      ...(poster[String(id)] ? { coverImage: `https://image.tmdb.org/t/p/w500${poster[String(id)]!.p}` } : {}),
      format: FORMAT[e.ty] ?? 'SPECIAL',
      episodes: e.f,
      jpYear: e.y,
      jpEnd: e.bis ?? e.von,
      genres: [],
      keywords: [],
      studios: e.st ?? [],
      dubConfidence: SICHERHEIT[e.dub],
      streams: [],
      ...(e.dub !== '-' ? { deErstausgabe: erstausgabeAus(e) } : {}),
    } as Title)
    if (e.von) {
      jpStart.set(id, e.von)
      jpStartAnzeige.set(id, e.von)
    }
    neu++
  }
  erstausgabeUebernehmen(titles)
  if (neu) log(`${neu} Titel nur bei aniSearch ergänzt (${anisearchNurKatalog().size} davon ohne Deutsch, nur im Katalog); ${[...vergeben].filter((a) => String(a) in alle()).length} Einträge entfallen, weil ein AniList-Titel ihre Kennung trägt`)
  return neu
}

/** Reihen-Kanten: Ein aniSearch-Titel gehört zur Reihe des Titels, der seine MAL-Kennung trägt. */
export function anisearchReihenKanten(titles: Map<number, Title>): { ids: number[] }[] {
  const nachMal = new Map<number, number>()
  for (const t of titles.values()) if (t.malId && t.id < ANISEARCH_ID_BASIS) nachMal.set(t.malId, t.id)
  const kanten: { ids: number[] }[] = []
  for (const [schluessel, e] of Object.entries(alle())) {
    const hauptId = e.mal ? nachMal.get(e.mal) : undefined
    const id = ANISEARCH_ID_BASIS + Number(schluessel)
    if (hauptId && titles.has(id)) kanten.push({ ids: [hauptId, id] })
  }
  return kanten
}

const namensform = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Der längste Vorspann des Namens (vor einem „:" oder „ - "), der der volle Name eines anderen Titels ist
 * („Demon Slayer: Kimetsu no Yaiba - Asakusa Arc" → „Demon Slayer: Kimetsu no Yaiba"). Gibt die Kennungen dieser Titel zurück.
 */
function reihenVorspann(t: Title, nachName: Map<string, Set<number>>): Set<number> | undefined {
  let bester: { laenge: number; ids: Set<number> } | undefined
  for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
    const teile = (name ?? '').split(/\s*(?::|\s[-–—]\s)\s*/)
    for (let i = 1; i < teile.length; i++) {
      const vorspann = namensform(teile.slice(0, i).join(' '))
      const ids = nachName.get(vorspann)
      if (vorspann.length >= 5 && ids && (!bester || vorspann.length > bester.laenge)) bester = { laenge: vorspann.length, ids }
    }
  }
  return bester?.ids
}

/**
 * Reihen-Kanten für aniSearch-Titel ohne Beziehung: aniSearch liefert keine, und ohne MAL-Kennung blieben Teile wie „Demon Slayer – Asakusa Arc" einzelne Karten, obwohl ihre Reihe da ist
 * (Daniel, 10.10.2026). Ein alleinstehender aniSearch-Titel kommt zur Reihe, deren Titel sein Namensvorspann nennt — nur wenn alle Titel dieses Namens in **einer** Reihe stehen (`wurzel`),
 * sonst keine Kante. Anders als das verworfene „vs"-Muster (siehe Crossover in `03-reihen.ts`) verbindet das nie zwei bestehende Reihen: Nur der Alleinstehende wandert.
 */
export function anisearchNamensKanten(titles: Map<number, Title>, wurzel: (id: number) => number): { ids: number[] }[] {
  const nachName = new Map<string, Set<number>>()
  const wurzelGroesse = new Map<number, number>()
  for (const t of titles.values()) {
    const w = wurzel(t.id)
    wurzelGroesse.set(w, (wurzelGroesse.get(w) ?? 0) + 1)
    for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
      if (!name) continue
      const schluessel = namensform(name)
      nachName.set(schluessel, (nachName.get(schluessel) ?? new Set()).add(t.id))
    }
  }
  const kanten: { ids: number[] }[] = []
  for (const t of titles.values()) {
    if (t.id < ANISEARCH_ID_BASIS || wurzelGroesse.get(wurzel(t.id)) !== 1) continue
    const treffer = reihenVorspann(t, nachName)
    if (!treffer) continue
    const andere = [...treffer].filter((id) => id !== t.id)
    /* Ein gleichnamiger Alleinstehender (Dublette) zählt nur, wenn es keine Reihe mit mehreren Titeln gibt. */
    const reihen = andere.filter((id) => wurzelGroesse.get(wurzel(id))! > 1)
    const wurzeln = new Set((reihen.length ? reihen : andere).map(wurzel))
    if (wurzeln.size === 1) kanten.push({ ids: [[...wurzeln][0]!, t.id] })
  }
  return kanten
}
