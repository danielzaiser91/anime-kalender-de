// Wächter für „## In Arbeit“ in stand.md (gehört zu stand-prs.js): zu viele Handzeilen oder eine Kopfzeile ohne frischen Stand.
// Der Auto-Block (Marken AUF/ZU) zählt nicht, er pflegt sich selbst.
const MAX_ZEILEN = 20
const STUNDE = 3600000
const MAX_ALTER = 24 * STUNDE
const STAND = /Stand (\d\d)\.(\d\d)\.(\d{4}) (\d\d):(\d\d)/

/** Berliner Wandzeit als Epoche (ms): UTC-Schätzung minus Berliner Versatz (ganze Stunden östlich von UTC). */
function berlinEpoche(j, m, t, h, min) {
  const schaetzung = Date.UTC(j, m - 1, t, h, min)
  const teil = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' })
    .formatToParts(new Date(schaetzung))
    .find((p) => p.type === 'timeZoneName').value
  return schaetzung - Number(/GMT\+(\d\d)/.exec(teil)[1]) * STUNDE
}

/** Meldungstext oder '' (alles in Ordnung / kein Abschnitt „## In Arbeit“). */
function waechter(text, jetzt) {
  const zeilen = text.split(/\r?\n/)
  const kopf = zeilen.findIndex((z) => z.startsWith('## In Arbeit'))
  if (kopf < 0) return ''
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  let imBlock = false
  let handzeilen = 0
  for (const z of zeilen.slice(kopf + 1, ende)) {
    if (z.includes('<!-- pr-zeilen')) imBlock = true
    else if (z.includes('<!-- /pr-zeilen')) imBlock = false
    else if (!imBlock && z.startsWith('- ')) handzeilen++
  }
  const meldungen = []
  if (handzeilen > MAX_ZEILEN) meldungen.push(`${handzeilen} Handzeilen (erlaubt ${MAX_ZEILEN}) — aufräumen`)
  const s = STAND.exec(zeilen[kopf])
  if (!s) meldungen.push('Kopfzeile ohne „Stand TT.MM.JJJJ HH:MM“')
  else if (jetzt - berlinEpoche(Number(s[3]), Number(s[2]), Number(s[1]), Number(s[4]), Number(s[5])) > MAX_ALTER) {
    meldungen.push(`Kopfzeile von ${s[1]}.${s[2]}. ${s[4]}:${s[5]} ist älter als 24 h — Stand erneuern`)
  }
  return meldungen.join('; ')
}

module.exports = { MAX_ZEILEN, MAX_ALTER, waechter }
