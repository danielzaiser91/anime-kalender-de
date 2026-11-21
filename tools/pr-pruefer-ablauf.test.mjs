/**
 * Ablauftest für .github/workflows/pr-pruefer.yml: führt die run-Schritte des Jobs bis zur Laufzeitsperre
 * („Prüfer-Eingang prüfen“) wirklich mit bash aus, mit nachgebautem `gh` (tools/pr-pruefer-kulisse.mjs).
 * Erwartet wird, dass die Beschreibung mit Nachträgen und Commit-Liste beim Prüfer ankommt und der Zustand `ok` ist;
 * jede Änderung am Workflow, die das verhindert (PR-Nummer, Repo, Pfade, Schritt-Schlüssel), macht ihn rot.
 * Schlüssel, die er nicht nachbildet (`shell`, `working-directory`, `defaults`, `if` …), sind rot statt übergangen.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { bedingungWahr, laufeBisEingang, laufeProbeJob, prDaten, KOPF } from './pr-pruefer-kulisse.mjs'

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
  'api rate_limit',
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
// Kontingent erschöpft: der Wiederholungsweg fragt den Reset ab (`api rate_limit`, zusätzlich zur Anfangszeile) und gelingt danach;
// ein Fehler anderer Art tut das nicht (loginEinmal: nur die Anfangszeile).
const limitText = 'HTTP 403: API rate limit exceeded for installation'
const loginLimit = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 1 }, ausfallText: limitText } })
pruefe('Rate limit: Autor-Abruf scheitert mit „rate limit“ -> Reset abgefragt, zweiter Versuch, zustand=ok',
  loginLimit.ausgaben?.eingang?.zustand === 'ok' && anzahl(loginLimit, LOGIN) === 2 && anzahl(loginLimit, 'api rate_limit') === 2, { n: anzahl(loginLimit, LOGIN), r: anzahl(loginLimit, 'api rate_limit'), fehler: loginLimit.fehler })
pruefe('Rate limit: Fehler anderer Art fragt den Reset nicht ab', anzahl(loginEinmal, 'api rate_limit') === 1, anzahl(loginEinmal, 'api rate_limit'))
// Reset jenseits des Zeitkontos (Jahr 2100): ein Versuch, kein Warten, kein zweiter und dritter Versuch; der Zustand ist unvollstaendig, nie ok.
const loginFern = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 99 }, ausfallText: limitText, reset: 4_102_444_800 } })
pruefe('Rate limit, Reset jenseits des Zeitkontos: Autor-Abruf nur einmal (kein sinnloses Wiederholen), zustand=unvollstaendig',
  anzahl(loginFern, LOGIN) === 1 && loginFern.ausgaben?.eingang?.zustand === 'unvollstaendig', { n: anzahl(loginFern, LOGIN), a: loginFern.ausgaben, fehler: loginFern.fehler })
// Dauer-Limit mit baldigem Reset (hier längst vorbei): drei Versuche, zwei Warteplätze dazwischen (Anfangszeile + 2 Resetabfragen), nach dem
// dritten Fehlschlag keine weitere Abfrage und kein Warten mehr.
const loginDauerLimit = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { login: 99 }, ausfallText: limitText } })
pruefe('Rate limit, Reset bald: Autor-Abruf dreimal, Reset genau zweimal abgefragt (nicht nach dem letzten Fehlschlag), zustand=unvollstaendig',
  anzahl(loginDauerLimit, LOGIN) === 3 && anzahl(loginDauerLimit, 'api rate_limit') === 3 && loginDauerLimit.ausgaben?.eingang?.zustand === 'unvollstaendig', { n: anzahl(loginDauerLimit, LOGIN), r: anzahl(loginDauerLimit, 'api rate_limit'), fehler: loginDauerLimit.fehler })
// Merge-Basis (compare) und Ansicht des PR (pr view) sind geschützt wie die Wiederholungs-Abrufe: ein Limit kostet keinen Git-Rückfall und keinen Lauf.
const COMPARE = AUFRUFE[1]
const ANSICHT = AUFRUFE[3]
const compareLimit = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { compare: 1 }, ausfallText: limitText } })
pruefe('Rate limit beim compare: Reset abgefragt, zweiter Versuch, zustand=ok',
  anzahl(compareLimit, COMPARE) === 2 && anzahl(compareLimit, 'api rate_limit') === 2 && compareLimit.ausgaben?.eingang?.zustand === 'ok', { c: anzahl(compareLimit, COMPARE), r: anzahl(compareLimit, 'api rate_limit'), fehler: compareLimit.fehler })
const meldungen = (lauf) => lauf.fehlerausgabe?.['Diff bereitlegen'] ?? ''
pruefe('compare scheitert (404 der Kulisse): die Ursache steht im Log und der verlorene Git-Rückfall wird genannt',
  meldungen(laufeBisEingang(wf, { 7: prDaten(7, KOPF) })).includes('HTTP 404: api --method GET repos/o/r/compare/') && meldungen(laufeBisEingang(wf, { 7: prDaten(7, KOPF) })).includes('Merge-Basis nicht lesbar: kein Git-Rückfall'), meldungen(laufeBisEingang(wf, { 7: prDaten(7, KOPF) })))
pruefe('compare mit „rate limit“: die Ursache (erster Fehlertext) steht im Log', meldungen(compareLimit).includes('API rate limit exceeded for installation'), meldungen(compareLimit))
const compareAnders = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { compare: 1 } } })
pruefe('Fehler anderer Art beim compare: kein Reset abgefragt, ein Versuch', anzahl(compareAnders, COMPARE) === 1 && anzahl(compareAnders, 'api rate_limit') === 1, { c: anzahl(compareAnders, COMPARE), r: anzahl(compareAnders, 'api rate_limit') })
const ansichtLimit = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { view: 1 }, ausfallText: limitText } })
pruefe('Rate limit bei der Ansicht des PR: Reset abgefragt, zweiter Versuch, Beschreibung und zustand=ok',
  anzahl(ansichtLimit, ANSICHT) === 2 && anzahl(ansichtLimit, 'api rate_limit') === 2 && ansichtLimit.beschreibung === ERWARTET && ansichtLimit.ausgaben?.eingang?.zustand === 'ok', { n: anzahl(ansichtLimit, ANSICHT), fehler: ansichtLimit.fehler })
const ansichtAnders = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { view: 1 } } })
// Bei einem Schrittfehler liefert die Kulisse keine Aufrufliste: der erste Fehlertext (stderr von gh) genügt, ein Neuversuch hätte den Schritt gerettet.
pruefe('Fehler anderer Art bei der Ansicht des PR: Schritt scheitert mit dem Fehlertext von gh (wie bisher, kein Neuversuch)', /invalid character 'S'/.test(ansichtAnders.fehler ?? ''), ansichtAnders.fehler)
// Die Werkzeuge der Schritte (Node-Prozesse gegen dieselbe Kulisse) und die Schritte „Prüfstufe“ und „Prüfmodus“ sind im selben Lauf geschützt:
// ein einmaliges „rate limit“ ändert das Ergebnis nicht (Stufe, Nachträge, Modus, Kettenlog), und der Abruf kommt genau zweimal.
const zaehle = (lauf, praefix) => (lauf.aufrufe ?? []).filter((a) => a.startsWith(praefix)).length
const mitLimitEinmal = (pr, name, extra = {}) => laufeBisEingang(wf, { 7: { ...pr, ausfaelle: { [name]: 1 }, ausfallText: limitText, ...extra } })
const stufeLimit = mitLimitEinmal({ ...prDaten(7, KOPF), diff: dokuDiff }, 'diff')
pruefe('Rate limit bei `gh pr diff` (pr-stufe): Stufe bleibt 0 (nicht der Rückfall 2), der Abruf kommt zweimal',
  stufeLimit.ausgaben?.stufe?.stufe === '0' && zaehle(stufeLimit, 'pr diff 7') === 2, { stufe: stufeLimit.ausgaben?.stufe, n: zaehle(stufeLimit, 'pr diff 7'), fehler: stufeLimit.fehler })
const stufeKommentar = mitLimitEinmal(prDaten(7, KOPF), 'kommentar')
pruefe('Rate limit beim Stufen-Kommentar (Prüfstufe): zweiter Versuch, Reset abgefragt, Schritt läuft durch',
  zaehle(stufeKommentar, 'pr comment 7') === 2 && anzahl(stufeKommentar, 'api rate_limit') === 2 && stufeKommentar.ausgaben?.eingang?.zustand === 'ok', { n: zaehle(stufeKommentar, 'pr comment 7'), fehler: stufeKommentar.fehler })
const stufeListe = mitLimitEinmal(prDaten(7, KOPF), 'kommentare')
pruefe('Rate limit bei der Kommentarliste (Prüfstufe): zweiter Versuch und danach genau ein Kommentar angelegt',
  zaehle(stufeListe, 'api repos/o/r/issues/7/comments --paginate') === 2 && zaehle(stufeListe, 'pr comment 7') === 1, { n: zaehle(stufeListe, 'api repos/o/r/issues/7/comments --paginate'), fehler: stufeListe.fehler })
const nachtraegeLimit = mitLimitEinmal(prDaten(7, KOPF), 'slurp')
pruefe('Rate limit beim ersten Kommentar-Abruf (pr-nachtraege): Nachträge und Commit-Liste trotzdem in der Beschreibung, zustand=ok',
  nachtraegeLimit.beschreibung === ERWARTET && nachtraegeLimit.ausgaben?.eingang?.zustand === 'ok', { b: nachtraegeLimit.beschreibung, fehler: nachtraegeLimit.fehler })
const modusLimit = mitLimitEinmal(mitCi, 'slurp', { ausfallErst: { slurp: 1 } })
pruefe('Rate limit beim Kommentar-Abruf des Prüfmodus (pr-pruefer-modus, zweiter Aufruf): Modus bleibt abnahme (nicht der Rückfall voll)',
  modusLimit.ausgaben?.modus?.modus === 'abnahme' && zaehle(modusLimit, 'api --paginate --slurp repos/o/r/issues/7/comments') === 3, { modus: modusLimit.ausgaben?.modus, n: zaehle(modusLimit, 'api --paginate --slurp repos/o/r/issues/7/comments'), fehler: modusLimit.fehler })
const kettenlogLimit = mitLimitEinmal(prDaten(7, KOPF), 'kettenlog')
pruefe('Rate limit beim Lauf-Abruf des Kettenlogs (pr-kettenlog): Kettenlog trotzdem vollständig',
  /- Kulissen-Job: success/.test(kettenlogLimit.kettenlog ?? ''), { kettenlog: kettenlogLimit.kettenlog, fehler: kettenlogLimit.fehler })
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
// Seit 20.11.2026 (Mod-Schnellweg) entfällt jeder Modellschritt bei `nur-mod == '1'`; tools/pr-pruefer-nur-mod.test.mjs prüft die Freigabe ohne Modell.
pruefe('Stufe 0 läuft nur außerhalb der Abnahme', bedingung('Prüfer (Stufe 0, schlank)') === "steps.kette.outputs.laeuft != 'ja' && steps.stufe.outputs.stufe == '0' && steps.stufe.outputs.nur-mod != '1' && steps.modus.outputs.modus != 'abnahme'", bedingung('Prüfer (Stufe 0, schlank)'))
pruefe('Voller Prüfer läuft nur außerhalb der Abnahme', bedingung('Prüfer') === "steps.kette.outputs.laeuft != 'ja' && steps.stufe.outputs.stufe != '0' && steps.stufe.outputs.nur-mod != '1' && steps.modus.outputs.modus != 'abnahme'", bedingung('Prüfer'))
pruefe('Abnahme-Prüfer läuft nur im Abnahme-Modus', bedingung('Prüfer (Abnahme)') === "steps.kette.outputs.laeuft != 'ja' && steps.stufe.outputs.nur-mod != '1' && steps.modus.outputs.modus == 'abnahme'", bedingung('Prüfer (Abnahme)'))
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
pruefe('diff-zustand lesen nur die Sperre und das Einlesen der Mutationsprobe (A7c)', leserDiffZustand.map((s) => s.id ?? s.name).join() === 'Mutationsprobe einlesen,eingang', leserDiffZustand.map((s) => s.id ?? s.name))

// Mutationsprobe bei Stufe 2 (12.11.2026, PR 3591 R1): eigener Job `mutationsprobe` mit dem Schreibrecht, Ergebnis als Artefakt in `pruefen`.
const probe = wf.jobs.mutationsprobe
const wirksam = (job) => ({ ...wf.permissions, ...(job.permissions ?? {}) })
pruefe('A1: pruefen hat nur actions: read (Kopf der Datei), ohne eigene Rechte', wf.permissions.actions === 'read' && wf.jobs.pruefen.permissions === undefined && wirksam(wf.jobs.pruefen).actions === 'read', wirksam(wf.jobs.pruefen))
pruefe('A1: nur der Job mutationsprobe hat actions: write, genau contents/pull-requests: read dazu',
  Object.entries(wf.jobs).filter(([, j]) => wirksam(j).actions === 'write').map(([n]) => n).join() === 'mutationsprobe'
  && JSON.stringify(probe.permissions) === JSON.stringify({ contents: 'read', 'pull-requests': 'read', actions: 'write' }), probe.permissions)
pruefe('A1: der Schreib-Job hat keinen Claude-Schritt und holt nie einen Zweig (Checkout ohne ref)',
  !probe.steps.some((s) => String(s.uses ?? '').startsWith('anthropics/')) && probe.steps.filter((s) => String(s.uses ?? '').startsWith('actions/checkout')).every((s) => s.with?.ref === undefined && s.with?.repository === undefined))
pruefe('A1: pruefen wartet auf uebernahme und mutationsprobe und läuft auch, wenn die Probe fehlschlägt (!cancelled())', JSON.stringify(wf.jobs.pruefen.needs) === '["uebernahme","mutationsprobe"]' && String(wf.jobs.pruefen.if).startsWith('!cancelled() &&') && !String(probe.if).includes('cancelled'), [wf.jobs.pruefen.needs, wf.jobs.pruefen.if])
pruefe('A1: beide Jobs gelten für dieselben PR (gleiche Bedingung bis auf !cancelled())', String(wf.jobs.pruefen.if).replace('!cancelled() &&', '').trim() === String(probe.if).trim())
// Übernahme (21.11.2026): `uebernommen=1` überspringt Probe und Review; der Job gilt für dieselben PR wie beide, ohne actions-Recht und ohne Claude.
const ueb = wf.jobs.uebernahme
const ohneUeb = (t) => String(t).replace("needs.uebernahme.outputs.uebernommen != '1' &&", '').trim()
pruefe('Übernahme: Probe und Review hängen an uebernommen != 1', probe.needs === 'uebernahme' && String(probe.if).startsWith("needs.uebernahme.outputs.uebernommen != '1' &&") && String(wf.jobs.pruefen.if).includes("needs.uebernahme.outputs.uebernommen != '1' &&"), [probe.needs, probe.if])
pruefe('Übernahme: gleiche PR-Bedingung wie die Probe', String(ueb.if).trim() === ohneUeb(probe.if), ueb.if)
pruefe('Übernahme: nur contents read und pull-requests write, kein Claude-Schritt, Checkout ohne ref',
  JSON.stringify(ueb.permissions) === JSON.stringify({ contents: 'read', 'pull-requests': 'write' })
  && !ueb.steps.some((s) => String(s.uses ?? '').startsWith('anthropics/'))
  && ueb.steps.filter((s) => String(s.uses ?? '').startsWith('actions/checkout')).every((s) => s.with?.ref === undefined && s.with?.repository === undefined), ueb.permissions)
const uebSchritt = ueb.steps.find((s) => s.id === 'uebernahme')
pruefe('Übernahme: Job-Ausgabe kommt aus dem Schritt, der das Werkzeug fährt',
  ueb.outputs?.uebernommen === '${{ steps.uebernahme.outputs.uebernommen }}' && uebSchritt?.run === 'node tools/pr-pruefer-uebernahme.mjs'
  && uebSchritt.env?.HEAD_SHA === '${{ github.event.pull_request.head.sha }}' && uebSchritt.env?.PR === '${{ github.event.pull_request.number }}', [ueb.outputs, uebSchritt])
// A4: Kettenbudget. `pruefen` beginnt erst nach dem Probe-Job, sein eigenes Budget (60 min, Rechnung samt Zeitkonto für „rate limit“ in pr-pruefer-eingabe.test.mjs) bleibt; der Probe-Job braucht Frist 8 min + Checkout/Stufe/Upload (~2 min) unter seinem Timeout.
pruefe('A4: Probe-Job-Timeout deckt die 8-min-Frist plus 2 min Vor- und Nachlauf, ohne ein Stunden-Job zu werden', probe['timeout-minutes'] >= 8 + 2 && probe['timeout-minutes'] <= 15 && wf.jobs.pruefen['timeout-minutes'] === 60, [probe['timeout-minutes'], wf.jobs.pruefen['timeout-minutes']])
const pNamen = probe.steps.map((s) => s.name ?? s.uses)
pruefe('Probe-Job: Checkout, Prüfstufe, starten, abwarten, Ergebnis weitergeben (in dieser Reihenfolge)', JSON.stringify(pNamen) === JSON.stringify(['actions/checkout@v4', 'Prüfstufe', 'Mutationsprobe starten', 'Mutationsprobe abwarten', 'Ergebnis weitergeben']), pNamen)
const pStart = probe.steps.find((s) => s.name === 'Mutationsprobe starten')
const pWarte = probe.steps.find((s) => s.name === 'Mutationsprobe abwarten')
const pUpload = probe.steps.find((s) => s.name === 'Ergebnis weitergeben')
pruefe('Probe-Job: starten, abwarten und weitergeben nur bei Prüfstufe 2', [pStart, pWarte, pUpload].every((s) => s?.if === "steps.stufe.outputs.stufe == '2'"), [pStart?.if, pWarte?.if, pUpload?.if])
pruefe('Probe-Job: starten und abwarten rufen das Skript auf, fail-soft ohne Exit 1',
  /^node tools\/mutationsprobe-pr\.mjs start "\$PR" "\$HEAD_SHA" "\$ZWEIG" "\$RUNNER_TEMP\/pruefer" \|\| echo "[^"]+"$/.test(pStart?.run ?? '') && /^node tools\/mutationsprobe-pr\.mjs warte "\$RUNNER_TEMP\/pruefer" \|\| echo "[^"]+"$/.test(pWarte?.run ?? ''), [pStart?.run, pWarte?.run])
const einlesen = schritte.find((s) => s.name === 'Mutationsprobe einlesen')
const schrittNamen = schritte.map((s) => s.name)
pruefe('A7c: Einlesen nur bei Prüfstufe 2 und vollständigem Diff, fail-soft, gleicher Artefaktname wie der Upload',
  einlesen?.if === "steps.stufe.outputs.stufe == '2' && steps.diff.outputs.diff-zustand == 'ok'" && einlesen['continue-on-error'] === true && einlesen.with?.name === pUpload?.with?.name && einlesen.with?.path === '${{ runner.temp }}/pruefer' && pUpload?.with?.path === '${{ runner.temp }}/pruefer/mutationsprobe.txt', [einlesen, pUpload?.with])
pruefe('Einlesen: nach dem Kettenlog und vor der Sperre', schrittNamen.indexOf('Mutationsprobe einlesen') > schrittNamen.indexOf('Kettenlog bereitlegen') && schrittNamen.indexOf('Mutationsprobe einlesen') < schrittNamen.indexOf('Prüfer-Eingang prüfen'), schrittNamen)
pruefe('Mutationsprobe: voller Prüfer und Abnahme-Prüfer lesen die Ergebnisdatei', voll.includes('/pruefer/mutationsprobe.txt') && abnahmePrompt.includes('/pruefer/mutationsprobe.txt'))
const wahr = (w, a) => bedingungWahr(w, a)
pruefe('Kulisse: Bedingung wahr, falsch, fremde Form', wahr("steps.stufe.outputs.stufe == '2'", { stufe: { stufe: '2' } }) === true && wahr("steps.stufe.outputs.stufe == '2'", { stufe: { stufe: '1' } }) === false && wahr("steps.stufe.outputs.stufe == '2'", {}) === false && wahr('always()', {}) === null)
const beide = { stufe: { stufe: '2' }, diff: { 'diff-zustand': 'ok' } }
const UND = "steps.stufe.outputs.stufe == '2' && steps.diff.outputs.diff-zustand == 'ok'"
pruefe('Kulisse: Bedingung mit &&, jedes Glied zählt, fremdes Glied ist null',
  wahr(UND, beide) === true && wahr(UND, { ...beide, stufe: { stufe: '0' } }) === false && wahr(UND, { ...beide, diff: { 'diff-zustand': 'unvollstaendig' } }) === false && wahr(UND + ' && always()', beide) === null)

// Der Probe-Job wirklich ausgeführt (A6): Liste im PR, Dispatch am Kopf, Lauf gefunden, Tabelle geholt, Datei hochgeladen.
const LISTE = 'tools/mutationen/eins.json'
const TITEL = `Mutationsprobe ${LISTE} @ ${KOPF}`
const listeMit = JSON.stringify([{ name: 'a', tests: ['t'], aenderungen: [{ datei: 'x', suche: 'a', ersetze: 'b' }] }])
const mitListe = () => ({
  ...prDaten(7, KOPF),
  dateien: [{ filename: LISTE, status: 'added' }, { filename: 'a.ts', status: 'modified' }],
  inhalte: { [LISTE]: listeMit },
  // Der alte, fertige Lauf (grün) mit gleichem Titel darf nie als Antwort zählen (A3); createdAt 2000 bzw. 2999: unabhängig von der Uhr.
  laeufe: [
    { databaseId: 98, displayTitle: TITEL, status: 'completed', conclusion: 'success', createdAt: '2000-01-01T00:00:00Z', url: 'u98' },
    { databaseId: 99, displayTitle: TITEL, status: 'completed', conclusion: 'failure', createdAt: '2999-12-31T00:00:00Z', url: 'u99' },
  ],
  tabellen: { 99: '| Mutant | Ergebnis |\n| m1 | GRÜN |' },
})
const ohneZiel = (l) => (l.aufrufe ?? []).map((a) => a.replace(/-D \S+/, '-D <ziel>'))
const AUFRUFE_PROBE = [
  'pr diff 7',
  'api --method GET --paginate repos/o/r/pulls/7/files -f per_page=100 -q [.[] | {filename, status}]',
  `api -H Accept: application/vnd.github.raw repos/o/r/contents/${LISTE}?ref=${KOPF}`,
  `workflow run mutationsprobe.yml --repo o/r --ref main -f zweig=zweig-7 -f kopf=${KOPF} -f liste=${LISTE}`,
  'run list --repo o/r --workflow mutationsprobe.yml --limit 60 --json databaseId,displayTitle,status,conclusion,createdAt,url',
  'run download 99 --repo o/r -n mutation-ergebnis -D <ziel>',
]
process.env.MUTATIONSPROBE_PAUSE_MS = '0'
const pl = laufeProbeJob(wf, { 7: mitListe() })
pruefe('Probe-Job: alle Schritte laufen durch', pl.fehler === undefined, pl.fehler)
pruefe('Probe-Job: gh-Aufrufe genau die erwartete Liste (Dateiliste, Liste am Kopf, Dispatch ohne pr=, Läufe, Ergebnis des neuen Laufs)', JSON.stringify(ohneZiel(pl)) === JSON.stringify(AUFRUFE_PROBE), ohneZiel(pl))
pruefe('Probe-Job: mutationsprobe.txt nennt Kopf und den neuen, roten Lauf mit Tabelle, nie den alten grünen',
  pl.mutationsprobe?.includes(`Mutationsprobe zum Kopf ${KOPF}`) && pl.mutationsprobe.includes(`- ${LISTE}: Lauf failure`) && pl.mutationsprobe.includes('| m1 | GRÜN |') && !pl.mutationsprobe.includes('alle Mutanten rot'), pl.mutationsprobe)
pruefe('Probe-Job: Artefakt mutationsprobe mit genau dieser Datei hochgeladen', pl.hochgeladen?.name === 'mutationsprobe' && pl.hochgeladen.inhalt === pl.mutationsprobe && pl.hochgeladen.ohneDatei === 'ignore', pl.hochgeladen)
pruefe('Probe-Job: starten und abwarten laufen bei Stufe 2', Object.keys(pl.protokoll ?? {}).join() === 'Prüfstufe,Mutationsprobe starten,Mutationsprobe abwarten', pl.protokoll)
const dokuProbe = laufeProbeJob(wf, { 7: { ...mitListe(), diff: dokuDiff } })
pruefe('Probe-Job: Prüfstufe 0 -> nichts gestartet, nichts gewartet, nichts hochgeladen',
  dokuProbe.ausgaben?.stufe?.stufe === '0' && JSON.stringify(ohneZiel(dokuProbe)) === JSON.stringify(['pr diff 7']) && Object.keys(dokuProbe.protokoll).join() === 'Prüfstufe' && dokuProbe.hochgeladen === undefined && dokuProbe.mutationsprobe === null, [dokuProbe.ausgaben, dokuProbe.aufrufe])
// A7a im Ablauf: ein Aussetzer der Dateiliste wird wiederholt; fällt sie dreimal aus, steht der Fehler in der Datei (nicht „keine Liste“).
const einAussetzer = laufeProbeJob(wf, { 7: { ...mitListe(), ausfaelle: { liste: 1 } } })
pruefe('Probe-Job: Dateiliste scheitert einmal -> zweiter Versuch, Dispatch trotzdem', (einAussetzer.aufrufe ?? []).filter((a) => a.includes('/pulls/7/files')).length === 2 && (einAussetzer.aufrufe ?? []).some((a) => a.startsWith('workflow run')), einAussetzer.aufrufe)
const dateiListenZeiten = (l) => (l.aufrufe ?? []).map((a, i) => [a, l.zeiten?.[i]]).filter(([a]) => a.includes('/pulls/7/files')).map(([, z]) => z)
pruefe('Probe-Job: die Pause zwischen den Versuchen kommt aus MUTATIONSPROBE_PAUSE_MS (0), nicht aus dem Standard von 5 s',
  dateiListenZeiten(einAussetzer).length === 2 && dateiListenZeiten(einAussetzer)[1] - dateiListenZeiten(einAussetzer)[0] < 2500, dateiListenZeiten(einAussetzer))
const dauerAus = laufeProbeJob(wf, { 7: { ...mitListe(), ausfaelle: { liste: 99 } } })
pruefe('Probe-Job: Dateiliste scheitert immer -> drei Versuche, kein Dispatch, Fehler sichtbar in der Datei',
  (dauerAus.aufrufe ?? []).filter((a) => a.includes('/pulls/7/files')).length === 3 && !(dauerAus.aufrufe ?? []).some((a) => a.startsWith('workflow run')) && /Dateiliste des PR nicht lesbar nach 3 Versuchen/.test(dauerAus.mutationsprobe ?? ''), [dauerAus.aufrufe, dauerAus.mutationsprobe])
pruefe('Probe-Job: der Fehler steht auch im Schrittlog (Wortlaut der ersten Fehlerzeile)', /Dateiliste nicht lesbar \(/.test(dauerAus.protokoll?.['Mutationsprobe starten'] ?? ''), dauerAus.protokoll)

// Der Prüfer-Job liest das Artefakt nur bei Stufe 2 und vollständigem Diff (A7c).
const ARTEFAKT = `Mutationsprobe zum Kopf ${KOPF}\n- ${LISTE}: alle Mutanten rot (Lauf grün)\n`
const mitArtefakt = laufeBisEingang(wf, { 7: prDaten(7, KOPF) }, ARTEFAKT)
pruefe('A7c: Stufe 2 und diff-zustand ok -> Artefakt liegt als mutationsprobe.txt im Prüfordner', mitArtefakt.heruntergeladen === 'mutationsprobe' && mitArtefakt.mutationsprobe === ARTEFAKT, mitArtefakt.ausgaben)
pruefe('A7c: ohne Artefakt keine Datei (Schritt ist fail-soft)', gut.mutationsprobe === null && gut.fehler === undefined)
const unvollstDiff = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), ausfaelle: { dateien: 99 } } }, ARTEFAKT)
pruefe('A7c: diff-zustand unvollstaendig -> Artefakt wird nicht gelesen', unvollstDiff.ausgaben?.diff?.['diff-zustand'] === 'unvollstaendig' && unvollstDiff.mutationsprobe === null && unvollstDiff.heruntergeladen === undefined, unvollstDiff.ausgaben)
const stufe0Artefakt = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), diff: dokuDiff } }, ARTEFAKT)
pruefe('A7c: Prüfstufe 0 -> Artefakt wird nicht gelesen', stufe0Artefakt.ausgaben?.stufe?.stufe === '0' && stufe0Artefakt.mutationsprobe === null, stufe0Artefakt.ausgaben)

if (fehler.length) {
  console.error(`pr-pruefer-ablauf.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-ablauf.test: grün')
