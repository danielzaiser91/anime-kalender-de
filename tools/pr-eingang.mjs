/**
 * Laufzeitsperre für den Eingang des CI-Prüfers (17.10.2026, PR 1427).
 *
 *   node tools/pr-eingang.mjs <pr-beschreibung.txt> <diff-zustand> <kopf-sha>     (gibt `zustand=ok` oder `zustand=unvollstaendig` aus)
 *
 * `ok` nur, wenn der Diff vollständig ist und die Beschreibung mit der Commit-Liste aus `pr-nachtraege.mjs` endet, deren
 * letzter Commit der Kopf des PR ist. So fällt jeder Weg auf, auf dem die Commit-Liste den Prüfer nicht erreicht
 * (Schritt umgebaut, falsche PR-Nummer, Datei danach überschrieben). Fehlen nur die Nachträge (Kommentar-API aus),
 * setzt pr-nachtraege.mjs eine Hinweiszeile ans Ende; sie ist nicht der Kopf-Commit, also ebenfalls `unvollstaendig`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COMMITS } from './pr-nachtraege.mjs'

export function eingangZustand(text, diffZustand, kopf) {
  if (diffZustand !== 'ok' || !/^[0-9a-f]{40}$/.test(kopf ?? '')) return 'unvollstaendig'
  const ab = text.lastIndexOf(COMMITS)
  if (ab < 0) return 'unvollstaendig'
  const zeilen = text.slice(ab + COMMITS.length).split('\n').filter((z) => z !== '')
  const amEnde = zeilen.length > 0 && zeilen.every((z) => z.startsWith('- '))
  return amEnde && zeilen.at(-1).startsWith(`- ${kopf.slice(0, 9)} `) ? 'ok' : 'unvollstaendig'
}

function main() {
  const [datei, diffZustand, kopf] = process.argv.slice(2)
  let text = ''
  try {
    text = readFileSync(datei, 'utf8')
  } catch (e) {
    console.error(`Beschreibung nicht lesbar: ${e.message}`)
  }
  const zustand = eingangZustand(text, diffZustand, kopf)
  if (zustand !== 'ok') console.error(`Prüfer-Eingang unvollständig (Diff ${diffZustand || 'leer'}, Commit-Liste fehlt, endet nicht am Kopf ${kopf} oder trägt einen Hinweis)`)
  console.log(`zustand=${zustand}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
