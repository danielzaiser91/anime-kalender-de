/*
  **Netflix-Durchgang: übersprungene Titel bleiben zurückgestellt** (4.31.2, 15.10.2026)

  Daniel am 15.10.2026: Yu-Gi-Oh! und Pokémon Sonne & Mond kamen bei jedem „▶ alle durchgehen“ wieder,
  weil `selbstUebersprungen` in `melder.js` nur im Arbeitsspeicher lag und jeder Start es leerte.
  Jetzt ist es eine `Map`, deren Einträge zusätzlich mit Ablauf in `chrome.storage.local` liegen
  (`netflixZurueckgestellt`: `{ Kennung: { grund, bis } }`, je Browser-Profil). `has()` kennt die gespeicherten
  Einträge, darum überspringt `naechsterAuftrag()` sie ohne eigene Zeile. `clear()` (Start eines Durchgangs)
  leert nur den Arbeitsspeicher, nie den Speicher. Lädt laut Manifest vor `melder.js`.

  Ablauf: „Erinnern" mit erkanntem Datum → bis zu diesem Tag (Europe/Berlin, Netflix nennt kein Jahr: nächstes
  Vorkommen); „Erinnern" ohne Datum → 7 Tage; alles andere (keine Folgenliste, nach N Versuchen offen) → 1 Tag.
  Ein Titel, der nach dem Worker-Stand fertig ist, fliegt raus (`istFertig`), ebenso ein Eintrag mit dem Grund
  „fertig" und jeder abgelaufene. Kein Worker, keine D1.
*/
const ZURUECK_SCHLUESSEL = 'netflixZurueckgestellt'
const ZURUECK_TAG_MS = 24 * 3600 * 1000
const ZURUECK_MONATE = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez']

/** Kalendertag in Berlin zu einem Zeitpunkt: `{ j, m, t }`. */
function zurueckBerlinTag(ms) {
  const teile = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(ms))
    .reduce((a, p) => ({ ...a, [p.type]: Number(p.value) }), {})
  return { j: teile.year, m: teile.month, t: teile.day }
}

const zurueckGleich = (a, b) => a.j === b.j && a.m === b.m && a.t === b.t

/** Beginn eines Berlin-Tages in ms (Sommer UTC+2, Winter UTC+1). */
function zurueckTagAnfang(j, m, t) {
  const ziel = { j, m, t }
  const utc = Date.UTC(j, m - 1, t)
  for (const stunden of [2, 1]) {
    const kandidat = utc - stunden * 3600 * 1000
    if (zurueckGleich(zurueckBerlinTag(kandidat), ziel) && !zurueckGleich(zurueckBerlinTag(kandidat - 1), ziel)) return kandidat
  }
  return utc
}

/** „29. September" / „3. Okt. 2026" → Beginn dieses Tages in Berlin (ohne Jahr: das nächste Vorkommen); sonst `null`. */
function zurueckDatumBis(text, jetzt) {
  const treffer = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?(?:\s+(\d{4}))?/.exec(String(text ?? ''))
  if (!treffer) return null
  const t = Number(treffer[1])
  const m = ZURUECK_MONATE.indexOf(treffer[2].toLowerCase().slice(0, 3).replace('mar', 'mär')) + 1
  if (!m || t < 1 || t > 31) return null
  const heute = zurueckBerlinTag(jetzt)
  const vorbei = m < heute.m || (m === heute.m && t < heute.t)
  const j = treffer[3] ? Number(treffer[3]) : heute.j + (vorbei ? 1 : 0)
  return zurueckTagAnfang(j, m, t)
}

/** Bis wann ein Titel zurückgestellt bleibt (ms), je nach Grund. */
function zurueckBis(grund, datum, jetzt) {
  if (!/^Erinnern/.test(grund)) return jetzt + ZURUECK_TAG_MS
  return zurueckDatumBis(datum, jetzt) ?? jetzt + 7 * ZURUECK_TAG_MS
}

/**
 * Die Merkliste des Durchgangs (`Map` Kennung → Grund) samt dauerhafter Zurückstellung.
 * `istFertig(kennung)`: `true`, wenn der Titel nach dem Worker-Stand nicht mehr offen ist.
 * `umgebung` (nur Tests): `{ speicher, jetzt, datum }`.
 */
globalThis.akNetflixZurueckNeu = (istFertig, umgebung = {}) => {
  const speicher = umgebung.speicher ?? chrome.storage.local
  const jetzt = umgebung.jetzt ?? Date.now
  const datum = umgebung.datum ?? (() => globalThis.erscheinungsdatum?.())
  let stand = {}
  let bereit = Promise.resolve()

  /** Änderungen laufen nacheinander, erst nach dem Laden, und schreiben den ganzen Stand. */
  const aendern = (fn) => {
    bereit = bereit
      .then(() => {
        fn(stand)
        return speicher.set({ [ZURUECK_SCHLUESSEL]: stand })
      })
      .catch(() => {})
  }
  const entfernen = (kennung) => aendern((s) => delete s[kennung])

  const aktiv = (kennung) => {
    const e = stand[kennung]
    if (!e) return false
    if (e.bis <= jetzt() || istFertig(kennung)) {
      entfernen(kennung)
      return false
    }
    return true
  }

  bereit = Promise.resolve(speicher.get(ZURUECK_SCHLUESSEL))
    .then((x) => {
      stand = x?.[ZURUECK_SCHLUESSEL] ?? {}
      Object.keys(stand).forEach(aktiv) /* Abgelaufenes fliegt gleich beim Laden raus. */
    })
    .catch(() => {})

  class Zurueckgestellt extends Map {
    has(kennung) {
      return super.has(kennung) || aktiv(String(kennung))
    }

    set(kennung, grund) {
      const k = String(kennung)
      if (grund === 'fertig') entfernen(k)
      else {
        const bis = zurueckBis(grund, /^Erinnern/.test(grund) ? datum() : null, jetzt())
        aendern((s) => (s[k] = { grund, bis }))
      }
      return super.set(kennung, grund)
    }

    /** Wie viele Titel noch zurückgestellt sind, als Anhang der Endanzeige (leer bei 0). */
    zurueckText() {
      const n = Object.keys(stand).filter(aktiv).length
      return n ? ` · ${n} zurückgestellt` : ''
    }
  }
  return new Zurueckgestellt()
}

globalThis.akZurueckBis = zurueckBis
