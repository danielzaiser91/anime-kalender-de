/*
  **Netflix-Durchgang: übersprungene Titel bleiben zurückgestellt** (4.31.3, 15.10.2026)

  Daniel am 15.10.2026: Yu-Gi-Oh! und Pokémon Sonne & Mond kamen bei jedem „▶ alle durchgehen“ wieder,
  weil `selbstUebersprungen` in `melder.js` nur im Arbeitsspeicher lag und jeder Start es leerte.
  Jetzt ist es eine `Map`, deren Einträge zusätzlich mit Ablauf in `chrome.storage.local` liegen
  (`netflixZurueckgestellt`: `{ Kennung: { grund, bis, am } }`, je Browser-Profil; `am` = wann der Durchgang den Titel
  zuletzt gemessen und zurückgestellt hat, seit 15.11.2026, ältere Einträge tragen es nicht). `has()` kennt die gespeicherten
  Einträge, darum überspringt `naechsterAuftrag()` sie ohne eigene Zeile. `clear()` (Start eines Durchgangs)
  leert nur den Arbeitsspeicher, nie den Speicher. Lädt laut Manifest vor `melder.js`.

  Ablauf: „Erinnern" mit erkanntem Datum → bis zu diesem Tag (heute: nur 1 Stunde, danach wieder offen; Europe/Berlin; Netflix nennt kein Jahr, ein
  vergangenes Datum ohne Jahr gilt als unlesbar); „Erinnern" ohne (lesbares) Datum → 7 Tage (eine Woche gewählt, nicht gemessen: Netflix nennt dann keinen Termin, und ein Tag wäre mehr Besuche ohne Neues; Grund „Erinnern-Knopf ohne Datum", mit Datum „Erinnern-Knopf mit Datum (19.11.)", 18.11.2026); alles andere (keine
  Folgenliste, nach N Versuchen offen) → 1 Tag; nie mehr als 30 Tage (ein falsch gelesenes Datum sperrt keinen
  Titel für ein Jahr). Ein Titel, der nach dem Worker-Stand fertig ist, fliegt raus, ebenso ein Eintrag mit dem
  Grund „fertig" und jeder abgelaufene. Seit 15.11.2026 meldet `zurueckMelden` die Menge an den Worker
  (`POST ?zurueck=1`, Tabelle `pruefung_zurueck`), damit der Prüfstand dieselbe Zahl nennt wie die Liste.
*/
/* Je Titel ein Schlüssel (`netflixZurueck:<Kennung>`), damit kein Tab den Stand eines anderen überschreibt (4071, 17.11.2026). */
const ZURUECK_PRAEFIX = 'netflixZurueck:'
/* Der Sammelschlüssel bis 17.11.2026; wandert beim Laden hinüber. Alle Einträge laufen spätestens nach 30 Tagen ab: ab 17.12.2026 kann der Rückfall weg. */
const ZURUECK_SCHLUESSEL = 'netflixZurueckgestellt'
const ZURUECK_GEMELDET = 'netflixZurueckGemeldet'
const ZURUECK_ABSTAND_MS = 10 * 60 * 1000
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
  /* Auch die Kurzform aus dem Grund („19.11."), siehe `akNetflixErinnernGrund`. */
  const zahl = /^\s*(\d{1,2})\.(\d{1,2})\.\s*$/.exec(String(text ?? ''))
  const treffer = zahl ? [zahl[0], zahl[1], ZURUECK_MONATE[Number(zahl[2]) - 1] ?? '', undefined] : /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?(?:\s+(\d{4}))?/.exec(String(text ?? ''))
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

/**
 * Das Datum zu einem Grund: Steht es im Grund („Erinnern-Knopf mit Datum (19.11.)"), gilt dieses; „… ohne Datum" hat keins (nie ein
 * zweites Mal von der Seite lesen: Grund und Frist kommen aus einer Messung). Nur ein alter Grund („Erinnern statt Folgenliste") liest `datum()`.
 */
function zurueckDatumQuelle(grund, datum) {
  const imGrund = /^Erinnern-Knopf mit Datum \(([^)]*)\)/.exec(grund)
  if (imGrund) return imGrund[1]
  return /^Erinnern/.test(grund) && !/^Erinnern-Knopf ohne Datum/.test(grund) ? datum() : null
}

/** Die Einträge aus dem Speicher (`get(null)`): ein Schlüssel je Titel; `migrieren` = Titel, die nur im alten Sammelschlüssel stehen. */
function zurueckEinlesen(x) {
  const alt = x[ZURUECK_SCHLUESSEL] ?? {}
  const neu = Object.fromEntries(
    Object.entries(x)
      .filter(([k]) => k.startsWith(ZURUECK_PRAEFIX))
      .map(([k, e]) => [k.slice(ZURUECK_PRAEFIX.length), e]),
  )
  return { eintraege: { ...alt, ...neu }, migrieren: Object.keys(alt).filter((k) => !(k in neu)) }
}

/** Schreibt die Titel des alten Sammelschlüssels in je einen Schlüssel und löscht den alten (einmal, beim ersten Laden danach). */
async function zurueckMigrieren(speicher, x, migrieren) {
  if (!(ZURUECK_SCHLUESSEL in x)) return
  if (migrieren.length) await speicher.set(Object.fromEntries(migrieren.map((k) => [ZURUECK_PRAEFIX + k, x[ZURUECK_SCHLUESSEL][k]])))
  await speicher.remove(ZURUECK_SCHLUESSEL)
}

/** Lädt die Merkliste aus dem Speicher in `stand` (bei Bedarf wandert der alte Sammelschlüssel hinüber). */
async function zurueckLaden(speicher, stand) {
  const x = (await speicher.get(null)) ?? {}
  const { eintraege, migrieren } = zurueckEinlesen(x)
  Object.assign(stand, eintraege)
  await zurueckMigrieren(speicher, x, migrieren)
}

/**
 * Eine Änderung: nur der Schlüssel dieses Titels wird geschrieben (`eintrag`) oder gelöscht (`null`), nie der ganze Stand, damit ein
 * anderer Tab seine Zurückstellungen behält (4071); `aenderung` steht im Zustandsprotokoll.
 */
function zurueckSchreiben(speicher, stand, kennung, eintrag, aenderung) {
  if (eintrag) stand[kennung] = eintrag
  else delete stand[kennung]
  globalThis.akProtokoll?.('merkliste', { aenderung, kennung, ...(eintrag && { grund: eintrag.grund, bis: eintrag.bis }) })
  return eintrag ? speicher.set({ [ZURUECK_PRAEFIX + kennung]: eintrag }) : speicher.remove(ZURUECK_PRAEFIX + kennung)
}

/** Übernimmt Änderungen anderer Tabs (`onChanged`) in `stand`; was dieser Tab schon so weiß, auch die eigene Schreibung, bleibt stumm. `true` = etwas war neu. */
function zurueckFremd(aenderungen, stand) {
  let neu = false
  for (const [schluessel, a] of Object.entries(aenderungen)) {
    const kennung = schluessel.slice(ZURUECK_PRAEFIX.length)
    if (!schluessel.startsWith(ZURUECK_PRAEFIX) || JSON.stringify(a.newValue ?? null) === JSON.stringify(stand[kennung] ?? null)) continue
    if (a.newValue) stand[kennung] = a.newValue
    else delete stand[kennung]
    globalThis.akProtokoll?.('merkliste', { aenderung: a.newValue ? 'fremd-gesetzt' : 'fremd-entfernt', kennung })
    neu = true
  }
  return neu
}

/** Überschrift der Prüfliste: die offenen Titel. Die Zurückgestellten nennt der Knopf daneben (`netflix-liste-ansicht.js`). */
globalThis.akNetflixKopfText = (offen) => (offen ? `${offen} Titel zu prüfen` : 'Alles geprüft')

/**
 * Fragen der Prüfliste an die Merkliste: Ist ein Titel zurückgestellt oder gemeldet (= nicht offen), wie viele sind es,
 * und `geladen()` (Speicher geladen, jede Änderung geschrieben). Zurückgestellte zählen nicht als offen (F135, 14.11.2026).
 */
function zurueckFragen(aktiv, gelistet, istFertig, kennungen, bereit, eintrag) {
  const zurueckgestellt = (kennung) => gelistet(String(kennung)) && aktiv(String(kennung))
  return {
    zurueckgestellt,
    /** Grund, Ablauf und letzte Messung (`am`, fehlt bei alten Einträgen) eines aktiven Eintrags für die Prüfliste, sonst `null`. */
    zurueckInfo: (kennung) => {
      const e = eintrag(String(kennung))
      if (!e || !zurueckgestellt(kennung)) return null
      return {
        grund: e.grund,
        bis: e.bis,
        am: e.am,
      }
    },
    nichtOffen: (kennung) => istFertig(String(kennung)) || zurueckgestellt(kennung),
    zurueckZahl: () => kennungen().filter(zurueckgestellt).length,
    geladen: () => bereit(),
  }
}

/** Die gültigen Einträge (`bis` in der Zukunft) nach Kennung sortiert: der Rumpf der Meldung an den Worker. */
function zurueckEintraege(stand, jetzt) {
  const gueltig = Object.keys(stand)
    .filter((k) => stand[k].bis > jetzt)
    .sort()
  return Object.fromEntries(gueltig.map((k) => [k, { grund: stand[k].grund, bis: stand[k].bis }]))
}

/**
 * Meldet die Zurückstellungen an den Worker, damit sein Prüfstand dieselbe Zahl nennt wie die Liste (15.11.2026).
 * Höchstens eine Meldung je `ZURUECK_ABSTAND_MS` (auch nach einem Fehlschlag) und nur bei geänderter Menge; der Stand der
 * letzten Meldung liegt im Speicher und überlebt das Neuladen jedes Titels. `o`: `{ stand(), speicher, jetzt(), worker, token(), holen }`.
 * Ergebnis `{ art, spaeter? }`; `spaeter` = Millisekunden, nach denen die Änderung nachgeholt wird (auch nach Ablehnung oder Netzfehler).
 */
async function zurueckMelden(o) {
  const eintraege = zurueckEintraege(o.stand(), o.jetzt())
  const inhalt = JSON.stringify(eintraege)
  const letzte = (await o.speicher.get(ZURUECK_GEMELDET))?.[ZURUECK_GEMELDET] ?? {}
  if (letzte.inhalt === inhalt || (letzte.inhalt === undefined && inhalt === '{}')) return { art: 'gleich' }
  const rest = (letzte.versuch ?? 0) + ZURUECK_ABSTAND_MS - o.jetzt()
  if (rest > 0) return { art: 'spaeter', spaeter: rest }
  const token = await o.token()
  if (!token) return { art: 'ohne-token' }
  await o.speicher.set({ [ZURUECK_GEMELDET]: { inhalt: letzte.inhalt, versuch: o.jetzt() } })
  try {
    const antwort = await o.holen(`${o.worker}?zurueck=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({ plattform: 'netflix', eintraege, version: o.version?.() ?? null }),
    })
    if (!antwort.ok) return { art: 'abgelehnt', spaeter: ZURUECK_ABSTAND_MS }
  } catch {
    return { art: 'fehler', spaeter: ZURUECK_ABSTAND_MS }
  }
  await o.speicher.set({ [ZURUECK_GEMELDET]: { inhalt, versuch: o.jetzt() } })
  return { art: 'gesendet' }
}

/** Die Umgebung der Merkliste, deren `geaendert()` zusätzlich meldet (nur mit `worker`); eine Änderung im Abstand holt ein Timer nach. */
function zurueckMitMelden(roh, stand) {
  if (!roh.worker) return roh
  let wartet = false
  const warten = roh.warten ?? ((fn, ms) => setTimeout(fn, ms))
  const o = {
    stand,
    speicher: roh.speicher ?? globalThis.akKontext.lokal,
    jetzt: roh.jetzt ?? Date.now,
    worker: roh.worker,
    token: roh.token ?? (async () => (await globalThis.akKontext.lesen('token', 'sync'))?.token),
    holen: roh.holen ?? ((...a) => fetch(...a)),
    version: roh.version ?? (() => globalThis.akKontext?.version?.() ?? null),
  }
  /* Nacheinander: zwei Änderungen kurz hintereinander (Laden, dann Aufräumen) sollen nicht zweimal melden. */
  let kette = Promise.resolve()
  const nachholen = (e) => {
    if (e.spaeter === undefined || wartet) return
    wartet = true
    warten(() => {
      wartet = false
      melde()
    }, e.spaeter)
  }
  const melde = () => {
    kette = kette.then(() => zurueckMelden(o)).then(nachholen).catch(() => {})
    return kette
  }
  return {
    ...roh,
    geaendert: () => {
      melde()
      roh.geaendert?.()
    },
  }
}

/**
 * Die Merkliste des Durchgangs (`Map` Kennung → Grund) samt dauerhafter Zurückstellung.
 * `titel`: die Prüfliste (Kennung → Eintrag); `fertig(kennung, eintrag)`: Worker-Stand, `true` = nicht mehr offen.
 * `roh` (Tests, Melder): `{ speicher, jetzt, datum, standDa() }` (`standDa`: der Worker-Stand ist da, erst dann löscht „fertig“ eine Zurückstellung); `geaendert()` (Melder): nach dem Laden und nach jedem Schreiben,
 * damit die Zähler der Prüfliste neu rechnen; `worker` (Melder): Adresse des Workers, an den die Zurückstellungen gemeldet werden.
 */
globalThis.akNetflixZurueckNeu = (titel, fertig, roh = {}) => {
  const speicher = roh.speicher ?? globalThis.akKontext.lokal
  const jetzt = roh.jetzt ?? Date.now
  const datum = roh.datum ?? (() => globalThis.erscheinungsdatum?.())
  const standDa = roh.standDa ?? (() => true)
  const stand = {}
  const umgebung = zurueckMitMelden(roh, () => stand)
  let bereit = Promise.resolve()

  /** Änderungen laufen nacheinander, erst nach dem Laden; geschrieben wird nur der Schlüssel dieses Titels (`zurueckSchreiben`). */
  const aendern = (kennung, eintrag, aenderung) => {
    bereit = bereit
      .then(() => zurueckSchreiben(speicher, stand, kennung, eintrag, aenderung))
      .then(() => umgebung.geaendert?.())
      .catch(() => {})
  }
  const entfernen = (kennung, aenderung = 'entfernt') => aendern(kennung, null, aenderung)

  const gelistet = (kennung) => titel[kennung] !== undefined
  const istFertig = (kennung) => gelistet(kennung) && fertig(kennung, titel[kennung])

  const aktiv = (kennung) => {
    const e = stand[kennung]
    if (!e) return false
    /* „Fertig“ löscht nur auf Antwort des Worker-Stands: davor gilt der lokale Rückfall, der offene Titel zu früh als fertig zählt (18.11.2026). */
    if (e.bis <= jetzt() || (standDa() && istFertig(kennung))) {
      entfernen(kennung, e.bis <= jetzt() ? 'abgelaufen' : 'fertig')
      return false
    }
    return true
  }

  bereit = zurueckLaden(speicher, stand)
    .then(() => Object.keys(stand).forEach(aktiv)) /* Abgelaufenes fliegt gleich beim Laden raus. */
    .then(() => umgebung.geaendert?.())
    .catch(() => {})
  /* Andere Tabs ändern die Merkliste live; `roh.beiAenderung` (Tests) ersetzt den Hörer des Kontexts. */
  const hoeren = roh.beiAenderung ?? ((fn) => globalThis.akKontext?.beiAenderung(fn))
  hoeren((aenderungen, bereich) => {
    if (bereich === 'local') void bereit.then(() => zurueckFremd(aenderungen, stand) && umgebung.geaendert?.())
  })

  /* Die Einträge dieses Laufs überstehen das volle Neuladen jedes Titels (`akNetflixLaufMap`). */
  class Zurueckgestellt extends globalThis.akNetflixLaufMap(umgebung.sitzung ?? globalThis.akNetflixSitzungSpeicher?.(), LAUF_UEBERSPRUNGEN) {
    has(kennung) {
      return super.has(kennung) || aktiv(String(kennung))
    }

    set(kennung, grund) {
      const k = String(kennung)
      if (grund === 'fertig') entfernen(k)
      else {
        const bis = zurueckBis(grund, zurueckDatumQuelle(grund, datum), jetzt())
        const am = jetzt()
        aendern(k, { grund, bis, am }, 'gesetzt')
      }
      return super.set(kennung, grund)
    }

    /** Start eines Durchgangs: auch die „nicht bei Netflix“-Urteile des vorigen Laufs gehen (Zählung des Endberichts). */
    clear() {
      super.clear()
      globalThis.akNetflixNichtDa?.().clear()
    }

    /** Zurückgestellte, noch offene Titel der Prüfliste; `neue`: nur die, die dieser Lauf nicht schon selbst nennt. */
    zurueckOffen(neue) {
      return Object.keys(stand).filter((k) => aktiv(k) && gelistet(k) && !(neue && super.has(k)))
    }

    /** Anhang der Endanzeige: wie viele offene Titel zurückgestellt sind (leer bei 0). */
    zurueckText() {
      const n = this.zurueckOffen(true).length
      return n ? ` · davor schon zurückgestellt (andere Durchgänge): ${n}` : ''
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

globalThis.akZurueckBis = zurueckBis
