/**
 * Einen Knopf einblenden, der die vorhandenen Tonspuren meldet.
 *
 * Warum das kein Scraper ist: Die Seite öffnet Daniel selbst. Diese Erweiterung
 * ruft nichts ab — sie liest, was der Player ohnehin geladen hat, und schickt es
 * erst auf einen Klick weg. `robots.txt` richtet sich an automatische Clients;
 * ein Mensch mit einer Erweiterung ist keiner. Ein Programm, das dieselben
 * Adressen von sich aus abklappert, wäre einer — und deshalb bleibt Netflix für
 * unsere Abrufe gesperrt.
 *
 * Der Ablauf (Daniels Zuschnitt, 21.08.2026): Zeile in der Prüfliste anklicken,
 * Folge öffnen, Knopf drücken, weiter zur nächsten.
 *
 * **Zwei Skripte, eine Aufgabe:** `leser.js` läuft in der Seitenwelt und kommt
 * an `window.netflix`; dieses hier läuft abgeschottet, hat dafür Token und
 * Netzzugriff. Verbunden sind sie über `window.postMessage`.
 */

/**
 * Lebt die Verbindung zur Erweiterung noch?
 *
 * Chrome trennt beim Neuladen der Erweiterung alle laufenden
 * Content-Scripts von ihr. Sie laufen weiter, aber jeder `chrome.*`-Zugriff
 * wirft „Extension context invalidated" (Daniel, 23.08.2026, mit Bild aus
 * der Fehlerkonsole). Das trifft jede offene Seite nach jedem Neuladen.
 *
 * `chrome.runtime.id` ist der zuverlässige Prüfstein: Sie verschwindet mit
 * der Verbindung.
 */
function verbindungLebt() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

/**
 * Ein Speicherzugriff, der einen toten Kontext überlebt.
 *
 * Gibt `null` zurück, statt zu werfen — der Aufrufer entscheidet, was das
 * heißt. Wichtig ist, dass die Oberfläche stehen bleibt und sagen kann, was
 * los ist, statt mitten im Aufbau abzubrechen.
 */
async function speicherLesen(schluessel) {
  if (!verbindungLebt()) return null
  try {
    return await chrome.storage.local.get(schluessel)
  } catch {
    return null
  }
}

async function speicherSchreiben(werte) {
  if (!verbindungLebt()) return false
  try {
    await chrome.storage.local.set(werte)
    return true
  } catch {
    return false
  }
}

const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

/**
 * Audiodeskription ist keine Synchronfassung.
 *
 * Netflix führt sie in derselben Liste: „Japanisch – Audiodeskription",
 * „Französisch – Audiodeskription". Das ist eine gesprochene Bildbeschreibung
 * für Blinde, keine Übersetzung. Wer sie mitzählt, hält jede Serie mit deutscher
 * Audiodeskription für synchronisiert.
 */
const IST_BESCHREIBUNG = /audiodeskription|audio description|descriptive/i

/** Deutsch in allen Schreibweisen, die die Anbieter verwenden. */
const IST_DEUTSCH = (code, name) =>
  /^de(-|$)/i.test(String(code ?? '')) || /^deutsch|^german/i.test(String(name ?? '').trim())

// --- Was die Seite gerade hergibt -------------------------------------------

let stand = { spuren: null, reihe: null, folge: null, folgeNr: null, staffel: null, staffeln: null, serientitel: null, titel: '' }
/** Reihen, die in dieser Sitzung schon gemeldet wurden. */
const gemeldet = new Set()
/** Netzfunde, die noch nicht weitergereicht wurden. */
const funde = []

/**
 * Die Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Daniel am 22.08.2026, während er eine Serie sah: „die extension stört beim
 * gucken und will ich da nicht sehen" — kurz zuvor war ein Befund zu „Heroes"
 * angekommen, einer amerikanischen Serie.
 *
 * Ohne Treffer in dieser Liste bleibt die Erweiterung vollständig still: kein
 * Knopf, keine Meldung, keine Spur auf der Seite. Das ist der Normalfall — 256
 * Titel stehen darin, Netflix führt Zehntausende.
 *
 * Die Liste liegt im Paket (`tools/extension-offene-liste.mjs` erzeugt sie),
 * nicht im Netz: Ein Abruf je Seitenaufruf wäre Last ohne Gewinn, und die
 * Erweiterung wird ohnehin neu geladen, wenn sich etwas ändert.
 */
/**
 * Die Liste liegt als eigenes Content-Script bei und setzt `AK_OFFENE_TITEL`.
 *
 * Der erste Anlauf holte sie per `fetch(chrome.runtime.getURL(…))` — und
 * scheiterte still an Netflix' Sicherheitsregeln: Die Seite lässt keine Abrufe
 * auf `chrome-extension://` zu. Die Erweiterung blieb stumm, kein Knopf, keine
 * Meldung (Daniel, 22.08.2026, mit Bild von netflix.com/browse).
 *
 * Ein Content-Script lädt der Browser dagegen selbst, bevor die Seite etwas
 * dazu sagen kann. `offene-netflix.js` steht im Manifest **vor** dieser Datei,
 * die Liste ist hier also schon da.
 */
const offeneTitel = globalThis.AK_OFFENE_TITEL ?? {}

/**
 * Was Netflix beim Prüfen über seine Staffeln gesagt hat — sofort verwendbar.
 *
 * Die mitgelieferte Liste kennt nur unsere Aufteilung, bis ein Datenlauf die
 * gemeldete übernimmt. Bis dahin standen dort falsche Kürzel: „2e01 2e12" bei
 * Forest of Piano, wo Netflix „2e13" bis „2e24" zählt — die Meldung war
 * richtig, das Zeichen blieb rosa (Daniel, 22.08.2026).
 *
 * Was der Player meldet, wird deshalb hier behalten und schlägt die
 * mitgelieferte Angabe. Wirksam ab der ersten geprüften Folge, ohne Neuladen.
 */
let anbieterStaffeln = {}

/** Die Staffeln eines Titels — was der Anbieter sagte, sonst was wir wissen. */
function staffelnVon(id, eintrag) {
  const gemeldet = anbieterStaffeln[String(id)]
  if (!gemeldet?.length) return eintrag.staffeln
  /**
   * Die Anbieterzählung übernehmen, den Offen-Status behalten.
   *
   * Der Anbieter sagt, **wie** er teilt — was wir schon geprüft haben, steht
   * nur in unserer Liste. Reicht sie nicht so weit, gilt die Staffel als offen.
   */
  return gemeldet.map((s, i) => ({
    nr: s.seq,
    name: s.name || `Staffel ${s.seq}`,
    folgen: s.folgen,
    erste: s.erste ?? 1,
    // `film` kann aus der Meldung kommen (Netflix nannte weder Staffel noch
    // Folge) oder aus unserem Datensatz.
    film: s.film ?? eintrag.staffeln[i]?.film ?? false,
    offen: eintrag.staffeln[i]?.offen ?? true,
  }))
}

/**
 * Welche Kürzel gehören zu diesen Folgennummern?
 *
 * Der Worker führt die Meldungen als blanke Folgennummern — 1089, 1124, 1156.
 * Der Dialog denkt in Staffelkürzeln („39e1124"). Übersetzt wird über die
 * Staffelgrenzen der Prüfliste, denn nur die kennen jede Staffel; was Netflix
 * gerade geladen hat, ist immer nur eine davon.
 */
function kuerzelFuerNummern(staffeln, nummern) {
  const raus = []
  for (const nummer of nummern) {
    const staffel = staffeln.find(
      (st) => nummer >= (st.erste ?? 1) && nummer < (st.erste ?? 1) + (st.folgen ?? 0),
    )
    if (!staffel) continue
    raus.push(`${staffel.nr}e${String(nummer).padStart(2, "0")}`)
  }
  return raus
}

/**
 * Wann übernimmt der nächste Lauf die Meldungen?
 *
 * `refresh-hourly.yml` läuft zur Minute 23 jeder Stunde und ruft dort
 * `data:pruefungen` auf — das ist der Schritt, der den Briefkasten leert und
 * die Meldungen in den Datensatz schreibt. Danach sind die Titel aus der
 * Prüfliste verschwunden, und genau daran lässt sich ablesen, ob der Lauf
 * seine Arbeit getan hat (Daniel, 26.08.2026).
 *
 * GitHub startet geplante Läufe regelmäßig einige Minuten später als
 * eingetragen; die Zeile sagt deshalb „ab", nicht „um".
 */
function naechsteUebernahme(jetzt = new Date()) {
  const ziel = new Date(jetzt)
  ziel.setSeconds(0, 0)
  ziel.setMinutes(23)
  if (ziel <= jetzt) ziel.setTime(ziel.getTime() + 3600000)
  return ziel
}/**
 * Was zuletzt aus der Liste heraus geöffnet wurde — für zehn Minuten.
 *
 * Der Tab, in dem geklickt wurde, hinterlegt es; `chrome.storage.local` teilen
 * alle Tabs.
 */
let zuletztGeoeffnet = null

/**
 * Steht dieser Titel auf der Liste?
 *
 * **Auch dann, wenn Netflix eine andere Kennung nennt als wir führen.** Bei
 * „Ranma1/2" blieb die Erweiterung stumm: Der Player meldete eine Kennung, die
 * in unserer Liste nicht vorkommt, also galt der Titel als nicht gesucht — und
 * vier Prüfungen gingen verloren, ohne dass irgendwo etwas stand (Daniel,
 * 22.08.2026: „alle gemeldet, alle bleiben weiß").
 *
 * Wer aus der Liste heraus geklickt hat, meint den Titel, den er angeklickt
 * hat. Das zählt.
 */
/**
 * Welche Kennung gemeint ist — unsere, wenn Netflix eine fremde nennt.
 *
 * Kennt die Liste die Kennung des Players, ist sie es. Sonst gilt, was zuletzt
 * aus der Liste heraus geöffnet wurde.
 */
/** Zwei Titel auf ihren Kern bringen, um sie vergleichen zu können. */
function namensKern(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Trägt die geöffnete Zeile denselben Namen wie das, was gerade läuft?
 *
 * **Diese Prüfung ist der Unterschied zwischen Hilfe und Schaden.** Ohne sie
 * galt jeder Titel als gesucht, solange irgendwann in den letzten zehn Minuten
 * aus der Liste geklickt worden war — und Daniel bekam eine Meldung zu
 * „Heroes" untergeschoben, während er die Serie einfach ansah (22.08.2026,
 * zum zweiten Mal an diesem Tag).
 *
 * Verglichen werden die Namen ohne Sonder- und Leerzeichen, und es genügt,
 * wenn einer im anderen steckt: Netflix nennt „Ranma1/2 (2024)", unsere Liste
 * „Ranma1/2 (2024)" — aber auch „HAIKYU!!" gegen „Haikyu!! To The Top" soll
 * passen.
 */
function nameStimmt() {
  const eintrag = zuletztGeoeffnet?.id ? offeneTitel[zuletztGeoeffnet.id] : null
  if (!eintrag) return false
  const laufend = namensKern(stand.serientitel || stand.titel)
  const gemeint = namensKern(eintrag.titel)
  if (!laufend || !gemeint) return false
  return laufend.includes(gemeint) || gemeint.includes(laufend)
}

/**
 * Welche Kennung gemeint ist — unsere, wenn Netflix eine fremde nennt.
 *
 * Kennt die Liste die Kennung des Players, ist sie es. Sonst gilt, was zuletzt
 * aus der Liste heraus geöffnet wurde — **aber nur, wenn der Name dazu passt**
 * und der Klick nicht länger als fünf Minuten her ist.
 */
/**
 * **Eine Weiterleitung binnen einer Minute gehört noch zum Klick.**
 *
 * „Pokémon: Blauer Himmel in der Ferne!" liegt bei uns unter `81670593`; wer
 * dort klickt, landet auf `81706101` — „Pokémon: Ultimative Reisen: Die Serie".
 * Das sah nach einem falschen Titel aus, ist aber richtig: Der Titel ist Folge
 * 46a und wird international als Abschluss der 25. Staffel geführt, und genau
 * diese Teilstaffel nennt Netflix im deutschsprachigen Raum so
 * (fernsehserien.de, PokéWiki, 30.08.2026 nachgeschlagen).
 *
 * `nameStimmt()` kann das nicht erkennen — die Namen sind verschieden, und das
 * ist bei einer Folge innerhalb einer Reihe der Normalfall. Dasselbe Problem
 * war bei Disney+ schon gelöst (CLAUDE.md, 26.08.2026): Wer aus der Prüfliste
 * heraus öffnet, hinterlegt, welcher Titel gemeint war, und die Zielseite erbt
 * ihn.
 *
 * **Eine Minute statt fünf**, und nur bei einer *anderen* Kennung: Eine
 * Weiterleitung passiert im selben Atemzug wie der Klick. Was Daniel danach
 * selbst ansteuert, ist keine mehr.
 */
function ausWeiterleitung() {
  try {
    /* Einmal erkannt, gilt sie weiter — auch nach einem Reload. */
    const gemerkt = netflixWeiterleitungen[String(stand.reihe)]
    if (gemerkt && offeneTitel[String(gemerkt)] !== undefined) return true
    const frisch = Boolean(
      zuletztGeoeffnet?.id &&
        offeneTitel[zuletztGeoeffnet.id] !== undefined &&
        String(zuletztGeoeffnet.id) !== String(stand.reihe) &&
        Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000,
    )
    if (frisch && stand.reihe) {
      netflixWeiterleitungen = { ...netflixWeiterleitungen, [String(stand.reihe)]: String(zuletztGeoeffnet.id) }
      void chrome.storage.local.set({ netflixWeiterleitungen })
    }
    return frisch
  } catch {
    return false
  }
}

function gemeinteReihe() {
  if (stand.reihe && offeneTitel[String(stand.reihe)] !== undefined) return stand.reihe
  /* Eine gemerkte Weiterleitung gilt ohne Frist — sie ändert sich nicht. */
  try {
    const gemerkt = netflixWeiterleitungen[String(stand.reihe)]
    if (gemerkt && offeneTitel[String(gemerkt)] !== undefined) return gemerkt
  } catch {
    /* Vor dem Laden des Speichers gilt der Weg darunter. */
  }
  if (
    zuletztGeoeffnet?.id &&
    offeneTitel[zuletztGeoeffnet.id] !== undefined &&
    Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 5 * 60 * 1000 &&
    (nameStimmt() || ausWeiterleitung())
  ) {
    return zuletztGeoeffnet.id
  }
  return stand.reihe
}

function istGesucht() {
  if (stand.reihe && offeneTitel[String(stand.reihe)] !== undefined) return true
  return Boolean(
    zuletztGeoeffnet?.id &&
      offeneTitel[zuletztGeoeffnet.id] !== undefined &&
      Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 5 * 60 * 1000 &&
      (nameStimmt() || ausWeiterleitung()),
  )
}

window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.marke === 'ak-folgenliste') {
    /*
      Die Liste gilt für eine Reihe. Passt sie nicht zur Seite, gehört sie
      nicht hierher — beim Wechsel von One Piece zu Kakegurui stand sonst „61
      Folgen prüfen" auf einer Seite mit zwölf.
    */
    const hier = String(gemeinteReihe() ?? '')
    DURCHLAUF.folgen =
      e.data.fuerReihe && hier && String(e.data.fuerReihe) !== hier
        ? []
        : Array.isArray(e.data.folgen)
          ? e.data.folgen
          : []
    void durchlaufStandLaden(gemeinteReihe()).then(durchlaufKnopfZeigen)
    durchlaufKnopfZeigen()
    return
  }
  if (e.source !== window) return
  if (e.data?.marke === 'ak-spuren') {
    stand = {
      spuren: e.data.spuren,
      reihe: e.data.reihe,
      folge: e.data.folge,
      folgeNr: e.data.folge_nr ?? e.data.folgeNr ?? null,
      staffel: e.data.staffel ?? null,
      staffeln: e.data.staffeln ?? null,
      serientitel: e.data.serientitel ?? null,
      titel: e.data.titel,
    }
    /*
      **Beide Fälle zeichnet `knopfZeigen()` selbst — hier wird nichts mehr
      entfernt.**

      Bis 3.107 stand hier ein eigenes `knopfEntfernen()` für Titel, die nicht
      auf der Liste stehen. Seit `knopfZeigen()` dort „Steht nicht auf der
      Prüfliste" zeigt, sind das zwei Stellen mit gegensätzlicher Regel: Der
      Sekundentakt baute den Knopf, die nächste Leser-Nachricht riss ihn wieder
      ab. Ergebnis war ein Blinken im Sekundenrhythmus (Daniel, 30.08.2026: „der
      button blinkt, er ist sichtbar für <1sek und nach paar sekunden kommt er
      wieder").

      Der ursprüngliche Zweck bleibt erfüllt — `knopfZeigen()` zeichnet den
      Zustand der **aktuellen** Seite, und ein Knopf des vorigen Titels
      überlebt das nicht.
    */
    knopfZeigen()
    /*
      Die automatische Meldung beim Abspielen ist seit dem 26.08.2026 aus.
      Gemeldet wird nur noch über den Durchlauf oder von Hand — dann ist immer
      klar, woher eine Meldung stammt.
    */
    // vielleichtSenden()
    return
  }
  if (e.data?.marke === 'ak-netzfund') {
    funde.push(e.data)
    void fundSchicken(e.data)
  }
})

/**
 * Was Netflix im Hintergrund lädt, einmal je Adresse an den Kalender melden.
 *
 * Der Zweck ist eine einzige Frage: Steht in diesen Antworten schon, welche
 * Sprachen eine Reihe hat? Wenn ja, erspart das die Handarbeit — dann liest die
 * Erweiterung beim Öffnen mit, statt dass jemand jede Folge startet.
 * Geschickt werden nur Feldnamen und kurze Fundstellen, nicht die Antwort.
 */
async function fundSchicken(fund) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return
  try {
    await fetch(WORKER.replace('/pruefung', '/netzfund'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify(fund),
    })
  } catch {
    /* Ein Fundbericht darf nie im Weg stehen. */
  }
}

/**
 * Von selbst melden, sobald alles beisammen ist.
 *
 * Daniels Zuschnitt (22.08.2026): „sobald daten gesammelt, soll die extension
 * die daten abschicken … so beschränkt sich mein manueller aufwand auf link
 * anklicken -> episode auswählen und warten."
 *
 * Beisammen heißt: eine Reihe aus Netflix' Metadaten **und** eine Tonspurliste
 * aus dem Abspieler. Beides trifft ein paar Sekunden nach dem Start ein; bis
 * dahin sagt der Knopf, worauf er wartet.
 *
 * Je Folge wird genau einmal gesendet. Der Schlüssel ist Reihe plus
 * Folgennummer — wer dieselbe Folge noch einmal öffnet, löst nichts aus, wer
 * zur nächsten springt, schon.
 */
const gesendet = new Map()

/**
 * Was eine Meldung eindeutig macht — Reihe, **Staffel** und Folge.
 *
 * Ohne die Staffel trugen Staffel 3 Folge 1 und Staffel 4 Folge 1 denselben
 * Schlüssel. Die zweite galt damit als längst gesendet und ging nie raus,
 * während der Knopf den Erfolgstext der ersten weiterzeigte: „Deutsch gesendet
 * (St. 4, Flg. 1)" stand da, im Briefkasten lag nur Staffel 3 (Daniel,
 * 22.08.2026, mit Bild).
 *
 * Das ist die schlimmste Sorte Fehler: Er meldet Erfolg und tut nichts.
 */
function schluessel() {
  return `${stand.reihe}:${stand.staffel ?? '—'}:${stand.folgeNr ?? '—'}`
}

function vielleichtSenden() {
  if (!stand.reihe || !stand.spuren) return
  const k = schluessel()
  if (gesendet.has(k)) return
  gesendet.set(k, 'unterwegs')
  void melden({ automatisch: true })
}

// --- Knopf ------------------------------------------------------------------

let knopf = null

function urteil(spuren) {
  const echte = spuren.filter((s) => !IST_BESCHREIBUNG.test(s.name))
  const deutsch = echte.some((s) => IST_DEUTSCH(s.code, s.name))
  return { deutsch, echte }
}

/**
 * Was der Knopf anbietet, hängt davon ab, wo er steht.
 *
 * Drei Lagen, und die mittlere hat gefehlt:
 *
 * 1. **Im Player, Tonspuren gelesen** — melden, was dasteht.
 * 2. **Auf der Titelseite mit Folgen** — hier gibt es nichts zu lesen. Der
 *    Knopf sagt, was zu tun ist, und bleibt untätig. Vorher bot er „als nicht
 *    abrufbar melden" an, und das ist bei einer Reihe mit 24 Folgen schlicht
 *    falsch (Daniel, 22.08.2026, bei „Die Tagebücher der Apothekerin").
 * 3. **Auf einer Titelseite ohne Folgen** — erkennbar an „Erinnern": Netflix
 *    bietet dort nur an, zu benachrichtigen. Das ist ein Befund, und nur dann
 *    ist die Meldung „nicht abrufbar" richtig.
 *
 * Der Abspielknopf taugt nicht als Unterscheidung: Auf Netflix liegt die
 * Titelkarte als Überlagerung über der Startseite, und deren Abspielknopf zählt
 * mit — daran ist die erste Fassung gescheitert.
 */
function keineFolgeVorhanden() {
  const text = document.body.innerText || ''
  return /\bErinnern\b|\bRemind me\b/.test(text)
}

/**
 * Was der Knopf anzeigt — er meldet inzwischen von selbst.
 *
 * Vier Lagen, und keine davon verlangt noch einen Klick, solange alles läuft:
 *
 * 1. **Schon gesendet** — das Ergebnis steht da, damit sichtbar ist, was ankam.
 * 2. **Im Player, Tonspuren gelesen** — wird gerade geschickt.
 * 3. **Titelseite mit Folgen** — hier gibt es nichts zu lesen; der Knopf sagt,
 *    was zu tun ist.
 * 4. **Titelseite ohne Folgen** — erkennbar an „Erinnern". Das ist ein Befund,
 *    und den meldet ein Klick, weil hier nichts von selbst eintrifft.
 */
function beschriftung(spuren) {
  if (!stand.reihe) {
    return { text: 'Über die Titelseite öffnen — sonst fehlt die Reihe', klasse: 'ak-leer', aktiv: false }
  }
  const stand_ = gesendet.get(schluessel())
  if (stand_ && stand_ !== 'unterwegs') {
    const wo = stand.folgeNr ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})` : ''
    return {
      text: stand_ === 'deutsch' ? `Deutsch gesendet${wo} ✓` : `Kein Deutsch gesendet${wo} ✓`,
      klasse: stand_ === 'deutsch' ? 'ak-ja' : 'ak-nein',
      aktiv: false,
    }
  }
  if (!spuren) {
    /**
     * **Schon als tot gemeldet — dann steht das da, kein Knopf.**
     *
     * Daniel am 26.08.2026: „ich hab es 2x gemeldet, ich kann weiterhin melden,
     * warum? da sollte bereits gemeldet oder so stehen."
     *
     * `gesendet` ist eine Map im Speicher der Seite; ein Neuladen leert sie,
     * und der Knopf lud wieder zum Melden ein. Der Vermerk `tot` liegt dagegen
     * im dauerhaften Speicher und überlebt den Reload — er wird jetzt gelesen.
     *
     * Die zweite Meldung war deshalb nicht folgenlos, sondern schlimmer:
     * Sie überschrieb im Briefkasten die erste, und die Zahl in der
     * Statusanzeige rührte sich nicht („ich reporte, reloade, steht weiterhin
     * 10").
     */
    if (istErledigt(gemeinteReihe(), 'tot')) {
      return { text: 'Als nicht abrufbar gemeldet ✓', klasse: 'ak-nein', aktiv: false }
    }
    if (keineFolgeVorhanden()) {
      // Nennt die Seite einen Termin, gehoert er an den Knopf — dann sieht
      // man vor dem Klick, was gemeldet wird.
      const termin = erscheinungsdatum()
      return {
        text: termin
          ? `Noch nicht da — „ab ${termin}" melden`
          : 'Keine Folge da — als nicht abrufbar melden',
        klasse: 'ak-nein',
        aktiv: true,
      }
    }
    /*
      **Kein Hinweis mehr auf die alte Automatik.**

      Daniel am 26.08.2026: „button entfernen, hier läuft es nicht von selbst,
      soll es zumindest nicht, automatische prüfung bei play auch entfernen, es
      soll nur noch mit der neuen logik funktionieren."

      Der Durchlauf über den Knopf ist der Weg. Ein zweiter, der beim Abspielen
      von selbst meldet, macht die Herkunft einer Meldung unklar — und war der
      Grund, warum bei einem Titelwechsel fremde Sprachen ankamen.
    */
    /*
      **Ohne Tonspur gibt es nichts zu melden — aber der Knopf sagt jetzt, wie
      man dahin kommt.**

      Bis zum 26.08.2026 stand hier „Auf Abspielen klicken, dann läuft es von
      selbst", und das war nach dem Abschalten der Automatik falsch: Es lief
      nichts von selbst. Der Hinweis wurde ersatzlos gestrichen — und damit
      verschwand der Knopf auf der Titelseite ganz.

      Für einen **Film** ist das die einzige Stelle, an der jemand steht: Es gibt
      keine Folgenliste, aus der heraus man in den Player käme. Daniel am
      30.08.2026 an „Gintama the Movie 2026" und „Pokémon: Blauer Himmel in der
      Ferne!": „beide titel lassen sich immer noch nicht melden."

      Der neue Text verspricht keine Automatik, er nennt den Weg: Netflix gibt
      seine Tonspuren nur an einer laufenden Wiedergabe heraus (viermal
      gemessen, siehe CLAUDE.md), also muss abgespielt werden. Gemeldet wird
      danach weiterhin von Hand, über diesen Knopf.
    */
    return { text: null, klasse: null, aktiv: false }
  }
  const { deutsch } = urteil(spuren)
  const wo = stand.folgeNr
    ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})`
    : ''
  /*
    **Im Player wird nichts mehr angeboten.**

    Bis zum 26.08.2026 stand hier „Deutsche Tonspur (St. 1, Flg. 1) — wird
    gesendet …" — und das war nach dem Abschalten der Automatik eine
    Falschaussage: Es wurde nichts gesendet. Daniel mit Bild: „das wird
    automatisch bei abspielen von ep 1 eingeblendet, ich hab gesagt diesen
    automatismus raus, nur wenn man es über den button neben limit button macht
    soll es klappen."

    Gemeldet wird über den Durchlauf auf der Titelseite. Ein zweiter Weg im
    Player macht die Herkunft einer Meldung unklar — und war der Grund, warum
    bei einem Titelwechsel einmal fremde Sprachen ankamen.
  */
  void deutsch
  return { text: null, klasse: null, aktiv: false }
}

async function melden({ automatisch = false } = {}) {
  const spuren = stand.spuren
  const ohneFolge = !spuren && keineFolgeVorhanden()
  if (!stand.reihe) return zeigeErgebnis('Kein Titel erkannt — Titelseite öffnen', false)
  if (!spuren && !ohneFolge) return zeigeErgebnis('Erst auf Abspielen klicken', false)

  const { deutsch, echte } = spuren ? urteil(spuren) : { deutsch: false, echte: [] }
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return zeigeErgebnis('Kein Token — Rechtsklick aufs Symbol, dann Optionen', false)

  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        /**
         * Die Titelseite, nicht die Abspieladresse — danach sucht die Pipeline.
         *
         * **Und die Kennung, unter der wir den Titel führen**, wenn Netflix eine
         * andere nennt: Bei „Ranma1/2" meldete der Player eine Kennung, die
         * unser Datensatz nicht kennt. Die Meldung wäre angekommen und hätte
         * niemandem gehört. Wer aus der Liste heraus geklickt hat, meint den
         * Titel, den er angeklickt hat.
         */
        url: `https://www.netflix.com/title/${gemeinteReihe()}`,
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: ohneFolge ? 'weg' : deutsch ? 'dub' : 'kein_dub',
        titel: (stand.titel || '').replace(/\s*-\s*Netflix\s*$/i, '').trim() || null,
        // Die laufende Folge als Beleg, nie als Ersatz fuer die Reihe.
        folge: stand.folge,
        // Die Nummer der laufenden Folge — daraus leitet die Pipeline ab, für
        // welchen Bereich die Auskunft gilt.
        folge_nr: stand.folgeNr,
        staffel: stand.staffel,
        // Wie die Reihe beim Anbieter aufgeteilt ist: je Staffel die Zahl der
        // Folgen. Damit lässt sich eine Meldung später einer unserer Staffeln
        // zuordnen, auch wenn der Anbieter anders einteilt.
        staffeln: stand.staffeln,
        serientitel: stand.serientitel,
        /**
         * Der Termin, den Netflix selbst nennt.
         *
         * Steht bei kuenftigen Titeln ueber der Beschreibung, neben dem
         * Erinnern-Knopf. Ohne Jahr: Netflix nennt nur Tag und Monat, weil
         * ein solcher Termin immer voraus liegt.
         */
        erscheint: ohneFolge ? erscheinungsdatum() : undefined,
        notiz: ohneFolge
          ? erscheinungsdatum()
            ? `Noch nicht abrufbar — Netflix nennt „${erscheinungsdatum()}"`
            : 'Titelseite ohne abspielbare Folge — nur „Erinnern"'
          : `${echte.length} Tonspuren, ${spuren.length - echte.length} Audiodeskriptionen`,
      }),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) {
      gesendet.delete(schluessel())
      return zeigeErgebnis(daten.error ?? `Fehler ${antwort.status}`, false)
    }
    gemeldet.add(stand.reihe)
    // Für die Übersicht: Diese Folge ist durch. Kein Beleg — der steht im
    // Datensatz —, sondern eine Gedächtnisstütze beim Abarbeiten.
    /**
     * Eine „keine Folge abrufbar"-Meldung trägt keine Folgennummer.
     *
     * Sie fiel deshalb durch `merkeErledigt`, das eine Folge verlangt — Daniel
     * meldete Batman Ninja von der Übersichtsseite und sah den Eintrag
     * unverändert weiß (22.08.2026). Vermerkt wird jetzt dasselbe wie beim
     * Tot-Knopf der Liste: Der Verweis führt zu nichts Abspielbarem.
     */
    if (ohneFolge) void merkeTot(gemeinteReihe())
    else void merkeErledigt(gemeinteReihe(), stand.staffel, stand.folgeNr)
    // Was Netflix über seine Staffeln sagt, gilt ab sofort — nicht erst nach
    // dem nächsten Datenlauf.
    // Unter **unserer** Kennung ablegen, nicht unter Netflix'. Sonst sucht die
    // Liste vergeblich: Bei „Ranma1/2" nennt der Player eine andere, und die
    // Kürzel blieben in unserer Zählung stehen (2e01 statt 2e13).
    const reihe = gemeinteReihe()
    if (stand.staffeln?.length && reihe) {
      anbieterStaffeln[String(reihe)] = stand.staffeln
      void speicherSchreiben({ anbieterStaffeln })
    } else if (reihe && !stand.staffeln && !stand.folgeNr && spuren) {
      /**
       * Weder Staffelliste noch Folgennummer, aber Tonspuren — das ist ein Film.
       *
       * „Pokémon: The Arceus Chronicles" führen wir als Serie mit vier Folgen;
       * bei Netflix ist es ein Film von einer Stunde, und die Liste schickte
       * Daniel zu „1e04", die es dort nicht gibt (22.08.2026). Der Player
       * schweigt in genau diesem Fall zu Staffeln **und** Folgen — daraus lässt
       * sich die Sache ablesen, ohne dass jemand sie melden muss.
       */
      anbieterStaffeln[String(reihe)] = [{ seq: 1, name: 'Film', folgen: 1, erste: 1, film: true }]
      void speicherSchreiben({ anbieterStaffeln })
    }
    gesendet.set(schluessel(), deutsch ? 'deutsch' : 'kein_deutsch')
    /* Die Meldung liegt jetzt im Briefkasten — die Zahl am Knopf muss fallen. */
    void standHolen()
    const kopf = ohneFolge ? 'Als nicht abrufbar gemeldet' : deutsch ? 'Deutsche Tonspur gemeldet' : 'Kein Deutsch gemeldet'
    zeigeErgebnis(kopf, true)
  } catch (err) {
    gesendet.delete(schluessel())
    zeigeErgebnis(`Nicht erreichbar: ${err.message}`, false)
  }
}

function zeigeErgebnis(text, gutgegangen) {
  if (!knopf) return
  knopf.textContent = text
  knopf.classList.add(gutgegangen ? 'ak-erfolg' : 'ak-fehler')
  clearTimeout(zurueckstellen)
  /**
   * Danach den **jetzigen** Zustand zeigen, nicht den gemerkten alten.
   *
   * Vorher hielt diese Funktion den Text fest, der beim Melden dastand, und
   * setzte ihn dreieinhalb Sekunden später zurück — inzwischen hatte der Nutzer
   * aber längst die Folge gewechselt, und der Knopf log für die nächste Runde.
   */
  zurueckstellen = setTimeout(() => {
    knopf?.classList.remove('ak-erfolg', 'ak-fehler')
    knopfZeigen()
  }, 2000)
}
let zurueckstellen = null

function knopfEntfernen() {
  if (knopf) {
    knopf.remove()
    knopf = null
  }
}

function knopfZeigen() {
  const { spuren, reihe } = stand
  // Zweite Sicherung an der Stelle, die tatsächlich in die Seite schreibt: Wer
  // hier ankommt, ohne dass der Titel gesucht ist, hat einen Weg gefunden, den
  // niemand vorgesehen hat.
  /*
    **Ein Titel, der nicht auf der Liste steht, sagt das — statt zu schweigen.**

    Daniel am 30.08.2026 an „Pokémon: Blauer Himmel in der Ferne!": Der
    Listen-Eintrag führt `81670593`, geöffnet war `81706101` — eine andere
    Pokémon-Reihe. Die Erweiterung entfernte ihren Knopf, und damit stand er
    auf einer Seite, die von außen genauso aussieht wie eine richtige, ohne
    jede Auskunft: „lässt sich nicht melden".

    Ein Hinweis kostet nichts und beantwortet die Frage sofort. Ganz weg bleibt
    der Knopf nur, wo ohnehin niemand meldet — auf der Startseite und überall,
    wo keine Titelkennung in der Adresse steht.
  */
  if (!istGesucht()) {
    const aufTitelseite = /^\/(title|watch)\/\d+/.test(location.pathname)
    if (!aufTitelseite) {
      knopfEntfernen()
      return
    }
    if (!knopf) {
      knopf = document.createElement('button')
      knopf.className = 'ak-melder'
      knopf.addEventListener('click', melden)
      document.body.appendChild(knopf)
    }
    knopf.hidden = false
    knopf.disabled = true
    knopf.className = 'ak-melder ak-leer'
    /*
      **Netflix leitet um — und dann sah es aus, als hätte Daniel falsch
      geklickt.**

      Der Bericht vom 30.08.2026 zeigt beides nebeneinander: `zuletztGeoeffnet`
      steht auf `81670593` (dem Auftrag aus der Liste), die Adresse auf
      `81706101` — einer anderen Pokémon-Reihe. Der Klick war also richtig, die
      Weiterleitung kam von Netflix. Dazu `stoerung: "M7355"`, Netflix' Code für
      „nicht verfügbar".

      Ein „Steht nicht auf der Prüfliste" beschreibt zwar die Lage, gibt aber
      dem Falschen die Schuld. Wo der Auftrag bekannt ist, sagt der Knopf, was
      wirklich passiert ist.
    */
    const kamAusListe = (() => {
      try {
        return Boolean(
          zuletztGeoeffnet?.id &&
            offeneTitel[zuletztGeoeffnet.id] !== undefined &&
            String(zuletztGeoeffnet.id) !== String(stand.reihe) &&
            Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 5 * 60 * 1000,
        )
      } catch {
        return false
      }
    })()
    knopf.textContent = kamAusListe ? 'Weitergeleitet — Auftrag abgelaufen' : 'Steht nicht auf der Prüfliste'
    knopf.title = kamAusListe
      ? `Geöffnet war „${offeneTitel[zuletztGeoeffnet.id]?.titel ?? zuletztGeoeffnet.id}", und Netflix hat ` +
        'auf eine andere Kennung geleitet — das ist oft richtig, wenn der Titel eine Folge innerhalb ' +
        'einer Reihe ist. Erkannt wird das nur in der ersten Minute nach dem Klick; danach über den ' +
        'Link in der Liste neu öffnen.'
      : 'Zu dieser Netflix-Kennung gibt es keinen offenen Auftrag. Häufigster Grund: ' +
        'Der Titel aus der Liste liegt unter einer anderen Kennung — dann über den Link in der Liste öffnen.'
    return
  }
  if (!reihe && !spuren) {
    knopfEntfernen()
    return
  }
  if (!knopf) {
    knopf = document.createElement('button')
    knopf.className = 'ak-melder'
    knopf.addEventListener('click', melden)
    document.body.appendChild(knopf)
  }
  const { text, klasse, aktiv } = beschriftung(spuren)
  /*
    **Ohne Text kein Knopf.**

    Seit dem 26.08.2026 gibt es den Hinweis „Auf Abspielen klicken, dann läuft
    es von selbst" nicht mehr — er beschrieb eine Automatik, die abgeschaltet
    ist. Ein leerer Knopf an ihrer Stelle wäre schlimmer als keiner: Er sähe
    aus, als ließe sich etwas anklicken.
  */
  knopf.hidden = !text
  if (!text) return
  knopf.hidden = false
  knopf.disabled = !aktiv
  if (!knopf.classList.contains('ak-erfolg') && !knopf.classList.contains('ak-fehler')) {
    knopf.textContent = text
    knopf.classList.remove('ak-ja', 'ak-nein', 'ak-leer')
    knopf.classList.add(klasse)
  }
}

// --- Die Übersicht: was noch zu prüfen ist -----------------------------------

/**
 * Ein zweiter Knopf, der nur **außerhalb** des Players erscheint.
 *
 * Daniels Wunsch vom 22.08.2026: Beim Fernsehen soll nichts stören, aber auf
 * den Übersichts- und Stöberseiten will er sehen, wie viel noch offen ist —
 * und von dort direkt losarbeiten können, statt eine Liste in einer Datei zu
 * suchen.
 *
 * Die Trennung läuft über die Adresse: `/watch/` heißt, der Player läuft.
 */
/**
 * Der Termin, den Netflix auf einer noch nicht abrufbaren Titelseite nennt.
 *
 * Gemessen am 23.08.2026 an "Mononoke – The Movie: Chapter III": ueber der
 * Beschreibung steht "Ab 29. September", daneben "Erinnern". Das Jahr fehlt —
 * Netflix nennt nur Tag und Monat, weil ein solcher Termin immer voraus liegt.
 *
 * **Gelesen wird der sichtbare Text, nicht geraten.** Was hier herauskommt,
 * geht unveraendert in die Meldung; das Jahr abzuleiten ist Sache der
 * Pipeline, die weiss, welcher Tag heute ist.
 */
function erscheinungsdatum() {
  const text = document.body?.innerText ?? ''
  // Ab 29. September / Ab 3. Oktober 2026
  const treffer = /\bAb\s+(\d{1,2}\.\s*[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]+(?:\s+\d{4})?)/.exec(text)
  return treffer ? treffer[1].replace(/\s+/g, ' ').trim() : null
}

function imPlayer() {
  return location.pathname.startsWith('/watch/')
}

/** Was diese Installation schon gemeldet hat — überlebt einen Neustart. */
let erledigt = {}
/**
 * **Erkannte Weiterleitungen, dauerhaft.**
 *
 * `{ Zielkennung: Auftragskennung }` — bei „Pokémon: Blauer Himmel in der
 * Ferne!" also `{ '81706101': '81670593' }`.
 *
 * Die Erkennung über `zuletztGeoeffnet` gilt nur eine Minute; nach einem Reload
 * stand deshalb wieder „Steht nicht auf der Prüfliste" auf einer Seite, die
 * eine Minute vorher noch richtig zugeordnet war (Daniel, 30.08.2026, mit zwei
 * Bildern). Eine Weiterleitung ändert sich aber nicht — was einmal erkannt
 * wurde, gilt weiter.
 *
 * Dasselbe Vorgehen wie bei Disney+ (CLAUDE.md, 26.08.2026), nur haltbar
 * gemacht: Dort erbt die Zielseite den Auftrag über den Klick, hier zusätzlich
 * über das Gedächtnis.
 */
let netflixWeiterleitungen = {}
const erledigtGeladen = chrome.storage.local
  .get(['erledigt', 'anbieterStaffeln', 'zuletztGeoeffnet', 'netflixWeiterleitungen'])
  .then((x) => {
    erledigt = x.erledigt ?? {}
    anbieterStaffeln = x.anbieterStaffeln ?? {}
    zuletztGeoeffnet = x.zuletztGeoeffnet ?? null
    netflixWeiterleitungen = x.netflixWeiterleitungen ?? {}
  })
  .catch(() => {
    erledigt = {}
  })

/** Eine Folge in Daniels Kurzform: Staffel, `e`, zweistellige Folge. */
function folgenKuerzel(staffel, folge) {
  return `${staffel}e${String(folge).padStart(2, '0')}`
}

/**
 * Welche Folgen einer Adresse sich lohnen.
 *
 * **Erste und letzte je Staffel.** Sind beide gleich, ist die Staffel
 * einheitlich; weichen sie ab, liegt die Grenze dazwischen — bei Black Clover
 * nach Folge 155, bei My Hero Academia in Staffel 7. Eine Staffel mit einer
 * einzigen Folge braucht nur einen Eintrag.
 */
function empfohleneFolgen(eintrag) {
  const raus = []
  for (const s of eintrag.staffeln) {
    if (!s.offen) continue
    // Ein Film hat keine Folgen — „1e01" wäre dort eine Anweisung ins Leere
    // (Daniel, 22.08.2026: „filme in der liste werden als 1e01 gemeldet,
    // obwohl es filme und keine serien sind").
    //
    // **Nur das Format entscheidet, nicht die Folgenzahl.** „ONE PIECE" läuft
    // noch und hat bei AniList gar keine — in der Liste stand `folgen: 0`, und
    // die alte Bedingung „höchstens eine Folge" machte daraus einen Film
    // (Daniel, 22.08.2026: „one piece da steht film, aber ist serie").
    if (s.film) {
      raus.push(eintrag.staffeln.length > 1 ? `Film ${s.nr}` : 'Film')
      continue
    }
    /**
     * Die Nummern des **Anbieters**, nicht unsere.
     *
     * Netflix zählt bei manchen Reihen über die Staffeln hinweg durch: My Hero
     * Academia beginnt Staffel 7 bei Folge 146 und endet bei 170. Eine
     * Empfehlung „7e01" schickt dorthin, wo nichts ist — und der Vermerk nach
     * der Meldung heißt „7e170" und trifft nie auf „7e01". Genau daran ist die
     * Einfärbung gescheitert (Daniel, 22.08.2026).
     *
     * `erste` steht erst da, wenn der Anbieter selbst gesprochen hat. Bis dahin
     * ist unsere Aufteilung die beste Schätzung, und die beginnt bei 1.
     */
    const erste = s.erste ?? 1
    raus.push(folgenKuerzel(s.nr, erste))
    // Die letzte Folge nur, wenn wir wissen, welche das ist. Bei einer
    // laufenden Serie ohne Folgenzahl bliebe sonst „1e00" stehen.
    if (s.folgen > 1) raus.push(folgenKuerzel(s.nr, erste + s.folgen - 1))
  }
  return raus
}

function istErledigt(id, kuerzel) {
  return Boolean(erledigt[String(id)]?.includes(kuerzel))
}

/**
 * Wurde aus dieser Staffel überhaupt schon etwas gemeldet?
 *
 * Die Kürzel in der Liste sind **Empfehlungen** — erste und letzte Folge. Wer
 * einen Titel öffnet, bekommt von Netflix aber oft eine andere Folge angeboten,
 * etwa die zuletzt gesehene. Dann wird „1e03" gespeichert, während in der Liste
 * „1e01" steht, und nichts färbt sich. Daniel am 22.08.2026: „ich click drauf,
 * es öffnet sich neuer tab, ich prüfe es, schließe den tab, die liste bleibt wie
 * vorher."
 *
 * Deshalb zwei Stufen: Die genaue Folge färbt sich grün, die übrigen Kürzel
 * derselben Staffel bekommen einen Rahmen — „hier war schon jemand".
 */
/**
 * Die Staffelnummer hinter einem Kürzel — auch hinter „Film 2".
 *
 * Gemeldet wird immer als Folge: Ein Film ist für den Player die erste Folge
 * seiner Staffel, also steht im Speicher „1e01". In der Liste steht „Film".
 * Ohne diese Übersetzung färbte sich das Zeichen nie (Daniel, 22.08.2026).
 */
function staffelAusKuerzel(kuerzel) {
  const film = /^Film(?:\s+(\d+))?$/.exec(kuerzel)
  if (film) return Number(film[1] ?? 1)
  const zahl = Number(kuerzel.split('e')[0])
  return Number.isFinite(zahl) ? zahl : null
}

/** Gilt dieses Kürzel als erledigt — egal ob Folge oder Film? */
function kuerzelErledigt(id, kuerzel) {
  if (istErledigt(id, kuerzel)) return true
  if (!kuerzel.startsWith('Film')) return false
  const nr = staffelAusKuerzel(kuerzel)
  return nr !== null && staffelAngefasst(id, nr)
}

function staffelAngefasst(id, staffel) {
  const vorsatz = String(staffel) + 'e'
  return (erledigt[String(id)] ?? []).some((k) => k.startsWith(vorsatz))
}

/**
 * Eine Meldung als erledigt vermerken — für die Anzeige, nicht als Beleg.
 *
 * **Die Staffel darf fehlen.** Netflix nennt sie nicht überall: Bei einer Serie
 * mit nur einer Staffel steht in der Titelzeile bloß „Flg. 3", und der erste
 * Anlauf verwarf solche Meldungen still — Daniel meldete zwei Folgen von
 * 7SEEDS und sah die Liste danach unverändert (22.08.2026). Hat der Titel
 * genau **eine** offene Staffel, ist sie gemeint; gibt es mehrere, bleibt es
 * ohne Vermerk, denn dann wäre jede Wahl geraten.
 */
/**
 * Einen Verweis als „führt zu nichts" vermerken.
 *
 * Zwei Wege enden hier: der Knopf im Player, wenn die Titelseite keine
 * abspielbare Folge hat, und der Knopf in der Liste. Beide sagen dasselbe, also
 * soll auch dasselbe dastehen.
 */
async function merkeTot(id) {
  if (!id) return
  const schluessel = String(id)
  if ((erledigt[schluessel] ?? []).includes('tot')) return
  erledigt[schluessel] = [...(erledigt[schluessel] ?? []), 'tot']
  try {
    await speicherSchreiben({ erledigt })
  } catch {
    /* Ohne Speicher bleibt die Anzeige unvollständig, mehr nicht. */
  }
}

async function merkeErledigt(id, staffel, folge) {
  if (!id) return
  /**
   * Ein Film hat keine Folgennummer — und braucht auch keine.
   *
   * Netflix nennt bei „Castle in the Sky" weder Staffel noch Folge; die Meldung
   * kam mit beidem leer an und fiel deshalb durch. Das Zeichen „Film" blieb
   * weiß, obwohl die Auskunft im Briefkasten lag (Daniel, 22.08.2026).
   *
   * Hat der Titel genau eine offene Staffel mit einer einzigen Folge, ist klar,
   * was gemeint war.
   */
  if (!folge) {
    const offene = (offeneTitel[String(id)]?.staffeln ?? []).filter((x) => x.offen)
    /**
     * Bei einem Film zählt nicht, wie viele Folgen wir führen.
     *
     * „Flavors of Youth" ist ein Anthologie-Film und steht bei AniList mit drei
     * Episoden — die Bedingung „höchstens eine Folge" schloss ihn deshalb aus,
     * und die Meldung blieb ohne Vermerk (Daniel, 22.08.2026). Wer einen Film
     * meldet, meint den Film; eine Auswahl gibt es dort nicht.
     */
    /**
     * Nennt der Anbieter keine Folge, gibt es dort auch keine Auswahl.
     *
     * „Pokémon: The Arceus Chronicles" führen wir als Serie mit vier Folgen —
     * bei Netflix ist es ein Film (Daniel, 22.08.2026). Die Meldung kam ohne
     * Folgennummer, und die alte Bedingung „nur bei Filmen" verwarf sie: Der
     * Eintrag blieb weiß, obwohl die Auskunft im Briefkasten lag.
     *
     * Bei genau einer offenen Staffel ist trotzdem klar, was gemeint war —
     * wer keine Folgenauswahl vorfindet, hat gesehen, was es dort gibt. Der
     * Vermerk ist ohnehin nur eine Gedächtnisstütze; der Befund selbst liegt
     * beim Worker.
     */
    if (offene.length !== 1) return
    staffel = staffel || offene[0].nr
    folge = offene[0].erste ?? 1
  }
  /**
   * Kennt die Liste diese Kennung nicht, war es vielleicht eine andere.
   *
   * Der Tab, aus dem heraus geklickt wurde, hat die Kennung hinterlegt. Sie
   * gilt nur kurz — nach zehn Minuten ist nicht mehr plausibel, dass beides
   * zusammengehört, und dann lieber gar kein Vermerk als ein falscher.
   */
  if (offeneTitel[String(id)] === undefined) {
    try {
      const { zuletztGeoeffnet } = (await speicherLesen('zuletztGeoeffnet')) ?? {}
      if (
        zuletztGeoeffnet?.id &&
        offeneTitel[zuletztGeoeffnet.id] !== undefined &&
        Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 10 * 60 * 1000
      ) {
        id = zuletztGeoeffnet.id
      }
    } catch {
      /* Ohne Speicher bleibt es beim eigenen Wert. */
    }
  }
  if (!staffel) {
    const offene = (offeneTitel[String(id)]?.staffeln ?? []).filter((x) => x.offen)
    if (offene.length !== 1) return
    staffel = offene[0].nr
  }
  const schluessel = String(id)
  const kuerzel = folgenKuerzel(staffel, folge)
  const bisher = erledigt[schluessel] ?? []
  if (bisher.includes(kuerzel)) return
  erledigt[schluessel] = [...bisher, kuerzel]
  try {
    await speicherSchreiben({ erledigt })
  } catch {
    /* Ohne Speicher bleibt die Anzeige unvollständig, mehr nicht. */
  }
}

/**
 * Ist an diesem Titel nichts mehr zu tun?
 *
 * Entweder als toter Verweis gemeldet, oder jede empfohlene Folge ist durch.
 * Dieselbe Frage stellen der Knopf mit seiner Zahl und die Liste mit ihrer
 * Sortierung — deshalb steht sie hier einmal und nicht zweimal.
 */
/**
 * **Fertig ist, wenn jede Folge gemeldet ist — nicht die erste und die letzte.**
 *
 * Daniel am 26.08.2026, mit Bild: „warum sind die noch als gemeldet
 * gelabeled? achso teilweise gemeldet. die sollten aber nicht hinter dem
 * toggle verschwinden, solange sie noch zu reportende episoden haben."
 *
 * Im Bild stand bei Beyblade X „gemeldet: E1, E49" neben „offen: E2-48" —
 * und der Titel galt trotzdem als erledigt und verschwand hinter dem
 * Umschalter. Der Grund: `empfohleneFolgen()` liefert je Staffel genau zwei
 * Kürzel, die erste und die letzte Folge. Das war eine sinnvolle Empfehlung,
 * solange eine Meldung für die ganze Staffel galt; seit der Durchlauf jede
 * Folge einzeln meldet, ist es die falsche Frage.
 *
 * Gezählt wird jetzt über alle Folgen der Staffeln. Ein toter Verweis bleibt
 * erledigt, und ein Titel ohne Folgenangabe gilt weiterhin nicht als fertig —
 * `[].every(…)` ist immer wahr, und daran ist der Zähler schon einmal
 * gescheitert (22.08.2026: von 11 auf 0 nach einer einzigen Meldung).
 */
/**
 * **Fertig ist, wenn jede Folge gemeldet ist — und die Prüfung hört beim
 * ersten Nein auf.**
 *
 * Daniel am 26.08.2026, mit Bild von Beyblade X („gemeldet: E1, E49" neben
 * „offen: E2-48", und trotzdem hinter dem Umschalter versteckt): „die sollten
 * aber nicht hinter dem toggle verschwinden, solange sie noch zu reportende
 * episoden haben."
 *
 * Der Grund war `empfohleneFolgen()`: Es liefert je Staffel zwei Kürzel, die
 * erste und die letzte Folge. Eine sinnvolle Empfehlung, solange eine Meldung
 * für die ganze Staffel galt — seit der Durchlauf jede Folge einzeln meldet,
 * die falsche Frage.
 *
 * **Und keine Liste bauen, bevor gefragt wird** (Daniel, im selben Zug): „some
 * reicht, sobald auch nur 1 nicht gemeldet wurde kann er returnen … oder noch
 * besser wenn es ein object mit flag ist, dann brauch gar nicht über ein array
 * gegangen zu werden."
 *
 * Beides umgesetzt. Der erste Anlauf sammelte alle Kürzel in ein Array und
 * rief dann `every` — das bricht zwar beim ersten Nein ab, aber das Array war
 * da schon fertig: bei One Piece 1.175 Zeichenketten, bevor die Prüfung
 * überhaupt begann. Jetzt wird in der Schleife gefragt und beim ersten
 * fehlenden Kürzel zurückgekehrt.
 *
 * Dazu ein `Set` statt der Liste: `erledigt[id]` ist ein Array, und
 * `kuerzelErledigt` sucht darin linear. Bei 1.175 Folgen gegen 1.175 Einträge
 * wären das über eine Million Vergleiche für eine Frage, die mit dem ersten
 * offenen Kürzel beantwortet ist.
 */
function fertig(id, eintrag) {
  if (istErledigt(id, 'tot')) return true
  const staffeln = staffelnVon(id, eintrag)
  const abgehakt = new Set(erledigt[String(id)] ?? [])
  let hatFolgen = false
  for (const st of staffeln) {
    /*
      **Ein Film wird unter „Film" gemeldet — und hier unter „1e01" gesucht.**

      `empfohleneFolgen()` gibt seit dem 22.08.2026 „Film" statt einer
      Folgennummer aus. Diese Schleife wusste davon nichts: Sie baut ihre
      Kürzel aus `folgen`, und bei einem Film ist das die Eins. Die beiden
      trafen nie aufeinander, also galt kein Film je als fertig — er stand nach
      jeder Meldung wieder in der Liste (Daniel, 30.08.2026, an „Gintama the
      Movie" und „Pokémon: Blauer Himmel in der Ferne!").
    */
    if (st.film) {
      hatFolgen = true
      const kuerzel = staffeln.length > 1 ? `Film ${st.nr}` : 'Film'
      if (!abgehakt.has(kuerzel) && !kuerzelErledigt(id, kuerzel)) return false
      continue
    }
    const erste = Number.isFinite(st.erste) ? st.erste : 1
    for (let n = 0; n < (st.folgen ?? 0); n++) {
      hatFolgen = true
      const kuerzel = `${st.nr}e${String(erste + n).padStart(2, "0")}`
      /* Beim ersten offenen Kürzel ist die Frage beantwortet. */
      if (!abgehakt.has(kuerzel) && !kuerzelErledigt(id, kuerzel)) return false
    }
  }
  /*
    Ohne Folgenangabe gilt nichts als fertig. `[].every(…)` ist immer wahr, und
    daran ist der Zähler schon einmal gescheitert: Nach einer einzigen Meldung
    fiel er von 11 auf 0 (Daniel, 22.08.2026).
  */
  return hatFolgen
}

/**
 * **Der Knopf zeigt dieselbe Zahl wie die Leiste in der Statusanzeige.**
 *
 * Daniel am 26.08.2026: „ich muss sehen wieviel zu reporten ist, bevor ich
 * draufklicke und die liste sehe."
 *
 * Bis dahin zählten beide Verschiedenes: der Knopf aus der **Abhakliste dieses
 * Browsers**, die Leiste aus dem **Datensatz** abzüglich der Meldungen im
 * Briefkasten. Wer alles angeklickt hatte, sah hier ein Häkchen und dort „10
 * offen" — beide Zahlen stimmten in ihrer Welt und widersprachen sich trotzdem.
 *
 * Gelesen wird deshalb dieselbe Quelle, nicht dieselbe Rechnung nachgebaut:
 * `pruefstand.json` sagt, was der Datensatz noch nicht hat, und die Zählroute
 * des Workers, was davon schon unterwegs ist. Zwei Fassungen einer Regel laufen
 * auseinander; eine Quelle tut das nicht.
 *
 * Schlägt einer der beiden Abrufe fehl, bleibt es bei der lokalen Zählung —
 * eine Zahl aus dem eigenen Speicher ist besser als keine.
 */
/**
 * **Der Stand kommt vom Worker — er ist die einzige Stelle, die ihn rechnet.**
 *
 * Vorher holte diese Datei `pruefstand.json` und die Zählroute getrennt und zog
 * beides voneinander ab. Die Statusanzeige tat dasselbe, die Liste rechnete aus
 * dem lokalen Speicher — drei Rechnungen, drei Ergebnisse. Der Knopf sagte „10
 * offen", die Liste daneben „Alles geprüft" (Daniel, 26.08.2026: „wo sind die
 * 10 einträge die es zu prüfen gilt?" — danach: „single source of truth").
 *
 * Jetzt rechnet der Worker: Er kennt den Briefkasten und lädt den Prüfstand.
 * Wer die Zahl braucht, liest sie.
 */
const STAND = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1'

/** Was der Worker für Netflix als offen führt — `null`, solange unbekannt. */
let offenLautStand = null

async function standHolen() {
  try {
    const daten = await fetch(STAND, { cache: 'no-store' }).then((r) => r.json())
    const netflix = (daten.anbieter ?? []).find((a) => a.plattform === 'netflix')
    if (!netflix) return
    offenLautStand = netflix.offen
    uebersichtZeigen()
  } catch {
    /* Ohne Netz bleibt die lokale Zählung stehen. */
  }
}

/**
 * **Der Durchlauf: alle Folgen einer Reihe nacheinander lesen.**
 *
 * Daniel am 26.08.2026, nachdem der Weg gemessen war: „bau es in die extension,
 * ich lade die extension und one piece overview neu, dann sollten ja
 * automatisch alle folgen nacheinander durchgegangen und gemeldet werden."
 *
 * Der Ablauf je Folge, gemessen an One Piece:
 *
 * 1. Zur Folge navigieren (SPA, kein Neuladen — der Kontext bleibt).
 * 2. Warten, bis `getAudioTrackList()` etwas liefert. Rund drei Sekunden.
 * 3. Videodaten abdrehen: Der Leser weist Segmentabrufe ab.
 * 4. Melden, zurück zur Titelseite, nächste Folge.
 *
 * Kosten: 3,1 s je Folge, null bis acht Videosegmente. Die Gegenprobe hält —
 * East Blue meldet `de`, der Elbaph Arc nur `ja`.
 *
 * **Gestartet wird auf Knopfdruck, nicht von allein.** Jede Folge ist eine
 * echte Wiedergabe-Sitzung mit Lizenzabruf und landet in „Weiter ansehen";
 * bei One Piece wären das über tausend Einträge. Das gehört nicht in einen
 * versehentlichen Seitenaufruf.
 */
const DURCHLAUF = {
  /** Was der Leser aus den Folgenlisten gesammelt hat. */
  folgen: [],
  /**
   * **Welche Folgen gemeldet sind — nach Kennung, nicht nach Kürzel.**
   *
   * Der erste Anlauf filterte über `istErledigt(reihe, "1")`, während die
   * Abhakliste Kürzel der Form `2e01` führt. Die beiden trafen sich nie: Nach
   * einem vollständigen Durchlauf stand weiter „12 Folgen prüfen" am Knopf
   * (Daniel, 26.08.2026).
   *
   * Die `videoId` ist eindeutig und braucht keine Staffelzuordnung. Sie
   * überlebt auch das Neuladen — der Durchlauf soll dort weitermachen, wo er
   * aufgehört hat.
   */
  gemeldet: new Set(),
  laeuft: false,
  abbruch: false,
  fertig: 0,
  gesamt: 0,
  knopf: null,
}

/** Der Speicherplatz je Reihe — eine Reihe, eine Liste gemeldeter Kennungen. */
/**
 * **Folgennummern als Bereiche — „1-10, 12" statt zwölf Kästchen.**
 *
 * Daniel am 26.08.2026: „weil das evtl zu viele zum auflisten sind, sollte
 * ein von bis aufzählung sein, heißt wenn ich zb 1-10 reportet 11 nicht
 * reportet und 12 reportet habe, sollte dort stehen: reported (grün):
 * s1e1-e10, e12, to report (grau): s1e11."
 *
 * Bei One Piece wären es sonst über tausend Einträge in einer Zeile.
 */
function alsBereiche(nummern) {
  const sortiert = [...new Set(nummern)].filter(Number.isFinite).sort((a, b) => a - b)
  if (!sortiert.length) return []
  const raus = []
  let von = sortiert[0]
  let bis = sortiert[0]
  for (const n of sortiert.slice(1)) {
    if (n === bis + 1) {
      bis = n
      continue
    }
    raus.push(von === bis ? `${von}` : `${von}-${bis}`)
    von = n
    bis = n
  }
  raus.push(von === bis ? `${von}` : `${von}-${bis}`)
  return raus
}

/**
 * **Wie viele Folgen ein Klick prüft — umschaltbar und gemerkt.**
 *
 * Daniel am 26.08.2026: „mach toggle bar per console, oder innerhalb der
 * liste ein kleiner limit-icon button dann kann ich es selbst umstellen. im
 * localstore toggle state merken, sodass ich beim testen an und normale
 * prüfung aus machen kann."
 *
 * Zwei Folgen sind die Vorgabe, solange etwas erprobt wird. Wer eine Staffel
 * wirklich durcharbeiten will, stellt einmal um — und es bleibt so, bis er es
 * zurückstellt. Umschalt+Klick kehrt die Einstellung für einen Lauf um.
 */
const PROBE_SCHLUESSEL = 'ak-durchlauf-probe'
/** Wie viele Folgen ein Klick prüft — 0 heißt alle. */
let probeGrenze = 2

void (async () => {
  try {
    const gespeichert = await chrome.storage.local.get(PROBE_SCHLUESSEL)
    if (Number.isFinite(gespeichert[PROBE_SCHLUESSEL])) probeGrenze = gespeichert[PROBE_SCHLUESSEL]
  } catch {
    /* Ohne Speicher bleibt es bei zwei — der vorsichtigen Seite. */
  }
  durchlaufKnopfZeigen()
})()

/**
 * **Drei Zustände: zwei Folgen, alle, oder nur Anfang und Ende.**
 *
 * Daniel am 26.08.2026: „ich möchte nicht alle testen, ich will mich drauf
 * verlassen bei netflix das 1. und letzte test ausreicht … wenn diese prüfung
 * erkennt das 1. deutsch und letzte kein deutsch, dann meldung nicht
 * abschicken und gelbfärbung oder so um es zu kennzeichnen, dann input feld
 * anbieten wo ich manuell eine folge eingeben kann, bis zu der es deutsch ist."
 *
 * `RAND` prüft die erste und die letzte offene Folge. Stimmen beide überein,
 * gilt der Befund für die ganze Staffel — **als Annahme, nicht als Messung**,
 * und die Notiz sagt das. Unterscheiden sie sich, geht gar nichts raus: Dann
 * liegt die Grenze irgendwo dazwischen, und die kennt nur, wer nachsieht.
 */
const RAND = -1

/**
 * Die von Hand eingetragene Grenze übernehmen.
 *
 * Bis zur genannten Folge gilt der Befund der **ersten** Randprobe, danach
 * der der **letzten**. Beide sind gemessen; nur die Grenze dazwischen kommt
 * von Daniel, und genau das steht in der Notiz.
 */
async function grenzeUebernehmen() {
  const bis = Number(DURCHLAUF.grenzFeld?.value)
  const daten = DURCHLAUF.randOffen
  if (!daten || !Number.isFinite(bis) || bis < 1) return

  const vorne = daten.folgen.filter((f) => f.nummer <= bis)
  const hinten = daten.folgen.filter((f) => f.nummer > bis)
  await randMelden(vorne, daten.erste, bis)
  if (hinten.length) await randMelden(hinten, daten.letzte, daten.letzte.folge.nummer)

  DURCHLAUF.randOffen = null
  DURCHLAUF.grenzFeld.value = ''
  durchlaufKnopfZeigen()
  console.log(
    `[Anime-Kalender] Grenze bei Folge ${bis} übernommen: ` +
      `1–${bis} ${daten.erste.deutsch ? 'deutsch' : 'ohne Deutsch'}, ` +
      `ab ${bis + 1} ${daten.letzte.deutsch ? 'deutsch' : 'ohne Deutsch'}.`,
  )
}

async function probeGrenzeUmschalten() {
  probeGrenze = probeGrenze === 2 ? RAND : probeGrenze === RAND ? 0 : 2
  try {
    await chrome.storage.local.set({ [PROBE_SCHLUESSEL]: probeGrenze })
  } catch {
    /* Dann gilt die Einstellung nur für diese Sitzung. */
  }
  durchlaufKnopfZeigen()
}

const durchlaufSchluessel = (reihe) => `ak-durchlauf-${reihe}`

/**
 * **Der Stand kommt aus der Ferne, nicht aus dem Browser.**
 *
 * Daniel am 26.08.2026: „es sollte synchron zur remote liste sein, fix das
 * sodass die stände nie auseinander laufen können."
 *
 * Der erste Anlauf führte im Browser Buch. Das ging genau so lange gut, bis
 * die Erweiterung neu geladen wurde — dann stand der Zähler auf null, obwohl
 * zwölf Meldungen längst im Briefkasten lagen. Zwei Fassungen derselben
 * Wahrheit laufen auseinander; die Regel gilt für Zustände wie für Regeln.
 *
 * Gefragt wird der Worker, und der antwortet aus der Meldungstabelle —
 * unabhängig davon, ob ein Datenlauf sie schon übernommen hat.
 *
 * Fällt die Abfrage aus, bleibt der lokale Speicher als Rückfallebene. Er ist
 * dann veraltet, aber besser als eine Reihe, die von vorn beginnt.
 */
async function durchlaufStandLaden(reihe) {
  if (!reihe) return
  const adresse = `https://www.netflix.com/title/${reihe}`
  try {
    const antwort = await fetch(`${WORKER}?gemeldet=${encodeURIComponent(adresse)}`, { cache: 'no-store' })
    const daten = await antwort.json()
    /* Der Worker führt die Folgennummern; die Kennung steht hier daneben. */
    const nummern = new Set((daten.nummern ?? []).map(Number))
    DURCHLAUF.gemeldeteNummern = nummern
    DURCHLAUF.gemeldet = new Set(
      DURCHLAUF.folgen.filter((f) => nummern.has(f.nummer)).map((f) => f.videoId),
    )

    /*
      **Die Abhakliste kommt aus derselben Quelle — und über alle Staffeln.**

      Sie speist die Bereiche im Dialog. Ohne diesen Abgleich stand dort nach einer
      Randprobe über 61 Folgen weiter „gemeldet: E1-2, E61 | offen: E3-60", während
      der Knopf daneben „61 Folgen geprüft" sagte (Daniel, 26.08.2026).

      Der erste Anlauf ging über `DURCHLAUF.folgen` und hat den Widerspruch nur
      verschoben: Das sind die Folgen der Staffel, deren Liste Netflix gerade zeigt.
      Bei One Piece Staffel 38 waren das 34 von 216 gemeldeten; die übrigen 182
      blieben grau, obwohl der Worker sie führte („e1124-1154 sagt offen, button
      sagt alles geprüft").

      Die Staffelgrenzen stehen in der Prüfliste und gelten unabhängig davon, was
      gerade geladen ist. Die Ferne ist die Quelle; die lokale Liste folgt ihr.
    */
    const bekannt = new Set(erledigt[String(reihe)] ?? [])
    const vorher = bekannt.size
    const staffeln = staffelnVon(reihe, offeneTitel[String(reihe)] ?? {})
    for (const kuerzel of kuerzelFuerNummern(staffeln, nummern)) bekannt.add(kuerzel)
    if (bekannt.size !== vorher) {
      erledigt[String(reihe)] = [...bekannt]
      try {
        await speicherSchreiben({ erledigt })
      } catch {
        /* Ohne Speicher gilt es nur für diese Sitzung. */
      }
    }
    await durchlaufStandSchreiben(reihe)
    return
  } catch {
    /* Kein Netz — dann der letzte bekannte Stand. */
  }
  try {
    const gespeichert = await chrome.storage.local.get(durchlaufSchluessel(reihe))
    DURCHLAUF.gemeldet = new Set(gespeichert[durchlaufSchluessel(reihe)] ?? [])
  } catch {
    DURCHLAUF.gemeldet = new Set()
  }
}

async function durchlaufStandSchreiben(reihe) {
  if (!reihe) return
  try {
    await chrome.storage.local.set({ [durchlaufSchluessel(reihe)]: [...DURCHLAUF.gemeldet] })
  } catch {
    /* Ohne Speicher fängt der nächste Durchlauf von vorn an, mehr nicht. */
  }
}

/**
 * **Netflix duldet nur einen Tab — und sagt es mit einem Fehlercode.**
 *
 * Daniel am 26.08.2026, mitten im Durchlauf: „netflix limitation mit 1 tab
 * stört. wenn das passiert soll das skript abbrechen statt weiter zu
 * versuchen." Auf dem Bild stand M7020: „Sie sehen Netflix scheinbar in mehr
 * als einem Browser oder Tab."
 *
 * Weiterzumachen bringt nichts: Jede weitere Folge läuft in dieselbe Wand,
 * zwanzig Sekunden lang, und am Ende steht ein Durchlauf ohne ein einziges
 * Ergebnis. Ein Abbruch mit Ansage ist ehrlicher — dann weiß Daniel, was zu
 * tun ist, und beginnt dort, wo er aufgehört hat.
 *
 * Gesucht wird nach dem Code, nicht nach dem Satz: Der steht in jeder Sprache
 * anders da, die Kennung überall gleich.
 */
function stoerung() {
  const text = document.body?.textContent ?? ''
  /*
    `UI3003` kam am 26.08.2026 dazu — „Dieser Titel ist in Ihrem Land derzeit
    nicht verfügbar". Er erschien, weil eine Folge mit `videoId: 0` in die Liste
    geraten war und der Durchlauf `/watch/0` öffnete.
  */
  const treffer = /\bM7\d{3}\b|\bUI\d{4}\b|\bE\d{3}\b|\bNSES-[A-Z]{3}\b/.exec(text)
  if (treffer) return treffer[0]
  /* Der Player kennt seine eigenen Fehler — falls die Seite noch nichts zeigt. */
  try {
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
    for (const id of api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []) {
      const fehler = api.videoPlayer.getFatalErrorForSessionId?.(id)
      if (fehler) return String(fehler?.errorCode ?? fehler?.code ?? 'Player-Fehler')
    }
  } catch {
    /* Kein Zugriff — dann bleibt es beim Blick auf die Seite. */
  }
  return null
}

/**
 * Den Durchlauf-Stand dieser Reihe verwerfen — Rechtsklick auf den Knopf.
 *
 * Gebraucht wird das beim Erproben: Sonst ist eine Staffel nach dem ersten
 * Lauf für immer abgehakt und lässt sich nicht noch einmal messen.
 */
/**
 * Den Stand für **diesen einen Lauf** übergehen — Rechtsklick auf den Knopf.
 *
 * Seit der Stand aus der Ferne kommt, lässt er sich nicht mehr „vergessen":
 * Die Meldungen liegen beim Worker, und das ist richtig so. Zum Erproben
 * braucht es trotzdem einen Weg, dieselben Folgen noch einmal zu messen —
 * also wird der Stand für den nächsten Lauf beiseitegelegt, nicht gelöscht.
 */
async function durchlaufStandVergessen() {
  const reihe = gemeinteReihe()
  if (!reihe) return
  DURCHLAUF.gemeldet = new Set()
  DURCHLAUF.stoerung = null
  /*
    **Eine Folgenliste gehört zu genau einer Staffel.**

    Beim ersten Kakegurui-Durchlauf trug die Meldung zu Folge 1 `staffel: null`
    — der Player hatte seine Metadaten noch nicht geholt, als sie abging. Die
    Pipeline verteilte die zwölf Folgen daraufhin über zwei Staffeln: Folge 1
    zu „Kakegurui", 2 bis 12 zu „Kakegurui ××". Alle zwölf gehören zur zweiten.

    Die erste Staffelnummer, die während eines Durchlaufs auftaucht, gilt
    deshalb für alle Folgen dieser Liste. Sie stammt aus derselben Ansicht.
  */
  DURCHLAUF.staffel = null
  DURCHLAUF.ohneStaffel = []
  DURCHLAUF.uebergangen = true
  durchlaufKnopfZeigen()
  console.log(
    `[Anime-Kalender] Stand für Reihe ${reihe} übergangen — alle Folgen werden noch einmal geprüft. ` +
      'Beim nächsten Laden gilt wieder, was der Worker sagt.',
  )
}

/** Was in dieser Reihe noch aussteht. */
function durchlaufOffen() {
  return DURCHLAUF.folgen.filter((f) => !DURCHLAUF.gemeldet.has(f.videoId))
}

/** Dem Leser sagen, ob er Videodaten durchlassen soll. */
function videoAbdrehen(zu) {
  window.postMessage({ marke: 'ak-steuer', videoZu: zu }, '*')
}

/** Die Navigation, die auch ein Klick auslöst — ohne Neuladen. */
function gehe(pfad) {
  history.pushState({}, '', pfad)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && DURCHLAUF.laeuft) {
      DURCHLAUF.abbruch = true
      console.log('[Anime-Kalender] Durchlauf wird abgebrochen …')
    }
  },
  true,
)

/**
 * **Ein Probelauf über zwei Folgen — für alles, was noch nicht sitzt.**
 *
 * Daniel am 26.08.2026: „limitier es auf 2 episoden statt alle 12, sodass
 * der debug diagnose test schneller durchläuft und ich nicht so lange warten
 * muss."
 *
 * Das ist mehr als eine Bequemlichkeit für heute. Der erste Durchlauf lief
 * über alle Folgen und öffnete dabei fremde Serien; die Lehre daraus — an
 * fünf erproben, nicht an tausend — gehört als Griff in den Code, nicht in
 * einen guten Vorsatz.
 *
 * **Umschalt+Klick** startet ihn. Rechtsklick setzt den Stand einer Reihe
 * zurück, damit dieselben Folgen erneut prüfbar werden.
 */
async function durchlaufStarten(grenze) {
  if (DURCHLAUF.laeuft) {
    DURCHLAUF.abbruch = true
    return
  }
  const titelseite = location.pathname
  const reihe = gemeinteReihe()
  if (!DURCHLAUF.uebergangen) await durchlaufStandLaden(reihe)
  DURCHLAUF.uebergangen = false
  const alleOffen = durchlaufOffen()
  /*
    Bei `RAND` genau zwei Folgen: die erste und die letzte. Sie werden in
    dieser Reihenfolge geprüft, damit die Staffelnummer aus der ersten schon
    feststeht, wenn die letzte gemeldet wird.
  */
  const offen =
    grenze === RAND
      ? alleOffen.length > 1
        ? [alleOffen[0], alleOffen[alleOffen.length - 1]]
        : alleOffen
      : grenze
        ? alleOffen.slice(0, grenze)
        : alleOffen
  DURCHLAUF.randprobe = grenze === RAND && alleOffen.length > 1 ? alleOffen : null
  if (!offen.length) return

  /*
    Ab hier bis zum `finally` unten: Wirft irgendetwas dazwischen, bliebe
    `laeuft` sonst auf `true` stehen — und der Knopf wäre für immer tot, weil
    er einen zweiten Start abweist.
  */
  DURCHLAUF.laeuft = true
  DURCHLAUF.abbruch = false
  DURCHLAUF.stoerung = null
  /*
    **Hier gehört der Merker zurückgesetzt, nicht beim Rechtsklick.**

    Ein Patch-Skript hat die Zeile am 26.08.2026 in `durchlaufStandVergessen()`
    einsortiert — beide Funktionen enthielten `DURCHLAUF.stoerung = null`, und
    der Anker traf den falschen. `DURCHLAUF.staffel` blieb dadurch `undefined`,
    und jede Prüfung auf `=== null` lief daran vorbei. In der Diagnose stand
    „gemerkt=undefined".

    Aufgefallen ist es nur, weil die Ausgabe den Wert genannt hat statt eines
    Urteils darüber.
  */
  DURCHLAUF.staffel = null
  DURCHLAUF.ohneStaffel = []
  DURCHLAUF.protokoll = []
  DURCHLAUF.fertig = 0
  DURCHLAUF.gesamt = offen.length
  durchlaufKnopfZeigen()

  /*
    **Die erste Folge kommt zuletzt, wenn die Staffel noch unbekannt ist.**

    Der Player holt seine Metadaten beim ersten Öffnen; bis dahin weiß niemand,
    welche Staffel läuft. Wer zuerst gemeldet wird, trägt deshalb kein
    Staffelfeld — und genau die erste Folge ist die, bei der eine falsche
    Zuordnung am meisten anrichtet (sie passt der Nummer nach auch zu Staffel 1).

    Also wird sie ans Ende gestellt: Dann ist die Staffel längst bekannt.
  */
  const reihenfolge = offen.length > 1 ? [...offen.slice(1), offen[0]] : offen

  for (const f of reihenfolge) {
    if (DURCHLAUF.abbruch) break
    videoAbdrehen(false)
    gehe(`/watch/${f.videoId}`)

    /* Warten, bis der Player die Liste hat — höchstens 20 Sekunden. */
    let spuren = null
    for (let i = 0; i < 100 && !spuren && !DURCHLAUF.abbruch; i++) {
      await new Promise((r) => setTimeout(r, 200))
      spuren = stand.spuren?.length ? stand.spuren : null
      /*
        Eine Störung beendet den Durchlauf sofort. Erst nach zwei Sekunden
        nachsehen: Beim Aufbau steht kurz alles Mögliche auf der Seite.
      */
      if (i > 10 && !spuren) {
        const code = stoerung()
        if (code) {
          DURCHLAUF.stoerung = code
          DURCHLAUF.abbruch = true
          break
        }
      }
    }
    /*
      **Auf die Staffel warten, nicht nur auf die Tonspur.**

      Die Tonspur steht nach rund drei Sekunden im Player, die Metadaten mit
      der Staffelnummer brauchen länger. Wer sofort meldet, schickt
      `staffel: null` — und die Pipeline verteilt die Folgen dann über zwei
      Staffeln (Kakegurui, 26.08.2026: Folge 1 zu Staffel 1, der Rest zu 2).

      Die erste Folge des Durchlaufs wartet deshalb bis zu fünf Sekunden
      länger. Danach steht die Nummer für alle übrigen fest, und keine muss
      mehr warten.
    */
    if (spuren && !Number.isFinite(DURCHLAUF.staffel) && !Number.isFinite(stand.staffel)) {
      for (let i = 0; i < 25 && !Number.isFinite(stand.staffel) && !DURCHLAUF.abbruch; i++) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    videoAbdrehen(true)

    /*
      **Zweiter Riegel: Gehört die laufende Folge überhaupt zu dieser Reihe?**

      Der erste Riegel ist die Typ-Prüfung im Leser. Dieser hier fängt, was
      trotzdem durchkommt — und am 26.08.2026 kam einiges durch: Heroes,
      Lucifer und Ozark wurden als One Piece gemeldet, weil niemand nachfragte.

      `stand.reihe` kommt aus dem Player und meint die Reihe der laufenden
      Folge. Stimmt sie nicht mit der Seite überein, wird nichts gemeldet.
    */
    const gehoertDazu = !stand.reihe || String(stand.reihe) === String(gemeinteReihe())
    if (spuren && gehoertDazu) {
      const { deutsch, echte } = urteil(spuren)
      /* Die erste erkannte Staffel gilt für die ganze Liste. */
      if (!Number.isFinite(DURCHLAUF.staffel) && Number.isFinite(stand.staffel)) {
        DURCHLAUF.staffel = stand.staffel
      }
      const staffelJetzt = Number.isFinite(stand.staffel) ? stand.staffel : DURCHLAUF.staffel
      /*
        Bei einer Randprobe wird erst gesammelt. Ob gemeldet wird, entscheidet
        sich, wenn beide Folgen gelesen sind — stimmen sie nicht überein, geht
        nichts raus.
      */
      if (DURCHLAUF.randprobe) {
        DURCHLAUF.randErgebnis = DURCHLAUF.randErgebnis ?? []
        DURCHLAUF.randErgebnis.push({ folge: f, echte, deutsch, staffel: staffelJetzt })
        DURCHLAUF.protokoll.push({
          Folge: f.nummer,
          Tonspuren: echte.map((x) => x.code).join(','),
          Deutsch: deutsch ? 'ja' : 'nein',
          Player: stand.staffel ?? '—',
          gemerkt: DURCHLAUF.staffel ?? '—',
          gemeldet: '(Randprobe)',
        })
        DURCHLAUF.fertig++
        durchlaufKnopfZeigen()
        gehe(titelseite)
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      /*
        **Eine Ausgabe je Durchlauf, nicht je Folge.**

        Daniel am 26.08.2026: „mach nicht mehr so getrennte outputs, bündel
        die, ich musste danach suchen." Bei zwölf Folgen sind das zwölf Zeilen
        zwischen Netflix' eigenen Meldungen. Gesammelt und am Ende als Tabelle
        ausgegeben, findet man sie auf einen Blick.
      */
      DURCHLAUF.protokoll.push({
        Folge: f.nummer,
        Tonspuren: echte.map((x) => x.code).join(','),
        Deutsch: deutsch ? 'ja' : 'nein',
        Player: stand.staffel ?? '—',
        gemerkt: DURCHLAUF.staffel ?? '—',
        gemeldet: staffelJetzt ?? '—',
      })
      const ok = await durchlaufMelden(f, echte, deutsch)
      if (ok && !Number.isFinite(staffelJetzt)) {
        /*
          **Ohne Staffel gemeldet — das wird am Ende nachgeholt.**

          Zweimal versucht, zweimal verschoben: Erst fehlte die Nummer bei
          Folge 1, dann bei Folge 2, weil die seit 3.9 zuerst läuft. Fünf
          Sekunden Warten haben nichts geändert — beim allerersten Öffnen
          liefert der Player die Metadaten offenbar gar nicht, nicht nur spät.

          Statt einer dritten Vermutung über das Timing wird die Meldung
          nachgereicht, sobald die Staffel feststeht. Der Worker führt je
          Adresse und Folge einen Eintrag; die zweite Meldung ersetzt die
          erste.
        */
        DURCHLAUF.ohneStaffel = DURCHLAUF.ohneStaffel ?? []
        DURCHLAUF.ohneStaffel.push({ folge: f, echte, deutsch })
      }
      if (ok) {
        DURCHLAUF.gemeldet.add(f.videoId)
        await durchlaufStandSchreiben(reihe)
        DURCHLAUF.fertig++
      } else {
        DURCHLAUF.fehler = (DURCHLAUF.fehler ?? 0) + 1
      }
    } else if (!spuren) {
      /*
        Keine Tonspur binnen zwanzig Sekunden — die Folge bleibt offen und
        kommt beim nächsten Durchlauf wieder dran. Genau das wollte Daniel:
        „wenn ep 7 nicht erfolgreich geprüft wurde, alle anderen schon, sollte
        dort 1 folge prüfen stehen." Beim ersten Kakegurui-Lauf traf es drei
        von zwölf.
      */
      DURCHLAUF.ohneSpur = (DURCHLAUF.ohneSpur ?? 0) + 1
      console.warn(`[Anime-Kalender] Folge ${f.nummer}: keine Tonspur gelesen — bleibt offen`)
    } else {
      DURCHLAUF.fremde = (DURCHLAUF.fremde ?? 0) + 1
      console.warn(
        `[Anime-Kalender] Folge ${f.nummer} gehört zu Reihe ${stand.reihe}, nicht zu ${gemeinteReihe()} — übersprungen`,
      )
    }
    durchlaufKnopfZeigen()

    gehe(titelseite)
    /* Eine Sekunde Ruhe zwischen zwei Folgen — ein Mensch klickt auch nicht schneller. */
    await new Promise((r) => setTimeout(r, 1000))
  }

  /*
    Was ohne Staffelnummer rausging, wird jetzt nachgereicht — die Nummer
    steht seit der zweiten Folge fest.
  */
  if (DURCHLAUF.ohneStaffel?.length && Number.isFinite(DURCHLAUF.staffel)) {
    for (const eintrag of DURCHLAUF.ohneStaffel) {
      await durchlaufMelden(eintrag.folge, eintrag.echte, eintrag.deutsch)
    }
    console.log(
      `[Anime-Kalender] ${DURCHLAUF.ohneStaffel.length} Meldung(en) mit Staffel ${DURCHLAUF.staffel} nachgereicht.`,
    )
  }
  DURCHLAUF.ohneStaffel = []

  /*
    **Die Randprobe auswerten.**

    Stimmen erste und letzte Folge überein, gilt der Befund für die ganze
    Staffel — als **Annahme**, und die Notiz sagt das. Unterscheiden sie sich,
    geht nichts raus: Die Grenze liegt dann irgendwo dazwischen, und wo, weiß
    nur, wer nachsieht.
  */
  if (DURCHLAUF.randprobe && DURCHLAUF.randErgebnis?.length === 2) {
    /*
      **Nach Folgennummer ordnen, nicht nach Prüfreihenfolge.**

      Seit 3.9 läuft die erste Folge zuletzt — damit die Staffelnummer schon
      feststeht, wenn sie gemeldet wird. Für die Randprobe heißt das: Der
      erste Eintrag im Ergebnis ist die **letzte** Folge. Die Notiz sagte
      dadurch „gemessen: Folge 1 und 1" statt „1 und 61" (26.08.2026).

      Eine Reihenfolge, die aus einem anderen Grund gewählt wurde, taugt nicht
      als Ordnungsmerkmal. Die Nummer schon.
    */
    const [ersteFolge, letzteFolge] = [...DURCHLAUF.randErgebnis].sort(
      (a, b) => a.folge.nummer - b.folge.nummer,
    )
    if (ersteFolge.deutsch === letzteFolge.deutsch) {
      await randMelden(DURCHLAUF.randprobe, ersteFolge, letzteFolge.folge.nummer)
      DURCHLAUF.randOffen = null
    } else {
      /* Uneinheitlich — hier entscheidet ein Mensch, nicht eine Annahme. */
      DURCHLAUF.randOffen = {
        folgen: DURCHLAUF.randprobe,
        erste: ersteFolge,
        letzte: letzteFolge,
      }
      console.warn(
        `[Anime-Kalender] Folge ${ersteFolge.folge.nummer} ist ${ersteFolge.deutsch ? "deutsch" : "nicht deutsch"}, ` +
          `Folge ${letzteFolge.folge.nummer} ${letzteFolge.deutsch ? "deutsch" : "nicht"} — nichts gemeldet. ` +
          'Grenze im Feld unten eintragen oder den vollen Lauf starten.',
      )
    }
  }
  DURCHLAUF.randprobe = null
  DURCHLAUF.randErgebnis = null

  /* Alles auf einmal, statt verstreut zwischen Netflix' eigenen Meldungen. */
  if (DURCHLAUF.protokoll?.length) {
    console.groupCollapsed(
      `[Anime-Kalender] ${DURCHLAUF.protokoll.length} Folge(n) geprüft` +
        (DURCHLAUF.ohneSpur ? `, ${DURCHLAUF.ohneSpur} ohne Tonspur` : '') +
        (DURCHLAUF.stoerung ? `, abgebrochen bei ${DURCHLAUF.stoerung}` : ''),
    )
    console.table(DURCHLAUF.protokoll)
    console.groupEnd()
  }

  videoAbdrehen(false)
  DURCHLAUF.laeuft = false
  durchlaufKnopfZeigen()
  if (DURCHLAUF.stoerung) {
    /*
      Dieselbe Trennung wie am Knopf (30.08.2026): `M7…` meint die Wiedergabe,
      alles andere den Titel. Der Rat „andere Tabs schließen" stand auch hier
      unter jedem Code und schickte bei E103 in die falsche Richtung.
    */
    console.warn(
      `[Anime-Kalender] Abgebrochen — Netflix meldet ${DURCHLAUF.stoerung}. ` +
        (/^M7/.test(DURCHLAUF.stoerung)
          ? 'Andere Netflix-Tabs schließen, dann noch einmal starten.'
          : 'Der Titel ist dort nicht abrufbar — nicht im Angebot, nicht in dieser Region oder noch nicht erschienen.'),
    )
  }
}

/** Eine Folge des Durchlaufs melden — dieselbe Route wie eine Handmeldung. */
/**
 * **Eine ganze Staffel aus zwei Messungen melden — als Annahme gekennzeichnet.**
 *
 * Dieses Projekt sagt sonst: nichts behaupten, was nicht belegt ist. Hier wird
 * bewusst etwas angenommen, und deshalb steht es in jeder einzelnen Meldung:
 * `angenommen: true` und im Klartext in der Notiz, welche zwei Folgen wirklich
 * gemessen wurden.
 *
 * Daniel am 26.08.2026: „ich will mich drauf verlassen bei netflix das 1. und
 * letzte test ausreicht." Seine Entscheidung — aber sie muss im Datensatz
 * ablesbar bleiben, sonst sieht eine Annahme später aus wie eine Messung.
 */
async function randMelden(folgen, befund, bisNummer) {
  /* `bisNummer` steht nur noch in der Notiz — gefiltert wird von den Aufrufern. */
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return 0
  const reihe = gemeinteReihe()
  let gemeldet = 0
  for (const f of folgen) {
    try {
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'netflix',
          url: `https://www.netflix.com/title/${reihe}`,
          sprachen: befund.echte.map((x) => `${x.code}|${x.name}`),
          befund: befund.deutsch ? 'dub' : 'kein_dub',
          titel: stand.serientitel ?? null,
          folge: f.videoId,
          folge_nr: f.nummer,
          staffel: befund.staffel ?? DURCHLAUF.staffel ?? null,
          staffeln: stand.staffeln ?? null,
          serientitel: stand.serientitel ?? null,
          notiz:
            /*
              **Die Notiz ist der einzige Weg, auf dem die Annahme ankommt.**

              Ein eigenes Feld verwirft der Worker — er nimmt nur, was er kennt.
              Die Notiz reicht er dagegen unverändert bis in
              `dub-confirmed.yaml` durch, und dort muss stehen, dass hier
              zwei Folgen gemessen und der Rest angenommen wurde. Sonst sieht
              eine Annahme später aus wie eine Messung.
            */
            `ANGENOMMEN aus Randprobe — gemessen: Folge ${folgen[0].nummer} und ${bisNummer}, ` +
            `dazwischen nicht geprüft` +
            (f.titel ? ` — Folge ${f.nummer}: ${f.titel}` : ``),
        }),
      })
      if (antwort.ok) {
        gemeldet++
        DURCHLAUF.gemeldet.add(f.videoId)
        /*
          **Auch die Abhakliste bekommt es mit.**

          Sie speist die Bereiche im Dialog. Ohne diesen Eintrag stand dort
          nach einer Randprobe über 61 Folgen weiter „gemeldet: E1-2, E61 |
          offen: E3-60" — die Meldungen waren raus, nur wusste die Anzeige
          nichts davon (Daniel, 26.08.2026).
        */
        await merkeErledigt(reihe, befund.staffel ?? DURCHLAUF.staffel ?? null, f.nummer)
      }
    } catch {
      /* Eine verlorene Meldung hält die übrigen nicht auf. */
    }
  }
  await durchlaufStandSchreiben(reihe)
  console.log(`[Anime-Kalender] ${gemeldet} Folge(n) aus der Randprobe gemeldet.`)
  return gemeldet
}

async function durchlaufMelden(folge, echte, deutsch) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return false
  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${gemeinteReihe()}`,
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: deutsch ? 'dub' : 'kein_dub',
        /*
          **Der Player kennt bei einem Film keinen Serientitel.**

          Die erste Film-Meldung kam mit `titel: null` an (Gintama, 30.08.2026).
          Zugeordnet wird zwar über die Adresse, aber ein Eintrag ohne Namen ist
          im Briefkasten nicht nachzusehen — und genau das war am 26.08. schon
          einmal der Grund, warum eine Meldung als verloren galt.

          Der Name steht im Auftrag, den die Prüfliste mitbringt.
        */
        titel: stand.serientitel ?? folge.titel ?? null,
        folge: folge.videoId,
        /*
          **Ein Film hat keine Folge 1** — dieselbe Regel wie bei Amazon
          (22.08.2026: „filme in der liste werden als 1e01 gemeldet, obwohl es
          filme und keine serien sind"). Die Nummer entstünde hier nur, weil der
          Durchlauf intern bei eins zählt.
        */
        folge_nr: folge.film ? null : folge.nummer,
        /*
          Der Player nennt die Staffel manchmal erst nach der ersten Folge —
          dann gilt, was die Liste vorher schon gezeigt hat. Ohne das trug die
          Meldung zu Folge 1 kein Feld, und die Pipeline schlug sie der
          falschen Staffel zu.
        */
        staffel: stand.staffel ?? DURCHLAUF.staffel ?? null,
        staffeln: stand.staffeln ?? null,
        serientitel: stand.serientitel ?? null,
        notiz: `Durchlauf: Folge ${folge.nummer}${folge.titel ? ` — ${folge.titel}` : ''}`,
      }),
    })
    if (!antwort.ok) return false
    await merkeErledigt(gemeinteReihe(), null, folge.nummer)
    return true
  } catch {
    /* Eine verlorene Meldung hält den Durchlauf nicht auf — sie bleibt offen. */
    return false
  }
}

/**
 * **Ein Film hat keine Folgenliste — und braucht trotzdem den Durchlauf.**
 *
 * `DURCHLAUF.folgen` wird aus Netflix' `PreviewModalEpisodeSelectorSeasonEpisodes`
 * gefüllt. Bei einem Film ruft Netflix die Operation nie auf, die Liste bleibt
 * leer, und `durchlaufKnopfZeigen()` steigt bei `!folgen.length` aus. Damit gab
 * es auf der Titelseite eines Films **gar keinen** Weg: kein Melde-Knopf (ohne
 * Tonspur), kein Durchlauf-Knopf (ohne Folgen).
 *
 * Daniel am 30.08.2026: „auf der overview sollte sammel button erscheinen der
 * automatisch player öffnet liest und wieder zurück navigiert … der neue code
 * greift hier nicht."
 *
 * Die Folge, die es zu prüfen gibt, ist der Film selbst — seine `videoId` ist
 * die Kennung aus der Adresse. Damit läuft derselbe Weg wie bei einer Serie:
 * Player öffnen, Tonspur lesen, zurück.
 */
function folgenFuerFilmErgaenzen() {
  try {
    if (DURCHLAUF.folgen.length || DURCHLAUF.laeuft) return
    /*
      **Wo „Erinnern" steht, gibt es nichts zu prüfen.**

      Bei „Pokémon: Blauer Himmel in der Ferne!" bot der Knopf „1 Folge prüfen"
      an, obwohl die Seite nur einen Erinnern-Knopf zeigt — der Titel ist dort
      noch gar nicht abrufbar. Der Klick führte folgerichtig auf `/watch/…` mit
      Fehlercode E103, „Dieser Titel steht nicht zum Streaming zur Verfügung"
      (Daniel, 30.08.2026: „warum kann ich 1 folge prüfen, obwohl da erinnern
      steht und keine folge da ist?").

      Der Melde-Knopf daneben kennt den Fall längst und bietet „Keine Folge da —
      als nicht abrufbar melden" an. Das ist die richtige Antwort; ein
      Durchlauf, der ins Leere fährt, ist keine.
    */
    if (keineFolgeVorhanden()) return
    const reihe = gemeinteReihe()
    if (!reihe) return
    const eintrag = offeneTitel[String(reihe)]
    const staffeln = eintrag?.staffeln ?? []
    if (staffeln.length !== 1 || !staffeln[0]?.film) return
    DURCHLAUF.folgen = [{ nummer: 1, videoId: Number(reihe), titel: eintrag.titel ?? '', staffel: null, film: true }]
  } catch {
    /* Ohne Prüflisten-Eintrag bleibt es beim bisherigen Verhalten. */
  }
}

function durchlaufKnopfZeigen() {
  folgenFuerFilmErgaenzen()
  /*
    **Der Durchlauf über die ganze Reihe ist richtig, nicht zu viel.**

    Eine Fassung vorher hatte ich ihn auf einer geerbten Seite gesperrt: „Blauer
    Himmel in der Ferne!" sei eine Folge, die Reihe habe 54, das wären
    dreiundfünfzig Meldungen zu viel. Daniel hat widersprochen, und er hat
    recht (30.08.2026): „alle melden würde info zu dieser einen speziellen
    episode und allen anderen geben, sonst fragst du mich einzeln nach den 54
    folgen."

    Jede Folge einzeln zu lesen ist genau der Zweck — es beantwortet die Frage
    für den gemeinten Titel **und** für alle übrigen in einem Durchgang. Der
    Fehler saß nie hier, sondern im Zuschnitt des Auftrags.
  */
  /*
    **Während eines Durchlaufs bleibt der Knopf sichtbar — auch im Player.**

    Daniel am 26.08.2026, als der Durchlauf fremde Serien öffnete: „welchen
    knopf soll ich sofort anklicken? ich schließe mal den tab." Der Knopf saß
    nur auf der Titelseite, und der Durchlauf ist die meiste Zeit im Player.
    Es gab also keinen Weg, ihn anzuhalten, außer den Tab zu schließen.

    Ein Notausgang, den man nicht sieht, ist keiner.
  */
  if ((imPlayer() && !DURCHLAUF.laeuft) || !DURCHLAUF.folgen.length) {
    if (DURCHLAUF.leiste) {
      DURCHLAUF.leiste.remove()
      DURCHLAUF.leiste = null
      DURCHLAUF.knopf = null
      DURCHLAUF.grenzKnopf = null
    }
    schutzflaecheZeigen(false)
    return
  }
  if (!DURCHLAUF.knopf) {
    /*
      **Beide Knöpfe in einer Zeile, nicht an zwei Bildschirmrändern.**

      Der Schalter stand zuerst mit `left: 16px` da — also am anderen Ende des
      Fensters, weit weg von dem Knopf, auf den er wirkt (Daniel, 26.08.2026:
      „button ist links am rand statt links neben anderem button").

      Ein gemeinsamer Behälter löst das ohne Rechnerei: Die Breite des
      Hauptknopfes ändert sich mit seiner Beschriftung, jede feste Zahl wäre
      beim nächsten Text falsch.
    */
    DURCHLAUF.leiste = document.createElement('div')
    DURCHLAUF.leiste.className = 'ak-durchlauf-leiste'
    /*
      **Ein Klick in der Leiste gehört uns, nicht Netflix — und auch nicht mir.**

      Der erste Anlauf hing `stopPropagation` in die **Capture**-Phase des
      Behälters. Ein Ereignis läuft dort von oben nach unten: Es erreichte die
      Leiste, wurde gestoppt — und kam bei den Knöpfen darin nie an. Beide
      waren tot, ohne Fehlermeldung (Daniel, 26.08.2026: „button klick hat
      jetzt keinen effekt mehr... nichts passiert", „auch auf limit icon
      passiert nix").

      Gestoppt wird deshalb in der **Bubble**-Phase: Da haben die Knöpfe schon
      reagiert, und nur der Weg nach oben endet hier.

      Netflix schließt sein Overlay aber über einen Listener am Dokument, und
      der kann in der Capture-Phase liegen — dann läuft er vor jedem Stoppen
      hier. Deshalb zusätzlich ein eigener Wächter am Dokument, der Klicks aus
      unserer Leiste dort abfängt.
    */
    for (const art of ['click', 'mousedown', 'pointerdown']) {
      /*
        In der Bubble-Phase, also nachdem die Knöpfe reagiert haben. Netflix
        erfährt von dem Klick nichts mehr — sofern sein eigener Listener nicht
        in der Capture-Phase liegt.
      */
      DURCHLAUF.leiste.addEventListener(art, (e) => e.stopPropagation())
    }
    DURCHLAUF.knopf = document.createElement('button')
    DURCHLAUF.knopf.className = 'ak-durchlauf'
    DURCHLAUF.knopf.addEventListener(
      'click',
      /* Mit Umschalt nur zwei Folgen — zum Erproben, ohne lange zu warten. */
      (e) => {
        /*
          Läuft schon etwas, tut ein Klick nichts mehr.

          Daniel am 26.08.2026: „da steht danach aber immer noch klickbar …
          mach es direkt nicht klickbar, sonst könnte es issues geben."
          Abgebrochen wird über den Knopftext (der zeigt dann „abbrechen") und
          über Escape — ein zweiter Start mitten im Lauf wäre etwas anderes.
        */
        /*
          **Der Klick sagt, was er tut — zweimal geraten reicht.**

          Daniel am 26.08.2026: „nichts passiert bei klick. diagnose oder weiter
          raten?" Ein Klick, der still endet, ist von einem, der gar nicht
          ankommt, nicht zu unterscheiden. Jetzt nennt er den Zustand, an dem er
          scheitert.
        */
        const zustand = {
          laeuft: DURCHLAUF.laeuft,
          offen: durchlaufOffen().length,
          folgenBekannt: DURCHLAUF.folgen.length,
          gemeldet: DURCHLAUF.gemeldet.size,
          grenze: probeGrenze,
          shift: e.shiftKey,
        }
        if (DURCHLAUF.laeuft) {
          console.warn('[Anime-Kalender] Klick verworfen — läuft schon:', zustand)
          return
        }
        /* Ist alles gemeldet, tut ein Klick nichts — der Rechtsklick bleibt. */
        if (!durchlaufOffen().length) {
          console.warn('[Anime-Kalender] Klick verworfen — nichts offen:', zustand)
          return
        }
        console.log('[Anime-Kalender] Durchlauf startet:', zustand)
        /*
          **Zwei Folgen sind die Vorgabe, alle nur mit Umschalt.**

          Daniel am 26.08.2026: „wir haben eigentlich gesagt für debugging
          reicht 2 prüfung, warum kein limit eingebaut?" Es war eingebaut —
          hinter Umschalt+Klick, also genau dort, wo man es beim normalen
          Klicken nicht trifft. Solange etwas erprobt wird, gehört die sparsame
          Fassung auf den Hauptweg und die teure hinter den Griff.
        */
        /* Umschalt kehrt die Einstellung für diesen einen Lauf um. */
        void durchlaufStarten(e.shiftKey ? (probeGrenze ? 0 : 2) : probeGrenze)
      },
    )
    /*
      Der Schalter sitzt am Knopf, nicht in den Optionen: Er wird beim
      Erproben ständig gebraucht und soll dort sein, wo die Arbeit stattfindet.
    */
    DURCHLAUF.grenzKnopf = document.createElement('button')
    DURCHLAUF.grenzKnopf.className = 'ak-durchlauf ak-grenze'
    DURCHLAUF.grenzKnopf.addEventListener('click', () => {
      console.log('[Anime-Kalender] Schalter geklickt, Grenze war', probeGrenze)
      void probeGrenzeUmschalten()
    })
    DURCHLAUF.leiste.appendChild(DURCHLAUF.grenzKnopf)

    DURCHLAUF.knopf.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault()
        void durchlaufStandVergessen()
      },
      false,
    )
    DURCHLAUF.leiste.appendChild(DURCHLAUF.knopf)
    document.body.appendChild(DURCHLAUF.leiste)
    schutzflaecheZeigen(true)
  }
  /**
   * **Der Knopf zeigt, was noch fehlt — nicht, was es insgesamt gibt.**
   *
   * Daniel am 26.08.2026 nach dem ersten vollständigen Lauf: „button sollte
   * nicht erneut klickbar sein nach erfolgreicher prüfung, nur differenz
   * episoden sollte dort auftauchen (zB wenn ep 7 nicht erfolgreich geprüft
   * wurde, alle anderen schon, sollte dort 1 folge prüfen stehen)."
   */
  const offen = durchlaufOffen().length

  /*
    **Der Schalter wird zuerst beschriftet — vor jedem Rücksprung.**

    Er stand am Ende der Funktion, hinter drei `return`. Ist alles gemeldet
    („61 Folgen geprüft"), springt die Funktion vorher heraus, und das Icam
    blieb stehen, obwohl der Zustand längst gewechselt hatte. Daniel am
    26.08.2026: „Schalter geklickt, Grenze war -1 … Grenze war 0 … aber icon
    bleibt gleich."

    Der Klick hat also immer funktioniert. Nur die Anzeige kam nicht mehr dazu.
  */
  if (DURCHLAUF.grenzKnopf) {
    DURCHLAUF.grenzKnopf.hidden = DURCHLAUF.laeuft
    DURCHLAUF.grenzKnopf.textContent =
      probeGrenze === RAND ? '⇤⇥' : probeGrenze ? `⏱ ${probeGrenze}` : '⏱ alle'
    DURCHLAUF.grenzKnopf.title =
      probeGrenze === RAND
        ? 'Prüft nur die erste und die letzte Folge und nimmt an, dass alles dazwischen gleich ist.\nKlick: auf „alle" umstellen.'
        : probeGrenze
          ? `Ein Klick prüft ${probeGrenze} Folgen.\nKlick: auf Anfang und Ende umstellen.`
          : 'Ein Klick prüft alle offenen Folgen.\nKlick: auf zwei begrenzen.'
  }
  if (!DURCHLAUF.laeuft && DURCHLAUF.stoerung) {
    /*
      **Nicht jede Störung heißt „zu viele Tabs".**

      Der Rat stand unter jedem Code. Bei „Pokémon: Blauer Himmel in der Ferne!"
      führte der Durchlauf auf eine Seite mit **E103** — „Dieser Titel steht
      nicht zum Streaming zur Verfügung" —, und der Knopf riet, andere Tabs zu
      schließen (Daniel, 30.08.2026: „falscher error?"). Das schickt in die
      falsche Richtung: Kein geschlossener Tab macht einen Titel verfügbar.

      Netflix' Codes trennen die Fälle sauber: `M7…` meint die Wiedergabe selbst
      (zu viele Streams, Netzwerk), `E1…`, `UI…` und `NSES-…` meinen den Titel.
    */
    const wiedergabe = /^M7/.test(DURCHLAUF.stoerung)
    DURCHLAUF.knopf.textContent = wiedergabe
      ? `⚠ ${DURCHLAUF.stoerung} — andere Tabs schließen`
      : `⚠ ${DURCHLAUF.stoerung} — hier nicht abrufbar`
    DURCHLAUF.knopf.title = wiedergabe
      ? 'Netflix erlaubt nur eine laufende Wiedergabe. Andere Netflix-Tabs schließen, dann hier klicken.'
      : 'Netflix gibt den Titel nicht wieder — nicht im Angebot, nicht in dieser Region oder ' +
        'noch nicht erschienen. In der Prüfliste über „nichts da?" abhaken, wenn die Suche ihn auch nicht findet.'
    DURCHLAUF.knopf.disabled = false
    DURCHLAUF.knopf.classList.remove('ak-fertig')
    return
  }
  if (DURCHLAUF.laeuft) {
    /*
      **Abbrechen lohnt erst ab drei Folgen.**

      Daniel am 26.08.2026: „nach den 2 getesteten folgen bleibt der button
      klickbar, bis nach mehreren sekunden der button zu „61 folgen geprüft"
      wird. mach ihn direkt unklickbar (nicht abbrechbar), macht eh nur sinn
      bei mehr als 2 folgen prüfung."

      Bei zwei Folgen ist der Lauf vorbei, bevor jemand den Knopf trifft — ein
      klickbarer Abbruch verspricht dann etwas, das er nicht mehr einlösen kann.
    */
    const lohntAbbruch = DURCHLAUF.gesamt > 2
    DURCHLAUF.knopf.textContent = lohntAbbruch
      ? `⏹ ${DURCHLAUF.fertig}/${DURCHLAUF.gesamt} — abbrechen`
      : `${DURCHLAUF.fertig}/${DURCHLAUF.gesamt} — läuft`
    DURCHLAUF.knopf.title = lohntAbbruch
      ? 'Läuft — jede Folge wird kurz geöffnet und wieder verlassen. Escape bricht ab.'
      : 'Läuft — gleich fertig.'
    DURCHLAUF.knopf.disabled = !lohntAbbruch
    DURCHLAUF.knopf.classList.remove('ak-fertig')
    return
  }
  if (!offen) {
    DURCHLAUF.knopf.textContent = `✓ ${DURCHLAUF.folgen.length} Folgen geprüft`
    DURCHLAUF.knopf.title =
      'Alles gemeldet. Neue Folgen tauchen hier wieder auf.\nRechtsklick: Stand verwerfen und erneut prüfen.'
    /* Abgeschaltet wäre auch der Rechtsklick tot — also nur still, nicht taub. */
    DURCHLAUF.knopf.disabled = false
    DURCHLAUF.knopf.classList.add('ak-fertig')
    return
  }
  DURCHLAUF.knopf.disabled = false
  DURCHLAUF.knopf.classList.remove('ak-fertig')
  /* Der Knopf nennt, was ein Klick wirklich tut — nicht, was insgesamt offen ist. */
  /*
    **Während eines Laufs verschwindet der Schalter.**

    Daniel am 26.08.2026: „während das skript läuft sollte limit icon nicht
    sichtbar und nicht klickbar sein." Eine Einstellung, die den laufenden
    Durchlauf nicht mehr ändern kann, gehört nicht angeboten — ein Klick darauf
    sähe aus wie eine Wirkung und hätte keine.
  */
  if (DURCHLAUF.grenzKnopf) DURCHLAUF.grenzKnopf.hidden = DURCHLAUF.laeuft

  /*
    **Uneinheitliche Randprobe: hier entscheidet ein Mensch.**

    Ist die erste Folge deutsch und die letzte nicht, liegt die Grenze
    irgendwo dazwischen. Eine Annahme wäre hier eine Behauptung über bis zu
    sechzig Folgen, gestützt auf zwei — genau das, was dieses Projekt sonst
    an fremden Quellen bemängelt.

    Also wird gefragt: Bis zu welcher Folge ist es deutsch? Daniel prüft das
    schneller von Hand, als jeder Durchlauf es könnte. Wer lieber messen will,
    stellt auf „alle" und lässt laufen — beide Wege stehen offen.
  */
  if (DURCHLAUF.randOffen && !DURCHLAUF.laeuft) {
    if (!DURCHLAUF.grenzFeld) {
      DURCHLAUF.grenzFeld = document.createElement('input')
      DURCHLAUF.grenzFeld.className = 'ak-grenzfeld'
      DURCHLAUF.grenzFeld.type = 'number'
      DURCHLAUF.grenzFeld.min = '1'
      DURCHLAUF.grenzFeld.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void grenzeUebernehmen()
      })
      DURCHLAUF.leiste.insertBefore(DURCHLAUF.grenzFeld, DURCHLAUF.leiste.firstChild)
    }
    const { erste, letzte } = DURCHLAUF.randOffen
    DURCHLAUF.grenzFeld.placeholder = `dt. bis Flg. ?`
    DURCHLAUF.grenzFeld.max = String(letzte.folge.nummer)
    DURCHLAUF.grenzFeld.title =
      `Folge ${erste.folge.nummer}: ${erste.deutsch ? 'deutsch' : 'kein Deutsch'}, ` +
      `Folge ${letzte.folge.nummer}: ${letzte.deutsch ? 'deutsch' : 'kein Deutsch'}.\n` +
      'Bis zu welcher Folge ist es deutsch? Zahl eintippen, Enter.'
    DURCHLAUF.grenzFeld.hidden = false
    DURCHLAUF.knopf.classList.add('ak-uneinheitlich')
  } else {
    if (DURCHLAUF.grenzFeld) DURCHLAUF.grenzFeld.hidden = true
    DURCHLAUF.knopf?.classList.remove('ak-uneinheitlich')
  }
  /* Die offenen Folgen selbst — für die Spanne im Knopftext. */
  const liste = durchlaufOffen()
  const jetzt = probeGrenze === RAND ? Math.min(offen, 2) : probeGrenze ? Math.min(offen, probeGrenze) : offen
  DURCHLAUF.knopf.textContent =
    probeGrenze === RAND && offen > 2
      ? `▶ Anfang & Ende (${liste[0]?.nummer ?? 1}–${liste[liste.length - 1]?.nummer ?? offen})`
      : jetzt < offen
        ? `▶ ${jetzt} von ${offen} prüfen`
        : `▶ ${offen} ${offen === 1 ? 'Folge' : 'Folgen'} prüfen`
  const stand =
    offen === DURCHLAUF.folgen.length
      ? `${offen} Folgen sind bekannt. Jede wird kurz geöffnet; das landet in „Weiter ansehen".`
      : `${DURCHLAUF.folgen.length - offen} von ${DURCHLAUF.folgen.length} sind gemeldet, ${offen} fehlen noch.`
  DURCHLAUF.knopf.title =
    stand +
    '\nUmschalt+Klick: kehrt die Grenze für einen Lauf um.' +
    '\nRechtsklick: Stand für einen Lauf übergehen.'
}

/**
 * **Eine Fläche über der ganzen Ecke, die versehentliche Klicks schluckt.**
 *
 * Netflix schließt sein Titel-Overlay bei jedem Klick außerhalb. Wer neben
 * einen unserer Knöpfe trifft, verliert dadurch die Ansicht — und das passiert
 * ständig, weil die Knöpfe klein sind und dicht beieinander liegen.
 *
 * Zwei Anläufe sind vorher gescheitert, beide am selben Denkfehler:
 *  in der **Capture**-Phase, erst am Behälter, dann am
 * Dokument. Ein Ereignis läuft von oben nach unten, bevor es zurückläuft; wer
 * es oben anhält, nimmt es dem Ziel weg. Die Knöpfe waren tot, ohne
 * Fehlermeldung.
 *
 * Diese Fläche macht es anders: Sie **ist** das Ziel. Ein Klick auf sie
 * erreicht Netflix nicht, weil sie darüber liegt — kein Abfangen nötig. Die
 * Knöpfe liegen wiederum über ihr und bekommen ihre Klicks wie zuvor.
 */
let schutzflaeche = null

function schutzflaecheZeigen(sichtbar) {
  if (!sichtbar) {
    schutzflaeche?.remove()
    schutzflaeche = null
    return
  }
  if (schutzflaeche) return
  schutzflaeche = document.createElement("div")
  schutzflaeche.className = "ak-schutzflaeche"
  schutzflaeche.title = "Klicks hier schließen die Netflix-Ansicht nicht"
  /* Ein Klick endet hier — er hat kein Ziel darunter. */
  for (const art of ["click", "mousedown", "pointerdown"]) {
    schutzflaeche.addEventListener(art, (e) => e.stopPropagation())
  }
  document.body.appendChild(schutzflaeche)
}

let uebersichtKnopf = null

function uebersichtZeigen() {
  if (imPlayer() || !offeneTitel || !Object.keys(offeneTitel).length) {
    if (uebersichtKnopf) {
      uebersichtKnopf.remove()
      uebersichtKnopf = null
    }
    return
  }
  if (!uebersichtKnopf) {
    uebersichtKnopf = document.createElement('button')
    uebersichtKnopf.className = 'ak-uebersicht'
    uebersichtKnopf.addEventListener('click', dialogOeffnen)
    document.body.appendChild(uebersichtKnopf)
  }
  /**
   * Gezählt wird, was noch aussteht — nicht, was in der Liste steht.
   *
   * Die Zahl kam aus der mitgelieferten Liste und blieb deshalb stehen, während
   * Daniel Titel abarbeitete (22.08.2026). Sie fällt jetzt mit jedem erledigten
   * Titel, auch bevor ein Datenlauf die Liste neu erzeugt.
   */
  /**
   * **Gezählt werden Staffeln, nicht Adressen.**
   *
   * Daniel am 26.08.2026: „wieso in netflix immer noch anime-kalender checkmark
   * auf button statt 10 zu reporten?"
   *
   * Der Knopf zählte **Adressen** — fünf Reihen, alle angefasst, also ein
   * Häkchen. Die Prüfliste und die Statusanzeige zählen dagegen **Staffeln**,
   * und davon waren elf offen: Unter einer Reihe hängen mehrere, und jede
   * braucht ihre eigene Antwort.
   *
   * Zwei Zähler, zwei Einheiten, dieselbe Frage — dann widersprechen sie sich
   * zwangsläufig. Der Knopf zählt jetzt dasselbe wie alles andere.
   */
  const offeneStaffeln = Object.entries(offeneTitel).reduce((n, [id, e]) => {
    if (istErledigt(id, 'tot')) return n
    const kuerzel = empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) })
    return n + kuerzel.filter((k) => !kuerzelErledigt(id, k)).length
  }, 0)
  /**
   * **Der Knopf zählt, was in der Liste steht — nichts anderes.**
   *
   * Bis zum 30.08.2026 hatte der Worker-Stand Vorrang. Der zählt Verweise
   * ohne Urteil im Datensatz, die Liste zählt, was hier noch anzuklicken ist —
   * zwei Einheiten für dieselbe Frage. Auf Daniels Bildschirm stand deshalb
   * „2 Titel zu prüfen" über einem Knopf mit der Zahl 1.
   *
   * Genau dieser Fehler steht schon im Kommentar darüber, vom 26.08.2026:
   * „Zwei Zähler, zwei Einheiten, dieselbe Frage — dann widersprechen sie sich
   * zwangsläufig." Er kam über den Worker-Stand zurück.
   *
   * Der Stand bleibt trotzdem nützlich: Er weiß, was ein Datenlauf schon
   * eingespielt hat, und das steht jetzt im Tooltip statt am Knopf.
   */
  const offeneAdressen = offeneStaffeln
  const gesamt = Object.entries(offeneTitel).reduce(
    (n, [id, e]) => n + empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) }).length,
    0,
  )
  /**
   * Ist alles gemeldet, zeigt der Knopf keine Zahl mehr — verschwindet aber
   * nicht.
   *
   * Eine „0" wäre ein Arbeitsvorrat, den es nicht gibt (Daniel, 23.08.2026:
   * „dort sollen nur nicht gemeldete gezählt werden"). Ihn ganz zu entfernen
   * nimmt aber den Zugang zur Liste, und die will man auch dann noch öffnen —
   * um nachzusehen, was schon durch ist. Also bleibt er als Häkchen stehen.
   *
   * Ganz weg ist er erst, wenn die Liste selbst leer ist: Dann hat ein
   * Datenlauf die Meldungen übernommen, und es gibt wirklich nichts mehr.
   */
  uebersichtKnopf.classList.toggle('ak-fertig', !offeneAdressen)
  uebersichtKnopf.textContent = offeneAdressen
    ? `Anime-Kalender ${offeneAdressen}`
    : 'Anime-Kalender ✓'
  /* Der Worker-Stand steht hier statt am Knopf: Er beantwortet eine andere
     Frage — was ein Datenlauf schon eingespielt hat. */
  const nachStand = offenLautStand === null ? '' : `\nIm Datensatz noch ohne Urteil: ${offenLautStand}`
  uebersichtKnopf.title =
    (!offeneAdressen
      ? `Alles gemeldet — ${gesamt} Staffeln, zum Nachsehen anklicken`
      : offeneAdressen === gesamt
        ? `${offeneAdressen} Staffeln warten auf eine Prüfung`
        : `${offeneAdressen} von ${gesamt} Staffeln warten noch — der Rest ist gemeldet, aber noch nicht eingespielt`) +
    nachStand
}

let dialog = null

function dialogSchliessen() {
  if (dialog) {
    dialog.remove()
    dialog = null
  }
  document.removeEventListener('keydown', beiEscape)
  // Die Zahl am Knopf mitziehen: Wer im Dialog etwas abgehakt hat, soll das
  // draußen sehen. Am 23.08.2026 stand oben „Alles geprüft" und unten „7".
  uebersichtZeigen()
}

function beiEscape(e) {
  if (e.key === 'Escape') dialogSchliessen()
}

/**
 * Die Liste der offenen Titel, zum Durchklicken.
 *
 * Bewusst ohne Netflix' eigene Bausteine: Die Seite baut ihre Oberfläche bei
 * jedem Wechsel neu auf, und was daran hängt, verschwindet mit ihr. Dieser
 * Dialog steht für sich, direkt am `body`.
 */
async function dialogOeffnen() {
  // Ohne Verbindung gibt es keine Liste -- und keinen stillen Absturz.
  if (!verbindungLebt()) {
    if (uebersichtKnopf) {
      uebersichtKnopf.textContent = 'Erweiterung neu geladen — Seite aktualisieren'
    }
    return
  }
  if (dialog) {
    dialogSchliessen()
    return
  }
  /**
   * Den Stand frisch holen, nicht den vom Seitenaufbau nehmen.
   *
   * Gemeldet wird im Player (`/watch/…`), nachgesehen auf der Stöberseite —
   * das sind zwei Seitenaufrufe mit je eigenem Skript. Was der eine speichert,
   * kennt der andere erst nach einem Blick in den Speicher.
   */
  try {
    const x = (await speicherLesen('erledigt')) ?? {}
    erledigt = x.erledigt ?? {}
  } catch {
    /* Dann eben mit dem Stand von vorhin. */
  }
  dialog = document.createElement('div')
  dialog.className = 'ak-dialog'

  const kasten = document.createElement('div')
  kasten.className = 'ak-kasten'
  dialog.appendChild(kasten)

  const kopf = document.createElement('div')
  kopf.className = 'ak-kopf'
  /**
   * Offenes zuerst, Erledigtes ans Ende.
   *
   * Daniel am 22.08.2026: „7seeds already checked but still in list." Die Liste
   * selbst entsteht beim Datenlauf und weiß nichts von Meldungen, die noch im
   * Briefkasten liegen — bis dahin steht ein abgearbeiteter Titel weiter drin.
   * Er soll dann wenigstens nicht mehr obenauf liegen.
   */
  const eintraege = Object.entries(offeneTitel).sort((a, b) => {
    const d = Number(fertig(a[0], a[1])) - Number(fertig(b[0], b[1]))
    return d || a[1].titel.localeCompare(b[1].titel, 'de')
  })
  const titelzeile = document.createElement('strong')
  // Dieselbe Zahl wie am Knopf — sonst steht oben 146, während unten 78 steht.
  const nochOffen = eintraege.filter(([id, e]) => !fertig(id, e)).length
  titelzeile.textContent = nochOffen ? `${nochOffen} Titel zu prüfen` : 'Alles geprüft'
  kopf.appendChild(titelzeile)

  const suche = document.createElement('input')
  suche.className = 'ak-suche'
  suche.type = 'search'
  suche.placeholder = 'Suchen'
  kopf.appendChild(suche)

  /**
   * Erledigtes ist standardmäßig weg.
   *
   * Es blieb sichtbar, damit erkennbar ist, was schon durch ist — bei elf
   * abgehakten Zeilen und null offenen ist das aber nur noch Ballast (Daniel,
   * 22.08.2026: „warum sehe ich diese 11 noch in der liste ausgegraut?").
   * Wer nachsehen will, klappt sie auf.
   */
  if (eintraege.length - nochOffen > 0) {
    const umschalter = document.createElement('button')
    umschalter.className = 'ak-umschalter'
    umschalter.textContent = `${eintraege.length - nochOffen} gemeldet zeigen`
    umschalter.addEventListener('click', () => {
      const zeigen = kasten.classList.toggle('ak-mit-erledigten')
      umschalter.textContent = zeigen
        ? `${eintraege.length - nochOffen} gemeldet ausblenden`
        : `${eintraege.length - nochOffen} gemeldet zeigen`
    })
    kopf.appendChild(umschalter)

    /*
      **Wann das Gemeldete hier wieder verschwindet.**

      Ein gemeldeter Titel bleibt in der Liste stehen, bis der nächste Lauf ihn
      übernommen hat — die Liste entsteht beim Datenlauf und weiß nichts vom
      Briefkasten. Ohne die Uhrzeit ist von außen nicht zu unterscheiden, ob der
      Lauf noch aussteht oder seine Arbeit nicht getan hat (Daniel, 26.08.2026:
      „so kann ich es gegenprüfen, dass der lauf sein job gemacht hat").
    */
    const lauf = document.createElement('span')
    lauf.className = 'ak-lauf'
    lauf.title = 'Der stündliche Datenlauf holt die Meldungen ab und schreibt sie in den Kalender. GitHub startet ihn oft ein paar Minuten später.'
    const zeigeLauf = () => {
      const z = naechsteUebernahme()
      const uhr = `${String(z.getHours()).padStart(2, '0')}:${String(z.getMinutes()).padStart(2, '0')}`
      lauf.textContent = `Übernahme ab ${uhr} — danach hier weg`
    }
    zeigeLauf()
    /* Bleibt der Dialog lange offen, wandert die Uhrzeit mit. */
    const takt = setInterval(() => {
      if (!lauf.isConnected) return clearInterval(takt)
      zeigeLauf()
    }, 60000)
    kopf.appendChild(lauf)
  }

  const zu = document.createElement('button')
  zu.className = 'ak-zu'
  zu.textContent = '×'
  zu.title = 'Schließen (Esc)'
  zu.addEventListener('click', dialogSchliessen)
  kopf.appendChild(zu)
  kasten.appendChild(kopf)

  /**
   * Eine Zeile je Titel: Name, die Folgen zum Anklicken, ihr Stand.
   *
   * Die Folgenkürzel sind selbst Verweise — ein Klick öffnet die Titelseite in
   * einem neuen Tab. Direkt auf eine Folge zu verweisen geht nicht: Netflix
   * leitet dann auf eine Folgen-Kennung um, die unser Datensatz nicht kennt
   * (neun von zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen).
   */
  const liste = document.createElement('div')
  liste.className = 'ak-liste'
  for (const [id, eintrag] of eintraege) {
    const zeile = document.createElement('div')
    zeile.className = 'ak-zeile'
    zeile.dataset.suchtext = eintrag.titel.toLowerCase()

    const link = document.createElement('a')
    link.className = 'ak-titel'
    /*
      **Immer auf die Titelseite, auch bei einem Film** (Daniel, 30.08.2026:
      „die links in der prüfliste öffnen direkt die player, stattdessen sollen
      sie auf overview navigieren").

      Der Umweg über `/watch/` sparte einen Klick und kostete die Übersicht: Der
      Player startet sofort die Wiedergabe, und wer nur nachsehen wollte, steht
      mitten im Film. Auf der Titelseite entscheidet Daniel selbst, wann er
      abspielt — dort liest die Erweiterung dann die Tonspur.
    */
    link.href = `https://www.netflix.com/title/${id}`
    /*
      **Netflix bleibt im selben Tab** (Daniel, 30.08.2026).

      Wer die Liste abarbeitet, öffnet Titel für Titel — bei zwanzig Einträgen
      sind das zwanzig Tabs, die alle offen bleiben. Und Netflix ist eine
      Einseiten-Anwendung: Im selben Tab wechselt sie ohne Neuladen, die Liste
      baut sich danach von selbst wieder auf.

      Der aniSearch-Verweis daneben behält `_blank`: Er ist zum Nachschlagen
      gedacht, nicht zum Weiterarbeiten — dort würde ein Wechsel die Netflix-
      Seite verlassen, auf der gerade gemeldet werden soll.
    */
    link.rel = 'noreferrer noopener'
    link.textContent = eintrag.titel || `Titel ${id}`

    /*
      **Ein zweiter Verweis: aniSearch.**

      Daniel am 28.08.2026: „kannst du die anilist links mit anisearch ersetzen
      in der melde extension?" Hier gab es bis dahin gar keinen. aniSearch fuehrt
      deutsche Titel und eine Episodenliste mit deutschen Folgentiteln — bei
      einer Reihe, die Netflix anders schneidet als wir, ist das die Seite, die
      es klaert. Der Titel-Link fuehrt weiterhin zu Netflix, denn dort wird
      gearbeitet.
    */
    let asLink = null
    if (eintrag.asId) {
      asLink = document.createElement('a')
      asLink.className = 'ak-quelle'
      asLink.href = 'https://www.anisearch.de/anime/' + eintrag.asId + '/episodes'
      asLink.target = '_blank'
      asLink.rel = 'noreferrer noopener'
      asLink.textContent = 'aniSearch'
      asLink.title = 'Deutsche Folgentitel und Anbieter bei aniSearch nachsehen'
      asLink.style.cssText = 'margin-left:8px;font-size:11px;color:#7cc4ff;text-decoration:underline'
    }
    /**
     * Merken, welchen Titel er gerade öffnet.
     *
     * Netflix nennt im Player nicht immer dieselbe Reihen-Kennung, unter der
     * wir den Titel führen: Bei Jujutsu Kaisen meldete sich die Seite als
     * `80237957`, unser Datensatz kennt `81278456` (22.08.2026). Gespeichert
     * würde dann unter einer Kennung, die in dieser Liste nicht vorkommt — und
     * nichts färbt sich.
     *
     * `chrome.storage.local` teilen alle Tabs. Der neue Tab findet hier also,
     * was von hier aus angeklickt wurde, und trägt seinen Befund an der
     * richtigen Zeile ein.
     */
    link.addEventListener('click', () => {
      void speicherSchreiben({ zuletztGeoeffnet: { id: String(id), zeit: Date.now() } })
    })
    zeile.appendChild(link)
    if (asLink) zeile.appendChild(asLink)

    const folgen = document.createElement('div')
    folgen.className = 'ak-folgen'
    const staffeln = staffelnVon(id, eintrag)

    /**
     * **Alle Folgen als Bereiche — gemeldet und offen getrennt.**
     *
     * Daniel am 26.08.2026: „der dialog muss alle episoden auflisten, nicht
     * nur erste und letzte der staffel nach unserer umstellung … weil das evtl
     * zu viele zum auflisten sind, sollte ein von bis aufzählung sein."
     *
     * Vorher standen dort zwei Kacheln je Staffel — die erste und die letzte
     * Folge, als Empfehlung, wo anzufangen sei. Seit der Durchlauf jede Folge
     * einzeln meldet, ist das die falsche Auskunft: Es zählt, **welche** Folgen
     * durch sind.
     *
     * Bei One Piece wären das über tausend Kacheln, deshalb Bereiche:
     * `S1 E1-10, E12` statt elf Kästchen.
     */
    for (const st of staffeln) {
      /*
        **Ein Film hat keine Folge zum Anklicken — „offen: E1" war eine
        Anweisung ins Leere** (Daniel, 30.08.2026, an „Gintama the Movie" und
        „Pokémon: Blauer Himmel in der Ferne!").

        `empfohleneFolgen()` kennt den Fall seit dem 22.08. und schreibt dort
        „Film". Diese Anzeige hier kannte ihn nicht: Sie baut ihre Kacheln aus
        `folgen`, und bei einem Film ist das die Eins. Wer darauf klickte,
        landete auf einer Seite ohne Folgenliste — und ohne Melde-Knopf.
      */
      if (st.film) {
        /* Dasselbe Kürzel wie in `empfohleneFolgen()` und `fertig()` — sonst
           finden Meldung und Abgleich einander nicht. */
        const kuerzel = staffeln.length > 1 ? `Film ${st.nr}` : 'Film'
        const durch = kuerzelErledigt(id, kuerzel)
        const zeileFilm = document.createElement('div')
        zeileFilm.className = 'ak-staffelzeile'
        const marke = document.createElement('span')
        marke.className = durch ? 'ak-folge ak-fertig' : 'ak-folge'
        marke.textContent = durch ? 'Film gemeldet' : 'Film — öffnen und melden'
        marke.title = 'Ein Film wird nicht je Folge geprüft: öffnen, Tonspur ansehen, melden.'
        zeileFilm.appendChild(marke)
        folgen.appendChild(zeileFilm)
        continue
      }
      const erste = Number.isFinite(st.erste) ? st.erste : 1
      const alle = []
      for (let i = 0; i < (st.folgen ?? 0); i++) alle.push(erste + i)
      if (!alle.length) continue

      const gemeldet = alle.filter((n) => kuerzelErledigt(id, `${st.nr}e${String(n).padStart(2, "0")}`))
      const offen = alle.filter((n) => !gemeldet.includes(n))

      const zeileSt = document.createElement("div")
      zeileSt.className = "ak-staffelzeile"

      const name = document.createElement("span")
      name.className = "ak-staffelname"
      name.textContent = staffeln.length > 1 ? `S${st.nr}` : ""
      if (name.textContent) zeileSt.appendChild(name)

      if (gemeldet.length) {
        const marke = document.createElement("span")
        marke.className = "ak-folge ak-fertig"
        marke.textContent = `gemeldet: E${alsBereiche(gemeldet).join(", E")}`
        marke.title = `${gemeldet.length} von ${alle.length} Folgen dieser Staffel sind gemeldet`
        zeileSt.appendChild(marke)
      }
      if (offen.length) {
        const marke = document.createElement("span")
        marke.className = "ak-folge"
        marke.textContent = `offen: E${alsBereiche(offen).join(", E")}`
        marke.title = `${offen.length} von ${alle.length} Folgen dieser Staffel fehlen noch`
        zeileSt.appendChild(marke)
      }
      folgen.appendChild(zeileSt)
    }

    if (!folgen.childElementCount) {
      const leer = document.createElement("span")
      leer.className = "ak-hinweis"
      leer.textContent = "keine Folgenangabe"
      folgen.appendChild(leer)
    }
    zeile.appendChild(folgen)

    /**
     * Der Knopf für einen Verweis, der ins Leere führt.
     *
     * Er steht bewusst am Rand und ohne Farbe: Er wird selten gebraucht, und
     * ein Fehlklick meldet eine Serie als verschwunden, die es noch gibt.
     * Deshalb fragt er einmal nach.
     */
    const tot = document.createElement('button')
    tot.className = 'ak-tot'
    tot.textContent = istErledigt(id, 'tot') ? 'nichts da ✓' : 'nichts da?'
    tot.disabled = istErledigt(id, 'tot')
    /**
     * „Tot" heißt hier: dort ist nichts abzuspielen.
     *
     * Das trifft drei Fälle, und alle drei sind Daniel begegnet: Die Adresse
     * leitet auf die Startseite um; die Titelseite bietet nur „Erinnern"; oder
     * Netflix zeigt eine Folgenliste, die leer ist und beim Klick mit einem
     * Fehler antwortet (One Punch Man, 22.08.2026). In allen dreien führt der
     * Verweis zu nichts, und genau das wird gemeldet.
     */
    tot.title =
      'Dort ist nichts abzuspielen — Adresse leitet um, keine Folgen, oder Netflix meldet einen Fehler'
    tot.addEventListener('click', async () => {
      if (tot.dataset.sicher !== 'ja') {
        tot.dataset.sicher = 'ja'
        tot.textContent = 'wirklich?'
        tot.classList.add('ak-frage')
        setTimeout(() => {
          if (tot.dataset.sicher !== 'ja') return
          tot.dataset.sicher = ''
          tot.textContent = 'nichts da?'
          tot.classList.remove('ak-frage')
        }, 4000)
        return
      }
      tot.disabled = true
      tot.textContent = '…'
      const { ok, text } = await totMelden(id, eintrag.titel)
      tot.classList.remove('ak-frage')
      tot.textContent = ok ? 'nichts da ✓' : text
      tot.disabled = ok
      if (ok) zeile.classList.add('ak-abgehakt')
    })
    zeile.appendChild(tot)

    // Was durch ist, bleibt sichtbar, tritt aber zurück.
    /*
      `fertig()` beantwortet dieselbe Frage und kennt die Sonderfälle — etwa,
      dass ein Titel ohne empfohlene Folgen nicht als erledigt gilt. Beim Umbau
      auf Bereiche fiel die lokale Variable `empfohlen` weg; diese Zeile blieb
      stehen und riss den ganzen Dialog mit.
    */
    if (fertig(id, eintrag)) {
      zeile.classList.add('ak-abgehakt')
    }
    liste.appendChild(zeile)
  }
  kasten.appendChild(liste)

  suche.addEventListener('input', () => {
    const wort = suche.value.trim().toLowerCase()
    for (const zeile of liste.children) {
      zeile.style.display = !wort || zeile.dataset.suchtext.includes(wort) ? '' : 'none'
    }
  })

  // Ein Klick neben den Kasten schließt — wie überall sonst auch.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialogSchliessen()
  })
  document.addEventListener('keydown', beiEscape)
  document.body.appendChild(dialog)
  suche.focus()
}

// --- Start ------------------------------------------------------------------

/**
 * Netflix wechselt die Seite ohne Neuladen — der Knopf muss mitbekommen, ob
 * gerade der Player läuft.
 *
 * `popstate` allein genügt nicht: Es feuert beim Zurück-Knopf, nicht bei einem
 * Klick auf eine Kachel. Ein Beobachter über den ganzen Baum wäre das andere
 * Extrem — Netflix baut beim Stöbern unablässig Kacheln um, und jede Änderung
 * riefe die Prüfung erneut auf. Ein Blick pro Sekunde kostet nichts und merkt
 * jeden Wechsel früh genug.
 *
 * `history.pushState` zu überschreiben wäre der kürzeste Weg und der falsche:
 * Genau daran ist der Netzwerk-Mitschnitt zweimal gescheitert (NSES-UHX,
 * 22.08.2026). An fremden Seiten wird nichts ersetzt, was sie selbst aufrufen.
 */
let letzterPfad = location.pathname
function pfadPruefen() {
  if (location.pathname === letzterPfad) return
  letzterPfad = location.pathname
  dialogSchliessen()
  uebersichtZeigen()
  /*
    **Auch die Durchlauf-Leiste gehört bei jedem Wechsel neu gezeichnet.**

    Sie blieb beim Wechsel in den Player stehen und kam beim Zurücknavigieren
    nicht wieder, weil hier niemand nach ihr sah. Daniel am 26.08.2026: „wenn
    ich folge abspiele und dann limit icon anklicke verschwinden backdrop und
    die buttons", und danach: „navigation zurück bringt diese elemente nicht
    zurück."

    Beides dieselbe Lücke: Ohne diesen Aufruf zeichnet nur ein Klick neu — und
    was dabei passiert, sieht aus, als hätte der Klick es verursacht.
  */
  /*
    **Eine Störung gehört zu der Wiedergabe, bei der sie auftrat.**

    Sie blieb am Knopf stehen, auch nachdem der Durchlauf den Player längst
    verlassen hatte — bei „Pokémon" stand nach der Rückkehr auf die Titelseite
    noch „⚠ M7355", während die Seite zuvor E103 gezeigt hatte (Daniel,
    30.08.2026, mit zwei Bildern). Zwei verschiedene Fehler, einer davon aus
    einer Sitzung, die es nicht mehr gibt.

    Beim Pfadwechsel ist sie damit erledigt: Was auf der neuen Seite stört,
    stellt `stoerung()` dort neu fest.
  */
  DURCHLAUF.stoerung = null
  durchlaufKnopfZeigen()
}
window.addEventListener('popstate', pfadPruefen)
setInterval(pfadPruefen, 1000)

/**
 * **Der Melde-Knopf gehört in den Takt, nicht nur an eine Nachricht.**
 *
 * Er wurde bisher allein aus dem Nachrichtenempfänger gezeichnet — also nur,
 * wenn der Leser etwas meldet. Auf einer Titelseite ohne Player kommt keine
 * Nachricht, und damit lief `knopfZeigen()` dort nie.
 *
 * Sichtbar wurde das an „Pokémon" (Daniel, 30.08.2026, mit Diagnosebericht):
 * `istGesucht: false`, also hätte seit 3.99 „Steht nicht auf der Prüfliste"
 * dastehen müssen — im Bericht steht `knopf: null`. Nicht die Beschriftung
 * fehlte, sondern der Aufruf.
 *
 * Ein eigener Takt und nicht in `pfadPruefen`: Das steigt bei unverändertem
 * Pfad sofort aus, und genau dort steht der Fall — dieselbe Seite, nur die
 * Prüfliste kommt Sekunden später aus dem Speicher.
 */
setInterval(() => {
  try {
    knopfZeigen()
  } catch {
    /* Vor dem Laden des Speichers gibt es noch nichts zu zeichnen. */
  }
}, 1000)

/**
 * Der erste Blick wartet auf den gespeicherten Stand.
 *
 * `uebersichtZeigen()` zählt, was noch offen ist — und das steht in `erledigt`,
 * das aus `chrome.storage.local` kommt und damit asynchron. Beim Start lief die
 * Zählung vorher: Der Knopf zeigte 7, während der Dialog daneben „Alles
 * geprüft" sagte (Daniel, 23.08.2026, nach dem Neuladen).
 */
void erledigtGeladen.then(() => uebersichtZeigen())

/*
  Den Stand holen — einmal beim Laden, danach alle fünf Minuten. Er ändert sich
  nur, wenn ein Datenlauf durch ist oder Daniel etwas meldet; das Melden setzt
  ihn selbst zurück (siehe unten), häufiger nachzufragen brächte dieselbe
  Antwort.
*/
void standHolen()
setInterval(() => void standHolen(), 5 * 60 * 1000)

/**
 * Einen Verweis als tot melden — direkt aus der Liste, ohne ihn zu öffnen.
 *
 * Daniel am 22.08.2026: „7th time loop link is dead (gets redirected to
 * homepage) — make possible to mark entries as dead links." Vorher hätte er die
 * Seite öffnen, das Ausbleiben des Players abwarten und den Knopf drücken
 * müssen — für eine Adresse, die gar nicht mehr existiert.
 *
 * Gemeldet wird derselbe Befund, den die Titelseite ohne abspielbare Folge
 * liefert: `weg`. Die Pipeline entfernt den Verweis daraufhin aus dem Datensatz.
 */
async function totMelden(id, titel) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return { ok: false, text: 'Kein Token — Rechtsklick aufs Symbol, dann Optionen' }
  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${id}`,
        sprachen: [],
        befund: 'weg',
        titel: titel || null,
        notiz: 'Aus der Übersicht als toter Verweis gemeldet — leitet auf die Startseite um',
      }),
    })
    if (!antwort.ok) {
      const daten = await antwort.json().catch(() => ({}))
      return { ok: false, text: daten.error ?? `Fehler ${antwort.status}` }
    }
    await merkeTot(id)
    return { ok: true, text: 'als tot gemeldet' }
  } catch (err) {
    return { ok: false, text: `Nicht erreichbar: ${err.message}` }
  }
}

/**
 * Der Dialog hört zu, statt beim Öffnen einmal nachzusehen.
 *
 * Geprüft wird in einem zweiten Tab: Titel anklicken, Folge starten, Tab
 * schließen. Die Übersicht bleibt derweil offen und bekam davon nichts mit —
 * sie hatte ihren Stand beim Öffnen gelesen. `chrome.storage.onChanged` feuert
 * auch, wenn ein anderer Tab schreibt; das ist der Weg dorthin.
 */
/**
 * Auch das Anmelden wirft, wenn die Verbindung tot ist.
 *
 * Der Listener steht auf oberster Ebene und laeuft beim Skriptstart -- ohne
 * diese Pruefung stirbt das ganze Skript, bevor es den Knopf zeichnet.
 */
if (verbindungLebt())
  chrome.storage.onChanged.addListener((aenderungen, bereich) => {
  if (bereich !== 'local') return
  // Ein Klick in einem anderen Tab sagt uns, welcher Titel gemeint ist.
  if (aenderungen.zuletztGeoeffnet) {
    zuletztGeoeffnet = aenderungen.zuletztGeoeffnet.newValue ?? null
    uebersichtZeigen()
  }
  // Eine neu gemeldete Staffelaufteilung ändert die empfohlenen Folgen und
  // damit auch, was als erledigt gilt.
  if (aenderungen.anbieterStaffeln) {
    anbieterStaffeln = aenderungen.anbieterStaffeln.newValue ?? {}
    uebersichtZeigen()
  }
  if (!aenderungen.erledigt) return
  erledigt = aenderungen.erledigt.newValue ?? {}
  // Die Zahl am Knopf gehört mit aktualisiert — sie zählt dasselbe.
  uebersichtZeigen()
  if (!dialog) return
  // Neu zeichnen, aber die Suche und die Rollposition behalten — sonst
  // springt die Liste weg, während jemand sie durchgeht.
  const wort = dialog.querySelector('.ak-suche')?.value ?? ''
  const stelle = dialog.querySelector('.ak-liste')?.scrollTop ?? 0
  dialogSchliessen()
  void dialogOeffnen().then(() => {
    const suche = dialog?.querySelector('.ak-suche')
    if (suche && wort) {
      suche.value = wort
      suche.dispatchEvent(new Event('input'))
    }
    const liste = dialog?.querySelector('.ak-liste')
    if (liste) liste.scrollTop = stelle
  })
})

/**
 * **Ein Diagnosebericht für Netflix — denselben Griff wie bei Amazon.**
 *
 * Daniel am 30.08.2026: „diagnose download geht nicht." `ak-report` gibt es nur
 * in `amazon.js`; auf Netflix lief das Ereignis ins Leere, und
 * `dispatchEvent` gibt trotzdem `true` zurück — es heißt „nicht abgebrochen",
 * nicht „jemand hat zugehört".
 *
 * Ohne Bericht bleibt jede Frage nach dem „warum lässt sich das nicht melden"
 * eine Vermutung. Genau dafür gibt es ihn bei Amazon seit dem 28.08., und drei
 * Fälle an einem Tag waren ohne ihn nicht auswertbar.
 *
 *     document.dispatchEvent(new CustomEvent('ak-report'))
 *
 * `window.__akDiagnose()` im Leser bleibt daneben bestehen — es sieht die
 * GraphQL-Antworten, an die dieses Skript nicht herankommt. Wo es erreichbar
 * ist, wandert sein Ergebnis mit in den Bericht.
 */
function nfBericht() {
  const sicher = (f) => {
    try {
      return f()
    } catch (err) {
      return { fehler: String(err?.message ?? err) }
    }
  }
  return {
    erzeugtAm: new Date().toISOString(),
    version: sicher(() => chrome.runtime.getManifest().version),
    adresse: location.pathname + location.search,
    stand: sicher(() => ({
      reihe: stand.reihe,
      folgeNr: stand.folgeNr,
      staffel: stand.staffel,
      titel: stand.titel,
      spuren: stand.spuren,
      serientitel: stand.serientitel,
    })),
    /* Die drei Fragen, an denen der Knopf hängt. */
    lage: sicher(() => ({
      imPlayer: imPlayer(),
      istGesucht: istGesucht(),
      gemeinteReihe: gemeinteReihe(),
      keineFolgeVorhanden: keineFolgeVorhanden(),
      erscheinungsdatum: erscheinungsdatum(),
      stoerung: stoerung(),
    })),
    /* Steht der Titel auf der Liste, und als was? */
    auftrag: sicher(() => {
      const r = gemeinteReihe()
      const e = r ? offeneTitel[String(r)] : null
      return e ? { titel: e.titel, asId: e.asId, staffeln: e.staffeln } : null
    }),
    durchlauf: sicher(() => ({
      folgen: DURCHLAUF.folgen.length,
      nummern: DURCHLAUF.folgen.slice(0, 5).map((f) => ({ nummer: f.nummer, videoId: f.videoId })),
      laeuft: DURCHLAUF.laeuft,
      abbruch: DURCHLAUF.abbruch,
      knopf: DURCHLAUF.knopf?.textContent ?? null,
    })),
    knopf: sicher(() => document.querySelector('.ak-melder')?.textContent ?? null),
    zuletztGeoeffnet: sicher(() => zuletztGeoeffnet),
    listeGesamt: sicher(() => Object.keys(offeneTitel).length),
    /* Was der Leser sieht — er kennt die GraphQL-Antworten. */
    leser: sicher(() => (typeof window.__akDiagnose === 'function' ? window.__akDiagnose() : 'nicht erreichbar')),
  }
}

try {
  document.addEventListener('ak-report', () => {
    const daten = JSON.stringify(nfBericht(), null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([daten], { type: 'application/json' }))
    a.download = `anime-kalender-netflix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    console.log('[Anime-Kalender] Netflix-Diagnosebericht heruntergeladen.')
  })
} catch {
  /* Ohne document gibt es nichts zu berichten. */
}
