/**
 * Urteil der Lighthouse-Messung als reine Funktionen (`lighthouse-messen.mjs`): Median je Seite und Kennzahl, Vergleich mit
 * `tools/lighthouse-grenzen.mjs` und die Ratschen-Prüfung (eine Grenze darf nur strenger werden als auf main).
 */

/** Kennzahlen mit Obergrenze (kleiner ist besser) und Kategorien mit Untergrenze (Punkte 0–100, größer ist besser). */
export const HOECHSTENS = ['lcp', 'cls', 'tbt', 'bytes']
export const MINDESTENS = ['performance', 'accessibility', 'best-practices', 'seo']

/**
 * TBT und Performance hängen am Runner (benchmarkIndex, Median der Läufe; Herleitung: docs/wissen/betrieb.md, „TBT auf den Runner normiert“).
 * Die Grundgrenze (`tbt`) gilt für schnelle Runner (≥ 3250), `tbt-mittel` ab 2750, `tbt-langsam` darunter; fehlt eine Bandgrenze, gilt die Grundgrenze.
 */
export const NORMIERT = ['tbt', 'performance']
const BAENDER = [{ ab: 3250, suffix: '' }, { ab: 2750, suffix: '-mittel' }, { ab: 0, suffix: '-langsam' }]
const bandSuffix = (benchmark) => BAENDER.find((b) => benchmark >= b.ab)?.suffix ?? '-langsam'
const grundname = (k) => k.replace(/-(mittel|langsam)$/, '')

/** Die Grenze einer Kennzahl für einen Runner dieser Geschwindigkeit. */
export function grenzeFuer(k, grenze, benchmark) {
  return NORMIERT.includes(k) ? (grenze[k + bandSuffix(benchmark)] ?? grenze[k]) : grenze[k]
}

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
    // Rechnergeschwindigkeit laut Lighthouse: TBT skaliert mit ihr (gleicher Code, zwei Runner: TBT 228 und 591 ms, 18.11.2026); wählt das Grenzband.
    benchmark: Math.round(bericht.environment?.benchmarkIndex ?? 0),
  }
}

/** Die größten Anfragen eines Berichts (URL, übertragene Bytes), absteigend; so lassen sich die Byte-Stufen eines Ausreißers benennen. */
export function groessteAnfragen(bericht, anzahl = 20) {
  const items = bericht.audits?.['network-requests']?.details?.items ?? []
  return items
    .filter((i) => typeof i.transferSize === 'number')
    .map((i) => ({ url: i.url, bytes: i.transferSize }))
    .sort((x, y) => y.bytes - x.bytes)
    .slice(0, anzahl)
}

const median = (zahlen) => [...zahlen].sort((x, y) => x - y)[Math.floor(zahlen.length / 2)]

/** Median je Kennzahl über die Läufe einer Seite; Bytes: Minimum, denn Nachlader kommen je nach Messende als feste Stufen obendrauf (Bericht 19.11.2026). */
export function mediane(laeufe) {
  return Object.fromEntries([...HOECHSTENS, ...MINDESTENS, 'benchmark'].map((k) => [k, k === 'bytes' ? Math.min(...laeufe.map((l) => l[k])) : median(laeufe.map((l) => l[k]))]))
}

/** Verstöße einer Seite gegen ihre Grenzen; fehlt eine Grenze oder ein Messwert, ist das selbst ein Verstoß (nie still grün). */
export function verstoesse(seite, wert, grenze) {
  if (!grenze) return [`${seite}: keine Grenzen`]
  const aus = []
  const normiert = Object.keys(grenze).some((k) => k !== grundname(k))
  if (normiert && !(wert.benchmark > 0)) aus.push(`${seite}: benchmark nicht gemessen`)
  for (const k of [...HOECHSTENS, ...MINDESTENS]) {
    const w = wert[k]
    const g = grenzeFuer(k, grenze, wert.benchmark)
    const band = normiert && NORMIERT.includes(k) ? ` [benchmark ${wert.benchmark}]` : ''
    if (typeof w !== 'number' || Number.isNaN(w)) aus.push(`${seite}: ${k} nicht gemessen`)
    else if (typeof g !== 'number') aus.push(`${seite}: ${k} ohne Grenze`)
    else if (HOECHSTENS.includes(k) ? w > g : w < g) aus.push(`${seite}: ${k} ${w} ${HOECHSTENS.includes(k) ? '>' : '<'} ${g}${band}`)
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
        else if (HOECHSTENS.includes(grundname(k)) ? n > g : n < g) aus.push(`${profil}/${seite}/${k}: ${g} → ${n}`)
      }
    }
  }
  return aus
}

const zelle = (k, w) => (w === undefined ? '–' : k === 'bytes' ? `${Math.round(w / 1024)} KB` : String(w))

/** Markdown-Tabelle: je Seite Median und Grenze (für den Runner dieses Laufs), zuletzt dessen benchmark. */
export function tabelle(ergebnis, grenzen) {
  const kopf = ['Seite', ...HOECHSTENS, ...MINDESTENS, 'benchmark']
  const zeilen = [`| ${kopf.join(' | ')} |`, `|${kopf.map(() => '---').join('|')}|`]
  for (const [seite, wert] of Object.entries(ergebnis)) {
    const g = grenzen?.[seite] ?? {}
    const zellen = [...HOECHSTENS, ...MINDESTENS].map((k) => `${zelle(k, wert[k])} (${HOECHSTENS.includes(k) ? '≤' : '≥'} ${zelle(k, grenzeFuer(k, g, wert.benchmark))})`)
    zeilen.push(`| ${seite} | ${[...zellen, zelle('benchmark', wert.benchmark)].join(' | ')} |`)
  }
  return zeilen.join('\n')
}
