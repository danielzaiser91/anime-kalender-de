// Wächter für „## In Arbeit“ und „## Als Nächstes“ in stand.md (gehört zu stand-prs.js): zu viele Handzeilen, Kopfzeile ohne frischen Stand, zu viele, zu lange oder icon-lose Zeilen.
// Der Auto-Block (Marken AUF/ZU) zählt nicht, er pflegt sich selbst.
const MAX_ZEILEN = 20
const MAX_NAECHSTES = 80
const MAX_ZEICHEN = 400
const ICON = /^- (?:🔴|🟠|🔵|📅|⏳|🚫)/u
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

/** Fett-Titel der Zeile, sonst ihre ersten 50 Zeichen. */
function anfang(z) {
  const t = /\*\*(.+?)\*\*/.exec(z)
  return t ? t[1] : z.slice(0, 50)
}

/** Meldungen zu „## Als Nächstes“ (leer ohne den Abschnitt): Zeilenzahl, Länge, fehlendes Dringlichkeits-Icon. */
function naechstes(zeilen) {
  const kopf = zeilen.findIndex((z) => z.startsWith('## Als Nächstes'))
  if (kopf < 0) return []
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  const liste = zeilen.slice(kopf + 1, ende).filter((z) => z.startsWith('- '))
  const meldungen = []
  if (liste.length > MAX_NAECHSTES) {
    meldungen.push(`Als Nächstes: ${liste.length} Zeilen (erlaubt ${MAX_NAECHSTES}) — Sammelzeilen je Thema bilden, Erledigtes streichen`)
  }
  const lang = liste.filter((z) => z.length > MAX_ZEICHEN)
  if (lang.length) meldungen.push(`Als Nächstes: ${aufzaehlung(lang)} länger als ${MAX_ZEICHEN} Zeichen — kürzen`)
  const ohne = liste.filter((z) => !ICON.test(z))
  if (ohne.length) meldungen.push(`Als Nächstes: ${aufzaehlung(ohne)} ohne Dringlichkeits-Icon`)
  return meldungen
}

/** „N Zeile(n) (Titel, Titel, Titel u. a.)“: höchstens drei Anfänge, damit die Meldung kurz bleibt. */
function aufzaehlung(zeilen) {
  const titel = zeilen.slice(0, 3).map(anfang).join(', ')
  return `${zeilen.length} ${zeilen.length === 1 ? 'Zeile' : 'Zeilen'} (${titel}${zeilen.length > 3 ? ' u. a.' : ''})`
}

/** Meldungstext oder '' (alles in Ordnung). */
function waechter(text, jetzt) {
  const zeilen = text.split(/\r?\n/)
  const meldungen = naechstes(zeilen)
  const kopf = zeilen.findIndex((z) => z.startsWith('## In Arbeit'))
  if (kopf < 0) return meldungen.join('; ')
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  let imBlock = false
  let handzeilen = 0
  for (const z of zeilen.slice(kopf + 1, ende)) {
    if (z.includes('<!-- pr-zeilen')) imBlock = true
    else if (z.includes('<!-- /pr-zeilen')) imBlock = false
    else if (!imBlock && z.startsWith('- ')) handzeilen++
  }
  if (handzeilen > MAX_ZEILEN) meldungen.push(`${handzeilen} Handzeilen (erlaubt ${MAX_ZEILEN}) — aufräumen`)
  const s = STAND.exec(zeilen[kopf])
  if (!s) meldungen.push('Kopfzeile ohne „Stand TT.MM.JJJJ HH:MM“')
  else if (jetzt - berlinEpoche(Number(s[3]), Number(s[2]), Number(s[1]), Number(s[4]), Number(s[5])) > MAX_ALTER) {
    meldungen.push(`Kopfzeile von ${s[1]}.${s[2]}. ${s[4]}:${s[5]} ist älter als 24 h — Stand erneuern`)
  }
  return meldungen.join('; ')
}

module.exports = { MAX_ZEILEN, MAX_ALTER, waechter }
