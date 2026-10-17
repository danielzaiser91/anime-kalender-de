/**
 * Ablauftest für .github/workflows/pr-pruefer.yml: führt die run-Schritte des Jobs bis zur Laufzeitsperre
 * („Prüfer-Eingang prüfen“) wirklich mit bash aus, mit nachgebautem `gh` (tools/pr-pruefer-kulisse.mjs).
 * Erwartet wird, dass die Beschreibung mit Nachträgen und Commit-Liste beim Prüfer ankommt und der Zustand `ok` ist;
 * jede Änderung am Workflow, die das verhindert (PR-Nummer, Repo, Pfade, Schritt-Schlüssel), macht ihn rot.
 * Schlüssel, die er nicht nachbildet (`shell`, `working-directory`, `defaults`, `if` …), sind rot statt übergangen.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { BEDINGUNG_FREIGABE, EINGANG, laufeBisEingang, prDaten, KOPF } from './pr-pruefer-kulisse.mjs'

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

// Die Sperre greift: fehlt die Commit-Liste (API scheitert), ist der Zustand nicht ok, obwohl der Diff vollständig ist.
const ohneCommits = laufeBisEingang(wf, { 7: { ...prDaten(7, KOPF), commits: undefined } })
pruefe('Sperre: Commit-Liste fehlt -> zustand=unvollstaendig bei diff-zustand=ok',
  ohneCommits.ausgaben?.diff?.['diff-zustand'] === 'ok' && ohneCommits.ausgaben?.eingang?.zustand === 'unvollstaendig', ohneCommits.ausgaben)
// Falsche PR-Nummer liefert eine vollständige Liste eines anderen PR: nur der Abgleich mit dem Kopf fängt das.
const fremderKopf = laufeBisEingang(wf, { 7: prDaten(7, 'f'.repeat(40)) })
pruefe('Sperre: Liste endet nicht am Kopf -> zustand=unvollstaendig',
  fremderKopf.ausgaben?.diff?.['diff-zustand'] === 'ok' && fremderKopf.ausgaben?.eingang?.zustand === 'unvollstaendig', fremderKopf.ausgaben)

// Wächter auf dem geparsten Dokument: Sperre exakt, direkt vor den Prüfern, und ihr Zustand ist der, den Prompts und Freigabe lesen.
const schritte = wf.jobs.pruefen.steps
const iEingang = schritte.findIndex((s) => s.id === 'eingang')
pruefe('Sperre-Schritt exakt (Name, id, env, run; keine weiteren Schlüssel)', JSON.stringify(schritte[iEingang]) === JSON.stringify(EINGANG), schritte[iEingang])
const pruefer = schritte.map((s, i) => [s, i]).filter(([s]) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
pruefe('Sperre steht direkt vor den beiden Prüfer-Schritten', pruefer.length === 2
  && pruefer[0][1] === iEingang + 1 && pruefer[1][1] === iEingang + 2, pruefer.map(([, i]) => i))
for (const [s] of pruefer) {
  pruefe(`${s.name}: Prompt liest den Zustand der Sperre, alles außer "ok" ist unvollständig`,
    String(s.with?.prompt ?? '').includes('Diff-Zustand: ${{ steps.eingang.outputs.zustand }}. Lautet er nicht "ok",'))
}
const freigabe = schritte.find((s) => s.name === 'Protokoll und Freigabe')
pruefe('Freigabe liest den Zustand der Sperre', freigabe?.env?.DIFF_ZUSTAND === '${{ steps.eingang.outputs.zustand }}')
pruefe('Freigabe macht aus "ok" ein "aendern", wenn der Zustand nicht ok ist',
  String(freigabe?.run ?? '').split('\n').map((z) => z.trim()).includes(BEDINGUNG_FREIGABE))
const leserDiffZustand = schritte.filter((s) => JSON.stringify(s).includes('steps.diff.outputs.diff-zustand'))
pruefe('diff-zustand liest nur noch die Sperre', leserDiffZustand.length === 1 && leserDiffZustand[0].id === 'eingang')

if (fehler.length) {
  console.error(`pr-pruefer-ablauf.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-ablauf.test: grün')
