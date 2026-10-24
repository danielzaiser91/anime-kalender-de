import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lesePatchnotesDateien, leseUeberarbeitetBis, mitDatum, PATCHNOTES_ORDNER } from './lib/patchnotes.ts'
import { tageAusGit } from './lib/patchnotes-datum.ts'
import { STEMPEL_PFAD, stempelBefund, umgeschriebeneEintraege } from './lib/patchnotes-stempel-regel.ts'
import { ENTWURF_MAX_TAGE, heuteBerlin, veralteterStempel } from '../tools/patchnotes-stempel-alter.mjs'

/**
 * Stempel „überarbeitet bis“ (`data/patchnotes/_ueberarbeitet-bis.txt`) in der PR-Kette (17.10.2026):
 * Ein PR, der Texte bestehender Einträge umschreibt, hebt ihn mit; er sinkt nie. Die echte Prüfung läuft nur im Ereignis `pull_request`;
 * die Gegenproben und ein Ablauf in einem Wegwerf-Repo (`ereignis`) laufen immer. Dazu die Wache-Warnung (`tools/delta-pruefen.mjs`).
 */
const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

function gelesenAus(basis: string): string | undefined {
  try {
    return git('show', `${basis}:${STEMPEL_PFAD}`).trim()
  } catch {
    return undefined
  }
}

/** Kein Tag aus der Git-Historie (flach, nicht eingecheckt): darf nie als „heute“ durchgehen. */
const KEIN_TAG = '9999-12-31'

function bricheOhneHistorieAb(grund: string): never {
  console.error(`  ✖ Patch-Notes-Stempel: ${grund}. Die Prüfung holt selbst keine Historie (paralleler git fetch → shallow.lock); sie kommt von tools/check-logic-historie.mjs.`)
  process.exit(1)
}

/** Ohne volle Historie und ohne Basis lassen sich Anlagetage nicht bestimmen: laut rot statt „alle heute“. */
function pruefeHistorie(basis: string): void {
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') bricheOhneHistorieAb('Der Checkout ist flach')
  try {
    git('cat-file', '-e', `${basis}^{commit}`)
  } catch {
    bricheOhneHistorieAb(`Die Basis ${basis} fehlt im Checkout`)
  }
}

function ereignis(): void {
  const basis = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8')).pull_request.base.sha as string
  pruefeHistorie(basis)
  const namen = umgeschriebeneEintraege(git('diff', '--name-status', '--no-renames', basis, 'HEAD'))
  const dateien = lesePatchnotesDateien().filter((d) => namen.includes(d.name))
  const tage = mitDatum(dateien, (n) => tageAusGit(PATCHNOTES_ORDNER, n, KEIN_TAG)).map((e) => e.datum as string)
  if (tage.includes(KEIN_TAG)) bricheOhneHistorieAb('Der Anlagetag eines umgeschriebenen Eintrags ist in der Git-Historie nicht lesbar')
  const befund = stempelBefund({ tage, alt: gelesenAus(basis), neu: leseUeberarbeitetBis() })
  if (befund) {
    console.error(`  ✖ Patch-Notes-Stempel: ${befund}`)
    process.exit(1)
  }
  console.log(`  ✓ Patch-Notes-Stempel: ${namen.length} umgeschriebene Einträge, Stempel passt.`)
}

if (process.argv[2] === 'ereignis') {
  ereignis()
  process.exit(0)
}

// Der Weg der PR-Kette (`pr-pruefung.yml`): Ereignisname statt Argument. Der Kindprozess der Verdrahtungsproben überspringt die eigenen Proben.
if (process.env.GITHUB_EVENT_NAME === 'pull_request') ereignis()
if (process.env.STEMPEL_REGEL_OHNE_PROBEN) process.exit(0)

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const status = `M\t${PATCHNOTES_ORDNER}/a.yaml\nA\t${PATCHNOTES_ORDNER}/neu.yaml\nM\t${PATCHNOTES_ORDNER}/b.yaml\nD\t${PATCHNOTES_ORDNER}/weg.yaml\nM\t${STEMPEL_PFAD}\nM\t${PATCHNOTES_ORDNER}/tief/c.yaml\nM\tweb/src/x.ts\n`
pruefe('Diff: nur umgeschriebene Einträge direkt im Ordner, nicht Stempel, neue, gelöschte', umgeschriebeneEintraege(status).join() === 'a,b', umgeschriebeneEintraege(status))
pruefe('Diff: leere Ausgabe ergibt nichts', umgeschriebeneEintraege('').length === 0)

pruefe('Regel: Texte vom 16. umgeschrieben, Stempel bleibt 15 → rot', stempelBefund({ tage: ['2026-10-16'], alt: '2026-10-15', neu: '2026-10-15' }) !== null)
pruefe('Regel: Stempel auf den Tag gehoben → grün', stempelBefund({ tage: ['2026-10-16'], alt: '2026-10-15', neu: '2026-10-16' }) === null)
pruefe('Regel: Stempel über den Tag hinaus gehoben → grün', stempelBefund({ tage: ['2026-10-16'], alt: '2026-10-15', neu: '2026-10-17' }) === null)
pruefe('Regel: maßgeblich ist der jüngste der Tage, in der Mitte der Liste', stempelBefund({ tage: ['2026-10-15', '2026-10-17', '2026-10-16'], alt: '2026-10-15', neu: '2026-10-16' }) !== null)
pruefe('Regel: der jüngste Tag steht am Ende der Liste', stempelBefund({ tage: ['2026-10-14', '2026-10-15', '2026-10-17'], alt: '2026-10-15', neu: '2026-10-16' }) !== null)
pruefe('Regel: Stempel fehlt, Texte umgeschrieben → rot', stempelBefund({ tage: ['2026-10-16'] }) !== null)
pruefe('Regel: Stempel sinkt (15 → 14) auch ohne Texte → rot', stempelBefund({ tage: [], alt: '2026-10-15', neu: '2026-10-14' }) !== null)
pruefe('Regel: Stempel gelöscht (vorher 15), nichts umgeschrieben → rot', stempelBefund({ tage: [], alt: '2026-10-15' }) !== null)
pruefe('Regel: Stempel gleich, nichts umgeschrieben → grün', stempelBefund({ tage: [], alt: '2026-10-15', neu: '2026-10-15' }) === null)
pruefe('Regel: nur der Stempel steigt (16) → grün', stempelBefund({ tage: [], alt: '2026-10-15', neu: '2026-10-16' }) === null)
pruefe('Regel: kein Stempel vorher, keiner nachher, nichts umgeschrieben → grün', stempelBefund({ tage: [] }) === null)

// Wache: Fristgrenze relativ zur Konstante; „heute“ ist ein Berliner Tag.
const vor = (tage: number): string => new Date(Date.parse('2026-10-20T00:00:00Z') - tage * 86400000).toISOString().slice(0, 10)
const entwurf = (datum: string) => ({ datum, entwurf: true })
pruefe('Wache: die Frist beträgt 3 Tage (steht so in karte.md)', ENTWURF_MAX_TAGE === 3, ENTWURF_MAX_TAGE)
pruefe('Wache: Entwurf genau an der Frist → keine Warnung', veralteterStempel([entwurf(vor(ENTWURF_MAX_TAGE))], '2026-10-20') === null)
pruefe('Wache: Entwurf einen Tag über der Frist → Warnung (spätestens dann sichtbar)', veralteterStempel([entwurf(vor(ENTWURF_MAX_TAGE + 1))], '2026-10-20') !== null)
pruefe('Wache: maßgeblich ist der älteste Entwurf, nicht der erste der Liste', veralteterStempel([entwurf(vor(0)), entwurf(vor(ENTWURF_MAX_TAGE + 2)), entwurf(vor(1))], '2026-10-20') !== null)
pruefe('Wache: ein alter Eintrag ohne Entwurf warnt nicht', veralteterStempel([{ datum: vor(30) }, entwurf(vor(1))], '2026-10-20') === null)
pruefe('Wache: ohne Einträge keine Warnung', veralteterStempel([], '2026-10-20') === null)
pruefe('Wache: 00:30 Berlin am 18.10. ist noch UTC 17.10., Berlin zählt den 18.', heuteBerlin(new Date('2026-10-17T22:30:00Z')) === '2026-10-18', heuteBerlin(new Date('2026-10-17T22:30:00Z')))

const wurzel = fileURLToPath(new URL('..', import.meta.url))
const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href

function lauf(cwd: string, skript: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, ['--import', tsx, ...skript], { cwd, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}

function schreibe(ordner: string, pfad: string, inhalt: string): void {
  if (pfad.includes('/')) mkdirSync(`${ordner}/${pfad.slice(0, pfad.lastIndexOf('/'))}`, { recursive: true })
  writeFileSync(`${ordner}/${pfad}`, inhalt)
}

/** Wegwerf-Repo mit drei Einträgen (15./16./17.10.) und Stempel 15; `aenderung` ist der PR-Commit darauf. `ereignisName`: Start wie in der PR-Kette über `GITHUB_EVENT_NAME` (ohne: über das Argument `ereignis`). */
function ereignisLauf(aenderung: (ordner: string) => void, ereignisName?: string, basisMitStempel = true): { status: number | null; aus: string } {
  const ordner = mkdtempSync(`${tmpdir()}/stempel-regel-`)
  const g = (...a: string[]) => execFileSync('git', a, { cwd: ordner, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-17T12:00:00+02:00', GIT_COMMITTER_DATE: '2026-10-17T12:00:00+02:00' } })
  try {
    g('init', '-q')
    g('config', 'user.email', 'x@x')
    g('config', 'user.name', 'x')
    for (const tag of ['15', '16', '17']) schreibe(ordner, `${PATCHNOTES_ORDNER}/e${tag}.yaml`, `datum: '2026-10-${tag}'\nkategorie: bugfix\ntext: Eintrag ${tag}\n`)
    if (basisMitStempel) schreibe(ordner, STEMPEL_PFAD, '2026-10-15\n')
    g('add', '-A')
    g('commit', '-q', '-m', 'basis')
    const basis = g('rev-parse', 'HEAD').toString().trim()
    aenderung(ordner)
    g('add', '-A')
    g('commit', '-q', '--allow-empty', '-m', 'pr')
    schreibe(ordner, '.ereignis.json', JSON.stringify({ pull_request: { base: { sha: basis } } }))
    const pfad = { GITHUB_EVENT_PATH: `${ordner}/.ereignis.json` }
    if (ereignisName === undefined) return lauf(ordner, [fileURLToPath(import.meta.url), 'ereignis'], pfad)
    return lauf(ordner, [fileURLToPath(import.meta.url)], { ...pfad, GITHUB_EVENT_NAME: ereignisName, STEMPEL_REGEL_OHNE_PROBEN: '1' })
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const umschreiben = (tag: string) => (o: string) => schreibe(o, `${PATCHNOTES_ORDNER}/e${tag}.yaml`, `datum: '2026-10-${tag}'\nkategorie: bugfix\ntext: Überarbeitet ${tag}\n`)

const ohneStempel = ereignisLauf(umschreiben('16'))
pruefe('Ablauf: Text vom 16. umgeschrieben, Stempel 15 → Exit 1 mit dem Tag', ohneStempel.status === 1 && ohneStempel.aus.includes('bis 2026-10-16'), ohneStempel)
const mitStempel = ereignisLauf((o) => {
  umschreiben('16')(o)
  schreibe(o, STEMPEL_PFAD, '2026-10-16\n')
})
pruefe('Ablauf: Text vom 16. umgeschrieben, Stempel 16 → Exit 0', mitStempel.status === 0, mitStempel)
const mehrere = ereignisLauf((o) => {
  umschreiben('15')(o)
  umschreiben('17')(o)
  umschreiben('16')(o)
  schreibe(o, STEMPEL_PFAD, '2026-10-16\n')
})
pruefe('Ablauf: Texte vom 15., 16. und 17. umgeschrieben, Stempel 16 → Exit 1 (der 17. fehlt)', mehrere.status === 1 && mehrere.aus.includes('bis 2026-10-17'), mehrere)
const sinkt = ereignisLauf((o) => schreibe(o, STEMPEL_PFAD, '2026-10-14\n'))
pruefe('Ablauf: Stempel sinkt auf 14 → Exit 1', sinkt.status === 1 && sinkt.aus.includes('sinkt'), sinkt)
const loeschen = (o: string) => rmSync(`${o}/${STEMPEL_PFAD}`)
const geloescht = ereignisLauf(loeschen)
pruefe('Ablauf: Stempel gelöscht, keine Texte umgeschrieben → Exit 1', geloescht.status === 1 && geloescht.aus.includes('gelöscht'), geloescht)
const geloeschtUndUmgeschrieben = ereignisLauf((o) => {
  umschreiben('16')(o)
  loeschen(o)
})
pruefe('Ablauf: Stempel gelöscht, Text vom 16. umgeschrieben → Exit 1', geloeschtUndUmgeschrieben.status === 1, geloeschtUndUmgeschrieben)
const nurStempel = ereignisLauf((o) => schreibe(o, STEMPEL_PFAD, '2026-10-16\n'))
pruefe('Ablauf: nur der Stempel steigt → Exit 0', nurStempel.status === 0, nurStempel)
const neuerEintrag = ereignisLauf((o) => schreibe(o, `${PATCHNOTES_ORDNER}/e18.yaml`, "datum: '2026-10-18'\nkategorie: bugfix\ntext: Neu 18\n"))
pruefe('Ablauf: ein neuer Eintrag verlangt keinen Stempel → Exit 0', neuerEintrag.status === 0, neuerEintrag)

const ersterStempel = ereignisLauf((o) => schreibe(o, STEMPEL_PFAD, '2026-10-16\n'), undefined, false)
pruefe('Ablauf: die Basis hat noch keinen Stempel, der PR legt ihn an (16) → Exit 0', ersterStempel.status === 0, ersterStempel)
const keinStempelBleibt = ereignisLauf(umschreiben('16'), undefined, false)
pruefe('Ablauf: die Basis hat keinen Stempel, der PR schreibt den 16. um und legt keinen an → Exit 1', keinStempelBleibt.status === 1, keinStempelBleibt)

// Verdrahtung: so startet die PR-Kette das Skript (`GITHUB_EVENT_NAME=pull_request`, kein Argument). Fehlt die Zeile, ist die Regel dort still weg.
const kette = ereignisLauf(umschreiben('16'), 'pull_request')
pruefe('Verdrahtung: im Ereignis pull_request läuft die Prüfung → Text vom 16. ohne Stempel, Exit 1', kette.status === 1 && kette.aus.includes('bis 2026-10-16'), kette)
const ketteGeloescht = ereignisLauf(loeschen, 'pull_request')
pruefe('Verdrahtung: im Ereignis pull_request, Stempel gelöscht → Exit 1', ketteGeloescht.status === 1 && ketteGeloescht.aus.includes('gelöscht'), ketteGeloescht)
const ketteGruen = ereignisLauf((o) => {
  umschreiben('16')(o)
  schreibe(o, STEMPEL_PFAD, '2026-10-16\n')
}, 'pull_request')
pruefe('Verdrahtung: im Ereignis pull_request, Stempel gehoben → Exit 0 mit Ausgabe der Prüfung', ketteGruen.status === 0 && ketteGruen.aus.includes('Stempel passt'), ketteGruen)
const keinPr = ereignisLauf(umschreiben('16'), 'push')
pruefe('Verdrahtung: in einem anderen Ereignis (push) läuft die Prüfung nicht → Exit 0', keinPr.status === 0 && !keinPr.aus.includes('Stempel'), keinPr)

// Wache im Ablauf: delta-pruefen.mjs in einem Ordner mit der ausgelieferten Liste (oder ohne) und optional einer Lauf-Historie.
function wacheLauf(liste: unknown[] | null, auffaellig = false, mitHistorie = true): { status: number | null; aus: string } {
  const ordner = mkdtempSync(`${tmpdir()}/stempel-wache-`)
  try {
    if (liste) schreibe(ordner, 'public/data/patchnotes.json', JSON.stringify(liste))
    const zeile = { zeitpunkt: '2999-12-31T00:00:00.000Z', lauf: 'x', delta: { titel: 0 }, titel: 1, mitUrteil: 1, ohneUrteil: 0, ...(auffaellig && { auffaellig: ['kaputt'] }) }
    if (mitHistorie) schreibe(ordner, 'data/bestand-historie.jsonl', `${JSON.stringify(zeile)}\n`)
    const r = spawnSync(process.execPath, [`${wurzel}tools/delta-pruefen.mjs`], { cwd: ordner, encoding: 'utf8' })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const alt = (tage: number): string => new Date(Date.parse(`${heuteBerlin()}T00:00:00Z`) - tage * 86400000).toISOString().slice(0, 10)
const lang = [{ datum: alt(ENTWURF_MAX_TAGE + 1), entwurf: true }]
const knapp = [{ datum: alt(ENTWURF_MAX_TAGE), entwurf: true }]
for (const mitHistorie of [true, false]) {
  const wo = mitHistorie ? 'mit Historie' : 'ohne Historie'
  const stehtLange = wacheLauf(lang, false, mitHistorie)
  pruefe(`Wache-Ablauf (${wo}): ein Entwurf über der Frist → Exit 1 mit ⚠`, stehtLange.status === 1 && stehtLange.aus.includes('⚠'), stehtLange)
  const frisch = wacheLauf(knapp, false, mitHistorie)
  pruefe(`Wache-Ablauf (${wo}): ein Entwurf an der Frist → Exit 0 ohne ⚠`, frisch.status === 0 && !frisch.aus.includes('⚠'), frisch)
}
const ohneListe = wacheLauf(null)
pruefe('Wache-Ablauf: ohne ausgelieferte Liste keine Warnung und kein Absturz → Exit 0', ohneListe.status === 0, ohneListe)
const nurHistorie = wacheLauf(knapp, true)
pruefe('Wache-Ablauf: Auffälligkeit in der Historie allein → Exit 1', nurHistorie.status === 1 && nurHistorie.aus.includes('Auffälligkeiten'), nurHistorie)

if (process.env.GITHUB_EVENT_NAME !== 'pull_request') console.log('  – Patch-Notes-Stempel: echte Prüfung nur im PR-Ereignis.')

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
