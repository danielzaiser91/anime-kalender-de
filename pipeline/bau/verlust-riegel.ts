import { umgezogeneKennungen } from './mal-teilung.ts'
import { mitAnkuendigung } from './grundlagen.ts'
import { readJson, warn } from '../lib/util.ts'
import { ladeQuarantaene } from '../lib/quarantaene.ts'
import { type Title } from '../../shared/types.ts'

/**
 * Kein Titel geht verloren — der Build bricht lieber ab.
 *
 * Gemessen am 24.08.2026: Ein Bau mit aeltererem `data/cache/` erzeugte
 * 2.752 statt 2.762 Titeln. Die zehn fehlenden waren nicht falsch, sie
 * waren nur im lokalen Cache nicht vorhanden -- darunter "Kill Ao" und
 * "Mononoke Chapter III", beide mit Termin im Kalender.
 *
 * Ein verlorener Titel faellt nicht auf: Der Termin bleibt stehen, das
 * Detail-Panel sagt "keine Metadaten". So hat Daniel es am 23.08. entdeckt,
 * nicht der Lauf.
 */
export function pruefeVerlust(slim: { id: number }[], verschoben: Title[]): void {
  /** Ein einzelner Wegfall ist erklaerbar, mehrere sind ein Symptom. */
  const ERLAUBTER_VERLUST = 1
  let vorher: number[] = []
  try {
    const alt = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
    vorher = (Array.isArray(alt) ? alt : Object.values(alt)).map((t) => t.id)
  } catch {
    /* Kein voriger Stand — dann gibt es nichts zu verlieren. */
  }
  if (vorher.length) {
    const jetzt = new Set(slim.map((t) => t.id))
    /**
     * **Wer hinter den Toggle verschoben wurde, ist kein Verlust** (PR #187, Issue #186).
     *
     * `schreibeOhneSynchro` trägt jeden Titel aus `verschoben` nachweislich in
     * `ohne-synchro.json` nach — genau die Zusicherung aus dem Fix vom 17.08.2026 („Ein
     * Vorfilter verschiebt, er löscht nicht"). Der Riegel kannte sie nicht: Am 21.09.2026
     * verloren „Black Clover 2nd Season" (195604) und „Kusuriya no Hitorigoto 3rd Season"
     * (195516) ihren einzigen, unbestätigten Crunchyroll-Termin, wanderten korrekt hinter
     * den Toggle — und der Bau brach ab, obwohl nichts verloren war (Lauf 35550446358).
     *
     * Der Pull Request lag seit dem 21.09. offen und ließ sich nach den Änderungen vom
     * 23.09. nicht mehr sauber zusammenführen; die Zeile steht deshalb direkt hier.
     */
    const hinterToggle = new Set(verschoben.map((t) => t.id))
    for (const id of umgezogeneKennungen(jetzt, hinterToggle, new Set(verschoben.filter((t) => t.jpStatus === 'NOT_YET_RELEASED' || mitAnkuendigung(t).ankuendigung).map((t) => t.id)))) hinterToggle.add(id)
    // Zurückgestellte Titel (Quarantäne, `11-9-quarantaene.ts`) fehlen absichtlich und stehen in `meta.quarantaene`.
    for (const e of ladeQuarantaene()) hinterToggle.add(e.titleId)
    const verloren = vorher.filter((id) => !jetzt.has(id) && !hinterToggle.has(id))
    if (verloren.length > ERLAUBTER_VERLUST) {
      warn(
        `ABBRUCH: ${verloren.length} Titel wuerden aus dem Datensatz fallen ` +
          `(${vorher.length} → ${slim.length}).`,
      )
      warn(`   Betroffen: ${verloren.slice(0, 10).join(', ')}`)
      warn(
        '   Meist ist der lokale data/cache/ aelter als der des letzten Laufs. Datenlaeufe gehoeren nach GitHub — siehe CLAUDE.md.',
      )
      process.exit(1)
    }
    if (verloren.length) {
      warn(`${verloren.length} Titel faellt aus dem Datensatz: ${verloren.join(', ')}`)
    }
  }
}
