/**
 * **Hinterlässt der Playback-Abruf einen Eintrag unter „Weiterschauen"?**
 *
 * Die eine Frage, an der seit dem 26.08.2026 hängt, ob die Erweiterung Disney+
 * selbsttätig durchgehen darf — und mit ihr der Netflix-Weg. Beim ersten
 * Versuch war sie nicht entscheidbar, weil Daniel dieselbe Folge kurz zuvor
 * selbst abgespielt hatte: „du machst voreilige schlüsse, ich hab doch selbst
 * auch die episode aufgemacht."
 *
 * Dieses Skript macht **einen** Abruf für **eine** Folge einer Serie, die nie
 * geöffnet wurde. Danach entscheidet ein Blick auf die Startseite.
 *
 * Es spricht den Mitleser der Erweiterung an (`disney-leser.js`, MAIN-Welt),
 * nicht Disney direkt — der hält das Token, das die Seite ohnehin benutzt.
 * Deshalb läuft es auf **jeder** Disney+-Serienseite, auch bei einem Titel, der
 * nicht auf der Prüfliste steht.
 *
 * Einfügen in die Konsole (F12) auf der Serienseite. Es meldet, was es tut.
 */
;(async () => {
  const MARKE = 'ak-disney'
  const STEUER = 'ak-disney-steuer'

  function frage(nachricht, passt, sekunden = 20) {
    return new Promise((fertig) => {
      const zeit = setTimeout(() => {
        window.removeEventListener('message', hoerer)
        fertig(null)
      }, sekunden * 1000)
      function hoerer(e) {
        if (e.source !== window || e.data?.marke !== MARKE) return
        if (!passt(e.data)) return
        clearTimeout(zeit)
        window.removeEventListener('message', hoerer)
        fertig(e.data)
      }
      window.addEventListener('message', hoerer)
      window.postMessage({ marke: STEUER, ...nachricht }, '*')
    })
  }

  console.log('%c[Gegenprobe] Folgenliste anfordern …', 'color:#38bdf8')
  const liste = await frage({ frageListe: true }, (d) => Array.isArray(d.folgen))
  if (!liste) {
    console.log(
      '%c[Gegenprobe] Keine Antwort vom Mitleser. Läuft die Erweiterung auf dieser Seite?',
      'color:#f87171',
    )
    return
  }
  if (!liste.bereit) {
    console.log(
      '%c[Gegenprobe] Der Mitleser hat noch kein Token. Seite einmal neu laden und erneut versuchen.',
      'color:#fbbf24',
    )
    return
  }
  const folgen = liste.folgen.filter((f) => f.playbackId)
  console.log(`[Gegenprobe] ${folgen.length} Folge(n) mit Kennung gefunden.`)
  if (!folgen.length) {
    console.log('%c[Gegenprobe] Ohne Kennung geht es nicht weiter.', 'color:#f87171')
    return
  }

  /*
    **Eine Folge genügt, und zwar die erste.** Der Eintrag unter
    „Weiterschauen" entsteht — wenn überhaupt — beim ersten Abruf; jeder
    weitere macht die Messung nur teurer und den Verlauf unübersichtlicher.
  */
  const eine = folgen[0]
  console.log(
    `%c[Gegenprobe] Frage genau eine Folge ab: ${eine.staffel ?? '?'}×${eine.nummer ?? '?'} — ${eine.titel ?? ''}`,
    'color:#38bdf8',
  )
  const antwort = await frage(
    { playbackId: eine.playbackId },
    (d) => d.antwortFuer === eine.playbackId,
  )
  if (!antwort) {
    console.log('%c[Gegenprobe] Keine Antwort auf den Playback-Abruf.', 'color:#f87171')
    return
  }
  if (antwort.fehler) {
    console.log(`%c[Gegenprobe] Fehlgeschlagen: ${antwort.fehler}`, 'color:#f87171')
    return
  }

  console.log(
    `%c[Gegenprobe] Tonspuren: ${antwort.sprachen.join(', ')}`,
    'color:#4ade80;font-weight:bold',
  )
  console.log(
    '%c[Gegenprobe] Jetzt die Startseite neu laden und „Weiterschauen" ansehen.\n' +
      'Steht diese Serie dort → der Abruf hinterlässt Spuren.\n' +
      'Steht sie nicht dort → der Weg ist sauber.',
    'color:#38bdf8',
  )
})()
