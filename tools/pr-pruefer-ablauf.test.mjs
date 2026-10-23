/**
 * Ablauftest für .github/workflows/pr-pruefer.yml: führt die run-Schritte des Jobs bis zur Laufzeitsperre
 * („Prüfer-Eingang prüfen“) wirklich mit bash aus, mit nachgebautem `gh` (tools/pr-pruefer-kulisse.mjs).
 * Erwartet wird, dass die Beschreibung mit Nachträgen und Commit-Liste beim Prüfer ankommt und der Zustand `ok` ist;
 * jede Änderung am Workflow, die das verhindert (PR-Nummer, Repo, Pfade, Schritt-Schlüssel), macht ihn rot.
 * Schlüssel, die er nicht nachbildet (`shell`, `working-directory`, `defaults`, `if` …), sind rot statt übergangen.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { laufeBisEingang, prDaten, KOPF } from './pr-pruefer-kulisse.mjs'

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
]
const aufrufe = (gut.aufrufe ?? []).map((a) => a.replace(/--body-file \S+/, '--body-file <datei>'))
pruefe('Ablauf: gh-Aufrufe genau die erwartete Liste (kein zusätzlicher Aufruf)', JSON.stringify(aufrufe) === JSON.stringify(AUFRUFE), { ist: aufrufe, soll: AUFRUFE })

// Die Sperre greift: fehlt die Commit-Liste (API scheitert), ist der Zustand nicht ok, obwohl der Diff vollständig ist.
const ohneCommits = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), commits: undefined } })
pruefe('Sperre: Commit-Liste fehlt -> zustand=unvollstaendig bei diff-zustand=ok',
  ohneCommits.ausgaben?.diff?.['diff-zustand'] === 'ok' && ohneCommits.ausgaben?.eingang?.zustand === 'unvollstaendig', ohneCommits.ausgaben)
// Fällt nur die Kommentar-API aus, fehlen die Nachträge: auch das darf nicht als vollständig gelten.
const ohneKommentare = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), kommentare: undefined } })
pruefe('Sperre: Kommentare fehlen (Commits da) -> zustand=unvollstaendig bei diff-zustand=ok',
  ohneKommentare.ausgaben?.diff?.['diff-zustand'] === 'ok' && ohneKommentare.ausgaben?.eingang?.zustand === 'unvollstaendig', ohneKommentare.ausgaben)
pruefe('Sperre: Kommentare fehlen -> Commit-Liste ist trotzdem da', ohneKommentare.beschreibung?.includes('- ' + KOPF.slice(0, 9) + ' test: drei'), ohneKommentare.beschreibung)
// Falsche PR-Nummer liefert eine vollständige Liste eines anderen PR: nur der Abgleich mit dem Kopf fängt das.
const fremderKopf = laufeBisEingang(wf, { 7: prDaten(7, 'f'.repeat(40)) })
pruefe('Sperre: Liste endet nicht am Kopf -> zustand=unvollstaendig',
  fremderKopf.ausgaben?.diff?.['diff-zustand'] === 'ok' && fremderKopf.ausgaben?.eingang?.zustand === 'unvollstaendig', fremderKopf.ausgaben)

// Sperre, Freigabe-env und -run deckt der Schnappschuss (pr-pruefer-freigabe.test.mjs) ab; hier bleibt der Prompt-Text.
const schritte = wf.jobs.pruefen.steps
const pruefer = schritte.filter((s) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
pruefe('Zwei Prüfer-Schritte', pruefer.length === 2, pruefer.map((s) => s.name))
for (const s of pruefer) {
  pruefe(`${s.name}: Prompt liest den Zustand der Sperre, alles außer "ok" ist unvollständig`,
    String(s.with?.prompt ?? '').includes('Diff-Zustand: ${{ steps.eingang.outputs.zustand }}. Lautet er nicht "ok",'))
}
const voll = String(pruefer.find((s) => s.name === 'Prüfer')?.with?.prompt ?? '')
pruefe('Voller Prüfer: Vorgabe Folgeläufe, übersprungene Tests, inhaltlicher Abgleich je Ziel',
  ['Folgeläufe', 'leere oder gelöschte Eingabedatei', 'übersprungen wird, belegt dort nichts', 'je Ziel einen inhaltlichen Abgleich'].every((t) => voll.includes(t)))
const leserDiffZustand = schritte.filter((s) => JSON.stringify(s).includes('steps.diff.outputs.diff-zustand'))
pruefe('diff-zustand liest nur noch die Sperre', leserDiffZustand.length === 1 && leserDiffZustand[0].id === 'eingang')

if (fehler.length) {
  console.error(`pr-pruefer-ablauf.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-ablauf.test: grün')
