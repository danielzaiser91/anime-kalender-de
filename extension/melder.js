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
function gemeinteReihe() {
  if (stand.reihe && offeneTitel[String(stand.reihe)] !== undefined) return stand.reihe
  if (
    zuletztGeoeffnet?.id &&
    offeneTitel[zuletztGeoeffnet.id] !== undefined &&
    Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 5 * 60 * 1000 &&
    nameStimmt()
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
      nameStimmt(),
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
    // Beim Wechsel auf einen Titel, der nicht auf der Liste steht, muss der
    // Knopf des vorigen weg — Netflix wechselt die Seite ohne Neuladen.
    if (!istGesucht()) {
      knopfEntfernen()
      return
    }
    knopfZeigen()
    vielleichtSenden()
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
    return { text: 'Auf Abspielen klicken, dann läuft es von selbst', klasse: 'ak-leer', aktiv: false }
  }
  const { deutsch } = urteil(spuren)
  const wo = stand.folgeNr
    ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})`
    : ''
  return deutsch
    ? { text: `Deutsche Tonspur${wo} — wird gesendet …`, klasse: 'ak-ja', aktiv: false }
    : { text: `Keine deutsche Tonspur${wo} — wird gesendet …`, klasse: 'ak-nein', aktiv: false }
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
  if ((!reihe && !spuren) || !istGesucht()) {
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
const erledigtGeladen = chrome.storage.local
  .get(['erledigt', 'anbieterStaffeln', 'zuletztGeoeffnet'])
  .then((x) => {
    erledigt = x.erledigt ?? {}
    anbieterStaffeln = x.anbieterStaffeln ?? {}
    zuletztGeoeffnet = x.zuletztGeoeffnet ?? null
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
function fertig(id, eintrag) {
  if (istErledigt(id, 'tot')) return true
  const kuerzel = empfohleneFolgen({ ...eintrag, staffeln: staffelnVon(id, eintrag) })
  /**
   * **Keine Empfehlung heißt nicht „erledigt".**
   *
   * `[].every(…)` ist immer wahr — ein Titel ohne empfohlene Folgen galt damit
   * als vollständig geprüft. Nach einer einzigen Meldung fiel die Zahl am Knopf
   * von 11 auf 0 (Daniel, 22.08.2026), weil die frisch gemeldete Struktur bei
   * mehreren Titeln keine offene Staffel mehr übrig ließ und die leere Liste
   * jedes Mal als „fertig" durchging.
   *
   * Wo nichts zu empfehlen ist, ist auch nichts belegt.
   */
  if (!kuerzel.length) return false
  return kuerzel.every((k) => kuerzelErledigt(id, k))
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
const PRUEFSTAND = 'https://anime-kalender.de/data/pruefstand.json'
const BRIEFKASTEN = 'https://newsletter.animekalender.workers.dev/pruefung?zaehlen=1'

/** Was die Statusanzeige für Netflix als offen führt — `null`, solange unbekannt. */
let offenLautStand = null

async function standHolen() {
  try {
    const [stand, kasten] = await Promise.all([
      fetch(PRUEFSTAND, { cache: 'no-store' }).then((r) => r.json()),
      fetch(BRIEFKASTEN, { cache: 'no-store' })
        .then((r) => r.json())
        .then((x) => x.imBriefkasten ?? {})
        .catch(() => ({})),
    ])
    const netflix = (stand.anbieter ?? []).find((a) => a.plattform === 'netflix')
    if (!netflix) return
    offenLautStand = Math.max(0, netflix.offen - (kasten.netflix ?? 0))
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
  laeuft: false,
  abbruch: false,
  fertig: 0,
  gesamt: 0,
  knopf: null,
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

async function durchlaufStarten() {
  if (DURCHLAUF.laeuft) {
    DURCHLAUF.abbruch = true
    return
  }
  const titelseite = location.pathname
  const offen = DURCHLAUF.folgen.filter((f) => !istErledigt(gemeinteReihe(), `${f.nummer}`))
  if (!offen.length) return

  DURCHLAUF.laeuft = true
  DURCHLAUF.abbruch = false
  DURCHLAUF.fertig = 0
  DURCHLAUF.gesamt = offen.length
  durchlaufKnopfZeigen()

  for (const f of offen) {
    if (DURCHLAUF.abbruch) break
    videoAbdrehen(false)
    gehe(`/watch/${f.videoId}`)

    /* Warten, bis der Player die Liste hat — höchstens 20 Sekunden. */
    let spuren = null
    for (let i = 0; i < 100 && !spuren && !DURCHLAUF.abbruch; i++) {
      await new Promise((r) => setTimeout(r, 200))
      spuren = stand.spuren?.length ? stand.spuren : null
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
      await durchlaufMelden(f, echte, deutsch)
      DURCHLAUF.fertig++
    } else if (spuren) {
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

  videoAbdrehen(false)
  DURCHLAUF.laeuft = false
  durchlaufKnopfZeigen()
}

/** Eine Folge des Durchlaufs melden — dieselbe Route wie eine Handmeldung. */
async function durchlaufMelden(folge, echte, deutsch) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return
  try {
    await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${gemeinteReihe()}`,
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: deutsch ? 'dub' : 'kein_dub',
        titel: stand.serientitel ?? null,
        folge: folge.videoId,
        folge_nr: folge.nummer,
        staffel: stand.staffel ?? null,
        staffeln: stand.staffeln ?? null,
        serientitel: stand.serientitel ?? null,
        notiz: `Durchlauf: Folge ${folge.nummer}${folge.titel ? ` — ${folge.titel}` : ''}`,
      }),
    })
    await merkeErledigt(gemeinteReihe(), null, folge.nummer)
  } catch {
    /* Eine verlorene Meldung hält den Durchlauf nicht auf. */
  }
}

function durchlaufKnopfZeigen() {
  /*
    **Während eines Durchlaufs bleibt der Knopf sichtbar — auch im Player.**

    Daniel am 26.08.2026, als der Durchlauf fremde Serien öffnete: „welchen
    knopf soll ich sofort anklicken? ich schließe mal den tab." Der Knopf saß
    nur auf der Titelseite, und der Durchlauf ist die meiste Zeit im Player.
    Es gab also keinen Weg, ihn anzuhalten, außer den Tab zu schließen.

    Ein Notausgang, den man nicht sieht, ist keiner.
  */
  if ((imPlayer() && !DURCHLAUF.laeuft) || !DURCHLAUF.folgen.length) {
    if (DURCHLAUF.knopf) {
      DURCHLAUF.knopf.remove()
      DURCHLAUF.knopf = null
    }
    return
  }
  if (!DURCHLAUF.knopf) {
    DURCHLAUF.knopf = document.createElement('button')
    DURCHLAUF.knopf.className = 'ak-durchlauf'
    DURCHLAUF.knopf.addEventListener('click', () => void durchlaufStarten())
    document.body.appendChild(DURCHLAUF.knopf)
  }
  DURCHLAUF.knopf.textContent = DURCHLAUF.laeuft
    ? `⏹ ${DURCHLAUF.fertig}/${DURCHLAUF.gesamt} — abbrechen`
    : `▶ ${DURCHLAUF.folgen.length} Folgen prüfen`
  DURCHLAUF.knopf.title = DURCHLAUF.laeuft
    ? 'Läuft — jede Folge wird kurz geöffnet und wieder verlassen'
    : `${DURCHLAUF.folgen.length} Folgen sind bekannt. Jede wird kurz geöffnet; das landet in „Weiter ansehen".`
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
  const offeneAdressen = offenLautStand ?? offeneStaffeln
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
  uebersichtKnopf.title = !offeneAdressen
    ? `Alles gemeldet — ${gesamt} Staffeln, zum Nachsehen anklicken`
    : offeneAdressen === gesamt
      ? `${offeneAdressen} Staffeln warten auf eine Prüfung`
      : `${offeneAdressen} von ${gesamt} Staffeln warten noch — der Rest ist gemeldet, aber noch nicht eingespielt`
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
    link.href = `https://www.netflix.com/title/${id}`
    link.target = '_blank'
    link.rel = 'noreferrer noopener'
    link.textContent = eintrag.titel || `Titel ${id}`
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

    const folgen = document.createElement('div')
    folgen.className = 'ak-folgen'
    const staffeln = staffelnVon(id, eintrag)
    const empfohlen = empfohleneFolgen({ ...eintrag, staffeln })
    if (!empfohlen.length) {
      const leer = document.createElement('span')
      leer.className = 'ak-hinweis'
      leer.textContent = 'keine Folgenangabe'
      folgen.appendChild(leer)
    }
    for (const kuerzel of empfohlen) {
      const marke = document.createElement('span')
      const fertig = kuerzelErledigt(id, kuerzel)
      const staffel = staffelAusKuerzel(kuerzel)
      const angefasst = !fertig && staffel !== null && staffelAngefasst(id, staffel)
      marke.className = 'ak-folge' + (fertig ? ' ak-fertig' : angefasst ? ' ak-angefasst' : '')
      marke.textContent = kuerzel
      /**
       * Der Tooltip nennt die Zahl, die die Kachel **nicht** zeigt.
       *
       * Netflix zählt bei manchen Reihen über die Staffeln hinweg durch: Bei
       * „Carole & Tuesday" heißt die letzte Folge von Teil 2 dort **24**, es ist
       * aber die zwölfte des Teils. Auf der Kachel steht Netflix' Zahl — die
       * sieht Daniel im Player. Wer wissen will, die wievielte es innerhalb der
       * Staffel ist, findet es hier.
       */
      const nr = Number(kuerzel.split('e')[1])
      const dieStaffel = staffeln.find((x) => x.nr === staffel)
      const eigene =
        dieStaffel?.erste > 1 && Number.isFinite(nr) ? nr - dieStaffel.erste + 1 : null
      const zusatz = eigene ? ` (Folge ${eigene} dieser Staffel)` : ''
      marke.title = fertig
        ? `genau diese Folge ist gemeldet${zusatz}`
        : angefasst
          ? `aus Staffel ${staffel} ist schon etwas gemeldet: ${(erledigt[String(id)] ?? []).filter((k) => k.startsWith(staffel + 'e')).join(', ')}`
          : `noch offen${zusatz}`
      folgen.appendChild(marke)
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
    if (istErledigt(id, 'tot') || (empfohlen.length > 0 && empfohlen.every((k) => kuerzelErledigt(id, k)))) {
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
}
window.addEventListener('popstate', pfadPruefen)
setInterval(pfadPruefen, 1000)

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
