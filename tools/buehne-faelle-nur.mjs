/**
 * Hilfen für `buehne-faelle.mjs --nur <slug>`: einen Fall in die bestehende `faelle.json` übernehmen,
 * alle anderen Fälle, `heute` und `meta` bleiben unverändert (gleiche Schlüsselreihenfolge, gleiche Bytes).
 */

/** Liest `--nur <slug>` und `--ziel <datei>` aus den Argumenten; fehlt ein Wert, ist das ein Fehler. */
export function leseOptionen(argv) {
  const ergebnis = { nur: undefined, ziel: undefined }
  for (let i = 0; i < argv.length; i++) {
    const name = { '--nur': 'nur', '--ziel': 'ziel' }[argv[i]]
    if (!name) throw new Error(`Unbekannte Option ${argv[i]}`)
    const wert = argv[++i]
    if (!wert || wert.startsWith('--')) throw new Error(`${argv[i - 1]} braucht einen Wert`)
    ergebnis[name] = wert
  }
  return ergebnis
}

/**
 * Setzt `fall` unter `slug` in die bestehende Ausgabe. Ein vorhandener Fall behält seinen Platz,
 * ein neuer steht am Ende. Gibt eine neue Ausgabe zurück, `bestehend` bleibt unberührt.
 */
export function uebernimmFall(bestehend, slug, fall) {
  return { ...bestehend, faelle: { ...bestehend.faelle, [slug]: fall } }
}
