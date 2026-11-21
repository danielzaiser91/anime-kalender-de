/**
 * Tests der Text-Helfer in `pr-nachrechnen-leser.mjs`: `ohneKommentare` (Zeilen- und Blockkommentare, JS-Familie gegen Shell/YAML)
 * und `importZiele`. Fixtures nennen `data/crunchyroll-woche.json` wie die Anlassfälle PR 3590 und PR 3597.
 */
import { importZiele, ohneKommentare } from './pr-nachrechnen-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
/** Steht der Name nach dem Entfernen der Kommentare noch im Text? Als Liste wie früher `leserIn`, damit die Fälle unverändert lesbar bleiben. */
const nennt = (pfad, text, name) => (ohneKommentare(text, pfad).includes(name) ? [pfad] : [])

pruefe('ohneKommentare: //, *, /*, # fallen weg', ohneKommentare('a\n// b\n * c\n/* d\n# e\n  f').split('\n').join() === 'a,  f', ohneKommentare('a\n// b\n * c\n/* d\n# e\n  f'))
pruefe('importZiele: relativ zum Ordner der Datei, mit und ohne Endung', importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h.ts') && importZiele('tools/a/b.mjs', "import x from '../lib/h'").includes('tools/lib/h'))
for (const [ende, ziel] of [['.ts', 'a/b.ts'], ['.tsx', 'a/b.tsx'], ['.mjs', 'a/b.mjs'], ['.cjs', 'a/b.cjs'], ['.mts', 'a/b.mts'], ['/index.ts', 'a/b/index.ts']]) {
  pruefe(`importZiele: Kandidat ${ende}`, importZiele('a/c.ts', "import './b'").includes(ziel), importZiele('a/c.ts', "import './b'"))
}
{
  // Anlass 12.11.2026, PR 3590: der Name stand nur in einem Blockkommentar, dessen Innenzeilen keinen Stern tragen (tools/quellen-fristen.mjs, wörtlich).
  const NAME = 'data/crunchyroll-woche.json'
  const leser = (text) => nennt('tools/x.mjs', text, NAME)
  const FRISTEN = [
    "  'crunchyroll-neu': 3,",
    '  /*',
    '    Stündlich. Fällt der Leser aus, steht `data/crunchyroll-woche.json` still — und weil der Schritt',
    '    als geduldeter läuft (`continue-on-error`), bleibt der Lauf trotzdem grün: Am 28.09.2026 wechselte',
    '    es jemandem auffiel. Ein Tag Frist meldet das am zweiten Tag als Blocker.',
    '  */',
    "  'crunchyroll-woche': 1,",
  ].join('\n')
  pruefe('Blockkommentar ohne Stern nennt die Datei (quellen-fristen) -> kein Leser', leser(FRISTEN).length === 0, leser(FRISTEN))
  const LIES = "readFileSync('data/crunchyroll-woche.json')"
  pruefe('Gegenprobe: derselbe Name im Code -> Leser', leser(`${FRISTEN}\n${LIES}`).length === 1)
  pruefe('Glob-String mit Schrägstrich-Stern beginnt keinen Kommentar, spätere Lesung bleibt', leser(`const g = 'data/*'\n${LIES}\n/* Ende */`).length === 1, leser(`const g = 'data/*'\n${LIES}\n/* Ende */`))
  pruefe('Glob-String data/*.json in einer Lesezeile bleibt Leser', leser("readdirSync('data/*.json'); readFileSync('data/crunchyroll-woche.json') // */").length === 1)
  pruefe('Lesung hinter dem Blockkommentar in derselben Zeile bleibt Leser', leser(`/* Hinweis */ ${LIES}`).length === 1)
  pruefe('Mehrzeiliger Kommentar, Lesung in der Endzeile hinter dem Kommentarende -> Leser', leser(`/*\n  data/crunchyroll-woche.json\n*/ ${LIES}`).length === 1)
  pruefe('Zeilenkommentar mit Schrägstrich-Stern beginnt keinen Block', leser(`// Muster data/* hier\n${LIES}\n/* c */`).length === 1)
  const OHNE_STERN = '/*\n   data/crunchyroll-woche.json ohne Stern */\nx'
  pruefe('Regex-Literal mit Backtick öffnet keine Vorlage', leser(`const r = /\`/\n${OHNE_STERN}`).length === 0)
  pruefe('Regex-Klasse mit Schrägstrich und Backtick beendet das Literal nicht früh', leser(`const r = /[/\`]/\n${OHNE_STERN}`).length === 0)
  pruefe('Escape in der Zeichenkette: maskiertes Anführungszeichen beendet sie nicht', leser(`const s = 'a\\'b'; ${OHNE_STERN}`).length === 0)
  pruefe('Apostroph in einer Zeile endet am Zeilenende', leser(`it's\n${OHNE_STERN}`).length === 0)
  pruefe('Kommentar-Anfang direkt vor dem Ende (Schrägstrich-Stern-Schrägstrich) schließt nicht', leser('/*/ data/crunchyroll-woche.json */ x').length === 0)
  pruefe('Zeilenzahl bleibt erhalten', ohneKommentare('a\n/* x\ny\n*/ b', 'x.mjs').split('\n').length === 4, ohneKommentare('a\n/* x\ny\n*/ b', 'x.mjs'))
  pruefe('Zwei Blockkommentare in einer Zeile: Code dazwischen bleibt', ohneKommentare('/* a */ code /* b */', 'x.mjs').trim() === 'code', ohneKommentare('/* a */ code /* b */', 'x.mjs'))
  pruefe('Unbeendeter Blockkommentar: nur seine Zeile entfällt, Folgezeilen bleiben', ohneKommentare('a\n/* offen\nb', 'x.mjs').split('\n').join() === 'a,b', ohneKommentare('a\n/* offen\nb', 'x.mjs'))
}

{
  // Nachbesserung A1-A3 (PR 3597): Blockkommentare nur in der JS-Familie; Mutanten der Prüferrunde; Grenzen festgehalten.
  const NAME = 'data/crunchyroll-woche.json'
  const leserVon = (pfad, text) => nennt(pfad, text, NAME)
  const SH = ['git add data/*', `cat ${NAME}`, 'find . -path "**/x"'].join('\n')
  pruefe('A1 Shell: unquotiertes data/* verschluckt keine Lesung (tools/x.sh)', leserVon('tools/x.sh', SH).length === 1, leserVon('tools/x.sh', SH))
  const YML = ['      - run: git add data/*', `      - run: cat ${NAME}`, '        env: { P: "**/x" }'].join('\n')
  pruefe('A1 YAML: Glob-Stern verschluckt keine Lesung (.github/workflows/x.yml)', leserVon('.github/workflows/x.yml', YML).length === 1, leserVon('.github/workflows/x.yml', YML))
  pruefe('A1 Gegenprobe: dieselbe Form in .mjs ist ein Block, Lesung dazwischen entfällt', leserVon('tools/x.mjs', SH).length === 0, leserVon('tools/x.mjs', SH))
  pruefe('A2 Blockkommentar am Dateianfang nennt die Datei -> kein Leser', leserVon('tools/x.mjs', `/* ${NAME} */ x`).length === 0)
  pruefe('A2 Regex mit maskiertem Schrägstrich und Anführungszeichen dahinter', leserVon('tools/x.mjs', `const r = /\\/'/; /* ${NAME} */`).length === 0)
  for (const vor of ['&&', ':', '!', '||', '?', ';', '{', '[']) {
    pruefe(`A2 Regex nach ${vor} beginnt kein Zeichenkettenpaar`, leserVon('tools/x.mjs', `a ${vor} /'/.test(s); /* ${NAME} */`).length === 0)
  }
  pruefe('A2 Regex am Textanfang', leserVon('tools/x.mjs', `/'/.test(s); /* ${NAME} */`).length === 0)
  pruefe('A3 Grenze: Regex nach ) gilt als Division, der Text bleibt stehen (nie weniger)', leserVon('tools/x.mjs', `if (a) /'/.test(s); /* ${NAME} */`).length === 1)
  pruefe('A3 Grenze: Backtick in Zeichenkette in ${…} kippt die Zählung, der Text bleibt stehen', leserVon('tools/x.mjs', `\`\${ '\`' }\`; /* ${NAME} */`).length === 1)
  pruefe('A3 verschachtelte Vorlage mit Paaren bleibt richtig', leserVon('tools/x.mjs', `\`a \${\`b\`} c\`; /* ${NAME} */`).length === 0)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-leser.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-leser.test: grün')
