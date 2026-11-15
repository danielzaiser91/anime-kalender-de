/**
 * Geometrie und Beschriftungs-Staffelung der Ansicht. Eine Quelle für Browser (window.KennzahlenLogik, per Script-Tag)
 * und Node (require, für Erzeuger und Test); .cjs, weil das Paket "type: module" ist.
 */
(function (wurzel) {
  var BREITE = 960, LINKS = 40, RECHTS = 12

  /** x-Position eines Tags; bei einem einzigen Tag links (keine Division durch 0). */
  function tagPosition(i, n) {
    if (n < 2) return LINKS
    return LINKS + (i * (BREITE - LINKS - RECHTS)) / (n - 1)
  }

  /** Tagesindex zur Zeigerposition px (in Grafikeinheiten), begrenzt auf 0 bis n-1. */
  function naechsterTag(px, n) {
    if (n < 2) return 0
    var i = Math.round(((px - LINKS) * (n - 1)) / (BREITE - LINKS - RECHTS))
    return Math.max(0, Math.min(n - 1, i))
  }

  /** Zeile (0..zeilen-1) je Beschriftung, damit Beschriftungen der Breite `breite` nebeneinander nicht überlappen. */
  function staffelZeilen(positionen, breite, zeilen) {
    var ende = []
    for (var z = 0; z < zeilen; z++) ende.push(-Infinity)
    var ordnung = positionen.map(function (p, i) { return i }).sort(function (a, b) { return positionen[a] - positionen[b] || a - b })
    var ergebnis = new Array(positionen.length)
    ordnung.forEach(function (i) {
      var gewaehlt = -1
      for (var z = 0; z < zeilen && gewaehlt < 0; z++) if (positionen[i] - ende[z] >= breite) gewaehlt = z
      if (gewaehlt < 0) gewaehlt = ende.indexOf(Math.min.apply(null, ende))
      ende[gewaehlt] = positionen[i]
      ergebnis[i] = gewaehlt
    })
    return ergebnis
  }

  wurzel.BREITE = BREITE
  wurzel.LINKS = LINKS
  wurzel.RECHTS = RECHTS
  wurzel.tagPosition = tagPosition
  wurzel.naechsterTag = naechsterTag
  wurzel.staffelZeilen = staffelZeilen
})(typeof module !== 'undefined' ? module.exports : (window.KennzahlenLogik = {}))
