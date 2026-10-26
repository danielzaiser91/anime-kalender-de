/**
 * Beleg „check:logic war für genau diesen Inhalt grün“ (26.10.2026): Ein Datenfix ließ `check:logic` (~4 min) bis zu viermal laufen,
 * obwohl die Prüfung keinen Bestand liest (`tools/bestand-sperre.cjs`). Der Beleg ist ein Abdruck über alle Dateien, die weder
 * Datenpfad noch Bot-Datei ohne Leser sind (`istDatenpfad`, dieselbe Liste wie beim Neuversuch, `tools/neuversuch-art.mjs`).
 * Gleicher Abdruck heißt gleicher Code- und Beleg-Inhalt; bewegt sich irgendetwas außerhalb der Datenpfade, ist der Abdruck ein anderer
 * und die Prüfung läuft wie bisher (Rückfall: im Zweifel prüfen).
 *
 * Aufrufe:
 *   abdruck            druckt den Abdruck der Arbeitskopie (Dateien nach git, ohne ignorierte).
 *   gleich <abdruck>   Exit 0, wenn der Abdruck nicht leer ist und der der Arbeitskopie gleicht (commit-data.sh, Bau-Lauf).
 *   zeile <abdruck>    druckt die Beleg-Zeile für die Commit-Nachricht, wenn der Abdruck der Arbeitskopie gleicht, sonst nichts.
 *   gueltig            Deploy: schreibt `gueltig=1` nach $GITHUB_OUTPUT, wenn ein Bau-Commit der letzten 30 den Abdruck der Arbeitskopie belegt.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { istDatenpfad } from './pr-nachrechnen.mjs'

/** Autor der Bau-Commits (`BOT_MAIL` in tools/commit-data.sh); nur ihre Beleg-Zeilen gelten. */
export const BOT_MAIL = '41898282+github-actions[bot]@users.noreply.github.com'
export const BELEG_ZEILE = /^Logik-geprueft: ([0-9a-f]{64})$/m

const git = (args, optionen = {}) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, stdio: 'pipe', ...optionen })

/** Abdruck über Pfad und Inhalts-Hash aller Dateien außerhalb der Datenpfade (sortiert). Wirft bei Pfaden mit Zeilenumbruch: dann kein Beleg. */
export function abdruckVon(pfadeUndHashes) {
  const zeilen = pfadeUndHashes.map(([pfad, hash]) => `${hash} ${pfad}`).sort()
  return createHash('sha256').update(zeilen.join('\n')).digest('hex')
}

/**
 * Ausgaben des Bau-Laufs, die kein Commit je aufnimmt (weder `QUELLEN` noch `ERZEUGNISSE`, tools/quellen-liste.sh) und die keine Prüfung liest:
 * `data:dub-checks` überschreibt sie bei jedem Bau, im Repo steht seit 29.09.2026 der Handstand. Sie zählen weder im Abdruck noch als Abweichung.
 */
export const NIE_COMMITTET = ['data/dub-pruefliste-zurueckgestellt.md']

/** Zählt der Pfad zum Abdruck? Nein bei Datenpfaden und bei Ausgaben, die nie in einen Commit gehen. */
const zaehlt = (pfad) => !istDatenpfad(pfad) && !NIE_COMMITTET.includes(pfad)

/** Abdruck der Arbeitskopie in `cwd`. */
export function abdruckAusGit(cwd = process.cwd(), lauf = git) {
  const roh = lauf(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd })
  const alle = [...new Set(roh.split('\0').filter(Boolean))]
  if (alle.some((p) => p.includes('\n'))) throw new Error('Pfad mit Zeilenumbruch')
  const pfade = alle.filter((p) => zaehlt(p) && existsSync(`${cwd}/${p}`))
  const hashes = lauf(['hash-object', '--stdin-paths'], { cwd, input: `${pfade.join('\n')}\n` }).split('\n').filter(Boolean)
  if (hashes.length !== pfade.length) throw new Error('Hash-Anzahl weicht von der Dateizahl ab')
  return abdruckVon(pfade.map((p, i) => [p, hashes[i]]))
}

/**
 * Zählende Pfade, in denen die Arbeitskopie vom Index abweicht (geändert, gelöscht, neu und ungestagt). Der Commit nähme sie nicht mit, geprüft
 * wurden sie trotzdem: der Abdruck der Arbeitskopie wäre ein anderer als der des Commits, und der Deploy fände den Beleg nicht (26.10.2026).
 */
export function ungestagt(cwd = process.cwd(), lauf = git) {
  const geaendert = lauf(['diff', '--name-only', '-z'], { cwd }).split('\0')
  const neu = lauf(['ls-files', '-z', '--others', '--exclude-standard'], { cwd }).split('\0')
  return [...new Set([...geaendert, ...neu].filter(Boolean))].filter(zaehlt).sort()
}

export const belegZeile = (abdruck) => `Logik-geprueft: ${abdruck}`

/** Beleg-Abdruck einer Commit-Nachricht oder null. */
export const belegAusNachricht = (nachricht) => BELEG_ZEILE.exec(nachricht)?.[1] ?? null

/** Belegt einer der Commits (`{ email, nachricht }`) von der Bau-App den Abdruck? */
export function belegt(commits, abdruck) {
  return commits.some((c) => c.email === BOT_MAIL && belegAusNachricht(c.nachricht) === abdruck)
}

function letzteCommits(anzahl, cwd) {
  const roh = git(['log', `-${anzahl}`, '--format=%ae%x00%B%x01'], { cwd })
  return roh.split('\x01').map((s) => s.replace(/^\n/, '')).filter(Boolean).map((s) => {
    const [email, ...rest] = s.split('\0')
    return { email, nachricht: rest.join('\0') }
  })
}

/** Stempel des Aufrufs: `{ gueltig, grund }`. Jeder Fehler heißt „nicht gültig“. */
export function gueltigkeit(cwd, commits = letzteCommits) {
  try {
    const abdruck = abdruckAusGit(cwd)
    return belegt(commits(30, cwd), abdruck) ? { gueltig: true, grund: `Abdruck ${abdruck.slice(0, 12)} im Bau-Commit belegt` } : { gueltig: false, grund: `kein Bau-Commit belegt Abdruck ${abdruck.slice(0, 12)}` }
  } catch (fehler) {
    return { gueltig: false, grund: `Abdruck nicht berechenbar (${String(fehler.message).split('\n')[0]})` }
  }
}

/** Die Beleg-Zeile, wenn der Commit den geprüften Inhalt trägt; sonst eine Warnung mit den Pfaden, die er nicht mitnimmt. */
export function zeileOderGrund(cwd, abdruck, ausgabe, warnung, lauf = git) {
  let offen
  try {
    offen = ungestagt(cwd, lauf)
  } catch {
    offen = ['(Index nicht lesbar)']
  }
  if (offen.length) warnung(`::warning::Logik-Beleg entfällt, der Commit nähme nicht mit: ${offen.slice(0, 10).join(', ')}`)
  else ausgabe(belegZeile(abdruck))
}

/** Aufrufe der Kommandozeile; Rückgabe ist der Exit-Code. */
export function main([befehl, arg], cwd = process.cwd(), ausgabe = console.log, umgebung = process.env, warnung = console.error) {
  if (befehl === 'abdruck') {
    try {
      ausgabe(abdruckAusGit(cwd))
      return 0
    } catch {
      return 1
    }
  }
  if (befehl === 'gleich' || befehl === 'zeile') {
    let gleich = false
    try {
      gleich = abdruckAusGit(cwd) === arg
    } catch {
      gleich = false
    }
    if (befehl === 'zeile' && gleich) zeileOderGrund(cwd, arg, ausgabe, warnung)
    return befehl === 'gleich' && !gleich ? 1 : 0
  }
  if (befehl === 'gueltig') {
    const { gueltig, grund } = gueltigkeit(cwd)
    ausgabe(gueltig ? `check:logic entfällt: ${grund}` : `check:logic läuft: ${grund}`)
    if (gueltig && umgebung.GITHUB_OUTPUT) appendFileSync(umgebung.GITHUB_OUTPUT, 'gueltig=1\n')
    return 0
  }
  ausgabe('Aufruf: node tools/logik-beleg.mjs abdruck | gleich <abdruck> | zeile <abdruck> | gueltig')
  return 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
