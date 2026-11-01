export interface UmleitungsFund {
  zeile: number
  text: string
}

/** Zeichenketteninhalt wird durch `x` ersetzt, damit ein `>>` im Text ohne Shell-Bezug nicht zählt. */
function ohneZeichenketten(zeile: string): string {
  return zeile.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, (m) => `"${'x'.repeat(m.length - 2)}"`)
}

/**
 * Findet in YAML-Text jedes `>>` (Anhängen), vor dem ein Wortzeichen ohne Leerraum steht („echo a>>$GITHUB_OUTPUT“)
 * oder nach dem direkt das Ziel folgt („>>datei“). `2>>` und `&>>` sind vorn frei, Kommentarzeilen und Zeichenketten zählen nicht.
 */
export function findeUmleitung(text: string): UmleitungsFund[] {
  const funde: UmleitungsFund[] = []
  text.split('\n').forEach((roh, i) => {
    if (/^\s*#/.test(roh)) return
    const zeile = ohneZeichenketten(roh.replace(/\s#\s.*$/, ''))
    if (/[^\s0-9&>]>>(?!>)|(?<!>)>>[^\s>]/.test(zeile)) funde.push({ zeile: i + 1, text: roh.trim() })
  })
  return funde
}
