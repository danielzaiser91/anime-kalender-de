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

interface Kennzahlen {
  gemessenAm: string
  titel: number
  mitVerweis: number
  ohneVerweis: number
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
}

/** Was nicht null sein darf. Jeder Punkt hier hatte schon einmal einen Fehler. */
const HART: (keyof Kennzahlen)[] = ['dubFalseImBestand', 'doppelteAdressen', 'verwaisteTermine']

function main(): void {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const events = readJson<{ date?: string; titleId?: number }[]>('public/data/events.json', [])
  const heute = new Date().toISOString().slice(0, 10)
  const ids = new Set(titles.map((t) => t.id))

  let verweise = 0
  let mitSynchro = 0
  let ohneSprachurteil = 0
  let dubFalse = 0
  let doppelt = 0

  for (const t of titles) {
    const s = t.streams ?? []
    verweise += s.length
    if (s.some((x) => x.dub === true)) mitSynchro++
    if (s.length && s.every((x) => x.dub === undefined)) ohneSprachurteil++
    for (const x of s) if (x.dub === false) dubFalse++
    const urls = s.map((x) => x.url)
    if (new Set(urls).size !== urls.length) doppelt++
  }

  const zahlen: Kennzahlen = {
    gemessenAm: heute,
    titel: titles.length,
    mitVerweis: titles.filter((t) => (t.streams ?? []).length > 0).length,
    ohneVerweis: titles.filter((t) => !(t.streams ?? []).length).length,
    mitSynchro,
    verweiseGesamt: verweise,
    ohneSprachurteil,
    ohneDeutschenNamen: titles.filter((t) => !t.titleDe).length,
    serienOhneFolgenzahl: titles.filter((t) => t.format === 'TV' && !t.episodes).length,
    kuenftigeTermine: events.filter((e) => (e.date ?? '') >= heute).length,
    dubFalseImBestand: dubFalse,
    doppelteAdressen: doppelt,
    verwaisteTermine: events.filter((e) => e.titleId && e.titleId !== -1 && !ids.has(e.titleId)).length,
  }

  /*
    Der Verlauf steht als Liste, nicht als einzelner Stand: Eine Zahl allein sagt
    nicht, ob sie steigt. Ein Eintrag je Tag genügt — mehrere Läufe am selben Tag
    überschreiben einander.
  */
  const verlauf = readJson<Kennzahlen[]>('data/qualitaet-verlauf.json', [])
  const ohneHeute = verlauf.filter((v) => v.gemessenAm !== heute)
  ohneHeute.push(zahlen)
  /* Ein Jahr Verlauf genügt, um eine Entwicklung zu sehen. */
  writeJson('data/qualitaet-verlauf.json', ohneHeute.slice(-370))

  const vorher = ohneHeute.length > 1 ? ohneHeute[ohneHeute.length - 2]! : null
  const pfeil = (k: keyof Kennzahlen): string => {
    if (!vorher || typeof zahlen[k] !== 'number') return ''
    const d = (zahlen[k] as number) - (vorher[k] as number)
    return d === 0 ? '' : d > 0 ? ` (+${d})` : ` (${d})`
  }

  log(`Bestand am ${heute}:`)
  log(`  ${zahlen.titel} Titel${pfeil('titel')}, davon ${zahlen.mitVerweis} mit Verweis${pfeil('mitVerweis')}`)
  log(`  ${zahlen.mitSynchro} mit belegter Synchro${pfeil('mitSynchro')}, ${zahlen.verweiseGesamt} Verweise${pfeil('verweiseGesamt')}`)
  log(`  offen: ${zahlen.ohneVerweis} ohne Verweis${pfeil('ohneVerweis')}, ${zahlen.ohneSprachurteil} ohne Sprachurteil${pfeil('ohneSprachurteil')}`)
  log(`  Lücken: ${zahlen.ohneDeutschenNamen} ohne deutschen Namen${pfeil('ohneDeutschenNamen')}, ${zahlen.serienOhneFolgenzahl} Serien ohne Folgenzahl${pfeil('serienOhneFolgenzahl')}`)
  log(`  ${zahlen.kuenftigeTermine} künftige Termine${pfeil('kuenftigeTermine')}`)

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
