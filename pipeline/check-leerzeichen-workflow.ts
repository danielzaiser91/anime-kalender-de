/** Fälle für `findeUmleitung` (verschluckte Leerzeichen an `>>` in Workflow-YAML). */
import { findeUmleitung } from './lib/leerzeichen-workflow.ts'

const gut = [
  '- run: echo a >> $GITHUB_OUTPUT',
  '- run: echo a >> "$GITHUB_OUTPUT"',
  '- run: cmd 2>> log.txt',
  '- run: cmd &>> log.txt',
  '- run: cmd 2>> /dev/null',
  '  # echo a>>f',
  '- run: echo "a>>b" >> $F',
  "- run: echo 'a>>b' >> $F",
  '- run: echo a >> $F # b>>c',
  'name: kein Shell',
  '- run: echo a>>>f',
  '- run: echo a >>>f',
  '  #echo a>>f',
  '- run: |\n    #echo a>>f',
  '- run: |\n    cat <<EOF\n    a>>b\n    EOF',
  '- run: |\n    x=$((y>>2))',
  '- run: echo $((y>>2))',
  '- uses: a\n  with:\n    body: |\n      foo>>bar',
  '- run: |\n    echo "a\n    foo>>bar"',
]
const schlecht: [string, number][] = [
  ['- run: echo a>>$GITHUB_OUTPUT', 1],
  ['- run: cat x >>datei', 1],
  ['- run: cmd 2>>/dev/null', 1],
  ['- run: echo a >>"$GITHUB_OUTPUT"', 1],
  ['- run: echo "a">> $F', 1],
  ['- run: echo a>> $F', 1],
  ['- run: echo a >> $F\n- run: echo b>>$F', 1],
  ['- run: echo a>>$F\n- run: echo b>>$F', 2],
  ['- run: |\n    cat <<EOF\n    a>>b\n    EOF\n    echo c>>$F', 1],
  ['- run: |\n    x=$((y>>2))\n    echo c>>$F', 1],
  ['- uses: a\n  with:\n    body: x\n- run: |\n    echo c>>$F', 1],
]

let fehler = 0
for (const text of gut) {
  const n = findeUmleitung(text).length
  if (n !== 0) { fehler++; console.error(`FEHLER: ${JSON.stringify(text)} gilt als verschluckt (${n})`) }
}
for (const [text, soll] of schlecht) {
  const funde = findeUmleitung(text)
  if (funde.length !== soll) { fehler++; console.error(`FEHLER: ${JSON.stringify(text)} ergibt ${funde.length} statt ${soll}`) }
}
const zeile = findeUmleitung('a: 1\n- run: echo b>>$F')[0]?.zeile
if (zeile !== 2) { fehler++; console.error(`FEHLER: Zeilennummer ${zeile} statt 2`) }
console.log(`check-leerzeichen-workflow: ${fehler ? 'FEHLER' : 'ok'} (${gut.length} freie, ${schlecht.length} Treffer-Fälle)`)
process.exit(fehler ? 1 : 0)
