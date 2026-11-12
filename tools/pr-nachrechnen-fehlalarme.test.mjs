/**
 * Fehlalarme der Leser-Regel (10.11.2026): main bekommt alle 15-60 min Datencommits, jede unbegründete Neustart-Entscheidung von
 * `pr-nachrechnen.mjs` kostete eine Kette von 20 min (PR 3341, 3346, 3347, 3269, 3305, 3310). Jeder Fall unten steht mit den echten
 * Pfaden des Anlasses im Fake-Baum; ein Neustart bleibt nur, wenn Code des PR die bewegte Datei nachweislich liest.
 */
import fs from 'node:fs'
import { bewegtesGelesen, leserIn } from './pr-nachrechnen-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const urteil = (baum, args) => bewegtesGelesen({ liesMain: () => null, paketSkripte: null, ...args, lies: (p) => baum[p] ?? null })

// (b) PR 3341: Test nennt pipeline/build.ts als Fixture, die Importkette führt bis zum Leser von data/amazon-gti-belegt.json
const BAU_KETTE = {
  'tools/pr-nachrechnen.test.mjs': "const KOPIE = 'pipeline/build.ts'\n",
  'tools/pr-nachrechnen.mjs': 'export const KETTE = 1\n',
  'pipeline/build.ts': "import './bau/phasenfolge'\n",
  'pipeline/bau/phasenfolge.ts': "import './09-synchro'\n",
  'pipeline/bau/09-synchro.ts': "import './09-4-crunchyroll-dub'\n",
  'pipeline/bau/09-4-crunchyroll-dub.ts': "const f = join(D, 'amazon-gti-belegt.json')\n",
}
const CR = { bewegt: ['data/amazon-gti-belegt.json'], leser: ['pipeline/bau/09-4-crunchyroll-dub.ts'] }
const PR_3341 = ['tools/commit-data-test.sh', 'tools/nacht-merger.test.mjs', 'tools/pr-ersetzt.mjs', 'tools/pr-ersetzt.test.mjs', 'tools/pr-nachrechnen.mjs', 'tools/pr-nachrechnen.test.mjs']
pruefe('(b) Test nennt pipeline/build.ts als Fixture, main bewegt data/amazon-gti-belegt.json -> null', urteil(BAU_KETTE, { ...CR, pr: PR_3341 }) === null, urteil(BAU_KETTE, { ...CR, pr: PR_3341 }))
pruefe('(b) PR liest data/anbieter-staffeln.json, main bewegt data/amazon-gti-belegt.json (andere Datei) -> null', urteil({ ...BAU_KETTE, 'pipeline/bau/x.ts': "join(D, 'anbieter-staffeln.json')\n" }, { ...CR, pr: ['pipeline/bau/x.ts'] }) === null)
pruefe('(b) Gegenfall: kein Test, sondern Skript nennt pipeline/build.ts -> Neustart', /ruft pipeline\/bau\/09-4-crunchyroll-dub\.ts auf/.test(urteil({ ...BAU_KETTE, 'tools/lauf.mjs': "spawn('tsx', ['pipeline/build.ts'])\n" }, { ...CR, pr: ['tools/lauf.mjs'] })))
pruefe('(b) Gegenfall: PR ändert die Bauphase, die data/amazon-gti-belegt.json liest -> Neustart', /^der PR liest data\/amazon-gti-belegt.json \(pipeline\/bau\/09-4-crunchyroll-dub\.ts\)$/.test(urteil(BAU_KETTE, { ...CR, pr: ['pipeline/bau/09-4-crunchyroll-dub.ts'] })))
pruefe('(b) Gegenfall: PR ändert die Bauphase, die einen Leser importiert (09-synchro.ts) -> Neustart', /ruft pipeline\/bau\/09-4-crunchyroll-dub\.ts auf/.test(urteil(BAU_KETTE, { ...CR, pr: ['pipeline/bau/09-synchro.ts'] })))
pruefe('(b) PR-Test nennt data/amazon-gti-belegt.json nur als Fixture (PR 3341: pr-nachrechnen.test.mjs) -> null', urteil({ 'tools/pr-nachrechnen.test.mjs': "const F = 'data/amazon-gti-belegt.json'\n" }, { bewegt: ['data/amazon-gti-belegt.json'], leser: [], pr: ['tools/pr-nachrechnen.test.mjs'] }) === null)
pruefe('(b) Gegenfall: PR-Test nennt bewegten Code tools/pr-pruefer-modus.mjs (PR 3269) -> Neustart', /^der PR liest tools\/pr-pruefer-modus\.mjs \(tools\/wache-limit-haenger\.test\.mjs\)$/.test(urteil({ 'tools/wache-limit-haenger.test.mjs': "import { x } from './pr-pruefer-modus.mjs'\n" }, { bewegt: ['tools/pr-pruefer-modus.mjs'], leser: [], pr: ['tools/wache-limit-haenger.test.mjs'] })))
pruefe('(d) PR-Test liest per readdir einen Ordner mit data/amazon-gti-belegt.json (PR 3310: worktree-aufraeumen.test.mjs) -> null', urteil({ 'tools/worktree-aufraeumen.test.mjs': "fs.readdirSync('data')\n" }, { bewegt: ['data/amazon-gti-belegt.json'], leser: [], pr: ['tools/worktree-aufraeumen.test.mjs'] }) === null)

// (a)+(c) PR 3305/3347: eine Ausführungsliste nennt jede Prüfung; bewegter Wächter oder Markdown-Liste entwertet sie nicht
const LISTE_ALT = 'pipeline/check-belege-entfernt.ts\npipeline/check-weg-nein-gti.ts\npipeline/check-jw-ablauf.ts\n'
const LISTE_NEU = `${LISTE_ALT}pipeline/check-unbeteiligt.ts\n`
const mitListe = { 'tools/check-logic-liste.txt': LISTE_NEU, 'pipeline/check-unbeteiligt.ts': 'export {}\n' }
const listePr = (bewegt, leser) => urteil(mitListe, { bewegt, leser, pr: ['tools/check-logic-liste.txt'], liesMain: (p) => (p === 'tools/check-logic-liste.txt' ? LISTE_ALT : null) })
pruefe('(a) leserIn: eine Ausführungsliste ist kein Leser, auch wenn sie den bewegten Wächter nennt', leserIn(new Map([['tools/check-logic-liste.txt', LISTE_ALT], ['pipeline/y.ts', "x('check-weg-nein-gti.ts')\n"]]), ['pipeline/check-weg-nein-gti.ts']).join() === 'pipeline/y.ts')
pruefe('(a) main bewegt den Wächter pipeline/check-weg-nein-gti.ts, PR hängt nur einen anderen Eintrag an die Liste -> null', listePr(['pipeline/check-weg-nein-gti.ts'], []) === null, listePr(['pipeline/check-weg-nein-gti.ts'], []))
pruefe('(a) main bewegt data/belege-entfernt.yaml, PR hängt nur einen unbeteiligten Eintrag an die Liste -> null', listePr(['data/belege-entfernt.yaml'], ['pipeline/check-belege-entfernt.ts']) === null, listePr(['data/belege-entfernt.yaml'], ['pipeline/check-belege-entfernt.ts']))
pruefe('(a) Gegenfall: der neue Listeneintrag ist der Leser selbst -> Neustart', /ruft pipeline\/check-jw-seite\.ts auf/.test(urteil({ 'tools/check-logic-liste.txt': `${LISTE_ALT}pipeline/check-jw-seite.ts\n` }, { bewegt: ['daniel-zum-abarbeiten/listen/justwatch-widersprueche.md'], leser: ['pipeline/check-jw-seite.ts'], pr: ['tools/check-logic-liste.txt'], liesMain: () => LISTE_ALT })))
pruefe('(a) Gegenfall: der neue Listeneintrag ist der bewegte Wächter -> Neustart', /^der PR liest pipeline\/check-weg-nein-gti\.ts \(tools\/check-logic-liste\.txt\)$/.test(urteil({ 'tools/check-logic-liste.txt': `${LISTE_ALT.replace('pipeline/check-weg-nein-gti.ts\n', '')}pipeline/check-weg-nein-gti.ts\n` }, { bewegt: ['pipeline/check-weg-nein-gti.ts'], leser: [], pr: ['tools/check-logic-liste.txt'], liesMain: () => LISTE_ALT.replace('pipeline/check-weg-nein-gti.ts\n', '') })))
const MD = 'daniel-zum-abarbeiten/listen/justwatch-widersprueche.md'
const MD_BAUM = { ...mitListe, 'tools/pr-nachrechnen-bot-pfade.test.mjs': `const F = '${MD}'\nconst E = 'pipeline/check-unbeteiligt.ts'\n` }
pruefe('(c) Test nennt die Markdown-Liste und einen Listeneintrag als Fixture, PR hängt den Eintrag an -> null', urteil(MD_BAUM, { bewegt: [MD], leser: ['tools/pr-nachrechnen-bot-pfade.test.mjs', 'pipeline/check-jw-seite.ts'], pr: ['tools/check-logic-liste.txt'], liesMain: () => LISTE_ALT }) === null)
pruefe('(c) Gegenfall: Leser pipeline/check-jw-seite.ts importiert die PR-Datei -> Neustart', /pipeline\/lib\/jw\.ts wird von Code genutzt/.test(urteil({ 'pipeline/check-jw-seite.ts': "import './lib/jw'\n" }, { bewegt: [MD], leser: ['pipeline/check-jw-seite.ts'], pr: ['pipeline/lib/jw.ts'] })))

// (d) PR 3310: der Hook unter .claude/ läuft nie in der Kette
const HOOK = { '.claude/hooks/agenten-grenze.js': "for (const f of fs.readdirSync('data')) fs.readFileSync('data/' + f)\n" }
pruefe('(d) Hook .claude/hooks/agenten-grenze.js liest „einen Ordner“ mit data/amazon-gti-belegt.json -> null', urteil(HOOK, { bewegt: ['data/amazon-gti-belegt.json'], leser: ['pipeline/bau/amazon.ts'], pr: Object.keys(HOOK) }) === null)
pruefe('(d) Gegenfall: dasselbe readdir in tools/ -> Neustart mit Grund und Datei', /^der PR liest einen Ordner mit data\/amazon-gti-belegt\.json \(tools\/sammler\.mjs\)/.test(urteil({ 'tools/sammler.mjs': HOOK['.claude/hooks/agenten-grenze.js'] }, { bewegt: ['data/amazon-gti-belegt.json'], leser: [], pr: ['tools/sammler.mjs'] })))

// Rückrichtung: Werkzeuge unter tools/ nennen Daten in Ausnahmelisten (workflows-beleg.mjs: amazon-gti-belegt.json) und importieren pr-nachrechnen.mjs
const WB = { 'tools/workflows-beleg.mjs': "import { istDatenpfad } from './pr-nachrechnen.mjs'\nconst OHNE = ['amazon-gti-belegt.json']\n" }
pruefe('PR ändert pr-nachrechnen.mjs, das nur ein Werkzeug (workflows-beleg.mjs) mit Datennennung importiert -> null', urteil(WB, { bewegt: ['data/amazon-gti-belegt.json'], leser: ['tools/workflows-beleg.mjs'], pr: ['tools/pr-nachrechnen.mjs'] }) === null)

// Randfälle der Regel einzeln
const T = (name, text) => new Map([[name, text]])
pruefe('leserIn: Test, der eine Daten-Markdown nennt, ist kein Leser; Nicht-Test schon', leserIn(T('tools/x.test.mjs', `f('${MD}')\n`), [MD]).length === 0 && leserIn(T('tools/x.mjs', `f('${MD}')\n`), [MD]).length === 1)
pruefe('leserIn: Test, der public/og/default.png nennt, ist kein Leser', leserIn(T('tools/x.test.mjs', "f('public/og/default.png')\n"), ['public/og/default.png']).length === 0)
pruefe('leserIn: Test, der data/amazon-gti-belegt.json nennt, ist kein Leser', leserIn(T('tools/x.test.mjs', "f('data/amazon-gti-belegt.json')\n"), ['data/amazon-gti-belegt.json']).length === 0)
pruefe('leserIn: Test, der bewegten Code nennt, ist ein Leser', leserIn(T('tools/x.test.mjs', "import './y.mjs'\n"), ['tools/y.mjs']).join() === 'tools/x.test.mjs')
const RUECK = { 'pipeline/y.test.ts': "import './lib/a.ts'\n", 'pipeline/z.ts': "import './lib/a.ts'\nimport './lib/b.ts'\n" }
pruefe('Rückrichtung: ein Test als Leser zieht den PR nicht hinein', urteil(RUECK, { bewegt: ['data/amazon-gti-belegt.json'], leser: ['pipeline/y.test.ts'], pr: ['pipeline/lib/a.ts'] }) === null)
const zwei = urteil(RUECK, { bewegt: ['data/amazon-gti-belegt.json'], leser: ['pipeline/z.ts'], pr: ['pipeline/lib/b.ts', 'pipeline/lib/a.ts'] })
pruefe('Rückrichtung: der Grund nennt die erste PR-Datei und die bewegten Dateien', /^pipeline\/lib\/b\.ts wird von Code genutzt, der bewegte Daten liest \(bewegt: data\/amazon-gti-belegt\.json\)$/.test(zwei), zwei)

// Nachbesserung PR 3352 A1: ein Test, der die bewegte Datei wirklich liest (handbeleg-treffer.test.mjs, pruef-bestand.test.mjs), bleibt Leser
const AMAZON = 'data/amazon-gti-belegt.json'
const LIEST = { 'tools/handbeleg-treffer.test.mjs': "const t = readFileSync(new URL('../data/amazon-gti-belegt.json', import.meta.url), 'utf8')\n" }
const FIXTURE = { 'tools/pr-nachrechnen.test.mjs': "const F = 'data/amazon-gti-belegt.json'\nconst y = readFileSync(new URL('../.github/workflows/pr-pruefung.yml', import.meta.url))\n" }
pruefe('A1 Test liest die bewegte Datei per readFileSync(new URL(…, import.meta.url)) -> Neustart', /^der PR liest data\/amazon-gti-belegt\.json \(tools\/handbeleg-treffer\.test\.mjs\)$/.test(urteil(LIEST, { bewegt: [AMAZON], leser: [], pr: ['tools/handbeleg-treffer.test.mjs'] })))
pruefe('A1 Test liest per resolve(…) -> Neustart', /^der PR liest data\/amazon-gti-belegt\.json/.test(urteil({ 'tools/a.test.mjs': "const p = resolve(root, 'data/amazon-gti-belegt.json')\n" }, { bewegt: [AMAZON], leser: [], pr: ['tools/a.test.mjs'] })))
pruefe('A1 Test liest per readFileSync(\'data/…\') ohne URL und resolve -> Neustart', /^der PR liest/.test(urteil({ 'tools/a.test.mjs': "readFileSync('data/amazon-gti-belegt.json')\n" }, { bewegt: [AMAZON], leser: [], pr: ['tools/a.test.mjs'] })))
pruefe('A1 Test bildet die Adresse per new URL(…, import.meta.url) -> Neustart', /^der PR liest/.test(urteil({ 'tools/a.test.mjs': "const u = new URL('../data/amazon-gti-belegt.json', import.meta.url)\n" }, { bewegt: [AMAZON], leser: [], pr: ['tools/a.test.mjs'] })))
pruefe('A1 Fixture nur als String, ein anderer Lese-Aufruf in einer anderen Zeile -> null', urteil(FIXTURE, { bewegt: [AMAZON], leser: [], pr: ['tools/pr-nachrechnen.test.mjs'] }) === null)
pruefe('A1 Lese-Aufruf nur im Kommentar -> null', urteil({ 'tools/a.test.mjs': "// readFileSync('data/amazon-gti-belegt.json')\n" }, { bewegt: [AMAZON], leser: [], pr: ['tools/a.test.mjs'] }) === null)
pruefe('A1 leserIn: lesender Test ist Leser, Fixture-Test nicht', leserIn(new Map([...Object.entries(LIEST), ...Object.entries(FIXTURE)]), [AMAZON]).join() === 'tools/handbeleg-treffer.test.mjs')

// Nachbesserung A2: Rückrichtung bis zwei Importstufen, auch von tools/check-*
const TIEF = { 'pipeline/bau/a.ts': "import './b'\nconst f = 'amazon-gti-belegt.json'\n", 'pipeline/bau/b.ts': "import './c'\n", 'pipeline/bau/c.ts': "import './d'\n", 'pipeline/bau/d.ts': 'export {}\n' }
pruefe('A2(a) Leser a.ts -> b.ts -> c.ts, PR ändert c.ts -> Neustart', /^pipeline\/bau\/c\.ts wird von Code genutzt/.test(urteil(TIEF, { bewegt: [AMAZON], leser: ['pipeline/bau/a.ts'], pr: ['pipeline/bau/c.ts'] })))
pruefe('A2(a) Gegenfall: PR ändert d.ts (drei Importe vom Leser) -> null', urteil(TIEF, { bewegt: [AMAZON], leser: ['pipeline/bau/a.ts'], pr: ['pipeline/bau/d.ts'] }) === null)
const CHECK = { 'tools/check-x.mjs': "import './lib.mjs'\nreadFileSync('data/amazon-gti-belegt.json')\n" }
pruefe('A2(b) Leser tools/check-x.mjs liest die bewegte Datei und importiert tools/lib.mjs, PR ändert lib.mjs -> Neustart', /^tools\/lib\.mjs wird von Code genutzt/.test(urteil(CHECK, { bewegt: [AMAZON], leser: ['tools/check-x.mjs'], pr: ['tools/lib.mjs'] })))

// 11.11.2026: tools/commit-data-test.sh nennt data/anisearch.json & Co. nur als Fixture in Wegwerf-Repos; als Bau-Leser wies es Daten-PRs ab.
// Der Text ist der echte (vorher: Grund „Leser: tools/commit-data-test.sh“), die Gegenprobe gibt ihn unter einem Werkzeugnamen ohne „-test“.
const lesePfad = (name) => new URL(`./${name}`, import.meta.url)
const SHELL = Object.fromEntries(['commit-data-test.sh', 'commit-data-test-verworfen.sh'].map((n) => [`tools/${n}`, fs.readFileSync(lesePfad(n), 'utf8')]))
const DATEN_PR = ['data/folgentitel-hand.yaml']
for (const [pfad, text] of Object.entries(SHELL)) {
  const genannt = 'data/anisearch.json'
  const ohne = bewegtesGelesen({ bewegt: [genannt], pr: DATEN_PR, leser: [pfad], lies: (p) => SHELL[p] ?? null, paketSkripte: null })
  const mit = bewegtesGelesen({ bewegt: [genannt], pr: DATEN_PR, leser: ['tools/gen.sh'], lies: (q) => (q === 'tools/gen.sh' ? text : null), paketSkripte: null })
  pruefe(`Shell-Test ${pfad} (nennt ${genannt}) ist kein Bau-Leser -> null`, ohne === null, ohne)
  pruefe('Gegenprobe: derselbe Text als tools/gen.sh bleibt Bau-Leser -> Grund', /^der PR ändert data\/folgentitel-hand\.yaml, .*Leser: tools\/gen\.sh/.test(mit), mit)
}
const MUSTER_FAELLE = [['tools/commit-data-test-beleg.sh', null], ['tools/attest.sh', 'g'], ['tools/test-x.sh', 'g'], ['tools/a-test.mjs', 'g'], ['tools/a-test.sh.bak', 'g'], ['pipeline/x-test.sh', 'g'], ['tools/unter/x-test.sh', 'g']]
// Echter Fall 11.11.2026 22:24 (PR 3495, Daten-PR disc-anisearch.yaml): main bewegte tools/nachrechnen-joblog.mjs (PR 3505), der Grund lautete
// „Leser: tools/commit-data-test.sh, nennt tools/nachrechnen-joblog.mjs“ — die Kopierliste des Shell-Tests nennt das Werkzeug.
const JOBLOG = 'tools/nachrechnen-joblog.mjs'
const echt = bewegtesGelesen({ bewegt: [JOBLOG], pr: ['data/curated/disc-anisearch.yaml'], leser: ['tools/commit-data-test.sh'], lies: (q) => SHELL[q] ?? null, paketSkripte: null })
pruefe('PR 3495: commit-data-test.sh nennt das bewegte Werkzeug nur in der Kopierliste -> null', SHELL['tools/commit-data-test.sh'].includes('nachrechnen-joblog.mjs') && echt === null, echt)
for (const [p, soll] of MUSTER_FAELLE) {
  const g = bewegtesGelesen({ bewegt: ['data/anisearch.json'], pr: DATEN_PR, leser: [p], lies: (q) => (q === p ? "x('data/anisearch.json')\n" : null), paketSkripte: null })
  pruefe(`Shell-Test-Muster: ${p} -> ${soll === null ? 'null' : 'Grund'}`, (g === null) === (soll === null), g)
}

// 11.11.2026: der Grund nennt alle Bau-Leser je bewegter Datei, höchstens 5, den Rest als „und n weitere“ (Kern zuerst).
const bauGrund = (bewegt, texte) => bewegtesGelesen({ bewegt, pr: DATEN_PR, leser: Object.keys(texte), lies: (p) => texte[p] ?? null, paketSkripte: null })
const nenner = (n, wort) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`pipeline/bau/l${i + 1}.ts`, `x('${wort}')\n`]))
const A = 'data/anisearch.json'
const B = 'data/kennungen.json'
const ENDE = (s) => `(${s})`
const g1 = bauGrund([A], { 'tools/gen.mjs': "x('anisearch.json')\n", 'pipeline/bau/k.ts': "x('anisearch.json')\n" })
pruefe('Leser: zwei Leser, Kern vor Werkzeug, beide genannt', g1.endsWith(ENDE(`Leser: pipeline/bau/k.ts, tools/gen.mjs, nennt ${A}`)), g1)
const g5 = bauGrund([A], nenner(5, 'anisearch.json'))
pruefe('Leser: genau 5 Leser -> alle genannt, kein „weitere“', g5.endsWith(ENDE(`Leser: ${Object.keys(nenner(5, 'x')).join(', ')}, nennt ${A}`)), g5)
const g6 = bauGrund([A], nenner(6, 'anisearch.json'))
pruefe('Leser: 6 Leser -> 5 genannt und „und 1 weitere“', g6.endsWith(ENDE(`Leser: ${Object.keys(nenner(5, 'x')).join(', ')} und 1 weitere, nennt ${A}`)), g6)
const g9 = bauGrund([A], nenner(9, 'anisearch.json'))
pruefe('Leser: 9 Leser -> „und 4 weitere“ (Zahl der Übrigen, nicht der Gesamtheit)', g9.endsWith(ENDE(`Leser: ${Object.keys(nenner(5, 'x')).join(', ')} und 4 weitere, nennt ${A}`)), g9)
const g2 = bauGrund([A, B], { 'pipeline/bau/a.ts': "x('anisearch.json')\n", 'pipeline/bau/b.ts': "x('kennungen.json')\n", 'pipeline/bau/c.ts': "x('anisearch.json')\nx('kennungen.json')\n" })
pruefe('Leser: zwei bewegte Dateien -> je Datei ein Abschnitt, ein Leser beider steht in beiden', g2.endsWith(ENDE(`Leser: pipeline/bau/a.ts, pipeline/bau/c.ts, nennt ${A}; Leser: pipeline/bau/b.ts, pipeline/bau/c.ts, nennt ${B}`)), g2)
const gN = bauGrund([A, B], { 'pipeline/bau/a.ts': null })
pruefe('Leser: nicht lesbarer Text zählt als Leser der ersten bewegten Datei', gN.endsWith(ENDE(`Leser: pipeline/bau/a.ts, nennt ${A}`)), gN)

// 11.11.2026 (PR 3502/3509): Test-PR mit readdirSync und `tools/` trifft keine Ausführungsliste, aber weiter bewegten Code unter tools/.
const ECHTER_TEST = 'tools/mutationsanker-ohne-tests.test.mjs'
const echterText = fs.readFileSync(new URL('./mutationsanker-ohne-tests.test.mjs', import.meta.url), 'utf8')
const ordnerFall = (bewegt) => bewegtesGelesen({ bewegt: [bewegt], pr: [ECHTER_TEST], leser: [], lies: (p) => (p === ECHTER_TEST ? echterText : null), paketSkripte: null })
const listeGrund = ordnerFall('tools/check-logic-liste.txt')
const codeGrund = ordnerFall('tools/pr-nachrechnen.mjs')
pruefe('Ordner-Leser: echter Test mit readdirSync + tools/ trifft bewegte Ausführungsliste nicht', listeGrund === null, listeGrund)
pruefe('Ordner-Leser: bewegte Code-Datei unter tools/ bleibt Grund', typeof codeGrund === 'string' && codeGrund.includes('einen Ordner mit tools/pr-nachrechnen.mjs'), codeGrund)

// 12.11.2026 (PR 3557): main bewegte Werkzeug und Mutationsliste (PR 3555), der Daten-PR ändert data/verweise-von-hand.yaml; die Leser sind die echten Werkzeugdateien.
const WERKZEUG = ['tools/pr-nachrechnen-bot-pfade-leser.mjs', 'tools/pr-nachrechnen-leser-git.mjs']
const WERKZEUG_TEXTE = Object.fromEntries(WERKZEUG.map((n) => [n, fs.readFileSync(lesePfad(n.slice('tools/'.length)), 'utf8')]))
const BEWEGT_3555 = ['tools/mutationen/nachrechnen-fehlalarme.json', 'tools/pr-nachrechnen-leser.mjs']
const werkzeugFall = (leser, texte) => bewegtesGelesen({ bewegt: BEWEGT_3555, pr: ['data/verweise-von-hand.yaml'], leser, lies: (p) => texte[p] ?? null, paketSkripte: null })
const echtWerkzeug = werkzeugFall(WERKZEUG, WERKZEUG_TEXTE)
pruefe('PR 3557: Nachrechnen-Werkzeug nennt bewegte Werkzeugdateien, der Daten-PR liest sie nicht -> null', WERKZEUG.every((n) => BEWEGT_3555.some((b) => WERKZEUG_TEXTE[n].includes(b.split('/').pop()))) && echtWerkzeug === null, echtWerkzeug)
const fremdLeser = werkzeugFall(['pipeline/bau/x.ts'], { 'pipeline/bau/x.ts': "import '../../tools/pr-nachrechnen-leser.mjs'\n" })
pruefe('PR 3557 Gegenfall: ein Leser in pipeline/ nennt dieselbe bewegte Datei -> Grund', /^der PR ändert data\/verweise-von-hand\.yaml, .*Leser: pipeline\/bau\/x\.ts/.test(fremdLeser), fremdLeser)
const toolsLeser = werkzeugFall(['tools/pr-basis.mjs'], { 'tools/pr-basis.mjs': "import './pr-nachrechnen-leser.mjs'\n" })
pruefe('PR 3557 Gegenfall: tools/pr-basis.mjs (nicht Nachrechnen-Familie) nennt die bewegte Datei -> Grund', /Leser: tools\/pr-basis\.mjs/.test(toolsLeser), toolsLeser)
const joblog = werkzeugFall(['tools/nachrechnen-joblog.mjs'], { 'tools/nachrechnen-joblog.mjs': "import './pr-nachrechnen-leser.mjs'\n" })
pruefe('PR 3557: tools/nachrechnen-joblog.mjs (zweiter Namensteil der Familie) ist kein Bau-Leser -> null', joblog === null, joblog)
const unterordner = werkzeugFall(['tools/pr-nachrechnen-x/y.mjs'], { 'tools/pr-nachrechnen-x/y.mjs': "import './pr-nachrechnen-leser.mjs'\n" })
pruefe('PR 3557 Gegenfall: Unterordner der Familie zählt nicht als Familie -> Grund', typeof unterordner === 'string', unterordner)

// 12.11.2026 (PR 3494/3481): `anisearch-offen.json` steckt als Namensende in `adn-anisearch-offen.json`; der echte Text von check-adn-anisearch.ts nennt nur Letzteres.
const ADN_CHECK = 'pipeline/check-adn-anisearch.ts'
// Eingefroren: Zeilen 3 und 130 des echten Textes (Stand 12.11.2026), damit eine Änderung der Datei den Test nicht färbt.
const adnText = " * ohne Cache und ohne Bestand; der Katalog `data/adn-catalog.json` und die Liste `data/adn-anisearch-offen.json` liegen im Repo.\nconst offen = (JSON.parse(readFileSync('data/adn-anisearch-offen.json', 'utf8')) as { serien: AdnOffen[] }).serien\n"
const OFFEN = 'data/anisearch-offen.json'
pruefe('Namensende: echter Text nennt adn-anisearch-offen.json, nicht anisearch-offen.json -> kein Leser', adnText.includes('adn-anisearch-offen.json') && leserIn(new Map([[ADN_CHECK, adnText]]), [OFFEN]).length === 0)
pruefe('Namensende: die längere Datei data/adn-anisearch-offen.json bleibt Leser-Treffer', leserIn(new Map([[ADN_CHECK, adnText]]), ['data/adn-anisearch-offen.json']).join() === ADN_CHECK)
const kurzTexte = { 'a.mjs': "x('data/anisearch-offen.json')\n", 'b.mjs': "x(join(D, 'anisearch-offen.json'))\n", 'c.mjs': 'x(`${D}/anisearch-offen.json`)\n', 'd.mjs': "x('anisearch-offen.json')\n", 'e.mjs': "x('foo.anisearch-offen.json')\n" }
pruefe('Namensende: genannte Schreibweisen (Pfad, Name im Literal, Template) bleiben Treffer, `foo.`-Vorsatz nicht', leserIn(new Map(Object.entries(kurzTexte)), [OFFEN]).join() === 'a.mjs,b.mjs,c.mjs,d.mjs')

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-fehlalarme.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-fehlalarme.test: grün')
