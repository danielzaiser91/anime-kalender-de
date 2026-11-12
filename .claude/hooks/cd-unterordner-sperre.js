// PreToolUse(Bash), eingebunden über hauptordner-sperre.js: In der Hauptsitzung verschiebt ein `cd` in einen Unterordner des Hauptordners
// (außerhalb einer Subshell) das Arbeitsverzeichnis dauerhaft; die Mods (relative Plugin-Pfade) verschwinden, spätere relative
// Befehle laufen im falschen Ordner (dreimal am 10.11.2026). Gesperrt: `cd`/`pushd`, dessen Ziel unterhalb des Hauptordners liegt
// (auch relativ zum bis dahin verfolgten Verzeichnis). Frei: Ziel = Hauptordner selbst, Ziele außerhalb (Worktrees), nicht bestimmbare
// Ziele (`$X`, `~`, `-`), `cd` in Klammern/`$(…)`/Backticks (wirkt nur dort), eigene Arbeitsbäume unter dem Hauptordner (`.git` vorhanden).
// Erkennung Hauptsitzung: `agent_id`/`agent_type` fehlen nur dort (gleiche Annahme wie subagent-schreibsperre.js, befehlsregister.js);
// Subagenten haben ihr eigenes Arbeitsverzeichnis und bleiben frei. Nur Bash-Eingaben kommen an (Filter in hauptordner-sperre.js).
const VORSATZ = new Set(['builtin', 'command'])
// Wörter, die ein Segment einleiten, ohne selbst Befehl zu sein (`then cd x`, `{ cd x`), und Variablenvorsatz (`FOO=1 cd x`).
const SEGMENTANFANG = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '{', '!'])
const istVorsatz = (t) => VORSATZ.has(t) || SEGMENTANFANG.has(t) || /^[A-Za-z_]\w*=/.test(t)

/** Ziel-Token eines `cd`/`pushd`-Segments (Optionen wie -P/-L übersprungen), '' ohne Ziel, null wenn das Segment kein cd ist. */
function cdZiel(tokens) {
  let i = 0
  while (tokens[i] !== undefined && istVorsatz(tokens[i])) i++
  if (tokens[i] !== 'cd' && tokens[i] !== 'pushd') return null
  i++
  while (tokens[i] !== undefined && tokens[i].startsWith('-') && tokens[i] !== '-') i++
  return tokens[i] ?? ''
}

/** Erstes gesperrtes Ziel (Pfad) eines Befehls ab `cwd`, sonst null. `segmente` kommt aus zerlege(), `loese`/`imHaupt` aus hauptordner-sperre.js. */
function gesperrtesZiel(segmente, cwd, haupt, loese, imHaupt) {
  let aktuell = loese(null, cwd)
  let tiefe = 0
  for (const seg of segmente) {
    if (seg.auf) tiefe++
    else if (seg.zu) tiefe = Math.max(0, tiefe - 1)
    else if (tiefe === 0) {
      const ziel = cdZiel(seg.tokens)
      if (ziel === null) continue
      const p = ziel === '' || ziel === '-' ? null : loese(aktuell, ziel)
      if (!p) continue
      aktuell = p
      if (p.startsWith(`${haupt}/`) && imHaupt(p, haupt)) return p
    }
  }
  return null
}

/** Grund (Text) oder null; `eingabe` ist die Hook-Eingabe, `werkzeug` die Hilfen aus hauptordner-sperre.js. */
function pruefe(eingabe, haupt, werkzeug) {
  if (eingabe.agent_id || eingabe.agent_type) return null
  const befehl = String(eingabe.tool_input?.command ?? '')
  const { zerlege, ohneHeredoc, loese, imHaupt } = werkzeug
  const ziel = gesperrtesZiel(zerlege(ohneHeredoc(befehl)), eingabe.cwd, haupt, loese, imHaupt)
  if (!ziel) return null
  return `Hauptsitzung: „cd ${ziel}“ in einen Unterordner des Hauptordners verschiebt das Arbeitsverzeichnis dauerhaft (die Mods verschwinden). Nimm absolute Pfade (z. B. sed … C:/code/ai/anime-kalender-de/<datei>), „git -C <pfad> …“ oder eine Subshell: ( cd <ordner> && … ).`
}

module.exports = { pruefe, cdZiel, gesperrtesZiel }
