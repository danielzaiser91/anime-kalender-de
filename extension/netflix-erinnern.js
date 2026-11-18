/*
  **Netflix-Durchgang: Titelseite ohne Folgenliste** — eigene Datei, weil `melder.js` über der
  Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Daniel am 13.10.2026 (4.30.4), Yu-Gi-Oh! (`/title/70177034`): Die Titelseite zeigt statt „Abspielen"
  nur „Erinnern", keine Folgenliste, nur „Ähnliche Titel". Der Durchgang wartete die ganze Frist auf
  eine Liste (20 s plus Takt, gut 30 s), die dort nie kommt. Jetzt geht er nach `ERINNERN_NACH_MS`
  weiter und **meldet nichts** (wie Disney+: ein Nein hat mehrere Gründe, und das Merkmal ist unbelegt).
  Gemeldet wird nur der Klick auf „Noch nicht da — ab <Termin> melden" (`melden()`, nur mit Termin; ohne Termin heißt es
  „Angekündigt", 18.11.2026); die Automatik dafür wurde am 26.08.2026 bewusst entfernt. Der Titel steht als übersprungen in der Endliste.

  Das Merkmal ist das des Knopfes (`keineFolgeVorhanden()`, Text „Erinnern" / „Remind me"); ein
  sprachfreies Merkmal im DOM oder Netzwerk ist ohne Mitschnitt einer solchen Seite nicht belegt.
  Die Schonzeit hält Reste einer vorigen Seite und eine noch ladende Liste auseinander von der Seite.
*/
const ERINNERN_NACH_MS = 3000
/*
  Ein Titelfenster ohne Inhalt (Startseite unter `/title/…`, Hintergrund ohne Dialog; Bericht 12.11.2026: Hintergrund nach 1 s, Inhalt
  nie) wartet nicht die volle Listenfrist (20 s je Versuch, mit vollem Laden gut 45 s je Titel): nach 8 s gilt es als leer.
*/
const LEER_NACH_MS = 8000
globalThis.akNetflixLeerNach = LEER_NACH_MS

/**
 * Der Melde-Knopf auf einer Titelseite mit „Erinnern“ (18.11.2026): Nennt Netflix einen Termin, meldet der Klick „ab <Termin>“.
 * Ohne Termin ist der Titel angekündigt, nicht abwesend — kein Knopf, nie „nicht abrufbar“ (das streicht den Weg).
 * Anzeige (`beschriftung`) und Handlung (`melden`) lesen diese eine Funktion.
 */
globalThis.akNetflixErinnernKnopf = (termin, zurueck = null) => {
  if (termin) return { text: `Noch nicht da — „ab ${termin}" melden`, klasse: 'ak-nein', aktiv: true }
  /* Ohne Termin gibt es nichts zu melden (Daniel, 18.11.2026: „es sollte auf zurückgestellt gesetzt werden"): der Klick stellt den Titel zurück. */
  if (zurueck) return { text: `Zurückgestellt bis ${globalThis.akNetflixTagKurz(zurueck.bis)} ✓ — ${zurueck.grund}`, klasse: 'ak-leer', aktiv: false }
  return { text: `Zurückstellen — ${globalThis.akNetflixErinnernGrund(null)}`, klasse: 'ak-leer', aktiv: true }
}

/** Berliner Kalendertag eines Zeitpunkts als „25.11.". */
globalThis.akNetflixTagKurz = (ms) => {
  const t = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'numeric' }).formatToParts(new Date(ms))
  return `${t.find((p) => p.type === 'day').value}.${t.find((p) => p.type === 'month').value}.`
}

/** Was der Melde-Knopf zeigt: die Beschriftung der Lage, ohne Text ein abgeblendeter Platzhalter (nie versteckt, nie leer). */
globalThis.akNetflixKnopfZustand = (z) => (z?.text ? { text: z.text, klasse: z.klasse, aktiv: Boolean(z.aktiv) } : { text: 'Nichts zu melden', klasse: 'ak-leer', aktiv: false })

/**
 * Schreibt den Zustand des Melde-Knopfs in einem Zug (erst berechnen, dann schreiben). Wechselt die Adresse, fällt die Rückmeldung des
 * vorigen Titels („Zurückgestellt ✓") sofort weg; sonst bleibt eine laufende Rückmeldung (`ak-erfolg`/`ak-fehler`) stehen.
 */
globalThis.akNetflixKnopfSchreiben = (el, beschriftung, pfad) => {
  const z = globalThis.akNetflixKnopfZustand(beschriftung)
  if (el.akPfad !== pfad) {
    el.akPfad = pfad
    el.classList.remove('ak-erfolg', 'ak-fehler')
  }
  el.hidden = false
  el.disabled = !z.aktiv
  if (el.classList.contains('ak-erfolg') || el.classList.contains('ak-fehler')) return
  el.textContent = z.text
  el.classList.remove('ak-ja', 'ak-nein', 'ak-leer')
  el.classList.add(z.klasse)
}

/** Klick „Zurückstellen" bei „Erinnern" ohne Termin: nur zurückstellen, nichts melden. Gibt den Text für die Rückmeldung zurück. */
globalThis.akNetflixErinnernZurueckstellen = (karte, reihe) => {
  karte.set(String(reihe), globalThis.akNetflixErinnernGrund(null))
  return 'Zurückgestellt ✓'
}

const ERINNERN_MONATE = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez']

/** „19. November" / „3. Okt. 2026" → „19.11." (Netflix nennt Tag und Monat); ohne lesbares Datum `null`. */
globalThis.akNetflixDatumKurz = (text) => {
  const t = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)/.exec(String(text ?? ''))
  const m = t ? ERINNERN_MONATE.indexOf(t[2].toLowerCase().slice(0, 3).replace('mar', 'mär')) + 1 : 0
  return m ? `${Number(t[1])}.${m}.` : null
}

/**
 * Der Grund einer Zurückstellung wegen des Erinnern-Knopfes (18.11.2026, Daniel: „wenn Netflix ein Datum nennt, muss das auch der Grund sein").
 * Das Datum steht im Grund, und `zurueckBis` liest es von dort: Grund und „zurück bis" kommen aus derselben Messung. Die Klammer lässt
 * die Prüfliste alle Daten als eine Art zählen (`ansichtGrundArt`).
 */
globalThis.akNetflixErinnernGrund = (datum) => {
  const kurz = globalThis.akNetflixDatumKurz(datum)
  return kurz ? `Erinnern-Knopf mit Datum (${kurz})` : 'Erinnern-Knopf ohne Datum'
}

/**
 * Ein Film hat keine Folgenliste und geht über `/watch` — aber nur, wenn seine Titelseite Inhalt zeigt (16.11.2026, Appleseed: unter
 * `/title/…` die Startseite, 20 s im Player und ein zweiter Versuch). Zeigt sie Inhalt: `filmFrei` (oder, war der Film schon im Player
 * und ist noch offen, kein zweiter Versuch). Zeigt sie die Startseite: `null`, und die Strecke der Serien übernimmt (nach `LEER_NACH_MS`
 * einmal voll laden, dann Störung der Sitzung mit Bremse; der Titel gilt als zurückgestellt, sobald die Bremse ihn bucht) — ohne Player und
 * ohne Urteil „nicht bei Netflix“: ein leeres Fenster kann auch ein langsam ladendes echtes sein; als Urteil gilt nur der Server-Redirect
 * (`akNetflixUmleitungProbe`).
 */
const filmFenster = (wartet, o, tun) => {
  if (globalThis.akNetflixTitelfensterLeer(o.merkmale?.())) return null
  /* Schon im Player gewesen und offen geblieben: kein zweiter Versuch über denselben Weg (`o.erledigt`: laut Prüfliste nicht mehr offen). */
  if (globalThis.akNetflixFilmGescheitert(o.reihe, o.erledigt, tun.uebersprungen, tun.weiter)) return { ...wartet, entschieden: true }
  return { ...wartet, filmFrei: true }
}

/** Wie `listeWartenSchritt`, dazu die Frist dieses Wartens (leeres Titelfenster, auch das eines Films: `LEER_NACH_MS`, sonst `o.frist`) für die Anzeige. */
globalThis.akNetflixListeWarten = (wartet, o, tun) => {
  const neu = listeWartenSchritt(wartet, o, tun)
  if (!neu || neu.entschieden || neu.filmFrei) return neu
  const kurz = globalThis.akNetflixTitelfensterLeer?.(o.merkmale?.())
  return { ...neu, film: Boolean(o.film), frist: kurz ? Math.min(LEER_NACH_MS, o.frist) : o.frist }
}

/** Die erste Handlung des Titelfensters (Text des Dialogs) ist „Erinnern": Netflix zeigt dort keine Folgenliste und kein „Abspielen". */
const erinnernImFenster = (m) => /^(?:Erinnern|Remind me)\b/i.test(m?.dialoge?.anfang ?? '')

/**
 * Der Wartetext für den Kasten („wartet auf die Folgenliste, 12 s (Notausgang nach 20 s)“); leer, wenn nichts mehr gewartet wird.
 * Die Frist ist der Notausgang, nicht die erwartete Dauer: entschieden wird am Zustand der Seite (Abspielen, Erinnern), 18.11.2026.
 */
globalThis.akNetflixWartetText = (wartet, jetzt) => {
  if (!wartet?.frist || wartet.entschieden || wartet.filmFrei) return ''
  const s = Math.min(Math.floor((jetzt - wartet.seit) / 1000), Math.round(wartet.frist / 1000))
  return `wartet auf ${wartet.film ? 'den Titel' : 'die Folgenliste'}, ${s} s (Notausgang nach ${Math.round(wartet.frist / 1000)} s)`
}

/**
 * Ein Takt des Wartens auf die Folgenliste. `wartet`: `{ seite, seit, entschieden? }` oder `null`;
 * `o`: `{ seite, reihe, erinnern, frist, jetzt, durchlauf, merkmale? }` (`merkmale()`: Seitenmerkmale für die Spur); `tun`: `{ spur, uebersprungen (Map Kennung → Grund), weiter, bremse? }` (`bremse`: `netflix-durchgang-steuerung.js`).
 * Gibt den neuen Wartestand zurück.
 */
const listeWartenSchritt = (wartet, o, tun) => {
  if (wartet?.seite !== o.seite) return { seite: o.seite, seit: o.jetzt }
  if (wartet.entschieden) return wartet
  const film = o.film ? filmFenster(wartet, o, tun) : null
  if (film) return film
  const dauer = o.jetzt - wartet.seit
  const dazu = { reihe: o.reihe, folgen: o.durchlauf.folgen.length, listeFuer: o.durchlauf.listeFuer ?? null }
  /* Zeigt das Titelfenster selbst „Erinnern" als erste Handlung, ist der Zustand da (18.11.2026): keine Schonzeit; ob er noch dem vorigen Titel gehört, klärt das volle Neuladen unten. */
  const erinnernJetzt = o.erinnern && (erinnernImFenster(o.merkmale?.()) || dauer >= ERINNERN_NACH_MS)
  /* Die kurze Frist gilt für jedes leere Titelfenster, unabhängig von Netzantworten (Bericht 14.11.2026: umgebogene Titelseite stand 23 s statt 8 s + Neuladen). */
  const leerFrist = Math.min(o.frist, LEER_NACH_MS)
  if (!erinnernJetzt && dauer <= leerFrist) return wartet
  const merkmale = o.merkmale?.()
  /* Ohne Titelfenster stammt auch „Erinnern" aus dem Billboard der Startseite: `leerFrist` warten, dann zählt es als Störung der Sitzung. */
  if (tun.bremse && globalThis.akNetflixTitelfensterLeer(merkmale)) {
    if (dauer <= leerFrist) return wartet
    /* Der Sprung per pushState (`gehe`) ist unser eigener Weg und könnte das Fenster verhindern: erst einmal voll laden, wie ein Klick auf den Link. */
    if (tun.vollLaden && !tun.vollLaden.versucht(o.reihe)) {
      tun.spur('Titelfenster ohne Inhalt: Seite wird voll geladen', { ...dazu, seite: merkmale })
      tun.vollLaden.laden(o.reihe)
      return { ...wartet, entschieden: true }
    }
    tun.spur('Titelfenster ohne Inhalt', { ...dazu, seite: merkmale })
    const nachLaden = tun.vollLaden ? ', auch nach vollem Laden' : ''
    tun.bremse.stoerung(o.reihe, `Titelfenster ohne Inhalt in ${Math.round(leerFrist / 1000)} s${nachLaden}`, o.jetzt)
    tun.weiter()
    return { ...wartet, entschieden: true }
  }
  if (!erinnernJetzt && dauer <= o.frist) return wartet
  tun.bremse?.ok()
  if (erinnernJetzt) {
    /* „Erinnern" im Text kann das Billboard der Startseite sein (15.11.2026: 25 Titel, Ablauf „16.11." = dessen Termin): erst nach vollem Laden gilt es; ein Umleiter landet dort auf `/browse` (`akNetflixUmgeleitet`). */
    if (tun.vollLaden && !tun.vollLaden.versucht(o.reihe)) {
      tun.spur('Erinnern: Seite wird zur Bestätigung voll geladen', { ...dazu, seite: merkmale })
      tun.vollLaden.laden(o.reihe)
      return { ...wartet, entschieden: true }
    }
    const grund = globalThis.akNetflixErinnernGrund((o.datum ?? globalThis.erscheinungsdatum)?.())
    tun.spur(grund, { ...dazu, seite: merkmale })
    tun.uebersprungen.set(o.reihe, grund)
    tun.weiter()
    return { ...wartet, entschieden: true }
  }
  tun.spur('keine Folgenliste', { ...dazu, seite: merkmale })
  tun.uebersprungen.set(o.reihe, `keine Folgenliste in ${Math.round(o.frist / 1000)} s`)
  tun.weiter()
  return null
}

/*
  **Jeder Titel bekommt je Durchgang einen Sprung — und die Spur überlebt das Neuladen** (18.11.2026).

  Daniel, Bericht 4.32.158: „der selbe titel wird mehrmals durchgegangen" — AnoHana lud um 08:40:14 und 08:41:20 (66 s ohne Entscheidung dazwischen).
  Warum, war nicht zu lesen: `DURCHGANG_SPUR` lag im Arbeitsspeicher und ging mit jedem Neuladen verloren (der Bericht zeigte nur zwei Einträge).
  Jetzt liegt die Spur im `sessionStorage` (`akNetflixSpurMerken`/`akNetflixSpurLesen`, je Eintrag das Dokument `dok`), und ein Titel, den der
  Durchgang schon angesprungen hat, wird nicht noch einmal angesprungen, sondern mit Grund zurückgestellt (`akNetflixSprungWiederholt`).
  Eine Bremse-Pause gibt ihre Titel frei (`akNetflixGesprungenLeeren`).
*/
const SPUR_SCHLUESSEL = 'ak-netflix-spur'
const GESPRUNGEN_SCHLUESSEL = 'ak-netflix-gesprungen'
const SPUR_HOECHSTENS = 60
const SPUR_DOKUMENT = Math.random().toString(36).slice(2, 6)

/** Hängt einen Eintrag an die Spur im `sessionStorage` (die letzten `SPUR_HOECHSTENS`); ohne Speicher bleibt nur die Spur im Arbeitsspeicher. */
globalThis.akNetflixSpurMerken = (eintrag, speicher = globalThis.akNetflixSitzungSpeicher?.()) => {
  try {
    const liste = globalThis.akNetflixLaufLesen(speicher, SPUR_SCHLUESSEL)
    liste.push({ ...eintrag, dok: SPUR_DOKUMENT })
    speicher.setItem(SPUR_SCHLUESSEL, JSON.stringify(liste.slice(-SPUR_HOECHSTENS)))
  } catch (e) {
    console.info('[Anime-Kalender] Spur nicht gespeichert', String(e?.message ?? e))
  }
}

/** Die Spur des Tabs über alle Neuladungen; ohne gespeicherte Spur `rueckfall` (die Spur dieses Dokuments). */
globalThis.akNetflixSpurLesen = (rueckfall, speicher = globalThis.akNetflixSitzungSpeicher?.()) => {
  const liste = globalThis.akNetflixLaufLesen(speicher, SPUR_SCHLUESSEL)
  return liste.length ? liste : rueckfall
}

/** Merkt ein Sprungziel des Durchgangs (verschiedene Titel); `akNetflixZaehlerSetze` ruft es bei jedem Sprung. */
globalThis.akNetflixGesprungenMerken = (speicher, kennung) => {
  const liste = globalThis.akNetflixLaufLesen(speicher, GESPRUNGEN_SCHLUESSEL)
  if (kennung != null && !liste.includes(String(kennung))) globalThis.akNetflixLaufSchreiben(speicher, GESPRUNGEN_SCHLUESSEL, [...liste, String(kennung)])
}

/** Beginn eines Durchgangs und Ende einer Bremse-Pause: alle Titel dürfen wieder angesprungen werden. */
globalThis.akNetflixGesprungenLeeren = (speicher = globalThis.akNetflixSitzungSpeicher?.()) => globalThis.akNetflixLaufSchreiben(speicher, GESPRUNGEN_SCHLUESSEL, [])

/**
 * Ist `kennung` in diesem Durchgang schon angesprungen worden? Dann kein zweiter Sprung: der Titel wird zurückgestellt, der Grund steht in
 * der Endliste und in der Spur. `true` = der Aufrufer wählt den nächsten Titel.
 */
globalThis.akNetflixSprungWiederholt = (kennung, uebersprungen, spur, speicher = globalThis.akNetflixSitzungSpeicher?.()) => {
  if (!kennung || !globalThis.akNetflixLaufLesen(speicher, GESPRUNGEN_SCHLUESSEL).includes(String(kennung))) return false
  spur('Titel schon angesprungen, kein zweiter Sprung', { reihe: String(kennung) })
  /* Ein schon gemessener Titel (wartet nur auf die Übernahme) wird nicht zurückgestellt: „fertig“ nimmt ihn nur aus der Wahl. */
  const gemessen = globalThis.akNetflixLaufLesen(speicher, 'ak-netflix-fertig').includes(String(kennung))
  uebersprungen.set(String(kennung), gemessen ? 'fertig' : 'zweiter Sprung im selben Durchgang vermieden')
  return true
}

/**
 * Grund für einen Titel, der nach allen Versuchen offen blieb (Eintrag in `selbstUebersprungen`);
 * ein gerissenes Tageslimit gehört dazu, weil dann die Meldungen scheiterten, nicht der Titel.
 */
globalThis.akNetflixGrundOffen = (versuche) => {
  const limit = globalThis.AK_TAGESLIMIT?.text()
  return `nach ${versuche} Versuchen noch offen${limit ? ` (${limit})` : ''}`
}

/*
  **Netflix zeigt einen Titel nicht: der Durchgang überspringt ihn, er endet nicht daran** (03.11.2026).

  Daniel, „Ghost in the Shell" (`/title/540533`, Film): Netflix zeigte die Startseite, der Player
  meldete E103 — und der ganze Durchgang endete mit „abgebrochen · besucht 1, gemessen 0". Nur `M7…`
  meint die Wiedergabe (zu viele Streams, Netzwerk) und hält zu Recht an; jeder andere Code meint
  den Titel (`E1…`, `UI…`, `NSES-…`), und der nächste Titel hat dieses Problem nicht. Gemeldet wird
  nichts (ein Nein hat mehrere Gründe, siehe oben); der Titel steht mit Grund in der Endliste und
  bleibt einen Tag zurückgestellt.
*/
const NETFLIX_UMLEITUNG_NACH_MS = 1500
/* Wie überall bei `zuletztGeoeffnet`: ein Sprung, der länger her ist, gehört nicht mehr dem Durchgang. */
const NETFLIX_UMLEITUNG_BIS_MS = 60 * 1000

/** Stellt eine Störung im Durchlauf fest; Titel-Codes im selbsttätigen Durchgang merken sich `titelSperre`. */
globalThis.akNetflixStoerung = (durchlauf, code, o) => {
  durchlauf.stoerung = code
  durchlauf.abbruch = true
  durchlauf.titelUebersprungen = false
  durchlauf.titelSperre = durchlauf.selbst && !/^M7/.test(code) ? { code, reihe: String(o.ziel ?? o.reihe) } : null
  /* Der Vorfall geht nur raus, wo der Durchgang anhält: ein übersprungener Titel steht in der Endliste. */
  if (!durchlauf.titelSperre) {
    void o.vorfall('stoerung', { reihe: o.reihe, folge_nr: o.folge, text: `Netflix meldet ${code} — Durchlauf abgebrochen` })
  }
}

/**
 * Am Ende eines Durchlaufs: `true`, wenn der Titel übersprungen wurde und der Durchgang weitergeht.
 * UI3012 (Verbindungsfehler, am 12.11.2026 gemessen: sieben Titel in Folge) sagt etwas über die Sitzung, nicht über den Titel: er geht an die
 * `bremse` (`netflix-durchgang-steuerung.js`) statt in `uebersprungen`.
 */
globalThis.akNetflixTitelUeberspringen = (durchlauf, uebersprungen, weiter, bremse, jetzt, nichtDa = null) => {
  const sperre = durchlauf.titelSperre
  if (!sperre) return false
  durchlauf.titelSperre = null
  durchlauf.titelUebersprungen = true
  const grund = `Netflix zeigt ihn nicht (${sperre.code})`
  /* UI3012 gehört dem Titel („nicht bei Netflix") nur nach einem Umleitungs-Beleg, sonst der Sitzung (`bremse.ui3012Titel`). */
  if (bremse && sperre.code === 'UI3012' && nichtDa && bremse.ui3012Titel()) nichtDa.urteil(sperre.reihe, 'Abspielfehler UI3012')
  else if (bremse && sperre.code === 'UI3012') bremse.stoerung(sperre.reihe, grund, jetzt)
  else uebersprungen.set(sperre.reihe, grund)
  weiter()
  return true
}

/** Folge ohne Tonspur binnen der Frist: zählt nur ohne Netflix-Störung (UI3012, E103 sind „nicht da“, nicht „ohne Tonspur“; 15.11.2026). */
globalThis.akNetflixOhneSpurZaehlen = (durchlauf) => {
  if (!durchlauf.stoerung) durchlauf.ohneSpur = (durchlauf.ohneSpur ?? 0) + 1
}

/**
 * Ein Takt des Durchgangs: Hat Netflix den angesprungenen Titel auf die Startseite umgeleitet
 * (`/browse`), geht es weiter. `o`: `{ selbstAn, laeuft, pfad, ziel ({ id, zeit }), jetzt, offen }`;
 * `tun`: `{ spur, uebersprungen, weiter }`. Gibt `true` zurück, wenn er weiterging.
 */
globalThis.akNetflixUmgeleitet = (o, tun) => {
  /* Nur ein Sprung, den `selbstWeiter` selbst gemacht hat: ein alter Klick aus der Liste oder vom Einzelknopf zählt nicht. */
  if (!o.selbstAn || o.laeuft || !o.ziel?.id || !o.ziel.durchgang) return false
  if (!/^\/(?:[a-z-]+\/)?browse\b/.test(o.pfad)) return false
  const seit = o.jetzt - (o.ziel.zeit ?? 0)
  if (seit < NETFLIX_UMLEITUNG_NACH_MS || o.profilwahl) return false
  const kennung = String(o.ziel.id)
  /* Länger als eine Minute auf `/browse`: egal, ob der Titel noch auf der Liste steht — der Durchgang geht weiter. */
  if (seit > NETFLIX_UMLEITUNG_BIS_MS) return globalThis.akNetflixStillstand(kennung, tun)
  if (!o.offen || tun.uebersprungen.has(kennung)) return false
  /* Die Vorprüfung dieses Titels läuft (Frist 5 s): die Seite steht bis zu ihrem Ende auf `/browse`, das ist keine Umleitung — kein Urteil, sonst wird ein vorhandener Titel als „nicht bei Netflix“ gemeldet. */
  if (tun.nichtDa?.probt?.(kennung)) return true
  /* Hat die Vorprüfung dieses Titels das Urteil schon in der Hand (oder abgegeben), geht sie selbst weiter: ein Urteil, ein `weiter` je Titel (4071). */
  if (tun.nichtDa?.besetzt?.(kennung)) return true
  tun.spur('Netflix leitet auf die Startseite um', { reihe: kennung })
  if (tun.nichtDa) tun.nichtDa.urteil(kennung, 'Umleitung auf Startseite')
  else tun.uebersprungen.set(kennung, 'Netflix leitet auf die Startseite um')
  tun.weiter()
  return true
}

/**
 * Stillstandssicherung: Steht der eigene Sprung länger als `NETFLIX_UMLEITUNG_BIS_MS` auf `/browse`, hat ihn niemand weitergeführt (Bericht 17.11.2026:
 * Urteil gefallen, aber kein `weiter`). Ein Titel ohne Urteil wird mit Grund zurückgestellt (nie als „nicht bei Netflix“ gemeldet), dann geht es weiter.
 */
globalThis.akNetflixStillstand = (kennung, tun) => {
  tun.spur('Durchgang stand auf der Startseite still', { reihe: kennung })
  if (!tun.uebersprungen.has(kennung) && !tun.nichtDa?.besetzt?.(kennung)) tun.uebersprungen.set(kennung, 'Durchgang stand auf der Startseite still')
  tun.weiter()
  return true
}

/**
 * Fragt vor dem Sprung bei Netflix an, ob `/title/<id>` auf die Startseite umleitet (angemeldet): dann gibt es den Titel in
 * Deutschland nicht, und das Urteil liegt sofort vor — ohne Timer. Der Sprung per `pushState` zeigt nie `/browse` (gemessen
 * 15.11.2026: gut 8 s Leerlauf, dann Neuladen), erst die Antwort des Servers tut es. Alles andere (Login, Fehler, Zeitüberschreitung,
 * Profilauswahl) ist kein Urteil: `false`. `o`: `{ fetch, profilwahl, spur }`.
 */
globalThis.akNetflixUmleitungProbe = async (id, o) => {
  if (o.profilwahl()) return false
  const abbruch = new AbortController()
  const frist = setTimeout(() => abbruch.abort(), 5000)
  try {
    const r = await o.fetch(`/title/${id}`, { credentials: 'same-origin', signal: abbruch.signal })
    abbruch.abort()
    return Boolean(r.redirected) && /^\/(?:[a-z-]+\/)?browse\/?$/.test(new URL(r.url).pathname)
  } catch (e) {
    o.spur('Vorprüfung ohne Antwort', { reihe: String(id), text: String(e?.message ?? e) })
    return false
  } finally {
    clearTimeout(frist)
  }
}

/**
 * Urteil „nicht bei Netflix“ über den Meldeweg des Knopfes (`melden`, Grund in der Notiz). Gelingt die Meldung nicht (kein Token,
 * Netz), ist es kein Urteil: der Titel wird wie bisher zurückgestellt. `o`: `{ melden(id, titel, grund), titel(id), nichtDa (Map), unterwegs (Set), uebersprungen, spur }`.
 * Ein Urteil je Titel (4071): Das Merken „unterwegs“ steht vor dem Post, ein zweiter Aufruf für denselben Titel kehrt mit `false` zurück
 * (`true`: dieser Aufruf hat das Urteil geschickt und geht danach weiter). `unterwegs` liegt nur im Tab: nach einem Neuladen gilt der Titel wieder als offen.
 */
globalThis.akNetflixNichtDaUrteil = async (kennung, grund, o) => {
  const id = String(kennung)
  if (o.unterwegs.has(id) || o.nichtDa.has(id)) return false
  o.unterwegs.add(id)
  try {
    const r = await o.melden(id, o.titel(id), grund)
    o.spur(r.ok ? 'nicht bei Netflix gemeldet' : 'Meldung „nicht bei Netflix“ gescheitert', { reihe: id, grund, text: r.text })
    if (r.ok) o.nichtDa.set(id, grund)
    else o.uebersprungen.set(id, grund)
  } finally {
    o.unterwegs.delete(id)
  }
  return true
}

/**
 * Der Sprung zum nächsten Titel: erst die Vorprüfung, bei Umleitung Urteil und `weiter(1)` (Sprung zurückgegeben), sonst `gehe`.
 * `tun`: `{ aktiv, gehe, weiter, probe(id), urteil(id, grund), beleg, beurteilt?(id), besetzt?(id) }`. Hat während der Vorprüfung ein anderer Weg den Titel
 * beurteilt oder gemeldet (4071: der Takt, eine Meldung aus der Liste), folgt weder ein Sprung noch ein zweites Urteil.
 */
globalThis.akNetflixSprung = async (id, tun) => {
  const umgeleitet = await tun.probe(id)
  if (!tun.aktiv()) return
  if (tun.beurteilt?.(id)) {
    /* Ist ein Urteil unterwegs oder gefallen, geht dessen Aufrufer weiter. Sonst (anders gemeldet, übersprungen) geht dieser Sprung zurück: bliebe `zuletztGeoeffnet` auf dem Titel, hielte der Takt die Startseite für eine Umleitung. */
    /* Ist der Titel nicht mehr das Ziel, hat der Takt (Urteil gescheitert) schon weitergeführt: ein zweites `weiter` übersprünge einen Titel. */
    if (!tun.besetzt?.(id) && (tun.istZiel?.(id) ?? true)) tun.weiter(1, true, id)
    return
  }
  if (!umgeleitet) return tun.gehe(`/title/${id}`)
  tun.beleg()
  await tun.urteil(id, 'Umleitung auf Startseite')
  tun.weiter(1, true, id)
}

/**
 * Die Bausteine des Urteils für `melder.js`: `urteil(id, grund)` meldet und merkt,
 * `sprung(id)` = `akNetflixSprung` mit Vorprüfung, `besetzt(id)`: das Urteil ist unterwegs oder gefallen (der Takt geht dann nicht selbst weiter).
 * `o`: `{ melden, offeneTitel, uebersprungen, spur, gehe, weiter, aktiv, bremse, profilwahl, fetch, erledigt?(id) (laut Prüfliste nicht mehr offen), istZiel?(id) (der Titel ist noch der Sprung des Durchgangs) }`.
 */
globalThis.akNetflixNichtDaTun = (o) => {
  const ort = { melden: o.melden, titel: (id) => o.offeneTitel[id]?.titel ?? id, nichtDa: globalThis.akNetflixNichtDa(), unterwegs: new Set(), uebersprungen: o.uebersprungen, spur: o.spur }
  const urteil = (id, grund) => globalThis.akNetflixNichtDaUrteil(id, grund, ort)
  const probe = (id) => globalThis.akNetflixUmleitungProbe(id, { fetch: o.fetch, profilwahl: o.profilwahl, spur: o.spur })
  const besetzt = (id) => ort.unterwegs.has(String(id)) || ort.nichtDa.has(String(id))
  const beurteilt = (id) => besetzt(id) || o.uebersprungen.has(String(id)) || Boolean(o.erledigt?.(id))
  const probend = new Set()
  const probt = (id) => probend.has(String(id))
  const probeUeberwacht = async (id) => {
    probend.add(String(id))
    try {
      return await probe(id)
    } finally {
      probend.delete(String(id))
    }
  }
  const sprung = (id) => globalThis.akNetflixSprung(id, { probe: probeUeberwacht, urteil, beurteilt, besetzt, istZiel: o.istZiel, aktiv: o.aktiv, gehe: o.gehe, weiter: o.weiter, beleg: () => o.bremse.beleg() })
  return { urteil, sprung, besetzt, probt }
}
