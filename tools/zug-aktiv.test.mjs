/**
 * Tests für den Zug-Schalter (tools/zug-aktiv.mjs) und seine Leser pr-nachrechnen.mjs und liegegut.mjs (Sammelzug P3, 09.11.2026).
 * Erwartung je Leser: Schalter aus = Verhalten wie vor P3 (gh-Aufrufe byte-gleich), Schalter an + Basis `zug` = neuer Weg.
 * Erwartete Werte stehen fest hier, nicht aus den Modulen.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { liegegut, liegegutAlleFunde, liegegutFunde, naechsterSchritt, stapelKandidat } from './liegegut.mjs'
import { nachrechnen } from './pr-nachrechnen.mjs'
import { SCHALTER_DATEI, istZugPr, leseZugAktiv } from './zug-aktiv.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const hier = path.dirname(fileURLToPath(import.meta.url))
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'zug-aktiv-'))
const datei = (inhalt) => {
  const p = path.join(wurzel, `s${fs.readdirSync(wurzel).length}.json`)
  if (inhalt !== null) fs.writeFileSync(p, inhalt)
  return p
}

console.log('Schalter lesen: nur ein gültiges { "aktiv": true } schaltet an')
pruefe('aktiv true -> an', leseZugAktiv(datei('{"aktiv": true}')) === true)
pruefe('aktiv false -> aus', leseZugAktiv(datei('{"aktiv": false}')) === false)
pruefe('Datei fehlt -> aus', leseZugAktiv(datei(null)) === false)
pruefe('leere Datei -> aus', leseZugAktiv(datei('')) === false)
pruefe('kaputtes JSON -> aus', leseZugAktiv(datei('{"aktiv": tru')) === false)
pruefe('Zeichenkette "true" -> aus', leseZugAktiv(datei('{"aktiv": "true"}')) === false)
pruefe('Zahl 1 -> aus', leseZugAktiv(datei('{"aktiv": 1}')) === false)
pruefe('Feld fehlt -> aus', leseZugAktiv(datei('{}')) === false)
pruefe('JSON null -> aus', leseZugAktiv(datei('null')) === false)
const eingechecktJson = JSON.parse(fs.readFileSync(path.join(hier, 'zug-aktiv.json'), 'utf8'))
pruefe('eingecheckter Schalter steht auf aus (bis nach P2c)', eingechecktJson.aktiv === false && leseZugAktiv() === false, eingechecktJson)
pruefe('Standard-Schalterdatei ist die eingecheckte tools/zug-aktiv.json', path.resolve(SCHALTER_DATEI) === path.join(hier, 'zug-aktiv.json') && fs.existsSync(SCHALTER_DATEI), SCHALTER_DATEI)
const exit = () => spawnSync(process.execPath, [path.join(hier, 'zug-aktiv.mjs')], { encoding: 'utf8', timeout: 20000, windowsHide: true, env: { ...process.env } }).status
pruefe('CLI mit eingechecktem Schalter: Exit 1 (aus)', exit() === 1)

console.log('istZugPr: Basis und Schalter, beides nötig')
pruefe('Schalter an + Basis zug', istZugPr({ baseRefName: 'zug' }, true))
pruefe('Schalter aus + Basis zug', !istZugPr({ baseRefName: 'zug' }, false))
pruefe('Schalter an + Basis main', !istZugPr({ baseRefName: 'main' }, true))
pruefe('Schalter an + keine Basis', !istZugPr({}, true))
pruefe('Schalter undefiniert (nicht true) + Basis zug', !istZugPr({ baseRefName: 'zug' }, undefined))
pruefe('Schalter nur truthy (1, "ja") + Basis zug -> kein Zug-PR', !istZugPr({ baseRefName: 'zug' }, 1) && !istZugPr({ baseRefName: 'zug' }, 'ja'))

console.log('pr-nachrechnen: Basis zug')
const FELDER_ALT = 'number,state,mergeable,headRefOid,headRefName,comments,commits'
const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const zugPr = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x', baseRefName: 'zug' }
function lauf(aktiv, prJson) {
  const aufrufe = []
  const meldungen = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify(prJson)
    if (args[0] === 'pr' && args[1] === 'list') return '[]'
    throw new Error('STOPP nach pr view')
  }
  let code
  let wurf = null
  try {
    code = nachrechnen(7, gh, (t) => meldungen.push(t), () => {}, undefined, undefined, undefined, aktiv)
  } catch (e) {
    wurf = e.message
  }
  return { aufrufe, meldungen, code, wurf }
}
{
  const aus = lauf(false, zugPr)
  pruefe('aus: pr view mit den alten Feldern, ohne baseRefName', aus.aufrufe[0] === `pr view 7 --json ${FELDER_ALT}`, aus.aufrufe)
  pruefe('aus: PR mit Basis zug läuft wie vorher weiter (nächster Aufruf = Kettenläufe lesen)', aus.wurf !== null && aus.aufrufe[2]?.startsWith('run list --workflow pr-pruefung.yml'), aus)
  const an = lauf(true, zugPr)
  pruefe('an: pr view fragt zusätzlich baseRefName', an.aufrufe[0] === `pr view 7 --json ${FELDER_ALT},baseRefName`, an.aufrufe)
  pruefe('an + Basis zug: Exit 0, keine weiteren Aufrufe, Meldung nennt zug', an.code === 0 && an.aufrufe.length === 2 && /Basis zug, kein Nachrechnen/.test(an.meldungen.join()), an)
  const main = lauf(true, { ...zugPr, baseRefName: 'main' })
  pruefe('an + Basis main: weiter wie vorher (Kettenläufe lesen)', main.aufrufe[2]?.startsWith('run list --workflow pr-pruefung.yml'), main.aufrufe)
  const konflikt = lauf(true, { ...zugPr, mergeable: 'CONFLICTING' })
  pruefe('an + Basis zug + Konflikt: Hindernis geht vor (Exit 2)', konflikt.code === 2 && /Konflikt/.test(konflikt.meldungen.join()), konflikt)
  const zu = lauf(true, { ...zugPr, state: 'CLOSED' })
  pruefe('an + Basis zug + geschlossen: Hindernis geht vor (Exit 2)', zu.code === 2, zu)
}

console.log('liegegut: Zug-PR einordnen')
pruefe('stapelKandidat: Basis zug, Schalter aus -> Kandidat wie vorher', stapelKandidat({ baseRefName: 'zug', mergeable: 'MERGEABLE' }) === true)
pruefe('stapelKandidat: Basis zug, Schalter an -> kein Stapel', stapelKandidat({ baseRefName: 'zug', mergeable: 'MERGEABLE' }, true) === false)
pruefe('stapelKandidat: Basis feature, Schalter an -> bleibt Stapel', stapelKandidat({ baseRefName: 'feature/x', mergeable: 'MERGEABLE' }, true) === true)
pruefe('stapelKandidat: Basis zug + Konflikt + „erst nach #5“, Schalter an -> kein Stapel', stapelKandidat({ baseRefName: 'zug', mergeable: 'CONFLICTING', body: 'erst nach #5' }, true) === false)
pruefe('naechsterSchritt: Signal 1 im Zug -> Zug-Reihe, sonst MERGEN', naechsterSchritt([1], [], false, true) === 'AUF ZUG MERGEN (merge-reihe-zug.sh)' && naechsterSchritt([1], [], false) === 'MERGEN')
pruefe('naechsterSchritt: Zug ändert Nachbessern nicht', naechsterSchritt([4], [], false, true) === 'NACHBESSERN')
pruefe('naechsterSchritt: Zug ändert Überholt/Daniel nicht', naechsterSchritt([1, 3], [{}], false, true) === 'ÜBERHOLT?' && naechsterSchritt([1, 6], [], false, true) === 'DANIEL')

const JETZT = Date.parse('2026-11-09T12:00:00Z')
const h = (stunden) => new Date(JETZT - stunden * 3600 * 1000).toISOString()
const bot = { author: { login: 'github-actions' }, createdAt: h(20), body: `**Prüfer-Review** für ${KOPF.slice(0, 9)} - Urteil: **ok**\n\nText` }
const leicht = (nummer, basis) => ({ number: nummer, title: `fix(x): ${nummer}`, headRefOid: KOPF, createdAt: h(40), mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', isDraft: false, body: '', baseRefName: basis })
const gruen = [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: h(30) }]
function ghAttrappe(basis, gemergteBasis) {
  return (args) => {
    const a = args.join(' ')
    if (a.includes('--json number,title,headRefOid')) return JSON.stringify([leicht(7, basis)])
    if (a.includes('--json number,reviews,statusCheckRollup')) return JSON.stringify([{ number: 7, reviews: [], statusCheckRollup: gruen }])
    if (a.includes('--json number,comments')) return JSON.stringify([{ number: 7, comments: [bot] }])
    if (args[0] === 'api' && args[1] === 'graphql') return `${KOPF} ${h(30)}\n`
    if (a.startsWith('pr list --state merged --head')) return JSON.stringify(gemergteBasis)
    if (a.includes('/pulls/7/files')) return ''
    throw new Error(`unerwarteter gh-Aufruf: ${a}`)
  }
}
const zeilen = (basis, gemergt, aktiv) => liegegutFunde(ghAttrappe(basis, gemergt), () => '', JETZT, () => {}, new Set(), aktiv).map((f) => f.zeile)
{
  const ohneSchalter = liegegutFunde(ghAttrappe('zug', []), () => '', JETZT, () => {}, new Set()).map((f) => f.zeile)
  pruefe('ohne Schalter-Argument gilt der eingecheckte Schalter (aus): MERGEN wie vorher', ohneSchalter.length === 1 && /^anime-kalender-de PR 7: MERGEN – /.test(ohneSchalter[0]), ohneSchalter)
  const aus = zeilen('zug', [], false)
  pruefe('aus: PR auf zug, freigegeben und ruhend -> MERGEN wie vorher', aus.length === 1 && /^anime-kalender-de PR 7: MERGEN – Signal 1 Freigabe/.test(aus[0]), aus)
  const an = zeilen('zug', [], true)
  pruefe('an: PR auf zug -> Zug-Reihe statt Merge-Reihe', an.length === 1 && /^anime-kalender-de PR 7: AUF ZUG MERGEN \(merge-reihe-zug\.sh\) – Signal 1 Freigabe/.test(an[0]), an)
  const main = zeilen('main', [], true)
  pruefe('an: PR auf main bleibt MERGEN', main.length === 1 && /^anime-kalender-de PR 7: MERGEN – /.test(main[0]), main)
  const stapelAus = zeilen('zug', [{ number: 5 }], false)
  pruefe('aus: Basis zug mit gemergtem „Basis-PR“ -> Stapel-Signal 9 wie vorher', /Signal [^–]*9 Basis #5/.test(stapelAus[0]) && /^anime-kalender-de PR 7: STAPEL/.test(stapelAus[0]), stapelAus)
  const stapelAn = zeilen('zug', [{ number: 5 }], true)
  pruefe('an: Basis zug löst nie Stapel-Signal 9 aus', !/Basis #5/.test(stapelAn[0]) && /^anime-kalender-de PR 7: AUF ZUG MERGEN/.test(stapelAn[0]), stapelAn)
  const ueberWrapper = liegegut(ghAttrappe('zug', []), () => '', JETZT, () => {}, new Set(), true)
  pruefe('liegegut() reicht den Schalter durch (Zug-Reihe in der Textzeile)', ueberWrapper.length === 1 && /AUF ZUG MERGEN/.test(ueberWrapper[0]), ueberWrapper)
  // Zug-Logik gilt nur im Haupt-Repo: gleiche Nummer 7 mit Basis zug in beiden Repos, Schalter an.
  const beide = liegegutAlleFunde(ghAttrappe('zug', []), () => '', JETZT, () => {}, new Set(), true).map((f) => f.zeile)
  pruefe('an: Haupt-PR 7 trägt den Zug-Schritt, nativ-PR 7 nicht', beide.length === 2 && /^anime-kalender-de PR 7: AUF ZUG MERGEN/.test(beide[0]) && /^anime-kalender-nativ PR 7: MERGEN – Signal 1/.test(beide[1]), beide)
  const feature = zeilen('feature/x', [{ number: 5 }], true)
  pruefe('an: andere Stapel-Basis löst Signal 9 weiter aus', /^anime-kalender-de PR 7: STAPEL/.test(feature[0]), feature)
}

fs.rmSync(wurzel, { recursive: true, force: true })
if (fehler.length > 0) {
  console.error(`zug-aktiv.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('zug-aktiv.test: alle Fälle grün')
