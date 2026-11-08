/**
 * **Welche Synchro-Aussagen aus Anime2You-Artikeln ohne Handgriff zum Handbeleg werden** (F108 = A, Daniel 07.11.2026; Anlass Devils’ Crest:
 * Artikel von 15:45 Uhr, der Beleg kam einen Tag später von Hand).
 *
 * Reine Auswahl, kein Schreiben. Ein Vorschlag wird nur dann zum Beleg, wenn jede Stufe eindeutig ist; sonst bleibt er ein Vorschlag wie bisher,
 * mit Grund in der Zusammenfassung:
 *
 * 1. Das Zitat nennt die Synchro ausdrücklich und bejahend (`nenntSynchro`), Sprache deutsch oder deutsch+omu, Art start/folgen/sprachfassung,
 *    Stream-Plattform, kein Tag in der Zukunft, kein „unsicher“, keine Warnung. Ausnahme: „Anbieter/Plattform steht nur im Artikeltext“ –
 *    die Plattform belegt dann der vorhandene Weg des Titels (Stufe 3) unabhängig vom Artikel. Die Plattform muss an die Synchro-Aussage
 *    gebunden sein (`plattformGebunden`): genau diese eine im Zitat, sonst genau diese eine im Artikeltitel; mehrdeutig = kein Beleg.
 * 2. Der Titel passt mit genau einem Katalogtitel im Namen überein (gleiche Wortfolge in titleDe, titleEn oder titleRomaji, kein Teilwort).
 *    Bewusst strenger als der Fuzzy-Abgleich `bewerteTreffer` (adn.ts): eine Fehlzuordnung wäre ein falscher Haken an fremdem Titel.
 * 3. Der Titel hat genau einen Weg bei dieser Plattform, und dessen Urteil steht noch offen (kein `dub`); ein Handbeleg zu Titel und Plattform
 *    gewinnt immer, auch ein Nein.
 */
import { ANBIETER_NUR_IM_ARTIKEL, nenntName, PLATTFORM_NAMEN } from './anime2you-abgleich.ts'
import type { GespeicherterVorschlag } from './anime2you-bestand.ts'
import { SYNCHRO_WORTLAUT, VERNEINT } from './dub-aus-terminen.ts'

export interface KatalogTitel {
  id: number
  titleDe?: string | null
  titleEn?: string | null
  titleRomaji?: string | null
  streams?: { platform: string; dub?: boolean }[]
}

export interface AutoBeleg {
  anilistId: number
  /** Der Name aus dem Katalog (nicht der des Artikels). */
  titel: string
  plattform: string
  zitat: string
  artikelId: string
  quelle: string
  veroeffentlicht: string
}

export interface Zurueckgestellt {
  titel: string
  artikelId: string
  grund: string
}

/**
 * Handbelege je `anilistId|plattform`: bis zu welchem Tag sie einen Auto-Beleg sperren. Ein Ja (und ein „nicht verfügbar“) sperrt immer (`IMMER`),
 * ein Nein bis zu seinem Messtag – ein Artikel, der danach erschien, darf es überholen (Pet: Nein vom 16.10., Artikel vom 06.11.).
 */
export type Belegstand = Map<string, string>
export const IMMER = '9999-12-31'

/** Höchstens so viele Auto-Belege je Kalendertag, über alle Läufe des Tages (harter Riegel; stündlicher Lauf). */
export const HOECHSTENS_AM_TAG = 10
/** Beginn der Notiz jedes Auto-Belegs – daran zählt der Riegel, und daran erkennt man sie in der Datei. */
export const NOTIZ_MARKE = 'Anime2You-Automatik'

const ARTEN = new Set(['start', 'folgen', 'sprachfassung'])
const KEIN_STREAM = new Set(['tv', 'kino', 'disc'])

const name = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Bejaht das Zitat die Synchro? Das bloße „auf Deutsch“ zählt nicht (trifft `SYNCHRO_WORTLAUT`, auch „auf Deutsch untertitelt“); Untertitel treffen den Wortlaut ohnehin nicht. */
export function nenntSynchro(zitat: string): boolean {
  if (VERNEINT.test(zitat)) return false
  return SYNCHRO_WORTLAUT.test(zitat.replace(/auf deutsch/gi, ' '))
}

const ZAHL_WORT: Record<string, string> = { second: '2', third: '3', fourth: '4', fifth: '5' }

/**
 * Name mit einheitlicher Staffelzählung: „Second Season“, „2nd Season“, „Season 2“ und „Staffel 2“ werden alle zu „staffel 2“ –
 * der Artikel schreibt anders als der Katalog (Black Clover Second Season gegen „Black Clover: Staffel 2“, Katalog 195604).
 */
export function staffelName(s: string | null | undefined): string {
  const zaehlung = (s ?? '')
    .toLowerCase()
    .replace(/\b(?:(\d+)(?:st|nd|rd|th)|(second|third|fourth|fifth))\s+season\b/g, (_m, z?: string, w?: string) => `staffel ${z ?? ZAHL_WORT[w!]}`)
    .replace(/\b(?:season|staffel)\s*(\d+)\b/g, (_m, z: string) => `staffel ${z}`)
  return name(zaehlung)
}

/**
 * Der einzige Katalogtitel mit diesem Namen; bei keinem oder mehreren der Grund als Text. Mit `plattform` entscheidet bei mehreren Namensgleichen
 * der, der dort einen Weg hat (Colorful: Film 8142 mit Joyn-Weg gegen die Kurzserie 841 ohne Wege).
 */
export function ordneTitelZu(titel: string, katalog: KatalogTitel[], plattform?: string): KatalogTitel | string {
  const gesucht = staffelName(titel)
  if (!gesucht) return 'Titel ohne Buchstaben'
  const treffer = katalog.filter((t) => [t.titleDe, t.titleEn, t.titleRomaji].some((n) => staffelName(n) === gesucht))
  if (treffer.length === 1) return treffer[0]!
  const mitWeg = treffer.filter((t) => (t.streams ?? []).some((s) => s.platform === plattform))
  if (mitWeg.length === 1) return mitWeg[0]!
  return treffer.length ? `Titel mehrdeutig (${treffer.map((t) => t.id).join(', ')})` : 'Titel nicht im Katalog'
}

const plattformenIn = (text: string): string[] => Object.entries(PLATTFORM_NAMEN).filter(([, n]) => nenntName(text, n)).map(([id]) => id)

/**
 * Ist die Plattform des Vorschlags an die Synchro-Aussage gebunden? Ja, wenn das Zitat genau diese eine Plattform nennt; nennt es keine oder
 * mehrere (Stream-Zeile „Prime Video, Crunchyroll“ gilt dem Titel, nicht der Synchro), entscheidet der Artikeltitel – er muss genau diese
 * eine Plattform nennen. Sonst ist die Zuordnung mehrdeutig (Aoashi, PSYREN, I Parry Everything!: Synchro nur bei Crunchyroll bzw. ADN).
 */
export function plattformGebunden(v: Pick<GespeicherterVorschlag, 'plattform' | 'zitat' | 'artikel'>): boolean {
  const imZitat = plattformenIn(v.zitat)
  if (imZitat.length === 1) return imZitat[0] === v.plattform
  const imTitel = plattformenIn(v.artikel)
  return imTitel.length === 1 && imTitel[0] === v.plattform
}

function ersterGrund(v: GespeicherterVorschlag, heute: string): string | undefined {
  if (!ARTEN.has(v.art)) return `Art ${v.art}`
  if (v.warnungen.some((w) => !ANBIETER_NUR_IM_ARTIKEL.test(w))) return 'Warnung am Vorschlag'
  if (v.unsicher) return 'Vorschlag ist als unsicher gekennzeichnet'
  if (!v.plattform && v.anbieter) return `keine Stream-Plattform im Datenmodell (Anbieter ${v.anbieter} hat keine Kennung)`
  if (!v.plattform || KEIN_STREAM.has(v.plattform)) return 'keine Stream-Plattform im Datenmodell'
  if (!plattformGebunden(v)) return `Plattform ${v.plattform} nicht eindeutig an die Synchro-Aussage gebunden (Zitat und Artikeltitel)`
  if (v.datum && v.datum > heute) return `Tag ${v.datum} liegt in der Zukunft`
  return undefined
}

function wegGrund(t: KatalogTitel, plattform: string, belegt: Belegstand, artikelTag: string): string | undefined {
  const wege = (t.streams ?? []).filter((s) => s.platform === plattform)
  if ((belegt.get(`${t.id}|${plattform}`) ?? '') >= artikelTag) return 'Handbeleg zu Titel und Plattform steht schon'
  if (wege.length !== 1) return wege.length ? `${wege.length} Wege bei ${plattform}` : `kein Weg bei ${plattform} (wartet auf den Bestandsbau)`
  if (wege[0]!.dub !== undefined) return `Weg trägt schon dub: ${wege[0]!.dub}`
  return undefined
}

/**
 * Aus den neuen Vorschlägen die Auto-Belege. `belegt`: siehe `Belegstand`. `platzHeute`: wie viele der
 * `HOECHSTENS_AM_TAG` heute noch frei sind; was darüber hinausgeht, wird zurückgestellt.
 */
export function waehleSynchroBelege(
  vorschlaege: GespeicherterVorschlag[],
  katalog: KatalogTitel[],
  belegt: Belegstand,
  heute: string,
  platzHeute: number,
): { belege: AutoBeleg[]; zurueck: Zurueckgestellt[] } {
  const belege: AutoBeleg[] = []
  const zurueck: Zurueckgestellt[] = []
  const schluessel = new Map(belegt)
  for (const v of vorschlaege) {
    if (!v.sprache.startsWith('deutsch')) continue
    const lehne = (grund: string) => zurueck.push({ titel: v.titel, artikelId: v.artikelId, grund })
    if (!nenntSynchro(v.zitat)) {
      lehne('Zitat nennt die Synchro nicht ausdrücklich')
      continue
    }
    const grund = ersterGrund(v, heute)
    if (grund) {
      lehne(grund)
      continue
    }
    const t = ordneTitelZu(v.titel, katalog, v.plattform!)
    if (typeof t === 'string') {
      lehne(t)
      continue
    }
    const wegFehler = wegGrund(t, v.plattform!, schluessel, v.veroeffentlicht)
    if (wegFehler) {
      lehne(wegFehler)
      continue
    }
    if (belege.length >= platzHeute) {
      lehne(`Tageshöchstmenge von ${HOECHSTENS_AM_TAG} erreicht`)
      continue
    }
    schluessel.set(`${t.id}|${v.plattform}`, IMMER)
    belege.push({
      anilistId: t.id,
      titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? v.titel,
      plattform: v.plattform!,
      zitat: v.zitat,
      artikelId: v.artikelId,
      quelle: v.quelle,
      veroeffentlicht: v.veroeffentlicht,
    })
  }
  return { belege, zurueck }
}

/** Die Zeilen eines Belegs für `haengeBelegeAn`; Zeichenketten als JSON, damit Anführungszeichen im Zitat das YAML nicht brechen. */
export function belegZeilen(b: AutoBeleg, heute: string): string[] {
  const note = `${NOTIZ_MARKE}: Artikel ${b.quelle} (${b.veroeffentlicht}): „${b.zitat}“ Aussage des Artikels; Seite des Anbieters nicht geprüft.`
  return [
    '',
    `- anilistId: ${b.anilistId}`,
    `  title: ${JSON.stringify(b.titel)}`,
    `  platform: ${b.plattform}`,
    '  dub: true',
    `  checkedAt: '${heute}'`,
    `  note: ${JSON.stringify(note)}`,
  ]
}
