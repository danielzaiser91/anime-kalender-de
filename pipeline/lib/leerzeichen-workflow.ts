export interface UmleitungsFund {
  zeile: number
  text: string
}

interface Zustand {
  quote: string | null
  heredoc: string | null
}

/**
 * Ersetzt Zeichenketteninhalt durch `x` und schneidet ` # Kommentar` ab; ein offenes Anführungszeichen
 * gilt für die Folgezeilen (mehrzeilige Zeichenkette). Ein `>>` im Text ohne Shell-Bezug zählt so nicht.
 */
function bereinige(zeile: string, z: Zustand): string {
  let aus = ''
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i]
    if (z.quote) {
      if (c === '\\' && z.quote === '"') { i++; aus += 'xx'; continue }
      if (c === z.quote) { z.quote = null; aus += c } else aus += 'x'
      continue
    }
    if (c === '#' && (i === 0 || /\s/.test(zeile[i - 1]))) break
    if (c === '"' || c === "'") z.quote = c
    aus += c
  }
  return aus
}

const RUN = /^(\s*(?:-\s+)?)run:\s*(.*)$/
const BLOCK_KOPF = /^[|>][+-]?\d*\s*(#.*)?$/
const VERSCHLUCKT = /[^\s0-9&>]>>(?!>)|(?<!>)>>[^\s>]/

/** Prüft eine Zeile eines `run:`-Werts; Heredoc-Körper und `$((…))` sind keine Umleitung. */
function pruefeZeile(roh: string, z: Zustand): boolean {
  if (z.heredoc) {
    if (roh.trim() === z.heredoc) z.heredoc = null
    return false
  }
  const marke = /(?<!<)<<-?\s*(['"]?)(\w+)\1/.exec(roh)
  if (marke) z.heredoc = marke[2]
  const zeile = bereinige(roh, z).replace(/\$\(\([^)]*\)\)/g, '')
  return VERSCHLUCKT.test(zeile)
}

/**
 * Findet in Workflow-YAML in `run:`-Werten jedes `>>` (Anhängen), vor dem ein Wortzeichen ohne Leerraum steht
 * („echo a>>$GITHUB_OUTPUT“) oder nach dem direkt das Ziel folgt („>>datei“). `2>>` und `&>>` sind vorn frei.
 */
export function findeUmleitung(text: string): UmleitungsFund[] {
  const funde: UmleitungsFund[] = []
  let blockSpalte = -1
  let z: Zustand = { quote: null, heredoc: null }
  text.split('\n').forEach((roh, i) => {
    const einzug = roh.search(/\S/)
    let treffer = false
    if (blockSpalte >= 0 && einzug === -1) return
    if (blockSpalte >= 0 && einzug > blockSpalte) {
      treffer = pruefeZeile(roh, z)
    } else {
      blockSpalte = -1
      const m = RUN.exec(roh)
      if (!m) return
      z = { quote: null, heredoc: null }
      if (BLOCK_KOPF.test(m[2])) { blockSpalte = m[1].length; return }
      treffer = pruefeZeile(m[2], z)
    }
    if (treffer) funde.push({ zeile: i + 1, text: roh.trim() })
  })
  return funde
}
