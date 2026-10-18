/**
 * Rote Sammler-PRs (17.10.2026): Ein Fund, der `check:logic` bricht, wird als PR mit der Marke „[Prüfung rot]“ eingereicht und nie gemergt (`tools/quellen-pr.sh`).
 * Der Lauf endet dabei grün, deshalb braucht es zwei Dinge, damit der Fund nicht still liegt:
 *  - Sichtbarkeit: `meldeRoteSammlerPrs` listet die offenen Marken-PRs mit Alter; `tools/laeufe-aufraeumen.mjs` ruft es an jeder Wachphase auf.
 *  - Grenze: Ein neuer roter PR desselben Funds löst die älteren ab (`nummern`); es liegt je Fund höchstens einer. Der Fund-Schlüssel (Workflow/Job/Nachricht)
 *    steht als Kommentarzeile im Text: Ein Workflow hat mehrere Einreicher (refresh-weekly: sieben Jobs), der Name allein schlösse fremde Funde.
 *
 * Aufruf: `gh pr list --state open --limit 100 --json number,title,body,createdAt | node tools/rote-sammler-prs.mjs nummern "<Fund-Schlüssel>" "<neue Nummer>"`
 * gibt die Nummern der abzulösenden PRs aus, eine je Zeile.
 */
import { execSync } from 'node:child_process'

export const MARKE = '[Prüfung rot]'
const STUNDE = 3600_000

/* GitHub liefert Texte, die im Browser bearbeitet wurden, mit CRLF; `$` mit `m` endet auch vor `\r`, `.` frisst es nicht. */
const SCHLUESSEL_ZEILE = /^<!-- fund-schluessel: (.*) -->$/m

/** Fund-Schlüssel aus dem PR-Text (`tools/quellen-pr.sh`); undefined, wenn der Text keinen trägt. */
export const schluesselVon = (pr) => String(pr.body ?? '').match(SCHLUESSEL_ZEILE)?.[1]

/** Offene PRs mit der Marke im Titel; mit `schluessel` nur die desselben Funds (ganzer Schlüssel, kein Teilwort). */
export function rotePrs(liste, schluessel) {
  return liste.filter((pr) => pr.title.startsWith(MARKE) && (schluessel === undefined || schluesselVon(pr) === schluessel))
}

/** Nummern, die ein neuer roter PR (`neu`) mit `schluessel` ablöst: alle anderen roten PRs desselben Funds. */
export function abzuloesen(liste, schluessel, neu) {
  return rotePrs(liste, schluessel).filter((pr) => String(pr.number) !== String(neu)).map((pr) => pr.number)
}

function alter(erstellt, jetzt) {
  const stunden = Math.floor((jetzt - Date.parse(erstellt)) / STUNDE)
  return stunden < 48 ? `${stunden} h` : `${Math.floor(stunden / 24)} Tage`
}

/** Zeilen für die Wachphase; leer, wenn nichts offen ist. */
export function zeilen(liste, jetzt) {
  const rote = rotePrs(liste)
  if (!rote.length) return []
  return [`${rote.length} Sammler-PR(s) mit roter Datenprüfung offen (nicht gemergt, ein Mensch löst sie):`, ...rote.map((pr) => `  #${pr.number}  seit ${alter(pr.createdAt, jetzt)}  ${pr.title}`)]
}

const ghListe = () => JSON.parse(execSync('gh pr list --state open --limit 100 --json number,title,body,createdAt', { encoding: 'utf8', maxBuffer: 8 << 20 }))

/** Schreibt die offenen roten Sammler-PRs; ein Fehler beim Abruf wird gemeldet, nie geworfen (die Wachphase läuft weiter). */
export function meldeRoteSammlerPrs(lies = ghListe, log = console.log, jetzt = Date.now()) {
  try {
    const z = zeilen(lies(), jetzt)
    log(z.length ? z.join('\n') : 'Keine Sammler-PRs mit roter Datenprüfung offen.')
  } catch (e) {
    log(`Rote Sammler-PRs nicht lesbar: ${String(e.message).split('\n')[0]}`)
  }
}

if (process.argv[2] === 'nummern') {
  const eingabe = await new Promise((fertig) => {
    let text = ''
    process.stdin.on('data', (d) => (text += d))
    process.stdin.on('end', () => fertig(text))
  })
  for (const nr of abzuloesen(JSON.parse(eingabe), process.argv[3], process.argv[4])) console.log(nr)
}
