/**
 * Test zu tools/nacht-merger-wahl.mjs (Auswahlregel), tools/nacht-merger.mjs (Ablauf) und tools/nacht-merger-welt.mjs (gh-Anschluss).
 * Erwartete Werte stehen fest im Test. Der Ablauf läuft mit einer Attrappe-Welt; die Verdrahtung (nachrechnen vor jedem Merge, Riegel,
 * Trockenlauf) prüfen die Fälle über `lauf`, nie über den Quelltext.
 */
import { argumente, lauf } from './nacht-merger.mjs'
import { bauCommittetGerade, bestandIstRot, echteWelt, ghLesend, stufeVon } from './nacht-merger-welt.mjs'
import { freigabe, kandidat, ketteStand, reihenfolge, urteilIstOk, vorabGrund } from './nacht-merger-wahl.mjs'

let fehler = 0
let anzahl = 0
function pruefe(name, ok, info = '') {
  anzahl++
  if (!ok) {
    fehler++
    console.error(`✗ ${name} ${info}`)
  }
}

const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const ALTER_KOPF = '0badc0de0badc0de0badc0de0badc0de0badc0de'
const kurz = (k) => k.slice(0, 9)
const urteil = (kopf, titel, at = '2026-11-01T10:00:00Z', login = 'github-actions') => ({ login, assoc: 'NONE', at, body: `**Prüfer-Review** für ${kurz(kopf)} - Urteil: **${titel}**\n\nProtokoll` })
const nachtrag = (kopf, extra = {}) => ({ login: 'danielzaiser91', assoc: 'OWNER', at: '2026-11-01T11:00:00Z', body: `## Nachtrag (Abnahme Dirigent) — Kopf ${kurz(kopf)}\nAuflagen erfüllt`, ...extra })
const gruen = [
  { __typename: 'CheckRun', name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'Prüfer-Review', status: 'COMPLETED', conclusion: 'SUCCESS' },
]
let zaehler = 100
const pr = (o = {}) => ({
  nummer: ++zaehler,
  titel: `Titel ${zaehler}`,
  beschreibung: '',
  kopf: KOPF,
  zweig: 'fix/etwas',
  entwurf: false,
  offen: true,
  erstellt: '2026-11-01T08:00:00Z',
  reviewDecision: 'APPROVED',
  mergeStateStatus: 'CLEAN',
  geaenderteDateien: 2,
  stufe: 1,
  pfade: ['web/src/a.tsx', 'docs/x.md'],
  checks: gruen,
  kommentare: [urteil(KOPF, 'ok')],
  ...o,
})

// --- urteilIstOk -------------------------------------------------------------------------------------------------
for (const [titel, soll] of [['ok', true], ['ok, Checks laufen noch: x', true], ['ok, Checks-Stand unbekannt', true], ['ok, Checks rot: PR-Prüfkette', false], ['aendern', false], ['aendern, Auflagen offen: Dirigent entscheidet', false], ['okay', false], ['', false]]) {
  pruefe(`Urteil „${titel}“`, urteilIstOk(titel) === soll)
}

// --- freigabe ----------------------------------------------------------------------------------------------------
pruefe('Urteil ok zum Kopf gibt frei', freigabe([urteil(KOPF, 'ok')], KOPF).weg === 'pruefer')
pruefe('Urteil ok zu altem Kopf gibt nicht frei', !freigabe([urteil(ALTER_KOPF, 'ok')], KOPF).frei)
pruefe('Urteil aendern gibt nicht frei', !freigabe([urteil(KOPF, 'aendern')], KOPF).frei)
pruefe('ok, Checks rot gibt nicht frei', !freigabe([urteil(KOPF, 'ok, Checks rot: PR-Prüfkette')], KOPF).frei)
pruefe('ok, Checks laufen noch gibt frei (die Kette prüft der Läufer selbst)', freigabe([urteil(KOPF, 'ok, Checks laufen noch: PR-Prüfkette')], KOPF).frei)
pruefe('ohne jedes Urteil nicht frei', !freigabe([], KOPF).frei)
pruefe('jüngeres aendern nach älterem ok gilt', !freigabe([urteil(KOPF, 'ok', '2026-11-01T09:00:00Z'), urteil(KOPF, 'aendern', '2026-11-01T10:00:00Z')], KOPF).frei)
pruefe('jüngeres ok nach älterem aendern gilt (Reihenfolge der Liste egal)', freigabe([urteil(KOPF, 'ok', '2026-11-01T10:00:00Z'), urteil(KOPF, 'aendern', '2026-11-01T09:00:00Z')], KOPF).frei)
pruefe('gleich lautender Kommentar eines anderen Nutzers zählt nicht', !freigabe([urteil(KOPF, 'ok', '2026-11-01T10:00:00Z', 'jemand-anders')], KOPF).frei)
pruefe('Nachtrag des Inhabers mit Kopf gibt frei, auch nach aendern', freigabe([urteil(KOPF, 'aendern'), nachtrag(KOPF)], KOPF).weg === 'nachtrag')
pruefe('Nachtrag mit altem Kopf gibt nicht frei', !freigabe([urteil(KOPF, 'aendern'), nachtrag(ALTER_KOPF)], KOPF).frei)
pruefe('Nachtrag eines Fremden gibt nicht frei', !freigabe([nachtrag(KOPF, { login: 'jemand-anders', assoc: 'NONE' })], KOPF).frei)
pruefe('Nachtrag ohne Mitgliedschaft OWNER gibt nicht frei', !freigabe([nachtrag(KOPF, { assoc: 'CONTRIBUTOR' })], KOPF).frei)

// --- ketteStand --------------------------------------------------------------------------------------------------
pruefe('Kette grün', ketteStand(gruen).gruen)
pruefe('übersprungener Nebencheck stört nicht', ketteStand([...gruen, { name: 'x', status: 'COMPLETED', conclusion: 'SKIPPED' }]).gruen)
pruefe('Pflicht-Check fehlt', !ketteStand([gruen[1]]).gruen && ketteStand([gruen[1]]).grund.includes('fehlt'))
pruefe('keine Checks', !ketteStand([]).gruen)
pruefe('Pflicht-Check rot', !ketteStand([{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE' }]).gruen)
pruefe('neutraler Nebencheck stört nicht', ketteStand([...gruen, { name: 'x', status: 'COMPLETED', conclusion: 'NEUTRAL' }]).gruen)
pruefe('Nebencheck rot', ketteStand([...gruen, { name: 'Aussehen', status: 'COMPLETED', conclusion: 'FAILURE' }]).grund === 'Check rot: Aussehen')
pruefe('Nebencheck abgebrochen zählt als rot', !ketteStand([...gruen, { name: 'Aussehen', status: 'COMPLETED', conclusion: 'CANCELLED' }]).gruen)
pruefe('Pflicht-Check läuft', ketteStand([{ name: 'PR-Prüfkette', status: 'IN_PROGRESS', conclusion: '' }]).grund === 'Check läuft noch: PR-Prüfkette')
pruefe('Status-Kontext pending: läuft noch, nicht rot', ketteStand([...gruen, { __typename: 'StatusContext', context: 'extern', state: 'PENDING' }]).grund === 'Check läuft noch: extern')
pruefe('Status-Kontext failure: rot mit Namen', ketteStand([...gruen, { __typename: 'StatusContext', context: 'extern', state: 'FAILURE' }]).grund === 'Check rot: extern')
pruefe('Pflicht-Check als Status-Kontext zählt über seinen Namen', ketteStand([{ __typename: 'StatusContext', context: 'PR-Prüfkette', state: 'SUCCESS' }]).gruen)
pruefe('Status-Kontext erfolgreich', ketteStand([...gruen, { __typename: 'StatusContext', context: 'extern', state: 'SUCCESS' }]).gruen)

// --- kandidat ----------------------------------------------------------------------------------------------------
const wahl = (o) => kandidat(pr(o))
pruefe('Basisfall (Stufe 1, grün, ok) ist Kandidat', wahl({}).kandidat)
pruefe('Stufe 0 ist Kandidat', wahl({ stufe: 0 }).kandidat)
pruefe('Stufe 2 nie', !wahl({ stufe: 2 }).kandidat && wahl({ stufe: 2 }).grund.includes('Prüfstufe 2'))
pruefe('Stufe unbekannt nie', !wahl({ stufe: undefined }).kandidat && !wahl({ stufe: '1' }).kandidat)
pruefe('Workflow-Pfad nie', wahl({ pfade: ['web/src/a.tsx', '.github/workflows/x.yml'] }).grund.includes('.github/workflows/x.yml'))
pruefe('Workflow-Pfad als Umbenennungsursprung nie', !wahl({ pfade: ['docs/neu.md', '.github/workflows/alt.yml'] }).kandidat)
pruefe('genau eine geänderte Datei genügt', wahl({ geaenderteDateien: 1 }).kandidat)
pruefe('Ordner mit Workflows als Namensanfang ist erlaubt', wahl({ pfade: ['.github/workflows-alt/a.yml'] }).kandidat)
pruefe('Ordner ähnlich wie Workflows ist erlaubt', wahl({ pfade: ['.github/actions/einreichen/action.yml'] }).kandidat)
pruefe('rote Kette nie', !wahl({ checks: [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE' }] }).kandidat)
pruefe('wartende Kette nie', !wahl({ checks: [{ name: 'PR-Prüfkette', status: 'QUEUED', conclusion: '' }] }).kandidat)
pruefe('Prüfer aendern nie', wahl({ kommentare: [urteil(KOPF, 'aendern')] }).grund.includes('aendern'))
pruefe('Prüfer-Urteil zum alten Kopf nie', !wahl({ kommentare: [urteil(ALTER_KOPF, 'ok')] }).kandidat)
pruefe('aendern, aber Nachtrag zum Kopf: Kandidat', wahl({ kommentare: [urteil(KOPF, 'aendern'), nachtrag(KOPF)] }).weg === 'nachtrag')
pruefe('Entwurf nie', !wahl({ entwurf: true }).kandidat)
pruefe('Daten-PR nie', !wahl({ zweig: 'daten/quellen-1' }).kandidat)
pruefe('geschlossener PR nie', !wahl({ offen: false }).kandidat)
pruefe('leerer PR nie', !wahl({ geaenderteDateien: 0 }).kandidat)
pruefe('ohne Freigabe-Review nie', wahl({ reviewDecision: 'REVIEW_REQUIRED' }).grund.includes('nicht APPROVED'))
pruefe('Änderungswunsch-Review nie', !wahl({ reviewDecision: 'CHANGES_REQUESTED' }).kandidat)
pruefe('Mergestatus BLOCKED nie', wahl({ mergeStateStatus: 'BLOCKED' }).grund.includes('BLOCKED'))
pruefe('Mergestatus DIRTY nie', !wahl({ mergeStateStatus: 'DIRTY' }).kandidat)
pruefe('vorabGrund: Basisfall null', vorabGrund(pr()) === null)

// --- reihenfolge -------------------------------------------------------------------------------------------------
const a = pr({ nummer: 1, erstellt: '2026-11-01T01:00:00Z' })
const b = pr({ nummer: 2, erstellt: '2026-11-01T02:00:00Z', beschreibung: 'Text\nBehebt roten Bestandsbau\nweiter' })
const c = pr({ nummer: 3, erstellt: '2026-11-01T00:30:00Z' })
const nr = (liste) => liste.map((p) => p.nummer).join(',')
pruefe('ohne roten Bau: ältester zuerst', nr(reihenfolge([a, b, c], false)) === '3,1,2')
pruefe('roter Bau: Behebender zuerst, Rest nach Alter', nr(reihenfolge([a, b, c], true)) === '2,3,1')
pruefe('Vorrang-Zeile ohne roten Bau zählt nicht', nr(reihenfolge([b, a], false)) === '1,2')
pruefe('gleiche Zeit: kleinere Nummer zuerst', nr(reihenfolge([pr({ nummer: 9, erstellt: 'x' }), pr({ nummer: 8, erstellt: 'x' })], false)) === '8,9')

// --- lauf (Attrappe-Welt) ----------------------------------------------------------------------------------------
function welt(prs, o = {}) {
  const log = { zeilen: [], aufrufe: [], gemergt: [], details: [] }
  const exits = o.exits ?? {}
  const w = {
    log,
    zeile: (t) => log.zeilen.push(t),
    offene: () => prs,
    details: (p) => {
      log.details.push(p.nummer)
      return p
    },
    kopfVon: (n) => (o.neuerKopf?.[n] ?? prs.find((p) => p.nummer === n).kopf),
    nachrechnen: (n) => {
      log.aufrufe.push(`nachrechnen ${n}`)
      return { exit: exits[n] ?? 0, text: `Exit ${exits[n] ?? 0}` }
    },
    bauCommittet: () => o.bau === true,
    bestandRot: () => o.rot === true,
    merge: (p) => {
      log.aufrufe.push(`merge ${p.nummer}`)
      if (o.mergeFehler === p.nummer) throw new Error('GraphQL: Fehler\nZweite Zeile')
      log.gemergt.push(p.nummer)
    },
  }
  return w
}
const vier = () => [pr({ nummer: 11, erstellt: '2026-11-01T01:00:00Z' }), pr({ nummer: 12, erstellt: '2026-11-01T02:00:00Z' }), pr({ nummer: 13, erstellt: '2026-11-01T03:00:00Z' }), pr({ nummer: 14, erstellt: '2026-11-01T04:00:00Z' })]
{
  const w = welt(vier())
  const r = lauf(w, { hoechstens: 2 })
  pruefe('Riegel: genau zwei Merges', r.gemergt.join(',') === '11,12' && w.log.gemergt.join(',') === '11,12')
  pruefe('Riegel: Rest mit Grund zurückgestellt', w.log.zeilen.filter((z) => z.startsWith('ÜBERSPRUNGEN') && z.includes('Riegel: höchstens 2')).length === 2)
  pruefe('je Merge eine Protokollzeile mit Grund', w.log.zeilen.filter((z) => z.startsWith('GEMERGT #1') && z.includes('Prüfer-Urteil ok zum Kopf')).length === 2)
  pruefe('nachrechnen läuft vor jedem Merge, nicht dahinter', w.log.aufrufe.join(',') === 'nachrechnen 11,merge 11,nachrechnen 12,merge 12')
  pruefe('Schlusszeile zählt', w.log.zeilen.at(-1) === 'Nacht-Merger: 2 gemergt, 0 Fehler, 4 Kandidaten')
}
{
  const w = welt(vier(), { exits: { 11: 1, 12: 2 } })
  const r = lauf(w, { hoechstens: 3 })
  pruefe('nachrechnen Exit 1 oder 2: nicht gemergt, die übrigen kommen dran', r.gemergt.join(',') === '13,14')
  pruefe('Abweisung nennt Exit und Text', w.log.zeilen.some((z) => z.startsWith('ÜBERSPRUNGEN #11') && z.includes('Exit 1')) && w.log.zeilen.some((z) => z.includes('#12') && z.includes('Exit 2')))
}
{
  const w = welt(vier(), { exits: { 11: 3 } })
  pruefe('nachrechnen Exit 3 (unbekannt) nie gemergt', !lauf(w).gemergt.includes(11))
}
{
  const w = welt(vier(), { neuerKopf: { 11: ALTER_KOPF } })
  const r = lauf(w)
  pruefe('Kopf zwischen Auswahl und Merge geändert: übersprungen, nicht nachgerechnet', !r.gemergt.includes(11) && !w.log.aufrufe.includes('nachrechnen 11'))
}
{
  const w = welt(vier(), { bau: true })
  pruefe('Bestandsbau committet gerade: kein Merge', lauf(w).gemergt.length === 0 && w.log.zeilen.some((z) => z.includes('Bestandsbau committet')))
}
{
  const w = welt(vier())
  const r = lauf(w, { trocken: true, hoechstens: 3 })
  pruefe('Trockenlauf: nie merge, aber Protokoll „WÜRDE MERGEN“', w.log.gemergt.length === 0 && !w.log.aufrufe.some((x) => x.startsWith('merge')) && w.log.zeilen.filter((z) => z.startsWith('WÜRDE MERGEN')).length === 3 && r.gemergt.length === 3)
  pruefe('Trockenlauf: Schlusszeile sagt „wären gemergt“', w.log.zeilen.at(-1).includes('3 wären gemergt'))
}
{
  const w = welt(vier(), { mergeFehler: 11 })
  const r = lauf(w)
  pruefe('Merge scheitert: Fehler gezählt, Lauf stoppt, erste Zeile des Fehlers im Protokoll', r.fehler === 1 && r.gemergt.length === 0 && w.log.aufrufe.join(',') === 'nachrechnen 11,merge 11' && w.log.zeilen.some((z) => z === 'MERGE FEHLGESCHLAGEN #11: GraphQL: Fehler'))
}
{
  const p = [
    pr({ nummer: 21, stufe: 2 }),
    pr({ nummer: 22, pfade: ['.github/workflows/y.yml'] }),
    pr({ nummer: 23, kommentare: [urteil(KOPF, 'aendern')] }),
    pr({ nummer: 24, kommentare: [urteil(ALTER_KOPF, 'ok')] }),
    pr({ nummer: 25, checks: [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE' }] }),
    pr({ nummer: 26, entwurf: true }),
    pr({ nummer: 27, reviewDecision: 'CHANGES_REQUESTED' }),
  ]
  const w = welt(p)
  const r = lauf(w)
  pruefe('Stufe 2, Workflow-PR, Prüfer aendern, alter Kopf, rote Kette, Entwurf, Änderungswunsch: nie gemergt, nie nachgerechnet', r.gemergt.length === 0 && w.log.aufrufe.length === 0 && w.log.zeilen.filter((z) => z.startsWith('ÜBERSPRUNGEN')).length === 7)
  pruefe('Entwurf und Änderungswunsch scheitern schon an der Liste: keine weiteren Abrufe', w.log.details.join(',') === '21,22,23,24,25')
}
{
  const p = [pr({ nummer: 31, erstellt: '2026-11-01T01:00:00Z' }), pr({ nummer: 32, erstellt: '2026-11-01T05:00:00Z', beschreibung: 'Behebt roten Bestandsbau' })]
  const rot = welt(p, { rot: true })
  lauf(rot, { hoechstens: 1 })
  pruefe('roter Bestandsbau: der behebende PR geht vor dem älteren', rot.log.gemergt.join(',') === '32')
  const ok = welt(p, { rot: false })
  lauf(ok, { hoechstens: 1 })
  pruefe('Bestandsbau grün: der älteste geht zuerst', ok.log.gemergt.join(',') === '31')
}
{
  // Kreislauf: Lauf 1 mergt A, B ist danach veraltet (Exit 1, Kette startet neu); Lauf 2 (nächste Stunde, Kette neu gerechnet) mergt B.
  const p = [pr({ nummer: 41, erstellt: '2026-11-01T01:00:00Z' }), pr({ nummer: 42, erstellt: '2026-11-01T02:00:00Z' })]
  const w1 = welt(p, { exits: { 42: 1 } })
  const r1 = lauf(w1)
  const w2 = welt(p.filter((x) => x.nummer !== 41), { exits: { 42: 0 } })
  const r2 = lauf(w2)
  pruefe('Kreislauf: Lauf 1 mergt nur A, Lauf 2 danach B', r1.gemergt.join(',') === '41' && r2.gemergt.join(',') === '42')
}

// --- Welt: gh-Anschluss ------------------------------------------------------------------------------------------
pruefe('bauCommittetGerade: Schritt läuft', bauCommittetGerade([{ steps: [{ name: 'Änderungen committen und pushen', status: 'in_progress' }] }]))
pruefe('bauCommittetGerade: Schritt fertig', !bauCommittetGerade([{ steps: [{ name: 'Änderungen committen und pushen', status: 'completed' }] }]))
pruefe('bauCommittetGerade: anderer Schritt läuft', !bauCommittetGerade([{ steps: [{ name: 'Bauen', status: 'in_progress' }] }]))
pruefe('bauCommittetGerade: Job ohne Schritte', !bauCommittetGerade([{}]))
const T = Date.parse('2026-11-01T12:00:00Z')
pruefe('bestandIstRot: rot nach grün', bestandIstRot([{ conclusion: 'success', createdAt: '2026-11-01T08:00:00Z' }, { conclusion: 'failure', createdAt: '2026-11-01T11:59:00Z' }], T))
pruefe('bestandIstRot: grün zuletzt', !bestandIstRot([{ conclusion: 'failure', createdAt: '2026-11-01T07:00:00Z' }, { conclusion: 'success', createdAt: '2026-11-01T11:00:00Z' }], T))
pruefe('stufeVon: Zahl', stufeVon(5, () => '{"stufe":0}') === 0 && stufeVon(5, () => '{"stufe":1}') === 1)
pruefe('stufeVon: Müll, Fehler und Text gelten als 2', stufeVon(5, () => 'kaputt') === 2 && stufeVon(5, () => { throw new Error('x') }) === 2 && stufeVon(5, () => '{"stufe":"1"}') === 2)
{
  const gesehen = []
  const g = ghLesend((a) => { gesehen.push(a.join(' ')); return 'ok' })
  let geworfen = 0
  for (const args of [['pr', 'close', '5'], ['pr', 'reopen', '5']]) {
    try { g(args) } catch { geworfen++ }
  }
  pruefe('ghLesend: close und reopen scheitern, lesen geht durch', geworfen === 2 && gesehen.length === 0 && g(['pr', 'view', '5']) === 'ok')
}
{
  const aufrufe = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    const s = args.join(' ')
    if (s.startsWith('pr list')) return JSON.stringify([{ number: 7, title: 'Titel 7', body: null, headRefOid: KOPF, headRefName: 'fix/a', isDraft: false, createdAt: '2026-11-01T01:00:00Z', reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', changedFiles: 2 }])
    if (s.includes('/files')) return 'web/src/a.tsx\ndocs/alt.md\n'
    if (s.includes('/comments')) return `${JSON.stringify(urteil(KOPF, 'ok'))}\n${JSON.stringify(nachtrag(KOPF))}\n`
    if (s.startsWith('pr view 7 --json statusCheckRollup')) return JSON.stringify(gruen)
    if (s.startsWith('pr view 7 --json headRefOid')) return `${KOPF}\n`
    if (s.startsWith('pr view 7 --json number,state')) return JSON.stringify({ number: 7, state: 'CLOSED', mergeable: 'UNKNOWN', headRefOid: KOPF, headRefName: 'fix/a' })
    return ''
  }
  const ausgaben = []
  const w = echteWelt({ trocken: false, gh, stufeAus: () => '{"stufe":0}', repo: 'o/r', zeileAus: (t) => ausgaben.push(t) })
  const liste = w.offene()
  const voll = w.details(liste[0])
  pruefe('echteWelt: Liste wird abgebildet', liste.length === 1 && liste[0].nummer === 7 && liste[0].beschreibung === '' && liste[0].zweig === 'fix/a' && liste[0].geaenderteDateien === 2)
  pruefe('echteWelt: Dateiliste fragt auch den Umbenennungsursprung', aufrufe.some((s) => s.includes('/pulls/7/files') && s.includes('previous_filename')))
  pruefe('echteWelt: Kommentarliste fragt Nutzer, Verband, Zeit und Text', aufrufe.some((s) => s.includes('/issues/7/comments') && s.includes('login: .user.login, assoc: .author_association, at: .created_at, body: .body')))
  pruefe('echteWelt: Details aus Dateien, Kommentaren, Checks, Stufe', voll.stufe === 0 && voll.pfade.join(',') === 'web/src/a.tsx,docs/alt.md' && voll.kommentare.length === 2 && voll.checks.length === 2)
  pruefe('echteWelt: Auswahlregel nimmt diese Details an', kandidat(voll).kandidat)
  pruefe('echteWelt: kopfVon', w.kopfVon(7) === KOPF)
  const n = w.nachrechnen(7)
  pruefe('echteWelt: nachrechnen liest den PR über dieselbe gh und meldet Exit 2 mit Text', n.exit === 2 && n.text.includes('nicht offen'))
  w.merge(voll)
  const m = aufrufe.at(-1)
  pruefe('echteWelt: merge als Squash mit Kopfbindung, nie --admin, nie --auto', m === `pr merge 7 --squash --subject Titel 7 (#7) --match-head-commit ${KOPF}` && !m.includes('--admin') && !m.includes('--auto'))
  w.zeile('Probezeile')
  pruefe('echteWelt: Zeile geht an die Ausgabe', ausgaben.join('|') === 'Probezeile')
}
{
  // Veralteter PR: nachrechnen würde ihn schließen und öffnen. Im Trockenlauf darf der Aufruf nie bis dorthin kommen.
  const MAIN = 'b'.repeat(40)
  const BASIS = 'c'.repeat(40)
  const veraltet = (aufrufe) => (args) => {
    const s = args.join(' ')
    aufrufe.push(s)
    if (s.startsWith('pr view 7 --json number,state')) return JSON.stringify({ number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/a' })
    if (s.includes('git/ref/heads/main')) return `${MAIN}\n`
    if (s.startsWith('run list')) return JSON.stringify([{ databaseId: 1, headSha: KOPF, createdAt: '2026-11-01T01:00:00Z', conclusion: 'success' }])
    if (s.startsWith('run view 1')) return JSON.stringify({ jobs: [{ name: 'Kette – Workflows', status: 'completed', databaseId: 9 }] })
    if (s.includes('actions/jobs/9/logs')) return `HEAD is now at 1234567 Merge ${KOPF} into ${BASIS}\n`
    if (s.includes('/compare/')) return JSON.stringify({ status: 'diverged', anzahl: 1, dateien: ['web/src/a.tsx'], commitsGesamt: 1, autoren: ['x'] })
    if (s.includes('/pulls/7/files')) return 'web/src/a.tsx\n'
    if (s.includes('--jq .merge_commit_sha')) return 'abcdef\n'
    if (s.includes('/commits/abcdef')) return `${MAIN}\n`
    return ''
  }
  const trockenAufrufe = []
  const trocken = echteWelt({ trocken: true, gh: veraltet(trockenAufrufe), repo: 'o/r', zeileAus: () => {} }).nachrechnen(7)
  pruefe('Trockenlauf: veralteter PR wird nicht geschlossen, Exit 2 mit Hinweis', trocken.exit === 2 && trocken.text.includes('Trockenlauf') && !trockenAufrufe.some((s) => s.startsWith('pr close') || s.startsWith('pr reopen')))
  const echtAufrufe = []
  const echt = echteWelt({ trocken: false, gh: veraltet(echtAufrufe), repo: 'o/r', zeileAus: () => {} }).nachrechnen(7)
  pruefe('Gegenprobe ohne Trockenlauf: derselbe PR wird geschlossen und geöffnet, Exit 1', echt.exit === 1 && echtAufrufe.includes('pr close 7') && echtAufrufe.includes('pr reopen 7'))
}
pruefe('echteWelt: ohne Repo-Angabe Fehler', (() => { try { echteWelt({ trocken: true, gh: () => '', repo: '' }); return false } catch { return true } })())
pruefe('argumente: Vorgabe', JSON.stringify(argumente([])) === '{"trocken":false,"hoechstens":3}')
pruefe('argumente: --trocken und --hoechstens', JSON.stringify(argumente(['--trocken', '--hoechstens', '5'])) === '{"trocken":true,"hoechstens":5}')
pruefe('argumente: ungültig', argumente(['--hoechstens', '0']) === null && argumente(['--hoechstens']) === null && argumente(['--admin']) === null)

if (fehler > 0) {
  console.error(`nacht-merger.test: ${fehler} von ${anzahl} Fällen rot`)
  process.exit(1)
}
console.log(`nacht-merger.test: ${anzahl} Fälle grün (Auswahlregel, Ablauf mit Riegel/Trockenlauf/Kreislauf, gh-Anschluss)`)
