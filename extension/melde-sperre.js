/*
  **Melde-Knopf: nach einer angekommenen Meldung gesperrt, bis die Seite etwas Neues zeigt** (4.31.7).

  Anlass (Daniel, 16.10.2026, Prime, Arifureta): Der Knopf stand auf „gemeldet ✓" und ließ sich erneut
  klicken, Staffel 1 (Deutsch) wie Staffel 2 (nicht mehr verfügbar). Jede Doppelmeldung kostet
  D1-Schreibzeilen. Eine Sperre aus „Beschriftung + Zustand" hält nicht, weil ein Takt den Knopf
  neu beschriftet; hier hängt sie am Befund (Seite + Tonurteil) und wird nach jedem Zeichnen angelegt.

  - `setzeKlick`: Anbieter, die den Knopf je Zustand neu setzen (ADN, Disney+) — kein Klick = gesperrt.
  - `sperren` / `anwenden`: Prime, dessen Takt den Knopf aus vielen Zweigen beschriftet.
  Ohne Browser-Zustand, damit `melde-sperre.test.cjs` es im Sandkasten spielen kann.
*/
globalThis.AK_MELDE_SPERRE = (() => {
  /* Der Briefkasten ist bis zu einer Minute alt; kam die Meldung dann nicht an, darf man erneut melden. */
  const FRIST_MS = 120000
  const TEXT = 'gemeldet ✓'

  function setzeKlick(knopf, klick) {
    knopf.disabled = !klick
    knopf.setAttribute('aria-disabled', String(!klick))
    knopf.onclick = klick
  }

  /** Nach erfolgreicher Antwort aufrufen: `befund` nennt, wofür gemeldet wurde. */
  function sperren(knopf, befund, jetzt) {
    knopf.dataset.gemeldetBefund = befund
    knopf.dataset.gemeldetAm = String(jetzt)
  }

  /** 'gesperrt' | 'frei' | 'abgelaufen' (Meldung kam nicht an und die Frist ist um). */
  function zustand(knopf, befund, jetzt, angekommen) {
    if (knopf.dataset.gemeldetBefund !== befund) return 'frei'
    if (angekommen || jetzt - Number(knopf.dataset.gemeldetAm) < FRIST_MS) return 'gesperrt'
    return 'abgelaufen'
  }

  /** Nach jedem Zeichnen: legt die Sperre an (oder hebt sie auf) und nennt den Zustand. */
  function anwenden(knopf, befund, jetzt, angekommen) {
    const z = zustand(knopf, befund, jetzt, angekommen)
    if (z === 'gesperrt') {
      knopf.disabled = true
      knopf.setAttribute('aria-disabled', 'true')
      if (knopf.textContent !== TEXT) knopf.textContent = TEXT
      return z
    }
    if (knopf.dataset.gemeldetBefund === undefined) return z
    delete knopf.dataset.gemeldetBefund
    delete knopf.dataset.gemeldetAm
    knopf.removeAttribute('aria-disabled')
    return z
  }

  /**
   * Die Sperre für einen Knopf, den ein Takt aus vielen Zweigen beschriftet (Prime).
   * `befund()` nennt, wofür eine Meldung gälte; `angekommen()`, ob der Worker sie kennt;
   * `zeichneRoh()` ist das bisherige Zeichnen; `standVergessen()` erzwingt danach eine Neubeschriftung.
   */
  function fuer(knopf, { befund, angekommen, zeichneRoh, standVergessen }) {
    let gesperrt = false
    const lage = () => zustand(knopf, befund(), Date.now(), angekommen())
    return {
      vermerken: () => sperren(knopf, befund(), Date.now()),
      zeichnen() {
        if (gesperrt && lage() !== 'gesperrt') standVergessen()
        zeichneRoh()
        gesperrt = anwenden(knopf, befund(), Date.now(), angekommen()) === 'gesperrt'
      },
      /* Ein Klick auf den gesperrten Knopf meldet nichts — auch nicht, wenn er aus dem Code kommt. */
      mitSperre: (tun) => (...args) => (lage() === 'gesperrt' ? undefined : tun(...args)),
    }
  }

  return { FRIST_MS, setzeKlick, sperren, zustand, anwenden, fuer }
})()
