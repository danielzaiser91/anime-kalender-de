// Der Block zwischen AUF und ZU in stand.md (gehört zu stand-prs.js): Marken prüfen, alten Block zerlegen, neuen bauen.
// Grundsatz: keine Zeile, die der Hook nicht selbst geschrieben hat, geht verloren. Fremdes verlässt den Block und steht
// direkt unter ZU; ist die Lage der Marken nicht eindeutig, schreibt der Hook gar nichts.
const AUF = '<!-- pr-zeilen: automatisch aus GitHub (Hook stand-prs.js); eigene Notizen eingerückt unter die PR-Zeile -->'
const ZU = '<!-- /pr-zeilen -->'
const ADR = 'https://github.com/danielzaiser91/anime-kalender-de/pull/'
const HINWEIS = '- **PR-Liste veraltet** — '
const GEMERGT_LISTE = 'https://github.com/danielzaiser91/anime-kalender-de/pulls?q=is%3Apr+is%3Amerged'
// Sammelzeile der in 24 h gemergten PRs; zählt als Reihe mit Nummer 0 (kein einzelner PR).
const SAMMEL = /^- \[klein\] \*\*Gemergt in 24 h: \d+\*\* — zuletzt \d\d\.\d\d\. \d\d:\d\d — \[alle\]\((\S+)\)$/

// Mitte einer eigenen Zeile: offener PR („… CI x · Prüfer y[ · Checks z]“) oder gemergter („gemergt 19.10. 16:27“).
const MITTE_OFFEN = /(?:^| · )CI [^·]+ · Prüfer [^·]+(?: · Checks (?:grün|rot|laufen))?$/
const MITTE_GEMERGT = /^gemergt \d\d\.\d\d\. \d\d:\d\d$/

/** PR-Nummer einer Zeile in genau der Form, die der Hook schreibt; null für jede andere Zeile. */
function hookNummer(zeile) {
  const sammel = SAMMEL.exec(zeile)
  if (sammel) return sammel[1] === GEMERGT_LISTE ? 0 : null
  const t = /^- (?:\[klein\] )?\*\*.*\*\* — (.+) — \[PR (\d+)\]\((\S+)\)$/.exec(zeile)
  if (!t || t[3] !== `${ADR}${t[2]}`) return null
  return MITTE_OFFEN.test(t[1]) || MITTE_GEMERGT.test(t[1]) ? Number(t[2]) : null
}

/** { auf, zu } bei genau einem unversehrten Block, {} ohne jede Marke, { fehler } bei jeder anderen Lage. */
function markerLage(zeilen) {
  const auf = []
  const zu = []
  zeilen.forEach((z, i) => {
    if (z.includes('<!-- pr-zeilen')) auf.push(i)
    if (z.includes('<!-- /pr-zeilen')) zu.push(i)
  })
  if (!auf.length && !zu.length) return {}
  if (auf.length !== 1 || zu.length !== 1) return { fehler: `${auf.length}× Anfangs-, ${zu.length}× Endmarke` }
  if (zeilen[auf[0]] !== AUF || zeilen[zu[0]] !== ZU) return { fehler: 'Marke weicht vom Wortlaut ab' }
  if (zu[0] < auf[0]) return { fehler: 'Endmarke vor der Anfangsmarke' }
  if (zeilen.slice(auf[0] + 1, zu[0]).some((z) => z.startsWith('## '))) return { fehler: 'Block überspannt eine Überschrift „## “' }
  return { auf: auf[0], zu: zu[0] }
}

/** Alter Block: eigene PR-Zeilen mit ihren eingerückten Notizen, dazu alles Fremde in seiner Reihenfolge. */
function zerlege(zeilen) {
  const reihen = []
  const fremd = []
  let ziel = fremd
  for (const zeile of zeilen) {
    if (!zeile.trim()) continue
    if (/^\s/.test(zeile)) {
      ziel.push(zeile)
      continue
    }
    const nummer = hookNummer(zeile)
    if (nummer === null) {
      // Die eigene Hinweiszeile entsteht bei Bedarf neu; alles andere ist fremd.
      if (!zeile.startsWith(HINWEIS)) fremd.push(zeile)
      ziel = fremd
      continue
    }
    const reihe = { nummer, zeile, notizen: [] }
    reihen.push(reihe)
    ziel = reihe.notizen
  }
  return { reihen, fremd }
}

/** Zeilen ab AUF: Block mit neuen Reihen (Notizen wandern mit), dann Fremdes und Notizen ausgeschiedener PRs. */
function baue(neu, alt, hinweis) {
  const notizen = new Map()
  for (const r of alt.reihen) notizen.set(r.nummer, [...(notizen.get(r.nummer) ?? []), ...r.notizen])
  const block = [AUF, ...(hinweis ? [hinweis] : [])]
  for (const r of neu) {
    block.push(r.zeile, ...(notizen.get(r.nummer) ?? []))
    notizen.delete(r.nummer)
  }
  const verwaist = [...notizen]
    .filter(([, n]) => n.length)
    .flatMap(([nummer, n]) => [`- **Notiz zu PR ${nummer}** — aus der PR-Liste gefallen, bitte einordnen`, ...n])
  return [...block, ZU, ...alt.fremd, ...verwaist]
}

/**
 * { text } mit frischem Block oder { fehler }. reihen: [{ nummer, zeile }]; null behält die Reihen des alten Blocks
 * (Abruf gescheitert). hinweis: Zeile direkt unter AUF. Ohne Block kommt einer ans Ende von „## In Arbeit“.
 */
function ersetzeBlock(text, reihen, hinweis = '') {
  const zeilen = text.split('\n')
  const lage = markerLage(zeilen)
  if (lage.fehler) return { fehler: `Marken: ${lage.fehler}` }
  if (lage.auf !== undefined) {
    const alt = zerlege(zeilen.slice(lage.auf + 1, lage.zu))
    const neu = baue(reihen ?? alt.reihen, alt, hinweis)
    return { text: [...zeilen.slice(0, lage.auf), ...neu, ...zeilen.slice(lage.zu + 1)].join('\n') }
  }
  const kopf = zeilen.findIndex((z) => z.startsWith('## In Arbeit'))
  if (kopf < 0) return { fehler: 'kein Abschnitt „## In Arbeit“' }
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  while (ende > kopf + 1 && zeilen[ende - 1].trim() === '') ende--
  const neu = baue(reihen ?? [], { reihen: [], fremd: [] }, hinweis)
  return { text: [...zeilen.slice(0, ende), ...neu, ...zeilen.slice(ende)].join('\n') }
}

module.exports = { AUF, ZU, ADR, HINWEIS, GEMERGT_LISTE, hookNummer, markerLage, zerlege, baue, ersetzeBlock }
