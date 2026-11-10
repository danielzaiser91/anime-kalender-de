/**
 * Fehlalarme der Leser-Regel (10.11.2026): main bekommt alle 15-60 min Datencommits, jede unbegründete Neustart-Entscheidung von
 * `pr-nachrechnen.mjs` kostete eine Kette von 20 min (PR 3341, 3346, 3347, 3269, 3305, 3310). Jeder Fall unten steht mit den echten
 * Pfaden des Anlasses im Fake-Baum; ein Neustart bleibt nur, wenn Code des PR die bewegte Datei nachweislich liest.
 */
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

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-fehlalarme.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-fehlalarme.test: grün')
