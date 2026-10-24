/*
  **Melde-Knopf: nach einer angekommenen Meldung gesperrt, bis die Seite etwas Neues zeigt** (4.31.7).

  Anlass (Daniel, 16.10.2026, Prime, Arifureta): Der Knopf stand auf „gemeldet ✓" und ließ sich erneut
  klicken, Staffel 1 (Deutsch) wie Staffel 2 (nicht mehr verfügbar). Jede Doppelmeldung kostet
  D1-Schreibzeilen. Eine Sperre aus „Beschriftung + Zustand" hält nicht, weil ein Takt den Knopf
  neu beschriftet; hier hängt sie am Befund (Seite + Staffel + Tonurteil) und wird nach jedem Zeichnen angelegt.
  Alle gemeldeten Befunde der Seite bleiben gemerkt (Menge, Frist je Befund): S1 → S2 → S1 öffnet nicht wieder.
  Seit 4.31.8 (Prime): gesperrt zeigt die Marke statt des Knopfs, und die Befunde überstehen das Neuladen.

  - `setzeKlick`: Anbieter, die den Knopf je Zustand neu setzen (ADN, Disney+) — kein Klick = gesperrt.
  - `sperren` / `anwenden`: Prime, dessen Takt den Knopf aus vielen Zweigen beschriftet.
  Ohne Browser-Zustand, damit `melde-sperre.test.cjs` es im Sandkasten spielen kann.
*/
/* Gemeldete Befunde überstehen das Neuladen (Daniel, 16.10.2026, Nukitashi: zurück, wieder „melden"); nach einem Tag fallen sie weg. */
globalThis.AK_MELDE_SPEICHER = (() => {
  const SCHLUESSEL = 'akMeldeSperre'
  const HALTE_MS = 24 * 3600 * 1000

  /** Liest die gesicherten Befunde der letzten `HALTE_MS` in `gemeldet` ein, mit ihrer Meldezeit. */
  async function laden(gemeldet, lesen) {
    const alt = (await lesen(SCHLUESSEL))?.[SCHLUESSEL] ?? {}
    for (const [befund, zeit] of Object.entries(alt)) {
      if (Date.now() - zeit < HALTE_MS) gemeldet.set(befund, zeit)
    }
  }

  /**
   * Führt die Befunde der Seite mit dem Speicher zusammen: andere Tabs sichern dort ihre eigenen (Prüfer, 1397).
   * Je Befund gilt die jüngste Meldezeit; Verfallenes fällt heraus, so wächst der Speicher nicht.
   */
  async function sichern(gemeldet, lesen, schreiben) {
    const neu = {}
    const gesichert = (await lesen(SCHLUESSEL))?.[SCHLUESSEL] ?? {}
    for (const [befund, zeit] of [...Object.entries(gesichert), ...gemeldet]) {
      if (Date.now() - zeit < HALTE_MS && !(neu[befund] > zeit)) neu[befund] = zeit
    }
    return schreiben({ [SCHLUESSEL]: neu })
  }

  return { laden, sichern }
})()

globalThis.AK_MELDE_SPERRE = (() => {
  /*
    Der Briefkasten (`?zaehlen=1`) hält die Edge bis `ZAEHLEN_SEKUNDEN` (worker/src/pruefung-zaehlen.ts, 2 h),
    eine Meldung leert ihn nicht: „nicht da“ zählt erst, wenn die Antwort sicher nach der Meldung entstand.
  */
  const FRIST_MS = (7200 + 600) * 1000
  const TEXT = 'gemeldet ✓'

  function setzeKlick(knopf, klick) {
    knopf.disabled = !klick
    knopf.setAttribute('aria-disabled', String(!klick))
    knopf.onclick = klick
  }

  /** Nach erfolgreicher Antwort aufrufen: `befund` nennt, wofür gemeldet wurde. */
  function sperren(gemeldet, befund, jetzt) {
    gemeldet.set(befund, jetzt)
  }

  /** 'gesperrt' | 'frei' | 'abgelaufen' (Meldung kam nicht an und die Frist ist um) — je Befund, auch bei A → B → A. */
  function zustand(gemeldet, befund, jetzt, angekommen) {
    if (!gemeldet.has(befund)) return 'frei'
    if (angekommen || jetzt - gemeldet.get(befund) < FRIST_MS) return 'gesperrt'
    return 'abgelaufen'
  }

  /** Nach jedem Zeichnen: legt die Sperre an (oder hebt sie auf) und nennt den Zustand. */
  function anwenden(knopf, gemeldet, befund, jetzt, angekommen) {
    const z = zustand(gemeldet, befund, jetzt, angekommen)
    if (z === 'gesperrt') {
      knopf.disabled = true
      knopf.setAttribute('aria-disabled', 'true')
      if (knopf.textContent !== TEXT) knopf.textContent = TEXT
      return z
    }
    /* Nur eine belegte Antwort „nicht da“ (false) vergisst den Befund; unbekannt (null) lässt ihn stehen. */
    if (z === 'abgelaufen' && angekommen === false) gemeldet.delete(befund)
    return z
  }

  /**
   * Die Sperre für einen Knopf, den ein Takt aus vielen Zweigen beschriftet (Prime).
   * `befund()` nennt, wofür eine Meldung gälte; `angekommen()`, ob der Worker sie kennt;
   * `zeichneRoh()` ist das bisherige Zeichnen; `standVergessen()` erzwingt danach eine Neubeschriftung;
   * `lesen(schluessel)` / `schreiben(werte)` sind der Speicher (`chrome.storage.local`).
   * Gesperrt spricht die Marke (`gesperrt()` in `zeichnenRoh`), der Knopf geht: keine Information zweimal.
   */
  function fuer(knopf, { befund, angekommen, zeichneRoh, standVergessen, lesen, schreiben }) {
    let gesperrt = false
    const gemeldet = new Map()
    const lage = () => zustand(gemeldet, befund(), Date.now(), angekommen())
    const { laden, sichern } = globalThis.AK_MELDE_SPEICHER
    const geladen = laden(gemeldet, lesen).catch(() => {})
    return {
      geladen,
      gesperrt: () => lage() === 'gesperrt',
      /* Ohne Angabe gilt der Befund von jetzt; der Klick gibt seinen mit, denn nach den awaits ist die Seite womöglich weiter. */
      vermerken(gemeldeterBefund = befund()) {
        sperren(gemeldet, gemeldeterBefund, Date.now())
        return sichern(gemeldet, lesen, schreiben).catch(() => {})
      },
      zeichnen() {
        if (gesperrt && lage() !== 'gesperrt') {
          standVergessen()
          knopf.removeAttribute('aria-disabled')
        }
        zeichneRoh()
        gesperrt = anwenden(knopf, gemeldet, befund(), Date.now(), angekommen()) === 'gesperrt'
        if (gesperrt) knopf.style.display = 'none'
      },
      /* Ein Klick auf den gesperrten Knopf meldet nichts — auch nicht, wenn er aus dem Code kommt. `tun` bekommt den Befund des Klicks als erstes Argument. */
      mitSperre: (tun) => (...args) => (lage() === 'gesperrt' ? undefined : tun(befund(), ...args)),
    }
  }

  return { FRIST_MS, setzeKlick, sperren, zustand, anwenden, fuer }
})()

/**
 * Angekommen heißt: der Worker führt die Meldung — die Adresse der Prüfliste oder die Kennung der Seite.
 * Fehlt seine Antwort (`adressen` null), ist es unbekannt (null): die Frist gilt, der Befund bleibt gemerkt.
 * Nur eine Antwort ohne Treffer ergibt false (Prüfer, 1397).
 */
globalThis.AK_MELDUNG_BELEGT = function belegt(adresse, kennung, adressen, seiten) {
  if (adressen?.has(adresse)) return true
  const unbekannt = adressen ? false : null
  try {
    const k = kennung()
    return Boolean(k && seiten?.has(String(k))) || unbekannt
  } catch {
    return unbekannt
  }
}
