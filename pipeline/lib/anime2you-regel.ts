/**
 * Anime2You-Artikel ohne Claude: Regeln lesen die Synchro-Behauptungen, die sicher zu einem Titel und genau einer Plattform gehören.
 * Nur Bibliothek (kein Lauf, kein Abruf); das Maß ist Claudes Rohantwort über 232 Artikel (`daniel-zum-abarbeiten/berichte/anime2you-ohne-claude-vergleich-2026-11-07.md`).
 *
 * Zwei Familien, beide liefern höchstens, was eindeutig ist – alles andere bleibt Rest für Claude:
 * - **Block**: »Titel«, darunter `Sprache:` und `Stream:`. Eigener Scanner statt `leseSammelartikel` (dort fehlen Felder wie „Verfügbar bis“, „Noch nicht verfügbar“
 *   fällt aus `stream`, und das Zitat fehlt); gemessen: 71 von 71 Behauptungen gleich Claude, `leseSammelartikel` gab 3 weniger und 4 ungeprüfte mehr.
 * - **Satz**: ein Satz mit genau einem »Titel« und genau einer Plattform, der die Synchro bejaht.
 *
 * Die vier Schärfungen (je aus einem gemessenen Fehlbeleg):
 * 1. Mehrere Plattformen in `Stream:` zählen nur, wenn der Artikeltitel genau eine davon nennt; „(nach TV-Ausstrahlung)“ ist kein Weg.
 * 2. Ein Satz mit mehr als einer Plattform oder mehr als einem Titel ist Rest (Berserk: Netflix OmU, aniverse deutsch).
 * 3. Satzgrenze nicht hinter „20.“ vor einem Monatsnamen, wohl aber hinter „153.“ vor „Bei“.
 * 4. „Synchronsprecher“, „Synchronstimme“, „Synchronregie“ sind keine Synchro-Aussage; ein Jahr vor dem Veröffentlichungsjahr im Satz macht ihn zum Rest.
 *
 * Die Felder entsprechen dem Vorschlag, den `lib/synchro-beleg-auswahl.ts` (PR 3085) liest; `art` fehlt bewusst (die Regel kennt sie nicht).
 */
import { SYNCHRO_WORTLAUT, VERNEINT } from './dub-aus-terminen.ts'

export interface Behauptung {
  titel: string
  /** Staffel o. ä. hinter dem Titel („Staffel 2“), nur bei Blöcken. */
  zusatz?: string
  plattform: string
  sprache: 'deutsch' | 'deutsch+omu'
  /** Wörtlich im Artikeltext (Blöcke: die Zeilen mit `\n`). */
  zitat: string
  datum?: string
  familie: 'block' | 'satz'
}

/** Wortmarken der Stream-Plattformen. `scrape-anime2you.ts` führt eine ähnliche Liste, ist aber ein Skript (nicht importierbar) und kennt Paramount+ nicht. */
const MARKEN: [string, RegExp][] = [
  ['crunchyroll', /crunchyroll/i], ['netflix', /netflix/i], ['primevideo', /prime video|amazon prime/i],
  ['disneyplus', /disney\s?\+/i], ['paramountplus', /paramount\s?\+/i], ['adn', /\bADN\b|anime digital network/i],
  ['aniverse', /aniverse/i], ['wow', /\bWOW\b/], ['joyn', /joyn/i], ['rtlplus', /rtl\s?\+/i], ['youtube', /youtube/i],
]
export const plattformen = (s: string): string[] => MARKEN.filter(([, re]) => re.test(s)).map(([k]) => k)

/** Wie `nenntSynchro` in `lib/synchro-beleg-auswahl.ts` (PR 3085); nach dessen Merge von dort importieren. */
export function nenntSynchro(zitat: string): boolean {
  if (VERNEINT.test(zitat)) return false
  return SYNCHRO_WORTLAUT.test(zitat.replace(/auf deutsch/gi, ' '))
}

const zeilenVon = (text: string): string[] => text.split('\n').map((z) => z.trim()).filter(Boolean)

/**
 * Schärfung 1: Plattform eines Blocks aus `Stream:`; ohne Stream-Zeile die einzige des Artikeltitels.
 * „Noch nicht verfügbar“ nennt keine Plattform und bleibt Rest (anders als in `leseSammelartikel`, das solche Einträge aus `stream` streicht).
 */
export function plattformDesBlocks(stream: string | undefined, artikelPlattformen: string[]): string | undefined {
  if (stream === undefined) return artikelPlattformen.length === 1 ? artikelPlattformen[0] : undefined
  if (/nach (?:der )?tv/i.test(stream)) return undefined
  const gefunden = plattformen(stream)
  if (gefunden.length <= 1) return gefunden[0]
  const genannt = gefunden.filter((p) => artikelPlattformen.includes(p))
  return genannt.length === 1 ? genannt[0] : undefined
}

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** „1. November“ oder „01.11.“ vor dem Titel → ISO-Tag; das Jahr aus dem Veröffentlichungstag (Dezember-Artikel mit Januar-Tag: nächstes Jahr). */
export function datumAusPraefix(praefix: string, veroeffentlicht: string): string | undefined {
  const m = /(\d{1,2})\.\s*([a-zäöü]+)|(\d{1,2})\.(\d{2})\./i.exec(praefix)
  const tag = Number(m?.[1] ?? m?.[3])
  const monat = m?.[1] ? MONATE.findIndex((n) => n.toLowerCase() === m[2]!.toLowerCase()) + 1 : Number(m?.[4])
  if (!m || !monat) return undefined
  const jahr = Number(veroeffentlicht.slice(0, 4))
  const jetzt = Number(veroeffentlicht.slice(5, 7))
  const gemeint = monat < jetzt - 6 ? jahr + 1 : monat > jetzt + 6 ? jahr - 1 : jahr
  return `${gemeint}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

const KOPF = /^(?:(.{0,40}?):\s*)?»([^»«]{2,120})«(.*)$/
const FELD = /^(Episoden|Laufzeit|Sprache|Simulcast|Stream|Start|Hinweis):\s*(.*)$/

interface Block {
  titel: string
  zusatz?: string
  datum?: string
  felder: Record<string, string>
  zitat: string
}

/** Einträge »Titel« mit mindestens einem Feld (Episoden, Laufzeit, Sprache, Stream) in den neun Zeilen darunter; die Titelliste oben im Artikel hat keine Felder. */
export function liesBloecke(zeilen: string[], veroeffentlicht: string): Block[] {
  const aus: Block[] = []
  for (let i = 0; i < zeilen.length; i++) {
    const kopf = KOPF.exec(zeilen[i]!)
    if (!kopf) continue
    const felder: Record<string, string> = {}
    let letzte = i
    for (let j = i + 1; j < zeilen.length && !KOPF.test(zeilen[j]!) && j - i <= 9; j++) {
      const f = FELD.exec(zeilen[j]!)
      if (!f) continue
      felder[f[1]!] = f[2]!
      letzte = j
    }
    if (!(felder.Sprache || felder.Stream || felder.Episoden || felder.Laufzeit)) continue
    const datum = kopf[1] ? datumAusPraefix(kopf[1], veroeffentlicht) : undefined
    const staffel = /Staffel\s*\d+/.exec(kopf[3]!)?.[0]
    aus.push({ titel: kopf[2]!.trim(), ...(staffel ? { zusatz: staffel } : {}), ...(datum ? { datum } : {}), felder, zitat: zeilen.slice(i, letzte + 1).join('\n') })
  }
  return aus
}

function spracheDesBlocks(sprache: string | undefined): Behauptung['sprache'] | undefined {
  if (!sprache || !/deutsch/i.test(sprache)) return undefined
  return /japanisch|\(UT\)|englisch/i.test(sprache) ? 'deutsch+omu' : 'deutsch'
}

/** Blöcke »Titel« / Sprache: / Stream: mit deutscher Fassung und eindeutiger Plattform. */
export function blockBehauptungen(zeilen: string[], veroeffentlicht: string): Behauptung[] {
  const artikelPlattformen = plattformen(zeilen[0] ?? '')
  const aus: Behauptung[] = []
  for (const b of liesBloecke(zeilen, veroeffentlicht)) {
    const plattform = plattformDesBlocks(b.felder.Stream, artikelPlattformen)
    const sprache = spracheDesBlocks(b.felder.Sprache)
    if (!plattform || !sprache) continue
    aus.push({ titel: b.titel, ...(b.zusatz ? { zusatz: b.zusatz } : {}), plattform, sprache, zitat: b.zitat, ...(b.datum ? { datum: b.datum } : {}), familie: 'block' })
  }
  return aus
}

const MONAT = `(?:${MONATE.join('|')})`
/** Schärfung 3: nach „.“, „!“, „?“ vor Großbuchstaben oder »; nach einer Zahl mit Punkt nur, wenn kein Monatsname folgt. */
const SATZGRENZE = new RegExp(`(?<!\\d\\.)(?<=[.!?])\\s+(?=[A-ZÄÖÜ»])|(?<=\\d\\.)\\s+(?=(?!${MONAT}\\b)[A-ZÄÖÜ»])`)
const KEINE_SYNCHRO = /synchronsprech|synchronstimme|synchronregie|synchronisiert von/i
const TITEL_IM_SATZ = /»([^»«]{2,100})«/g

/** Schärfungen 2 und 4 auf einen Satz; `undefined` = Rest für Claude. */
function plattformDesSatzes(satz: string, titel: string[], artikelPlattformen: string[], jahr: number): string | undefined {
  const aelteresJahr = [...satz.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) < jahr)
  if (titel.length > 1 || aelteresJahr) return undefined
  const genannt = plattformen(satz)
  if (genannt.length > 1) return undefined
  return genannt[0] ?? (artikelPlattformen.length === 1 ? artikelPlattformen[0] : undefined)
}

/** Sätze mit genau einem Titel und genau einer Plattform, die die Synchro bejahen. */
export function satzBehauptungen(zeilen: string[], veroeffentlicht: string): Behauptung[] {
  const artikelPlattformen = plattformen(zeilen[0] ?? '')
  const jahr = Number(veroeffentlicht.slice(0, 4))
  const aus: Behauptung[] = []
  for (const satz of zeilen.slice(2).flatMap((z) => z.split(SATZGRENZE))) {
    const titel = [...satz.matchAll(TITEL_IM_SATZ)].map((m) => m[1]!)
    if (!titel.length || !nenntSynchro(satz) || KEINE_SYNCHRO.test(satz)) continue
    const plattform = plattformDesSatzes(satz, titel, artikelPlattformen, jahr)
    if (!plattform) continue
    const omu = /untertitel|originalton|japanisch/i.test(satz)
    aus.push({ titel: titel[0]!, plattform, sprache: omu ? 'deutsch+omu' : 'deutsch', zitat: satz.slice(0, 500), familie: 'satz' })
  }
  return aus
}

/** Alle Behauptungen eines Artikels. `text`: Aufbau von `artikel/<id>.txt` (Titel, `Veröffentlicht: <Tag>`, Leerzeile, Text). */
export function leseBehauptungen(text: string): Behauptung[] {
  const zeilen = zeilenVon(text)
  const veroeffentlicht = /^Veröffentlicht:\s*(\d{4}-\d{2}-\d{2})/.exec(zeilen[1] ?? '')?.[1]
  if (!veroeffentlicht) return []
  return [...blockBehauptungen(zeilen, veroeffentlicht), ...satzBehauptungen(zeilen, veroeffentlicht)]
}
