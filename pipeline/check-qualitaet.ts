/**
 * Der Zustand des Bestands, in Zahlen — jeden Lauf, mit Verlauf.
 *
 * **Warum als eigener Lauf.** `check:bestand` und `data:validate` prüfen
 * Widersprüche: Ein Termin ohne Quelle, eine Folgenzahl über dem Doppelten, zwei
 * Releases mit zusammen zu vielen Folgen. Sie beantworten „ist etwas kaputt?"
 *
 * Diese Prüfung beantwortet eine andere Frage: **„wie vollständig sind wir?"**
 * Sie bricht nicht ab, sie zählt — und schreibt die Zahlen fort, damit eine
 * Verschlechterung auffällt, bevor sie jemandem im Kalender begegnet.
 *
 * Daniels Ziel dazu (28.08.2026): „alle anime müssen wir im bestand haben, alle
 * verweise auf deutsche synchros müssen korrekt verlinkt sein". Ohne Zahlen ist
 * das eine Absicht; mit Zahlen ein Fortschritt.
 *
 * **Was hier nicht steht.** Keine Schwellwerte, die den Lauf rot machen — außer
 * bei den drei Punkten, die einen echten Widerspruch anzeigen (siehe `HART`).
 * Alles andere darf schlechter werden, solange es sichtbar bleibt: Ein neuer
 * Katalog-Import senkt jede Quote, ohne dass etwas falsch wäre.
 *
 * Aufruf: `npx tsx pipeline/check-qualitaet.ts`
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import type { Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { hatStreamingWeg } from '../tools/streaming-weg-zaehlen.mjs'
import { ohneSprachurteil as keinSprachurteil } from './lib/ohne-sprachurteil.ts'
import { zaehleVerwaisteTermine } from './lib/verwaiste-termine.ts'
import { MAENGEL_DATEI, offeneJeArt, type Register } from './lib/maengel-register.ts'
import { VERLAUF_DATEI } from './lib/streaming-rueckgang.ts'
import { warnZeilen } from './lib/qualitaet-warnzeilen.ts'
import { discTitelIds, zaehleErstausgabeOhneWeg } from './lib/erstausgabe-ohne-weg.ts'

interface Kennzahlen {
  gemessenAm: string
  titel: number
  mitVerweis: number
  /** `streams` nicht leer oder `watchLinks` mit `kind: 'stream'` (`tools/streaming-weg-zaehlen.mjs`). */
  mitStreamingWeg: number
  ohneVerweis: number
  /** Erstausgabe als Synchro bekannt, aber weder Stream noch Verweis (`lib/erstausgabe-ohne-weg.ts`). */
  erstausgabeOhneWeg: number
  mitSynchro: number
  verweiseGesamt: number
  ohneSprachurteil: number
  ohneDeutschenNamen: number
  serienOhneFolgenzahl: number
  kuenftigeTermine: number
  /* Diese drei müssen null sein — sonst ist etwas kaputt. */
  dubFalseImBestand: number
  doppelteAdressen: number
  verwaisteTermine: number
  /** Offene Mängel je Art aus `data/maengel.json` (ab 16.11.2026); fehlt, solange es das Register nicht gibt. */
  maengel?: Record<string, number>
}

/** Was nicht null sein darf. Jeder Punkt hier hatte schon einmal einen Fehler. */
const HART: (keyof Kennzahlen)[] = ['dubFalseImBestand', 'doppelteAdressen', 'verwaisteTermine']

/**
 * Der Verlauf steht als Liste, nicht als einzelner Stand: Eine Zahl allein sagt
 * nicht, ob sie steigt. Ein Eintrag je Tag genügt — mehrere Läufe am selben Tag
 * überschreiben einander. Gibt den Eintrag davor (`vorher`, für den Pfeil) und
 * den Stand für die Warnzeilen zurück: der heutige Eintrag, falls ein früherer
 * Lauf des Tages ihn schon geschrieben hat, sonst der Vortag — so meldet ein
 * Anstieg vom Morgen nicht jeder weitere Lauf desselben Tages erneut.
 */
function schreibeVerlauf(zahlen: Kennzahlen, heute: string): { vorher: Kennzahlen | null; bezug: Kennzahlen | null } {
  const verlauf = readJson<Kennzahlen[]>(VERLAUF_DATEI, [])
  const ohneHeute = verlauf.filter((v) => v.gemessenAm !== heute)
  ohneHeute.push(zahlen)
  /* Ein Jahr Verlauf genügt, um eine Entwicklung zu sehen. */
  writeJson(VERLAUF_DATEI, ohneHeute.slice(-370))
  const vorher = ohneHeute.length > 1 ? ohneHeute[ohneHeute.length - 2]! : null
  return { vorher, bezug: verlauf.find((v) => v.gemessenAm === heute) ?? vorher }
}

function main(): void {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const events = readJson<{ date?: string; titleId?: number }[]>('public/data/events.json', [])
  const heute = todayIso()
  const ids = new Set(titles.map((t) => t.id))
  const cartoonIds = readJson<{ id: number }[]>('public/data/cartoons.json', []).map((c) => c.id)

  let verweise = 0
  let mitSynchro = 0
  let ohneSprachurteil = 0
  let dubFalse = 0
  let doppelt = 0

  for (const t of titles) {
    const s = t.streams ?? []
    verweise += s.length
    if (s.some((x) => x.dub === true)) mitSynchro++
    if (keinSprachurteil(t)) ohneSprachurteil++
    for (const x of s) if (x.dub === false) dubFalse++
    const urls = s.map((x) => x.url)
    if (new Set(urls).size !== urls.length) doppelt++
  }

  const zahlen: Kennzahlen = {
    gemessenAm: heute,
    titel: titles.length,
    mitVerweis: titles.filter((t) => (t.streams ?? []).length > 0).length,
    mitStreamingWeg: titles.filter(hatStreamingWeg).length,
    ohneVerweis: titles.filter((t) => !(t.streams ?? []).length).length,
    erstausgabeOhneWeg: zaehleErstausgabeOhneWeg(titles, discTitelIds(readJson('public/data/releases.json', []))),
    mitSynchro,
    verweiseGesamt: verweise,
    ohneSprachurteil,
    ohneDeutschenNamen: titles.filter((t) => !t.titleDe).length,
    serienOhneFolgenzahl: titles.filter((t) => t.format === 'TV' && !t.episodes).length,
    kuenftigeTermine: events.filter((e) => (e.date ?? '') >= heute).length,
    dubFalseImBestand: dubFalse,
    doppelteAdressen: doppelt,
    verwaisteTermine: zaehleVerwaisteTermine(events, ids, cartoonIds),
  }
  const register = readJson<Register | null>(MAENGEL_DATEI, null)
  if (register) zahlen.maengel = offeneJeArt(register)

  const { vorher, bezug } = schreibeVerlauf(zahlen, heute)
  const pfeil = (k: keyof Kennzahlen): string => {
    if (!vorher || typeof zahlen[k] !== 'number' || typeof vorher[k] !== 'number') return ''
    const d = (zahlen[k] as number) - (vorher[k] as number)
    return d === 0 ? '' : d > 0 ? ` (+${d})` : ` (${d})`
  }

  log(`Bestand am ${heute}:`)
  log(`  ${zahlen.titel} Titel${pfeil('titel')}, davon ${zahlen.mitVerweis} mit Verweis${pfeil('mitVerweis')}, ${zahlen.mitStreamingWeg} mit Streaming-Weg${pfeil('mitStreamingWeg')}`)
  log(`  ${zahlen.mitSynchro} mit belegter Synchro${pfeil('mitSynchro')}, ${zahlen.verweiseGesamt} Verweise${pfeil('verweiseGesamt')}`)
  log(`  offen: ${zahlen.ohneVerweis} ohne Verweis${pfeil('ohneVerweis')}, ${zahlen.ohneSprachurteil} ohne Sprachurteil${pfeil('ohneSprachurteil')}, ${zahlen.erstausgabeOhneWeg} Erstausgabe bekannt, kein Weg${pfeil('erstausgabeOhneWeg')}`)
  log(`  Lücken: ${zahlen.ohneDeutschenNamen} ohne deutschen Namen${pfeil('ohneDeutschenNamen')}, ${zahlen.serienOhneFolgenzahl} Serien ohne Folgenzahl${pfeil('serienOhneFolgenzahl')}`)
  log(`  ${zahlen.kuenftigeTermine} künftige Termine${pfeil('kuenftigeTermine')}`)

  /* Feste Zeilen für den Schritt „Datenqualität messen“ (bestand-bauen.yml): daraus wird die DATEN_WARNUNG. Exit bleibt 0. */
  for (const zeile of warnZeilen(zahlen, bezug, register)) console.log(zeile)

  let kaputt = 0
  for (const k of HART) {
    if ((zahlen[k] as number) > 0) {
      warn(`${k}: ${zahlen[k]} — das darf nicht vorkommen`)
      kaputt++
    }
  }
  if (kaputt) process.exit(1)
}

main()
