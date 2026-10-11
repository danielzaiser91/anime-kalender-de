/**
 * **Die alte offene Meldung derselben Folge entfernen, bevor die neue eingefügt wird.**
 *
 * Aus `pruefung-speichern.ts` ausgelagert (11.10.2026). Bedingung: dieselbe Adresse, Folge, Staffel
 * und Seitenkennung; `IS` statt `=`, weil ältere Meldungen keine Staffel oder Kennung tragen und
 * `NULL = NULL` in SQLite nichts liefert (Begründung der Seitenkennung im Kopf von `speichereDaten`).
 *
 * **Über die Zeilen-ID, nicht über die Adresse** (11.10.2026): Die offenen Zeilen der Adresse hat
 * `ladeOffeneHashes` ohnehin gelesen. `DELETE … WHERE url = ?` las dieselben Zeilen ein zweites Mal
 * (rund 37 je Meldung, 289.000 am Tag des Massenlaufs); `WHERE id IN (…)` liest keine.
 */
import { type Env } from './env.ts'
import { offeneIds, type Folge, type OffeneHashes } from './pruefung-unveraendert.ts'

export async function loescheOffene(env: Env, offene: OffeneHashes | undefined, folge: Folge): Promise<void> {
  if (!offene) return await loescheOffeneNachAdresse(env, folge)
  const ids = offeneIds(offene, folge)
  if (!ids.length) return
  await env.DB.prepare(`DELETE FROM pruefung WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .run()
}

async function loescheOffeneNachAdresse(env: Env, { url, folgeNr, staffelNr, seitenKennung }: Folge): Promise<void> {
  await env.DB.prepare(
    folgeNr === null
      ? 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr IS NULL AND staffel IS ?2 AND seiten_kennung IS ?3'
      : 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr = ?2 AND staffel IS ?3 AND seiten_kennung IS ?4',
  )
    .bind(...(folgeNr === null ? [url, staffelNr, seitenKennung] : [url, folgeNr, staffelNr, seitenKennung]))
    .run()
}
