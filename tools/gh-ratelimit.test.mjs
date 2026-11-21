/** Tests für tools/gh-ratelimit.mjs: Warten bis zum Reset bei „rate limit“ (Zeit eingespeist), Deckel, Fehler anderer Art, CLI. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cli, ghMitLimit, istRateLimit, MAX_WARTE_MS, restZeile, wartezeitMs } from './gh-ratelimit.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — ${JSON.stringify(info)}`)
}

const LIMIT = 'gh api repos/o/r/pulls/7 Exit 1: HTTP 403: API rate limit exceeded for installation'
const JETZT = 1_000_000_000_000
const kontingent = (reset, remaining = 0) => JSON.stringify({ resources: { core: { remaining, reset } } })

/** gh-Attrappe: `fehlerVor` Fehlschläge mit `text`, danach „ok“; `rate_limit` antwortet mit `reset`. */
function attrappe({ fehlerVor, text, reset }) {
  const aufrufe = []
  let n = 0
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (args.join(' ') === 'api rate_limit') return kontingent(reset)
    if (n++ < fehlerVor) throw new Error(text)
    return 'ok'
  }
  return { gh, aufrufe }
}

pruefe('istRateLimit: Wortlaut der API', istRateLimit(LIMIT) && istRateLimit('API Rate Limit exceeded'), null)
pruefe('istRateLimit: anderer Fehler und leer', !istRateLimit('HTTP 404: Not Found') && !istRateLimit('') && !istRateLimit(undefined), null)

pruefe('wartezeitMs: Reset in 100 s -> 102 s (mit Puffer)', wartezeitMs(JETZT / 1000 + 100, JETZT) === 102_000, wartezeitMs(JETZT / 1000 + 100, JETZT))
pruefe('wartezeitMs: Reset in 3 h -> Deckel 15 min', wartezeitMs(JETZT / 1000 + 10_800, JETZT) === MAX_WARTE_MS && MAX_WARTE_MS === 900_000, wartezeitMs(JETZT / 1000 + 10_800, JETZT))
pruefe('wartezeitMs: Reset genau am Deckel + 1 s -> Deckel', wartezeitMs(JETZT / 1000 + 899, JETZT) === 900_000, wartezeitMs(JETZT / 1000 + 899, JETZT))
pruefe('wartezeitMs: Reset vorbei -> 0', wartezeitMs(JETZT / 1000 - 500, JETZT) === 0, wartezeitMs(JETZT / 1000 - 500, JETZT))
pruefe('wartezeitMs: Reset 1 (lange vorbei) -> 0, nicht Ersatzwartezeit', wartezeitMs(1, JETZT) === 0, wartezeitMs(1, JETZT))
pruefe('wartezeitMs: kein lesbarer Reset -> 60 s', wartezeitMs(NaN, JETZT) === 60_000 && wartezeitMs(undefined, JETZT) === 60_000 && wartezeitMs(0, JETZT) === 60_000, null)
pruefe('wartezeitMs: kein Reset, kleiner Deckel -> Deckel', wartezeitMs(NaN, JETZT, 5000) === 5000, wartezeitMs(NaN, JETZT, 5000))

// rate limit: einmal warten bis zum Reset, dann genau ein neuer Versuch.
{
  const a = attrappe({ fehlerVor: 1, text: LIMIT, reset: JETZT / 1000 + 100 })
  const waren = []
  const ergebnis = ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  pruefe('rate limit: wartet bis zum Reset und liefert den zweiten Versuch', ergebnis === 'ok' && waren.length === 1 && waren[0] === 102_000, { ergebnis, waren })
  pruefe('rate limit: Aufrufe x, rate_limit, x', JSON.stringify(a.aufrufe) === JSON.stringify(['api x', 'api rate_limit', 'api x']), a.aufrufe)
}
// Deckel: Reset in 3 h -> Wartezeit 15 min.
{
  const a = attrappe({ fehlerVor: 1, text: LIMIT, reset: JETZT / 1000 + 10_800 })
  const waren = []
  ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  pruefe('Deckel: Reset in 3 h -> Wartezeit 900000 ms', waren.length === 1 && waren[0] === 900_000, waren)
}
// Zweiter Versuch scheitert wieder: der Fehler kommt durch (kein zweites Warten).
{
  const a = attrappe({ fehlerVor: 9, text: LIMIT, reset: JETZT / 1000 + 5 })
  const waren = []
  let geworfen = ''
  try {
    ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  } catch (e) {
    geworfen = e.message
  }
  pruefe('rate limit zweimal: Fehler mit stderr-Text, genau ein Warten', geworfen.includes('API rate limit exceeded') && waren.length === 1, { geworfen, waren })
}
// Anderer Fehler: sofort geworfen, nicht gewartet, rate_limit nicht abgefragt.
{
  const a = attrappe({ fehlerVor: 9, text: 'gh api x Exit 1: HTTP 404: Not Found', reset: JETZT / 1000 + 5 })
  const waren = []
  let geworfen = ''
  try {
    ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  } catch (e) {
    geworfen = e.message
  }
  pruefe('anderer Fehler: sofort geworfen, kein Warten, nur ein Aufruf', geworfen.includes('404') && waren.length === 0 && a.aufrufe.length === 1, { geworfen, waren, aufrufe: a.aufrufe })
}
// Reset nicht lesbar: kurze Ersatzwartezeit statt Abbruch.
{
  let n = 0
  const gh = (args) => {
    if (args[1] === 'rate_limit') throw new Error('kaputt')
    if (n++ === 0) throw new Error(LIMIT)
    return 'ok'
  }
  const waren = []
  const ergebnis = ghMitLimit(gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  pruefe('Reset nicht lesbar: 60 s warten, dann Neuversuch', ergebnis === 'ok' && waren[0] === 60_000, { ergebnis, waren })
}
// Erfolg beim ersten Versuch: kein Warten, kein rate_limit-Aufruf.
{
  const a = attrappe({ fehlerVor: 0, text: LIMIT, reset: 0 })
  const waren = []
  ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT })
  pruefe('Erfolg: kein Warten, ein Aufruf', waren.length === 0 && a.aufrufe.length === 1, { waren, aufrufe: a.aufrufe })
}

// Logzeile
pruefe('restZeile: x-ratelimit-remaining: <n>', restZeile(attrappe({ fehlerVor: 0, text: '', reset: 1 }).gh) === 'x-ratelimit-remaining: 0', restZeile(attrappe({ fehlerVor: 0, text: '', reset: 1 }).gh))
pruefe('restZeile: Fehler -> unbekannt mit Grund', /^x-ratelimit-remaining: unbekannt \(kaputt\)$/.test(restZeile(() => { throw new Error('kaputt') })), null)

// CLI: rest -> Exit 0; warten nur bei „rate limit“ in der Datei.
{
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-ratelimit-'))
  try {
    const mit = path.join(ordner, 'limit.txt')
    const ohne = path.join(ordner, 'anders.txt')
    fs.writeFileSync(mit, 'HTTP 403: API rate limit exceeded for installation\n')
    fs.writeFileSync(ohne, 'HTTP 404: Not Found\n')
    const a = attrappe({ fehlerVor: 0, text: '', reset: JETZT / 1000 + 10 })
    const waren = []
    const zeilen = []
    const opt = { gh: a.gh, warte: (ms) => waren.push(ms), jetzt: () => JETZT, log: (z) => zeilen.push(z) }
    pruefe('CLI rest: Exit 0 und Zeile', cli(['rest'], opt) === 0 && zeilen[0] === 'x-ratelimit-remaining: 0', zeilen)
    pruefe('CLI warten mit rate limit: Exit 0, wartet 12 s', cli(['warten', mit], opt) === 0 && waren[0] === 12_000, waren)
    pruefe('CLI warten: Logzeile nennt die Sekunden', zeilen.includes('API-Kontingent erschöpft: warte 12 s bis zum Reset'), zeilen)
    pruefe('CLI warten ohne rate limit: Exit 1, kein Warten', cli(['warten', ohne], opt) === 1 && waren.length === 1, waren)
    pruefe('CLI warten ohne Datei: Exit 1', cli(['warten', path.join(ordner, 'fehlt.txt')], opt) === 1 && waren.length === 1, waren)
    pruefe('CLI ohne Befehl: Exit 2', cli([], opt) === 2, null)
    pruefe('CLI warten ohne Datei-Argument: Exit 2', cli(['warten'], opt) === 2, null)
    pruefe('CLI unbekannter Befehl mit Datei: Exit 2', cli(['rest2', mit], opt) === 2, null)
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}

// ghRoh als echter Kindprozess: gh = Node unter dem Namen gh, das das Skript `api` im Arbeitsordner lädt (Windows findet nur gh.exe).
{
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-roh-'))
  const cwd = process.cwd()
  const pfadName = Object.keys(process.env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'
  const pfadAlt = process.env[pfadName]
  try {
    const bin = path.join(ordner, 'bin')
    fs.mkdirSync(bin)
    if (process.platform === 'win32') fs.copyFileSync(process.execPath, path.join(bin, 'gh.exe'))
    else fs.symlinkSync(process.execPath, path.join(bin, 'gh'))
    fs.writeFileSync(path.join(ordner, 'api'), "if (process.argv[2] === 'rate_limit') process.stdout.write('{\"resources\":{\"core\":{\"remaining\":7,\"reset\":1}}}')\nelse if (process.argv[2] === 'gut') process.stdout.write('hallo')\nelse { process.stderr.write('HTTP 403: API rate limit exceeded\\nzweite Zeile\\n'); process.exit(1) }\n")
    process.env[pfadName] = bin + path.delimiter + pfadAlt
    process.chdir(ordner)
    const { ghRoh } = await import('./gh-ratelimit.mjs')
    pruefe('ghRoh: stdout bei Exit 0', ghRoh(['api', 'gut']) === 'hallo', null)
    let text = ''
    try {
      ghRoh(['api', 'schlecht'])
    } catch (e) {
      text = e.message
    }
    pruefe('ghRoh: Fehler nennt Exit-Code und nur die erste stderr-Zeile', text === 'gh api schlecht Exit 1: HTTP 403: API rate limit exceeded', text)
    pruefe('ghRoh: Fehlertext wird als rate limit erkannt', istRateLimit(text), text)
    // Einstieg als eigener Prozess: Exit-Code und Ausgabe.
    const skript = fileURLToPath(new URL('./gh-ratelimit.mjs', import.meta.url))
    const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { cwd: ordner, env: process.env, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    const rest = lauf('rest')
    pruefe('Prozess rest: Exit 0 und Zeile mit remaining 7', rest.status === 0 && rest.stdout === 'x-ratelimit-remaining: 7\n', rest)
    const ohne = lauf()
    pruefe('Prozess ohne Befehl: Exit 2', ohne.status === 2, ohne)
    fs.writeFileSync(path.join(ordner, 'limit.txt'), 'HTTP 403: API rate limit exceeded\n')
    const warten = lauf('warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten (Reset vorbei): Exit 0 ohne echtes Warten', warten.status === 0 && /warte 0 s/.test(warten.stdout), warten)
  } finally {
    process.chdir(cwd)
    process.env[pfadName] = pfadAlt
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}

if (fehler.length) {
  console.error(`gh-ratelimit.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('gh-ratelimit.test: grün')
