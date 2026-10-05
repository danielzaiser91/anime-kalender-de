// Startet einen Claude-Code-Agenten mit DeepSeek (V4.1 Flash) in einem eigenen Worktree und schreibt die Ausgabe in eine Datei.
// WICHTIG: eigenes, leeres CLAUDE_CONFIG_DIR — sonst schickt die CLI ihr gespeichertes Anthropic-Anmeldetoken an den fremden Server
// (am 04.10.2026 passiert: DeepSeek antwortete 401 und nannte die letzten vier Zeichen des Anthropic-Tokens).
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const t = fs.readFileSync('C:/code/ai/ai helper files/my_secrets.md', 'utf8')
const key = (/`(sk-[A-Za-z0-9]+)`/.exec(t.slice(t.lastIndexOf('DeepSeek API-Schluessel'))) || [])[1]
if (!key) throw new Error('kein Schlüssel')
const [, , arbeitsordner, auftragsdatei, ausgabe] = process.argv
const auftrag = fs.readFileSync(auftragsdatei, 'utf8')
const konfig = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-konfig-'))
const env = {
  ...process.env,
  CLAUDE_CONFIG_DIR: konfig,
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_AUTH_TOKEN: key,
  ANTHROPIC_MODEL: 'deepseek-flash',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-flash',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-flash',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-flash',
  CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-flash',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
}
delete env.ANTHROPIC_API_KEY
delete env.CLAUDE_CODE_OAUTH_TOKEN
const out = fs.openSync(ausgabe, 'w')
const p = spawn(
  process.env.ComSpec || 'cmd.exe',
  ['/c', 'claude', '-p', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Grep,Glob,Bash(node:*),Bash(npx:*),Bash(git status:*),Bash(git diff:*),Bash(git add:*),Bash(git commit:*)', '--max-turns', '60', '--output-format', 'text'],
  { cwd: arbeitsordner, env, stdio: ['pipe', out, out] },
)
p.stdin.write(auftrag)
p.stdin.end()
p.on('exit', (c) => { fs.appendFileSync(ausgabe, `\n[Ende, Exit ${c}]\n`); fs.rmSync(konfig, { recursive: true, force: true }) })
