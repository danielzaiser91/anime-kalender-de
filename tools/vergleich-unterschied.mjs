/**
 * Sagt, WAS an zwei Fassungen einer Datei anders ist, damit `bau-vergleich` nicht nur Dateinamen nennt:
 * bei JSON die betroffenen Felder mit Anzahl und einem Beispiel (z. B. `streams[].dubQuelle`),
 * bei Text die ersten abweichenden Zeilen.
 */

const istObjekt = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const kurz = (x) => {
  const s = x === undefined ? '—' : JSON.stringify(x)
  return s.length > 40 ? `${s.slice(0, 37)}…` : s
}
/** Liste aus Objekten mit eigener Kennung: dann wird nach Kennung verglichen, nicht nach Stelle. */
const mitKennung = (l) => l.length > 0 && l.every((e) => istObjekt(e) && (typeof e.id === 'number' || typeof e.id === 'string'))

/** Kennung samt Titelname („2167 (Tokyo Revengers)“), wenn das Element einen trägt; sonst nur die Kennung. */
function mitName(e) {
  const name = [e.titleDe, e.titleEn, e.titleRomaji].find((n) => typeof n === 'string' && n !== '')
  return name ? `${e.id} (${name})` : e.id
}

/** `weg`: Feld bzw. Listenelement fehlt im neuen Stand; solche Zeilen stehen vorn und fallen nicht dem Kürzen zum Opfer. */
function merke(aus, muster, beispiel, weg = false) {
  const alt = aus.get(muster)
  if (alt) alt.n++
  else aus.set(muster, { n: 1, beispiel, weg })
}

/** Gleiche Elemente, andere Reihenfolge: die Datei ist verschieden, also muss eine Zeile das sagen. */
function merkeReihenfolge(aus, pfad) {
  merke(aus, `${pfad}[] (nur Reihenfolge)`, 'gleiche Elemente, andere Reihenfolge')
}

function vergleicheListen(a, b, pfad, kennung, aus) {
  if (mitKennung(a) && mitKennung(b)) {
    const jeId = new Map(b.map((e) => [e.id, e]))
    for (const e of a) {
      if (jeId.has(e.id)) vergleiche(e, jeId.get(e.id), `${pfad}[]`, mitName(e), aus)
      else merke(aus, `${pfad}[] (entfallen)`, `Kennung ${mitName(e)}`, true)
    }
    const alt = new Set(a.map((e) => e.id))
    for (const e of b) if (!alt.has(e.id)) merke(aus, `${pfad}[] (hinzugekommen)`, `Kennung ${mitName(e)}`)
    const inBeiden = (liste) => liste.filter((e) => alt.has(e.id) && jeId.has(e.id)).map((e) => e.id)
    if (inBeiden(a).join() !== inBeiden(b).join()) merkeReihenfolge(aus, pfad)
    return
  }
  const [restA, restB] = ohneGleiche(a, b)
  if (restA.length === 0 && restB.length === 0 && JSON.stringify(a) !== JSON.stringify(b)) merkeReihenfolge(aus, pfad)
  for (let i = 0; i < Math.max(restA.length, restB.length); i++) vergleiche(restA[i], restB[i], `${pfad}[]`, kennung ?? i, aus)
}

/**
 * Ohne Kennung: Elemente, die auf beiden Seiten gleich oft vorkommen, fallen heraus. Ein eingefügter Eintrag verschöbe sonst
 * alle folgenden und meldete jedes Feld als geändert (`patchnotes.json`, 13.10.2026).
 */
function ohneGleiche(a, b) {
  const zaehle = (liste) => {
    const anzahl = new Map()
    for (const e of liste) anzahl.set(JSON.stringify(e), (anzahl.get(JSON.stringify(e)) ?? 0) + 1)
    return anzahl
  }
  const behalte = (liste, andere) => {
    const frei = zaehle(andere)
    return liste.filter((e) => {
      const s = JSON.stringify(e)
      if (!(frei.get(s) > 0)) return true
      frei.set(s, frei.get(s) - 1)
      return false
    })
  }
  return [behalte(a, b), behalte(b, a)]
}

function vergleiche(a, b, pfad, kennung, aus) {
  if (a === b) return
  if (Array.isArray(a) && Array.isArray(b)) return vergleicheListen(a, b, pfad, kennung, aus)
  if (istObjekt(a) && istObjekt(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) vergleiche(a[k], b[k], `${pfad}.${k}`, kennung, aus)
    return
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return
  const weg = b === undefined
  merke(aus, weg ? `${pfad} (entfernt)` : pfad, `${kurz(a)} → ${kurz(b)}, Kennung ${kennung ?? '—'}`, weg)
}

/** Felder, die sich unterscheiden, mit Anzahl und erstem Beispiel; `Map` Muster → `{ n, beispiel }`. */
export function jsonUnterschiede(a, b) {
  const aus = new Map()
  vergleiche(a, b, '', undefined, aus)
  return aus
}

/** Höchstens `max` Felder, die häufigsten zuerst; `rest` benennt, was fehlt. Selten, aber entfernt, darf nicht hinter häufigen Änderungen verschwinden (13.10.2026). */
function jsonZeilen(aus, max, rest) {
  const zeile = ([muster, { n, beispiel }]) => `    ${n}× ${muster.replace(/^\./, '')}  (z. B. ${beispiel})`
  const zeilen = [...aus].sort((x, y) => y[1].n - x[1].n).slice(0, max).map(zeile)
  if (aus.length > max) zeilen.push(`    … und ${aus.length - max} weitere ${rest}`)
  return zeilen
}

/** Zeilen für die Ausgabe: je höchstens `max` entfernte und übrige Felder. Entfernte zuerst. */
export function beschreibeUnterschied(name, textA, textB, max = 6) {
  if (name.endsWith('.json')) {
    try {
      const aus = [...jsonUnterschiede(JSON.parse(textA), JSON.parse(textB))]
      const weg = aus.filter(([, e]) => e.weg)
      const uebrige = aus.filter(([, e]) => !e.weg)
      return [...jsonZeilen(weg, max, 'entfernte Felder'), ...jsonZeilen(uebrige, max, 'Felder')]
    } catch {
      // kein gültiges JSON: wie Text behandeln
    }
  }
  const zeilenB = new Set(textB.split('\n'))
  const zeilenA = new Set(textA.split('\n'))
  const nurA = textA.split('\n').filter((z) => z && !zeilenB.has(z)).map((z) => `    - ${z.slice(0, 160)}`)
  const nurB = textB.split('\n').filter((z) => z && !zeilenA.has(z)).map((z) => `    + ${z.slice(0, 160)}`)
  return [...nurA.slice(0, max / 2), ...nurB.slice(0, max / 2)]
}
