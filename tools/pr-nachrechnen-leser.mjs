/**
 * Leser-Regel für `pr-nachrechnen.mjs` (26.10.2026, Befund PR 2043: ein Workflow-PR wurde fünfmal durch reine Bot-Daten entwertet, weil
 * jede Datei außer Doku als „liest Daten“ galt). Ein Bot-Sprung entwertet einen PR nur, wenn er eine bewegte Datei berührt oder Code,
 * der sie liest, mit dem Code des PR zusammenhängt: der PR ruft den Leser auf bzw. importiert ihn, oder der Leser nutzt eine Datei des PR.
 * Verknüpfung (`huelle`): relative Importe, Pfade mit Ordnerkopf im Text (Aufrufe wie `node tools/x.mjs`, Daten-Literale). Ein Pfad trifft nur
 * genau diese Datei (kein Ordner-, Präfix- oder Listen-Treffer); Pfad-Tokens von Tests und Ausführungslisten verknüpfen nichts, von der Liste
 * zählen nur neue Einträge. Vorwärts folgt die Hülle Importen ohne Grenze, rückwärts (Leser nutzt PR-Code) bis zwei Stufen und nur von Lesern
 * außerhalb von Tests und von `tools/` (außer `tools/check-*`); ein Test ist für Daten nur Leser, wenn eine Zeile Dateiname und Lese-Aufruf
 * nennt. Die Ordner-Regel (`readdir`, `'data/' + f`) gilt nicht für Tests. `npm run`
 * wird nicht aufgelöst; `package.json` zählt nur mit den Skripten, deren Wert der PR ändert. Im Zweifel (Git nicht lesbar, package.json nicht vergleichbar)
 * gilt der PR als betroffen. Grenze: ein zur Laufzeit zusammengesetzter Pfad fällt nicht auf.
 */
import path from 'node:path'
import { handdatenPr, kennungsschnitt } from './pr-nachrechnen-kennung.mjs'

/**
 * PR-Pfade ohne Leser in der Kette (Doku, Daniel-Dateien, Patch Notes, Markdown im Wurzelordner). `.claude/` (Agenten, Hooks, Regeln
 * für die Sitzung des Nutzers) läuft nie in der PR-Kette; Anlass PR 3310: ein Hook mit `readdir` auf `data/` galt viermal als Ordner-Leser.
 */
export const OHNE_DATENLESER = ['docs/', 'daniel-zum-abarbeiten/', 'data/patchnotes/', '.claude/']
export const ohneLeser = (datei) => OHNE_DATENLESER.some((p) => datei.startsWith(p)) || /^[^/]+\.md$/.test(datei)

const ENDUNGEN = ['.ts', '.tsx', '.mjs', '.cjs', '.mts', '/index.ts']
const CODE = /\.(ts|tsx|mjs|cjs|mts)$/
/** Ausführungslisten (welche Prüfungen laufen): ihr Inhalt zählt als Aufruf, sie selbst werden von keinem Leser „genutzt“. */
const LISTE = /-liste\.txt$/
/** Nur hier gibt es Blockkommentare; in Shell/YAML öffnet ein Glob (`data/` + Stern) sonst einen Scheinblock und verschluckt echte Lesungen. */
const JS_FAMILIE = /\.(ts|tsx|mjs|cjs|mts|js)$/
/** Nur diese Dateien werden gelesen (Skripte, Workflows, Ausführungslisten); Daten, Markdown und Bilder bleiben Blätter. */
export const LESBAR = /(\.(ts|tsx|mjs|cjs|mts|js|sh|ya?ml)|-liste\.txt)$/
const PFAD = /(?:^|[^\w./-])((?:\.github|data|public|tools|pipeline|shared|web|worker|extension)\/[\w./@-]*\w)/g
const KOMMENTAR = /^\s*(\/\/|\*|\/\*|#)/

/** Ein `/` an dieser Stelle (letztes Zeichen davor) beginnt ein Regex-Literal, keine Division. */
const REGEX_VOR = /[(,=:[!&|?{};+*<>~^%-]$/

/** Ende des Regex-Literals ab `i` (Index hinter dem schließenden `/`); Klassen `[…]` und `\`-Zeichen werden übersprungen. */
function regexEnde(text, i) {
  let klasse = false
  for (let k = i + 1; k < text.length && text[k] !== '\n'; k++) {
    if (text[k] === '\\') k++
    else if (text[k] === '[') klasse = true
    else if (text[k] === ']') klasse = false
    else if (text[k] === '/' && !klasse) return k + 1
  }
  return i + 1
}

/**
 * Entfernt Blockkommentare über mehrere Zeilen (Zeilenumbrüche bleiben), auch wenn die Innenzeilen keinen Stern tragen. Zeichenketten,
 * Vorlagen, Regex-Literale und Zeilenkommentare werden übersprungen: `'data/*.json'` beginnt keinen Kommentar. Code hinter dem Kommentarende bleibt.
 * Grenzen: Vorlagen mit `${…}` und innerem Backtick kippen die Zeichenkettenzählung; ein Regex-Literal nach `)` oder `}` gilt als Division
 * (beides selten, festgehalten in den Tests „Grenze: …“).
 */
export function ohneBlockkommentare(text) {
  let aus = ''
  for (let i = 0; i < text.length;) {
    const z = text[i]
    const naechste = text[i + 1]
    let ende = i + 1
    const schluss = z === '/' && naechste === '*' ? text.indexOf('*/', i + 2) : -1
    if (schluss !== -1) {
      aus += text.slice(i, schluss + 2).replace(/[^\n]/g, '')
      i = schluss + 2
      continue
    }
    if (z === '/' && naechste === '/') ende = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i)
    else if (z === '/' && REGEX_VOR.test(aus.trimEnd().slice(-1) || '(')) ende = regexEnde(text, i)
    else if (z === '"' || z === "'" || z === '`') {
      for (ende = i + 1; ende < text.length && text[ende] !== z && (z === '`' || text[ende] !== '\n'); ende++) if (text[ende] === '\\') ende++
      ende = Math.min(ende + 1, text.length)
    }
    aus += text.slice(i, ende)
    i = ende
  }
  return aus
}

export const ohneKommentare = (text, datei = '') => (JS_FAMILIE.test(datei) ? ohneBlockkommentare(text) : text).split('\n').filter((z) => !KOMMENTAR.test(z)).join('\n')

/** Relative Importe mit Literal als Kandidatenpfade (mit und ohne Endung), relativ zur Wurzel. */
export function importZiele(datei, text) {
  const ziele = []
  for (const m of text.matchAll(/['"`](\.{1,2}\/[^'"`\n]+)['"`]/g)) {
    const basis = path.posix.normalize(path.posix.join(path.posix.dirname(datei), m[1]))
    ziele.push(basis, ...ENDUNGEN.map((ende) => basis + ende))
  }
  return ziele
}

/** Pfade mit Ordnerkopf im Text außerhalb von Kommentarzeilen. */
export const pfadTokens = (text, datei) => [...new Set([...ohneKommentare(text, datei).matchAll(PFAD)].map((m) => m[1]))]

const importeVon = (datei, text) => (CODE.test(datei) ? importZiele(datei, text) : [])

/** Ein Name trifft nur genau diese Datei: Ordner-, Präfix- und Listen-Treffer waren Fehlalarme (10.11.2026, PR 3341/3347/3305). */
export const trifft = (name, datei) => datei === name

/**
 * Tests nennen Pfade als Fixture-Text (`pipeline/build.ts`), ohne sie zu lesen: ihre Pfad-Tokens verknüpfen nichts
 * (10.11.2026: der Test von PR 3341 führte über `pipeline/build.ts` bis `09-4-crunchyroll-dub.ts`). Ihre Importe zählen weiter.
 */
export const istTest = (datei) => /\.test\.[mc]?[jt]sx?$/.test(datei)

const RUECK_TIEFE = 2
const DATEN = /^(data|public|daniel-zum-abarbeiten)\//
/** Lesender Aufruf (`readFileSync(new URL('../data/x.json', import.meta.url))`, `resolve(…)`) in derselben Zeile wie der Dateiname. */
const LESEN = /readFile|createReadStream|import\.meta\.url|\bresolve\(/

/**
 * Ein Test, der eine Datendatei nur als String-Fixture nennt, ist dafür kein Leser; liest er sie wirklich (Zeile mit Dateiname und
 * Lese-Aufruf, z. B. handbeleg-treffer.test.mjs mit data/dub-confirmed.yaml), bleibt er einer. Bewegten Code importiert oder startet er
 * immer wirklich (PR 3269: wache-limit-haenger.test.mjs und pr-pruefer-modus.mjs). Grenze: ein Lese-Aufruf über mehrere Zeilen fällt nicht auf.
 */
const liestTestDatei = (pfad, text, bewegt) => {
  if (!istTest(pfad) || !DATEN.test(bewegt)) return true
  const name = bewegt.split('/').pop()
  return ohneKommentare(text, pfad).split('\n').some((z) => z.includes(name) && LESEN.test(z))
}

/**
 * Alle von `start` aus erreichbaren Namen (Dateien und Pfad-Tokens). Pfad-Tokens (Aufrufe, Listen von Dateinamen) folgt nur die
 * Startdatei selbst: Tests und Ausnahmelisten nennen Dutzende Pfade, über mehrere Stufen wüchse jede Hülle auf den ganzen Baum
 * (gemessen 26.10.2026 an PR 2043); Importen folgt die Hülle bis `maxTiefe` (vorwärts ohne Grenze, rückwärts `RUECK_TIEFE`), Tests geben keine Tokens weiter.
 */
export function huelle(start, lies, maxTiefe = Infinity) {
  const namen = new Set(start)
  const offen = start.map((datei) => [datei, true, 0])
  while (offen.length > 0) {
    const [datei, startdatei, tiefe] = offen.shift()
    const text = tiefe < maxTiefe && LESBAR.test(datei) ? lies(datei) : null
    if (text === null) continue
    for (const ziel of [...importeVon(datei, text), ...(startdatei && !istTest(datei) ? pfadTokens(text, datei) : [])]) {
      if (namen.has(ziel)) continue
      namen.add(ziel)
      offen.push([ziel, false, tiefe + 1])
    }
  }
  return namen
}

const WURZELN = '(?:\\.github|data|public|tools|pipeline|shared|web|worker|extension)'
/** Ordnerpfad, an den der Code einen Namen anhängt (`'data/' + f`, `` `data/${n}` ``): der Leser einer Datei darunter, ohne ihren Namen zu nennen. */
const ORDNER_ANHANG = new RegExp(`(?:^|[^\\w./-])(${WURZELN}(?:/[\\w./@-]*)?)/(?=['"\`]|\\$\\{)`, 'g')
/** Ordnerpfad als eigenes Literal, nur zusammen mit einem Verzeichnis-Aufruf (`readdirSync('data')`, `glob`) ein Leser. */
const ORDNER_LITERAL = new RegExp(`(?:^|[^\\w./-])(${WURZELN}(?:/[\\w./@-]*\\w)?)(?=['"\`])`, 'g')
const VERZEICHNIS_AUFRUF = /readdir|opendir|scandir|\bglob(?:Sync)?\b/i
/**
 * Schreibender Aufruf vor dem Fund, ohne `;` dazwischen: ein Anhang darin legt eine Datei an, liest keine (PR 3541: `schreibe(`data/${leer}`, …)`).
 * Nicht dabei: `copyFile…` (sein erstes Argument ist eine Lesung, PR 3555) und `rename…`. Grenze: Zeilenweise Sicht; ein Schreibaufruf über mehrere Zeilen
 * mit Anhang in einer Folgezeile bleibt Leser (sicher). Eine Lesung innerhalb der Argumente (`writeFileSync(x, readFileSync(`data/${n}`))`) bleibt Leser.
 */
const SCHREIB_AUFRUF = /\b(?:schreibe\w*|write\w*|append\w*|mkdir\w*|rm\w*)\(([^;]*)$/i
const LESUNG_IM_ARGUMENT = /\b(?:read|lies|glob|opendir|scandir|copyFile)\w*\(/i

function lesenderAnhang(code, m) {
  const zeilenStart = code.lastIndexOf('\n', m.index) + 1
  const schreib = SCHREIB_AUFRUF.exec(code.slice(zeilenStart, m.index))
  return schreib === null || LESUNG_IM_ARGUMENT.test(schreib[1])
}

/** Ordner-Tokens des Codes (ohne Kommentare), die ein Verzeichnis lesen oder einen Namen darunter zusammensetzen. */
export function ordnerTokens(text, datei) {
  const code = ohneKommentare(text, datei)
  const anhang = [...code.matchAll(ORDNER_ANHANG)].filter((m) => lesenderAnhang(code, m)).map((m) => m[1])
  const literal = VERZEICHNIS_AUFRUF.test(code) ? [...code.matchAll(ORDNER_LITERAL)].map((m) => m[1]) : []
  return [...new Set([...anhang, ...literal])]
}

const ENDUNG_LITERAL = /endsWith\(\s*['"`]\.([\w.]+)['"`]|\}\.([\w.]+)['"`]/g
const ENDUNG_REGEX = /\\\.(\([^)]*\)|[\w?|]+)\$\//g

/**
 * Endungs-Bedingungen des Codes (`.endsWith('.sh')`, `/\.ya?ml$/`, `` `tools/${n}.mjs` ``) als Dateinamen-Tests; leer, wenn er keine nennt.
 * Ein Leser, der ein Verzeichnis nur über solche Namen liest, sieht eine Datei anderer Endung nicht (PR 3367/3282, 11.11.2026).
 */
export function endungsTests(code) {
  return endungsAuswertung(code).tests
}

/** Wie `endungsTests`, dazu die Zahl der Regex-Treffer, die keine gültige Regex ergeben (z. B. der eigene Template-String dieses Moduls): sie werden übersprungen. */
export function endungsAuswertung(code) {
  const lit = [...code.matchAll(ENDUNG_LITERAL)].map((m) => (name) => name.endsWith(`.${m[1] ?? m[2]}`))
  const reg = []
  let uebersprungen = 0
  for (const m of code.matchAll(ENDUNG_REGEX)) {
    try {
      const re = new RegExp(`\\.(?:${m[1].replace(/^\(|\)$/g, '')})$`)
      reg.push((name) => re.test(name))
    } catch {
      uebersprungen++
    }
  }
  return { tests: [...lit, ...reg], uebersprungen }
}

/** Zusatz für den Grund-Text, wenn Endungs-Muster des Codes keine gültige Regex waren und übersprungen wurden. */
const ungueltigeMuster = (text, datei) => {
  const n = endungsAuswertung(ohneKommentare(text, datei)).uebersprungen
  return n === 0 ? '' : ` (${n} Endungs-Muster ohne gültige Regex übersprungen)`
}

/** Erste bewegte Datei, die unter einem Ordner-Token des Codes liegt (nicht der Token selbst als Datei) und deren Endung der Code nicht ausschließt. */
export function ordnerLeser(text, bewegt, datei) {
  const tests = endungsTests(ohneKommentare(text, datei))
  const sichtbar = (b) => tests.length === 0 || tests.some((t) => t(b))
  return bewegt.find((b) => sichtbar(b) && ordnerTokens(text, datei).some((t) => b.startsWith(`${t}/`)))
}

/**
 * Dateien aus `texte` (Karte Pfad -> Inhalt), die den Namen einer bewegten Datei außerhalb von Kommentaren nennen, sortiert. Die Nachrechnen-Werkzeuge
 * zählen nie (`istNachrechnenWerkzeug`): sie führen Pfade der Läufe als Muster und Liste (12.11.2026, PR 3572: `pr-nachrechnen-bot-erzeugt.mjs` „liest“ Bot-Daten).
 */
export const leserIn = (texte, bewegt) => [...texte].filter(([pfad, text]) => !LISTE.test(pfad) && !istNachrechnenWerkzeug(pfad) && bewegt.some((b) => liestTestDatei(pfad, text, b) && nennt(text, b, pfad))).map(([pfad]) => pfad).sort()

/** Markdown unter `.claude/` (Skills, Agenten, Regeln): Namen wie `SKILL.md` und `bauer.md` stehen in vielem Code, ohne dass er die Datei liest. */
export const istClaudeMd = (datei) => /^\.claude\/.+\.md$/.test(datei)

/** Nennt der Text (ohne Kommentare) den Namen der Datei (der Pfad enthält ihn, `join(ordner, 'a.json')` nennt nur den Namen)? Bei `.claude`-Markdown zählt nur der volle Pfad. */
export const nennt = (text, bewegt, datei) => {
  const code = ohneKommentare(text, datei)
  if (istClaudeMd(bewegt)) return code.includes(bewegt)
  return nenntName(code, bewegt.split('/').pop())
}

/** Der Name steht nicht als Ende eines längeren Namens: `adn-anisearch-offen.json` nennt `anisearch-offen.json` nicht (12.11.2026: 6 von 9 „Lesern“ der Datei, PR 3494). */
const nenntName = (code, name) => new RegExp(`(?<![\\w.-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(code)

/** Ein Test, der den vollen Pfad einer bewegten `.claude`-Markdown-Datei nennt, liest sie wirklich (kein Fixture-Name): er hängt dann an dem Code, den er importiert. */
const liestClaudeMd = (datei, bewegt, lies) => bewegt.some((b) => istClaudeMd(b) && nennt(lies(datei) ?? '', b, datei))

/**
 * Daten, die der Bau mit der bewegten Datei in einem Lauf verarbeitet (kuratierte Daten, Handbelege, Sammlerdaten): ändert der PR sie und
 * liest ein Bau-Leser (`istBauLeser`) eine bewegte Nicht-Bot-Datei, kann die Kombination neu kippen, auch ohne dass der PR-Code sie nennt.
 * Bewegte Bot-Dateien zählen hier nicht (`botBewegt`, seit 11.11.2026), bei einem reinen Bot-Sprung wird diese Regel gar nicht gefragt (`reinerBotSprung`).
 */
const aendertBauDaten = (datei) => datei.startsWith('data/')

/** Shell-Tests (`commit-data-test*.sh`, `bau-schon-gebaut-test.sh`) schreiben Fixtures in Wegwerf-Repos und lesen nie echte Daten (geprüft 11.11.2026). */
const istShellTest = (datei) => /^tools\/[\w-]*-test(-[\w-]+)?\.sh$/.test(datei)

/** Leser, die Daten wirklich lesen können: alles außer Tests und Workflows/Aktionen, die nur Fixtures oder Namen nennen (PR 3474, 11.11.2026). */
const istBauLeser = (datei) => !istTest(datei) && !istShellTest(datei) && !istNachrechnenWerkzeug(datei) && !datei.startsWith('.github/')

/**
 * Nachrechnen-Werkzeuge nennen `data/…` nur als Muster oder Fixture, der Bau liest sie nie (12.11.2026: nach PR 3555 galten
 * `tools/pr-nachrechnen-bot-pfade-leser.mjs` & Co. als Leser von `data/verweise-von-hand.yaml`). Grenze: andere `tools/*` bleiben Leser
 * (`tools/pr-*` allgemein nicht: `pipeline/` importiert `tools/pr-basis.mjs`, gemessen 12.11.2026); die Familie ist nur `pr-nachrechnen*` und `nachrechnen-*`.
 */
const istNachrechnenWerkzeug = (datei) => /^tools\/(pr-nachrechnen|nachrechnen-)[\w.-]*$/.test(datei)

/** Der Bau-Kern (pipeline/, shared/, tools/check-*) steht in Meldungen vor Werkzeugen und Workflows: sonst liest man „Leser: pr-pruefer.yml“ als Fehlalarm (11.11.2026). */
const kernZuerst = (liste) => [...liste].sort((a, b) => Number(KERN.test(b)) - Number(KERN.test(a)))
const KERN = /^(pipeline\/|shared\/|tools\/check-)/

/** Bau-Leser, die eine der bewegten Dateien wirklich nennen, je Leser und genannter Datei ein Paar; Kern zuerst. Nicht lesbarer Text zählt als Leser der ersten bewegten Datei (fail-closed). */
const bauLeserMitDatei = (leser, bewegt, lies) => kernZuerst(leser.filter(istBauLeser)).flatMap((l) => {
  const text = lies(l)
  if (text === null) return [{ leser: l, bewegt: bewegt[0] }]
  return bewegt.filter((x) => liestTestDatei(l, text, x) && nennt(text, x, l)).map((x) => ({ leser: l, bewegt: x }))
})

/** Höchstens so viele Leser je bewegter Datei nennt der Grund, der Rest als „und n weitere“. */
export const LESER_ANZEIGE = 5

/** „Leser: a, b und 2 weitere, nennt F“, je bewegter Datei ein Abschnitt in Reihenfolge des ersten Auftretens. */
export function leserText(paare) {
  return [...new Set(paare.map((p) => p.bewegt))].map((datei) => {
    const namen = paare.filter((p) => p.bewegt === datei).map((p) => p.leser)
    const mehr = namen.length - LESER_ANZEIGE
    return `Leser: ${namen.slice(0, LESER_ANZEIGE).join(', ')}${mehr > 0 ? ` und ${mehr} weitere` : ''}, nennt ${datei}`
  }).join('; ')
}

/** Die bewegten Dateien, die der Leser nennt, für den Grund (nicht lesbar: alle bewegten). */
const genannte = (leser, bewegt, lies) => {
  const text = lies(leser)
  return (text === null ? bewegt : bewegt.filter((x) => liestTestDatei(leser, text, x) && nennt(text, x))).join(', ')
}

/** Leser, die mindestens eine Nicht-Bot-Datei nennen (nicht lesbarer Text bleibt, fail-closed). */
const leserOhneBot = (leser, bewegt, botBewegt, lies) => {
  const wirksam = bewegt.filter((b) => !botBewegt.includes(b))
  return leser.filter((l) => lies(l) === null || wirksam.some((b) => liestTestDatei(l, lies(l), b) && nennt(lies(l), b, l)))
}

/**
 * Dateien, die von Code genutzt werden, der bewegte Daten liest. Bewegter Code (neue Prüfung auf main) liest PR-Code oder -Daten, ohne dass ihn jemand
 * nennt (tests-alle sammelt per readdir). Bis zwei Importstufen vom Leser aus (Bauphase -> Helfer -> Kern). Tests und Werkzeuge unter tools/ außer
 * tools/check-* nennen Daten in Ausnahmelisten und Fixtures (workflows-beleg.mjs: crunchyroll-neu.json, Replay PR 3341), ohne sie zu lesen.
 */
const rueckMenge = (leser, bewegt, lies) => {
  const bewegterCode = bewegt.filter((b) => LESBAR.test(b) && !LISTE.test(b))
  const rueckLeser = leser.filter((r) => (!r.startsWith('tools/') || r.startsWith('tools/check-')) && !istTest(r))
  const rueckwaerts = new Set(huelle([...rueckLeser, ...bewegterCode], lies, RUECK_TIEFE))
  huelle(leser.filter((r) => liestClaudeMd(r, bewegt, lies)), lies, RUECK_TIEFE).forEach((n) => rueckwaerts.add(n))
  return rueckwaerts
}

/** Einträge einer Ausführungsliste, die der PR neu aufnimmt (Pfade im Kopf, die main nicht hat): nur sie laufen neu gegen die Daten. */
const neueEintraege = (liste, lies, liesMain) => {
  const alt = new Set(pfadTokens(liesMain(liste) ?? '', liste))
  return pfadTokens(lies(liste) ?? '', liste).filter((t) => !alt.has(t))
}

/** Skript-Werte aus package.json, die sich zwischen alt und neu unterscheiden, als ein Text; null, wenn nicht lesbar. */
export function geaenderteSkripte(altJson, neuJson) {
  try {
    const alt = JSON.parse(altJson).scripts ?? {}
    const neu = JSON.parse(neuJson).scripts ?? {}
    return Object.keys(neu).filter((k) => neu[k] !== alt[k]).map((k) => neu[k]).join('\n')
  } catch {
    return null
  }
}

/**
 * null = kein Zusammenhang (Ausnahme gilt), sonst der Grund.
 * `bewegt`: die bewegten Dateien, die ein Leser sehen kann (ohne Bot-Dateien ohne Leser, public/data, data/cache).
 * `pr`: Dateien des PR. `leser`: Dateien auf main, die eine bewegte Datei im Code nennen. `lies(pfad)`: Text oder null (Kopf, sonst main).
 * `botBewegt`: bewegte Bot-Dateien; im Datenkanal zählen sie nicht (wie im reinen Bot-Sprung entwertet nur ihre Berührung durch den PR; 11.11.2026, PR 3490/3474).
 * `paketSkripte`: geänderte Skripte aus package.json (null = nicht lesbar), nur gebraucht, wenn der PR package.json berührt.
 * `frei`: Dateien, die PR und main ändern, ohne sich im Textmerge zu berühren (`pr-nachrechnen-textmerge.mjs`); sie zählen nicht als „berührt“.
 * `kennung`: Kennungen des Handdaten-PR und main-Diff der bewegten Nicht-Bot-Dateien (`pr-nachrechnen-kennung.mjs`, F133); fehlt es oder trägt es `fehler`, gelten die Regeln unten unverändert.
 */
export function bewegtesGelesen({ bewegt, pr, leser, lies, liesMain = () => null, paketSkripte, botBewegt = [], frei = new Set(), kennung }) {
  if (bewegt.length === 0) return null
  const treffer = pr.find((p) => bewegt.includes(p) && !frei.has(p))
  if (treffer !== undefined) return `der PR berührt ${treffer}`
  if (kennung !== undefined && kennung.fehler === undefined && handdatenPr(pr, ohneLeser)) return kennungsschnitt(bewegt, kennung)
  const eigene = pr.filter((p) => !ohneLeser(p) && p !== 'package.json')
  const daten = eigene.find(aendertBauDaten)
  const bauLeser = daten === undefined ? [] : bauLeserMitDatei(leser, bewegt.filter((b) => !botBewegt.includes(b)), lies)
  if (bauLeser.length > 0) return `der PR ändert ${daten}, das der Bau mit den bewegten Dateien zusammen liest (${leserText(bauLeser)})`
  let start = eigene.flatMap((p) => (LISTE.test(p) ? neueEintraege(p, lies, liesMain) : [p]))
  if (pr.includes('package.json')) {
    if (paketSkripte === null) return 'package.json nicht vergleichbar'
    start = [...start, ...pfadTokens(paketSkripte, 'package.json')]
  }
  for (const p of eigene.filter((d) => LESBAR.test(d))) {
    // Eine Ausführungsliste nennt jede Prüfung, nur ihre neuen Einträge sind PR-Code (10.11.2026: sonst entwertet jeder bewegte Wächter jeden Listen-PR).
    const text = LISTE.test(p) ? neueEintraege(p, lies, liesMain).join('\n') : lies(p)
    const b = text === null ? undefined : bewegt.find((x) => liestTestDatei(p, text, x) && nennt(text, x, p))
    if (b !== undefined) return `der PR liest ${b} (${p})`
    const ordner = text === null ? undefined : ordnerLeser(text, bewegt.filter((x) => !istTest(p) || (!DATEN.test(x) && !LISTE.test(x))), p)
    if (ordner !== undefined) return `der PR liest einen Ordner mit ${ordner} (${p}), Verzeichnis nicht eindeutig${ungueltigeMuster(text, p)}`
  }
  const vorwaerts = [...huelle(start, lies)]
  const l1 = kernZuerst(leser).find((r) => vorwaerts.some((n) => trifft(n, r)))
  if (l1 !== undefined) return `der PR ruft ${l1} auf oder importiert es, das bewegte Daten liest (nennt ${genannte(l1, bewegt, lies)})`
  const rueckwaerts = rueckMenge(leser, bewegt, lies)
  // Handdaten des PR kippen nur durch bewegte Nicht-Bot-Dateien (Bot-Dateien: nur Berührung, siehe `botBewegt`).
  const ohneBot = botBewegt.length === 0 || !start.some(aendertBauDaten) ? rueckwaerts : rueckMenge(leserOhneBot(leser, bewegt, botBewegt, lies), bewegt.filter((b) => !botBewegt.includes(b)), lies)
  const p = start.find((x) => (aendertBauDaten(x) ? ohneBot : rueckwaerts).has(x))
  if (p !== undefined) return `${p} wird von Code genutzt, der bewegte Daten liest (bewegt: ${bewegt.join(', ')})`
  return null
}
