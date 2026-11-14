/*
  **Netflix-Durchgang: Anzeige, Auftragswahl, Bremse und Tab-Besitz, die `melder.js` nicht vergrößern** —
  eigene Datei, weil `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.
*/

/**
 * Zeichnet (oder entfernt) die Zeile „Durchgang fertig / abgebrochen" im Kasten.
 * `zeile()`: liefert `.ak-z-melden` oder `null`; `ende`: `durchgangEnde` oder `null`; `zurueck`: Text der zurückgestellten Titel.
 */
globalThis.akNetflixEndeZeigen = (zeileHolen, ende, zurueck) => {
  try {
    const zeile = zeileHolen()
    if (!zeile) return
    let el = zeile.querySelector('.ak-durchgang-ende')
    if (!ende) return el?.remove()
    if (!el) {
      el = document.createElement('div')
      el.className = 'ak-hinweis ak-durchgang-ende'
      zeile.appendChild(el)
    }
    el.classList.toggle('ak-durchgang-rot', Boolean(ende.rot))
    el.textContent =
      (ende.grund === 'kein offener Auftrag mehr' ? 'Durchgang fertig' : `Durchgang abgebrochen · ${ende.grund}`) +
      ende.uebersprungenText +
      (zurueck + ende.text)
    el.title = ende.grund
  } catch {
    /* Eine Anzeige darf den Takt nicht aufhalten. */
  }
}

/**
 * Der Auftrag, den ein Klick aus der Liste auf `/browse` hinterlassen hat (nie ein Sprung des Durchgangs — der meldet selbst oder gar nicht, #2751; höchstens eine Minute alt,
 * noch nicht gemeldet, auf der Prüfliste), sonst `null`. `z`: `zuletztGeoeffnet`; `offen`: `offeneTitel`.
 */
globalThis.akNetflixBrowseAuftrag = (z, offen, jetzt) => {
  try {
    return z?.id && !z.durchgang && !z.verbraucht && offen[z.id] !== undefined && jetzt - (z.zeit ?? 0) < 60 * 1000 ? z : null
  } catch {
    return null
  }
}

/*
  **Bremse: Netflix liefert kein Titelfenster — das ist die Sitzung, nicht der Titel** (12.11.2026).

  Daniel, Bericht 12.11. (4.32.107): ab 11:57 sprang der Durchgang alle ~21 s weiter, jede Seite zeigte
  „Startseite – Netflix" mit abgedunkeltem Hintergrund (`previewModal--backDrop`) und ohne Inhalt, dazu
  `/watch` mit UI3012. Titel, die sehr wahrscheinlich bei Netflix laufen, standen als „übersprungen" in
  der Endliste, und der Lauf verbrauchte die ganze Liste. Ob Netflix die Sitzung bremst, ist am Bericht
  nicht bewiesen (Hypothese); sicher ist: ein einzelner Fehlschlag sagt nichts über den Titel, viele in
  Folge sagen etwas über die Sitzung.

  Regel: ab `BREMSE_SCHWELLE` Fehlschlägen in Folge pausiert der Durchgang (10/20/40/60 Minuten, je Pause
  länger) und bucht diese Titel **nicht** als übersprungen. Ein Erfolg davor bucht die Einzelfälle wie
  bisher (dann lag es am Titel). Der Stand liegt im `sessionStorage` und übersteht ein Neuladen.
*/
const BREMSE_SCHWELLE = 3
const BREMSE_PAUSEN_MS = [10, 20, 40, 60].map((m) => m * 60 * 1000)
const BREMSE_SCHLUESSEL = 'ak-netflix-bremse'

/** `seitenmerkmale()` einer Titelseite: Tab-Titel „Startseite", keine Folgen, kein Dialog = das Titelfenster fehlt. */
globalThis.akNetflixTitelfensterLeer = (m) =>
  Boolean(
    m &&
      !m.fehler &&
      /^\/(?:[a-z-]+\/)?title\//.test(m.pfad ?? '') &&
      /^(?:Startseite|Home)\b/i.test(m.titel ?? '') &&
      !m.folgenElemente &&
      !m.dialoge?.anzahl,
  )

globalThis.akNetflixBremseNeu = () => ({ folge: 0, pausen: 0, bis: null, titel: {} })

/** Ein Fehlschlag mehr; ab der Schwelle beginnt eine Pause. Rein: gibt den neuen Stand zurück. */
globalThis.akNetflixBremseStoerung = (z, reihe, grund, jetzt) => {
  const folge = z.folge + 1
  const titel = { ...z.titel, [reihe]: grund }
  if (folge < BREMSE_SCHWELLE) return { ...z, folge, titel }
  const pausen = z.pausen + 1
  return { folge: 0, pausen, bis: jetzt + BREMSE_PAUSEN_MS[Math.min(pausen, BREMSE_PAUSEN_MS.length) - 1], titel }
}

/** Ein Titelfenster kam: Einzelfälle lagen am Titel (`gebucht`), die Bremse ist wieder frei. */
globalThis.akNetflixBremseOk = (z) => ({ z: akNetflixBremseNeu(), gebucht: Object.entries(z.titel) })

/** Ist die Pause um? Dann `{ z, frei }` (frei = Titel, die wieder drankommen), sonst `null`. */
globalThis.akNetflixBremseEnde = (z, jetzt) =>
  z.bis && jetzt >= z.bis ? { z: { ...z, bis: null, titel: {} }, frei: Object.keys(z.titel).length } : null

const sitzungSpeicher = () => {
  try {
    return sessionStorage
  } catch {
    return null
  }
}

const bremseLaden = (speicher) => {
  try {
    const z = JSON.parse(speicher?.getItem(BREMSE_SCHLUESSEL) ?? 'null')
    const gut = z && Number.isFinite(z.folge) && Number.isFinite(z.pausen) && z.titel && typeof z.titel === 'object'
    return gut ? { folge: z.folge, pausen: z.pausen, bis: Number.isFinite(z.bis) ? z.bis : null, titel: z.titel } : akNetflixBremseNeu()
  } catch {
    return akNetflixBremseNeu()
  }
}

/**
 * Die Bremse eines Laufs. `uebersprungen`: Map Kennung → Grund (`selbstUebersprungen`); `speicher`: Vorgabe `sessionStorage`
 * (oder `null`); `beobachter(reihe, grund, stand)`: für den Bericht.
 */
globalThis.akNetflixBremseOeffnen = (uebersprungen, beobachter, speicher = sitzungSpeicher()) => {
  let z = bremseLaden(speicher)
  const sichern = () => {
    try {
      speicher?.setItem(BREMSE_SCHLUESSEL, JSON.stringify(z))
    } catch {
      /* Ohne Speicher gilt der Stand bis zum Neuladen. */
    }
  }
  return {
    /** Gibt `true` zurück, wenn dieser Fehlschlag eine Pause ausgelöst hat. */
    stoerung(reihe, grund, jetzt) {
      z = akNetflixBremseStoerung(z, String(reihe), grund, jetzt)
      sichern()
      beobachter?.(String(reihe), grund, z)
      return Boolean(z.bis)
    },
    ok() {
      if (!z.folge && !z.pausen && !z.bis && !Object.keys(z.titel).length) return
      const r = akNetflixBremseOk(z)
      z = r.z
      sichern()
      for (const [reihe, grund] of r.gebucht) uebersprungen.set(reihe, grund)
    },
    pause: (jetzt) => (z.bis && jetzt < z.bis ? z.bis : null),
    ausgeschlossen: (reihe) => String(reihe) in z.titel,
    offen: () => Object.keys(z.titel).length,
    /** Pause gerade zu Ende: Zahl der freigegebenen Titel, sonst `null`. */
    ende(jetzt) {
      const r = akNetflixBremseEnde(z, jetzt)
      if (!r) return null
      z = r.z
      sichern()
      return r.frei
    },
    text(jetzt) {
      if (!this.pause(jetzt)) return null
      const uhr = new Date(z.bis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
      return `Netflix bremst — Pause bis ${uhr} Uhr, ${Object.keys(z.titel).length} Titel kommen danach wieder dran`
    },
    zuruecksetzen() {
      z = akNetflixBremseNeu()
      sichern()
    },
    bericht: () => ({ folge: z.folge, pausen: z.pausen, bis: z.bis, titel: { ...z.titel } }),
  }
}

/** Ein Takt der Pause. `tun`: `{ zeigen(text|null), weiter(frei) }`. `true` = der Durchgang ruht in diesem Takt. */
globalThis.akNetflixBremseTakt = (bremse, jetzt, tun) => {
  const frei = bremse.ende(jetzt)
  if (frei !== null) {
    tun.zeigen(null)
    tun.weiter(frei)
    return true
  }
  const text = bremse.text(jetzt)
  if (!text) return false
  tun.zeigen(text)
  tun.raeumen?.()
  return true
}

/**
 * Voll laden statt pushState: bleibt das Titelfenster leer, lädt der Durchgang `/title/<id>` einmal je Titel wie ein
 * Linkklick (der Durchgang überlebt das Neuladen über sessionStorage). Zeigt auch das nichts, liegt es an Netflix
 * (Bremse), sonst war unser Sprung die Ursache — der Grund im Bericht sagt, welches von beiden. `loc`: `location`.
 */
globalThis.akNetflixVollLaden = (loc, speicher = sitzungSpeicher()) => ({
  versucht: (reihe) => speicher?.getItem('ak-netflix-vollgeladen') === String(reihe),
  laden(reihe) {
    try {
      speicher?.setItem('ak-netflix-vollgeladen', String(reihe))
    } catch {
      /* Ohne Speicher lädt der Durchgang jedes Mal neu; die Bremse greift trotzdem über die Fehlschläge. */
    }
    loc.assign(`/title/${reihe}`)
  },
})

/** Die Pausenzeile im Kasten (`text` = `null` entfernt sie). */
globalThis.akNetflixPauseZeigen = (zeileHolen, text) => {
  try {
    const zeile = zeileHolen()
    if (!zeile) return
    let el = zeile.querySelector('.ak-durchgang-pause')
    if (!text) return el?.remove()
    if (!el) {
      el = document.createElement('div')
      el.className = 'ak-hinweis ak-durchgang-pause'
      zeile.appendChild(el)
    }
    el.textContent = text
  } catch {
    /* Eine Anzeige darf den Takt nicht aufhalten. */
  }
}

/**
 * Der Fortschritt des Durchgangs: `gezaehlt` = Sprünge dieses Laufs (der aktuelle Titel zählt schon), `grenze` = bei Laufbeginn
 * offene Titel, `titel` = der gerade geprüfte. `null`, solange es keine Zahlen gibt.
 */
globalThis.akNetflixFortschritt = (gezaehlt, grenze, titel) => {
  if (!(grenze > 0) || !(gezaehlt > 0)) return null
  const geprueft = Math.min(gezaehlt - 1, grenze)
  return { text: `Durchgang: ${geprueft} von ${grenze} geprüft${titel ? ` · gerade: ${titel}` : ''}`, anteil: geprueft / grenze }
}

const ZEILE_FORTSCHRITT = 'ak-hinweis ak-durchgang-fortschritt'
const ZEILE_BALKEN = 'ak-durchgang-balken'

/** Fortschrittszeile und schmaler Balken im Kasten (`fortschritt` = `null` entfernt beide). */
globalThis.akNetflixFortschrittZeigen = (zeileHolen, fortschritt) => {
  try {
    const zeile = zeileHolen()
    if (!zeile) return
    let text = zeile.querySelector('.ak-durchgang-fortschritt')
    let balken = zeile.querySelector(`.${ZEILE_BALKEN}`)
    if (!fortschritt) {
      text?.remove()
      return balken?.remove()
    }
    if (!text) {
      text = document.createElement('div')
      text.className = ZEILE_FORTSCHRITT
      zeile.appendChild(text)
    }
    if (!balken) {
      balken = document.createElement('div')
      balken.className = ZEILE_BALKEN
      zeile.appendChild(balken)
    }
    text.textContent = fortschritt.text
    balken.style.setProperty('--ak-anteil', `${Math.round(fortschritt.anteil * 100)}%`)
  } catch {
    /* Eine Anzeige darf den Takt nicht aufhalten. */
  }
}

/**
 * Steht ein Titelfenster ohne Inhalt (grauer Hintergrund) auf `/title/<id>`, geht es auf die Startseite zurück — sonst bliebe der
 * Hintergrund stehen. Geräumt wird nur das Fenster, das der Durchgang selbst geöffnet hat: `o.sprung` (`zuletztGeoeffnet`) ist sein
 * Sprung in diesem Tab (`o.tab`) auf genau diese Kennung und mindestens `akNetflixLeerNach` ms her (vorher lädt der Inhalt noch). Ein
 * Titel, den Daniel selbst öffnet, bleibt. `gehe`: Navigation ohne Neuladen.
 */
globalThis.akNetflixFensterRaeumen = (doc, loc, gehe, o) => {
  const lage = akNetflixFensterlage(doc, loc)
  if (!lage?.hintergrund || lage.inhalt) return false
  const id = /^\/(?:[a-z-]+\/)?title\/(\d+)/.exec(lage.pfad)?.[1]
  const s = o?.sprung
  if (!id || !s?.durchgang || s.tab !== o.tab || String(s.id) !== id || !(o.jetzt - s.zeit >= akNetflixLeerNach)) return false
  gehe('/browse')
  return true
}

const ZAEHLER_SCHLUESSEL = 'ak-netflix-zaehler'

/** Zähler und Nenner des Fortschritts überstehen das volle Neuladen (`akNetflixVollLaden`): aus dem `sessionStorage`, sonst `{ gezaehlt: 0, grenze: null }`. */
globalThis.akNetflixZaehlerStand = (speicher = sitzungSpeicher()) => {
  try {
    const z = JSON.parse(speicher?.getItem(ZAEHLER_SCHLUESSEL) ?? 'null')
    return Number.isFinite(z?.gezaehlt) && z.grenze > 0 ? { gezaehlt: z.gezaehlt, grenze: z.grenze } : { gezaehlt: 0, grenze: null }
  } catch {
    return { gezaehlt: 0, grenze: null }
  }
}

/** Merkt Zähler und Nenner; `null` als Zähler vergisst sie (Ende des Durchgangs). */
globalThis.akNetflixZaehlerSetze = (gezaehlt, grenze, speicher = sitzungSpeicher()) => {
  try {
    if (gezaehlt === null) speicher?.removeItem(ZAEHLER_SCHLUESSEL)
    else speicher?.setItem(ZAEHLER_SCHLUESSEL, JSON.stringify({ gezaehlt, grenze }))
  } catch {
    /* Ohne Speicher gilt der Stand bis zum Neuladen. */
  }
}

/*
  **Was der Lauf bisher getan hat, überlebt das volle Neuladen** (14.11.2026). `fertigeTitel` und die übersprungenen Titel lagen nur im
  Arbeitsspeicher; jeder Titel lädt die Seite neu, am Ende stand „besucht 139, gemessen 0, übersprungen 4“ (Bericht 11:55 UTC).
  Beides liegt jetzt im `sessionStorage` (je Tab, wie der Zähler).
*/
globalThis.akNetflixSitzungSpeicher = sitzungSpeicher

/** Die Einträge (Liste) unter `schluessel`, sonst `[]`. */
globalThis.akNetflixLaufLesen = (speicher, schluessel) => {
  try {
    const x = JSON.parse(speicher?.getItem(schluessel) ?? '[]')
    return Array.isArray(x) ? x : []
  } catch {
    return []
  }
}

globalThis.akNetflixLaufSchreiben = (speicher, schluessel, eintraege) => {
  try {
    if (eintraege.length) speicher?.setItem(schluessel, JSON.stringify(eintraege))
    else speicher?.removeItem(schluessel)
  } catch {
    /* Ohne Speicher gilt der Stand bis zum Neuladen. */
  }
}

const FERTIG_SCHLUESSEL = 'ak-netflix-fertig'

/** Die abgeschlossenen Titel des Laufs als `Set`, das sich im `sessionStorage` merkt (`add` und `clear` schreiben). */
globalThis.akNetflixFertigSet = (speicher = sitzungSpeicher()) => {
  class Fertig extends Set {
    constructor() {
      super(globalThis.akNetflixLaufLesen(speicher, FERTIG_SCHLUESSEL))
    }

    add(k) {
      super.add(k)
      globalThis.akNetflixLaufSchreiben(speicher, FERTIG_SCHLUESSEL, [...this])
      return this
    }

    clear() {
      super.clear()
      globalThis.akNetflixLaufSchreiben(speicher, FERTIG_SCHLUESSEL, [])
    }
  }
  return new Fertig()
}

/** Eine `Map` (Kennung → Grund), die sich unter `schluessel` im `sessionStorage` merkt (`set` und `clear` schreiben, der Konstruktor lädt). */
globalThis.akNetflixLaufMap = (speicher, schluessel) =>
  class LaufMap extends Map {
    constructor() {
      super()
      for (const [k, g] of globalThis.akNetflixLaufLesen(speicher, schluessel)) super.set(k, g)
    }

    set(k, g) {
      super.set(k, g)
      globalThis.akNetflixLaufSchreiben(speicher, schluessel, [...this])
      return this
    }

    clear() {
      super.clear()
      globalThis.akNetflixLaufSchreiben(speicher, schluessel, [])
    }
  }

/** Ende des Durchgangs: gemerkte Titel des Laufs vergessen (Zähler: `akNetflixZaehlerSetze(null)`). */
globalThis.akNetflixLaufVergessen = (speicher = sitzungSpeicher()) => {
  globalThis.akNetflixLaufSchreiben(speicher, FERTIG_SCHLUESSEL, [])
  globalThis.akNetflixLaufSchreiben(speicher, 'ak-netflix-uebersprungen', [])
}

/*
  **Der Durchgang gehört einem Tab** (12.11.2026). `sessionStorage` gilt je Tab, der Besitzer aber steht in
  `chrome.storage.local` (`netflixDurchgangBesitzer`: `{ tab, puls }`), damit ein zweiter Tab ihn sieht.
  Ein lebender Besitzer (Puls jünger als `BESITZER_FRIST_MS`) hält jeden anderen Tab vom Start ab und
  beendet einen anderen laufenden Durchgang; ein toter wird übernommen (Tab zu, Absturz).
*/
const BESITZER_FRIST_MS = 90 * 1000
const BESITZER_PULS_MS = 5 * 1000

/** `'meiner'`, `'fremd'` (lebt) oder `'frei'` (nicht vorhanden oder Puls abgelaufen). */
globalThis.akNetflixBesitzerUrteil = (b, tab, jetzt) => {
  if (!b?.tab || !(jetzt - b.puls < BESITZER_FRIST_MS)) return 'frei'
  return b.tab === tab ? 'meiner' : 'fremd'
}

/** Die Kennung dieses Tabs; übersteht Neuladen und Seitenwechsel (sessionStorage). */
globalThis.akNetflixTabKennung = () => {
  try {
    let k = sessionStorage.getItem('ak-netflix-tab')
    if (!k) {
      k = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      sessionStorage.setItem('ak-netflix-tab', k)
    }
    return k
  } catch {
    return 'ohne-speicher'
  }
}

/**
 * Ein Takt des Besitzes. `o`: `{ selbstAn, besitzer (undefined = noch nicht geladen), tab, jetzt }`;
 * `tun`: `{ schreiben(besitzer), beenden(grund) }`. `true` = dieser Tab darf weitermachen.
 */
globalThis.akNetflixBesitz = (o, tun) => {
  if (!o.selbstAn) return true
  if (o.besitzer === undefined) return false
  const urteil = akNetflixBesitzerUrteil(o.besitzer, o.tab, o.jetzt)
  if (urteil === 'fremd') {
    tun.beenden('Der Durchgang läuft in einem anderen Tab')
    return false
  }
  if (urteil !== 'meiner' || o.jetzt - o.besitzer.puls >= BESITZER_PULS_MS) tun.schreiben({ tab: o.tab, puls: o.jetzt })
  return true
}

/** Was der Start-Knopf sagt, wenn ein anderer Tab den Durchgang führt (`null` = Start erlaubt). */
globalThis.akNetflixStartHinweis = (besitzer, tab, jetzt) => {
  if (akNetflixBesitzerUrteil(besitzer, tab, jetzt) !== 'fremd') return null
  const sekunden = Math.round((jetzt - besitzer.puls) / 1000)
  return {
    text: 'Läuft schon in einem anderen Tab',
    title: `Der Durchgang läuft in einem anderen Netflix-Tab (zuletzt vor ${sekunden} s aktiv). Dort beenden; ist der Tab zu, geht es hier nach spätestens ${BESITZER_FRIST_MS / 1000} s.`,
  }
}

/** `zuletztGeoeffnet` eines Durchgangs aus einem anderen Tab gehört diesem Tab nicht (sonst Melde-Knopf für fremde Titel). */
globalThis.akNetflixEigenerSprung = (z, tab) => (z?.durchgang && z.tab !== tab ? null : (z ?? null))

/*
  **Bericht je geöffnetem Titel** (12.11.2026): Adressfolge mit Zeit, wann Hintergrund und Inhalt des
  Titelfensters erschienen, Fehlercode, Ausgang samt Fehlschlägen in Folge und Pause. Die letzten 40 Titel.
*/

/** Was die Seite jetzt zeigt. `previewModal--backDrop` ist gemessen (Bericht 12.11.); der Inhalt ist ein Dialog, eine Folge oder jedes andere `previewModal…`. */
globalThis.akNetflixFensterlage = (doc, loc) => {
  try {
    const text = doc.body?.innerText ?? ''
    return {
      pfad: loc.pathname,
      hintergrund: Boolean(doc.querySelector('[data-uia="previewModal--backDrop"]')),
      inhalt: Boolean(doc.querySelector('[data-uia*="episode"], [role="dialog"], [data-uia^="previewModal"]:not([data-uia="previewModal--backDrop"])')),
      code: (text.match(/\b(?:UI\d{3,4}|NSES-\d+|E\d{3}|M7\d{3,4})\b/) ?? [null])[0],
    }
  } catch {
    return null
  }
}

globalThis.akNetflixTitelBericht = (tab) => {
  const liste = []
  const letzter = () => liste[liste.length - 1]
  return {
    beginn(reihe, jetzt) {
      liste.push({ reihe: String(reihe), tab, ab: jetzt, adressen: [], hintergrundNachMs: null, inhaltNachMs: null, hintergrundOhneInhalt: false, code: null, ausgang: null })
      if (liste.length > 40) liste.shift()
    },
    sehen(lage, jetzt) {
      const r = letzter()
      if (!r || !lage) return
      if (r.adressen.at(-1)?.pfad !== lage.pfad && r.adressen.length < 8) r.adressen.push({ pfad: lage.pfad, nachMs: jetzt - r.ab })
      if (lage.hintergrund) r.hintergrundNachMs ??= jetzt - r.ab
      if (lage.inhalt) r.inhaltNachMs ??= jetzt - r.ab
      r.hintergrundOhneInhalt = lage.hintergrund && !lage.inhalt
      r.code = lage.code ?? r.code
    },
    /** Der Ausgang des Titels (Bremse: Fehlschlag), samt Stand der Bremse. */
    ausgang(reihe, text, bremse) {
      const r = liste.findLast((e) => e.reihe === String(reihe))
      if (r) r.ausgang = { text, folge: bremse.folge, pausen: bremse.pausen, pauseBis: bremse.bis }
    },
    liste: () => liste.map((e) => ({ ...e })),
  }
}

/**
 * Der Takt des Durchgangs vor allem anderen: erst der Besitz (anderer Tab lebt → Ende), dann der Bericht,
 * dann die Pause. `true` = der Takt geht weiter. `o`: `{ selbstAn, besitzer, tab, jetzt, bremse }`;
 * `tun`: `{ schreiben, beenden, sehen, zeigen, weiter }` (siehe `akNetflixBesitz`, `akNetflixBremseTakt`).
 */
globalThis.akNetflixSelbstTakt = (o, tun) => {
  if (!akNetflixBesitz(o, tun)) return false
  if (!o.selbstAn) return true
  tun.sehen()
  return !akNetflixBremseTakt(o.bremse, o.jetzt, tun)
}

/**
 * Die Rückrufe des Takts (`akNetflixSelbstTakt`). `d`: `{ titelBericht, kasten (netflixKasten), speichern (speicherSchreiben),
 * beenden (laufBeenden), weiter (selbstWeiter), gehe (Navigation ohne Neuladen), fortschritt (`akNetflixFortschritt` des Laufs),
 * sprung (`zuletztGeoeffnet`), tab (`meinTab`) }`.
 */
globalThis.akNetflixTaktTun = (d) => ({
  schreiben: (besitzer) => void d.speichern({ netflixDurchgangBesitzer: besitzer }),
  beenden: d.beenden,
  sehen: () => {
    d.titelBericht.sehen(akNetflixFensterlage(document, location), Date.now())
    akNetflixFortschrittZeigen(() => d.kasten().querySelector('.ak-z-melden'), d.fortschritt?.() ?? null)
  },
  zeigen: (text) => akNetflixPauseZeigen(() => d.kasten().querySelector('.ak-z-melden'), text),
  raeumen: () => akNetflixFensterRaeumen(document, location, d.gehe, { sprung: d.sprung?.(), tab: d.tab, jetzt: Date.now() }),
  /** Ende des Durchgangs: Pausen- und Fortschrittszeile weg, Zähler vergessen, kein eigener grauer Hintergrund übrig. */
  aufraeumen() {
    this.zeigen(null)
    akNetflixFortschrittZeigen(() => d.kasten().querySelector('.ak-z-melden'), null)
    akNetflixZaehlerSetze(null)
    akNetflixLaufVergessen()
    this.raeumen()
  },
  weiter: d.weiter,
})

/** Der Teil des Diagnoseberichts, der die Sitzung erklärt: Titel mit Adressfolge, Bremse, Tab und Besitzer. */
globalThis.akNetflixSitzungBericht = (titelBericht, bremse, tab, besitzer, jetzt) => ({
  tab,
  besitzer: besitzer === undefined ? 'nicht geladen' : { ...besitzer, urteil: akNetflixBesitzerUrteil(besitzer, tab, jetzt) },
  bremse: bremse.bericht(),
  titel: titelBericht.liste(),
})
