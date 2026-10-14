/**
 * Zieht die Meldungsdaten aus der echten D1 und baut die Kopie. Das ist der einzige Weg zur D1 in diesem Werkzeug und er liest
 * die drei Meldungstabellen einmal (73.313 Zeilen an einer Füllung in Produktionsgröße, lokal gemessen am 14.10.2026). Er läuft nur im
 * Lauf `meldungskopie.yml`; ein Agent holt die Kopie mit `holen`, nie mit `ziehen`. Auf die Platte des Laufs (und ins Artefakt)
 * kommt nur die verschlüsselte Datei.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { baueKopie, exportArgumente, schemaArgumente, schemaAusJson } from './meldungskopie-bauen.mjs'
import { tokenOderAbbruch, verschluessle } from './meldungskopie-schluessel.mjs'

export const DATENBANK = 'anime-kalender'
export const WRANGLER_CONFIG = 'worker/wrangler.toml'

/** `wrangler(args)` startet wrangler und liefert dessen Ausgabe; `jetzt` ist der Stand, der vor dem Export genommen wird. */
export function ziehen({ wrangler, ziel, umgebung = process.env, jetzt = new Date() }) {
  if (umgebung.GITHUB_ACTIONS !== 'true') {
    throw new Error('ziehen liest die echte D1 und läuft nur im Lauf meldungskopie.yml (gh workflow run meldungskopie.yml); Agenten nutzen "holen"')
  }
  // Vor dem ersten D1-Zugriff: ohne Schlüssel wird nichts gelesen und nichts hochgeladen.
  const token = tokenOderAbbruch(umgebung)
  const ordner = mkdtempSync(join(tmpdir(), 'meldungskopie-ziehen-'))
  try {
    const ausgabe = join(ordner, 'export.sql')
    wrangler(exportArgumente(DATENBANK, ausgabe, WRANGLER_CONFIG))
    const schemaSql = schemaAusJson(wrangler(schemaArgumente(DATENBANK, WRANGLER_CONFIG)))
    const klar = join(ordner, 'kopie.sqlite')
    const zeilen = baueKopie({ exportSql: readFileSync(ausgabe, 'utf8'), schemaSql, stand: jetzt.toISOString(), ziel: klar })
    writeFileSync(ziel, verschluessle(readFileSync(klar), token))
    return zeilen
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
