/*
  **Netflix-Durchgang: übersprungene Titel bleiben zurückgestellt** (4.31.3, 15.10.2026)

  Daniel am 15.10.2026: Yu-Gi-Oh! und Pokémon Sonne & Mond kamen bei jedem „▶ alle durchgehen“ wieder,
  weil `selbstUebersprungen` in `melder.js` nur im Arbeitsspeicher lag und jeder Start es leerte.
  Jetzt ist es eine `Map`, deren Einträge zusätzlich mit Ablauf in `chrome.storage.local` liegen
  (`netflixZurueckgestellt`: `{ Kennung: { grund, bis } }`, je Browser-Profil). `has()` kennt die gespeicherten
  Einträge, darum überspringt `naechsterAuftrag()` sie ohne eigene Zeile. `clear()` (Start eines Durchgangs)
  leert nur den Arbeitsspeicher, nie den Speicher. Lädt laut Manifest vor `melder.js`.

  Ablauf: „Erinnern" mit erkanntem Datum → bis zu diesem Tag (heute: nur 1 Stunde, danach wieder offen; Europe/Berlin; Netflix nennt kein Jahr, ein
  vergangenes Datum ohne Jahr gilt als unlesbar); „Erinnern" ohne (lesbares) Datum → 7 Tage; alles andere (keine
  Folgenliste, nach N Versuchen offen) → 1 Tag; nie mehr als 30 Tage (ein falsch gelesenes Datum sperrt keinen
  Titel für ein Jahr). Ein Titel, der nach dem Worker-Stand fertig ist, fliegt raus, ebenso ein Eintrag mit dem
  Grund „fertig" und jeder abgelaufene. Kein Worker, keine D1.
*/
const ZURUECK_SCHLUESSEL = 'netflixZurueckgestellt'
const LAUF_UEBERSPRUNGEN = 'ak-netflix-uebersprungen'
const ZURUECK_TAG_MS = 24 * 3600 * 1000
const ZURUECK_STUNDE_MS = 3600 * 1000
const ZURUECK_HOECHSTENS_TAGE = 30
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

/** „29. September" / „3. Okt. 2026" → Beginn dieses Tages in Berlin (ohne Jahr: nur ein Datum von heute an); sonst `null`. */
function zurueckDatumBis(text, jetzt) {
  const treffer = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?(?:\s+(\d{4}))?/.exec(String(text ?? ''))
  if (!treffer) return null
  const t = Number(treffer[1])
  const m = ZURUECK_MONATE.indexOf(treffer[2].toLowerCase().slice(0, 3).replace('mar', 'mär')) + 1
  if (!m || t < 1 || t > 31) return null
  const heute = zurueckBerlinTag(jetzt)
  const vorbei = m < heute.m || (m === heute.m && t < heute.t)
  if (vorbei && !treffer[3]) return null /* ohne Jahr ist ein vergangenes Datum unlesbar, kein nächstes Jahr */
  const j = treffer[3] ? Number(treffer[3]) : heute.j
  return zurueckTagAnfang(j, m, t)
}

/**
 * Bis wann ein Titel zurückgestellt bleibt (ms), je nach Grund; nie länger als `ZURUECK_HOECHSTENS_TAGE`.
 * Nennt „Erinnern" den heutigen Berliner Tag und steht weiter da, ist der Titel nur 1 Stunde zurückgestellt (F135, 14.11.2026).
 */
function zurueckBis(grund, datum, jetzt) {
  if (!/^Erinnern/.test(grund)) return jetzt + ZURUECK_TAG_MS
  const tag = zurueckDatumBis(datum, jetzt)
  if (zurueckGleich(zurueckBerlinTag(tag), zurueckBerlinTag(jetzt))) return jetzt + ZURUECK_STUNDE_MS
  return Math.min(tag ?? jetzt + 7 * ZURUECK_TAG_MS, jetzt + ZURUECK_HOECHSTENS_TAGE * ZURUECK_TAG_MS)
}

/** Kopfzeile der Prüfliste: offene Titel, dahinter die zurückgestellten (Zahl 0 bleibt leer). */
globalThis.akNetflixKopfText = (offen, zurueck) => `${offen ? `${offen} Titel zu prüfen` : 'Alles geprüft'}${zurueck ? ` · ${zurueck} zurückgestellt` : ''}`

/**
 * Fragen der Prüfliste an die Merkliste: Ist ein Titel zurückgestellt oder gemeldet (= nicht offen), wie viele sind es,
 * und `geladen()` (Speicher geladen, jede Änderung geschrieben). Zurückgestellte zählen nicht als offen (F135, 14.11.2026).
 */
function zurueckFragen(aktiv, gelistet, istFertig, kennungen, bereit, eintrag) {
  const zurueckgestellt = (kennung) => gelistet(String(kennung)) && aktiv(String(kennung))
  return {
    zurueckgestellt,
    /** Grund und Ablauf eines aktiven Eintrags für die Prüfliste, sonst `null`. */
    zurueckInfo: (kennung) => {
      const e = eintrag(String(kennung))
      if (!e || !zurueckgestellt(kennung)) return null
      return {
        grund: e.grund,
        bis: e.bis,
      }
    },
    nichtOffen: (kennung) => istFertig(String(kennung)) || zurueckgestellt(kennung),
    zurueckZahl: () => kennungen().filter(zurueckgestellt).length,
    geladen: () => bereit(),
  }
}

/**
 * Die Merkliste des Durchgangs (`Map` Kennung → Grund) samt dauerhafter Zurückstellung.
 * `titel`: die Prüfliste (Kennung → Eintrag); `fertig(kennung, eintrag)`: Worker-Stand, `true` = nicht mehr offen.
 * `umgebung` (nur Tests): `{ speicher, jetzt, datum }`; `geaendert()` (Melder): nach dem Laden und nach jedem Schreiben,
 * damit die Zähler der Prüfliste neu rechnen.
 */
globalThis.akNetflixZurueckNeu = (titel, fertig, umgebung = {}) => {
  const speicher = umgebung.speicher ?? globalThis.akKontext.lokal
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
      .then(() => umgebung.geaendert?.())
      .catch(() => {})
  }
  const entfernen = (kennung) => aendern((s) => delete s[kennung])

  const gelistet = (kennung) => titel[kennung] !== undefined
  const istFertig = (kennung) => gelistet(kennung) && fertig(kennung, titel[kennung])

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
    .then(() => umgebung.geaendert?.())
    .catch(() => {})

  /* Die Einträge dieses Laufs überstehen das volle Neuladen jedes Titels (`akNetflixLaufMap`). */
  class Zurueckgestellt extends globalThis.akNetflixLaufMap(umgebung.sitzung ?? globalThis.akNetflixSitzungSpeicher?.(), LAUF_UEBERSPRUNGEN) {
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

    /** Zurückgestellte, noch offene Titel der Prüfliste; `neue`: nur die, die dieser Lauf nicht schon selbst nennt. */
    zurueckOffen(neue) {
      return Object.keys(stand).filter((k) => aktiv(k) && gelistet(k) && !(neue && super.has(k)))
    }

    /** Anhang der Endanzeige: wie viele offene Titel zurückgestellt sind (leer bei 0). */
    zurueckText() {
      const n = this.zurueckOffen(true).length
      return n ? ` · ${n} zurückgestellt` : ''
    }

    /** Beschriftung des Knopfes, wenn der Durchgang keinen Auftrag findet: Zurückstellung oder wirklich nichts offen. */
    keinAuftrag() {
      if (this.zurueckZahl()) {
        return { text: `nichts offen · ${this.zurueckZahl()} zurückgestellt`, title: 'Zurückgestellte Titel kommen zu ihrem Termin wieder dran (ein Tag bis ein Monat, am Erinnern-Tag stündlich).' }
      }
      return { text: 'nichts offen — Seite neu laden', title: 'Die Liste hält gerade keinen offenen Auftrag. Nach einem Neuladen der Seite ist der Prüfstand frisch.' }
    }
  }
  return Object.assign(new Zurueckgestellt(), zurueckFragen(aktiv, gelistet, istFertig, () => Object.keys(stand), () => bereit, (k) => stand[k]))
}

/** „bis 14:30" am selben Berliner Tag, sonst „bis 20.11." (Europe/Berlin). */
function zurueckBisText(bis, jetzt) {
  if (!Number.isFinite(new Date(bis).getTime())) return 'bis auf Weiteres' /* unlesbarer Speicherwert statt Absturz der Liste */
  const zeit = (opt) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...opt }).format(new Date(bis))
  if (zurueckGleich(zurueckBerlinTag(bis), zurueckBerlinTag(jetzt))) return `bis ${zeit({ hour: '2-digit', minute: '2-digit' })}`
  return `bis ${zeit({ day: 'numeric', month: 'numeric' })}` /* de-DE liefert „20.11.“ samt Punkt */
}

/**
 * Prüfliste, zurückgestellte Zeilen (F135, 15.11.2026): ohne Filter weg, mit Filter in Bernstein samt „bis"-Datum.
 * Markiert die Zeile (`ak-zurueck`) und setzt Marke und Tooltip; ohne `info` bleibt sie unberührt.
 */
function zurueckZeileMarkieren(zeile, info, jetzt) {
  if (!info) return
  const text = zurueckBisText(info.bis, jetzt)
  zeile.classList.add('ak-zurueck')
  zeile.title = `Zurückgestellt ${text} — ${info.grund}`
  const marke = document.createElement('span')
  marke.className = 'ak-zurueck-marke'
  marke.textContent = `zurückgestellt ${text}`
  zeile.insertBefore(marke, zeile.children[1] ?? null)
}

/** Der Filterknopf der Prüfliste: blendet die zurückgestellten Zeilen ein und aus (`ak-mit-zurueck` am Kasten); `klick` = `akKlick`. */
function zurueckFilterKnopf(kasten, zahl, klick) {
  const knopf = document.createElement('button')
  knopf.className = 'ak-umschalter'
  const beschriften = () => (knopf.textContent = `${zahl} zurückgestellt ${kasten.classList.contains('ak-mit-zurueck') ? 'ausblenden' : 'zeigen'}`)
  beschriften()
  knopf.title = 'Zurückgestellte Titel kommen zu ihrem Termin wieder dran. Hier siehst du sie samt Grund.'
  klick(knopf, () => {
    kasten.classList.toggle('ak-mit-zurueck')
    beschriften()
  })
  return knopf
}

globalThis.akNetflixZurueckListe = { markieren: zurueckZeileMarkieren, filterKnopf: zurueckFilterKnopf }
globalThis.akZurueckBis = zurueckBis
