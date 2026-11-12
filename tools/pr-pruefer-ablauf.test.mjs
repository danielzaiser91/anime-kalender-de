/**
 * Ablauftest für .github/workflows/pr-pruefer.yml: führt die run-Schritte des Jobs bis zur Laufzeitsperre
 * („Prüfer-Eingang prüfen“) wirklich mit bash aus, mit nachgebautem `gh` (tools/pr-pruefer-kulisse.mjs).
 * Erwartet wird, dass die Beschreibung mit Nachträgen und Commit-Liste beim Prüfer ankommt und der Zustand `ok` ist;
 * jede Änderung am Workflow, die das verhindert (PR-Nummer, Repo, Pfade, Schritt-Schlüssel), macht ihn rot.
 * Schlüssel, die er nicht nachbildet (`shell`, `working-directory`, `defaults`, `if` …), sind rot statt übergangen.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { bedingungWahr, laufeBisEingang, prDaten, KOPF } from './pr-pruefer-kulisse.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
// `gh … -q` endet mit Zeilenumbruch, daher drei vor dem Nachträge-Kopf.
const ERWARTET = 'Titel: Titel 7\nZweig: zweig-7\n\nBeschreibung 7\n'
  + '\n\n## Nachträge (gelten als Teil der Beschreibung, spätere gehen vor)\n\n## Nachtrag eins\n\n**Nachtrag zwei'
  + '\n\n## Commits des PR (älteste zuerst, je Commit die geänderten Dateien)'
  + `\n- aaaaaaaaa fix: eins — a.ts\n- bbbbbbbbb refactor: zwei — lib/x.ts\n- ${KOPF.slice(0, 9)} test: drei — a.test.ts`

const gut = laufeBisEingang(wf, { 7: prDaten(7, KOPF), 1: prDaten(1, 'f'.repeat(40)) })
pruefe('Ablauf: alle Schritte bis zur Sperre laufen durch', gut.fehler === undefined, gut.fehler)
pruefe('Ablauf: Beschreibung mit Nachträgen und Commit-Liste kommt beim Prüfer an', gut.beschreibung === ERWARTET, gut.beschreibung)
pruefe('Ablauf: Sperre meldet zustand=ok', gut.ausgaben?.eingang?.zustand === 'ok', gut.ausgaben)
pruefe('Ablauf: Diff-Schritt meldet diff-zustand=ok', gut.ausgaben?.diff?.['diff-zustand'] === 'ok', gut.ausgaben)
// Alle gh-Aufrufe des guten Laufs, in Reihenfolge und Wort für Wort: ein Einschub (auch mit `|| true` oder `&`) ist rot.
const AUFRUFE = [
  'api --method GET repos/o/r/compare/' + 'e'.repeat(40) + '...' + KOPF + ' -f per_page=1 -q .merge_base_commit.sha',
  'api --method GET --paginate repos/o/r/pulls/7/files -f per_page=100 -q .[]',
  'pr view 7 --repo o/r --json title,body,headRefName -q "Titel: " + .title + "\\nZweig: " + .headRefName + "\\n\\n" + .body',
  'api repos/o/r/pulls/7 -q .user.login',
  'api --paginate --slurp repos/o/r/issues/7/comments',
  'api --paginate --slurp repos/o/r/pulls/7/commits',
  'api repos/o/r/commits/' + 'a'.repeat(40),
  'api repos/o/r/commits/' + 'b'.repeat(40),
  'api repos/o/r/commits/' + KOPF,
  'pr diff 7',
  'api repos/o/r/issues/7/comments --paginate -q .[] | select(.body | startswith("<!-- pr-stufe -->")) | .id',
  'pr comment 7 --repo o/r --body-file <datei>',
  // Prüfstufe 2: „Mutationsprobe starten“ liest die Dateiliste des PR (die Attrappe antwortet 404, der Schritt bleibt fail-soft).
  'api --method GET --paginate repos/o/r/pulls/7/files -f per_page=100 -q [.[] | {filename, status}]',
  'api --paginate --slurp repos/o/r/issues/7/comments',
  'api repos/o/r/actions/workflows/pr-pruefung.yml/runs?head_sha=' + KOPF + '&event=pull_request&per_page=30 -q .workflow_runs[] | [.id, .status, (.conclusion // "")] | @tsv',
  'api --paginate repos/o/r/actions/runs/5/jobs?per_page=100 -q .jobs[] | [.id, .name, .status, (.conclusion // "")] | @tsv',
  'api --allow-escape-sequences repos/o/r/actions/jobs/11/logs',
]
pruefe('Ablauf: Kettenlog liegt im Prüfordner, mit Lauf, Jobergebnis und der Logzeile ohne Zeitstempel',
  /abgeschlossen \(success\)/.test(gut.kettenlog ?? '') && /- Kulissen-Job: success/.test(gut.kettenlog ?? '') && /^kulissen-waechter: ok \(3 Fälle\)$/m.test(gut.kettenlog ?? ''), gut.kettenlog)
const aufrufe = (gut.aufrufe ?? []).map((a) => a.replace(/--body-file \S+/, '--body-file <datei>'))
pruefe('Ablauf: gh-Aufrufe genau die erwartete Liste (kein zusätzlicher Aufruf)', JSON.stringify(aufrufe) === JSON.stringify(AUFRUFE), { ist: aufrufe, soll: AUFRUFE })

// Prüfmodus im echten Ablauf: erster bereiter Kopf (Agent-Kommentar „Prüfer: ändern“ des Inhabers, kein CI-Review) -> voll;
// mit CI-Review aus dem Modus voll auf einem früheren Kopf -> Abnahme, Auflagen aus beiden Quellen, vorher = jener Kopf.
pruefe('Prüfmodus: ohne CI-Review voll (Agent-Kommentar allein genügt nicht), frei bei Stufe 2', gut.ausgaben?.modus?.modus === 'voll' && gut.ausgaben?.modus?.['aendern-frei'] === '1' && gut.ausgaben?.modus?.vorher === '', gut.ausgaben?.modus)
const ciR1 = { user: { login: 'github-actions[bot]' }, author_association: 'NONE', body: '**Prüfer-Review** für ' + 'a'.repeat(9) + ' - Urteil: **aendern**\n\nA1 Test fehlt\nA2 Mutation fehlt\n\n<!-- pruefer-modus: voll -->\n' }
const mitCi = prDaten(7, KOPF)
mitCi.kommentare = [[...mitCi.kommentare[0], ciR1], mitCi.kommentare[1]]
const abnahme = laufeBisEingang(wf, { 7: mitCi })
pruefe('Prüfmodus: CI-Review auf früherem Kopf -> abnahme, frei bei Stufe 2, vorher aaaaaaaaa',
  abnahme.ausgaben?.modus?.modus === 'abnahme' && abnahme.ausgaben?.modus?.['aendern-frei'] === '1' && abnahme.ausgaben?.modus?.vorher === 'aaaaaaaaa', abnahme.ausgaben)
pruefe('Prüfmodus: Auflagendatei liegt im Prüfordner mit beiden Quellen (Agent und CI)',
  abnahme.auflagen?.includes('Kommentar des Agent-Prüfers') && abnahme.auflagen?.includes('A2 Mutation fehlt') && abnahme.auflagen?.includes('CI-Review für aaaaaaaaa'), abnahme.auflagen)
pruefe('Prüfmodus: Sperre läuft im Abnahme-Lauf trotzdem durch (zustand=ok)', abnahme.ausgaben?.eingang?.zustand === 'ok', abnahme.ausgaben)
// Nach einem „ok“ gibt es keine Auflagen: neuer Inhalt wird voll geprüft, auch wenn der Inhaber „Prüfer: ändern“ kommentiert hat.
const ciOk = { ...ciR1, body: ciR1.body.replace('**aendern**', '**ok**') }
const nachOk = prDaten(7, KOPF)
nachOk.kommentare = [[...nachOk.kommentare[0], ciOk], nachOk.kommentare[1]]
const nachOkLauf = laufeBisEingang(wf, { 7: nachOk })
pruefe('Prüfmodus: jüngstes CI-Review ist ok (Agent-Kommentar vorhanden) -> voll, Auflagendatei ohne CI-Quelle',
  nachOkLauf.ausgaben?.modus?.modus === 'voll' && nachOkLauf.ausgaben?.modus?.vorher === 'aaaaaaaaa' && !nachOkLauf.auflagen?.includes('CI-Review für'), nachOkLauf.ausgaben)
const dokuDiff = 'diff --git a/docs/a.md b/docs/a.md\n--- a/docs/a.md\n+++ b/docs/a.md\n@@ -1,3 +1,3 @@\n+z0\n+z1\n+z2\n'
const abnahmeStufe0 = laufeBisEingang(wf, { 7: { ...mitCi, diff: dokuDiff } })
pruefe('Prüfmodus: Abnahme bei Prüfstufe 0 (nur Doku) -> nicht frei zum Ändern, Stufe kommt aus dem Stufen-Schritt',
  abnahmeStufe0.ausgaben?.stufe?.stufe === '0' && abnahmeStufe0.ausgaben?.modus?.modus === 'abnahme' && abnahmeStufe0.ausgaben?.modus?.['aendern-frei'] === '0', abnahmeStufe0.ausgaben)
const ohneApi = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), kommentare: undefined } })
pruefe('Prüfmodus: Kommentar-Abruf scheitert -> voll, nicht frei (Schritt bricht den Lauf nicht ab)',
  ohneApi.ausgaben?.modus?.modus === 'voll' && ohneApi.ausgaben?.modus?.['aendern-frei'] === '0', ohneApi.ausgaben ?? ohneApi.fehler)

// Die Sperre greift: fehlt die Commit-Liste (API scheitert), ist der Zustand nicht ok, obwohl der Diff vollständig ist.
const ohneCommits = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), commits: undefined } })
pruefe('Sperre: Commit-Liste fehlt -> zustand=unvollstaendig bei diff-zustand=ok',
  ohneCommits.ausgaben?.diff?.['diff-zustand'] === 'ok' && ohneCommits.ausgaben?.eingang?.zustand === 'unvollstaendig', ohneCommits.ausgaben)
// Fällt nur die Kommentar-API aus, fehlen die Nachträge: auch das darf nicht als vollständig gelten.
const ohneKommentare = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), kommentare: undefined } })
pruefe('Sperre: Kommentare fehlen (Commits da) -> zustand=unvollstaendig bei diff-zustand=ok',
  ohneKommentare.ausgaben?.diff?.['diff-zustand'] === 'ok' && ohneKommentare.ausgaben?.eingang?.zustand === 'unvollstaendig', ohneKommentare.ausgaben)
pruefe('Sperre: Kommentare fehlen -> Commit-Liste ist trotzdem da', ohneKommentare.beschreibung?.includes('- ' + KOPF.slice(0, 9) + ' test: drei'), ohneKommentare.beschreibung)
// Kurzer API-Aussetzer (12.11.2026, PRs 3579/3584: Autor-Abruf lieferte keinen JSON-Text, Nachträge und Commit-Liste fehlten):
// der Abruf wird wiederholt, der Zustand bleibt ok. Pause 0, damit der Test nicht wartet.
process.env.PRUEFER_WDH_PAUSE = '0'
const LOGIN = 'api repos/o/r/pulls/7 -q .user.login'
const DATEIEN = 'api --method GET --paginate repos/o/r/pulls/7/files -f per_page=100 -q .[]'
const anzahl = (lauf, aufruf) => (lauf.aufrufe ?? []).filter((a) => a === aufruf).length
const loginEinmal = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 1 } } })
pruefe('Wiederholung: Autor-Abruf scheitert einmal -> zweiter Versuch, Nachträge und Commit-Liste da, zustand=ok',
  loginEinmal.beschreibung === ERWARTET && loginEinmal.ausgaben?.eingang?.zustand === 'ok' && anzahl(loginEinmal, LOGIN) === 2, { n: anzahl(loginEinmal, LOGIN), fehler: loginEinmal.fehler })
const loginZweimal = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 2 } } })
pruefe('Wiederholung: Autor-Abruf scheitert zweimal -> dritter Versuch genügt',
  loginZweimal.ausgaben?.eingang?.zustand === 'ok' && anzahl(loginZweimal, LOGIN) === 3, { n: anzahl(loginZweimal, LOGIN), fehler: loginZweimal.fehler })
const loginDauer = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 99 } } })
pruefe('Wiederholung: Autor-Abruf scheitert immer -> nach drei Versuchen unvollstaendig (nie ok)',
  loginDauer.ausgaben?.diff?.['diff-zustand'] === 'ok' && loginDauer.ausgaben?.eingang?.zustand === 'unvollstaendig' && anzahl(loginDauer, LOGIN) === 3, { n: anzahl(loginDauer, LOGIN), a: loginDauer.ausgaben })
const dateienEinmal = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { dateien: 1 } } })
pruefe('Wiederholung: Dateiliste scheitert einmal -> zweiter Versuch, diff-zustand=ok, Beschreibung unverändert',
  dateienEinmal.ausgaben?.diff?.['diff-zustand'] === 'ok' && anzahl(dateienEinmal, DATEIEN) === 2 && dateienEinmal.beschreibung === ERWARTET, { n: anzahl(dateienEinmal, DATEIEN), fehler: dateienEinmal.fehler })
const dateienDauer = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { dateien: 99 } } })
pruefe('Wiederholung: Dateiliste scheitert immer -> diff-zustand=unvollstaendig nach drei Versuchen',
  dateienDauer.ausgaben?.diff?.['diff-zustand'] === 'unvollstaendig' && anzahl(dateienDauer, DATEIEN) === 3, { n: anzahl(dateienDauer, DATEIEN), a: dateienDauer.ausgaben })
// Falsche PR-Nummer liefert eine vollständige Liste eines anderen PR: nur der Abgleich mit dem Kopf fängt das.
const fremderKopf = laufeBisEingang(wf, { 7: prDaten(7, 'f'.repeat(40)) })
pruefe('Sperre: Liste endet nicht am Kopf -> zustand=unvollstaendig',
  fremderKopf.ausgaben?.diff?.['diff-zustand'] === 'ok' && fremderKopf.ausgaben?.eingang?.zustand === 'unvollstaendig', fremderKopf.ausgaben)

// Sperre, Freigabe-env und -run deckt der Schnappschuss (pr-pruefer-freigabe.test.mjs) ab; hier bleibt der Prompt-Text.
const schritte = wf.jobs.pruefen.steps
const pruefer = schritte.filter((s) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
pruefe('Drei Prüfer-Schritte (Stufe 0, voll, Abnahme)', pruefer.length === 3, pruefer.map((s) => s.name))
// Abnahme-Modus (21.10.2026): jeder Kopf läuft durch genau einen der drei Prüfer; der Modus-Schritt steht vor der Sperre.
const bedingung = (name) => String(pruefer.find((s) => s.name === name)?.if ?? '')
pruefe('Stufe 0 läuft nur außerhalb der Abnahme', bedingung('Prüfer (Stufe 0, schlank)') === "steps.stufe.outputs.stufe == '0' && steps.modus.outputs.modus != 'abnahme'", bedingung('Prüfer (Stufe 0, schlank)'))
pruefe('Voller Prüfer läuft nur außerhalb der Abnahme', bedingung('Prüfer') === "steps.stufe.outputs.stufe != '0' && steps.modus.outputs.modus != 'abnahme'", bedingung('Prüfer'))
pruefe('Abnahme-Prüfer läuft nur im Abnahme-Modus', bedingung('Prüfer (Abnahme)') === "steps.modus.outputs.modus == 'abnahme'", bedingung('Prüfer (Abnahme)'))
const indexVon = (id) => schritte.findIndex((s) => s.id === id)
pruefe('Reihenfolge: Prüfstufe, Prüfmodus, Sperre, dann die Prüfer', indexVon('stufe') < indexVon('modus') && indexVon('modus') < indexVon('eingang') && indexVon('eingang') < schritte.indexOf(pruefer[0]))
const abnahmePrompt = String(pruefer.find((s) => s.name === 'Prüfer (Abnahme)')?.with?.prompt ?? '')
pruefe('Abnahme-Prompt: Auflagenliste, keine neuen Funde, Regression nur mit Commit',
  ['auflagen.md', 'Keine neuen Funde', 'Regression', 'nur die offenen Auflagen', 'Teilweise erfüllt zählt als nein', 'Du hast nur den Gesamtdiff pr.diff', 'der die Datei berührt'].every((t) => abnahmePrompt.includes(t)))
const abnahmeWerkzeuge = String(pruefer.find((s) => s.name === 'Prüfer (Abnahme)')?.with?.claude_args ?? '')
pruefe('Abnahme-Prüfer liest nur den Prüfordner (kein Repo, kein Grep)', !/Read\(\.\/|Grep|Glob/.test(abnahmeWerkzeuge) && abnahmeWerkzeuge.includes('Read(/${{ runner.temp }}/pruefer/**)'), abnahmeWerkzeuge)
for (const s of pruefer) {
  pruefe(`${s.name}: Prompt liest den Zustand der Sperre, alles außer "ok" ist unvollständig`,
    String(s.with?.prompt ?? '').includes('Diff-Zustand: ${{ steps.eingang.outputs.zustand }}. Lautet er nicht "ok",'))
}
const voll = String(pruefer.find((s) => s.name === 'Prüfer')?.with?.prompt ?? '')
pruefe('Voller Prüfer: Vorgabe Folgeläufe, übersprungene Tests, inhaltlicher Abgleich je Ziel',
  ['Folgeläufe', 'leere oder gelöschte Eingabedatei', 'übersprungen wird, belegt dort nichts', 'je Ziel einen inhaltlichen Abgleich'].every((t) => voll.includes(t)))
const leserDiffZustand = schritte.filter((s) => JSON.stringify(s).includes('steps.diff.outputs.diff-zustand'))
pruefe('diff-zustand liest nur noch die Sperre', leserDiffZustand.length === 1 && leserDiffZustand[0].id === 'eingang')

// Mutationsprobe bei Stufe 2 (12.11.2026): Start vor dem Prüfmodus, Abwarten nach dem Kettenlog und vor dem ersten Prüfer.
const schrittNamen = schritte.map((s) => s.name)
const start = schritte.find((s) => s.name === 'Mutationsprobe starten')
const abwarten = schritte.find((s) => s.name === 'Mutationsprobe abwarten')
pruefe('Mutationsprobe: beide Schritte nur bei Prüfstufe 2', start?.if === "steps.stufe.outputs.stufe == '2'" && abwarten?.if === "steps.stufe.outputs.stufe == '2'", [start?.if, abwarten?.if])
pruefe('Mutationsprobe: Start nach der Prüfstufe, Abwarten nach dem Kettenlog und vor dem ersten Prüfer',
  schrittNamen.indexOf('Mutationsprobe starten') > schrittNamen.indexOf('Prüfstufe') && schrittNamen.indexOf('Mutationsprobe abwarten') > schrittNamen.indexOf('Kettenlog bereitlegen') && schrittNamen.indexOf('Mutationsprobe abwarten') < schrittNamen.indexOf('Prüfer-Eingang prüfen'), schrittNamen)
pruefe('Mutationsprobe: Start und Abwarten rufen das Skript auf, fail-soft ohne Exit 1',
  /^node tools\/mutationsprobe-pr\.mjs start "\$PR" "\$HEAD_SHA" "\$ZWEIG" "\$RUNNER_TEMP\/pruefer" \|\| echo /.test(start?.run ?? '') && /^node tools\/mutationsprobe-pr\.mjs warte "\$RUNNER_TEMP\/pruefer" \|\| echo /.test(abwarten?.run ?? ''), [start?.run, abwarten?.run])
pruefe('Mutationsprobe: voller Prüfer und Abnahme-Prüfer lesen die Ergebnisdatei', voll.includes('/pruefer/mutationsprobe.txt') && abnahmePrompt.includes('/pruefer/mutationsprobe.txt'))
pruefe('Mutationsprobe: actions: write steht nur im Kopf der Datei, kein Job und kein Schritt setzt eigene Rechte', wf.permissions.actions === 'write' && wf.jobs.pruefen.permissions === undefined)
const wahr = (w, a) => bedingungWahr(w, a)
pruefe('Kulisse: Bedingung wahr, falsch, fremde Form', wahr("steps.stufe.outputs.stufe == '2'", { stufe: { stufe: '2' } }) === true && wahr("steps.stufe.outputs.stufe == '2'", { stufe: { stufe: '1' } }) === false && wahr("steps.stufe.outputs.stufe == '2'", {}) === false && wahr('always()', {}) === null)

if (fehler.length) {
  console.error(`pr-pruefer-ablauf.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-ablauf.test: grün')
