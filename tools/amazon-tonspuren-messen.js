/**
 * Messskript für Daniels Browser — warum findet die Erweiterung keine Tonspuren?
 *
 * Läuft in der Konsole einer geöffneten Prime-Video-Seite in seiner
 * angemeldeten Sitzung. Es ruft nichts Fremdes ab und ändert nichts; es liest
 * nur den Quelltext, den die Seite ohnehin geladen hat, und zählt aus.
 *
 * Anlass (25.08.2026): „Akame ga Kill" (`0HSXN9KO9VCAUTXWKIY203H5KV`, ein
 * ADN-Kanal-Titel) zeigt 24 Folgen, der Knopf blieb aber auf „Tonspuren noch
 * nicht geladen" stehen. Der Riegel ist richtig — er verhindert eine Meldung
 * über eine Seite, die die Erweiterung nicht gelesen hat. Offen ist, **warum**
 * sie nichts liest.
 *
 * Aufruf: Konsole öffnen (F12), einfügen, Enter. Das Ergebnis liegt danach
 * auch in der Zwischenablage.
 */
;(async () => {
  const h = document.documentElement.innerHTML
  const zaehl = (muster) => (h.match(muster) || []).length
  const ergebnis = {
    adresse: location.pathname + location.search,
    quelltextZeichen: h.length,
    audioTracks: zaehl(/"audioTracks"/g),
    audioTracksMitDeutsch: zaehl(/"audioTracks"\s*:\s*\[[^\]]{0,400}Deutsch/g),
    episodeNumber: zaehl(/"episodeNumber"/g),
    episodeList: zaehl(/"episodeList"/g),
    episodeCount: /"episodeCount"\s*:\s*(\d+)/.exec(h)?.[1] ?? null,
    titleID: zaehl(/"titleID"/g),
    benefitId: [...new Set((h.match(/"benefitId"\s*:\s*"([^"]+)"/g) || []).map((s) => s.split('"')[3]))],
    episodePages: zaehl(/"episodePages"/g),
    // Was die Seite selbst anzeigt — der Prüfstein gegen den Quelltext.
    folgenLautSeite: (document.body.innerText.match(/(\d+)\s+Folgen/) || [])[1] ?? null,
    kachelnImDom: document.querySelectorAll('[data-testid*="episode"], li[class*="episode"]').length,
  }

  // Trägt die Seite die Sprachen woanders? Alle Felder sammeln, die „Deutsch" nennen.
  const felderMitDeutsch = new Set()
  for (const m of h.matchAll(/"([a-zA-Z_]{3,30})"\s*:\s*(?:"[^"]{0,60}Deutsch|\[[^\]]{0,200}Deutsch)/g)) {
    felderMitDeutsch.add(m[1])
  }
  ergebnis.felderMitDeutsch = [...felderMitDeutsch].slice(0, 20)

  const text = JSON.stringify(ergebnis, null, 2)
  console.log(text)
  try {
    await navigator.clipboard.writeText(text)
    console.log('— steht in der Zwischenablage —')
  } catch {
    console.log('— Zwischenablage ging nicht, bitte den Text oben kopieren —')
  }
})()
