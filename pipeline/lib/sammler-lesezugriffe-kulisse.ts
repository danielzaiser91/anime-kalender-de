import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Legt die Dateien in einen frischen Wegwerf-Ordner unter dem Temp-Verzeichnis und gibt dessen Wurzel zurück. */
export function legeKulisseAn(dateien: Record<string, string>): string {
  const w = mkdtempSync(join(tmpdir(), 'sammler-lesezugriffe-'))
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(join(w, pfad, '..'), { recursive: true })
    writeFileSync(join(w, pfad), text)
  }
  return w
}
