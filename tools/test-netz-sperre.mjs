/* Netz-Sperre für Browser-Tests, die Inhaltsskripte der Erweiterung laden: Die Skripte rufen echte Adressen
 * ab (Newsletter-Worker `…workers.dev/pruefung`); ohne Sperre fragte jeder Kettenlauf ~320-mal den
 * Worker (07.11.2026, Tageslimit). `sperreNetz` beantwortet jede Anfrage der Seite selbst. */

/** Beantwortet alle Anfragen der Seite mit `{}`; Routen, die danach registriert werden, haben Vorrang. Rückgabe: Liste der abgefangenen Adressen. */
export async function sperreNetz(seite) {
  const abgefangen = []
  await seite.route('**/*', (r) => {
    abgefangen.push(r.request().url())
    return r.fulfill({ contentType: 'application/json', body: '{}' })
  })
  return abgefangen
}

/** Quelltext eines Tests lädt Playwright und Dateien aus `extension/`, ruft aber `sperreNetz(` nicht auf. */
export function sperreFehlt(quelltext) {
  const playwright = /\bfrom\s+['"]playwright(-core)?['"]|import\(\s*['"]playwright/.test(quelltext)
  const erweiterung = /['"]extension['"]|\bextension\//.test(quelltext)
  return playwright && erweiterung && !/\bsperreNetz\(/.test(quelltext)
}
