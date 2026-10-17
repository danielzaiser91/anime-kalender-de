/**
 * Rote Sammler-PRs (17.10.2026): Ein Fund, der `check:logic` bricht, wird als PR mit der Marke „[Prüfung rot]“ eingereicht und nie gemergt (`tools/quellen-pr.sh`).
 * Der Lauf endet dabei grün, deshalb braucht es zwei Dinge, damit der Fund nicht still liegt:
 *  - Sichtbarkeit: `meldeRoteSammlerPrs` listet die offenen Marken-PRs mit Alter; `tools/laeufe-aufraeumen.mjs` ruft es an jeder Wachphase auf.
 *  - Grenze: Ein neuer roter PR desselben Workflows löst die älteren ab (`nummern`); es liegt je Quelle höchstens einer.
 *
 * Aufruf: `gh pr list --state open --limit 100 --json number,title,body,createdAt | node tools/rote-sammler-prs.mjs nummern "<Workflow>" "<neue Nummer>"`
 * gibt die Nummern der abzulösenden PRs aus, eine je Zeile.
 */
import { execSync } from 'node:child_process'

export const MARKE = '[Prüfung rot]'
const STUNDE = 3600_000

/** Offene PRs mit der Marke im Titel; mit `workflow` nur die dieses Workflows (der Text nennt ihn als `**Name**`). */
export function rotePrs(liste, workflow) {
  return liste.filter((pr) => pr.title.startsWith(MARKE) && (workflow === undefined || String(pr.body ?? '').includes(`**${workflow}**`)))
}

/** Nummern, die ein neuer roter PR (`neu`) von `workflow` ablöst: alle anderen roten PRs desselben Workflows. */
export function abzuloesen(liste, workflow, neu) {
  return rotePrs(liste, workflow).filter((pr) => String(pr.number) !== String(neu)).map((pr) => pr.number)
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
