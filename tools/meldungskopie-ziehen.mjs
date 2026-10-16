/**
 * Zieht die Meldungsdaten aus der echten D1 und baut die Kopie. Das ist der einzige Weg zur D1 in diesem Werkzeug und er liest
 * die drei Meldungstabellen einmal (73.313 Zeilen an einer Füllung in Produktionsgröße, lokal gemessen am 14.10.2026). Er läuft nur im
 * Lauf `meldungskopie.yml`; ein Agent holt die Kopie mit `holen`, nie mit `ziehen`. Auf die Platte des Laufs (und ins Artefakt)
 * kommt nur die verschlüsselte Datei.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { baueKopie, exportArgumente, schemaArgumente, schemaAusJson } from './meldungskopie-bauen.mjs'
import { tokenOderAbbruch, verschluessle } from './meldungskopie-schluessel.mjs'

export const DATENBANK = 'anime-kalender'
export const WRANGLER_CONFIG = 'worker/wrangler.toml'

/**
 * `wrangler d1 execute --json` meldet Fehler als JSON auf stdout (stderr bleibt leer); `execFileSync` wirft nur "Command failed: …".
 * Ohne diesen Zusatz stand im Lauf vom 15.10.2026 kein Grund im Protokoll.
 */
export function mitFehlertext(start) {
  return (args) => {
    try {
      return start(args)
    } catch (e) {
      const ausgabe = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().slice(0, 2000)
      throw new Error(ausgabe ? `${e.message}\nAusgabe von wrangler: ${ausgabe}` : e.message, { cause: e })
    }
  }
}

/** Startet das wrangler unter `wurzel/node_modules` (dessen Fehlertext siehe `mitFehlertext`). */
export const wranglerAus = (wurzel) =>
  mitFehlertext((args) =>
    execFileSync(process.execPath, [`${wurzel}/node_modules/wrangler/bin/wrangler.js`, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    }),
  )

/** `wrangler(args)` startet wrangler und liefert dessen Ausgabe; `jetzt` ist der Stand, der vor dem Export genommen wird. */
export function ziehen({ wrangler, ziel, umgebung = process.env, jetzt = new Date() }) {
  if (umgebung.GITHUB_ACTIONS !== 'true') {
    throw new Error('ziehen liest die echte D1 und läuft nur im Lauf meldungskopie.yml (gh workflow run meldungskopie.yml); Agenten nutzen "holen"')
  }
  // Vor dem ersten D1-Zugriff: ohne Schlüssel wird nichts gelesen und nichts hochgeladen.
  const token = tokenOderAbbruch(umgebung)
  // Ohne eigenes Token griffe wrangler auf eine Anmeldung des Rechners zurück (wrangler-OAuth); das Token des Laufs ist der einzige Zugang.
  if (!umgebung.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN fehlt: ziehen nutzt nur das Token des Laufs, nie eine wrangler-Anmeldung des Rechners')
  }
  const ordner = mkdtempSync(join(tmpdir(), 'meldungskopie-ziehen-'))
  try {
    const ausgabe = join(ordner, 'export.sql')
    // Schema zuerst: ein Fehler kostet vor dem Export nichts, und ein laufender Export blockiert andere Abfragen an der D1 (Lauf 15.10.2026 scheiterte hier).
    const schemaSql = schemaAusJson(wrangler(schemaArgumente(DATENBANK, WRANGLER_CONFIG)))
    wrangler(exportArgumente(DATENBANK, ausgabe, WRANGLER_CONFIG))
    const klar = join(ordner, 'kopie.sqlite')
    const zeilen = baueKopie({ exportSql: readFileSync(ausgabe, 'utf8'), schemaSql, stand: jetzt.toISOString(), ziel: klar })
    writeFileSync(ziel, verschluessle(readFileSync(klar), token))
    return zeilen
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
