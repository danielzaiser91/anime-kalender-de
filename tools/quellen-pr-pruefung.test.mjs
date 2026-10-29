/**
 * `tools/quellen-pr.sh` prüft den Fund vor dem Einreichen (`tools/quellen-pruefen.sh`, 17.10.2026): grün = wie bisher, rot = Pull Request mit Marke, Grund und ohne Merge.
 * Anlass: Ein Sammler-PR brachte zwei Sammlerdateien in Widerspruch, erst der Bestandsbau merkte es, `main` war über sieben Stunden rot.
 * Lokaler Ursprung, Attrappe für `gh` (schreibt jeden Aufruf mit); die Prüfung ist ein Wegwerf-Befehl (`QUELLEN_PRUEFBEFEHL`).
 */
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const posix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`)
const git = 'git -c user.name=t -c user.email=t@t'
const sh = (cwd, befehl, env = {}) => {
  const r = spawnSync('bash', ['-c', befehl], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}
const shAsync = (cwd, befehl, env = {}) =>
  new Promise((fertig) => {
    const kind = spawn('bash', ['-c', befehl], { cwd, env: { ...process.env, ...env } })
    let out = ''
    kind.stdout.on('data', (d) => (out += d))
    kind.stderr.on('data', (d) => (out += d))
    kind.on('close', (status) => fertig({ status, out }))
  })

/** Attrappe: jeder Aufruf eine Zeile in aufrufe.txt; `pr create` legt Titel und Text (NUL-getrennt) ab und merkt, ob die Prüfung schon gelaufen war. */
function schreibeGh(bin, dir) {
  const d = posix(dir)
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh
echo "$*" | head -n 1 >> "${d}/aufrufe.txt"
case "$1 $2" in
  "pr create") printf '%s\\0' "$@" > "${d}/create.bin"; if [ -f "${d}/pruefung-lief" ]; then : > "${d}/create-nach-pruefung"; fi; echo "https://github.com/x/y/pull/99" ;;
  "pr view") echo "MERGEABLE" ;;
  "pr list") if [ -f "${d}/liste-kaputt" ]; then cat "${d}/liste.json"; echo "HTTP 502" >&2; exit 1; fi; case "$*" in *"--state open"*"--json number,title,body"*) if [ -f "${d}/liste.json" ]; then cat "${d}/liste.json"; else echo "[]"; fi ;; *) echo "falsche Parameter: $*" >&2; exit 1 ;; esac ;;
  "pr merge") exit 0 ;;
  "pr edit"|"label create") if [ -f "${d}/label-kaputt" ]; then echo "label kaputt" >&2; exit 1; fi ;;
esac
`,
  )
  chmodSync(join(bin, 'gh'), 0o755)
  /* Beobachtet die Frist, die `quellen_pruefen` an `timeout` übergibt, und reicht an das echte weiter. */
  const echtes = spawnSync('bash', ['-c', 'command -v timeout'], { encoding: 'utf8' }).stdout.trim()
  writeFileSync(join(bin, 'timeout'), `#!/bin/sh
echo "$1" >> "${d}/fristen.txt"
exec "${echtes}" "$@"
`)
  chmodSync(join(bin, 'timeout'), 0o755)
}

/** Ein Sammel-Lauf mit einer geänderten Quelle (oder keiner); `befehl` ist die Prüfung, `frist` ihre Zeitgrenze in Sekunden. */
async function szenario({ befehl, frist = 60, aenderung = true, labelKaputt = false, nurFund = false, liste = null, module = false, listeKaputt = false }) {
  const dir = mkdtempSync(join(tmpdir(), 'quellen-pr-pruefung-'))
  try {
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    schreibeGh(bin, dir)
    if (labelKaputt) writeFileSync(join(dir, 'label-kaputt'), '')
    if (listeKaputt) writeFileSync(join(dir, 'liste-kaputt'), '')
    if (liste) writeFileSync(join(dir, 'liste.json'), JSON.stringify(liste))
    sh(dir, 'git init -q --bare -b main ursprung.git && git clone -q ursprung.git lauf 2>/dev/null')
    const lauf = join(dir, 'lauf')
    mkdirSync(join(lauf, 'data'), { recursive: true })
    mkdirSync(join(lauf, 'tools'), { recursive: true })
    for (const datei of ['quellen-liste.sh', 'quellen-aufsetzen.sh', 'quellen-pr.sh', 'quellen-pruefen.sh', 'health-vereinen.mjs', 'dub-belege-vereinen.mjs', 'rote-sammler-prs.mjs'])
      copyFileSync(join(wurzel, 'tools', datei), join(lauf, 'tools', datei))
    writeFileSync(join(lauf, 'data/anisearch.json'), '{"v":1}')
    sh(lauf, `git add -A && ${git} commit -q -m start && git push -q origin HEAD:main`)
    if (aenderung) writeFileSync(join(lauf, 'data/anisearch.json'), '{"v":2}')
    if (module) {
      mkdirSync(join(lauf, 'node_modules'))
      writeFileSync(join(lauf, 'node_modules/marke'), '')
    }
    const ausgabeDatei = join(dir, 'ausgabe.txt')
    writeFileSync(ausgabeDatei, '')
    const env = {
      PATH: `${posix(bin)}:${process.env.PATH}`,
      GITHUB_OUTPUT: posix(ausgabeDatei),
      GITHUB_RUN_ID: '77',
      GITHUB_WORKFLOW: 'Sammler Test',
      /* Fest gesetzt: In der CI trägt der Testlauf selbst einen GITHUB_JOB. Das App-Token darf die Prüfung nicht sehen (`quellen_pruefen`). */
      GITHUB_JOB: 'sammeln',
      GH_TOKEN: 'app-token-attrappe',
      GITHUB_TOKEN: 'github-token-attrappe',
      /* nurFund: rot nur auf dem Stand des Funds (v2); auf main (v1) grün, sonst läge main selbst rot. */
      QUELLEN_PRUEFBEFEHL: (nurFund ? `if grep -q '"v":2' data/anisearch.json; then ${befehl}; fi` : befehl).replaceAll('$MARKE', `${posix(dir)}/pruefung-lief`),
      ...(frist === null ? {} : { QUELLEN_PRUEFFRIST: String(frist) }),
    }
    const r = await shAsync(lauf, 'bash tools/quellen-pr.sh "chore(data): Test"', env)
    const create = existsSync(join(dir, 'create.bin')) ? readFileSync(join(dir, 'create.bin'), 'utf8').split('\0') : []
    const nach = (flag) => create[create.indexOf(flag) + 1] ?? ''
    return {
      status: r.status,
      out: r.out,
      ausgabe: readFileSync(ausgabeDatei, 'utf8'),
      aufrufe: existsSync(join(dir, 'aufrufe.txt')) ? readFileSync(join(dir, 'aufrufe.txt'), 'utf8') : '',
      titel: nach('--title'),
      text: nach('--body'),
      nachPruefung: existsSync(join(dir, 'create-nach-pruefung')),
      markeDa: existsSync(join(dir, 'pruefung-lief')),
      fristArg: existsSync(join(dir, 'fristen.txt')) ? readFileSync(join(dir, 'fristen.txt'), 'utf8').trim() : '',
      arbeitsbaeume: sh(lauf, 'git worktree list').out.trim().split('\n').length,
      zweige: sh(join(dir, 'ursprung.git'), 'git branch --list "daten/*"').out.trim(),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

console.log('grün: wie bisher')
const gruenBefehl = `test "$CI" = true && test -z "\${GH_TOKEN:-}\${GITHUB_TOKEN:-}" && touch "$MARKE" && git diff --quiet HEAD && test "$(cat data/anisearch.json)" = '{"v":2}'`
/* Alle Szenarien gleichzeitig: Jedes legt sich einen eigenen Ursprung an, die Läufe stören sich nicht (einzeln gut 15 s, zusammen etwa eines). */
const rotBefehl = 'echo PROTOKOLL-ZEILE; echo "  - tools/a.ts"; echo "  - pipeline/zweite.ts"; for i in $(seq 1 25); do echo "  - tools/p$i.ts"; done; exit 1'
/* Offene PRs: der richtige Treffer steht jeweils in der Mitte; 99 ist der neue PR selbst. Schlüssel = Workflow/Job/Nachricht (quellen-pr.sh). */
const SCHLUESSEL = 'Sammler Test/sammeln/chore(data): Test'
const pr = (number, title, schluessel) => ({ number, title, body: `von **Sammler Test** (Lauf ${number})\n<!-- fund-schluessel: ${schluessel} -->` })
const LISTE = [
  pr(11, '[Prüfung rot] chore(data): Anderes', 'Anderer Lauf/sammeln/chore(data): Test'),
  pr(12, '[Prüfung rot] chore(data): Alt', SCHLUESSEL),
  /* Zweiter Job desselben Workflows (refresh-weekly hat sieben): sein Fund bleibt offen. */
  pr(16, '[Prüfung rot] chore(data): Test (ADN)', 'Sammler Test/adn/chore(data): Test (ADN)'),
  pr(13, 'chore(data): ohne Marke', SCHLUESSEL),
  pr(99, '[Prüfung rot] chore(data): Test', SCHLUESSEL),
  pr(14, '[Prüfung rot] chore(data): Älter', SCHLUESSEL),
  pr(15, '[Prüfung rot] chore(data): Dritter', `${SCHLUESSEL} 2`),
  { number: 17, title: '[Prüfung rot] chore(data): ohne Schlüssel', body: 'von **Sammler Test** (Lauf 3)' },
]
const imFund = (zeile) => `if grep -q '"v":2' data/anisearch.json; then echo "  - ${zeile}"; fi`
const [gruen, rot, ohneListe, zuLang, nichtDa, labelKaputt, leer, ohneFrist, mainGleich, mainNeu, mainAbsturz, mainLangerText, mainMitModulen, ohneFristRot, basisHaengt, mainViele, listeKaputt] = await Promise.all([
  szenario({ befehl: gruenBefehl }),
  szenario({ befehl: rotBefehl, nurFund: true, liste: LISTE }),
  szenario({ befehl: 'echo Absturz-Text; exit 3' }),
  szenario({ befehl: 'sleep 20', frist: 1 }),
  szenario({ befehl: 'dieser-befehl-existiert-nicht' }),
  szenario({ befehl: 'exit 1', labelKaputt: true }),
  szenario({ befehl: 'touch "$MARKE"; exit 1', aenderung: false }),
  szenario({ befehl: 'true', frist: null }),
  szenario({ befehl: 'echo "  - alt"; echo "  - zweite"; exit 1' }),
  szenario({ befehl: `echo "  - alt1"; ${imFund('neu')}; echo "  - alt2"; exit 1` }),
  szenario({ befehl: `if grep -q '"v":2' data/anisearch.json; then echo "  - fund"; exit 1; else echo Absturz-auf-main; exit 3; fi` }),
  szenario({ befehl: `echo "  - tools/a.ts"; ${imFund('tools/a.ts zusätzlich')}; exit 1` }),
  szenario({ befehl: 'if test -e node_modules/marke; then echo "  - A"; else echo "  - B"; fi; exit 1', module: true }),
  szenario({ befehl: 'echo "  - x"; exit 1', frist: null }),
  szenario({ befehl: `if grep -q '"v":2' data/anisearch.json; then echo "  - fund"; exit 1; else sleep 20; fi`, frist: 1 }),
  szenario({ befehl: `for i in $(seq 1 25); do echo "  - alt$i"; done; ${imFund('neu26')}; exit 1` }),
  szenario({ befehl: rotBefehl, nurFund: true, liste: LISTE, listeKaputt: true }),
])
const gruenMitListe = await szenario({ befehl: gruenBefehl, liste: LISTE })

pruefe('Prüfung läuft auf dem Stand, der eingereicht wird, und vor dem Anlegen des Pull Requests', gruen.nachPruefung && gruen.status === 0, gruen.out.slice(-500))
pruefe('grün: Titel ohne Marke, gemergt', gruen.titel === 'chore(data): Test' && /pr merge/.test(gruen.aufrufe) && /gemerged=true/.test(gruen.ausgabe), [gruen.titel, gruen.aufrufe])
pruefe('grün: kein Label', !/label|--add-label/.test(gruen.aufrufe), gruen.aufrufe)

console.log('rot: Pull Request mit Marke, Grund, ohne Merge')
pruefe('rot: der Lauf endet grün, der Pull Request entsteht', rot.status === 0 && /pr=99/.test(rot.ausgabe) && /daten\/77-/.test(rot.zweige), [rot.status, rot.ausgabe, rot.zweige])
pruefe('rot: Titel trägt die Marke', rot.titel === '[Prüfung rot] chore(data): Test', rot.titel)
pruefe('rot: der Text nennt höchstens die ersten 20 roten Prüfungen, nicht das ganze Protokoll', /tools\/p18\.ts/.test(rot.text) && !/tools\/p19\.ts/.test(rot.text) && !/PROTOKOLL-ZEILE/.test(rot.text), rot.text)
pruefe('rot: der Text nennt beide roten Prüfungen und den Befehl', /tools\/a\.ts/.test(rot.text) && /pipeline\/zweite\.ts/.test(rot.text) && /check:logic/.test(rot.text), rot.text)
pruefe('rot: nicht gemergt', !/pr merge/.test(rot.aufrufe) && /gemerged=false/.test(rot.ausgabe) && !/gemerged=true/.test(rot.ausgabe), [rot.aufrufe, rot.ausgabe])
pruefe('rot: Label wird angelegt und gesetzt', /label create pruefung-rot/.test(rot.aufrufe) && /pr edit .* --add-label pruefung-rot/.test(rot.aufrufe), rot.aufrufe)
pruefe('rot: das ganze Protokoll der Prüfung steht im Lauf', /PROTOKOLL-ZEILE/.test(rot.out), rot.out.slice(-300))
pruefe('rot: Warnung im Protokoll', /::warning title=Datenprüfung rot::/.test(rot.out), rot.out.slice(-300))

console.log('main ist selbst rot: nur neue Fehler zählen')
pruefe('main rot aus denselben Gründen: kein Marken-PR, gemergt wie bisher, Warnung', mainGleich.titel === 'chore(data): Test' && /pr merge/.test(mainGleich.aufrufe) && /::warning title=main ist schon rot/.test(mainGleich.out) && !/pr close/.test(mainGleich.aufrufe), [mainGleich.titel, mainGleich.aufrufe])
pruefe('main rot, der Fund bringt einen Fehler mehr: Marke, nur der neue Fehler im Text (Fund mittendrin)', mainNeu.titel.startsWith('[Prüfung rot]') && /- neu/.test(mainNeu.text) && !/- alt/.test(mainNeu.text) && !/pr merge/.test(mainNeu.aufrufe), mainNeu.text)
pruefe('main rot und nicht vergleichbar (main stürzt ab): der Fund bleibt rot', mainAbsturz.titel.startsWith('[Prüfung rot]') && /- fund/.test(mainAbsturz.text) && !/pr merge/.test(mainAbsturz.aufrufe), mainAbsturz.text)
pruefe('Zeile gilt nur bei ganzer Übereinstimmung: eine Fund-Zeile, die mit einer main-Zeile beginnt, ist neu', mainLangerText.titel.startsWith('[Prüfung rot]') && /zusätzlich/.test(mainLangerText.text), mainLangerText.text)
pruefe('main rot mit mehr als 20 Zeilen: ein neuer Fehler hinter Zeile 20 wird noch gefunden', mainViele.titel.startsWith('[Prüfung rot]') && /- neu26/.test(mainViele.text) && !/- alt1\b/.test(mainViele.text), mainViele.text)
pruefe('Vergleichslauf sieht node_modules des Sammlers (verlinkt): gleiche Prüfung, gleiches Ergebnis', mainMitModulen.titel === 'chore(data): Test' && /pr merge/.test(mainMitModulen.aufrufe), [mainMitModulen.titel, mainMitModulen.out.slice(-300)])
pruefe('Vergleichslauf räumt auf: kein Arbeitsbaum bleibt zurück', [mainGleich, mainNeu, mainAbsturz, mainLangerText, rot].every((s) => s.arbeitsbaeume === 1), [mainGleich.arbeitsbaeume, mainNeu.arbeitsbaeume, mainAbsturz.arbeitsbaeume])

console.log('Grenze: je Fund (Workflow, Job, Nachricht) ein roter PR')
pruefe('rot: ältere rote PRs desselben Funds werden geschlossen (12 und 14), der Fund eines anderen Jobs (16, mittendrin) und alle übrigen bleiben', /pr close 12 /.test(rot.aufrufe) && /pr close 14 /.test(rot.aufrufe) && !/pr close (11|13|15|16|17|99)/.test(rot.aufrufe), rot.aufrufe)
pruefe('Text trägt den Fund-Schlüssel als eigene Zeile', rot.text.split('\n').includes(`<!-- fund-schluessel: ${SCHLUESSEL} -->`) && gruen.text.includes(`<!-- fund-schluessel: ${SCHLUESSEL} -->`), rot.text.slice(0, 200))
pruefe('pr list scheitert (auch nach ausgegebener Liste): Lauf grün, PR mit Marke, nichts geschlossen, Warnung im Lauf', listeKaputt.status === 0 && listeKaputt.titel.startsWith('[Prüfung rot]') && /pr=99/.test(listeKaputt.ausgabe) && /gemerged=false/.test(listeKaputt.ausgabe) && !/pr close|pr merge/.test(listeKaputt.aufrufe) && /::warning title=Ältere rote PRs nicht abgelöst::/.test(listeKaputt.out), [listeKaputt.status, listeKaputt.aufrufe, listeKaputt.out.slice(-400)])
pruefe('rot: der Abbau läuft nach dem Anlegen des neuen PR', rot.aufrufe.indexOf('pr create') < rot.aufrufe.indexOf('pr close'), rot.aufrufe)
pruefe('grün: es wird nichts geschlossen, auch wenn rote PRs offen sind', gruenMitListe.status === 0 && !/pr close/.test(gruenMitListe.aufrufe) && /pr merge/.test(gruenMitListe.aufrufe), gruenMitListe.aufrufe)

console.log('rot ohne Liste, Frist, Start')
pruefe('Exit ohne Liste roter Prüfungen: rot, mit Exit-Code und Protokollende im Text', ohneListe.titel.startsWith('[Prüfung rot]') && /Exit 3/.test(ohneListe.text) && /Absturz-Text/.test(ohneListe.text), ohneListe.text)
pruefe('Frist gerissen: rot, der Text nennt die Frist', zuLang.titel.startsWith('[Prüfung rot]') && /länger als 1 s/.test(zuLang.text) && !/pr merge/.test(zuLang.aufrufe), zuLang.text)
pruefe('Prüfung startet nicht (Exit 127): rot statt still grün', nichtDa.titel.startsWith('[Prüfung rot]') && !/pr merge/.test(nichtDa.aufrufe), nichtDa.text)

console.log('Label ist Zugabe, nichts einzureichen heißt nichts prüfen')
pruefe('Label-Fehler ändert nichts: Marke im Titel, kein Merge, Lauf grün', labelKaputt.status === 0 && labelKaputt.titel.startsWith('[Prüfung rot]') && !/pr merge/.test(labelKaputt.aufrufe), [labelKaputt.status, labelKaputt.out.slice(-300)])
pruefe('keine Änderung: weder Prüfung noch Pull Request', !leer.markeDa && leer.aufrufe === '' && /pr=\n/.test(leer.ausgabe), [leer.markeDa, leer.aufrufe, leer.ausgabe])

console.log('Zeitgrenze')
const standard = Number(sh(wurzel, 'source tools/quellen-pruefen.sh; echo $QUELLEN_PRUEFFRIST_STANDARD').out.trim())
/* Untergrenze: Lauf von check:logic (gemessen 17.10.2026: 54 s in der CI, knapp 3 min lokal unter Windows) mit Reserve. Die Obergrenze (Job-Timeouts der
   Einreicher minus der übrige Job) rechnet der Wächter aus den Workflows nach (`pruefeFristen`, tools/sammler-pruefschritt-waechter.test.mjs). */
pruefe('ohne Vorgabe gilt die Standardfrist, mindestens 5 Minuten', ohneFrist.fristArg === String(standard) && standard >= 300, [ohneFrist.fristArg, standard])
const basisFrist = Number(sh(wurzel, 'source tools/quellen-pruefen.sh; echo $QUELLEN_BASISFRIST_STANDARD').out.trim())
pruefe('rot ohne Vorgabe: erst die Standardfrist, dann die Vergleichsfrist (mindestens eine Minute)', ohneFristRot.fristArg === `${standard}\n${basisFrist}` && basisFrist >= 60, [ohneFristRot.fristArg, basisFrist])
pruefe('Vergleich auf main hängt: bricht nach der Frist ab, der Fund bleibt rot, der Lauf endet', basisHaengt.status === 0 && basisHaengt.fristArg === '1\n1' && basisHaengt.titel.startsWith('[Prüfung rot]') && /- fund/.test(basisHaengt.text) && !/pr merge/.test(basisHaengt.aufrufe), [basisHaengt.status, basisHaengt.fristArg, basisHaengt.text])

if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('quellen-pr-pruefung: alle Zusicherungen gehalten.')
