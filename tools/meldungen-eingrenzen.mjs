/**
 * Eine fehlerhafte Meldung hält nicht alle anderen auf (18.10.2026): Wird die Prüfung neuer Handbelege im Bestandslauf rot,
 * sucht dieses Werkzeug die auslösenden Meldungen und übernimmt den Rest. Vorher blieben bei Rot alle neuen draußen, und
 * eine einzige Meldung (Haikyu!! To the Top, 25 Folgen auf einer Seite, der Titel hat 13) hielt 10.556 andere zurück.
 *
 * Aufruf: `node tools/meldungen-eingrenzen.mjs <protokoll> <antwort> [höchstens]` — `<protokoll>` ist die Ausgabe der roten
 * Prüfung (`/tmp/logic.txt`), `<antwort>` die gesicherte Antwort des Briefkastens (`MELDUNGEN_SICHERN`), `[höchstens]` die
 * Versuchsgrenze (Test). Einheit ist die Adresse:
 * Meldungen derselben Seite werden gemeinsam angenommen oder zurückgestellt. Gesucht wird durch Halbieren (je Versuch ein
 * Nachspiel von `fetch-pruefungen.ts` und die roten Prüfungen); am Ende prüft `check:logic` den angenommenen Stand ganz.
 * Exit 0: Stdout trägt die zurückgestellten Kennungen, die Arbeitsdateien den Rest, `ZURUECK_DATEI` die zurückgestellten
 * Adressen mit Grund. Exit 1: nichts eingegrenzt, die Arbeitsdateien tragen den vollen Stapel.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
/** `AK_ROOT`: Arbeitsordner einer Kulisse im Test; tsx kommt immer aus diesem Repo. */
const wurzel = process.env.AK_ROOT ?? repo
const tsx = createRequire(join(repo, 'package.json')).resolve('tsx/cli')
/** Was `fetch-pruefungen.ts` schreibt; vor jedem Versuch auf den Stand des Commits zurück. Nicht dabei, mit Absicht: `data/kanal-seiten.json` (die Merkliste soll das Zurückstellen überleben). */
export const ARBEITSDATEIEN = [
  'data/dub-confirmed.yaml',
  'data/anbieter-staffeln.json',
  'data/amazon-gti-belegt.json',
  'data/meldungs-auffaelligkeiten.json',
  'data/meldungen-uebernahme.json',
  'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md',
]
export const HOECHSTENS_VERSUCHE = 40
/**
 * Zurückgestellte Adressen mit Grund (`grund` null: an der Versuchsgrenze ungeprüft) und erstem Tag. Die Briefkasten-Wache zählt
 * sie als gelistet, der nächste Lauf prüft die mit Grund einzeln statt neu zu halbieren; „Neue Handbelege prüfen“ leert sie, wenn
 * der ganze Stapel grün ist.
 */
export const ZURUECK_DATEI = 'data/meldungen-zurueckgestellt.json'

/**
 * Halbieren mit Gedächtnis: Eine Hälfte, die mit allem schon Angenommenen grün bleibt, ist angenommen; eine rote wird geteilt,
 * bis eine einzelne Einheit übrig ist, die zurückgestellt wird. So fallen auch Schwellen-Prüfungen („höchstens 8“) richtig aus.
 * `gruen(einheiten)` prüft den Stand mit genau diesen Einheiten; `bekannt` (Adressen) prüft es einzeln hinter den neuen. Ist
 * die Grenze erreicht, bleibt das Angenommene, der Rest ist `ungeprueft`. null: der Stand ohne jede Einheit ist schon rot.
 */
export async function grenzeEin(einheiten, gruen, hoechstens = HOECHSTENS_VERSUCHE, bekannt = new Set()) {
  const angenommen = []
  const zurueck = []
  let versuche = 1
  if (!(await gruen([]))) return null
  const offen = startReihe(einheiten, bekannt)
  while (offen.length && versuche < hoechstens) {
    const teil = offen.shift()
    versuche++
    if (await gruen([...angenommen, ...teil])) angenommen.push(...teil)
    else if (teil.length === 1) zurueck.push(teil[0])
    else offen.unshift(...halbiere(teil))
  }
  return { angenommen, zurueck, ungeprueft: offen.flat(), versuche }
}

/** Ohne Bekannte ist das Ganze schon rot, also gleich halbiert; mit ihnen kommen die neuen zuerst am Stück, dann jede bekannte allein. */
function startReihe(einheiten, bekannt) {
  const alt = einheiten.filter((e) => bekannt.has(e.url))
  const neu = einheiten.filter((e) => !bekannt.has(e.url))
  if (!alt.length) return neu.length > 1 ? halbiere(neu) : [neu]
  return [...(neu.length ? [neu] : []), ...alt.map((e) => [e])]
}

function halbiere(liste) {
  const mitte = Math.ceil(liste.length / 2)
  return [liste.slice(0, mitte), liste.slice(mitte)]
}

/** Die roten Prüfungen aus dem Protokoll von `check-logic-alle.mjs` (beide Formatzeilen), nur Dateien aus der Liste. */
export function rotePruefungen(protokoll, liste) {
  const bekannt = new Set(liste.split(/\r?\n/).map((z) => z.trim()))
  const einzeln = [...protokoll.matchAll(/^[^ \n]+: (\S+) ist rot \(/gm)].map((t) => t[1])
  const [, nachKopf = ''] = protokoll.split(/^[^ \n]+: \d+ von \d+ Prüfungen rot:$/m)
  const aufgezaehlt = [...nachKopf.matchAll(/^ {2}- (\S+)$/gm)].map((t) => t[1])
  return [...new Set([...einzeln, ...aufgezaehlt])].filter((d) => bekannt.has(d)).sort()
}

/** Die Meldungen der Antwort, nach Adresse gruppiert (Reihenfolge der Antwort: die ältesten zuerst). */
export function einheitenAus(antwort) {
  const jeAdresse = new Map()
  for (const p of JSON.parse(antwort).pruefungen) jeAdresse.set(p.url, [...(jeAdresse.get(p.url) ?? []), p.id])
  return [...jeAdresse.entries()].map(([url, ids]) => ({ url, ids }))
}

function lauf(befehl, args, env) {
  return spawnSync(befehl, args, { cwd: wurzel, env, stdio: ['ignore', 2, 2], windowsHide: true }).status === 0
}

/**
 * Arbeitsdateien auf den Stand des Commits. Was dort fehlt, fehlt danach auch hier: `git checkout` bricht sonst für alle ab,
 * und Liste 11 verschwindet, sobald nichts mehr offen ist (`meldungen-liste.ts`).
 */
function setzeZurueck() {
  const r = spawnSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...ARBEITSDATEIEN], { cwd: wurzel, encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) return false
  const imCommit = r.stdout.split('\n').filter(Boolean)
  for (const d of ARBEITSDATEIEN.filter((x) => !imCommit.includes(x))) rmSync(join(wurzel, d), { force: true })
  return lauf('git', ['checkout', 'HEAD', '--', ...imCommit], process.env)
}

/** Ein Versuch: Arbeitsdateien zurück, Nachspiel ohne die übrigen Meldungen, dann die Prüfungen. */
function stand(antwortDatei, alleIds, angenommen, pruefungen, ordner) {
  const behalten = new Set(angenommen.flatMap((e) => e.ids))
  const ohne = join(ordner, 'ohne.json')
  writeFileSync(ohne, JSON.stringify(alleIds.filter((id) => !behalten.has(id))))
  if (!setzeZurueck()) return false
  rmSync(join(wurzel, 'data/cache/quittung-offen/pruefungen-abhaken.json'), { force: true })
  /* Ohne Token bricht `fetch-pruefungen.ts` still ab (Exit 0); das Nachspiel fragt den Briefkasten nicht, braucht also keins. */
  const env = { ...process.env, LAUF_TOKEN: process.env.LAUF_TOKEN || 'nachspiel', MELDUNGEN_ANTWORT: antwortDatei, MELDUNGEN_OHNE: ohne }
  delete env.GITHUB_ENV
  delete env.MELDUNGEN_SICHERN
  if (!lauf(process.execPath, [tsx, 'pipeline/fetch-pruefungen.ts', '--abhaken-spaeter'], env)) return false
  return pruefungen.every((p) => lauf(p[0], p.slice(1), process.env))
}

async function main([protokollDatei, antwortDatei, grenze], ordner) {
  const liste = readFileSync(join(wurzel, 'tools/check-logic-liste.txt'), 'utf8')
  const rote = rotePruefungen(readFileSync(protokollDatei, 'utf8'), liste)
  writeFileSync(join(ordner, 'liste.txt'), rote.join('\n') + '\n')
  const bestand = [process.execPath, tsx, 'pipeline/check-logic-bestand.ts']
  const teilpruefung = [...(rote.length ? [[process.execPath, 'tools/check-logic-alle.mjs', join(ordner, 'liste.txt'), 'eingrenzen']] : []), bestand]
  const einheiten = einheitenAus(readFileSync(antwortDatei, 'utf8'))
  const alleIds = einheiten.flatMap((e) => e.ids)
  const vorher = existsSync(join(wurzel, ZURUECK_DATEI)) ? JSON.parse(readFileSync(join(wurzel, ZURUECK_DATEI), 'utf8')) : []
  let n = 0
  const gruen = async (angenommen) => {
    console.error(`::group::Eingrenzen, Versuch ${++n}: ${angenommen.length} von ${einheiten.length} Adressen`)
    const ok = stand(antwortDatei, alleIds, angenommen, teilpruefung, ordner)
    console.error(`::endgroup::\nEingrenzen, Versuch ${n}: ${ok ? 'grün' : 'rot'}`)
    return ok
  }
  const bekannt = new Set(vorher.filter((e) => e.grund).map((e) => e.url))
  const ergebnis = await grenzeEin(einheiten, gruen, Number(grenze) || HOECHSTENS_VERSUCHE, bekannt)
  const voll = [[process.execPath, 'tools/check-logic-alle.mjs'], bestand]
  const zurueck = [...(ergebnis?.zurueck ?? []), ...(ergebnis?.ungeprueft ?? [])]
  /* Nichts eingegrenzt: zurück auf den Stand des vollen Nachspiels, den der Schritt danach wie bisher ganz zurücknimmt. */
  if (!zurueck.length || !stand(antwortDatei, alleIds, ergebnis.angenommen, voll, ordner)) {
    stand(antwortDatei, alleIds, einheiten, [], ordner)
    return 1
  }
  const grund = rote.join(', ') || 'pipeline/check-logic-bestand.ts'
  writeFileSync(join(wurzel, ZURUECK_DATEI), JSON.stringify(zurueckgestellt(ergebnis, vorher, grund, new Date().toISOString()), null, 2) + '\n')
  console.log(meldeZurueck(ergebnis, alleIds.length))
  return 0
}

/** Einträge für `ZURUECK_DATEI`: rot geprüfte mit dem heutigen Grund, ungeprüfte mit dem bisherigen; `seit` bleibt vom ersten Tag. */
export function zurueckgestellt({ zurueck, ungeprueft }, vorher, grund, jetzt) {
  const alt = new Map(vorher.map((e) => [e.url, e]))
  const eintrag = (e, g) => ({ url: e.url, ids: e.ids, grund: g, seit: alt.get(e.url)?.seit ?? jetzt })
  return [...zurueck.map((e) => eintrag(e, grund)), ...ungeprueft.map((e) => eintrag(e, alt.get(e.url)?.grund ?? null))]
}

/** Protokoll je Adresse; Stdout (für die Warnung der Statusanzeige) nennt die rot geprüften Kennungen, Ungeprüfte nur als Zahl. */
function meldeZurueck({ zurueck, ungeprueft, versuche }, alle) {
  for (const e of zurueck) console.error(`Zurückgestellt: ${e.url} (Meldung ${e.ids.join(', ')})`)
  for (const e of ungeprueft) console.error(`Ungeprüft zurückgestellt: ${e.url} (Meldung ${e.ids.join(', ')})`)
  const ids = zurueck.flatMap((e) => e.ids)
  const offen = ungeprueft.flatMap((e) => e.ids).length
  const rest = offen ? ` · ${offen} ungeprüft (Versuchsgrenze)` : ''
  return `${ids.length + offen} von ${alle} (${versuche} Versuche): ${ids.join(', ')}${rest}`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ordner = mkdtempSync(join(tmpdir(), 'eingrenzen-'))
  const code = await main(process.argv.slice(2), ordner)
  rmSync(ordner, { recursive: true, force: true })
  process.exit(code)
}
