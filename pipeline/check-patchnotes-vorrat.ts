import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruefePatchnotes } from '../shared/patchnotes.ts'
import { vorratFelder } from '../tools/patchnotes-vorrat-alter.mjs'
import { gibFrei, leseVorrat, pruefeVorrat, veralteterVorrat, VORRAT_MAX_TAGE } from './lib/patchnotes-vorrat.ts'
import { lesePatchnotesDateien, PATCHNOTES_ORDNER } from './lib/patchnotes.ts'
import { tageAusGit } from './lib/patchnotes-datum.ts'

/** Vorrat der Patch Notes („Patch Notes: vertagt“): Schema, Alter, Freigabe (mit echtem git: der Freigabetag wird der Tag des Eintrags), Aufruf als Prozess. */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const eintrag = (name: string, felder: Record<string, unknown> = {}) => ({
  name,
  eintrag: { kategorie: 'feature', text: `Text ${name}`, wartetAuf: 'nächster Cartoon-Lauf', seit: '2026-11-01', ...felder },
})
const haupt = [{ name: 'alt', eintrag: { kategorie: 'bugfix', text: 'Alter Text' } }]
const meldungen = (felder: Record<string, unknown>, h = haupt) => pruefeVorrat([eintrag('neu', felder)], h)

pruefe('Vorrat: gültiger Eintrag ist in Ordnung', meldungen({}).length === 0, meldungen({}))
pruefe('Vorrat: ohne wartetAuf wird gemeldet', meldungen({ wartetAuf: undefined }).some((m) => m.includes('wartetAuf fehlt')))
pruefe('Vorrat: leeres wartetAuf wird gemeldet', meldungen({ wartetAuf: '  ' }).some((m) => m.includes('wartetAuf fehlt')))
pruefe('Vorrat: ohne seit wird gemeldet', meldungen({ seit: undefined }).some((m) => m.includes('seit fehlt')))
pruefe('Vorrat: seit kein Tag wird gemeldet', meldungen({ seit: '2026-13-01' }).some((m) => m.includes('seit fehlt')))
pruefe('Vorrat: datum ist verboten', meldungen({ datum: '2026-11-01' }).some((m) => m.includes('kein datum')))
pruefe('Vorrat: neun Wörter werden wie bei jedem Eintrag gemeldet', meldungen({ text: 'eins zwei drei vier fünf sechs sieben acht neun' }).some((m) => m.includes('Wörter')))
pruefe('Vorrat: verbotenes Wort (Pipeline) wird gemeldet', meldungen({ untertitel: 'Pipeline neu' }).some((m) => m.includes('Pipeline')))
pruefe('Vorrat: unbekanntes Feld wird gemeldet', meldungen({ live: true }).some((m) => m.includes('live')))
pruefe('Vorrat: gleicher Dateiname im Hauptordner wird gemeldet', pruefeVorrat([eintrag('alt')], haupt).some((m) => m.includes('Hauptordner')))
pruefe('Vorrat: gleicher Text im Hauptordner wird gemeldet', meldungen({ text: 'Alter Text' }).some((m) => m.includes('gleicher Text')))
pruefe('Vorrat: leerer Vorrat ist in Ordnung', pruefeVorrat([], haupt).length === 0)

// Alter: genau an, eins drüber, deutlich drüber; verschiedene Tage, damit „seit“ und „heute“ nicht vertauscht werden können.
const seit = '2026-11-01'
const alt = (heute: string) => veralteterVorrat([eintrag('a', { seit })], heute)
pruefe(`Vorrat: genau ${VORRAT_MAX_TAGE} Tage warnt nicht`, alt('2026-11-08').length === 0, alt('2026-11-08'))
pruefe(`Vorrat: ${VORRAT_MAX_TAGE + 1} Tage warnt mit Name, Tag und Wartegrund`, alt('2026-11-09').length === 1 && alt('2026-11-09')[0]!.includes('a liegt seit 2026-11-01') && alt('2026-11-09')[0]!.includes('nächster Cartoon-Lauf'), alt('2026-11-09'))
pruefe('Vorrat: deutlich älter warnt', alt('2026-12-31').length === 1)
pruefe('Vorrat: ein Eintrag in der Zukunft warnt nicht', alt('2026-10-01').length === 0)
const mehrere = veralteterVorrat([eintrag('jung', { seit: '2026-11-20' }), eintrag('zweit', { seit: '2026-11-02' }), eintrag('erst', { seit: '2026-11-01' })], '2026-11-25')
pruefe('Vorrat: Warnungen ältester zuerst, junger Eintrag fehlt', mehrere.length === 2 && mehrere[0]!.includes('erst') && mehrere[1]!.includes('zweit'), mehrere)

// Die Wache läuft ohne `npm ci` (delta-wache.yml): ihr Vorrats-Modul darf nur `node:`-Module und Nachbardateien importieren.
const wachenModul = readFileSync(new URL('../tools/patchnotes-vorrat-alter.mjs', import.meta.url), 'utf8')
const importe = [...wachenModul.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]!)
pruefe('Wache: patchnotes-vorrat-alter.mjs importiert nur node:-Module und ./-Nachbarn', importe.length >= 2 && importe.every((i) => i.startsWith('node:') || i.startsWith('./')), importe)
const gelesen = vorratFelder('x', "kategorie: bugfix\nwartetAuf: Bau, dann Lauf\nseit: '2026-11-01'\n")
pruefe('Wache: seit (in Anführungszeichen) und wartetAuf werden zeilenweise gelesen', gelesen.seit === '2026-11-01' && gelesen.wartetAuf === 'Bau, dann Lauf', gelesen)
pruefe('Wache: ohne seit bleibt seit leer und der Eintrag warnt nicht', vorratFelder('y', 'wartetAuf: Bau\n').seit === undefined && veralteterVorrat([{ name: 'y', eintrag: { wartetAuf: 'Bau' } }], '2999-01-01').length === 0)

// Freigabe mit echtem git in einem Wegwerf-Repo: Anlage im Vorrat am 01.11., Freigabe am 05.11. → der Eintrag trägt den 05.11.
const wurzel = mkdtempSync(join(tmpdir(), 'patchnotes-vorrat-'))
const git = (...args: string[]) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const commit = (tag: string, nachricht: string) => {
  git('add', '-A')
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.org', 'commit', '-q', '-m', nachricht], {
    cwd: wurzel,
    stdio: 'ignore',
    env: { ...process.env, GIT_AUTHOR_DATE: `${tag}T12:00:00+01:00`, GIT_COMMITTER_DATE: `${tag}T12:00:00+01:00` },
  })
}
try {
  git('init', '-q')
  const ordner = join(wurzel, PATCHNOTES_ORDNER)
  mkdirSync(join(ordner, 'vorrat'), { recursive: true })
  writeFileSync(join(ordner, 'vorrat', 'spirou.yaml'), "kategorie: feature\ntext: Spirou läuft jetzt im Kalender\nuntertitel: Mit deutscher Synchro\nwartetAuf: nächster Cartoon-Lauf\nseit: '2026-11-01'\n")
  commit('2026-11-01', 'vorrat')
  const vorratVorher = leseVorrat(ordner)
  pruefe('Vorrat: lesen findet die Datei im Unterordner, der Hauptordner sieht sie nicht', vorratVorher.length === 1 && lesePatchnotesDateien(ordner).length === 0, vorratVorher)
  const ziel = gibFrei('spirou', ordner)
  pruefe('Vorrat: Freigabe verschiebt die Datei und streicht wartetAuf und seit', ziel === `${ordner}/spirou.yaml` && !existsSync(join(ordner, 'vorrat', 'spirou.yaml')) && !/wartetAuf|seit/.test(readFileSync(ziel, 'utf8')), readFileSync(ziel, 'utf8'))
  const frei = lesePatchnotesDateien(ordner)
  pruefe('Vorrat: der freigegebene Eintrag besteht die Prüfung eines Hauptordner-Eintrags', frei.length === 1 && pruefePatchnotes(frei.map((d) => d.eintrag)).length === 0 && frei[0]!.eintrag.text === 'Spirou läuft jetzt im Kalender' && frei[0]!.eintrag.untertitel === 'Mit deutscher Synchro', frei)
  commit('2026-11-05', 'freigabe')
  const vorherCwd = process.cwd()
  process.chdir(wurzel)
  let tage: Map<string, string>
  try {
    tage = tageAusGit(PATCHNOTES_ORDNER, ['spirou'], '2099-12-31')
  } finally {
    process.chdir(vorherCwd)
  }
  pruefe('Vorrat: Freigabe setzt den Tag (Anlage im Vorrat 01.11., Freigabe 05.11. → 05.11.)', tage.get('spirou') === '2026-11-05', [...tage])
  let zweite = ''
  try {
    gibFrei('spirou', ordner)
  } catch (e) {
    zweite = (e as Error).message
  }
  pruefe('Vorrat: zweite Freigabe derselben Datei bricht ab', zweite.includes('gibt es nicht'), zweite)
  writeFileSync(join(ordner, 'vorrat', 'doppelt.yaml'), 'kategorie: feature\ntext: Doppelt\n')
  writeFileSync(join(ordner, 'doppelt.yaml'), 'kategorie: feature\ntext: Doppelt\n')
  let belegt = ''
  try {
    gibFrei('doppelt', ordner)
  } catch (e) {
    belegt = (e as Error).message
  }
  pruefe('Vorrat: Freigabe überschreibt keine vorhandene Datei im Hauptordner', belegt.includes('gibt es schon') && existsSync(join(ordner, 'vorrat', 'doppelt.yaml')), belegt)

  // Aufruf als Prozess (Verdrahtung des Werkzeugs): liste und frei im Wegwerf-Repo, Fehlaufruf Exit 1 mit Hinweis.
  writeFileSync(join(ordner, 'vorrat', 'neu.yaml'), "kategorie: bugfix\ntext: Neu im Vorrat\nwartetAuf: nächster Bau\nseit: '2026-11-02'\n")
  const werkzeug = new URL('./patchnotes-vorrat.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const lauf = (...args: string[]) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), werkzeug, ...args], { cwd: wurzel, encoding: 'utf8', timeout: 60_000, windowsHide: true })
  const liste = lauf('liste')
  pruefe('Vorrat: Aufruf „liste“ zeigt Name, seit und wartetAuf', liste.status === 0 && liste.stdout.includes('neu  seit 2026-11-02  wartet auf: nächster Bau'), liste)
  const frei2 = lauf('frei', 'neu')
  pruefe('Vorrat: Aufruf „frei“ verschiebt die Datei', frei2.status === 0 && existsSync(join(ordner, 'neu.yaml')) && !existsSync(join(ordner, 'vorrat', 'neu.yaml')), frei2)
  const falsch = lauf('frei')
  pruefe('Vorrat: Aufruf ohne Namen endet mit Exit 1 und Hinweis', falsch.status === 1 && falsch.stderr.includes('Aufruf:'), falsch)
  // Die Wache (`tools/delta-pruefen.mjs`) als Prozess: ein alter Vorrat macht sie rot und nennt ihn, ein Vorrat in ferner Zukunft nicht.
  const wache = () => {
    const pfad = new URL('../tools/delta-pruefen.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    return spawnSync(process.execPath, [pfad], { cwd: wurzel, encoding: 'utf8', timeout: 60_000, windowsHide: true })
  }
  const ohneVorrat = wache()
  pruefe('Wache: Vorrat ohne alte Einträge → Exit 0', ohneVorrat.status === 0, ohneVorrat.stdout + ohneVorrat.stderr)
  writeFileSync(join(ordner, 'vorrat', 'zukunft.yaml'), "kategorie: bugfix\ntext: Zukunft\nwartetAuf: Bau\nseit: '2999-12-31'\n")
  const jung = wache()
  pruefe('Wache: ein Eintrag mit seit in ferner Zukunft warnt nicht', jung.status === 0, jung.stdout + jung.stderr)
  writeFileSync(join(ordner, 'vorrat', 'alt.yaml'), "kategorie: bugfix\ntext: Alt\nwartetAuf: Cartoon-Lauf\nseit: '2020-01-01'\n")
  const alter = wache()
  pruefe('Wache: ein Eintrag seit 2020 → Exit 1 mit Name und Wartegrund', alter.status === 1 && alter.stdout.includes('alt liegt seit 2020-01-01') && alter.stdout.includes('Cartoon-Lauf'), alter.stdout + alter.stderr)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

/**
 * Das Pflicht-Werkzeug im PR-Ereignis (Verdrahtung `ausEreignis`): Wegwerf-Repo mit Merge-Commit, Beschreibung aus der Ereignisdatei.
 * Der Zweig ändert `web/src` und legt, wenn verlangt, einen Vorrats-Eintrag an.
 */
function pflichtImEreignis(beschreibung: string, mitVorrat: boolean): { status: number | null; aus: string } {
  const repo = mkdtempSync(join(tmpdir(), 'patchnotes-pflicht-'))
  const g = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.org', ...args], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    g('init', '-q')
    writeFileSync(join(repo, 'LIESMICH.md'), 'x\n')
    g('add', '-A')
    g('commit', '-q', '-m', 'basis')
    const hauptzweig = g('branch', '--show-current').trim()
    g('switch', '-q', '-c', 'pr')
    mkdirSync(join(repo, 'web', 'src'), { recursive: true })
    writeFileSync(join(repo, 'web', 'src', 'x.ts'), 'export {}\n')
    if (mitVorrat) {
      mkdirSync(join(repo, PATCHNOTES_ORDNER, 'vorrat'), { recursive: true })
      writeFileSync(join(repo, PATCHNOTES_ORDNER, 'vorrat', 'x.yaml'), "kategorie: bugfix\ntext: Neu\nwartetAuf: Bau\nseit: '2026-11-01'\n")
    }
    g('add', '-A')
    g('commit', '-q', '-m', 'pr')
    g('switch', '-q', hauptzweig)
    g('merge', '-q', '--no-ff', '-m', 'merge', 'pr')
    const ereignis = join(repo, '..', `ereignis-${process.pid}-${mitVorrat}.json`)
    writeFileSync(ereignis, JSON.stringify({ pull_request: { body: beschreibung, head: { ref: 'feature/probe' } } }))
    const werkzeug = new URL('../tools/check-patchnotes-pflicht.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    const env = { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: ereignis }
    const r = spawnSync(process.execPath, [werkzeug], { cwd: repo, env, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    rmSync(ereignis, { force: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}
const vertagt = 'Patch Notes: vertagt – wirkt nach dem Bau'
const mitEintrag = pflichtImEreignis(vertagt, true)
pruefe('Pflicht im Ereignis: vertagt mit Vorrats-Datei im Diff → Exit 0', mitEintrag.status === 0 && mitEintrag.aus.includes('vertagt, Entwurf im Vorrat'), mitEintrag)
const ohneEintrag = pflichtImEreignis(vertagt, false)
pruefe('Pflicht im Ereignis: vertagt ohne Vorrats-Datei → Exit 1 mit Hinweis', ohneEintrag.status === 1 && ohneEintrag.aus.includes('legt aber keinen Entwurf an'), ohneEintrag)
const keineLaut = pflichtImEreignis('Patch Notes: keine – wirkt erst nach dem nächsten Lauf', false)
pruefe('Pflicht im Ereignis: „keine“ mit nächstem Lauf ohne Vorrats-Datei → Exit 1', keineLaut.status === 1, keineLaut)
const keineGlatt = pflichtImEreignis('Patch Notes: keine – reiner Umbau', false)
pruefe('Pflicht im Ereignis: gewöhnliche „keine“-Zeile → Exit 0', keineGlatt.status === 0, keineGlatt)

// Der echte Ordner: alles im Vorrat besteht die Prüfung.
const echt = pruefeVorrat(leseVorrat(), lesePatchnotesDateien())
pruefe(`Vorrat: Einträge in ${PATCHNOTES_ORDNER}/vorrat bestehen die Prüfung`, echt.length === 0, echt)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
