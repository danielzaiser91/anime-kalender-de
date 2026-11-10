// Nachrechnen-Schleife: Grund-Kommentar von tools/pr-nachrechnen.mjs und Zählung der Durchgänge je PR (Signal 10 von liegegut).

/** Feste Kennung am Anfang des Kommentars; die Zählung erkennt Durchgänge genau daran. */
export const KENNUNG = '**Nachrechnen** NICHT AKTUELL:'

/** Ab so vielen Durchgängen meldet liegegut den PR (Messung 10.11.2026: ≈ 83 Durchgänge in 1,8 Tagen, Spitzen 5–11). */
export const SCHLEIFE_AB = 3

/** Kommentartext: eine Zeile mit Kennung, Kettenstand, main-Stand und dem Grund aus `datenpfadGrund`. */
export const grundKommentar = (basisKurz, mainKurz, grund) => `${KENNUNG} Kette gegen ${basisKurz}, main ist ${mainKurz}; ${grund}`

const istDurchgang = (c) => typeof c.body === 'string' && c.body.startsWith(KENNUNG)

/** Signal 10 für `pr.comments`: höchstens ein Eintrag, `seit` = Zeit des jüngsten Durchgangs. */
export function schleifeSignal(pr) {
  const durchgaenge = pr.comments.filter(istDurchgang)
  if (durchgaenge.length < SCHLEIFE_AB) return []
  const seit = Math.max(...durchgaenge.map((c) => Date.parse(c.createdAt)))
  return [{ nr: 10, text: `Nachrechnen ${durchgaenge.length}× NICHT AKTUELL (Grund in den Kommentaren)`, seit }]
}

/** Legt den Grund als PR-Kommentar ab; scheitert `gh`, steht die Ursache in der Meldung, der Durchgang gilt trotzdem (nie hart rot). */
export function kommentiereGrund(gh, melde, nummer, text) {
  try {
    gh(['pr', 'comment', String(nummer), '--body', text])
  } catch (e) {
    melde(`PR ${nummer}: Grund-Kommentar nicht geschrieben (${String(e.message).split('\n')[0]})`)
  }
}
