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
 */

const WORKER = 'https://newsletter.animekalender.workers.dev/lauf'.replace('/lauf', '/pruefung')

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

// --- Tonspuren finden, je Anbieter -----------------------------------------

/**
 * Netflix: über die Player-Schnittstelle, nicht über das Menü.
 *
 * Auf der Titelseite stehen die Sprachen nirgends — geprüft am 21.08.2026:
 * kein `audioLocale`, kein `audioTracks`, nichts im sichtbaren Text. Sie
 * erscheinen erst, wenn eine Folge läuft. Dann aber gibt der Player sie direkt
 * heraus, ohne dass jemand das Sprachmenü aufklappen muss.
 */
function netflixSpuren() {
  const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
  const sitzungen = api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []
  if (!sitzungen.length) return null
  const player = api.videoPlayer.getVideoPlayerBySessionId(sitzungen[0])
  const spuren = player?.getAudioTrackList?.() ?? []
  if (!spuren.length) return null
  return spuren.map((s) => ({ code: s.bcp47 ?? s.language ?? '', name: s.displayName ?? '' }))
}

/** Crunchyroll und Prime kommen später — der Rahmen steht. */
function spurenLesen() {
  if (location.hostname.includes('netflix.com')) return netflixSpuren()
  return null
}

// --- Knopf ------------------------------------------------------------------

let knopf = null

function urteil(spuren) {
  const echte = spuren.filter((s) => !IST_BESCHREIBUNG.test(s.name))
  const deutsch = echte.some((s) => IST_DEUTSCH(s.code, s.name))
  return { deutsch, echte }
}

/**
 * Auf einer Titelseite ohne abspielbare Folge gibt es nichts zu lesen — und
 * trotzdem etwas zu melden.
 *
 * Daniel am 22.08.2026 beim ersten Titel der Prüfliste: „hier sollte auch ein
 * button kommen, es gibt keine episode zum anklicken". Steht dort nur
 * „Erinnern", gibt es die Reihe auf Netflix nicht zu sehen — das ist ein
 * Befund, kein Fehlschlag.
 *
 * **Der Pfad taugt nicht als Erkennungsmerkmal.** Ein Klick auf
 * `netflix.com/title/<nummer>` landet in aller Regel nicht dort: Netflix
 * schiebt die Startseite darunter und zeigt den Titel als Überlagerung, die
 * Adresse lautet dann `/de/?jbv=<nummer>` oder `/browse?jbv=…`. Die erste
 * Fassung dieser Prüfung sah deshalb nichts (22.08.2026, gemeldet mit Bild).
 * Erkannt wird jetzt die Überlagerung selbst.
 */
function reihenNummer() {
  const ausPfad = /\/title\/(\d+)/.exec(location.pathname)?.[1]
  const ausQuery = new URLSearchParams(location.search).get('jbv')
  const ausZustand = window.netflix?.reactContext?.models?.playerModel?.data?.videoId
  return ausPfad || ausQuery || (ausZustand ? String(ausZustand) : null)
}

function keineFolgeSichtbar() {
  // Ohne erkennbare Reihe ist das hier irgendeine Netflix-Seite.
  if (!reihenNummer()) return false
  const text = document.body.innerText || ''
  const hatErinnern = /\bErinnern\b|\bRemind me\b/.test(text)
  const hatAbspielen = Array.from(document.querySelectorAll('a, button')).some((el) =>
    /^\s*(Abspielen|Play|Weiterschauen|Resume|Folge \d+ abspielen)\s*$/i.test((el.textContent || '').trim()),
  )
  return hatErinnern && !hatAbspielen
}

function beschriftung(spuren) {
  if (!spuren) {
    if (keineFolgeSichtbar()) return { text: 'Keine Folge abspielbar — melden', klasse: 'ak-nein', aktiv: true }
    if (reihenNummer()) return { text: 'Warte auf eine laufende Folge …', klasse: 'ak-leer', aktiv: false }
    return { text: 'Kein Titel erkannt', klasse: 'ak-leer', aktiv: false }
  }
  const { deutsch, echte } = urteil(spuren)
  return deutsch
    ? { text: `Deutsch melden (${echte.length} Spuren)`, klasse: 'ak-ja', aktiv: true }
    : { text: `Kein Deutsch melden (${echte.length} Spuren)`, klasse: 'ak-nein', aktiv: true }
}

async function melden() {
  const spuren = spurenLesen()
  const ohneFolge = !spuren && keineFolgeSichtbar()
  if (!spuren && !ohneFolge) return zeigeErgebnis('Keine Tonspuren gefunden — läuft eine Folge?', false)

  const { deutsch, echte } = spuren ? urteil(spuren) : { deutsch: false, echte: [] }
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return zeigeErgebnis('Kein Token hinterlegt — siehe Einstellungen', false)

  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        // Die Titelseite, nicht die Abspieladresse — danach sucht die Pipeline.
        url: adresseDerReihe(),
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        // `weg` heißt: Die Reihe ist dort nicht zu sehen. Das ist etwas anderes
        // als „keine deutsche Fassung" und wird in der Pipeline auch anders
        // behandelt (available: false statt dub: false).
        befund: ohneFolge ? 'weg' : deutsch ? 'dub' : 'kein_dub',
        titel: document.title.replace(/\s*-\s*Netflix\s*$/i, '').trim() || null,
        notiz: ohneFolge
          ? 'Titelseite ohne abspielbare Folge — nur „Erinnern"'
          : `${echte.length} Tonspuren, ${spuren.length - echte.length} Audiodeskriptionen`,
      }),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) return zeigeErgebnis(daten.error ?? `Fehler ${antwort.status}`, false)
    const kopf = ohneFolge ? 'Als nicht abrufbar gemeldet' : deutsch ? 'Deutsch gemeldet' : 'Kein Deutsch gemeldet'
    zeigeErgebnis(`${kopf} (${daten.offen} offen)`, true)
  } catch (err) {
    zeigeErgebnis(`Nicht erreichbar: ${err.message}`, false)
  }
}

/**
 * Welche Adresse gemeldet wird.
 *
 * Beim Abspielen steht in der Adresszeile `/watch/<folgennummer>` — die kennt
 * unsere Prüfliste nicht. Sie führt die Reihe unter `/title/<nummer>`. Netflix
 * hält die Reihennummer im Player-Zustand; findet sie sich dort nicht, wird die
 * Abspieladresse gemeldet und die Zuordnung passiert später von Hand.
 */
function adresseDerReihe() {
  const ausZustand = window.netflix?.reactContext?.models?.playerModel?.data?.videoId
  const ausPfad = /\/title\/(\d+)/.exec(location.pathname)?.[1]
  const nummer = ausPfad ?? ausZustand
  return nummer ? `https://www.netflix.com/title/${nummer}` : location.href.split('?')[0]
}

function zeigeErgebnis(text, gutgegangen) {
  if (!knopf) return
  const alt = knopf.textContent
  knopf.textContent = text
  knopf.classList.add(gutgegangen ? 'ak-erfolg' : 'ak-fehler')
  setTimeout(() => {
    knopf.classList.remove('ak-erfolg', 'ak-fehler')
    knopf.textContent = alt
  }, 3500)
}

/**
 * Der Knopf ist immer da, sobald ein Titel erkennbar ist.
 *
 * Erste Fassung blendete ihn nur ein, wenn Tonspuren zu lesen waren — und
 * verschwand damit genau in dem Fall, den Daniel am häufigsten sieht. Ein
 * Knopf, der nichts sagt, ist besser als keiner: Er zeigt, dass die
 * Erweiterung lebt, und sagt, worauf sie wartet.
 */
function knopfZeigen() {
  const spuren = spurenLesen()
  const { text, klasse, aktiv } = beschriftung(spuren)

  if (!reihenNummer() && !spuren) {
    if (knopf) { knopf.remove(); knopf = null }
    return
  }
  if (!knopf) {
    knopf = document.createElement('button')
    knopf.className = 'ak-melder'
    knopf.addEventListener('click', melden)
    document.body.appendChild(knopf)
  }
  knopf.disabled = !aktiv
  if (!knopf.classList.contains('ak-erfolg') && !knopf.classList.contains('ak-fehler')) {
    knopf.textContent = text
    knopf.classList.remove('ak-ja', 'ak-nein', 'ak-leer')
    knopf.classList.add(klasse)
  }
}

// Der Player braucht einen Moment, und die Spuren kommen erst mit ihm.
// Zwei Sekunden Takt reichen und kosten nichts.
setInterval(knopfZeigen, 2000)
knopfZeigen()
