// PreToolUse(Bash): `gh pr merge <N>` wird abgewiesen, außer im selben Befehl steht davor `node tools/pr-nachrechnen.mjs <N> &&`
// (gleiche Nummer, Verknüpfer `&&`, damit ein Exit ≠ 0 den Merge verhindert).
// Anlass: 09.11.2026, ein Hand-Merge ohne Nachrechnen machte main rot (die Kette lief gegen ein altes main). `merge-reihe.sh` ruft
// pr-nachrechnen selbst auf und enthält den Text `gh pr merge` nicht; es bleibt frei.
// Zerlegung wie in no-verify-sperre.js (Heredocs weg, Ketten, `bash -c`/`eval` rekursiv); `echo`/`printf`-Text zählt nicht.
// Bekannte Grenzen: Programm aus Variable (`$g pr merge 5`), `gh`-Alias, Merge über `gh api`, Riegel in einem Unterbefehl
// (`bash -c 'node … && …'` zählt nur innerhalb dieses `bash -c`).
// Einbindung in ~/.claude/hooks/dispatch-pretooluse.js ins Feld PRUEFER (der Verteiler liegt nicht im Repo, Handgriff):
//   ['merge-riegel.js', (i) => { const g = require(path.join(H, 'merge-riegel.js')).pruefe(i); return g ? { permissionDecision: 'deny', permissionDecisionReason: g } : null }],
const { zerlege, ohneHeredoc, eingebetteterBefehl, programmName } = require('./hauptordner-sperre.js')

/** `gh`-Optionen vor dem Unterbefehl, die einen Wert im nächsten Token nehmen. */
const GH_MIT_WERT = new Set(['-R', '--repo', '--hostname'])

/** Schalter von `gh pr merge` ohne Wert; nach jedem anderen Schalter ist das nächste Token dessen Wert. */
const GH_OHNE_WERT = new Set(['--squash', '-s', '--merge', '-m', '--rebase', '-r', '--auto', '--admin', '--disable-auto', '--delete-branch', '-d'])

/** Werte aller `--repo`/`-R`-Angaben; ein Token, das Wert eines anderen Schalters sein kann, zählt nicht (sonst sperrt der Riegel). */
function repoAngaben(rest) {
  const repos = []
  for (let k = 0; k < rest.length; k++) {
    const vor = rest[k - 1]
    if (vor?.startsWith('-') && !vor.includes('=') && !GH_OHNE_WERT.has(vor)) continue
    if (rest[k] === '-R' || rest[k] === '--repo') repos.push(rest[k + 1] ?? '')
    else if (rest[k].startsWith('--repo=')) repos.push(rest[k].slice(7))
  }
  return repos
}

/** Nummer, wenn die Tokens ab dem `gh`-Token `von` ein `pr merge <N>` sind; '' bei `pr merge` ohne Nummer; sonst null. */
function mergeNummer(tokens, von) {
  // Anderes Repo per --repo/-R: dort gibt es kein pr-nachrechnen (E53, Daniel 10.11.2026 „ja“). Jede Angabe muss fremd sein.
  const repos = repoAngaben(tokens.slice(von + 1))
  if (repos.length && repos.every((r) => r && !/(^|\/)anime-kalender-de(\.git)?$/i.test(r))) return null
  let i = von + 1
  for (; i < tokens.length; i++) {
    if (GH_MIT_WERT.has(tokens[i])) i++
    else if (!tokens[i].startsWith('-')) break
  }
  if (tokens[i] !== 'pr' || tokens[i + 1] !== 'merge') return null
  const nummer = tokens.slice(i + 2).find((t) => /^\d+$/.test(t))
  return nummer ?? ''
}

/** Nummer, die ein Segment `node …/pr-nachrechnen.mjs <N>` nachrechnet, sonst null. */
function nachgerechnet(tokens) {
  const k = tokens.findIndex((t) => /(^|[\\/])pr-nachrechnen\.mjs$/.test(t))
  if (k < 1 || programmName(tokens[0]) !== 'node') return null
  return /^\d+$/.test(tokens[k + 1] ?? '') ? tokens[k + 1] : null
}

const erlaubt = (n) => `node tools/pr-nachrechnen.mjs ${n} && t=$(gh pr view ${n} --json title -q .title) && gh pr merge ${n} --squash --subject "$t (#${n})"`

/** Verweigerungstext (mit Nummer des Merges) für einen Befehl oder null. */
function pruefeBefehl(befehl) {
  const frei = new Set()
  for (const { tokens, op } of zerlege(ohneHeredoc(befehl))) {
    if (!tokens) continue
    const n = nachgerechnet(tokens)
    if (n && op === '&&') frei.add(n)
    for (let i = 0; i < tokens.length; i++) {
      const p = programmName(tokens[i])
      if (p === 'echo' || p === 'printf') break
      const skript = eingebetteterBefehl(tokens, i)
      if (skript) {
        const grund = pruefeBefehl(skript)
        if (grund) return grund
      } else if (p === 'gh' || p === 'gh.exe') {
        const nummer = mergeNummer(tokens, i)
        if (nummer === null) continue
        if (nummer === '' || !frei.has(nummer)) return erlaubt(nummer || 'N')
      }
    }
  }
  return null
}

/** Grund der Verweigerung (Text) oder null — Schnittstelle wie die Module des Verteilers. */
function pruefe(eingabe) {
  if (eingabe.tool_name !== 'Bash') return null
  const ok = pruefeBefehl(String(eingabe.tool_input?.command ?? ''))
  if (!ok) return null
  return `„gh pr merge“ ohne Nachrechnen gesperrt: die Kette kann gegen ein altes main gelaufen sein (09.11.2026, main rot). Erlaubter Befehl: ${ok}`
}

module.exports = { pruefe, pruefeBefehl }

if (require.main === module) {
  let roh = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (c) => { roh += c })
  process.stdin.on('end', () => {
    try {
      const grund = pruefe(JSON.parse(roh))
      if (grund) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: grund } }))
    } catch (err) {
      process.stderr.write(`merge-riegel: ${err.message}\n`)
    }
    process.exit(0)
  })
}
