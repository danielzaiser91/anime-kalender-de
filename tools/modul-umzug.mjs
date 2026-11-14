#!/usr/bin/env node
/**
 * Verschiebt Code wörtlich in ein anderes Modul und richtet die Importe beider Seiten ein — das
 * Handwerk hinter dem Skill `zerlegen`. Am Code selbst ändert es nichts außer `export` und der
 * Hülle um einen Abschnitt.
 *
 *   namen     <quelle> <ziel> a,b,c
 *     Die Deklarationen a, b, c (Funktionen, Konstanten, Typen der obersten Ebene) samt ihren
 *     Kommentaren nach <ziel>; <quelle> importiert sie von dort, soweit sie sie noch braucht.
 *
 *   abschnitt <quelle> <von> <bis> <ziel> <funktion>
 *     Die Zeilen <von>–<bis> einer Funktion werden Rumpf von `export function <funktion>` in
 *     <ziel>. Ein- und Ausgaben ermittelt der Typprüfer (wie `abschnitt-schnittstelle.mjs`); an
 *     der alten Stelle steht danach `const { aus… } = <funktion>({ ein… })`. Neu zugewiesene
 *     Eingaben (`ändert`) werden gemeldet und müssen von Hand zurückgegeben werden.
 *
 *   jsx <quelle> <von> <bis> <ziel> <Komponente>
 *     Vollständige JSX-Kinder in den Zeilen von–bis werden eine Komponente; ihre freien
 *     Variablen werden Props (Typen vom Typprüfer). Hooks bleiben, wo sie sind.
 *
 *   aufraeumen <datei…>
 *     Nur unbenutzte Importe entfernen.
 *
 * Danach entfernt es unbenutzte Importe (TypeScript „Organize Imports", nur Entfernen) — der
 * Aufrufer prüft mit `npm run typecheck` und dem passenden Vergleich (Skill `zerlegen`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

const [modus, ...args] = process.argv.slice(2)
const OPTIONEN = {
  allowImportingTsExtensions: true,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  allowJs: true,
  skipLibCheck: true,
}

/** Die Optionen der nächsten `tsconfig.json` (der Worker hat eigene Typen), sonst OPTIONEN. */
function optionenFuer(pfad) {
  const konfig = ts.findConfigFile(dirname(pfad), existsSync)
  if (!konfig) return OPTIONEN
  const { config } = ts.readConfigFile(konfig, (f) => readFileSync(f, 'utf8'))
  return { ...ts.parseJsonConfigFileContent(config, ts.sys, dirname(konfig)).options, noEmit: true }
}

function programm(pfad) {
  const p = ts.createProgram([pfad], optionenFuer(pfad))
  return { pruefer: p.getTypeChecker(), quelle: p.getSourceFile(pfad) }
}

/** Importe einer Datei: lokaler Name → { modul, text } (`text` ist der Bezeichner im Importsatz). */
function importe(quelle) {
  const karte = new Map()
  for (const s of quelle.statements) {
    if (!ts.isImportDeclaration(s) || !s.importClause) continue
    const modul = s.moduleSpecifier.text
    const nurTyp = s.importClause.isTypeOnly
    if (s.importClause.name) karte.set(s.importClause.name.text, { modul, standard: true })
    const b = s.importClause.namedBindings
    if (b && ts.isNamespaceImport(b)) karte.set(b.name.text, { modul, namensraum: true })
    if (b && ts.isNamedImports(b))
      for (const e of b.elements)
        karte.set(e.name.text, {
          modul,
          text: `${nurTyp || e.isTypeOnly ? 'type ' : ''}${e.propertyName ? `${e.propertyName.text} as ` : ''}${e.name.text}`,
        })
  }
  return karte
}

/** `@shared/…`, wenn das tsconfig des Ziels den Alias kennt und die Datei in shared/ liegt (Worker: nein), sonst null. */
function aliasFuer(zielPfad, datei) {
  const o = optionenFuer(zielPfad)
  const ziele = o.paths?.['@shared/*']
  if (!ziele) return null
  const wurzel = resolve(o.pathsBasePath ?? o.baseUrl ?? dirname(zielPfad), ziele[0].replace(/\*$/, ''))
  const r = relative(wurzel, datei).replaceAll('\\', '/')
  return r.startsWith('..') || r.startsWith('/') || /^[A-Za-z]:/.test(r) ? null : `@shared/${r}`
}

const relModul = (vonDatei, modul, zuDatei) => {
  if (!modul.startsWith('.')) return modul
  const datei = resolve(dirname(vonDatei), modul)
  const alias = aliasFuer(zuDatei, datei)
  if (alias) return alias
  let r = relative(dirname(zuDatei), datei).replaceAll('\\', '/')
  if (!r.startsWith('.')) r = `./${r}`
  return r
}

const spezifizierer = (vonDatei, zuDatei) => {
  const r = relative(dirname(vonDatei), zuDatei).replaceAll('\\', '/')
  return r.startsWith('.') ? r : `./${r}`
}

/** Importsaetze für alle Bezeichner in `namen`, die `quelle` importiert — umgerechnet auf `ziel`. */
function importsaetze(quellPfad, karte, namen, zielPfad) {
  const jeModul = new Map()
  for (const n of namen) {
    const i = karte.get(n)
    if (!i) continue
    const modul = relModul(quellPfad, i.modul, zielPfad)
    if (i.standard) jeModul.set(`${modul}\0standard`, `import ${n} from '${modul}'`)
    else if (i.namensraum) jeModul.set(`${modul}\0ns`, `import * as ${n} from '${modul}'`)
    else (jeModul.get(modul) ?? jeModul.set(modul, []).get(modul)).push(i.text)
  }
  return [...jeModul].map(([modul, teil]) => {
    if (typeof teil === 'string') return teil
    const zeile = `import { ${teil.join(', ')} } from '${modul}'`
    return zeile.length <= 120 ? zeile : `import {\n${teil.map((t) => `  ${t},`).join('\n')}\n} from '${modul}'`
  })
}

function bezeichnerIn(knoten, menge = new Set()) {
  const p = knoten.parent
  const nurEigenschaft =
    p && ((ts.isPropertyAccessExpression(p) && p.name === knoten) || (ts.isPropertyAssignment(p) && p.name === knoten))
  if (ts.isIdentifier(knoten) && !nurEigenschaft) menge.add(knoten.text)
  ts.forEachChild(knoten, (k) => {
    bezeichnerIn(k, menge) // kein Rückgabewert: ein wahrer beendet forEachChild
  })
  return menge
}

const deklName = (s) =>
  ts.isVariableStatement(s) ? s.declarationList.declarations.map((d) => d.name.getText()) : s.name ? [s.name.text] : []

/** Anfang des Kommentarblocks, der ohne Leerzeile unmittelbar über der Deklaration steht (sonst ihr eigener Anfang). */
function kopfStart(text, s) {
  let start = s.getStart()
  const bereiche = ts.getLeadingCommentRanges(text, s.getFullStart()) ?? []
  for (let i = bereiche.length - 1; i >= 0; i--) {
    if (text.slice(bereiche[i].end, start).split('\n').length > 2) break
    start = bereiche[i].pos
  }
  return start
}

/** Ende der Deklaration samt Kommentar in derselben Zeile. */
function endeMitZeilenkommentar(text, s) {
  const hinten = ts.getTrailingCommentRanges(text, s.end) ?? []
  return hinten.length ? hinten[hinten.length - 1].end : s.end
}

/** Text der Deklaration samt Kommentarblock darüber, mit `export` vor dem Schlüsselwort. */
function exportiert(text, s, gebraucht) {
  const vorspann = text.slice(kopfStart(text, s), s.getStart())
  const kern = text.slice(s.getStart(), endeMitZeilenkommentar(text, s))
  const hatExport = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  return vorspann + (hatExport || !gebraucht ? kern : `export ${kern}`)
}

/** Text ohne den Bereich; Leerzeilen an der Nahtstelle bleiben wie sie waren (nie zwei, nie keine, wo eine stand). */
function schneideWeg(text, von, bis) {
  const davor = text.slice(0, von)
  const danach = text.slice(bis)
  const leer = /\n[ \t]*\n[ \t]*$/.test(davor) || /^[ \t]*\n[ \t]*\n/.test(danach)
  const d = davor.trimEnd()
  const n = danach.trimStart()
  if (!n) return `${d}\n`
  return d ? `${d}${leer ? '\n\n' : '\n'}${n}` : n
}

const istKonstante = (s) =>
  ts.isVariableStatement(s) &&
  Boolean(s.declarationList.flags & ts.NodeFlags.Const) &&
  !s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** Konstanten, die nur die verschobenen Deklarationen benutzen, wandern mit (bis nichts mehr dazukommt). */
function mitzunehmende(bleiben, wandern) {
  const mit = []
  let rest = bleiben
  for (let weiter = true; weiter; ) {
    weiter = false
    const benutzt = new Set()
    for (const s of [...wandern, ...mit]) bezeichnerIn(s, benutzt)
    for (const c of rest.filter(istKonstante)) {
      const anderswo = new Set()
      for (const s of rest) if (s !== c) bezeichnerIn(s, anderswo)
      const namen = deklName(c)
      if (!namen.some((n) => benutzt.has(n)) || namen.some((n) => anderswo.has(n))) continue
      mit.push(c)
      rest = rest.filter((s) => s !== c)
      weiter = true
      break
    }
  }
  return { mit: bleiben.filter((s) => mit.includes(s)), rest }
}

/** Unbenutzte Importe entfernen, sonst nichts — über den Sprachdienst von TypeScript. */
function importeAufraeumen(pfad, alles = false) {
  const dateien = new Map([[pfad, readFileSync(pfad, 'utf8')]])
  const dienst = ts.createLanguageService({
    getCompilationSettings: () => optionenFuer(pfad),
    getScriptFileNames: () => [pfad],
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => {
      const t = dateien.get(f) ?? (existsSync(f) ? readFileSync(f, 'utf8') : undefined)
      return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t)
    },
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: existsSync,
    readFile: (f) => readFileSync(f, 'utf8'),
  })
  const aenderungen = dienst.organizeImports(
    { type: 'file', fileName: pfad, mode: alles ? ts.OrganizeImportsMode.All : ts.OrganizeImportsMode.RemoveUnused },
    { ...ts.getDefaultFormatCodeSettings('\n'), semicolons: ts.SemicolonPreference.Remove, indentSize: 2, insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true },
    { quotePreference: 'single' },
  )
  let text = dateien.get(pfad)
  for (const a of aenderungen)
    for (const t of [...a.textChanges].sort((x, y) => y.span.start - x.span.start))
      text = text.slice(0, t.span.start) + t.newText + text.slice(t.span.start + t.span.length)
  writeFileSync(pfad, text)
}

/** Der Name eines Importelements ohne `type`, zum Sortieren. */
const elementName = (t) => t.replace(/^type /, '').replace(/^.* as /, '').toLowerCase()

function importSatz(modul, standard, elemente) {
  const liste = elemente.join(', ')
  const kopf = standard ? (elemente.length ? `${standard}, ` : standard) : ''
  if (!elemente.length) return `import ${standard} from '${modul}'`
  const zeile = `import ${kopf}{ ${liste} } from '${modul}'`
  return zeile.length <= 120 ? zeile : `import ${kopf}{\n${elemente.map((e) => `  ${e},`).join('\n')}\n} from '${modul}'`
}

/** Je Quelle genau ein Importsatz: mehrere Sätze derselben Quelle werden in den ersten gelegt, Namen sortiert. */
function importeZusammenfuehren(pfad) {
  const text = readFileSync(pfad, 'utf8')
  const sf = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, pfad.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const jeModul = new Map()
  for (const s of sf.statements) {
    const c = ts.isImportDeclaration(s) && s.importClause
    if (!c || (c.namedBindings && ts.isNamespaceImport(c.namedBindings))) continue
    jeModul.set(s.moduleSpecifier.text, [...(jeModul.get(s.moduleSpecifier.text) ?? []), s])
  }
  const aenderungen = []
  for (const [modul, saetze] of jeModul) {
    const standards = saetze.filter((s) => s.importClause.name)
    if (saetze.length < 2 || standards.length > 1 || standards.some((s) => s.importClause.isTypeOnly)) continue
    const elemente = new Set()
    for (const s of saetze)
      for (const e of s.importClause.namedBindings?.elements ?? [])
        elemente.add(`${s.importClause.isTypeOnly || e.isTypeOnly ? 'type ' : ''}${e.propertyName ? `${e.propertyName.text} as ` : ''}${e.name.text}`)
    for (const e of [...elemente]) if (e.startsWith('type ') && elemente.has(e.slice(5))) elemente.delete(e)
    const sortiert = [...elemente].sort((a, b) => (elementName(a) < elementName(b) ? -1 : elementName(a) > elementName(b) ? 1 : 0))
    aenderungen.push([saetze[0].getStart(), saetze[0].end, importSatz(modul, standards[0]?.importClause.name.text, sortiert)])
    for (const s of saetze.slice(1)) aenderungen.push([s.getStart(), text[s.end] === '\n' ? s.end + 1 : s.end, ''])
  }
  let neu = text
  for (const [von, bis, ersatz] of aenderungen.sort((a, b) => b[0] - a[0])) neu = neu.slice(0, von) + ersatz + neu.slice(bis)
  if (neu !== text) writeFileSync(pfad, neu)
}

function nachbearbeiten(quellPfad, zielPfad) {
  for (const d of [quellPfad, zielPfad]) {
    importeZusammenfuehren(d)
    importeAufraeumen(d)
  }
}

/** Index hinter dem letzten Importsatz (0 ohne Importe). */
function nachImporten(text) {
  const sf = ts.createSourceFile('x.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const letzter = [...sf.statements].reverse().find(ts.isImportDeclaration)
  return letzter ? letzter.end : 0
}

/** `anfang` (Konstanten der verschobenen Teile) kommt direkt hinter die Importe des Ziels, `rumpf` ans Ende. */
function anhaengen(zielPfad, kopf, rumpf, anfang = '') {
  const alt = existsSync(zielPfad) ? readFileSync(zielPfad, 'utf8') : ''
  const kopfText = kopf.length ? `${kopf.join('\n')}\n` : ''
  const stelle = nachImporten(alt)
  const vorn = alt.slice(0, stelle).trimEnd()
  const hinten = alt.slice(stelle).trim()
  const teile = [vorn, anfang.trim(), hinten, rumpf.trim()].filter(Boolean)
  // Neue Importe vor die bisherigen; mehrere Sätze derselben Quelle führt `importeZusammenfuehren` zusammen.
  writeFileSync(zielPfad, `${kopfText}${kopfText && vorn ? '' : kopfText ? '\n' : ''}${teile.join('\n\n')}\n`)
}

function verschiebeNamen(quellPfad, zielPfad, namen) {
  const { quelle } = programm(quellPfad)
  const text = quelle.getFullText()
  const karte = importe(quelle)
  const gesucht = new Set(namen)
  const gewaehlt = quelle.statements.filter((s) => deklName(s).some((n) => gesucht.has(n)))
  const fehlt = namen.filter((n) => !gewaehlt.some((s) => deklName(s).includes(n)))
  if (fehlt.length) throw new Error(`nicht gefunden: ${fehlt.join(', ')}`)
  const uebrige = quelle.statements.filter((s) => !gewaehlt.includes(s) && !ts.isImportDeclaration(s))
  const { mit, rest: bleiben } = mitzunehmende(uebrige, gewaehlt)
  const wandern = gewaehlt
  const bleibendeNamen = new Set(bleiben.flatMap(deklName))
  const benutzt = new Set()
  for (const s of [...wandern, ...mit]) bezeichnerIn(s, benutzt)
  const rueckbezug = [...benutzt].filter((n) => bleibendeNamen.has(n))
  if (rueckbezug.length) console.warn(`⚠ braucht noch Namen aus ${quellPfad}: ${rueckbezug.join(', ')} — mitverschieben`)
  if (mit.length) console.log(`mitgenommen (nur von den verschobenen Teilen benutzt): ${mit.flatMap(deklName).join(', ')}`)
  const draussen = new Set()
  for (const s of bleiben) bezeichnerIn(s, draussen)
  const rumpf = wandern.map((s) => exportiert(text, s, deklName(s).some((n) => draussen.has(n)))).join('\n\n')
  const anfang = mit.map((s) => exportiert(text, s, false)).join('\n\n')
  anhaengen(zielPfad, importsaetze(quellPfad, karte, benutzt, zielPfad), rumpf, anfang)

  const wanderNamen = wandern.flatMap(deklName).filter((n) => draussen.has(n))
  const nurTyp = new Set(wandern.filter((s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)).flatMap(deklName))
  const liste = wanderNamen.map((n) => (nurTyp.has(n) ? `type ${n}` : n)).join(', ')
  let neu = text
  for (const s of [...wandern, ...mit].sort((a, b) => b.end - a.end)) neu = schneideWeg(neu, kopfStart(text, s), endeMitZeilenkommentar(text, s))
  const stelle = nachImporten(neu)
  if (wanderNamen.length) neu = `${neu.slice(0, stelle)}\nimport { ${liste} } from '${spezifizierer(quellPfad, zielPfad)}'${neu.slice(stelle)}`
  writeFileSync(quellPfad, neu)
  nachbearbeiten(quellPfad, zielPfad)
  console.log(`${wanderNamen.length} Deklaration(en) nach ${zielPfad}: ${wanderNamen.join(', ')}`)
}

const aufModulebene = (d) => {
  let p = d.parent
  while (p && !ts.isFunctionLike(p) && !ts.isSourceFile(p)) p = p.parent
  return !p || ts.isSourceFile(p)
}

/** Den Rumpf auf zwei Leerzeichen Einzug bringen, relativ zueinander unverändert. */
function eingerueckt(koerper) {
  const einzug = Math.min(...koerper.filter((z) => z.trim()).map((z) => z.match(/^ */)[0].length))
  const weg = Math.max(0, einzug - 2)
  return koerper.map((z) => (z.trim() ? z.slice(weg) : z)).join('\n')
}

/** Innerste Funktion um die Zeilen von–bis und die Namen, die der Abschnitt mit ihr teilt. */
function schnittstelle(quelle, pruefer, von, bis) {
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line + 1
  let huelle
  const suche = (k) => {
    if (ts.isFunctionLike(k) && k.body && zeile(k.getStart(quelle)) < von && zeile(k.end) > bis) huelle = k
    ts.forEachChild(k, suche)
  }
  suche(quelle)
  if (!huelle) throw new Error('Keine Funktion umschließt diesen Abschnitt.')
  const ein = new Map()
  const aendert = new Set()
  const aus = new Set()
  const benutzt = new Set()
  const zuweisung = (p, b) =>
    ts.isBinaryExpression(p) &&
    p.left === b &&
    p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    p.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  const zaehlt = (p) =>
    (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) &&
    [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(p.operator)
  const besuche = (k) => {
    if (ts.isIdentifier(k)) {
      const z = zeile(k.getStart(quelle))
      if (z >= von && z <= bis) benutzt.add(k.text)
      // `{ x }` verweist über die Kurzschreibweise auf die Variable, nicht auf die Eigenschaft.
      const sym = ts.isShorthandPropertyAssignment(k.parent)
        ? pruefer.getShorthandAssignmentValueSymbol(k.parent)
        : pruefer.getSymbolAtLocation(k)
      const d = sym?.declarations?.[0]
      const variabel =
        d && (ts.isVariableDeclaration(d) || ts.isParameter(d) || ts.isBindingElement(d) || ts.isFunctionDeclaration(d))
      // Eingabe ist alles, was eine umschließende Funktion deklariert — nicht die Modulebene.
      if (variabel && d !== huelle && d.getSourceFile() === quelle && !aufModulebene(d)) {
        const dz = zeile(d.getStart(quelle))
        if (z >= von && z <= bis && (dz < von || dz > bis)) {
          // Der Typ an der ersten Verwendung im Abschnitt — dort ist er schon eingeengt (`if (!x) return`).
          if (!ein.has(sym.name)) {
            const typ = pruefer.getTypeAtLocation(k)
            ein.set(sym.name, pruefer.typeToString(typ, huelle, ts.TypeFormatFlags.NoTruncation))
          }
          if (zuweisung(k.parent, k) || zaehlt(k.parent)) aendert.add(sym.name)
        }
        if (z > bis && dz >= von && dz <= bis) aus.add(sym.name)
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(huelle.body)
  return { ein, aendert, aus, benutzt, ...ablauf(quelle, huelle, von, bis) }
}

/**
 * `return` und `await` im Abschnitt, die der umschließenden Funktion gehören. Ein Abschnitt mit
 * `return` lässt sich nur herauslösen, wenn er mit einem `return` endet — dann wird der Aufruf
 * selbst zurückgegeben.
 */
function ablauf(quelle, huelle, von, bis) {
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line + 1
  const imBereich = (k) => zeile(k.getStart(quelle)) >= von && zeile(k.end) <= bis
  const eigeneFunktion = (k) => {
    let p = k.parent
    while (p && !ts.isFunctionLike(p)) p = p.parent
    return p === huelle
  }
  let hatReturn = false
  let istAsync = false
  let letzte
  const besuche = (k) => {
    if (imBereich(k) && eigeneFunktion(k)) {
      if (ts.isReturnStatement(k)) hatReturn = true
      if (ts.isAwaitExpression(k) || ts.isForOfStatement(k) && k.awaitModifier) istAsync = true
    }
    // Oberste Anweisung des Abschnitts: liegt darin, ihr Block beginnt davor.
    if (imBereich(k) && ts.isBlock(k.parent) && zeile(k.parent.getStart(quelle)) < von) letzte = k
    ts.forEachChild(k, besuche)
  }
  besuche(huelle.body)
  return { hatReturn, istAsync, endetMitReturn: Boolean(letzte && ts.isReturnStatement(letzte)) }
}

/** Ein Paket aus node_modules heißt nach dem Paket (`react`), eine eigene Datei relativ. */
function modulFuer(pfad, zielPfad) {
  const paket = pfad.split('/node_modules/')[1]
  if (paket) {
    const teile = paket.replace(/^@types\//, '').split('/')
    return teile[0].startsWith('@') ? `${teile[0]}/${teile[1]}` : teile[0]
  }
  const datei = ['.ts', '.tsx', '/index.ts'].map((e) => pfad + e).find(existsSync) ?? `${pfad}.ts`
  return aliasFuer(zielPfad, datei) ?? spezifizierer(zielPfad, datei)
}

/** `import("/pfad/datei").Typ` (Typen, die die Quelle nicht importiert) wird `Typ` plus eigener Import. */
function typenAufloesen(ein, zielPfad) {
  const jeModul = new Map()
  for (const [n, t] of ein) {
    const ohnePfad = t.replace(/import\("([^"]+)"\)\.([A-Za-z_$][\w$]*)/g, (_, pfad, typ) => {
      const modul = modulFuer(pfad, zielPfad)
      jeModul.set(modul, new Set([...(jeModul.get(modul) ?? []), typ]))
      return typ
    })
    // Zeichenketten-Typen im Stil des Projekts: einfache Anführungszeichen.
    ein.set(n, ohnePfad.replace(/"((?:[^"\\']|\\.)*)"/g, "'$1'"))
  }
  return [...jeModul].map(([modul, typen]) => `import type { ${[...typen].join(', ')} } from '${modul}'`)
}

/**
 * Bricht ab, wenn Ziel und Quelle dieselbe Datei sind oder der Bereich eine Anweisung anschneidet
 * (`if (x)` ohne Rumpfzeile, `{` ohne `}`) — beides verschob das Werkzeug sonst still falsch (12.11.2026).
 */
function pruefeBereich(quelle, quellPfad, zielPfad, von, bis) {
  if (quellPfad === zielPfad) throw new Error('Ziel ist die Quelldatei — erst in eine neue Datei herauslösen (Skill `zerlegen`).')
  const zeile = (pos) => quelle.getLineAndCharacterOfPosition(pos).line + 1
  const besuche = (k) => {
    if (k.parent && (ts.isBlock(k.parent) || ts.isSourceFile(k.parent))) {
      const a = zeile(k.getStart(quelle))
      const e = zeile(k.end)
      const ueberlappt = a <= bis && e >= von
      const innen = a >= von && e <= bis
      const umfasst = a < von && e > bis
      if (ueberlappt && !innen && !umfasst)
        throw new Error(`Zeilen ${von}–${bis} schneiden die Anweisung in Zeile ${a}–${e} an — Grenzen auf ganze Anweisungen legen.`)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
}

function verschiebeAbschnitt(quellPfad, von, bis, zielPfad, funktion) {
  const { pruefer, quelle } = programm(quellPfad)
  pruefeBereich(quelle, quellPfad, zielPfad, von, bis)
  const { ein, aendert, aus, benutzt, hatReturn, istAsync, endetMitReturn } = schnittstelle(quelle, pruefer, von, bis)
  if (hatReturn && (!endetMitReturn || aus.size))
    throw new Error('Der Abschnitt enthält `return`, endet aber nicht damit (oder liefert Werte) — Grenzen anders wählen.')
  const typImporte = typenAufloesen(ein, zielPfad)
  const zeilen = quelle.getFullText().split('\n')
  const namen = [...ein.keys()]
  const signatur = namen.length
    ? `{ ${namen.join(', ')} }: {\n${namen.map((n) => `  ${n}: ${ein.get(n)}`).join('\n')}\n}`
    : ''
  const rueckgabe = aus.size ? `\n  return { ${[...aus].join(', ')} }` : ''
  const rumpf = `export ${istAsync ? 'async ' : ''}function ${funktion}(${signatur}) {\n${eingerueckt(zeilen.slice(von - 1, bis))}${rueckgabe}\n}`

  // Typnamen in der Signatur brauchen ihre Importe genauso wie der Rumpf.
  const typBezeichner = [...ein.values()].flatMap((t) => t.match(/[A-Za-z_$][\w$]*/g) ?? [])
  const gebraucht = new Set([...benutzt, ...typBezeichner])
  const topNamen = new Set(quelle.statements.flatMap(deklName))
  const rueck = [...gebraucht].filter((n) => topNamen.has(n))
  if (rueck.length) console.warn(`⚠ braucht Namen der obersten Ebene von ${quellPfad}: ${rueck.join(', ')} — erst auslagern`)
  anhaengen(zielPfad, [...importsaetze(quellPfad, importe(quelle), gebraucht, zielPfad), ...typImporte], rumpf)

  const einrueck = zeilen[von - 1].match(/^\s*/)[0]
  const ziel = hatReturn ? 'return ' : aus.size ? `const { ${[...aus].join(', ')} } = ` : ''
  const warte = istAsync ? 'await ' : ''
  const aufruf = `${einrueck}${ziel}${warte}${funktion}(${namen.length ? `{ ${namen.join(', ')} }` : ''})`
  const neu = [...zeilen.slice(0, von - 1), aufruf, ...zeilen.slice(bis)]
  const letzterImport = [...quelle.statements].reverse().find(ts.isImportDeclaration)
  const importZeile = letzterImport ? quelle.getLineAndCharacterOfPosition(letzterImport.end).line + 1 : 0
  neu.splice(importZeile, 0, `import { ${funktion} } from '${spezifizierer(quellPfad, zielPfad)}'`)
  writeFileSync(quellPfad, neu.join('\n'))
  nachbearbeiten(quellPfad, zielPfad)
  console.log(`${funktion}: ${bis - von + 1} Zeilen nach ${zielPfad}`)
  console.log(`  ein: ${namen.join(', ') || '—'}`)
  console.log(`  aus: ${[...aus].join(', ') || '—'}`)
  if (aendert.size) console.warn(`⚠ weist neu zu: ${[...aendert].join(', ')} — Rückgabe von Hand ergänzen`)
}


/** Die Zeilen von–bis (vollständige JSX-Kinder) werden eine eigene Komponente mit Props. */
function verschiebeJsx(quellPfad, von, bis, zielPfad, name) {
  const { pruefer, quelle } = programm(quellPfad)
  const { ein, aendert, aus, benutzt, hatReturn } = schnittstelle(quelle, pruefer, von, bis)
  const zeilen = quelle.getFullText().split('\n')
  const text = zeilen.slice(von - 1, bis).join('\n')
  const probe = ts.createSourceFile('probe.tsx', `const x = (<>\n${text}\n</>)`, 99, true, ts.ScriptKind.TSX)
  if (probe.parseDiagnostics.length) throw new Error('Die Zeilen sind keine vollständigen JSX-Kinder.')
  if (aendert.size || aus.size || hatReturn) throw new Error('Der Abschnitt weist zu, liefert Werte oder enthält `return`.')
  if (/\buse[A-Z]\w*\(/.test(text)) throw new Error('Der Abschnitt ruft einen Hook — der bleibt in der Komponente.')
  const typImporte = typenAufloesen(ein, zielPfad)
  const namen = [...ein.keys()]
  if (namen.some((n) => n === 'key' || n === 'ref')) throw new Error('Eine Eingabe heißt key oder ref.')
  for (const [n, t] of ein) if (t.length > 300) console.warn(`⚠ langer Typ für ${n} (${t.length} Zeichen)`)
  const signatur = namen.length
    ? `{ ${namen.join(', ')} }: {\n${namen.map((n) => `  ${n}: ${ein.get(n)}`).join('\n')}\n}`
    : ''
  const koerper = eingerueckt(zeilen.slice(von - 1, bis)).split('\n').map((z) => (z.trim() ? `    ${z}` : z))
  const rumpf = `export function ${name}(${signatur}) {\n  return (\n    <>\n${koerper.join('\n')}\n    </>\n  )\n}`
  const typBezeichner = [...ein.values()].flatMap((t) => t.match(/[A-Za-z_$][\w$]*/g) ?? [])
  const gebraucht = new Set([...benutzt, ...typBezeichner])
  anhaengen(zielPfad, [...importsaetze(quellPfad, importe(quelle), gebraucht, zielPfad), ...typImporte], rumpf)

  const einrueck = zeilen[von - 1].match(/^\s*/)[0]
  const einzeilig = `${einrueck}<${name}${namen.map((n) => ` ${n}={${n}}`).join('')} />`
  const aufruf =
    einzeilig.length <= 120
      ? einzeilig
      : `${einrueck}<${name}\n${namen.map((n) => `${einrueck}  ${n}={${n}}`).join('\n')}\n${einrueck}/>`
  const neu = [...zeilen.slice(0, von - 1), aufruf, ...zeilen.slice(bis)]
  const letzterImport = [...quelle.statements].reverse().find(ts.isImportDeclaration)
  const importZeile = letzterImport ? quelle.getLineAndCharacterOfPosition(letzterImport.end).line + 1 : 0
  neu.splice(importZeile, 0, `import { ${name} } from '${spezifizierer(quellPfad, zielPfad)}'`)
  writeFileSync(quellPfad, neu.join('\n'))
  nachbearbeiten(quellPfad, zielPfad)
  console.log(`<${name}>: ${bis - von + 1} Zeilen nach ${zielPfad}`)
  console.log(`  Props: ${namen.join(', ') || '—'}`)
}

if (modus === 'namen' && args.length === 3) verschiebeNamen(resolve(args[0]), resolve(args[1]), args[2].split(','))
else if (modus === 'abschnitt' && args.length === 5)
  verschiebeAbschnitt(resolve(args[0]), Number(args[1]), Number(args[2]), resolve(args[3]), args[4])
else if (modus === 'jsx' && args.length === 5)
  verschiebeJsx(resolve(args[0]), Number(args[1]), Number(args[2]), resolve(args[3]), args[4])
else if (modus === 'aufraeumen' && args.length) for (const d of args) importeAufraeumen(resolve(d))
else {
  console.error('Aufruf: modul-umzug.mjs aufraeumen <datei…> |')
  console.error('Aufruf: modul-umzug.mjs namen <quelle> <ziel> a,b,c | abschnitt <quelle> <von> <bis> <ziel> <funktion>')
  process.exit(2)
}
