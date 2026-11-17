// Meldet fällige Software-Updates (Git for Windows, gh), damit ich sie selbst einspiele, bevor ein
// Updater-Dialog Daniel fragt (Daniel 16.10. und 04.11.2026). Netz höchstens einmal am Tag, sonst Cache.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const STATE = join(homedir(), '.claude', 'hooks', 'state', 'software-updates.json')
const TAG_MS = 24 * 3600 * 1000

export const QUELLEN = [
  { name: 'Git', repo: 'git-for-windows/git', lokal: () => execFileSync('git', ['--version'], { encoding: 'utf8' }).trim().replace(/^git version /, ''), tag: (t) => t.replace(/^v/, '') },
  { name: 'gh', repo: 'cli/cli', lokal: () => (execFileSync('gh', ['--version'], { encoding: 'utf8' }).match(/gh version (\S+)/) || [])[1], tag: (t) => t.replace(/^v/, '') },
]

async function neuesteVersion(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'claude-hooks' } })
  if (!r.ok) return null
  return (await r.json()).tag_name
}

async function pruefen() {
  const ergebnis = { zeit: Date.now(), faellig: [], lokal: {} }
  for (const q of QUELLEN) {
    const lokal = q.lokal()
    ergebnis.lokal[q.name] = lokal
    const tag = await neuesteVersion(q.repo)
    if (lokal && tag && q.tag(tag) !== lokal) ergebnis.faellig.push(`${q.name} ${lokal} → ${q.tag(tag)}`)
  }
  mkdirSync(join(homedir(), '.claude', 'hooks', 'state'), { recursive: true })
  writeFileSync(STATE, JSON.stringify(ergebnis))
  return ergebnis
}

// Nach einem Update bleibt "fällig" sonst bis zu einen Tag stehen; ohne fällige Updates kein Prozessaufruf.
function lokalGeaendert(st) {
  if (!st.faellig.length) return false
  if (!st.lokal) return true
  return QUELLEN.some((q) => st.faellig.some((f) => f.startsWith(`${q.name} `)) && q.lokal() !== st.lokal[q.name])
}

export async function meldung() {
  let st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null
  if (!st || Date.now() - st.zeit > TAG_MS || lokalGeaendert(st)) st = await pruefen()
  if (!st.faellig.length) return ''
  return `[Update fällig: ${st.faellig.join('; ')} — Installer laden und prüfen, einspielen-als-admin.cmd anpassen, E-Zeile für Daniel (UAC); Weg: Memory feedback-updates-selbst-einspielen]`
}
