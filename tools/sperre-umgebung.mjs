/** Umgebung für Prüfungen unter der Bestandssperre (`tools/bestand-sperre.cjs`): lädt sie per `NODE_OPTIONS` auch in Unterprozesse. */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sperre = join(dirname(fileURLToPath(import.meta.url)), 'bestand-sperre.cjs').replace(/\\/g, '/')

/** `erlaubt`: Pfade einer Ausnahme (kommagetrennt), `spurDatei`: Ablage der erlaubten Lesezugriffe. */
export function sperreUmgebung(erlaubt = '', spurDatei = '') {
  const optionen = `${process.env.NODE_OPTIONS ?? ''} --require ${sperre}`.trim()
  return { ...process.env, NODE_OPTIONS: optionen, BESTAND_ERLAUBT: erlaubt, BESTAND_SPUR: spurDatei }
}
