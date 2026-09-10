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
 * niemand mehr ansieht (Daniel, 30.08.2026: „warum ändert sich das div nicht").
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
        Beschriftung ist ein Rätsel (Daniel: „neben dem button steht ein
        kurztext was der button macht"), und das Zeichen allein trägt nur,
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
