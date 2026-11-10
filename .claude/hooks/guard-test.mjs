import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
const G = fileURLToPath(new URL('./guard.js', import.meta.url))
const B = String.fromCharCode(92)
const faelle = [
  ['Heredoc mit Backslash', `cd x && python - <<'EOF'\ns = 'a${B}nb'\nEOF\necho ok`, true],
  ['Heredoc ohne Backslash', `python - <<'EOF'\nprint(1)\nEOF`, false],
  ['python -c mit Backslash', `python -c "print('a${B}nb')"`, true],
  ['python -c ohne Backslash', `python -c "import sys; print(sys.argv)"`, false],
  ['node -e mit Backslash', `node -e "console.log('C:${B}${B}x')"`, true],
  ['node -e ohne Backslash', `node -e "console.log(1+1)"`, false],
  ['Heredoc an cat mit Backslash', `cat > f.txt <<'EOF'\na${B}nb\nEOF`, false],
  ['Backslash außerhalb des Codes', `python -c "print(1)" && echo a${B}nb`, false],
  ['normaler Befehl', `git status --short`, false],
  /* Seit 22.09.2026 gesperrt: ein cat-Heredoc, der ein Skript mit Backslash schreibt (vorher als Fehlalarm freigegeben, 18.09. 15:36). */
  ['cat-Heredoc schreibt .py mit Backslash', `cp a.mjs b && cat > p_reg.py <<'EOF'\ns = 'a${B}nb'\nEOF\npython p_reg.py`, true],
  ['cat-Heredoc schreibt .mjs mit Backslash (22.09.2026)', `cat > /tmp/p.mjs <<'EOF'\nq.replace(/a${B}s/, '')\nEOF`, true],
  ['cat-Heredoc schreibt .mjs ohne Backslash', `cat > p.mjs <<'EOF'\nconsole.log(1)\nEOF`, false],
  ['Skriptdatei mit Backslash-Argument', `python "C:${B}x${B}p.py"`, false],
  /* TZ=<Region>/<Stadt> rechnet in Git Bash still UTC (24.10.2026). */
  ['TZ=Europe/Berlin date', `h=$(TZ=Europe/Berlin date -d "$t" +%H:%M)`, true],
  ['TZ in Anführung', `TZ='America/New_York' date`, true],
  ['TZ=UTC bleibt frei', `TZ=UTC date`, false],
  ['grep nach TZ= im Text bleibt frei', `grep -n "PTZ=x" a.txt`, false],
]
let fehler = 0
for (const [name, command, soll] of faelle) {
  const r = spawnSync('node', [G], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' })
  const ist = r.stdout.includes('"deny"')
  if (ist !== soll) fehler++
  console.log(ist === soll ? 'ok  ' : 'FEHL', name, ist ? '→ deny' : '→ frei', r.stderr.trim())
}

/* Server-Sperre mit Freigabe-Datei (F2 A, 13.10.2026): ohne gültige Freigabe deny, nie escalate. */
const datei = join(mkdtempSync(join(tmpdir(), 'guard-')), 'freigaben.json')
const iso = (minuten) => new Date(Date.now() + minuten * 60000).toISOString()
writeFileSync(datei, JSON.stringify({ freigaben: [
  { befehl: 'npm run dev', port: 5173, erteilt: iso(-10), bis: iso(60), daniel: 'Test' },
  { befehl: 'wrangler dev', port: 8787, erteilt: iso(-120), bis: iso(-1), daniel: 'abgelaufen' },
  { befehl: 'vite preview', port: 4173, erteilt: iso(-10), bis: iso(300), daniel: 'über 4 h' },
  { befehl: 'web', port: 5173, erteilt: iso(-10), bis: iso(60), daniel: 'preview' },
] }))
const server = [
  ['Server ohne Freigabe', 'Bash', { command: 'npx serve public' }, true],
  ['Server mit gültiger Freigabe', 'Bash', { command: 'cd web && npm run dev' }, false],
  ['Freigabe abgelaufen', 'Bash', { command: 'docker compose up' }, true],
  ['Freigabe länger als 4 h zählt nicht', 'Bash', { command: 'vite preview --port 4173' }, true],
  ['preview_start mit Freigabe', 'mcp__Claude_Browser__preview_start', { name: 'web' }, false],
  ['preview_start ohne Freigabe', 'mcp__Claude_Browser__preview_start', { name: 'api' }, true],
  ['preview_start mit url', 'mcp__Claude_Browser__preview_start', { url: 'https://x.de' }, false],
  /* „vite“ nur an Befehlsstelle (13.10.2026: grep/cat mit dem Wort wurden gesperrt). */
  ['grep nach vite ist kein Server', 'Bash', { command: 'grep -n "vite" guard.js' }, false],
  ['vite.config lesen ist kein Server', 'Bash', { command: 'cat web/vite.config.ts' }, false],
  ['npx vite startet Server', 'Bash', { command: 'cd app && npx vite --port 5174' }, true],
  ['vite nach Pipe startet Server', 'Bash', { command: 'echo x | vite' }, true],
  ['npx vite build ist kein Server', 'Bash', { command: 'npx vite build' }, false],
]
for (const [name, tool_name, tool_input, soll] of server) {
  const r = spawnSync('node', [G], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8', env: { ...process.env, GUARD_FREIGABEN: datei } })
  const ist = r.stdout.includes('"deny"')
  if (ist !== soll || r.stdout.includes('escalate')) fehler++
  console.log(ist === soll ? 'ok  ' : 'FEHL', name, ist ? '→ deny' : '→ frei', r.stderr.trim())
}
const ohneDatei = spawnSync('node', [G], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm run dev' } }), encoding: 'utf8', env: { ...process.env, GUARD_FREIGABEN: datei + '.fehlt' } })
if (!ohneDatei.stdout.includes('"deny"')) fehler++
console.log(ohneDatei.stdout.includes('"deny"') ? 'ok  ' : 'FEHL', 'Freigabe-Datei fehlt → deny')
process.exit(fehler ? 1 : 0)
