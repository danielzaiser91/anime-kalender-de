/**
 * Wächter für die Läufer `check-logic-alle.mjs` und `tests-alle.mjs`: eine Prüfung darf weder getrackte Dateien verändern
 * noch Dateien im Arbeitsbaum anlegen (Anlass 15.10.2026: zwei Prüfungen überschrieben parallel `data/suchadressen-offen.json`, der Lauf blieb grün).
 * `gitStand` hält den Inhalt aller getrackten Änderungen (`git diff HEAD`) und die ungetrackten Dateien (nicht ignoriert) fest,
 * `veraenderte` nennt, was dazugekommen ist, sich geändert hat oder verschwunden ist.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { join } from 'node:path'

const git = (wurzel, args) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const zeilen = (text) => text.split('\n').filter(Boolean)

/** Ungetrackte Datei: Größe und Änderungszeit; verschwindet sie zwischen Auflisten und Lesen, zählt sie als weg. */
function ungetrackt(wurzel, datei) {
  try {
    const s = statSync(join(wurzel, datei))
    return `neu:${s.size}:${s.mtimeMs}`
  } catch {
    return 'weg'
  }
}

/** Arbeitsbäume anderer Agenten (`_wt-*` im Hauptordner) sind kein Repo-Inhalt; ihr Anlegen und Abräumen ist keine Prüfungs-Schreibung (20.10.2026). */
const keinFremderArbeitsbaum = (datei) => !datei.startsWith('_wt-')

/** Stand des Arbeitsbaums: je Datei ein Hash des Diffs bzw. der Stand der ungetrackten Datei. `null`, wenn `wurzel` kein Git-Arbeitsbaum ist. */
export function gitStand(wurzel) {
  try {
    const stand = new Map()
    for (const datei of zeilen(git(wurzel, ['diff', 'HEAD', '--name-only']))) {
      /* Volle Hashes: Ein Lauf vertieft den flachen CI-Klon (`vertiefeFlachenKlon`), danach kürzt Git länger ab, und jede schon geänderte Datei sah verändert aus (Bestandsbau seit 16.10.2026). */
      stand.set(datei, createHash('sha1').update(git(wurzel, ['diff', '--full-index', 'HEAD', '--', datei])).digest('hex'))
    }
    for (const datei of zeilen(git(wurzel, ['ls-files', '--others', '--exclude-standard'])).filter(keinFremderArbeitsbaum)) {
      stand.set(datei, ungetrackt(wurzel, datei))
    }
    return stand
  } catch {
    return null
  }
}

/** Dateien, die gegenüber `vorher` neu sind, sich geändert haben oder verschwunden sind (auch: wieder auf Stand von HEAD gebracht). */
export function veraenderte(vorher, nachher) {
  if (!vorher || !nachher) return []
  const namen = new Set([...vorher.keys(), ...nachher.keys()])
  return [...namen].filter((d) => vorher.get(d) !== nachher.get(d)).sort()
}
