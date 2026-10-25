// Schlusszeilen der Wache: was geprüft und ruhig war, was nicht prüfbar war. Ohne sie ist Stille nicht von „nicht gelaufen“ zu unterscheiden.

/** Präfix der Lesefehler-Zeile (`ALARM? …`) je Prüfung, in der Reihenfolge der Ausgabe. */
const LESEFEHLER = [
  ['Bestandsbau', 'ALARM? Läufe des Bestandsbaus nicht lesbar: '],
  ['Fehlerschritte', 'ALARM? Fehlerschritte des Bestandsbaus nicht lesbar: '],
  ['Deploy', 'ALARM? Läufe des Deploys nicht lesbar: '],
]
const QUELLEN = 'Quellen'

const grundVon = (zeile, praefix) => zeile.slice(praefix.length)

/** Name und Grund jeder nicht gelaufenen Prüfung aus den Zeilen von `rotAlarmText` und `eskalationsText`. */
function nichtGeprueft(rotZeilen, quellenZeilen) {
  const aus = []
  for (const [name, praefix] of LESEFEHLER) {
    const zeile = rotZeilen.find((z) => z.startsWith(praefix))
    if (zeile) aus.push([name, grundVon(zeile, praefix)])
  }
  const quelle = quellenZeilen.find((z) => z.startsWith('ALARM? '))
  if (quelle) aus.push([QUELLEN, grundVon(quelle, 'ALARM? ')])
  return aus
}

/**
 * Die `WACHE …`-Zeilen. `ruhig` nur ohne jede `ALARM `-Zeile (der Lesefehler `ALARM? ` ist kein Alarm, aber auch nie ruhig);
 * die Zahl zählt die Prüfungen, die wirklich liefen.
 */
export function wacheZeilen(rotZeilen, quellenZeilen) {
  const offen = nichtGeprueft(rotZeilen, quellenZeilen)
  const alarm = [...rotZeilen, ...quellenZeilen].some((z) => z.startsWith('ALARM '))
  const ausgefallen = new Set(offen.map(([name]) => name))
  const gelaufen = [...LESEFEHLER.map(([name]) => name), QUELLEN].filter((name) => !ausgefallen.has(name))
  const zeilen = offen.map(([name, grund]) => `WACHE nicht geprüft: ${name} (${grund})`)
  if (!alarm && gelaufen.length > 0) zeilen.push(`WACHE ruhig: ${gelaufen.length} Prüfungen ohne Alarm (${gelaufen.join(', ')})`)
  return zeilen
}
