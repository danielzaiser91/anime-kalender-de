/**
 * **Folgentitel je Titel, nachgeladen** (Daniel, 04.10.2026): Nutzer sollen im Panel sehen, welche Folgen es gibt,
 * statt zu aniSearch/MAL oder zu Google zu springen — gerade bei Titeln mit über tausend Folgen.
 *
 * Quelle ist `data/anisearch-folgen.json` (Nummer, Minuten, deutscher/englischer/japanischer Titel). Je Titel
 * eine kleine Datei `public/data/folgen/<AniList-ID>.json` mit `[[nr, min, titel], …]` (deutsch, sonst englisch,
 * sonst japanisch) und ein Verzeichnis `index.json`: Die Oberfläche zeigt den Pfeil nur, wo es eine Datei gibt, und
 * lädt sie erst beim Aufklappen. Ein neues Feld in `titles.json` wäre für alle Besucher, die Datei braucht nur,
 * wer aufklappt (ARCHITEKTUR.md).
 */
import { readJson, writeJson, log, clearDir } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

export function schreibeFolgenDateien(titel: { id: number }[]): void {
  const roh = readJson<Record<string, { folgen?: Folge[] }>>('data/anisearch-folgen.json', {})
  const ordner = `${OUT}/folgen`
  clearDir(ordner)
  const index: number[] = []
  let folgenGesamt = 0
  for (const t of titel) {
    const f = roh[String(t.id)]?.folgen
    if (!f || f.length < 2) continue
    writeJson(
      `${ordner}/${t.id}.json`,
      f.map((x) => [x.nr, x.minuten ?? 0, x.de ?? x.en ?? x.ja ?? '']),
    )
    index.push(t.id)
    folgenGesamt += f.length
  }
  writeJson(`${ordner}/index.json`, index.sort((a, b) => a - b))
  log(`${index.length} Folgenlisten geschrieben (${folgenGesamt} Folgen)`)
}
