/**
 * package.json auf main im Nachrechnen (12.11.2026): bisher entwertete jede Bewegung jeden PR (16:41: neun Neustarts durch eine Änderung
 * des Skripts `check:extension`, kein PR berührte `extension/`). Jetzt zählt nur, was die Kette wirklich ändert:
 *  - alles außer `scripts` (Pakete, `overrides`, `engines` ...) bleibt kettenweit;
 *  - ein geändertes Skript zählt nur, wenn die Kette es (direkt oder über `npm run`) ruft UND seine Pfade (samt Importen) eine PR-Datei treffen;
 *    ein Glob (`extension/*.js`) und eine Konfigurationsdatei (`-p extension/tsconfig.json`) gelten für ihren ganzen Ordner;
 *  - ein Skript ohne erkennbaren Pfad (`tsc --noEmit`, `eslint .`) lässt sich nicht eingrenzen: im Zweifel veraltet.
 * Rein: die Texte kommen als Parameter (`paketGrund`), das Lesen aus git steht in `pr-nachrechnen-paket-git.mjs`.
 */
import { huelle, pfadTokens } from './pr-nachrechnen-leser.mjs'

const NPM_RUN = /\bnpm\s+run(?:-script)?\s+([\w:.-]+)/g
const WURZELN = '(?:\\.github|data|public|tools|pipeline|shared|web|worker|extension)'
/** Ordner eines Globs im Skriptwert (`extension/*.js`, `tools/*.test.mjs`). */
const GLOB = new RegExp(`(?:^|[^\\w./-])(${WURZELN}(?:/[\\w./@-]*?)?)/[\\w./@-]*[*{]`, 'g')
/** Konfigurationsdateien, die einen ganzen Ordner einlesen (`tsc -p extension/tsconfig.json`, `eslint --config extension/eslint.config.mjs`). */
const KONFIG = /(?:^|\/)(?:tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/

const VOR = 'main bewegte package.json'

const ordnerVon = (skript) => {
  const ordner = [...skript.matchAll(GLOB)].map((m) => m[1])
  for (const t of pfadTokens(skript)) if (KONFIG.test(t) && t.includes('/')) ordner.push(t.slice(0, t.lastIndexOf('/')))
  return ordner.map((o) => `${o}/`)
}

/** Teile eines Skriptwerts ohne reine `npm run`-Aufrufe (deren Ziele werden als eigene Skripte beurteilt). */
const eigeneTeile = (skript) => skript.split(/&&|\|\||;/).map((t) => t.trim()).filter((t) => t !== '' && !/^npm\s+run(?:-script)?\s/.test(t))

/** Namen aller Skripte, die die Kette direkt oder über `npm run` ruft. */
export function kettenSkripte(kettenTexte, skripte) {
  const namen = new Set()
  const offen = kettenTexte.flatMap((t) => [...t.matchAll(NPM_RUN)].map((m) => m[1]))
  while (offen.length > 0) {
    const name = offen.shift()
    if (namen.has(name)) continue
    namen.add(name)
    offen.push(...[...(skripte[name] ?? '').matchAll(NPM_RUN)].map((m) => m[1]))
  }
  return namen
}

const lesen = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Felder außer `scripts`, deren Wert sich unterscheidet. */
const geaenderteFelder = (alt, neu) => [...new Set([...Object.keys(alt), ...Object.keys(neu)])].filter((k) => k !== 'scripts' && JSON.stringify(alt[k]) !== JSON.stringify(neu[k]))

/** Treffer eines Skripts mit den PR-Dateien: `null` = keiner, sonst der Grund (Datei oder fehlender Pfad). */
function skriptTreffer(name, wert, prDateien, lies) {
  const teile = eigeneTeile(wert)
  if (teile.length === 0) return null
  const text = teile.join('\n')
  const tokens = pfadTokens(text)
  const ordner = ordnerVon(text)
  if (tokens.length === 0 && ordner.length === 0) return `${VOR}: Skript ${name} ohne erkennbaren Pfad`
  const menge = huelle(tokens, lies)
  const datei = prDateien.find((p) => menge.has(p) || ordner.some((o) => p.startsWith(o)))
  return datei === undefined ? null : `${VOR}: Skript ${name} läuft in der Kette und trifft ${datei}`
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
    const grund = skriptTreffer(name, skripte[name], prDateien, lies)
    if (grund !== null) return grund
  }
  return null
}
