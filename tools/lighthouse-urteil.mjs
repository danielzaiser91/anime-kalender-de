/**
 * Urteil der Lighthouse-Messung als reine Funktionen (`lighthouse-messen.mjs`): Median je Seite und Kennzahl, Vergleich mit
 * `tools/lighthouse-grenzen.mjs` und die Ratschen-Prüfung (eine Grenze darf nur strenger werden als auf main).
 */

/** Kennzahlen mit Obergrenze (kleiner ist besser) und Kategorien mit Untergrenze (Punkte 0–100, größer ist besser). */
export const HOECHSTENS = ['lcp', 'cls', 'tbt', 'bytes']
export const MINDESTENS = ['performance', 'accessibility', 'best-practices', 'seo']

/** Die Kennzahlen eines Lighthouse-Berichts (JSON der CLI). */
export function kennzahlen(bericht) {
  const a = (id) => bericht.audits?.[id]?.numericValue
  const k = (id) => (bericht.categories?.[id]?.score == null ? undefined : Math.round(bericht.categories[id].score * 100))
  return {
    lcp: Math.round(a('largest-contentful-paint')),
    cls: Math.round(a('cumulative-layout-shift') * 1000) / 1000,
    tbt: Math.round(a('total-blocking-time')),
    bytes: Math.round(a('total-byte-weight')),
    ...Object.fromEntries(MINDESTENS.map((id) => [id, k(id)])),
    // Rechnergeschwindigkeit laut Lighthouse: TBT skaliert mit ihr (gleicher Code, zwei Runner: TBT 228 und 591 ms, 18.11.2026); nur Anzeige.
    benchmark: Math.round(bericht.environment?.benchmarkIndex ?? 0),
  }
}

const median = (zahlen) => [...zahlen].sort((x, y) => x - y)[Math.floor(zahlen.length / 2)]

/** Median je Kennzahl über die Läufe einer Seite. */
export function mediane(laeufe) {
  return Object.fromEntries([...HOECHSTENS, ...MINDESTENS].map((k) => [k, median(laeufe.map((l) => l[k]))]))
}

/** Verstöße einer Seite gegen ihre Grenzen; fehlt eine Grenze oder ein Messwert, ist das selbst ein Verstoß (nie still grün). */
export function verstoesse(seite, wert, grenze) {
  if (!grenze) return [`${seite}: keine Grenzen`]
  const aus = []
  for (const k of [...HOECHSTENS, ...MINDESTENS]) {
    const w = wert[k]
    const g = grenze[k]
    if (typeof w !== 'number' || Number.isNaN(w)) aus.push(`${seite}: ${k} nicht gemessen`)
    else if (typeof g !== 'number') aus.push(`${seite}: ${k} ohne Grenze`)
    else if (HOECHSTENS.includes(k) ? w > g : w < g) aus.push(`${seite}: ${k} ${w} ${HOECHSTENS.includes(k) ? '>' : '<'} ${g}`)
  }
  return aus
}

/** Ratsche: Grenzen, die gegenüber dem Stand auf main gelockert wurden (Obergrenze höher, Untergrenze tiefer). Ohne Basis keine Prüfung. */
export function gelockert(neu, alt) {
  if (!alt) return []
  const aus = []
  for (const [profil, seiten] of Object.entries(alt)) {
    if (typeof seiten !== 'object' || !seiten) continue
    for (const [seite, grenzen] of Object.entries(seiten)) {
      for (const [k, g] of Object.entries(grenzen)) {
        const n = neu?.[profil]?.[seite]?.[k]
        if (n === undefined) aus.push(`${profil}/${seite}/${k}: entfernt (main ${g})`)
        else if (HOECHSTENS.includes(k) ? n > g : n < g) aus.push(`${profil}/${seite}/${k}: ${g} → ${n}`)
      }
    }
  }
  return aus
}

const zelle = (k, w) => (w === undefined ? '–' : k === 'bytes' ? `${Math.round(w / 1024)} KB` : String(w))

/** Markdown-Tabelle: je Seite Median und Grenze. */
export function tabelle(ergebnis, grenzen) {
  const kopf = ['Seite', ...HOECHSTENS, ...MINDESTENS]
  const zeilen = [`| ${kopf.join(' | ')} |`, `|${kopf.map(() => '---').join('|')}|`]
  for (const [seite, wert] of Object.entries(ergebnis)) {
    const g = grenzen?.[seite] ?? {}
    zeilen.push(`| ${seite} | ${[...HOECHSTENS, ...MINDESTENS].map((k) => `${zelle(k, wert[k])} (${HOECHSTENS.includes(k) ? '≤' : '≥'} ${zelle(k, g[k])})`).join(' | ')} |`)
  }
  return zeilen.join('\n')
}
