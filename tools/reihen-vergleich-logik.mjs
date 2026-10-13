/**
 * Rechnung hinter `reihen-vergleich.mjs`: aus `franchises.json` wird je Reihe festgehalten, was die
 * Reihen-Box davon zeigt, und zwei solche Stände werden gegeneinander gehalten.
 *
 * Das Titelmodul (`shared/titles.ts`) kommt als Parameter, weil es je Stand aus dem Code des
 * jeweiligen Commits stammt: Die Beschriftung ("Staffel 2") ist eine Rechnung, nicht ein Feld —
 * eine Regeländerung (PR 903) ändert sie bei unveränderten Daten.
 */

/** Reihenname wie `reihenNameVon()` in `web/src/components/detail/reihen-namen.ts` (Kopf der Reihen-Box). */
function reihenNameVon(glieder, titelDe, t) {
  if (glieder.length < 2) return glieder[0]?.name ?? ''
  const vertreter = t.reihenVertreter(glieder.map((m) => ({ ...m })))
  const kopf = t.ohneStaffelEins(vertreter.name)
  return t.reihenAnfang(kopf, glieder.map((m) => m.name), titelDe.get(vertreter.id) === vertreter.name)
}

const standText = (s) => `${s.staffel}${s.teil ? `.${s.teil}` : ''}/${s.von}`

/**
 * Je Reihenschlüssel: Name, Anzahl, Reihenfolge der Kennungen, Beschriftung und Staffelstand je Kennung.
 * `titelDe`: Map Kennung → deutscher Titel (nur für die Wahl des Reihennamens).
 */
export function berechneReihen(franchises, titelDe, t) {
  const aus = {}
  for (const [schluessel, glieder] of Object.entries(franchises)) {
    const name = reihenNameVon(glieder, titelDe, t)
    const haupt = t.hauptstaffeln(glieder)
    const beschriftung = {}
    for (const [id, text] of t.staffelBeschriftungen(haupt, name)) beschriftung[id] = text
    const stand = {}
    for (const [id, s] of t.staffelStaende(haupt, name)) stand[id] = standText(s)
    aus[schluessel] = {
      name,
      anzahl: glieder.length,
      glieder: glieder.map((g) => g.id),
      namen: Object.fromEntries(glieder.map((g) => [g.id, g.name])),
      beschriftung,
      stand,
    }
  }
  return aus
}

/** Änderungen eines Feldes, das je Kennung einen Text trägt (Beschriftung, Staffelstand). */
function vergleicheJeKennung(feld, alt, neu, namen) {
  const aus = []
  for (const id of new Set([...Object.keys(alt), ...Object.keys(neu)])) {
    if (alt[id] !== neu[id]) aus.push({ feld, glied: namen[id] ?? `#${id}`, alt: alt[id] ?? null, neu: neu[id] ?? null })
  }
  return aus
}

/** Änderungen einer Reihe; leer = gleich. */
function vergleicheReihe(a, b) {
  const aus = []
  if (a.name !== b.name) aus.push({ feld: 'name', alt: a.name, neu: b.name })
  if (a.anzahl !== b.anzahl) aus.push({ feld: 'anzahl', alt: a.anzahl, neu: b.anzahl })
  const gemeinsamA = a.glieder.filter((id) => b.glieder.includes(id))
  const gemeinsamB = b.glieder.filter((id) => a.glieder.includes(id))
  if (gemeinsamA.join() !== gemeinsamB.join()) aus.push({ feld: 'reihenfolge', alt: gemeinsamA, neu: gemeinsamB })
  const dazu = b.glieder.filter((id) => !a.glieder.includes(id))
  const weg = a.glieder.filter((id) => !b.glieder.includes(id))
  if (dazu.length) aus.push({ feld: 'glieder dazu', alt: null, neu: dazu.map((id) => b.namen[id]) })
  if (weg.length) aus.push({ feld: 'glieder weg', alt: weg.map((id) => a.namen[id]), neu: null })
  const namen = { ...a.namen, ...b.namen }
  aus.push(...vergleicheJeKennung('beschriftung', a.beschriftung, b.beschriftung, namen))
  aus.push(...vergleicheJeKennung('stand', a.stand, b.stand, namen))
  return aus
}

/** `{ neu, weg, geaendert, gleich }`: neu/weg als Schlüssel mit Name, geändert mit der Liste der Feldänderungen. */
export function vergleicheReihen(alt, neu) {
  const ergebnis = { neu: [], weg: [], geaendert: [], gleich: 0 }
  for (const [schluessel, r] of Object.entries(neu)) {
    if (!alt[schluessel]) {
      ergebnis.neu.push({ schluessel, name: r.name, anzahl: r.anzahl })
      continue
    }
    const aenderungen = vergleicheReihe(alt[schluessel], r)
    if (aenderungen.length) ergebnis.geaendert.push({ schluessel, name: r.name, aenderungen })
    else ergebnis.gleich++
  }
  for (const [schluessel, r] of Object.entries(alt)) {
    if (!neu[schluessel]) ergebnis.weg.push({ schluessel, name: r.name, anzahl: r.anzahl })
  }
  return ergebnis
}

const text = (x) => (x === null ? '—' : Array.isArray(x) ? `[${x.slice(0, 6).join(', ')}${x.length > 6 ? ', …' : ''}]` : `"${x}"`)

/** Ausgabezeilen: Zusammenfassung, dann eine Zeile je geänderter Reihe (höchstens `max` Feldänderungen). */
export function beschreibeReihen(v, max = 4) {
  const zeilen = [`Reihen: ${v.neu.length} neu, ${v.weg.length} weg, ${v.geaendert.length} geändert, ${v.gleich} gleich`]
  for (const r of v.neu) zeilen.push(`  + ${r.schluessel} ${r.name} (${r.anzahl} Titel)`)
  for (const r of v.weg) zeilen.push(`  - ${r.schluessel} ${r.name} (${r.anzahl} Titel)`)
  for (const r of v.geaendert) {
    const teile = r.aenderungen.slice(0, max).map((c) => `${c.feld}${c.glied ? ` „${c.glied}“` : ''}: ${text(c.alt)} → ${text(c.neu)}`)
    if (r.aenderungen.length > max) teile.push(`… und ${r.aenderungen.length - max} weitere`)
    zeilen.push(`  ~ ${r.schluessel} ${r.name}: ${teile.join('; ')}`)
  }
  return zeilen
}
