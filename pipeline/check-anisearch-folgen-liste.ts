/**
 * Direkte Zusicherungen zu `pipeline/lib/anisearch-folgen-liste.ts` (die Verdrahtung im Bau prüft `check-anisearch-folgen-kennung.ts`):
 * nur Folgen mit deutschem Titel, `ead` als Tag aus `datum` und nur, wenn eins da ist; Titel ohne solche Folgen oder ohne Eintrag
 * fallen weg; die Kennung des Titels schlägt die Tabelle, Tabellenzeilen ohne `anisearchId` zählen nicht. Läuft in `check:logic`.
 */
import { anisearchFolgenListe, kennungenVereint } from './lib/anisearch-folgen-liste.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

// anisearchFolgenListe
pruefe('leer', anisearchFolgenListe(new Map(), {}), {})
const folgen = {
  '101': { folgen: [{ nr: 1, de: 'Eins', datum: '2026-10-04T15:30:00Z' }, { nr: 2 }, { nr: 3, de: '' }, { nr: 4, de: 'Vier' }] },
  '102': { folgen: [{ nr: 1, datum: '2026-10-01' }] },
  '103': {},
}
pruefe(
  'nur deutsche Titel, Datum als Tag, ohne Datum kein ead',
  anisearchFolgenListe(new Map([['1', 101]]), folgen),
  { '1': { seite: 'aniSearch', url: 'https://www.anisearch.de/anime/101/episodes', folgen: [{ nr: 1, dt: 'Eins', ead: '2026-10-04' }, { nr: 4, dt: 'Vier' }] } },
)
pruefe('ohne deutsche Titel, ohne folgen, ohne Eintrag: weg', anisearchFolgenListe(new Map([['2', 102], ['3', 103], ['4', 104]]), folgen), {})
pruefe('zwei Titel auf derselben Kennung: beide', Object.keys(anisearchFolgenListe(new Map([['1', 101], ['9', 101]]), folgen)), ['1', '9'])

// kennungenVereint
pruefe('leer', [...kennungenVereint({}, new Map())], [])
pruefe(
  'Tabelle ohne anisearchId zählt nicht, Titel ergänzt und schlägt Tabelle',
  [...kennungenVereint({ '1': { anisearchId: 101 }, '2': {}, '3': { anisearchId: 103 }, '5': { anisearchId: 0 } }, new Map([[3, 333], [4, 104]]))],
  [['1', 101], ['3', 333], ['4', 104]],
)

if (fehler) {
  console.error(`check-anisearch-folgen-liste: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anisearch-folgen-liste: alle Zusicherungen grün')
