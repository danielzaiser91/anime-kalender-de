/**
 * Umfang-Grenzen im Nachrechnen (`pr-nachrechnen-umfang.mjs`, 11.11.2026): Der Bestandsbau senkt `tools/umfang-grenzen.json`; das darf
 * keinen PR entwerten, der die Grenzen auf dem Merge-Stand hält. Echtes git in einem Wegwerf-Repo unter os.tmpdir() (Remote mit
 * `refs/pull/7/head`), echtes `umfang-pruefen`; dazu die Verdrahtung über `botSprungAusnahme`, `datenpfadGrund` und `nachrechnen`.
 * Die Erwartungen (Zahlen) stehen fest im Test, nicht aus dem Modul: Basis hat Überlänge 10 bei erlaubten 12 (Bot lag zurück),
 * main senkt auf 10; ein PR mit +2 besteht seine Kette (12 <= 12), auf dem Merge-Stand wären es 12 > 10.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { botSprungAusnahme, datenpfadGrund, nachrechnen } from './pr-nachrechnen.mjs'
import { gitAufruf, gitLeser } from './pr-nachrechnen-leser-git.mjs'
import { grenzErhoehung, standardMessen, umfangGrund } from './pr-nachrechnen-umfang.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const G = 'tools/umfang-grenzen.json'
const grenzen = (funktionen) => JSON.stringify({ ueberlaenge: { tools: { funktionen, dateien: 0, ketten: 0 } } }) + '\n'
/** Datei mit genau einer Funktion von `n` Zeilen (Überlänge n - 80). */
const funktion = (name, n) => `export function ${name}() {\n${'  void 0\n'.repeat(n - 2)}}\n`

// 1. Reine Regel: nur Erhöhungen zählen
{
  const a = JSON.parse(grenzen(12))
  pruefe('Grenzen gleich -> keine Erhöhung', grenzErhoehung(a, JSON.parse(grenzen(12))) === null)
  pruefe('Grenze gesenkt -> keine Erhöhung', grenzErhoehung(a, JSON.parse(grenzen(11))) === null)
  pruefe('Grenze um 1 erhöht -> Erhöhung genannt', grenzErhoehung(a, JSON.parse(grenzen(13))) === 'tools funktionen 12 -> 13')
  const b = JSON.parse(grenzen(12))
  b.ueberlaenge.tools.ketten = 1
  pruefe('nur die Art `ketten` erhöht -> Erhöhung', grenzErhoehung(a, b) === 'tools ketten 0 -> 1')
  const e = JSON.parse(grenzen(12))
  e.ueberlaenge.tools.dateien = 1
  pruefe('nur die Art `dateien` erhöht -> Erhöhung', grenzErhoehung(a, e) === 'tools dateien 0 -> 1')
  const c = JSON.parse(grenzen(12))
  c.ueberlaenge.web = { funktionen: 5, dateien: 0, ketten: 0 }
  pruefe('neuer Bereich mit Wert über 0 -> Erhöhung', grenzErhoehung(a, c) === 'web funktionen 0 -> 5')
  const d = JSON.parse(grenzen(12))
  d.ueberlaenge.web = { funktionen: 0, dateien: 0, ketten: 0 }
  pruefe('neuer Bereich mit lauter 0 -> keine Erhöhung', grenzErhoehung(a, d) === null)
}

// 2. Echtes git
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-umfang-'))
let zaehler = 0
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim()
const schreibe = (repo, datei, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, datei)), { recursive: true })
  fs.writeFileSync(path.join(repo, datei), text)
}
const gebe = (repo, text) => {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', text)
  return git(repo, 'rev-parse', 'HEAD')
}

/**
 * Basis: a.mjs Überlänge 10, erlaubt 12. main (Bot): `mainGrenze`, optional `mainA` (Text von a.mjs). PR von der Basis: `prDateien`.
 * Rückgabe { arbeit, refs } mit Kopf, main, Basis; `refs/pull/7/head` liegt im Remote.
 */
function baue({ mainGrenze = 10, mainA, prDateien }) {
  const ordner = path.join(wurzel, `fall-${++zaehler}`)
  const remote = path.join(ordner, 'remote.git')
  const arbeit = path.join(ordner, 'arbeit')
  git(wurzel, 'init', '-q', '--bare', remote)
  fs.mkdirSync(arbeit, { recursive: true })
  git(arbeit, 'init', '-q', '-b', 'main')
  git(arbeit, 'remote', 'add', 'origin', remote)
  schreibe(arbeit, 'tools/a.mjs', funktion('a', 90))
  schreibe(arbeit, G, grenzen(12))
  const basis = gebe(arbeit, 'basis')
  git(arbeit, 'checkout', '-q', '-b', 'pr')
  for (const [datei, text] of Object.entries(prDateien)) schreibe(arbeit, datei, text)
  const kopf = gebe(arbeit, 'pr')
  git(arbeit, 'checkout', '-q', 'main')
  schreibe(arbeit, G, grenzen(mainGrenze))
  if (mainA !== undefined) schreibe(arbeit, 'tools/a.mjs', mainA)
  const main = gebe(arbeit, 'main')
  git(arbeit, 'push', '-q', 'origin', 'main', `${kopf}:refs/pull/7/head`)
  return { arbeit, refs: { nummer: 7, kopf, main, basis } }
}

const vorher = process.cwd()
try {
  {
    const { arbeit, refs } = baue({ prDateien: { 'tools/b.mjs': 'export const b = 1\n' } })
    process.chdir(arbeit)
    pruefe('echtes git: main senkt auf 10, PR unauffällig (Merge-Stand 10) -> null', umfangGrund(refs) === null, umfangGrund(refs))
  }
  {
    const { arbeit, refs } = baue({ mainGrenze: 5, mainA: funktion('a', 85), prDateien: { 'tools/b.mjs': 'export const b = 1\n' } })
    process.chdir(arbeit)
    pruefe('echtes git: main kürzt a.mjs auf 85 und senkt auf 5, PR unauffällig -> Merge-Stand 5 (Kopf allein wäre 10) -> null', umfangGrund(refs) === null, umfangGrund(refs))
  }
  {
    const harmlos = { 'tools/b.mjs': 'export const b = 1\n', 'tools/typen.d.ts': funktion('t', 90), 'tools/lang.txt': 'x\n'.repeat(900), 'scripts/z.mjs': funktion('z', 90) }
    const { arbeit, refs } = baue({ prDateien: harmlos })
    process.chdir(arbeit)
    pruefe('echtes git: .d.ts, Textdatei und Ordner außerhalb der Bereiche zählen nicht -> null', umfangGrund(refs) === null, umfangGrund(refs))
  }
  {
    const { arbeit, refs } = baue({ prDateien: { 'tools/d.mjs': funktion('d', 82) } })
    process.chdir(arbeit)
    const g = umfangGrund(refs)
    pruefe('echtes git: PR +2 (12 <= 12 in seiner Kette), Merge-Stand 12 > 10 -> Grund', /^der PR reißt auf dem Merge-Stand die Umfang-Grenzen von main: tools: Überlänge der funktionen 12 statt höchstens 10$/.test(g), g)
  }
  {
    const { arbeit, refs } = baue({ prDateien: { 'tools/d.mjs': funktion('d', 81) } })
    process.chdir(arbeit)
    const g = umfangGrund(refs)
    pruefe('echtes git: PR +1 -> Merge-Stand 11 > 10 -> Grund (Grenze genau eins drüber)', /11 statt höchstens 10/.test(g), g)
    const { arbeit: a2, refs: r2 } = baue({ prDateien: { 'tools/d.mjs': funktion('d', 80) } })
    process.chdir(a2)
    pruefe('echtes git: PR +0 (Funktion mit genau 80 Zeilen) -> Merge-Stand 10 = 10 -> null', umfangGrund(r2) === null, umfangGrund(r2))
  }
  {
    const { arbeit, refs } = baue({ mainGrenze: 15, prDateien: { 'tools/b.mjs': 'export const b = 1\n' } })
    process.chdir(arbeit)
    const g = umfangGrund(refs)
    pruefe('echtes git: main erhöht die Grenze (12 -> 15) -> Grund, auch wenn der PR harmlos ist', g === 'main erhöhte die Umfang-Grenze (tools funktionen 12 -> 15)', g)
  }
  {
    const { arbeit, refs } = baue({ mainA: funktion('a', 85), prDateien: { 'tools/a.mjs': funktion('a', 88) } })
    process.chdir(arbeit)
    const g = umfangGrund(refs)
    pruefe('echtes git: Merge-Konflikt (beide ändern a.mjs) -> nicht ermittelbar', /^Umfang nicht ermittelbar \(/.test(g), g)
  }
  {
    const { arbeit, refs } = baue({ prDateien: { 'tools/b.mjs': 'export const b = 1\n' } })
    process.chdir(arbeit)
    const g = umfangGrund({ ...refs, nummer: 99 })
    pruefe('echtes git: Kopf nicht abrufbar (kein refs/pull/99/head) -> nicht ermittelbar', /^Umfang nicht ermittelbar \(/.test(g), g)
    const fehlt = () => {
      throw new Error("Cannot find package 'typescript'")
    }
    const k = umfangGrund(refs, gitAufruf, fehlt)
    pruefe('Messer wirft (typescript fehlt wie im Nacht-Merger) -> nicht ermittelbar mit Ursache', k === "Umfang nicht ermittelbar (Cannot find package 'typescript')", k)
    const leer = umfangGrund(refs, gitAufruf, () => [])
    pruefe('Messer meldet keine Verstöße -> null', leer === null, leer)
    const viel = umfangGrund(refs, gitAufruf, () => ['a: 3 statt 2', 'b: 5 statt 4'])
    pruefe('Messer meldet zwei Verstöße -> beide im Grund', /: a: 3 statt 2; b: 5 statt 4$/.test(viel), viel)
    let empfangen = null
    umfangGrund(refs, gitAufruf, (baum, main) => {
      empfangen = { baum, main }
      return []
    })
    pruefe('Messer bekommt den Merge-Baum (nicht Kopf, nicht main) und main', /^[0-9a-f]{40}$/.test(empfangen.baum) && empfangen.baum !== refs.kopf && empfangen.baum !== refs.main && empfangen.main === refs.main, empfangen)
  }
  {
    // Kindprozess ohne Attrappe: Fehlerpfad (Baum unbekannt) mit Ursache aus stderr, Erfolgspfad im ganzen Ablauf unten.
    const { arbeit, refs } = baue({ prDateien: { 'tools/b.mjs': 'export const b = 1\n' } })
    process.chdir(arbeit)
    let wurf = ''
    try {
      standardMessen('0'.repeat(40), refs.main)
    } catch (e) {
      wurf = e.message
    }
    pruefe('Kindprozess: unbekannter Baum -> Exit 1, Ursache „umfang-baum-messen: …“ aus stderr', /^umfang-baum-messen: /.test(wurf), wurf)
  }

  // 3. Verdrahtung: botSprungAusnahme
  const bewegt = (dateien) => ({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: 1, autoren: ['maintainer'], vollstaendig: true })
  const leser = []
  const liest = (b) => {
    leser.push(b)
    return null
  }
  const lauf = (dateien, pr, umfang) => {
    const aufrufe = []
    leser.length = 0
    const messer = () => {
      aufrufe.push(1)
      return umfang
    }
    const r = botSprungAusnahme(bewegt(dateien), pr, liest, messer)
    return { r, umfangAufrufe: aufrufe.length, leser: [...leser] }
  }
  {
    const x = lauf([G, 'data/ann-ids.json'], ['pipeline/a.ts'], null)
    pruefe('nur Grenzen + Daten bewegt, Umfang null -> Ausnahme gilt', x.r === null && x.umfangAufrufe === 1, x)
    pruefe('Leser bekommt die Grenzdatei nicht mehr (sonst fragt er nach ihr)', x.leser.every((l) => !l.includes(G)), x.leser)
    const y = lauf([G], ['pipeline/a.ts'], 'der PR reißt x')
    pruefe('Umfang meldet Grund -> „main bewegte tools/umfang-grenzen.json; <Grund>“', y.r === `main bewegte ${G}; der PR reißt x`, y)
    const z = lauf(['data/ann-ids.json'], ['pipeline/a.ts'], 'unerreichbar')
    pruefe('Grenzen nicht bewegt -> Umfang wird nie gefragt', z.umfangAufrufe === 0 && z.r === null, z)
    const b = lauf([G], [G], 'unerreichbar')
    pruefe('PR berührt die Grenzdatei selbst -> berührt, Umfang nicht gefragt', b.r === `der PR berührt ${G}` && b.umfangAufrufe === 0, b)
    const w = lauf([G, 'package.json'], ['pipeline/a.ts'], null)
    pruefe('Grenzen (ok) + package.json bewegt -> package.json entwertet weiter', w.r === 'main bewegte package.json', w)
    const s = lauf([G, '.github/workflows/pr-pruefung.yml'], ['pipeline/a.ts'], null)
    pruefe('Grenzen (ok) + Kettendefinition bewegt -> entwertet weiter', s.r === 'main bewegte .github/workflows/pr-pruefung.yml', s)
    const v = botSprungAusnahme(bewegt([G]), ['pipeline/a.ts'], liest)
    pruefe('ohne Messer-Argument: Standard ist fail-closed (Grund)', typeof v === 'string' && /Umfang nicht geprüft/.test(v), v)
  }

  // 4. Verdrahtung: datenpfadGrund reicht refs samt Basis an den Messer
  {
    const empfangen = []
    const gh = (args) => (args[1].includes('/compare/') ? JSON.stringify({ status: 'ahead', anzahl: 1, dateien: [G], commitsGesamt: 1, autoren: ['anime-kalender-daten[bot]'] }) : 'pipeline/a.ts\n')
    const u = datenpfadGrund(gh, { number: 7, headRefOid: 'k'.repeat(40) }, 'b'.repeat(40), 'm'.repeat(40), () => null, () => ({ fehler: 'x' }), () => ({ fehler: 'x' }), (refs) => (empfangen.push(refs), null))
    pruefe('datenpfadGrund: Umfang null -> Ausnahme', u.ausnahme !== undefined && u.grund === undefined, u)
    pruefe('datenpfadGrund: Messer bekommt Nummer, Kopf, main und Basis', JSON.stringify(empfangen) === JSON.stringify([{ nummer: 7, kopf: 'k'.repeat(40), main: 'm'.repeat(40), basis: 'b'.repeat(40) }]), empfangen)
    const g = datenpfadGrund(gh, { number: 7, headRefOid: 'k'.repeat(40) }, 'b'.repeat(40), 'm'.repeat(40), () => null, () => ({ fehler: 'x' }), () => ({ fehler: 'x' }), () => 'zu groß')
    pruefe('datenpfadGrund: Umfang-Grund -> NICHT AKTUELL mit Grund', /zu groß/.test(g.grund ?? ''), g)
  }

  // 5. Ganzer Ablauf `nachrechnen` mit echtem git: Fehlalarm weg, echte Bewegung bleibt
  const ganzer = (prDateien) => {
    const { arbeit, refs } = baue({ prDateien })
    process.chdir(arbeit)
    const KOPF = refs.kopf
    const aufrufe = []
    const meldungen = []
    const gh = (args) => {
      const s = args.join(' ')
      aufrufe.push(s)
      if (s.startsWith('pr view 7')) return JSON.stringify({ number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x' })
      if (s.startsWith('pr list')) return '[]'
      if (s.startsWith('run list')) return JSON.stringify([{ databaseId: 12, headSha: KOPF, createdAt: '2026-11-11T10:00:00Z', conclusion: 'success', status: 'completed' }])
      if (s === 'run view 12 --json jobs') return JSON.stringify({ jobs: [{ name: 'Kette – Workflows', databaseId: 92, status: 'completed' }] })
      if (s.includes('/actions/jobs/92/logs')) return `HEAD is now at 1234567 Merge ${KOPF} into ${refs.basis}\n`
      if (s.includes('git/ref/heads/main')) return `${refs.main}\n`
      if (s.includes('/compare/')) {
        const dateien = git(arbeit, 'diff', '--name-only', refs.basis, refs.main).split('\n').filter(Boolean)
        return JSON.stringify({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: 1, autoren: ['t'] })
      }
      if (s.endsWith('/pulls/7/files --paginate --jq .[] | .filename, (.previous_filename // empty)')) return 'tools/b.mjs\n'
      if (s.endsWith('/pulls/7 --jq .merge_commit_sha')) return 'm'.repeat(40) + '\n'
      if (s.startsWith('api repos/{owner}/{repo}/commits/')) return `${refs.main}\n`
      if (s === 'pr close 7' || s === 'pr reopen 7' || s.startsWith('pr comment 7')) return ''
      throw new Error(`unerwarteter gh-Aufruf ${s}`)
    }
    const code = nachrechnen(7, gh, (t) => meldungen.push(t), () => {}, gitLeser(gitAufruf), undefined, undefined, false)
    return { code, aufrufe, meldungen }
  }
  {
    const x = ganzer({ 'tools/b.mjs': 'export const b = 1\n' })
    pruefe('nachrechnen: nur Grenzen gesenkt, PR hält sie -> aktuell (Exit 0), nichts geschlossen', x.code === 0 && !x.aufrufe.includes('pr close 7'), x)
    pruefe('nachrechnen: Meldung nennt „aktuell“ und die Kettenbasis', /^PR 7: aktuell, Kette gegen /.test(x.meldungen[0] ?? ''), x.meldungen)
    const y = ganzer({ 'tools/b.mjs': 'export const b = 1\n', 'tools/d.mjs': funktion('d', 82) })
    pruefe('nachrechnen: PR reißt die gesenkten Grenzen -> NICHT AKTUELL (Exit 1), geschlossen und geöffnet', y.code === 1 && y.aufrufe.includes('pr close 7') && y.aufrufe.includes('pr reopen 7'), y)
    pruefe('nachrechnen: Meldung nennt die Umfang-Zahlen', /NICHT AKTUELL.*Merge-Stand.*12 statt höchstens 10/.test(y.meldungen.join('\n')), y.meldungen)
  }
} finally {
  process.chdir(vorher)
  fs.rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-umfang.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-umfang.test: grün')
