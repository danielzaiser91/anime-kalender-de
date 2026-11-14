/**
 * package.json auf main im Nachrechnen (12.11.2026): bisher entwertete jede Bewegung jeden PR (16:41: neun Neustarts durch eine Änderung
 * des Skripts `check:extension`, kein PR berührte `extension/`). Jetzt zählt nur, was die Kette wirklich ändert:
 *  - alles außer `scripts` (Pakete, `overrides`, `engines` ...) bleibt kettenweit;
 *  - ein geändertes Skript zählt nur, wenn die Kette es (direkt oder über `npm run`) ruft UND seine Pfade (samt Importen) eine PR-Datei treffen;
 *    ein Glob (`extension/*.js`) und eine Konfigurationsdatei (`-p extension/tsconfig.json`) gelten für ihren ganzen Ordner;
 *  - ein Skriptteil (je `&&`) ohne erkennbaren Pfad, mit fremder Option (`--mode`, `--teil`), Punkt-Argument oder Läufer (`tests-alle`) lässt sich nicht eingrenzen: im Zweifel veraltet;
 *    ein Verzeichnis-Argument (`web/src`) gilt für seinen ganzen Ordner; `pre`-/`post`-Hooks der Kettenskripte und der Install-Lebenszyklus gelten kettenweit.
 * Rein: die Texte kommen als Parameter (`paketGrund`), das Lesen aus git steht in `pr-nachrechnen-paket-git.mjs`.
 */
import { huelle, pfadTokens } from './pr-nachrechnen-leser.mjs'

/** `npm run x`, `npm run-script x`, mit Flags dazwischen (`npm --silent run x`, `npm run --if-present x`). */
const NPM_FLAGS = '(?:-{1,2}[\\w-]+(?:=\\S+)?\\s+)*'
const NPM_RUN_QUELLE = `\\bnpm\\s+${NPM_FLAGS}run(?:-script)?\\s+${NPM_FLAGS}([\\w:.-]+)`
const NPM_RUN = new RegExp(NPM_RUN_QUELLE, 'g')
/** `npm test`, `npm start` (ohne `run`). */
const NPM_KURZ_QUELLE = `\\bnpm\\s+${NPM_FLAGS}(test|start)\\b(?!:)`
const NPM_KURZ = new RegExp(NPM_KURZ_QUELLE, 'g')
/** Läuft bei jedem `npm ci` der Einrichten-Actions. */
const LEBENSZYKLUS = ['preinstall', 'install', 'postinstall', 'prepare']
const WURZELN = '(?:\\.github|data|public|tools|pipeline|shared|web|worker|extension)'
/** Optionen, die nur einen Pfad oder Schalter ohne Wirkung auf den Umfang tragen; jede andere Option macht das Skript unklar. */
const NEUTRAL = new Set(['--noEmit', '-p', '--project', '--config', '-c'])
/** Läufer, die ihre Liste oder einen Glob ohne Import lesen (`--teil 2/3`, neue Testdatei). */
const LAEUFER = /(?:^|\/)(?:tests-alle|check-logic-alle)\.mjs$/
/** Ordner eines Globs im Skriptwert (`extension/*.js`, `tools/*.test.mjs`). */
const GLOB = new RegExp(`(?:^|[^\\w./-])(${WURZELN}(?:/[\\w./@-]*?)?)/[\\w./@-]*[*{]`, 'g')
/** Konfigurationsdateien, die einen ganzen Ordner einlesen (`tsc -p extension/tsconfig.json`, `eslint --config extension/eslint.config.mjs`). */
const KONFIG = /(?:^|\/)(?:tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/

const VOR = 'main bewegte package.json'

/** Ordner, die ein Skriptteil nennt: Glob, Konfigurationsordner, Verzeichnis-Argument (`web/src`) und bloßer Wurzelname (`pipeline tools`). */
const ordnerVon = (teil) => {
  const ordner = [...teil.matchAll(GLOB)].map((m) => m[1])
  for (const t of pfadTokens(teil)) {
    if (KONFIG.test(t) && t.includes('/')) ordner.push(t.slice(0, t.lastIndexOf('/')))
    else if (!t.split('/').pop().includes('.')) ordner.push(t)
  }
  for (const w of teil.split(/\s+/)) if (new RegExp(`^${WURZELN}$`).test(w)) ordner.push(w)
  return ordner.map((o) => `${o}/`)
}

/** Grund, warum sich ein Skriptteil nicht eingrenzen lässt (Option, Punkt-Argument, Läufer), sonst null. */
function unklar(teil) {
  for (const w of teil.split(/\s+/)) {
    if (/^\.{1,2}\/?$/.test(w)) return `mit Argument ${w}`
    if (LAEUFER.test(w)) return `mit Läufer ${w}`
    if (w.startsWith('-') && !NEUTRAL.has(w.split('=')[0])) return `mit Option ${w}`
  }
  return null
}

const REINER_NPM = new RegExp(`^(?:${NPM_RUN_QUELLE}|${NPM_KURZ_QUELLE})\\s*$`)

/** Teile eines Skriptwerts ohne lesbare reine `npm`-Aufrufe (deren Ziele werden als eigene Skripte beurteilt; ein unlesbarer bleibt ein Teil und gilt als unklar). */
const eigeneTeile = (skript) => skript.split(/&&|\|\||;/).map((t) => t.trim()).filter((t) => t !== '' && !REINER_NPM.test(t))

const npmZiele = (text) => [...text.matchAll(NPM_RUN), ...text.matchAll(NPM_KURZ)].map((m) => m[1])

/** Namen aller Skripte, die die Kette direkt oder über `npm run` ruft, samt ihren `pre`-/`post`-Hooks und dem Install-Lebenszyklus. */
export function kettenSkripte(kettenTexte, skripte) {
  const namen = new Set()
  const offen = [...kettenTexte.flatMap(npmZiele), ...LEBENSZYKLUS.filter((n) => skripte[n] !== undefined)]
  while (offen.length > 0) {
    const name = offen.shift()
    if (namen.has(name)) continue
    namen.add(name)
    offen.push(...npmZiele(skripte[name] ?? ''), ...[`pre${name}`, `post${name}`].filter((h) => skripte[h] !== undefined))
  }
  return namen
}

/** Ein Hook läuft bei jedem Aufruf seines Skripts, nicht nur bei einer Datei im Pfad: Änderung gilt kettenweit. */
const istHook = (name, kette) => LEBENSZYKLUS.includes(name) || (/^(?:pre|post)/.test(name) && kette.has(name.replace(/^(?:pre|post)/, '')))

const lesen = (text) => {
  try {
    return JSON.parse(text)
  } catch (fehler) {
    console.warn(`pr-nachrechnen-paket: JSON nicht lesbar (${fehler.message})`)
    return null
  }
}

/** Felder außer `scripts`, deren Wert sich unterscheidet. */
const geaenderteFelder = (alt, neu) => [...new Set([...Object.keys(alt), ...Object.keys(neu)])].filter((k) => k !== 'scripts' && JSON.stringify(alt[k]) !== JSON.stringify(neu[k]))

/** Treffer eines Skripts mit den PR-Dateien: `null` = keiner, sonst der Grund (Datei oder fehlender Pfad). */
function skriptTreffer(name, wert, prDateien, lies) {
  for (const teil of eigeneTeile(wert)) {
    const tokens = pfadTokens(teil)
    const ordner = ordnerVon(teil)
    if (tokens.length === 0 && ordner.length === 0) return `${VOR}: Skript ${name} ohne erkennbaren Pfad`
    const offen = unklar(teil)
    if (offen !== null) return `${VOR}: Skript ${name} ${offen}`
    const menge = huelle(tokens, lies)
    const datei = prDateien.find((p) => menge.has(p) || ordner.some((o) => p.startsWith(o)))
    if (datei !== undefined) return `${VOR}: Skript ${name} läuft in der Kette und trifft ${datei}`
  }
  return null
}

/**
 * null = die Bewegung von package.json entwertet den PR nicht, sonst der Grund.
 * `alt`/`neu`: Text von package.json auf der Kettenbasis und auf main; `kettenTexte`: Workflow und Actions der Kette auf main;
 * `lies(pfad)`: Text einer Code-Datei auf main (für die Importe) oder null.
 */
export function paketGrund({ alt, neu, prDateien, kettenTexte, lies }) {
  const a = lesen(alt ?? '')
  const n = lesen(neu ?? '')
  if (a === null || n === null) return `${VOR} nicht vergleichbar`
  const felder = geaenderteFelder(a, n)
  if (felder.length > 0) return `${VOR} (${felder.join(', ')})`
  const skripte = n.scripts ?? {}
  const geaendert = Object.keys(skripte).filter((k) => skripte[k] !== (a.scripts ?? {})[k])
  if (geaendert.length === 0) return null
  if (kettenTexte.length === 0) return `${VOR} (Kettendateien nicht gelesen)`
  const kette = kettenSkripte(kettenTexte, skripte)
  for (const name of geaendert.filter((k) => kette.has(k))) {
    if (istHook(name, kette)) return `${VOR}: Skript ${name} ist ein Hook der Kette`
    const grund = skriptTreffer(name, skripte[name], prDateien, lies)
    if (grund !== null) return grund
  }
  return null
}
