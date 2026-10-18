/**
 * Eine fehlerhafte Meldung hält nicht alle anderen auf (18.10.2026): Wird die Prüfung neuer Handbelege im Bestandslauf rot,
 * sucht dieses Werkzeug die auslösenden Meldungen und übernimmt den Rest. Vorher blieben bei Rot alle neuen draußen, und
 * eine einzige Meldung (Haikyu!! To the Top, 25 Folgen auf einer Seite, der Titel hat 13) hielt 10.556 andere zurück.
 *
 * Aufruf: `node tools/meldungen-eingrenzen.mjs <protokoll> <antwort>` — `<protokoll>` ist die Ausgabe der roten Prüfung
 * (`/tmp/logic.txt`), `<antwort>` die gesicherte Antwort des Briefkastens (`MELDUNGEN_SICHERN`). Einheit ist die Adresse:
 * Meldungen derselben Seite werden gemeinsam angenommen oder zurückgestellt. Gesucht wird durch Halbieren (je Versuch ein
 * Nachspiel von `fetch-pruefungen.ts` und die roten Prüfungen); am Ende prüft `check:logic` den angenommenen Stand ganz.
 * Exit 0: Stdout trägt die zurückgestellten Kennungen, die Arbeitsdateien den Rest. Exit 1: nichts eingegrenzt, die Arbeitsdateien tragen den vollen Stapel.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
/** `AK_ROOT`: Arbeitsordner einer Kulisse im Test; tsx kommt immer aus diesem Repo. */
const wurzel = process.env.AK_ROOT ?? repo
const tsx = createRequire(join(repo, 'package.json')).resolve('tsx/cli')
/** Was `fetch-pruefungen.ts` schreibt; vor jedem Versuch auf den Stand des Commits zurück. */
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
 * Halbieren mit Gedächtnis: Eine Hälfte, die mit allem schon Angenommenen grün bleibt, ist angenommen; eine rote wird geteilt,
 * bis eine einzelne Einheit übrig ist, die zurückgestellt wird. So fallen auch Schwellen-Prüfungen („höchstens 8“) richtig aus.
 * `gruen(einheiten)` prüft den Stand mit genau diesen Einheiten. null: der Stand ohne jede Einheit ist schon rot, oder es
 * bräuchte mehr als `hoechstens` Versuche.
 */
export async function grenzeEin(einheiten, gruen, hoechstens = HOECHSTENS_VERSUCHE) {
  const angenommen = []
  const zurueck = []
  let versuche = 1
  if (!(await gruen([]))) return null
  const offen = einheiten.length > 1 ? halbiere(einheiten) : [einheiten]
  while (offen.length) {
    const teil = offen.shift()
    if (++versuche > hoechstens) return null
    if (await gruen([...angenommen, ...teil])) angenommen.push(...teil)
    else if (teil.length === 1) zurueck.push(teil[0])
    else offen.unshift(...halbiere(teil))
  }
  return { angenommen, zurueck, versuche }
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
  return spawnSync(befehl, args, { cwd: wurzel, env, stdio: ['ignore', 2, 2] }).status === 0
}

/** Ein Versuch: Arbeitsdateien zurück, Nachspiel ohne die übrigen Meldungen, dann die Prüfungen. */
function stand(antwortDatei, alleIds, angenommen, pruefungen, ordner) {
  const behalten = new Set(angenommen.flatMap((e) => e.ids))
  const ohne = join(ordner, 'ohne.json')
  writeFileSync(ohne, JSON.stringify(alleIds.filter((id) => !behalten.has(id))))
  if (!lauf('git', ['checkout', 'HEAD', '--', ...ARBEITSDATEIEN], process.env)) return false
  rmSync(join(wurzel, 'data/cache/pruefungen-abhaken.json'), { force: true })
  /* Ohne Token bricht `fetch-pruefungen.ts` still ab (Exit 0); das Nachspiel fragt den Briefkasten nicht, braucht also keins. */
  const env = { ...process.env, LAUF_TOKEN: process.env.LAUF_TOKEN || 'nachspiel', MELDUNGEN_ANTWORT: antwortDatei, MELDUNGEN_OHNE: ohne }
  delete env.GITHUB_ENV
  delete env.MELDUNGEN_SICHERN
  if (!lauf(process.execPath, [tsx, 'pipeline/fetch-pruefungen.ts', '--abhaken-spaeter'], env)) return false
  return pruefungen.every((p) => lauf(p[0], p.slice(1), process.env))
}

async function main([protokollDatei, antwortDatei], ordner) {
  const liste = readFileSync(join(wurzel, 'tools/check-logic-liste.txt'), 'utf8')
  const rote = rotePruefungen(readFileSync(protokollDatei, 'utf8'), liste)
  writeFileSync(join(ordner, 'liste.txt'), rote.join('\n') + '\n')
  const bestand = [process.execPath, tsx, 'pipeline/check-logic-bestand.ts']
  const teilpruefung = [...(rote.length ? [[process.execPath, 'tools/check-logic-alle.mjs', join(ordner, 'liste.txt'), 'eingrenzen']] : []), bestand]
  const einheiten = einheitenAus(readFileSync(antwortDatei, 'utf8'))
  const alleIds = einheiten.flatMap((e) => e.ids)
  let n = 0
  const gruen = async (angenommen) => {
    console.error(`::group::Eingrenzen, Versuch ${++n}: ${angenommen.length} von ${einheiten.length} Adressen`)
    const ok = stand(antwortDatei, alleIds, angenommen, teilpruefung, ordner)
    console.error(`::endgroup::\nEingrenzen, Versuch ${n}: ${ok ? 'grün' : 'rot'}`)
    return ok
  }
  const ergebnis = await grenzeEin(einheiten, gruen)
  const voll = [[process.execPath, 'tools/check-logic-alle.mjs'], bestand]
  /* Nichts eingegrenzt: zurück auf den Stand des vollen Nachspiels, den der Schritt danach wie bisher ganz zurücknimmt. */
  if (!ergebnis?.zurueck.length || !stand(antwortDatei, alleIds, ergebnis.angenommen, voll, ordner)) {
    stand(antwortDatei, alleIds, einheiten, [], ordner)
    return 1
  }
  const ids = ergebnis.zurueck.flatMap((e) => e.ids)
  for (const e of ergebnis.zurueck) console.error(`Zurückgestellt: ${e.url} (Meldung ${e.ids.join(', ')})`)
  console.log(`${ids.length} von ${alleIds.length} (${ergebnis.versuche} Versuche): ${ids.join(', ')}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ordner = mkdtempSync(join(tmpdir(), 'eingrenzen-'))
  const code = await main(process.argv.slice(2), ordner)
  rmSync(ordner, { recursive: true, force: true })
  process.exit(code)
}
