/**
 * Das Urteil prüfen und als Eintrag oben in `00-wache-auswertung.md` setzen. Reine Funktionen (Test: `wache-urteil.test.mjs`).
 * Das Modell schreibt nur Lage und vier Absätze; Überschrift, Datum und Platz bestimmt dieses Werkzeug.
 */

const KOEPFE = ['**Was läuft korrekt.**', '**Wo ist Verbesserungspotenzial?**', '**Wo sind echte Risiken und Lücken?**', '**Was läuft komplett falsch?**']
const MIN_ABSATZ = 40
const MAX_GESAMT = 5000

/** Verboten: Adressen jeder Schreibweise, Verweise, Markup, Überschriften (Erwähnungen siehe `hatErwaehnung`). */
const VERBOTEN = /https?:|www\.|\]\(|<[a-z!/]|^#{1,6} /m

/** Echte @-Erwähnung: `@` nach Leerzeichen oder Zeilenanfang vor einem GitHub-Namen; Code in Backticks und `@scope/paket` zählen nicht. */
const hatErwaehnung = (text) => /(^|\s)@[A-Za-z0-9][\w-]*(?![\w/-])/m.test(text.replace(/`[^`\n]*`/g, ''))

/** Ergebnis `{ ok: true, lage, absaetze }` oder `{ ok: false, fehler }`. Das Dossier ist fremde Eingabe, deshalb darf das Urteil nichts Aktives oder Verlinkendes enthalten. */
export function pruefeUrteil(text) {
  const kopf = /^Lage: (ruhig|befund)\s*\n/.exec(text)
  if (!kopf) return { ok: false, fehler: 'erste Zeile ist nicht „Lage: ruhig“ oder „Lage: befund“' }
  const rest = text.slice(kopf[0].length).trim()
  if (rest.length > MAX_GESAMT) return { ok: false, fehler: `länger als ${MAX_GESAMT} Zeichen` }
  if (VERBOTEN.test(rest) || hatErwaehnung(rest)) return { ok: false, fehler: 'enthält Adresse, Verweis, Erwähnung, Markup oder Überschrift' }
  const absaetze = rest.split(/\n{2,}/).map((a) => a.trim())
  if (absaetze.length !== KOEPFE.length) return { ok: false, fehler: `${absaetze.length} Absätze statt ${KOEPFE.length}` }
  for (const [i, kopfzeile] of KOEPFE.entries()) {
    if (!absaetze[i].startsWith(kopfzeile)) return { ok: false, fehler: `Absatz ${i + 1} beginnt nicht mit ${kopfzeile}` }
    if (absaetze[i].length < kopfzeile.length + MIN_ABSATZ) return { ok: false, fehler: `Absatz ${i + 1} ist leer` }
  }
  return { ok: true, lage: kopf[1], absaetze }
}

/** Datum und Uhrzeit in Berlin, wie die bisherigen Überschriften („08.10.2026, 07:20"). */
export function berlinZeit(jetzt) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(jetzt)
      .map((t) => [t.type, t.value]),
  )
  return `${teile.day}.${teile.month}.${teile.year}, ${teile.hour}:${teile.minute}`
}

/** Setzt den Eintrag vor den ersten `## `-Abschnitt (neu oben, ältere bleiben stehen). */
export function setzeEin(datei, urteil, jetzt) {
  const eintrag = `## ${berlinZeit(jetzt)} — Claude-Lauf, Befund\n\n${urteil.absaetze.join('\n\n')}\n\n\n`
  const stelle = datei.search(/^## /m)
  if (stelle < 0) throw new Error('00-wache-auswertung.md hat keinen Abschnitt – Aufbau geändert')
  return datei.slice(0, stelle) + eintrag + datei.slice(stelle)
}
