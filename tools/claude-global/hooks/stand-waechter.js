// Wächter für „## Top-Prios“, „## In Arbeit“ und „## Als Nächstes“ in stand.md (gehört zu stand-prs.js): zu viele Handzeilen, Kopfzeile ohne frischen Stand, zu viele, zu lange oder icon-lose Zeilen, Erledigtes und Veraltetes im Top-Prio-Kasten.
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

const MAX_PRIOS = 5
const MAX_PRIO_ALTER = 72 * STUNDE
const PRIO_STAND = /Stand (\d\d)\.(\d\d)\.(?:(\d{4}))?(?: (\d\d):(\d\d))?/

/** Meldungen zu „## Top-Prios“: wenige Großziele, nichts Live-Erledigtes, kein Stand älter als 3 Tage (Daniel 27.10.2026: Kasten stand tagelang unverändert). */
function topPrios(zeilen, jetzt) {
  const kopf = zeilen.findIndex((z) => z.startsWith('## Top-Prios'))
  if (kopf < 0) return []
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('## '))
  if (ende < 0) ende = zeilen.length
  const liste = zeilen.slice(kopf + 1, ende).filter((z) => z.startsWith('- '))
  const meldungen = []
  if (liste.length > MAX_PRIOS) meldungen.push(`Top-Prios: ${liste.length} Zeilen (erlaubt ${MAX_PRIOS}) — Aufträge gehören nach „In Arbeit“ oder „Als Nächstes“`)
  const live = liste.filter((z) => z.includes('{live}'))
  if (live.length) meldungen.push(`Top-Prios: ${aufzaehlung(live)} live — erledigt, aus dem Kasten nehmen`)
  const alt = liste.filter((z) => {
    const t = prioStand(z, jetzt)
    return t !== null && jetzt - t > MAX_PRIO_ALTER
  })
  if (alt.length) meldungen.push(`Top-Prios: ${aufzaehlung(alt)} mit Stand älter als 3 Tage — erneuern oder aus dem Kasten nehmen`)
  return meldungen
}

/** Epoche des „Stand TT.MM.[JJJJ] [HH:MM]“ einer Zeile oder null; ohne Jahr das jüngste Jahr, das nicht in der Zukunft liegt. */
function prioStand(z, jetzt) {
  const s = PRIO_STAND.exec(z)
  if (!s) return null
  const zeit = (j) => berlinEpoche(j, Number(s[2]), Number(s[1]), Number(s[4] ?? 0), Number(s[5] ?? 0))
  if (s[3]) return zeit(Number(s[3]))
  const jahr = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(jetzt))
  return zeit(jahr) > jetzt ? zeit(jahr - 1) : zeit(jahr)
}

/** „N Zeile(n) (Titel, Titel, Titel u. a.)“: höchstens drei Anfänge, damit die Meldung kurz bleibt. */
function aufzaehlung(zeilen) {
  const titel = zeilen.slice(0, 3).map(anfang).join(', ')
  return `${zeilen.length} ${zeilen.length === 1 ? 'Zeile' : 'Zeilen'} (${titel}${zeilen.length > 3 ? ' u. a.' : ''})`
}

const KENNUNG = /\b[FE]\d+\b/
const GRUND = /\b(?:kann|darf|soll) nicht\b/

/** Meldungen zu „### Jetzt“: jede Handlungs-/Fragezeile trägt F<n>/E<n> und einen Grund mit Verb (Daniel 20.10.2026); 📅-Terminzeilen und Unterzeilen zählen nicht. */
function jetztZeilen(zeilen) {
  const kopf = zeilen.findIndex((z) => z.startsWith('### Jetzt'))
  if (kopf < 0) return []
  let ende = zeilen.findIndex((z, i) => i > kopf && z.startsWith('#'))
  if (ende < 0) ende = zeilen.length
  const liste = zeilen.slice(kopf + 1, ende).filter((z) => z.startsWith('- ') && !z.startsWith('- 📅'))
  const meldungen = []
  const ohneKennung = liste.filter((z) => !KENNUNG.test(z))
  if (ohneKennung.length) meldungen.push(`Jetzt: ${aufzaehlung(ohneKennung)} ohne Kennung F<n>/E<n>`)
  const ohneGrund = liste.filter((z) => !GRUND.test(z))
  if (ohneGrund.length) meldungen.push(`Jetzt: ${aufzaehlung(ohneGrund)} ohne Grund „kann/darf/soll nicht“`)
  return meldungen
}

/** Meldungstext oder '' (alles in Ordnung). */
function waechter(text, jetzt) {
  const zeilen = text.split(/\r?\n/)
  const meldungen = [...topPrios(zeilen, jetzt), ...jetztZeilen(zeilen), ...naechstes(zeilen)]
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

module.exports = { MAX_ZEILEN, MAX_ALTER, MAX_PRIOS, waechter }
