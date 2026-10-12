/**
 * Warnung für `bau-vergleich.mjs`, wenn die Basis kein Vorfahre des Kandidaten ist (Kandidat hinter `origin/main`
 * oder auseinandergelaufen): Der Kandidat baut dann mit älterem Code auf dem Bestand der Basis, und was die Basis seit der
 * Merge-Basis geändert hat, taucht als Unterschied auf, ohne dass der Kandidat etwas dafür kann. Am 12.10.2026 verglichen
 * Prüfer gegen das wandernde `origin/main` und sahen 32 fremde Dateien (`public/data/synopses/*`).
 */

/** Abstand der beiden Commits: Commits nur im Kandidaten (`voraus`), nur in der Basis (`zurueck`), Merge-Basis. */
export function messeAbstand(git, basis, kandidat) {
  return {
    voraus: Number(git('rev-list', '--count', `${basis}..${kandidat}`)),
    zurueck: Number(git('rev-list', '--count', `${kandidat}..${basis}`)),
    mergeBase: git('merge-base', basis, kandidat),
  }
}

/** Dateien, die die Basis seit der Merge-Basis geändert hat (nur bei `zurueck > 0` nötig). */
export function vonBasisGeaendert(git, abstand, basis) {
  return git('-c', 'core.quotepath=off', 'diff', '--name-only', abstand.mergeBase, basis).split('\n').filter(Boolean)
}

/** Warnzeilen; leer, wenn die Basis Vorfahre des Kandidaten ist. */
export function abstandsWarnung(abstand, basis, kandidat) {
  if (abstand.zurueck === 0) return []
  const art = abstand.voraus === 0 ? 'ist Vorfahre der Basis' : `hat ${abstand.voraus} eigene Commits, ist aber auseinandergelaufen`
  return [
    `WARNUNG: Die Basis ${basis.slice(0, 12)} ist kein Vorfahre des Kandidaten ${kandidat.slice(0, 12)} (${abstand.zurueck} Commits der Basis fehlen ihm; er ${art}).`,
    '  Was die Basis seit der Merge-Basis geändert hat, taucht als Unterschied auf, ohne vom Kandidaten zu stammen.',
    abstand.voraus === 0
      ? '  Der Kandidat bringt nichts mit, was die Basis nicht schon hat — Basis und Kandidat vertauscht oder Zweig veraltet?'
      : `  Kandidat auf die Basis rebasen oder gegen die Merge-Basis vergleichen: node tools/bau-vergleich.mjs ${abstand.mergeBase.slice(0, 12)} ${kandidat.slice(0, 12)}`,
  ]
}

/** Zeile für den Schluss: wie viele der verschiedenen Dateien die Basis selbst geändert hat (vermutlich fremd); `null`, wenn keine. */
export function fremdeUnterschiede(verschieden, geaendertVonBasis) {
  const basis = new Set(geaendertVonBasis)
  const fremd = verschieden.filter((f) => basis.has(f))
  if (!fremd.length) return null
  const beispiele = fremd.slice(0, 3).join(', ') + (fremd.length > 3 ? ', …' : '')
  return `Davon ${fremd.length} von ${verschieden.length} Dateien, die die Basis seit der Merge-Basis selbst geändert hat (vermutlich nicht vom Kandidaten): ${beispiele}`
}
