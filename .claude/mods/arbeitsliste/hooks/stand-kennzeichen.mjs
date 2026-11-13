// Kennzeichen der Zeilen in „## In Arbeit“ und „## Als Nächstes“ von stand.md (Daniel 08.11.2026) und die Rangordnung daraus.
// Zeile trägt `{<Art> · <Dringlichkeit> · <Ziel> · <Eingang TT.MM.> [· wartet: <worauf>]}`. Eine Quelle für Hook (stand-prs.js), tools/naechster.mjs und Mod (liegt in der Mod, weil Hook und Mod unter ~/.claude dieselbe Lage zueinander haben wie im Repo).
const ARTEN = ['kritisch', 'angefangen', 'auftrag', 'eigen']
const DRINGLICHKEITEN = ['sofort', 'hoch', 'normal', 'später']
const ZIELE = ['Code', 'Autonomie', 'Live5', 'Daten', '-']
const KENNZEICHEN = new RegExp(`\\{(${ARTEN.join('|')}) · (${DRINGLICHKEITEN.join('|')}) · (${ZIELE.join('|')}) · (\\d\\d)\\.(\\d\\d)\\.(?: · wartet: ([^}]*\\S))?\\}`, 'u')
// Beginnt eine Klammer mit einer Art, gilt sie als Kennzeichen-Versuch (sonst ist sie ein Status wie {arbeit-agent}).
const VERSUCH = new RegExp(`\\{(?:${ARTEN.join('|')})\\b[^}]*\\}`, 'u')
// Laufstempel einer Zeile in „Als Nächstes“: der Punkt ist begonnen und startet nicht noch einmal.
const LAEUFT = /\{läuft:/u
const ABSCHNITTE = ['In Arbeit', 'Als Nächstes']
const AUF = '<!-- pr-zeilen'
const ZU = '<!-- /pr-zeilen'

/** Kennzeichen einer Zeile: `{ok: true, art, dringlichkeit, ziel, tag, monat, wartet}` oder `{ok: false, grund}`. */
function parseKennzeichen(zeile) {
  const m = KENNZEICHEN.exec(zeile)
  if (!m) return { ok: false, grund: VERSUCH.test(zeile) ? `Kennzeichen ungültig: ${VERSUCH.exec(zeile)[0]}` : 'Kennzeichen fehlt' }
  const tag = Number(m[4])
  const monat = Number(m[5])
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12) return { ok: false, grund: `Eingang ${m[4]}.${m[5]}. ist kein Datum` }
  return { ok: true, art: m[1], dringlichkeit: m[2], ziel: m[3], tag, monat, wartet: m[6] ?? null }
}

/** Zeilen `- ` der Abschnitte „In Arbeit“/„Als Nächstes“ als `{nr, abschnitt, zeile}` (nr ab 1); Auto-Block der PR-Zeilen und eingerückte Folgezeilen zählen nicht. */
function kennzeichenZeilen(text) {
  const aus = []
  let abschnitt = null
  let imBlock = false
  text.split(/\r?\n/).forEach((z, i) => {
    if (z.startsWith('## ')) {
      abschnitt = ABSCHNITTE.find((a) => z.startsWith(`## ${a}`)) ?? null
      imBlock = false
    } else if (z.includes(AUF)) imBlock = true
    else if (z.includes(ZU)) imBlock = false
    else if (abschnitt && !imBlock && z.startsWith('- ')) aus.push({ nr: i + 1, abschnitt, zeile: z })
  })
  return aus
}

/** Ungültige oder fehlende Kennzeichen als `{nr, zeile, grund}`. */
function pruefeKennzeichen(text) {
  return kennzeichenZeilen(text).flatMap((e) => {
    const k = parseKennzeichen(e.zeile)
    return k.ok ? [] : [{ nr: e.nr, zeile: e.zeile, grund: k.grund }]
  })
}

/** Hook-Meldung zu fehlenden/ungültigen Kennzeichen („Kennzeichen: 2 Zeilen (Zeile 70 Kennzeichen fehlt: Titel, …)“) oder ''. */
function kennzeichenMeldung(text) {
  const fehler = pruefeKennzeichen(text)
  if (!fehler.length) return ''
  const nenn = fehler.slice(0, 3).map((f) => `Zeile ${f.nr} ${f.grund}: ${titelVon(f.zeile)}`)
  return `Kennzeichen: ${fehler.length} ${fehler.length === 1 ? 'Zeile' : 'Zeilen'} (${nenn.join(', ')}${fehler.length > 3 ? ' u. a.' : ''})`
}

/** Eingang als Tageszahl (UTC-Mitternacht, ms): ohne Jahr das jüngste Jahr, das nicht nach `jetzt` liegt. */
function eingangMs(k, jetzt) {
  const jahr = new Date(jetzt).getUTCFullYear()
  const ms = (j) => Date.UTC(j, k.monat - 1, k.tag)
  return ms(jahr) > jetzt ? ms(jahr - 1) : ms(jahr)
}

const RANG_ART = Object.fromEntries(ARTEN.map((a, i) => [a, i]))
const RANG_DRINGLICH = Object.fromEntries(DRINGLICHKEITEN.map((a, i) => [a, i]))
const RANG_ZIEL = Object.fromEntries(ZIELE.map((a, i) => [a, i]))

/** Vergleich zweier Einträge `{k, eingang}`: Art, Dringlichkeit, Ziel, dann älterer Eingang zuerst. */
function vergleiche(a, b) {
  return (
    RANG_ART[a.k.art] - RANG_ART[b.k.art] ||
    RANG_DRINGLICH[a.k.dringlichkeit] - RANG_DRINGLICH[b.k.dringlichkeit] ||
    RANG_ZIEL[a.k.ziel] - RANG_ZIEL[b.k.ziel] ||
    a.eingang - b.eingang
  )
}

/** Fett-Titel der Zeile, sonst ihre ersten 60 Zeichen. */
function titelVon(zeile) {
  const t = /\*\*(.+?)\*\*/.exec(zeile)
  return t ? t[1] : zeile.slice(2, 62)
}

/** Rangliste aller gültig gekennzeichneten Zeilen (Gleichstand: Dateireihenfolge). Ungültige Zeilen stehen in `fehler`. */
function rangliste(text, jetzt) {
  const eintraege = []
  const fehler = []
  for (const e of kennzeichenZeilen(text)) {
    const k = parseKennzeichen(e.zeile)
    if (!k.ok) fehler.push({ nr: e.nr, zeile: e.zeile, grund: k.grund })
    else eintraege.push({ ...e, k, titel: titelVon(e.zeile), eingang: eingangMs(k, jetzt) })
  }
  eintraege.sort((a, b) => vergleiche(a, b) || a.nr - b.nr)
  return { eintraege, fehler }
}

/** `{rangliste, naechster, laufend, fehler}`: laufend = „In Arbeit“ oder mit `{läuft: …}`, ohne `wartet`; nächster = erster „Als Nächstes“ ohne `wartet` und ohne `{läuft: …}`. */
function auswerten(text, jetzt) {
  const { eintraege, fehler } = rangliste(text, jetzt)
  const frei = (e) => e.k.wartet === null
  const laeuft = (e) => e.abschnitt === 'In Arbeit' || LAEUFT.test(e.zeile)
  return {
    rangliste: eintraege,
    naechster: eintraege.find((e) => e.abschnitt === 'Als Nächstes' && frei(e) && !laeuft(e)) ?? null,
    laufend: eintraege.filter((e) => laeuft(e) && frei(e)),
    fehler,
  }
}

export { ARTEN, DRINGLICHKEITEN, ZIELE, parseKennzeichen, kennzeichenZeilen, pruefeKennzeichen, kennzeichenMeldung, rangliste, auswerten }
