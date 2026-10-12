/**
 * **Ein Kasten für alle drei Anbieter.**
 *
 * Daniel am 10.09.2026 auf Netflix: „mach so eine schicke extension box ähnlich
 * wie bei prime … am besten selbe extension design auf allen seiten fürs
 * reporten, aber jede seite hat eigenheiten, also eigene melde elemente."
 *
 * Genau diese Trennung baut die Datei: Das **Gerüst** ist überall dasselbe, der
 * **Inhalt** kommt vom Melder der jeweiligen Seite. Die fünf Zeilen entstehen
 * zusammen, und eine leere nimmt keinen Platz (`:empty { display: none }`) —
 * damit steht die Höhe ab der ersten Zeichnung und nichts flackert.
 *
 * | Zeile | Inhalt | wechselt |
 * |---|---|---|
 * | `ak-z-titel` | Titel · Umfang, rechts das X | Text |
 * | `ak-z-inhalt` | Checkliste, Hinweise, Warnungen | Inhalt |
 * | `ak-z-melden` | die Melde-Knöpfe der Seite | Label |
 * | `ak-such-fuss` | Prüfliste, aniSearch — links/mitte/rechts | Label |
 * | `ak-z-debug` | Diagnose-Schalter samt Bericht | — |
 *
 * **Warum eine eigene Datei und kein Import:** Content-Skripte kennen keine
 * Module. Mehrere Dateien in *einem* `content_scripts`-Eintrag teilen sich
 * dagegen den Scope — dieselbe Bauform, über die `offene-netflix.js` seine
 * Liste an `melder.js` reicht. Die Datei steht im Manifest deshalb **vor** den
 * Meldern.
 *
 * **Was hier nicht hineingehört:** alles, was einen Anbieter kennt. Diese Datei
 * baut ein Gerüst und räumt es weg; welche Knöpfe darin sitzen und was sie tun,
 * entscheidet der Melder.
 */

/**
 * Baut den Kasten oder gibt den vorhandenen zurück.
 *
 * `fuerAdresse` ist die Kennung der Seite, zu der er gehört. Wechselt sie,
 * wird er ersetzt: Ein stehengebliebener Kasten beschriebe eine Seite, die
 * niemand mehr ansieht.
 *
 * **Der Schlüssel darf nicht die volle Adresse sein.** Prime schreibt `ref_`,
 * `qid` und `sr` während des Betrachtens laufend um; der Vergleich schlug damit
 * bei jedem Takt fehl, und der Kasten wurde zweimal je Sekunde neu gebaut
 * (02.09.2026). Was hier ankommt, hat der Melder deshalb schon bereinigt.
 */
/**
 * Der zuletzt gebaute Kasten je Kennung.
 *
 * **Warum gemerkt statt gesucht:** Der Melder ruft `akBox()` mehrmals je Takt —
 * für die Melde-Zeile, den Fuß, die Debug-Zeile. Jedes Mal `document
 * .querySelector` laufen zu lassen kostet drei Baumläufe zweimal je Sekunde für
 * einen Wert, der sich zwischen zwei Aufrufen nicht ändert.
 *
 * Der Griff auf das Dokument bleibt als Rückfall: Nach einem Neuladen ist die
 * Ablage leer, der Kasten aber nicht unbedingt weg — Netflix und Prime wechseln
 * die Seite ohne Neuladen.
 */
const boxen = new Map()

function akBox(kennung, fuerAdresse) {
  let kasten = boxen.get(kennung)
  if (!kasten?.isConnected) kasten = document.querySelector('.' + kennung)
  if (kasten && kasten.dataset.fuerAdresse !== fuerAdresse) {
    kasten.remove()
    boxen.delete(kennung)
    kasten = null
  }
  if (kasten) return kasten

  kasten = document.createElement('div')
  kasten.className = 'ak-box ' + kennung
  kasten.dataset.fuerAdresse = fuerAdresse
  /*
    **Die Version steht am Kasten**. Als Datenattribut, gezeichnet per
    `::before` — ein Kind-Element würde `:has(> :not(:empty))` füllen und einen
    sonst leeren Kasten sichtbar machen.
  */
  try {
    kasten.dataset.version = chrome.runtime.getManifest().version
  } catch {
    /* Nach einem Neuladen der Erweiterung ist der alte Kontext tot — dann ohne Fähnchen. */
  }
  for (const klasse of ['ak-z-titel', 'ak-z-inhalt', 'ak-z-melden']) {
    const zeile = document.createElement('div')
    zeile.className = klasse
    kasten.appendChild(zeile)
  }
  const fuss = document.createElement('div')
  fuss.className = 'ak-such-fuss'
  for (const klasse of ['ak-such-fuss-links', 'ak-such-fuss-mitte', 'ak-such-fuss-rechts']) {
    const platz = document.createElement('span')
    platz.className = klasse
    fuss.appendChild(platz)
  }
  kasten.appendChild(fuss)
  const debug = document.createElement('div')
  debug.className = 'ak-z-debug'
  kasten.appendChild(debug)
  document.body.appendChild(kasten)
  boxen.set(kennung, kasten)
  akIconStarten()
  return kasten
}

/**
 * **Die Debug-Leiste — überall dieselbe, hinter einer Trennlinie.**
 *
 * Daniel am 10.09.2026: „pack dort auch unten ne trennlinie für debug icons
 * rein, und pack dort das ak-report rein." Bei Prime steht sie seit dem
 * 09.09.2026; die anderen beiden Seiten hatten den Bericht nur als Ereignis am
 * `document`, und das setzt eine offene Konsole voraus — genau die will er
 * nicht bedienen.
 *
 * `schalter` ist eine Liste aus `{ an, aus, text, titel, aktiv?, schalten }`.
 * Ohne `aktiv` ist es ein Knopf, mit `aktiv` ein Umschalter, der seinen Zustand
 * bei jedem Takt nachzieht.
 */
/** Welcher Schalter welches Zeichen-Element hat — je Sitzung einmal gefüllt. */
const zeichenVon = new WeakMap()

function akDebugLeiste(kasten, schalter) {
  const platz = kasten?.querySelector('.ak-z-debug')
  if (!platz) return
  let leiste = platz.querySelector('.ak-debugleiste')
  if (!leiste) {
    leiste = document.createElement('div')
    leiste.className = 'ak-debugleiste'
    for (const s of schalter) {
      /*
        **Knopf und Beschriftung sind ein Paar** — so erwartet es `melder.css`
        seit dem 02.09.2026: `.ak-debugpaar` hält beide beim Umbruch zusammen,
        damit kein Text unter dem falschen Knopf landet. Ein Schalter ohne
        Beschriftung ist ein Rätsel, und das Zeichen allein trägt nur,
        solange es allein steht.
      */
      const paar = document.createElement('span')
      paar.className = 'ak-debugpaar'
      const knopf = document.createElement('button')
      knopf.type = 'button'
      knopf.className = 'ak-debugknopf'
      knopf.title = s.titel
      const zeichen = knopf
      zeichen.textContent = s.aktiv?.() ? s.an : s.aus
      const text = document.createElement('span')
      text.textContent = s.text
      paar.append(knopf, text)
      /*
        **Das Zeichen wird gemerkt, nicht gesucht.** Ein Selektor je Takt und
        Schalter kostet bei drei Knöpfen zweimal je Sekunde sechs Läufe durch
        den Baum — für einen Wert, den wir beim Bauen schon in der Hand hatten.
      */
      zeichenVon.set(s, zeichen)
      knopf.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        s.schalten()
      })
      leiste.appendChild(paar)
    }
    platz.appendChild(leiste)
  }
  /* Zustände nachziehen — nur die Zeichen, nicht die Struktur. */
  for (const s of schalter) {
    if (!s.aktiv) continue
    const zeichen = zeichenVon.get(s)
    if (zeichen) zeichen.textContent = s.aktiv() ? s.an : s.aus
  }
}

/**
 * Der Bericht-Schalter, den jede Seite bekommt.
 *
 * Er steht hier, weil er auf allen dreien dasselbe bedeutet und dasselbe
 * Zeichen trägt — was ihn herunterlädt, weiß nur der Melder.
 */
function akBerichtSchalter(laden) {
  return {
    an: '⭳',
    aus: '⭳',
    text: 'Bericht laden',
    titel: 'Diagnosebericht als JSON herunterladen (Tagebuch, Zählstand, Auftrag)',
    schalten: laden,
  }
}

/**
 * **Auf der Wiedergabeseite ist der Kasten weg** (Daniel, 08.10.2026, Disney+): Er deckte
 * Video und Player-Bedienung. Nur visuell (`melder.css`, `html.ak-im-player`), die Melder-
 * Logik läuft unverändert weiter. Läuft ein Durchgang (`html.ak-durchgang`), bleibt der Kasten:
 * Er ist dann der Notausgang. Prime Video erkennt seinen Player selbst (`amazon.js`).
 *
 * Belegt: Disney+ `/de-de/play/<uuid>` (Daniels Screenshot), Netflix `/watch/<id>`
 * (`imPlayer()` in `melder.js`).
 */
function akPlayerSeite(host, pfad) {
  if (/(^|\.)disneyplus\.com$/.test(host)) return /^\/(?:[a-z]{2}-[a-z]{2}\/)?play\//i.test(pfad)
  if (/(^|\.)netflix\.com$/.test(host)) return pfad.startsWith('/watch/')
  return false
}

function akPlayerMarke() {
  document.documentElement.classList.toggle('ak-im-player', akPlayerSeite(location.hostname, location.pathname))
}

akPlayerMarke()
/* SPA-Wechsel ohne Neuladen: Navigation API (Chrome 102+), sonst nur Zurück-Knopf. */
if (window.navigation) window.navigation.addEventListener('currententrychange', akPlayerMarke)
else window.addEventListener('popstate', akPlayerMarke)

/**
 * **Einklappbarer Kasten** (Daniel, 09.10.2026): ein kleines Icon unten rechts klappt den Kasten
 * aus und ein, auf allen Seiten gleich (Disney+, Netflix, Prime). Standard: eingeklappt, damit
 * Wiedergabe- und Stöberseiten frei bleiben. Ein Schlüssel für alle Seiten (`chrome.storage.local`,
 * Berechtigung `storage` besteht schon). Eingeklappt ist nur visuell (`melder.css`, `html.ak-zu`);
 * die Melder-Logik läuft weiter. Ein Durchgang (`html.ak-durchgang`, bei Disney+/Prime `pflicht`)
 * hält den Kasten offen, er ist dann der Notausgang.
 *
 * Die Zahl im Badge liefert jeder Melder aus seiner eigenen Prüfliste über `akZaehler()` — dieselbe
 * Variable, die seinen Knopf „N offen" beschriftet; hier wird nicht neu gezählt.
 */
const AK_ZU_SCHLUESSEL = 'akKastenZu'
let akZu = true
let akZahl = null
let akPflicht = false
let akIcon = null
let akZeichen = null
let akBadge = null
let akPruefen = null
const akBeobachtet = new WeakSet()

/** Badge-Text: leer ohne Auskunft, „✓" bei 0, ab 100 „99+". */
function akBadgeText(zahl) {
  if (zahl === null || zahl === undefined) return ''
  if (zahl <= 0) return '✓'
  return zahl > 99 ? '99+' : String(zahl)
}

/** Nur ein ausdrückliches „ausgeklappt" (false) zählt; fehlender Wert = Standard eingeklappt. */
function akZuAusSpeicher(wert) {
  return wert !== false
}

/**
 * Meldet die Zahl offener Titel der Seite (und ob ein Durchgang den Kasten offen halten muss),
 * färbt dabei den Übersichts-Knopf (`ak-fertig`, falls vorhanden) und gibt die Zahl zurück.
 */
function akZaehler(knopf, zahl, pflicht = false) {
  knopf?.classList.toggle('ak-fertig', !zahl)
  akZahl = Number.isFinite(zahl) ? zahl : null
  akPflicht = pflicht
  akIconZeichnen()
  return zahl
}

function akIconZeichnen() {
  const html = document.documentElement
  const zwang = akPflicht || html.classList.contains('ak-durchgang')
  const offen = !akZu || zwang
  html.classList.toggle('ak-zu', !offen)
  if (!akIcon) return
  akIcon.ariaExpanded = String(offen)
  akIcon.ariaDisabled = String(zwang)
  const text = akBadgeText(akZahl)
  akIcon.ariaLabel =
    (zwang ? 'Anime-Kalender-Kasten bleibt offen, solange der Durchgang läuft' : offen ? 'Anime-Kalender-Kasten einklappen' : 'Anime-Kalender-Kasten ausklappen') +
      (akZahl === null ? '' : akZahl > 0 ? `, ${akZahl} Titel zu prüfen` : ', alles geprüft')
  akZeichen.textContent = offen ? '▾' : 'AK'
  const marke = akBadge
  marke.textContent = text
  marke.hidden = !text || offen
  marke.className = akZahl === 0 ? 'ak-icon-badge ak-icon-badge-leer' : 'ak-icon-badge'
}

/** Icon zeigen, solange irgendein Kasten Inhalt trägt und kein Player läuft. */
function akIconSichtbarkeit() {
  const html = document.documentElement
  const kaesten = [...document.querySelectorAll('.ak-box')]
  for (const k of kaesten) {
    if (akBeobachtet.has(k)) continue
    akBeobachtet.add(k)
    new MutationObserver(akPruefen).observe(k, { childList: true, subtree: true, characterData: true })
  }
  const inhalt = kaesten.some((k) => k.querySelector(':scope > :not(:empty)'))
  const imPlayer = html.classList.contains('ak-im-player') && !html.classList.contains('ak-durchgang')
  const da = inhalt && !imPlayer
  html.classList.toggle('ak-icon-da', da)
  if (akIcon) akIcon.hidden = !da
  akIconZeichnen()
}

function akIconStarten() {
  if (akIcon || (window.top && window !== window.top)) return
  akIcon = document.createElement('button')
  akIcon.type = 'button'
  akIcon.className = 'ak-icon'
  akZeichen = document.createElement('span')
  akZeichen.className = 'ak-icon-zeichen'
  akBadge = document.createElement('span')
  akBadge.className = 'ak-icon-badge'
  akBadge.hidden = true
  akIcon.appendChild(akZeichen)
  akIcon.appendChild(akBadge)
  akIcon.hidden = true
  akIcon.addEventListener('click', () => {
    /* Während eines Durchgangs bleibt der Kasten offen: kein Kippen, kein Schreiben. */
    if (akIcon.ariaDisabled === 'true') return
    akZu = !akZu
    try {
      chrome.storage.local.set({ [AK_ZU_SCHLUESSEL]: akZu })
    } catch {
      /* Kontext tot (Erweiterung neu geladen) — der Zustand gilt dann nur auf dieser Seite. */
    }
    akIconZeichnen()
  })
  document.body.appendChild(akIcon)
  akIconZeichnen()
  try {
    chrome.storage.local.get(AK_ZU_SCHLUESSEL).then((x) => {
      akZu = akZuAusSpeicher(x?.[AK_ZU_SCHLUESSEL])
      akIconZeichnen()
    })
    chrome.storage.onChanged.addListener((aenderung, bereich) => {
      if (bereich !== 'local' || !(AK_ZU_SCHLUESSEL in aenderung)) return
      akZu = akZuAusSpeicher(aenderung[AK_ZU_SCHLUESSEL].newValue)
      akIconZeichnen()
    })
  } catch {
    /* ohne Speicher bleibt der Standard „eingeklappt" */
  }
  let geplant = false
  const pruefen = () => {
    if (geplant) return
    geplant = true
    requestAnimationFrame(() => {
      geplant = false
      akIconSichtbarkeit()
    })
  }
  akPruefen = pruefen
  new MutationObserver(pruefen).observe(document.body, { childList: true })
  new MutationObserver(pruefen).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  pruefen()
}
