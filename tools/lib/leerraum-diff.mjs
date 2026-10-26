/**
 * Findet Zeilen, die ein Diff nur im Leerraum ändert (Edit-Werkzeug verschluckt gelegentlich Leerzeichen, 25.10.2026).
 * Eingabe: `git diff -U0 --no-renames`. Ein Fund ist eine hinzugefügte Zeile, die in demselben Hunk
 * einer entfernten Zeile bis auf Leerraum gleicht, aber nicht zeichengleich ist.
 */

// Erzeugte Dateien: ihr Leerraum kommt vom Generator, nicht vom Edit-Werkzeug.
const AUSGENOMMEN = [/^public\/data\//, /^data\/cache\//, /(^|\/)package-lock\.json$/, /^extension\/pruefstand\.json$/]

const UMFORMATIEREN_AB = 3

const ohneLeerraum = (zeile) => zeile.replace(/\s+/g, '')

/** Funde eines Hunks: `entfernt` sind Texte, `hinzu` Zeilen mit Nummer (neu). */
function hunkFunde(datei, entfernt, hinzu) {
  const rest = [...entfernt]
  const funde = []
  for (const h of hinzu) {
    const gleich = rest.findIndex((e) => e === h.text)
    if (gleich >= 0) {
      rest.splice(gleich, 1)
      continue
    }
    const kern = ohneLeerraum(h.text)
    const aehnlich = kern ? rest.findIndex((e) => ohneLeerraum(e) === kern) : -1
    if (aehnlich < 0) continue
    const vorher = rest[aehnlich]
    funde.push({ datei, zeile: h.zeile, vorher, nachher: h.text, nurEinrueckung: vorher.trimStart() === h.text.trimStart() })
    rest.splice(aehnlich, 1)
  }
  return funde
}

/** Drei oder mehr Einrückungs-Änderungen in einer Datei sind Umformatieren (Umhüllen in JSX o. ä.), kein verschluckter Leerraum. */
function ohneUmformatieren(funde) {
  const einrueckungen = (datei) => funde.filter((f) => f.datei === datei && f.nurEinrueckung).length
  return funde.filter((f) => !(f.nurEinrueckung && einrueckungen(f.datei) >= UMFORMATIEREN_AB))
}

/** Alle Leerraum-Funde eines Diffs (Text von `git diff -U0`). */
export function leerraumFunde(diff) {
  const funde = []
  let datei = null
  let entfernt = []
  let hinzu = []
  let zeile = 0
  let imHunk = false
  const schliesse = () => {
    if (datei) funde.push(...hunkFunde(datei, entfernt, hinzu))
    entfernt = []
    hinzu = []
  }
  for (const z of diff.split('\n')) {
    if (z.startsWith('diff --git ')) {
      schliesse()
      imHunk = false
    } else if (!imHunk && z.startsWith('+++ ')) {
      const pfad = z.slice(6) // `+++ b/<pfad>`; bei `+++ /dev/null` gibt es keine Pluszeilen
      datei = AUSGENOMMEN.some((m) => m.test(pfad)) ? null : pfad
    } else if (z.startsWith('@@')) {
      schliesse()
      imHunk = true
      zeile = Number(/\+(\d+)/.exec(z)?.[1] ?? 0)
    } else if (z.startsWith('+')) {
      hinzu.push({ zeile: zeile++, text: z.slice(1) })
    } else if (z.startsWith('-')) {
      entfernt.push(z.slice(1))
    }
  }
  schliesse()
  return ohneUmformatieren(funde)
}

/** Absichtlicher Leerraum-Diff: eine Zeile `Leerraum: absichtlich – Grund` im PR-Text. */
export const leerraumErlaubt = (text) => /^Leerraum: absichtlich\s*[–-]\s*\S/m.test(text)

/** Rote Meldungen für die Vorprüfung; `diff` ist `git diff -U0 --no-renames origin/main...HEAD`. */
export function leerraumRot(diff, text) {
  if (leerraumErlaubt(text)) return []
  return leerraumFunde(diff).map(
    (f) => `Leerraum-Änderung ${f.datei}:${f.zeile} (nur Leerzeichen/Einrückung geändert): ${JSON.stringify(f.vorher)} → ${JSON.stringify(f.nachher)}. Absicht? Dann Zeile „Leerraum: absichtlich – Grund“ in den PR-Text.`,
  )
}
