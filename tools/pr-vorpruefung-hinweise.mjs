/**
 * Lokale Hinweise der Vorprüfung (14.11.2026), die die Kette sonst erst rot meldet: neue Mutanten ohne `tests`
 * (Ratsche tools/mutationsanker-ohne-tests.test.mjs) und umgeschriebene Patch-Notes-Texte bei altem Stempel
 * (pipeline/check-patchnotes-stempel-regel.ts, dort gilt der jüngste umgeschriebene Tag, hier schärfer: heute).
 */
import { listenImDiff, ohneTestsEintrag } from './mutationsanker.mjs'

const STEMPEL_PFAD = 'data/patchnotes/_ueberarbeitet-bis.txt'
const EINTRAG = /^data\/patchnotes\/[^/]+\.yaml$/

/** Hinweise zu Mutanten ohne `tests`, die der Diff gegenüber der Basis neu hat; `lies`/`liesBasis` liefern den Listentext oder null. */
export function mutantenOhneTestsHinweise(dateien, lies, liesBasis) {
  return listenImDiff(dateien).flatMap((liste) => {
    const text = lies(liste)
    if (text === null) return []
    const alt = new Set(ohneTestsEintrag(liesBasis(liste) ?? '[]'))
    return ohneTestsEintrag(text)
      .filter((name) => !alt.has(name))
      .map((name) => `${liste}: neuer Mutant „${name}“ ohne Feld tests (die Kette lehnt ihn ab).`)
  })
}

const NEUER_TEST = /^(?!tools\/testdaten\/).*\.test\.(mjs|cjs|js|ts|tsx)$/
// Beleg: „rot“ und „Basis“ in einer Zeile (Lehre 152; die rote Ausgabe selbst steht darunter)
const BASIS_ROT = /Basis[^\n]{0,80}\brot\b|\brot\b[^\n]{0,80}Basis/i

/** Hinweis, wenn der Diff neue Testdateien (`A`) bringt, der PR-Text aber keinen Beleg „rot an der Basis“ nennt (Lehre 152, 21.11.2026). */
export function neuerTestBasisHinweise(nameStatus, text) {
  const neu = nameStatus.split('\n').map((z) => z.split('\t')).filter(([s, p]) => s === 'A' && NEUER_TEST.test(p ?? '')).map(([, p]) => p)
  if (!neu.length || BASIS_ROT.test(text)) return []
  return [`Neuer Test ${neu.join(', ')}: kein Beleg „rot an der Basis“ im PR-Text (Lehre 152); mindestens ein Fall muss gegen die main-Fassung des Prüflings rot sein, die rote Ausgabe gehört in Beschreibung oder Nachtrag.`]
}

/** Hinweis, wenn der Diff bestehende Patch-Notes-Einträge umschreibt (`M`), der Stempel aber nicht auf `heute` steht. */
export function stempelHinweise(nameStatus, stempelText, heute) {
  const umgeschrieben = nameStatus.split('\n').map((z) => z.split('\t')).filter(([s, p]) => s === 'M' && EINTRAG.test(p ?? ''))
  if (!umgeschrieben.length) return []
  const stempel = stempelText?.trim()
  if (stempel === heute) return []
  return [`Patch-Notes-Texte umgeschrieben, ${STEMPEL_PFAD} steht auf ${stempel || 'nichts'} statt ${heute}; die Kette verlangt mindestens den jüngsten umgeschriebenen Tag.`]
}
