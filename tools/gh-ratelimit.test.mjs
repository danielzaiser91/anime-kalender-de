/** Tests für tools/gh-ratelimit.mjs: Warten bis zum Reset bei „rate limit“ (Zeit eingespeist), Zeitkonto, Fehler anderer Art, CLI, echtes Warten. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cli, ghMitLimit, istRateLimit, KONTO_MS, laufMitLimit, neuesKonto, restZeile, warteSync, wartezeitMs } from './gh-ratelimit.mjs'

/** Konto im Speicher des Tests (nie die Datei unter RUNNER_TEMP). */
const leeresKonto = () => neuesKonto({ datei: '' })

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
pruefe('wartezeitMs: Reset in 3 h -> 3 h + Puffer (nicht gekappt: das Konto entscheidet)', wartezeitMs(JETZT / 1000 + 10_800, JETZT) === 10_802_000, wartezeitMs(JETZT / 1000 + 10_800, JETZT))
pruefe('KONTO_MS: 15 min', KONTO_MS === 900_000, KONTO_MS)
pruefe('wartezeitMs: Reset vorbei -> 0', wartezeitMs(JETZT / 1000 - 500, JETZT) === 0, wartezeitMs(JETZT / 1000 - 500, JETZT))
pruefe('wartezeitMs: Reset 1 (lange vorbei) -> 0, nicht Ersatzwartezeit', wartezeitMs(1, JETZT) === 0, wartezeitMs(1, JETZT))
pruefe('wartezeitMs: kein lesbarer Reset -> 60 s', wartezeitMs(NaN, JETZT) === 60_000 && wartezeitMs(undefined, JETZT) === 60_000 && wartezeitMs(0, JETZT) === 60_000, null)

// rate limit: einmal warten bis zum Reset, dann genau ein neuer Versuch.
{
  const a = attrappe({ fehlerVor: 1, text: LIMIT, reset: JETZT / 1000 + 100 })
  const waren = []
  const ergebnis = ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
  pruefe('rate limit: wartet bis zum Reset und liefert den zweiten Versuch', ergebnis === 'ok' && waren.length === 1 && waren[0] === 102_000, { ergebnis, waren })
  pruefe('rate limit: Aufrufe x, rate_limit, x', JSON.stringify(a.aufrufe) === JSON.stringify(['api x', 'api rate_limit', 'api x']), a.aufrufe)
}
// Reset jenseits des Zeitkontos (3 h): sofort scheitern, nie warten, kein zweiter Versuch; der Fehlertext nennt Limit und Grund.
{
  const a = attrappe({ fehlerVor: 9, text: LIMIT, reset: JETZT / 1000 + 10_800 })
  const waren = []
  let geworfen = ''
  try {
    ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
  } catch (e) {
    geworfen = e.message
  }
  pruefe('Reset in 3 h: nicht gewartet, Fehler nennt rate limit und Reset', waren.length === 0 && istRateLimit(geworfen) && geworfen.includes('Reset in 10802 s, Zeitkonto hat noch 900 s: nicht gewartet'), { waren, geworfen })
  pruefe('Reset in 3 h: nur ein Versuch plus rate_limit-Abfrage', JSON.stringify(a.aufrufe) === JSON.stringify(['api x', 'api rate_limit']), a.aufrufe)
}
// Grenze des Kontos: Wartezeit genau gleich Rest -> gewartet, eine Millisekunde mehr -> nicht.
{
  const grenze = (ms) => {
    const a = attrappe({ fehlerVor: 1, text: LIMIT, reset: JETZT / 1000 + 100 })
    const waren = []
    try {
      ghMitLimit(a.gh, ['api', 'x'], { warte: (m) => waren.push(m), jetzt: () => JETZT, konto: neuesKonto({ datei: '', grenze: ms }) })
    } catch {
      /* erwartet beim zu kleinen Konto */
    }
    return waren
  }
  pruefe('Konto genau 102000 ms: gewartet', JSON.stringify(grenze(102_000)) === '[102000]', grenze(102_000))
  pruefe('Konto 101999 ms: nicht gewartet', grenze(101_999).length === 0, grenze(101_999))
}
// Dauer-Limit: zwölf Aufrufe, jeder scheitert, Reset jeweils 4 min voraus. Die Summe aller echten Wartezeiten bleibt im Konto:
// 3 x 242 s = 726 s passen (rest 900 -> 174), der vierte (242 s > 174 s) wird nicht mehr gewartet.
{
  const konto = leeresKonto()
  const waren = []
  const gh = (args) => {
    if (args[1] === 'rate_limit') return kontingent(JETZT / 1000 + 240)
    throw new Error(LIMIT)
  }
  let nichtGewartet = 0
  for (let i = 0; i < 12; i++) {
    try {
      ghMitLimit(gh, ['api', `x${i}`], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto })
    } catch (e) {
      if (e.message.includes('nicht gewartet')) nichtGewartet++
    }
  }
  const summe = waren.reduce((s, ms) => s + ms, 0)
  pruefe('Dauer-Limit: drei Warten (242 s), Summe 726 s <= Konto', JSON.stringify(waren) === '[242000,242000,242000]' && summe <= KONTO_MS, { waren, summe })
  pruefe('Dauer-Limit: die übrigen neun Aufrufe scheitern ohne zu warten', nichtGewartet === 9, nichtGewartet)
}
// Zweiter Versuch scheitert wieder: der Fehler kommt durch (kein zweites Warten).
{
  const a = attrappe({ fehlerVor: 9, text: LIMIT, reset: JETZT / 1000 + 5 })
  const waren = []
  let geworfen = ''
  try {
    ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
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
    ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
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
  const ergebnis = ghMitLimit(gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
  pruefe('Reset nicht lesbar: 60 s warten, dann Neuversuch', ergebnis === 'ok' && waren[0] === 60_000, { ergebnis, waren })
}
// Erfolg beim ersten Versuch: kein Warten, kein rate_limit-Aufruf.
{
  const a = attrappe({ fehlerVor: 0, text: LIMIT, reset: 0 })
  const waren = []
  ghMitLimit(a.gh, ['api', 'x'], { warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto: leeresKonto() })
  pruefe('Erfolg: kein Warten, ein Aufruf', waren.length === 0 && a.aufrufe.length === 1, { waren, aufrufe: a.aufrufe })
}

// warteSync wartet wirklich (bisher speiste jeder Test `warte` ein: ms -> 0 oder ein falscher Atomics-Wert blieben unbemerkt).
{
  const t0 = performance.now()
  warteSync(200)
  const dauer = performance.now() - t0
  pruefe('warteSync(200) dauert mindestens 190 ms (und nicht Sekunden)', dauer >= 190 && dauer < 5000, dauer)
}

// laufMitLimit (Ergebnis {status, stdout, stderr}, z. B. `gh pr diff`): gleiche Regeln wie ghMitLimit.
{
  const lauf = (antworten) => {
    const aufrufe = []
    return { aufrufe, lauf: (args) => (aufrufe.push(args.join(' ')), antworten.shift()) }
  }
  const gut = { status: 0, stdout: 'diff', stderr: '' }
  const limit = { status: 1, stdout: '', stderr: 'HTTP 403: API rate limit exceeded' }
  const sonst = { status: 1, stdout: '', stderr: 'HTTP 404: Not Found' }
  const gh = (args) => (args[1] === 'rate_limit' ? kontingent(JETZT / 1000 + 100) : '')
  const opt = (waren, konto = leeresKonto()) => ({ gh, warte: (ms) => waren.push(ms), jetzt: () => JETZT, konto })
  let waren = []
  let l = lauf([limit, gut])
  pruefe('laufMitLimit: rate limit, Konto reicht -> wartet 102 s, zweiter Lauf liefert', laufMitLimit(['pr', 'diff', '7'], { ...opt(waren), lauf: l.lauf }).stdout === 'diff' && waren[0] === 102_000 && l.aufrufe.length === 2, { waren, aufrufe: l.aufrufe })
  waren = []
  l = lauf([limit, gut])
  const zuWenig = laufMitLimit(['pr', 'diff', '7'], { ...opt(waren, neuesKonto({ datei: '', grenze: 1000 })), lauf: l.lauf })
  pruefe('laufMitLimit: Konto zu klein -> nicht gewartet, erster Fehler mit Grund, ein Lauf', zuWenig.status === 1 && /nicht gewartet/.test(zuWenig.stderr) && /rate limit/.test(zuWenig.stderr) && waren.length === 0 && l.aufrufe.length === 1, { zuWenig, waren })
  waren = []
  l = lauf([sonst, gut])
  pruefe('laufMitLimit: anderer Fehler -> unverändert, kein Warten, ein Lauf', laufMitLimit(['pr', 'diff', '7'], { ...opt(waren), lauf: l.lauf }).stderr === 'HTTP 404: Not Found' && waren.length === 0 && l.aufrufe.length === 1, waren)
  l = lauf([gut])
  pruefe('laufMitLimit: Erfolg -> ein Lauf', laufMitLimit(['pr', 'diff', '7'], { ...opt([]), lauf: l.lauf }).stdout === 'diff' && l.aufrufe.length === 1, l.aufrufe)
}

// Konto: Datei geteilt, kaputt = verbraucht, fehlt = leer.
{
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-konto-'))
  try {
    const datei = path.join(ordner, 'konto')
    const a = neuesKonto({ datei, grenze: 10_000 })
    const b = neuesKonto({ datei, grenze: 10_000 })
    pruefe('Konto: Datei fehlt -> voller Rest', a.rest() === 10_000, a.rest())
    a.buche(4000)
    b.buche(3000)
    pruefe('Konto: zwei Konten auf einer Datei zählen zusammen (Rest 3000)', a.rest() === 3000 && b.rest() === 3000 && fs.readFileSync(datei, 'utf8') === '7000', { a: a.rest(), b: b.rest() })
    b.buche(5000)
    pruefe('Konto: überbucht -> Rest 0, nie negativ', a.rest() === 0, a.rest())
    fs.writeFileSync(datei, 'x')
    pruefe('Konto: unlesbare Datei -> Rest 0', a.rest() === 0, a.rest())
    fs.writeFileSync(datei, '-5')
    pruefe('Konto: negative Zahl in der Datei -> Rest 0', a.rest() === 0, a.rest())
    const mem = neuesKonto({ datei: '', grenze: 100 })
    mem.buche(30)
    pruefe('Konto im Speicher: Rest 70', mem.rest() === 70, mem.rest())
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
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
    const opt = { gh: a.gh, warte: (ms) => waren.push(ms), jetzt: () => JETZT, log: (z) => zeilen.push(z), konto: leeresKonto() }
    pruefe('CLI rest: Exit 0 und Zeile', cli(['rest'], opt) === 0 && zeilen[0] === 'x-ratelimit-remaining: 0', zeilen)
    pruefe('CLI warten mit rate limit: Exit 0, wartet 12 s', cli(['warten', mit], opt) === 0 && waren[0] === 12_000, waren)
    pruefe('CLI warten: Logzeile nennt die Sekunden', zeilen.includes('API-Kontingent erschöpft: warte 12 s bis zum Reset'), zeilen)
    pruefe('CLI warten ohne rate limit: Exit 1, kein Warten', cli(['warten', ohne], opt) === 1 && waren.length === 1, waren)
    pruefe('CLI warten ohne Datei: Exit 1', cli(['warten', path.join(ordner, 'fehlt.txt')], opt) === 1 && waren.length === 1, waren)
    pruefe('CLI ohne Befehl: Exit 2', cli([], opt) === 2, null)
    pruefe('CLI warten ohne Datei-Argument: Exit 2', cli(['warten'], opt) === 2, null)
    pruefe('CLI unbekannter Befehl mit Datei: Exit 2', cli(['rest2', mit], opt) === 2, null)
    // Reset in 3 h: Exit 3 (nicht gewartet), Logzeile mit Grund, das Konto bleibt unberührt.
    const fern = { ...opt, gh: attrappe({ fehlerVor: 0, text: '', reset: JETZT / 1000 + 10_800 }).gh, konto: leeresKonto() }
    const vorher = waren.length
    pruefe('CLI warten, Reset in 3 h: Exit 3, kein Warten, Konto voll', cli(['warten', mit], fern) === 3 && waren.length === vorher && fern.konto.rest() === KONTO_MS, { waren, rest: fern.konto.rest() })
    pruefe('CLI warten, Reset in 3 h: Logzeile nennt Reset und Konto', zeilen.includes('API-Kontingent erschöpft: Reset in 10802 s, Zeitkonto hat noch 900 s: nicht gewartet'), zeilen)
    // Das Konto zählt über mehrere Aufrufe: 12 s gebucht, zweimal 12 s fallen aus 20 s Konto nur einmal.
    const klein = { ...opt, konto: neuesKonto({ datei: '', grenze: 20_000 }) }
    const codes = [cli(['warten', mit], klein), cli(['warten', mit], klein)]
    pruefe('CLI warten: Konto 20 s deckt nur eine von zwei Wartezeiten à 12 s (Exit 0, dann 3)', JSON.stringify(codes) === '[0,3]' && klein.konto.rest() === 8000, { codes, rest: klein.konto.rest() })
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
    fs.writeFileSync(path.join(ordner, 'api'), "if (process.argv[2] === 'rate_limit') process.stdout.write(JSON.stringify({ resources: { core: { remaining: 7, reset: Number(process.env.FAKE_RESET ?? 1) } } }))\nelse if (process.argv[2] === 'gut') process.stdout.write('hallo')\nelse { process.stderr.write('HTTP 403: API rate limit exceeded\\nzweite Zeile\\n'); process.exit(1) }\n")
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
    const kontoDatei = path.join(ordner, 'konto.txt')
    const lauf = (...args) => laufMit({}, ...args)
    const laufMit = (extra, ...args) => spawnSync(process.execPath, [skript, ...args], { cwd: ordner, env: { ...process.env, GH_LIMIT_KONTO: kontoDatei, ...extra }, encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    const rest = lauf('rest')
    pruefe('Prozess rest: Exit 0 und Zeile mit remaining 7', rest.status === 0 && rest.stdout === 'x-ratelimit-remaining: 7\n', rest)
    const ohne = lauf()
    pruefe('Prozess ohne Befehl: Exit 2', ohne.status === 2, ohne)
    fs.writeFileSync(path.join(ordner, 'limit.txt'), 'HTTP 403: API rate limit exceeded\n')
    const warten = lauf('warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten (Reset vorbei): Exit 0 ohne echtes Warten', warten.status === 0 && /warte 0 s/.test(warten.stdout), warten)
    // Echtes Warten im eigenen Prozess: Reset 1 s voraus (Reset in ganzen Sekunden: Wartezeit 1–3 s mit Puffer), gebucht im Konto der Datei.
    const reset = String(Math.floor(Date.now() / 1000) + 1) // uhr-echt: Prozess wartet wirklich, der Reset muss nahe an der echten Zeit liegen
    const t0 = performance.now()
    const echt = laufMit({ FAKE_RESET: reset }, 'warten', path.join(ordner, 'limit.txt'))
    const dauer = performance.now() - t0
    const gebucht = Number(fs.readFileSync(kontoDatei, 'utf8'))
    pruefe('Prozess warten (Reset in 1 s): Exit 0 und wirklich gewartet (>= 1,9 s)', echt.status === 0 && dauer >= 1900 && dauer < 20_000, { status: echt.status, dauer, stdout: echt.stdout })
    pruefe('Prozess warten: Konto-Datei trägt die gebuchte Wartezeit (1–3 s)', gebucht >= 1000 && gebucht <= 3000, gebucht)
    // Konto-Datei fast voll: der nächste Prozess wartet nicht (Exit 3), die Datei bleibt, wie sie war.
    const nochErlaubt = (rest) => fs.writeFileSync(kontoDatei, String(KONTO_MS - rest))
    nochErlaubt(1000)
    const zuWenig = laufMit({ FAKE_RESET: '0' }, 'warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten, Konto-Rest 1 s, Wartezeit 60 s (Reset unlesbar): Exit 3 mit Text, nicht gewartet', zuWenig.status === 3 && /Zeitkonto hat noch 1 s: nicht gewartet/.test(zuWenig.stdout) && fs.readFileSync(kontoDatei, 'utf8') === String(KONTO_MS - 1000), zuWenig)
    const fern = laufMit({ FAKE_RESET: '4102444800' }, 'warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten, Reset im Jahr 2100: Exit 3', fern.status === 3, fern)
    fs.writeFileSync(kontoDatei, 'kaputt')
    const kaputt = laufMit({ FAKE_RESET: '0' }, 'warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten, Konto-Datei unlesbar: gilt als verbraucht (Exit 3), nie unbegrenzt', kaputt.status === 3, kaputt)
    fs.rmSync(kontoDatei)
    const ohneDatei = laufMit({ GH_LIMIT_KONTO: '', RUNNER_TEMP: ordner }, 'warten', path.join(ordner, 'limit.txt'))
    pruefe('Prozess warten ohne GH_LIMIT_KONTO: Konto unter $RUNNER_TEMP/gh-limit-konto', ohneDatei.status === 0 && fs.existsSync(path.join(ordner, 'gh-limit-konto')), { ohneDatei, da: fs.existsSync(path.join(ordner, 'gh-limit-konto')) })
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
