/**
 * Zusicherungen zum Archivtext (12.10.2026): Titel ohne anderen deutschen Text bekommen die Inhaltsangabe ihrer archivierten aniSearch-Seite,
 * eine von mehreren Titeln geteilte Seite und der Mitmach-Aufruf anstelle einer Handlung liefern nichts. Arbeitet auf Beispielseiten im Temp-Ordner. Läuft in `check:logic`.
 */
import { gzipSync } from 'node:zlib'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archivHandlung, archivTexte } from './lib/anisearch-archiv-text.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const seite = (de: string): string =>
  `<section id="description"><h2>Inhaltsangabe</h2><div><div lang="de" class="textblock details-text">${de}</div><div lang="en" class="textblock details-text hidden">English</div></div></section>`
const HANDLUNG = 'Der junge <a href="character/1,kiba">Kiba</a> kommt in die Stadt und sucht das Paradies, das nur Wölfe finden können.<i class="hidden"><br><br>Quelle: www.anisearch.de/anime/11</i>'
const AUFRUF = 'Eine kurze Inhaltsangabe zum Anime würde vielen Anime- und Manga-Fans weiterhelfen. Du kennst diesen Anime bereits? Dann unterstütze aniSearch und füge eine kurze Beschreibung hinzu.'

const dir = mkdtempSync(join(tmpdir(), 'archiv-text-'))
try {
  for (const [id, de] of [[11, HANDLUNG], [12, HANDLUNG], [13, AUFRUF]] as const) writeFileSync(join(dir, `${id}.html.gz`), gzipSync(seite(de)))
  const text = archivHandlung(11, dir)
  pruefe('Text: Handlung ohne Verweise, mit Quellenzeile wie im Abruf', text?.startsWith('Der junge Kiba kommt in die Stadt') === true && text.endsWith('Quelle: www.anisearch.de/anime/11'), `${text}`)
  pruefe('Text: Mitmach-Aufruf ist keine Handlung', archivHandlung(13, dir) === undefined)
  pruefe('Text: fehlende Seite ergibt nichts', archivHandlung(99, dir) === undefined)

  const kennungen = new Map([[1, 11], [2, 13], [3, 99], [4, 12], [5, 12]])
  const alleOhne = archivTexte(kennungen, () => false, dir)
  pruefe('Archivtexte: eigene Seite mit Handlung wird übernommen', alleOhne.has(1))
  pruefe('Archivtexte: Aufruf und fehlende Seite liefern nichts', !alleOhne.has(2) && !alleOhne.has(3))
  pruefe('Archivtexte: von zwei Titeln geteilte Seite geht an keinen', !alleOhne.has(4) && !alleOhne.has(5))
  pruefe('Archivtexte: Titel mit anderem deutschen Text behält ihn', !archivTexte(kennungen, (id) => id === 1, dir).has(1))
  pruefe('Archivtexte: der Partner mit Text zählt als Teiler der Seite', !archivTexte(kennungen, (id) => id === 5, dir).has(4))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(fehler ? `\nArchivtext: ${fehler} Zusicherung(en) verletzt.` : 'Archivtext: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
