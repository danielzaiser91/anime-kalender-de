#!/usr/bin/env node
/**
 * **Titel zurück auf die Prüfliste — ein Aufruf, alles Weitere macht das Skript.**
 *
 *   node tools/erneut-melden.mjs 99088 20966:primevideo 196144 --grund "Test 4.21.0"
 *   node tools/erneut-melden.mjs --pruefen      (Teil von check:vor-commit)
 *
 * Eingabe ist nur die AniList-Kennung, wahlweise mit Anbieter. Ohne Anbieter kommt der Titel
 * bei jedem Anbieter mit Prüfliste zurück, bei dem er einen Verweis hat (Netflix, Prime, Disney+).
 *
 * Daniel am 22.09.2026: „vereinfach das, sodass du nur an einer stelle sagen musst welche
 * einträge wieder auf die prüfliste sollen, und lass den mechanismus alle abhängigkeiten
 * automatisch machen". Anlass: Drei Testtitel standen in der Erweiterung, aber nicht in der
 * Status-App — die drei Listen waren neu erzeugt, der Prüfstand nicht. Die Kette hat vier
 * Glieder, und wer sie von Hand fährt, vergisst eins:
 *
 *   data/erneut-melden.yaml → extension/offene-{netflix,amazon,disney}.js (+ Standdateien)
 *     → public/data/pruefstand.json (Status-App) → Commit, Push, Deploy
 *
 * Das Skript fährt alle vier, prüft danach, dass jeder neue Eintrag in seiner Liste **und** im
 * Prüfstand steht, und pusht. `--pruefen` hält dieselbe Kette in `check:vor-commit` fest: Wer
 * die YAML-Datei von Hand ändert und die Listen vergisst, bekommt einen roten Lauf statt einer
 * stillen Lücke.
 */
import { readFileSync, appendFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { verdachtsfaelle } from './verdacht.mjs'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const YAML = 'data/erneut-melden.yaml'
const ANBIETER = {
  netflix: { liste: 'extension/offene-netflix.js', erzeuger: 'tools/extension-offene-liste.mjs' },
  primevideo: { liste: 'extension/offene-amazon.js', erzeuger: 'tools/extension-offene-amazon.mjs' },
  disneyplus: { liste: 'extension/offene-disney.js', erzeuger: 'tools/extension-offene-disney.mjs' },
}
/* Alles, was die Kette schreibt — zusammen committet, sonst reißt sie (CLAUDE.md, vierter Fall). */
const DATEIEN = [
  YAML,
  'extension/offene-netflix.js',
  'extension/offene-amazon.js',
  'extension/offene-amazon-stand.js',
  'extension/offene-disney.js',
  'public/data/pruefliste-stand.json',
  'public/data/pruefstand.json',
]

const lies = (p) => readFileSync(resolve(wurzel, p), 'utf8')
const lauf = (befehl) => execSync(befehl, { cwd: wurzel, stdio: 'inherit' })
const roh = JSON.parse(lies('public/data/titles.json'))
const titel = new Map((Array.isArray(roh) ? roh : roh.titles).map((t) => [t.id, t]))
const name = (id) => titel.get(id)?.titleDe ?? titel.get(id)?.titleEn ?? `#${id}`

/** Steht der Titel in der Prüfliste und im Prüfstand seines Anbieters? Leer heißt: ja. */
function luecken(id, plattform) {
  const fehlt = []
  const urls = (titel.get(id)?.streams ?? [])
    .filter((s) => s.platform === plattform)
    .flatMap((s) => [s.url, s.seite].filter(Boolean))
  const liste = lies(ANBIETER[plattform].liste)
  /*
    **Auch unter der Kennung des Anbieters** (24.09.2026). Hat Netflix seine Staffeln einmal
    gemeldet, führt die Liste den Titel mit Netflix' Staffeln — ohne unsere AniList-Kennung, nur
    unter `"80063153"`. Kuroko stand so auf der Liste, und die Prüfung meldete „fehlt", bis jede
    neue Eintragung scheiterte.
  */
  const anbieterKennungen = urls.map((u) => /\/title\/(\d+)/.exec(u)?.[1]).filter(Boolean)
  if (
    !liste.includes(String(id)) &&
    !urls.some((u) => liste.includes(u)) &&
    !anbieterKennungen.some((k) => liste.includes(`"${k}"`))
  )
    fehlt.push(ANBIETER[plattform].liste)
  const stand = JSON.parse(lies('public/data/pruefstand.json')).anbieter.find((a) => a.plattform === plattform)
  if (!(stand?.ziele ?? []).some((z) => urls.includes(z.url))) fehlt.push('public/data/pruefstand.json')
  return fehlt
}

/** Alle offenen Wiedervorlagen aus der YAML-Datei, je Anbieter — dieselbe Funktion wie die Erzeuger. */
function offeneWiedervorlagen() {
  const offen = []
  for (const plattform of Object.keys(ANBIETER))
    for (const [id, v] of verdachtsfaelle(wurzel, plattform)) if (v.wiedervorlage) offen.push({ id, plattform })
  return offen
}

if (process.argv.includes('--pruefen')) {
  let fehler = 0
  for (const { id, plattform } of offeneWiedervorlagen()) {
    const fehlt = luecken(id, plattform)
    if (fehlt.length) {
      fehler++
      console.log(`  FEHL ${name(id)} (${id}, ${plattform}) steht in ${YAML}, fehlt in: ${fehlt.join(', ')}`)
    }
  }
  if (fehler) {
    console.log(`\n${fehler} Wiedervorlage(n) nicht nachgezogen — node tools/erneut-melden.mjs --neu-erzeugen`)
    process.exit(1)
  }
  console.log('Wiedervorlagen: alle offenen stehen in Prüfliste und Prüfstand')
  process.exit(0)
}

function erzeugen() {
  for (const a of Object.values(ANBIETER)) lauf(`node ${a.erzeuger}`)
  lauf('node tools/pruefstand.mjs')
}

const args = process.argv.slice(2)
const grundIdx = args.indexOf('--grund')
const grund = grundIdx >= 0 ? args[grundIdx + 1] : 'erneut melden'
const ohnePush = args.includes('--ohne-push')
const nurNeu = args.includes('--neu-erzeugen')
const kennungen = args.filter((a, i) => !a.startsWith('--') && !(grundIdx >= 0 && i === grundIdx + 1))

const neu = []
for (const k of nurNeu ? [] : kennungen) {
  const [idText, plattform] = k.split(':')
  const id = Number(idText)
  if (!titel.has(id)) throw new Error(`${k}: keine AniList-Kennung im Bestand`)
  const moeglich = [...new Set((titel.get(id).streams ?? []).map((s) => s.platform))].filter((p) => ANBIETER[p])
  const ziele = plattform ? [plattform] : moeglich
  if (!ziele.length) throw new Error(`${name(id)} (${id}): kein Verweis bei Netflix, Prime oder Disney+`)
  for (const p of ziele) {
    if (!moeglich.includes(p)) throw new Error(`${name(id)} (${id}): kein Verweis bei ${p}`)
    neu.push({ id, plattform: p })
  }
}
if (!neu.length && !nurNeu) {
  console.log('Aufruf: node tools/erneut-melden.mjs <anilistId>[:netflix|primevideo|disneyplus] … [--grund "…"] [--ohne-push]')
  process.exit(1)
}

const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
const vorhanden = yaml.load(lies(YAML)) ?? []
const zeilen = neu
  .filter((n) => !vorhanden.some((v) => v.anilistId === n.id && v.platform === n.plattform && v.seit === heute))
  .map((n) => `- { anilistId: ${n.id}, platform: ${n.plattform}, seit: '${heute}', grund: ${JSON.stringify(grund)} }`)
if (zeilen.length) appendFileSync(resolve(wurzel, YAML), zeilen.join('\n') + '\n')

erzeugen()

/*
  **Ein Titel mit Beleg von heute lässt sich erst morgen erneut vorlegen.** Belege tragen nur das
  Datum (`checkedAt: '2026-09-22'`, `fetch-pruefungen.ts`), und eine Wiedervorlage gilt als erfüllt,
  sobald ein Beleg mit `checkedAt >= seit` da ist — der von heute zählt also schon. Gemessen am
  22.09.2026 an Dr. Stone: Stone Wars (113936). Das Skript sagt es, statt still zu scheitern.
*/
const belege = yaml.load(lies('data/dub-confirmed.yaml')) ?? []
let fehlt = 0
for (const n of neu) {
  const l = luecken(n.id, n.plattform)
  if (!l.length) {
    console.log(`  ok   ${name(n.id)} (${n.id}, ${n.plattform})`)
    continue
  }
  fehlt++
  const heuteBelegt = belege.some((b) => b.anilistId === n.id && b.platform === n.plattform && String(b.checkedAt ?? '') >= heute)
  console.log(
    `  FEHL ${name(n.id)} (${n.id}, ${n.plattform}) ` +
      (heuteBelegt ? 'hat schon einen Beleg von heute — erst ab morgen erneut vorlegbar' : `nicht auf der Liste: ${l.join(', ')}`),
  )
}
if (fehlt && zeilen.length) {
  /* Nichts halb stehen lassen: Die YAML-Zeilen und die neu erzeugten Listen zurücknehmen. */
  execSync(`git checkout -q -- ${DATEIEN.join(' ')}`, { cwd: wurzel })
  console.log('Zurückgenommen — nichts geändert.')
}
if (fehlt) process.exit(1)
if (ohnePush) process.exit(0)

lauf('npm run check:vor-commit')
lauf(`git add ${DATEIEN.join(' ')}`)
const nachricht = `Prüfliste: ${neu.map((n) => `${name(n.id)} (${n.plattform})`).join(', ')} erneut melden\n\nGrund: ${grund}. Erzeugt von tools/erneut-melden.mjs.`
execSync('git commit -q -F -', { cwd: wurzel, input: nachricht, stdio: ['pipe', 'inherit', 'inherit'] })
/*
  **Ein Bestandslauf dazwischen ist kein Abbruchgrund** (24.09.2026). Zwischen Erzeugen und Push
  committete ein Lauf neue Listen; das Rebase blieb mit Konflikten in `offene-netflix.js` und
  `pruefstand.json` stehen. Beides ist erzeugt: den Stand des Laufs nehmen, auf ihm neu erzeugen,
  weiter. Nur ein Konflikt in der YAML selbst braucht einen Menschen.
*/
try {
  execSync('git pull -q --rebase --autostash', { cwd: wurzel, stdio: 'inherit' })
} catch {
  const konflikte = execSync('git diff --name-only --diff-filter=U', { cwd: wurzel, encoding: 'utf8' }).split('\n').filter(Boolean)
  if (!konflikte.length || konflikte.includes(YAML) || konflikte.some((d) => !DATEIEN.includes(d))) {
    console.error(`Rebase mit Konflikten in: ${konflikte.join(', ') || '(unbekannt)'} — bitte von Hand lösen.`)
    process.exit(1)
  }
  /* Im Rebase ist „ours" der Stand, auf den gesetzt wird — der des Bestandslaufs. */
  execSync(`git checkout --ours -- ${konflikte.join(' ')}`, { cwd: wurzel })
  erzeugen()
  execSync(`git add ${DATEIEN.join(' ')}`, { cwd: wurzel })
  execSync('git rebase --continue', { cwd: wurzel, stdio: 'inherit', env: { ...process.env, GIT_EDITOR: 'true' } })
  console.log(`Konflikt mit einem Bestandslauf gelöst: ${konflikte.join(', ')} neu erzeugt.`)
}
lauf('git push -q')
console.log('Gepusht — die Status-App zeigt die Titel nach dem Deploy.')
