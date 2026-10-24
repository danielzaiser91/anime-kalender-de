/**
 * Schritt „Bestandsprüfungen auf der Bauausgabe“ im Job PR-Datenbau (pr-pruefung.yml, 17.10.2026): fährt jede Prüfung aus
 * `check:bestand` einzeln auf dem gerade gebauten Bestand, ohne Abbruch beim ersten Fehler (die Skripte von `check:bestand` einzeln,
 * `tools/check-bestand-liste.txt` mit `--alle`). Rot wird der Schritt nur, wenn eine Prüfung auch auf der Basis grün ist:
 * Ist auf dem PR-Bau etwas rot, baut der Schritt die Basis (`<basis-ref>`, in der Kette `HEAD^1` = Spitze von main im Merge-Ref)
 * mit demselben Cache in einem eigenen Worktree und fährt dort genau die roten Prüfungen. Was dort auch rot ist, ist geerbt (Warnung).
 * Anlass: Am 17.10. war `check-jw-vertrauen-bestand` auf main rot; ohne Gegenprobe wäre jeder PR daran gescheitert.
 *
 * Aufruf: node tools/pr-bestand-vergleich.mjs <basis-ref>
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const LISTE = 'tools/check-bestand-liste.txt'
/** Kennung für einen roten Listenlauf ohne einzelne Prüfung (Liste unsortiert, Prüfung ändert Dateien): zählt immer als neu. */
const GANZE_LISTE = 'check:bestand-liste'
/** Was der Basis-Worktree vom Arbeitsbaum teilt: Abhängigkeiten und den Cache, auf dem auch der PR gebaut hat. */
const GETEILT = ['node_modules', 'data/cache']

/** Einzelprüfungen von `check:bestand` ohne die Liste (Kette aus `npm run <skript>`, mit `&&` verbunden); gilt auch für die Basis. */
export function restSkripte(pkg) {
  const kette = pkg.scripts?.['check:bestand']
  if (!kette) throw new Error('package.json: check:bestand fehlt')
  return kette
    .split('&&')
    .map((teil) => {
      const m = /^npm run (\S+)$/.exec(teil.trim())
      if (!m) throw new Error(`check:bestand: „${teil.trim()}“ ist kein „npm run <skript>“`)
      return m[1]
    })
    .filter((skript) => skript !== GANZE_LISTE)
}

/** Zeilen der Liste; Kommentare und Leerzeilen stören nicht: sie stehen nie unter den roten, und check-logic-alle überspringt sie. */
function listeDateien(text) {
  return text.split(/\r?\n/)
}

/** Rote Prüfungen aus der Ausgabe von `check-logic-alle.mjs --alle`: „N von M Prüfungen rot:“, darunter je Zeile „  - <datei>“, danach endet der Lauf. */
function roteAusListe(ausgabe) {
  const zeilen = ausgabe.split(/\r?\n/)
  const kopf = zeilen.findIndex((z) => / Prüfungen rot:$/.test(z))
  if (kopf < 0) return []
  return zeilen
    .slice(kopf + 1)
    .map((z) => /^ {2}- (.+)$/.exec(z)?.[1])
    .filter(Boolean)
}

/** Prüfungen eines Stands (Arbeitsbaum oder Basis-Worktree). */
function stand(wurzel) {
  const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8'))
  return {
    rest: restSkripte(pkg),
    liste: listeDateien(readFileSync(join(wurzel, LISTE), 'utf8')),
  }
}

/** `npm` braucht unter Windows die Shell (npm.cmd), dann als eine Zeile; `node` nie (Leerzeichen im Pfad). */
function lauf(befehl, args, cwd) {
  const shell = befehl === 'npm' && process.platform === 'win32'
  return new Promise((fertig) => {
    const kind = shell ? spawn([befehl, ...args].join(' '), { cwd, shell }) : spawn(befehl, args, { cwd })
    let aus = ''
    kind.stdout.on('data', (d) => (aus += d))
    kind.stderr.on('data', (d) => (aus += d))
    kind.on('close', (status) => fertig({ status, aus }))
  })
}

function melde(kennung, ergebnis) {
  console.log(`=== ${kennung}: ${ergebnis.status === 0 ? 'grün' : 'rot'}`)
  process.stdout.write(ergebnis.aus)
}

/** Die Liste läuft über eine Kopie mit genau den gewünschten Zeilen (Reihenfolge der Liste, also weiter sortiert). */
async function roteDerListe(wurzel, dateien) {
  if (dateien.length === 0) return []
  const ordner = mkdtempSync(join(tmpdir(), 'bestand-liste-'))
  const datei = join(ordner, 'liste.txt')
  writeFileSync(datei, `${dateien.join('\n')}\n`)
  const r = await lauf(process.execPath, ['tools/check-logic-alle.mjs', datei, 'check:bestand', '--alle'], wurzel)
  rmSync(ordner, { recursive: true, force: true })
  melde(GANZE_LISTE, r)
  if (r.status === 0) return []
  const rote = roteAusListe(r.aus)
  // Schreibt eine Prüfung ins Repo, meldet der Pool das neben roten Prüfungen nur im Text (tools/arbeiterpool.mjs); das ist nie geerbt.
  const schreibt = r.aus.includes('Der Lauf hat getrackte Dateien verändert')
  return rote.length > 0 && !schreibt ? rote : [...rote, GANZE_LISTE]
}

/** Rote Prüfungen eines Stands: die Rest-Skripte nacheinander, die Liste daneben. */
async function roteImStand(wurzel, { rest, liste }) {
  const listenLauf = roteDerListe(wurzel, liste)
  const rote = []
  for (const skript of rest) {
    const r = await lauf('npm', ['run', skript], wurzel)
    melde(skript, r)
    if (r.status !== 0) rote.push(skript)
  }
  return [...rote, ...(await listenLauf)]
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
}

/** Baut die Basis und fährt dort die auf dem PR roten Prüfungen; Rückgabe: die auch dort roten, `null` wenn der Basisbau scheitert. */
async function roteDerBasis(wurzel, basisRef, prRot) {
  const ort = mkdtempSync(join(tmpdir(), 'bestand-basis-'))
  git(['worktree', 'add', '--detach', ort, basisRef], wurzel)
  const links = []
  try {
    for (const p of GETEILT.filter((g) => existsSync(join(wurzel, g)))) {
      mkdirSync(dirname(join(ort, p)), { recursive: true })
      symlinkSync(join(wurzel, p), join(ort, p), 'junction')
      links.push(join(ort, p))
    }
    const bau = await lauf('npm', ['run', 'data:build'], ort)
    if (bau.status !== 0) {
      console.log(bau.aus)
      return null
    }
    const basis = stand(ort)
    const auswahl = {
      rest: basis.rest.filter((s) => prRot.includes(s)),
      liste: basis.liste.filter((d) => prRot.includes(d)),
    }
    return await roteImStand(ort, auswahl)
  } finally {
    // Erst die Verweise lösen: sonst löscht das Entfernen des Worktrees den Inhalt von node_modules und Cache.
    for (const link of links) unlinkSync(link)
    git(['worktree', 'remove', '--force', ort], wurzel)
  }
}

/** Exit-Code des Schritts: 0, wenn jede rote Prüfung auch auf der Basis rot ist. */
async function vergleiche(wurzel, basisRef) {
  const prRot = await roteImStand(wurzel, stand(wurzel))
  if (prRot.length === 0) {
    console.log('Bestandsprüfungen: alle grün.')
    return 0
  }
  console.log(`Rot auf dem PR-Bau: ${prRot.join(', ')}. Gegenprobe auf der Basis ${basisRef} …`)
  const basisRot = await roteDerBasis(wurzel, basisRef, prRot)
  if (basisRot === null) {
    console.log(`::error::Der Bau der Basis ${basisRef} ist gescheitert; rot auf dem PR-Bau: ${prRot.join(', ')}`)
    return 1
  }
  const geerbt = prRot.filter((k) => basisRot.includes(k))
  const neu = prRot.filter((k) => !geerbt.includes(k))
  for (const k of geerbt) console.log(`::warning::${k} ist schon auf der Basis ${basisRef} rot (nicht diesem PR angelastet)`)
  if (neu.length === 0) return 0
  console.log(`::error::Der gebaute Bestand verletzt Zusicherungen, die auf der Basis grün sind: ${neu.join(', ')}`)
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await vergleiche(process.cwd(), process.argv[2])
