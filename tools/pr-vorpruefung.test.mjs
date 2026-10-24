/** Tests für tools/pr-vorpruefung.mjs: Gegenproben der mechanischen Prüfer-Regeln. */
import { readFileSync } from 'node:fs'
import { existiertIn, genanntePfade, istErwaehnt, fundeImDiff, listenRot, vorpruefe } from './pr-vorpruefung.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}
const lauf = (e) =>
  vorpruefe({ neu: [], zweig: 'speed/x', existiert: (p) => p === 'tools/alt.mjs', ...e })
const rot = (e) => lauf(e).rot.length > 0

// Zusammengesetzt, damit check:cache-register den Beispielpfad nicht für einen echten Zugriff hält.
const CACHE = ['data', 'cache', 'x.json'].join('/')
const PN = 'Patch Notes: keine – Technik'
pruefe('Text nennt alle Dateien → grün', !rot({ dateien: ['tools/a.mjs'], text: `tools/a.mjs neu. ${PN}` }))
pruefe('Datei nicht erwähnt → rot', rot({ dateien: ['tools/a.mjs', 'tools/b.mjs'], text: 'Nur a.mjs wird neu.' }))
pruefe('Elternordner zählt als Bereich', !rot({ dateien: ['tools/a.mjs', 'tools/b.mjs'], text: 'Neu in tools/.' }))
pruefe('Tiefer Ordner ohne Slash-Ende zählt', !rot({ dateien: ['docs/wissen/x.md'], text: 'Doku in docs/wissen' }))
pruefe('Wort „tools“ allein ist kein Bereich', rot({ dateien: ['tools/a.mjs'], text: 'Werkzeuge für tools.' }))
pruefe('Test-Datei über Kernnamen', !rot({ dateien: ['tools/foo-bar.test.mjs'], text: 'Test foo-bar neu' }))
pruefe('leerer Text → rot', rot({ dateien: ['docs/a.md'], text: '  ' }))
pruefe('leerer Text ohne Dateien → rot mit Meldung „leer“', lauf({ dateien: [], text: ' ' }).rot.join().includes('leer'))
pruefe('erfundene Datei im Text → rot', rot({ dateien: ['docs/a.md'], text: 'docs/a.md und tools/erfunden.mjs' }))
pruefe('kurzer Pfad relativ zum Diff-Pfad zählt als vorhanden', !rot({ dateien: ['pipeline/lib/a.ts'], text: 'lib/a.ts' }))
pruefe('lokal ausgeschlossener Ordner wird nicht auf Existenz geprüft', !rot({ dateien: ['docs/a.md'], text: 'docs/a.md, daniel-zum-abarbeiten/stand.md' }))
pruefe('vorhandene, aber ungeänderte Datei → nur Hinweis', !rot({ dateien: ['docs/a.md'], text: 'docs/a.md wie tools/alt.mjs' }) && lauf({ dateien: ['docs/a.md'], text: 'docs/a.md wie tools/alt.mjs' }).gelb.length === 1)
const ex = existiertIn(new Set(['pipeline/lib/a.ts']), (p) => p === 'platte.md')
pruefe('existiertIn: voll, Platte, Endstück; sonst nicht', ex('pipeline/lib/a.ts') && ex('platte.md') && ex('lib/a.ts') && !ex('lib/b.ts'))
pruefe('Sichtbar ohne Patch Notes → rot', rot({ dateien: ['web/src/a.ts'], text: 'web/src/a.ts' }))
pruefe('Sichtbar mit Ausnahmezeile → grün', !rot({ dateien: ['web/src/a.ts'], text: `web/src/a.ts\n${PN}` }))
pruefe('Sichtbar mit neuem Eintrag, Wort Patch Notes deckt Ordner', !rot({ dateien: ['web/src/a.ts', 'data/patchnotes/n.yaml'], neu: ['data/patchnotes/n.yaml'], text: 'web/src/a.ts, dazu Patch Notes' }))
pruefe('Cache-Datei → rot', rot({ dateien: [CACHE], text: CACHE }))
pruefe('Cache-Datei im daten/-Zweig → grün', !rot({ dateien: [CACHE], text: CACHE, zweig: 'daten/x' }))
pruefe('Workflow, Pfad im Text nennt ihn → grün', !rot({ dateien: ['.github/workflows/a.yml'], text: '.github/workflows/a.yml' }))
pruefe('Workflow, Text nennt ihn nicht ausdrücklich → rot', rot({ dateien: ['.github/workflows/a.yml'], text: 'a.yml ändert den Lauf' }))
pruefe('Prüfdatei, Pfad im Text nennt Check → grün', !rot({ dateien: ['pipeline/check-x.ts'], text: 'pipeline/check-x.ts' }))
pruefe('package.json ohne Benennung → rot', rot({ dateien: ['package.json'], text: 'Skripte angepasst, package' }))
pruefe('genanntePfade: Platzhalter und URLs ausgelassen', genanntePfade('data/patchnotes/<slug>.yaml, web/src/*.ts, https://github.com/a/b.md, `tools/x.mjs`').join() === 'tools/x.mjs')
pruefe('istErwaehnt: kurzer Kernname zählt nicht', !istErwaehnt('tools/ab.test.mjs', 'ab'))

const sh = readFileSync(new URL('./pr-einreichen.sh', import.meta.url), 'utf8')
const vorpruefZeile = sh.split('\n').find((z) => z.startsWith('node tools/pr-vorpruefung.mjs')) ?? ''
pruefe('pr-einreichen.sh ruft die Vorprüfung vor dem Push auf', sh.indexOf(vorpruefZeile) > 0 && sh.indexOf(vorpruefZeile) < sh.indexOf('git push'))
pruefe('pr-einreichen.sh bricht bei roter Vorprüfung ab', /\|\| \{[^}]*exit 1/.test(vorpruefZeile))
pruefe('pr-einreichen.sh nimmt bei vorhandenem PR dessen Beschreibung', /gh pr view "\$ZWEIG" --json body/.test(sh))
const ausfuehrbar = sh.replace(/\\\n/g, ' ').split('\n').filter((z) => !/^\s*(#|echo\b|printf\b)/.test(z)).join('\n')
pruefe('pr-einreichen.sh führt kein gh pr merge aus', !/gh\s+pr\s+merge/.test(ausfuehrbar))
pruefe('pr-einreichen.sh schaltet keinen Auto-Merge ein', !/--auto|enablePullRequestAutoMerge/.test(ausfuehrbar))

const listeRot = (text, namen = ['l.txt']) => listenRot((n) => (n === 'l.txt' ? text : null), namen)
pruefe('Liste: „-“ vor „.“ ist sortiert (Anlass 1613 R4)', listeRot('# k\na/x-y.ts\na/x.ts\n').length === 0)
pruefe('Liste: „.“ vor „-“ → rot', listeRot('a/x.ts\na/x-y.ts\n').length === 1)
pruefe('Liste: Kommentar- und Leerzeilen zählen nicht', listeRot('# z\n\na/b.ts\n# a\na/c.ts\n').length === 0)
pruefe('Liste: Dublette → rot, Meldung nennt Eintrag', listeRot('a/b.ts\na/b.ts\n').join().includes('a/b.ts steht mehrfach'))
pruefe('Liste: Dublette und Unordnung ergeben zwei Meldungen', listeRot('b.ts\na.ts\na.ts\n').length === 2)
pruefe('Liste: fehlende Datei (null) ist kein Fehler', listenRot(() => null).length === 0)
pruefe('Liste: zweite Liste wird auch geprüft', listenRot((n) => (n === 'zwei.txt' ? 'b\na\n' : 'a\nb\n'), ['eins.txt', 'zwei.txt']).join().includes('zwei.txt'))
pruefe('Liste: echte Listen im Repo sind in Ordnung', listenRot((n) => readFileSync(new URL(`../${n}`, import.meta.url), 'utf8')).length === 0)
const funde = 'tools/a.test.mjs:3\ntools/b.test.mjs:7\ntools/b.test.mjs.bak:2\n'
pruefe('Uhr: nur Fundstellen der Diff-Dateien, ganze Pfade', fundeImDiff(funde, ['tools/b.test.mjs']).join() === 'tools/b.test.mjs:7')
pruefe('Uhr: keine Diff-Datei mit Fund gibt nichts', fundeImDiff(funde, ['tools/c.test.mjs']).length === 0)

if (fehler.length) {
  console.error(`pr-vorpruefung.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-vorpruefung.test: grün')
